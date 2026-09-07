/* Rebuilds tests/fixtures/sf-move-export.json from the read-only sf-move repo.
   Not part of `npm test` — the fixture is committed. To regenerate:
     git clone --depth 1 https://github.com/epicminds-eng/sf-move /tmp/sf-move
     node tests/make-sf-move-fixture.mjs
   It loads /tmp/sf-move/index.html headless with a fresh localStorage, then drives the real UI:
   tags two Sort items "Car" (sf-move keeps dispositions in state.disp, so nothing is packable until
   something is tagged), packs both, taps Arrived on Amarillo, sets a budget of 1500, and writes out
   the raw localStorage object sfMoveApp_v1 — exactly what sf-move's Export produces. */
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
const PACK_ME = ["Gamer bag + current clubs", "Rollerblades"];

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

/* 1. tag the two items Car in Sort — nothing is packable until it carries a disposition */
await page.locator("#nav-sort").click();
await page.waitForSelector("#page-sort.active");
for (const label of PACK_ME) {
  const row = page.locator("#sortGroups .item").filter({ has: page.locator(".name", { hasText: label }) }).first();
  await row.scrollIntoViewIfNeeded();
  await row.locator('.tag[data-d="car"]').click();
}

/* 2. pack both of them from the Pack tab */
await page.locator("#nav-pack").click();
await page.waitForSelector("#page-pack.active");
for (const label of PACK_ME) {
  const row = page.locator("#packGroups .pcheck").filter({ hasText: label }).first();
  await row.scrollIntoViewIfNeeded();
  await row.locator(".pring").click();
}

/* 3. Arrived on Amarillo */
await page.locator("#nav-trip").click();
await page.waitForSelector("#page-trip.active");
const amarillo = page.locator('.tripstop[data-stop="amarillo"] .check').first();
await amarillo.scrollIntoViewIfNeeded();
await amarillo.click();

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
console.log(`  budget: ${obj.spend.budget} · entries: ${obj.spend.entries.length}`);
