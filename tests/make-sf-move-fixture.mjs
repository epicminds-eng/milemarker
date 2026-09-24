/* Rebuilds tests/fixtures/sf-move-export.json from the read-only sf-move repo.
   Not part of `npm test` — the fixture is committed. To regenerate:
     git clone --depth 1 https://github.com/epicminds-eng/sf-move /tmp/sf-move
     node tests/make-sf-move-fixture.mjs
   It loads /tmp/sf-move/index.html headless with a fresh localStorage, then drives the real UI:
   tags Sort items car / car / ship / sell (sf-move keeps dispositions in state.disp, so nothing is
   packable until something is tagged) and removes one, packs the two car items, taps Arrived on
   Amarillo, sets a budget of 1500, and writes out the raw localStorage object sfMoveApp_v1 — exactly
   what sf-move's Export produces. The sell and removed items are what proves Mile Marker's import
   drops them instead of packing them.
   From sf-move a0489f4 (v118) it also carries the spend close-out: a hand row "Watter" $18.72 is added
   through the real Add expense sheet, the store is put back the way a pre-v118 phone had it (the five
   pet-fee/toll rows planned, Ship Sticks planned, no spendCloseoutV1 flag) and reloaded, so sf-move's
   OWN spendCloseoutV1 runs over it: five actuals, seed-m0 gone, "Watter" → "Water". */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, existsSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "/tmp/sf-move/index.html";
const OUT = join(ROOT, "tests", "fixtures", "sf-move-export.json");
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const PW_FALLBACK = "/opt/pw-browsers/chromium";
const TAG = [                          /* [Sort item label, disposition] */
  ["Gamer bag + current clubs", "car"],
  ["Rollerblades", "car"],
  ["Launch monitor (Approach)", "ship"],
  ["Kettlebell", "sell"]
];
/* Removed in Sort. sf-move's remove handler does `delete state.disp[it.id]`, so a real export can
   never carry a disposition AND a `removed` flag for the same id — tagging it here then removing it
   would just wipe the tag. The both-set case (which is what proves Mile Marker honours `removed`
   rather than merely lacking a disp) is constructed in tests/smoke.mjs (j) instead. */
const REMOVE = "Printer";
const PACK_ME = TAG.filter(x => x[1] === "car").map(x => x[0]);

if (!existsSync(SRC)) {
  console.error(`${SRC} not found — clone the read-only source first:\n  git clone --depth 1 https://github.com/epicminds-eng/sf-move /tmp/sf-move`);
  process.exit(1);
}

const launch = async () => {
  try { return await chromium.launch(); }
  catch (e) { if (!existsSync(PW_FALLBACK)) throw e; return chromium.launch({ executablePath: PW_FALLBACK }); }
};

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA,
  deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(pathToFileURL(SRC).href);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector("#page-move.active, #page-move", { state: "attached" });

/* 1. tag items in Sort — nothing is packable until it carries a disposition */
await page.locator("#nav-sort").click();
await page.waitForSelector("#page-sort.active");
const sortRow = label => page.locator("#sortGroups .item").filter({ has: page.locator(".name", { hasText: label }) }).first();
for (const [label, d] of TAG) {
  const row = sortRow(label);
  await row.scrollIntoViewIfNeeded();
  await row.locator(`.tag[data-d="${d}"]`).click();
}
const rm = sortRow(REMOVE);
await rm.scrollIntoViewIfNeeded();
await rm.locator(".tag.del").click();

/* 2. pack both of them from the Pack tab */
await page.locator("#nav-pack").click();
await page.waitForSelector("#page-pack.active");
for (const label of PACK_ME) {
  const row = page.locator("#packGroups .pcheck").filter({ hasText: label }).first();
  await row.scrollIntoViewIfNeeded();
  await row.locator(".pring").click();
}

/* 3. Arrival stamps. From v116 the trip is finished: sfArrivedV1 stamps SF and marks every earlier
      stop arrived, so there is no "Mark arrived" button left to tap and nothing to add by hand. Undoing
      and re-marking one would overwrite a real arrival time with now(), so the generator just checks
      that the finished state is there. The stop cards live in the Itinerary sub-tab. */
