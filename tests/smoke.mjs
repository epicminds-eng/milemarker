/* Mile Marker — re-runnable smoke test.
   node tests/smoke.mjs   (after `npm install`)
   Headless Chromium, 390x844, iPhone UA. Writes screenshots to shots/ (gitignored). */
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = pathToFileURL(join(ROOT, "index.html")).href;
const SHOTS = join(ROOT, "shots");
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
};
const eq = (name, actual, expected) => ok(name, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);

/* Chicago → St. Louis (overnight, Test Inn) → Kansas City; hand miles 300 + 250;
   one charge 30 kWh @ $0.37 = $11.10, 21 min, at St. Louis. */
const FIXTURE = {
  id: "t-fixture",
  name: "Fixture Run",
  status: "live",
  departDate: "2026-09-07",
  endDate: "",
  vehicle: { id: "v-my", type: "ev", name: "Model Y", kwhPerMi: 0.27, epaWhMi: 270 },
  types: [],
  stops: [
    { id: "s-chi", name: "Chicago, IL", short: "Chicago", lat: 41.8781, lng: -87.6298, mi: 0, miSrc: "manual" },
    { id: "s-stl", name: "St. Louis, MO", short: "St. Louis", lat: 38.627, lng: -90.1994, mi: 300, miSrc: "manual",
      overnight: true, nights: 1, hotel: "Test Inn" },
    { id: "s-kc", name: "Kansas City, MO", short: "Kansas City", lat: 39.0997, lng: -94.5786, mi: 250, miSrc: "manual" }
  ],
  waypts: [],
  charges: [
    { id: "c-1", name: "St. Louis, MO", addr: "St. Louis, MO", lat: 38.627, lng: -90.1994,
      date: "2026-09-07", time: "12:30", kwh: 30, rate: 0.37, cost: 11.10, min: 21, stopId: "s-stl" }
  ],
  expenses: [],
  spend: { entries: [], dismissed: {} },
  pack: { items: [], packed: {}, beforeLeave: [], collapsed: {} },
  log: { arrived: {}, arrivedAt: {}, rolled: {} },
  ui: {},
  stats: {}
};

const seed = () => ({
  settings: { units: "mi", currency: "USD", mapMode: "offline",
    vehicles: [{ id: "v-my", name: "Model Y", type: "ev", kwhPerMi: 0.27, epaWhMi: 270 }], defaultVehicleId: "v-my" },
  templates: { base: [], byType: {} },
  trips: { "t-fixture": FIXTURE },
  meta: { touched: {}, stamped: true }
});

