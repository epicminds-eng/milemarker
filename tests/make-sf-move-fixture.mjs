/* Rebuilds tests/fixtures/sf-move-export.json from the read-only sf-move repo.
   Not part of `npm test` — the fixture is committed. To regenerate:
     git clone --depth 1 https://github.com/epicminds-eng/sf-move /tmp/sf-move
     node tests/make-sf-move-fixture.mjs
   It loads /tmp/sf-move/index.html headless with a fresh localStorage, then drives the real UI:
   tags Sort items car / car / ship / sell (sf-move keeps dispositions in state.disp, so nothing is
   packable until something is tagged) and removes one, packs the two car items, taps Arrived on
   Amarillo, sets a budget of 1500, and writes out the raw localStorage object sfMoveApp_v1 — exactly
   what sf-move's Export produces. The sell and removed items are what proves Mile Marker's import
   drops them instead of packing them. */
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

/* 3. Mark arrived on the next un-stamped stop. v107 backfills strobert/amarillo/holbrook itself
      (arrivedAtV1, day2ArrivedV1, day3ArrivedV1), so Mom's is the first stop still showing the button.
      The stop cards live in the Itinerary sub-tab from v107 on. */
await page.locator("#nav-trip").click();
await page.waitForSelector("#page-trip.active");
await page.locator('#tripSeg [data-s="itinerary"]').click();
const arrive = page.locator('#tripStops .card[data-stop="moms"] [data-arr]').first();
await arrive.scrollIntoViewIfNeeded();
await arrive.click();

/* 4. budget 1500 */
await page.locator("#nav-spend").click();
await page.waitForSelector("#page-spend.active");
await page.locator("#budgetLink").click();
await page.locator("#budgetRow .sp-edit input").fill("1500");
await page.locator("#budgetRow .sp-edit .btn").click();

const raw = await page.evaluate(() => localStorage.getItem("sfMoveApp_v1"));
await browser.close();

const obj = JSON.parse(raw);
writeFileSync(OUT, JSON.stringify(obj, null, 2) + "\n");
console.log(`wrote ${OUT}`);
console.log(`  arrived: ${Object.keys(obj.trip.arrived).filter(k => obj.trip.arrived[k]).join(", ")}`);
console.log(`  packed: ${Object.keys(obj.packed).filter(k => obj.packed[k]).join(", ")}`);
console.log(`  disp: ${Object.entries(obj.disp).map(([k, v]) => `${k}=${v}`).join(", ")}`);
console.log(`  removed: ${Object.keys(obj.removed).join(", ")}`);
console.log(`  budget: ${obj.spend.budget} · entries: ${obj.spend.entries.length}`);