await page.locator("#nav-trip").click();
await page.waitForSelector("#page-trip.active");
await page.locator('#tripSeg [data-s="itinerary"]').click();
await page.waitForSelector('#tripStops .card[data-stop="sf"]');
/* read the store, not the cards: sf-move still renders "Mark arrived" on the CURRENT stop even once
   it is arrived, because status "cur" beats "done" in its per-stop render */
const done = await page.evaluate(() => {
  const t = JSON.parse(localStorage.getItem("sfMoveApp_v1")).trip;
  return { arrived: Object.keys(t.arrived).filter(k => t.arrived[k]), sf: t.arrivedAt.sf };
});
if (!done.sf || done.arrived.length < 6)
  throw new Error(`sfArrivedV1 did not run: ${JSON.stringify(done)}`);

/* 4. budget 1500 */
await page.locator("#nav-spend").click();
await page.waitForSelector("#page-spend.active");
await page.locator("#budgetLink").click();
await page.locator("#budgetRow .sp-edit input").fill("1500");
await page.locator("#budgetRow .sp-edit .btn").click();

/* 5. the hand row, through the real Add expense sheet */
await page.locator(".spadd[data-add]").first().click();
await page.waitForSelector(".sheet .amt");
await page.locator(".sheet .amt").fill("18.72");
await page.locator(".sheet .note").fill("Watter");
await page.locator('.sheet [data-cat="groceries"]').click();
await page.locator(".sheet [data-save]").click();
await page.waitForTimeout(300);

/* 6. put the store back the way a pre-v118 phone had it, then let sf-move's own close-out run */
const PRE_V118 = {   /* sf-move c04cb6c seedSpend, verbatim */
  "seed-p2": [75, false], "seed-p3": [50, false], "seed-p5": [50, false],
  "seed-t1": [5, true], "seed-t2": [12, true] };
await page.evaluate(PRE => {
  const s = JSON.parse(localStorage.getItem("sfMoveApp_v1"));
  s.spend.entries.forEach(e => { if (PRE[e.id]) { e.planned = true; e.billsLater = PRE[e.id][1]; } });
  if (!s.spend.entries.some(e => e.id === "seed-m0"))
    s.spend.entries.push({ id: "seed-m0", amount: 240, cat: "misc", note: "Ship Sticks · 3 pieces", day: 0, stopId: null,
      ts: Date.now(), planned: true, billsLater: false });
  delete s.spend.spendCloseoutV1;
  localStorage.setItem("sfMoveApp_v1", JSON.stringify(s));
}, PRE_V118);
await page.reload();
await page.waitForTimeout(900);
const closed = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("sfMoveApp_v1")).spend, e = s.entries;
  return { flag: !!s.spendCloseoutV1,
    planned: e.filter(x => /^seed-/.test(x.id) && x.planned).map(x => x.id),
    m0: e.some(x => x.id === "seed-m0"),
    water: e.filter(x => x.amount === 18.72).map(x => x.note) };
});
if (!closed.flag || closed.planned.length || closed.m0 || closed.water.join() !== "Water")
  throw new Error(`spendCloseoutV1 did not close the store out: ${JSON.stringify(closed)}`);

const raw = await page.evaluate(() => localStorage.getItem("sfMoveApp_v1"));
await browser.close();

const obj = JSON.parse(raw);
writeFileSync(OUT, JSON.stringify(obj, null, 2) + "\n");
console.log(`wrote ${OUT}`);
console.log(`  arrived: ${Object.keys(obj.trip.arrived).filter(k => obj.trip.arrived[k]).join(", ")}`);
console.log(`  arrivedAt.sf: ${obj.trip.arrivedAt.sf}`);
console.log(`  packed: ${Object.keys(obj.packed).filter(k => obj.packed[k]).join(", ")}`);
console.log(`  disp: ${Object.entries(obj.disp).map(([k, v]) => `${k}=${v}`).join(", ")}`);
console.log(`  removed: ${Object.keys(obj.removed).join(", ")}`);
console.log(`  budget: ${obj.spend.budget} · entries: ${obj.spend.entries.length}`);
console.log(`  close-out: ${obj.spend.spendCloseoutV1} · seed rows ${obj.spend.entries.filter(e => /^seed-/.test(e.id)).map(e => e.id + (e.planned ? "(planned)" : "")).join(",")}`);
console.log(`  hand row: ${JSON.stringify(obj.spend.entries.filter(e => e.amount === 18.72).map(e => ({ id: e.id, note: e.note })))}`);