const run = async () => {
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA,
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

  /* ---- (a) fresh load: Trips empty state, no tab bar ---- */
  console.log("\n(a) fresh load");
  await page.goto(APP);
  await page.waitForSelector("#page-trips.active");
  ok("empty state shown", await page.locator(".tripsempty").isVisible());
  ok("empty state wording", (await page.locator(".tripsempty").innerText()).includes("No trips yet"));
  ok("tab bar hidden", !(await page.locator("nav").isVisible()));
  ok("+ New trip button present", await page.locator("#newTripBtn").isVisible());
  eq("no trip cards", await page.locator(".trcard").count(), 0);
  ok("no console errors on empty load", errors.length === 0, errors.join(" | "));
  await page.screenshot({ path: join(SHOTS, "01-trips-empty.png") });

  /* ---- (b) fixture trip injected, reloaded, opened ---- */
  console.log("\n(b) fixture trip");
  await page.evaluate(s => {
    localStorage.setItem("mileMarker_v1", JSON.stringify(s));
    localStorage.removeItem("mileMarkerActive");
  }, seed());
  errors.length = 0;
  await page.reload();
  await page.waitForSelector(".trcard");
  eq("one trip card", await page.locator(".trcard").count(), 1);
  await page.locator(".trcard").first().click();
  await page.waitForSelector("#page-trip.active");
  ok("tab bar visible with a trip open", await page.locator("nav").isVisible());

  ok("1. map hero rendered", await page.locator("#tripSvg").isVisible() && (await page.locator("#routeG path").count()) >= 3);
  eq("2. three stop nodes", await page.locator("#nodeG circle.nd").count(), 3);
  const progText = await page.locator("#tripProg").innerText();
  ok("3. progress strip shows 550 mi total", progText.includes("550 mi"), progText.split("\n")[1]);
  const chg = await page.locator("#chgRow .chgh").innerText();
  ok("4. charging row has 1 session", /1\s+stop/.test(chg) && chg.includes("30") && chg.includes("$11.10"), chg);
  const statsText = await page.locator("#tripStats").innerText();
  ok("5. stats Charging spend $11.10", statsText.includes("$11.10"), statsText.slice(0, 200));
  await page.locator("#nav-spend").click();
  await page.waitForSelector("#page-spend.active");
  const spendRow = page.locator('#spendDays .sprow[data-id="c-1"]');
  ok("6. Spend actual charging row $11.10", (await spendRow.count()) === 1 && (await spendRow.innerText()).includes("$11.10"),
    (await spendRow.count()) ? await spendRow.innerText() : "row missing");
  await page.locator("#nav-pack").click();
  await page.waitForSelector("#page-pack.active");
  ok('7. Pack "Before I leave" card', (await page.locator("#beforeLeave .sec-head").innerText()).includes("Before I leave"));
  ok("no console errors rendering the trip", errors.length === 0, errors.join(" | "));
  await page.locator("#nav-trip").click();
  await page.waitForSelector("#page-trip.active");
  await page.waitForTimeout(500);   /* let the tab's springIn animation settle before the screenshot */
  await page.screenshot({ path: join(SHOTS, "02-trip-tab.png"), fullPage: false });

  /* ---- (d) reload keeps activeTripId ---- */
  console.log("\n(d) activeTripId survives a reload");
  const activeBefore = await page.evaluate(() => localStorage.getItem("mileMarkerActive"));
  eq("activeTripId persisted", activeBefore, "t-fixture");
  errors.length = 0;
  await page.reload();
  await page.waitForSelector("#page-trip.active");
  eq("still on the same trip after reload", await page.evaluate(() => localStorage.getItem("mileMarkerActive")), "t-fixture");
  eq("trip name after reload", await page.locator("#tripName").innerText(), "Fixture Run");
  ok("no console errors after reload", errors.length === 0, errors.join(" | "));

  /* ---- (c) create a second trip through the Basics sheet ---- */
  console.log("\n(c) second trip via the Basics sheet");
  await page.locator("#nav-back").click();
  await page.waitForSelector("#page-trips.active");
  await page.locator("#newTripBtn").click();
  await page.waitForSelector("#basicsSheet");
  await page.fill("#btName", "Planning Run");
  await page.fill("#btDepart", "2026-10-01");
  await page.fill("#btReturn", "2026-10-05");
  await page.locator("#btCreate").click();
  await page.waitForFunction(() => document.querySelectorAll(".trcard").length === 2);
  const cards = page.locator(".trcard");
  eq("two trip cards", await cards.count(), 2);
  const first = await cards.nth(0).innerText(), second = await cards.nth(1).innerText();
  ok("Live trip pinned first", first.includes("Fixture Run") && first.includes("Live"), first.replace(/\n/g, " | "));
  ok("Planning trip second", second.includes("Planning Run") && second.includes("Planning"), second.replace(/\n/g, " | "));
  ok("Live card one-line stat", /550 mi · 2 days · \$11/.test(first.replace(/\n/g, " ")), first.replace(/\n/g, " | "));
  ok("no console errors creating a trip", errors.length === 0, errors.join(" | "));
  await page.screenshot({ path: join(SHOTS, "03-trips-two.png") });

  /* ---- (e) a trip with no stops and no data still renders every tab cleanly ---- */
  console.log("\n(e) zero-state trip (no stops, no data)");
  errors.length = 0;
  await page.locator(".trcard").nth(1).click();
  await page.waitForSelector("#page-trip.active");
  eq("opened the planning trip", await page.locator("#tripName").innerText(), "Planning Run");
  ok("map hero still present", await page.locator("#tripSvg").isVisible());
  eq("no stop nodes", await page.locator("#nodeG circle.nd").count(), 0);
  ok("progress strip at 0", (await page.locator("#tripProg .fill").getAttribute("style")).includes("width:0%"));
  ok('charging row reads "No charges logged"', (await page.locator("#chgRow").innerText()).includes("No charges logged"));
  ok("stats cards show —", (await page.locator("#tripStats .kpis").innerText()).includes("—"));
  await page.locator("#nav-pack").click();
  await page.waitForSelector("#page-pack.active");
  ok('Pack has the "Before I leave" card', (await page.locator("#beforeLeave .sec-head").innerText()).includes("Before I leave"));
  ok("Pack has an empty section", (await page.locator("#packGroups .empty").count()) >= 1);
  await page.locator("#nav-spend").click();
  await page.waitForSelector("#page-spend.active");
  eq("no spend entries", await page.locator("#spendDays .sprow").count(), 0);
  ok("budget link present", (await page.locator("#budgetLink").innerText()).includes("Set budget"));
  ok("no console errors on the zero-state trip", errors.length === 0, errors.join(" | "));
  await page.locator("#nav-trip").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, "04-trip-zero-state.png") });

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
