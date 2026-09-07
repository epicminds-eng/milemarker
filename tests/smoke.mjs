/* Mile Marker — re-runnable smoke test.
   node tests/smoke.mjs   (after `npm install`)
   Headless Chromium, 390x844, iPhone UA. Writes screenshots to shots/ (gitignored). */
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, existsSync, readFileSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = pathToFileURL(join(ROOT, "index.html")).href;
const SHOTS = join(ROOT, "shots");
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const SF_EXPORT = join(ROOT, "tests", "fixtures", "sf-move-export.json");
/* this box ships Chromium outside the Playwright cache and blocks the download; on a Mac the default wins */
const PW_FALLBACK = "/opt/pw-browsers/chromium";
const launchChromium = async () => {
  try { return await chromium.launch(); }
  catch (e) { if (!existsSync(PW_FALLBACK)) throw e; return chromium.launch({ executablePath: PW_FALLBACK }); }
};

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
  const browser = await launchChromium();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA,
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  /* one dialog handler for the whole run — `dialogAction` decides, `dialogs` records what was asked */
  const dialogs = [];
  let dialogAction = "dismiss";
  page.on("dialog", async d => { dialogs.push(d.message()); await (dialogAction === "accept" ? d.accept() : d.dismiss()); });

  /* ---- (a) fresh load: Trips empty state, no tab bar ---- */
  console.log("\n(a) fresh load");
  await page.goto(APP);
  await page.waitForSelector("#page-trip.active, #page-trips.active");
  /* the SF seed owns the true fresh install — (f) covers it; (a) is the no-trips screen */
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("mileMarker_v1", JSON.stringify({ trips: {}, meta: { touched: {}, stamped: true, sfSeededV1: true } })); });
  errors.length = 0;
  await page.reload();
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
  /* the tile's own text only — the sessions table further down also prints $11.10, so an unscoped
     match passes even when the KPI is wrong (proved by x10-ing the cost sum in tripStats) */
  const chgKpi = page.locator("#tripStats .kpis .kpi").filter({ has: page.locator(".t", { hasText: /^Charging spend$/ }) });
  eq("5a. one Charging-spend KPI tile", await chgKpi.count(), 1);
  eq("5. Charging-spend KPI reads $11.10", (await chgKpi.locator(".n").innerText()).trim().split(/\s+/)[0], "$11.10");
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

  /* ---- (f) fresh install: the SF trip is seeded from IMPORT_SF and opened ---- */
  console.log("\n(f) fresh install seeds the SF trip");
  errors.length = 0;
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("#page-trip.active");
  eq("opened on the SF trip", await page.evaluate(() => localStorage.getItem("mileMarkerActive")), "sf-2026");
  eq("SF trip name", await page.locator("#tripName").innerText(), "Chicago → San Francisco");
  const sf = await page.evaluate(() => ({
    total: RT.TOTAL, days: RT.DAYS, stops: RT.stops.length, wp: RT.WP.length,
    charges: T().charges.length, real: realCharges().length, planned: T().charges.filter(c => c.planned).length,
    ids: T().stops.map(s => s.id).join(","),
    pct: routePos() / RT.TOTAL * 100, pos: routePos(),
    seeded: !!state.meta.sfSeededV1
  }));
  eq("TOTAL 2,569 mi", sf.total, 2569);
  eq("6 days", sf.days, 6);
  eq("stop ids kept from sf-move", sf.ids, "start,strobert,amarillo,abq,moms,la,sf");
  eq("WAYPTS rebuilt as per-leg routes", sf.wp, 21);
  /* IMPORT_SF's real session count — sf-move v55 logs chg-001…chg-007 plus the planned chg-oasis */
  eq("charges = IMPORT_SF's sessions", sf.charges, 8);
  eq("7 logged sessions, 1 planned", `${sf.real}/${sf.planned}`, "7/1");
  eq("meta.sfSeededV1 flagged", sf.seeded, true);
  const sfProg = await page.locator("#tripProg").innerText();
  ok("progress strip shows 2,569 mi", sfProg.includes("2,569 mi"), sfProg.split("\n")[1]);
  /* furthest logged charger is Tulsa (chg-007), so the ring sits past Springfield at 27% */
  eq("progress % on the flag", `${Math.round(sf.pct)}%`, "27%");
  const dots = await page.evaluate(() => [...document.querySelectorAll("#tripProg .tps")].map(d => d.className));
  eq("7 stop dots", dots.length, 7);
  ok("Springfield passed", dots[1].includes("on"), dots.join(" | "));
  ok("Amarillo not yet passed", dots[2].includes("up"), dots.join(" | "));
  const sfChg = await page.locator("#chgRow .chgh").innerText();
  ok("charging row: 7 stops, 1 planned", /7\s+stops/.test(sfChg) && sfChg.includes("1 planned"), sfChg.replace(/\n/g, " | "));
  await page.locator("#nav-spend").click();
  await page.waitForSelector("#page-spend.active");
  const day1 = await page.locator('#spendDays .spday[data-day="1"] .dayh b').innerText();
  eq("Day 1 spend $302", day1.trim(), "$302");
  await page.locator("#nav-pack").click();
  await page.waitForSelector("#page-pack.active");
  const packGroups = await page.evaluate(() => [...document.querySelectorAll("#packGroups .sec-head .t")].map(e => e.textContent));
  eq("Pack groups Car · Ship · Joey", packGroups.slice(0, 3).join(","), "Car,Ship,Joey");
  ok('Before I leave has the bl-* list', (await page.locator("#beforeLeave .sec-head .m").innerText()).startsWith("0/10"),
    await page.locator("#beforeLeave .sec-head .m").innerText());
  await page.locator("#nav-back").click();
  await page.waitForSelector("#page-trips.active");
  const sfCard = (await page.locator(".trcard").first().innerText()).replace(/\n/g, " · ");
  ok("Trips card: Live · Sept 6 – … · 2,569 mi · 6 days · $334",
    /Live/.test(sfCard) && /Sept 6 – …/.test(sfCard) && /2,569 mi · 6 days · \$334/.test(sfCard), sfCard);
  ok("no console errors on the seeded SF trip", errors.length === 0, errors.join(" | "));
  await page.screenshot({ path: join(SHOTS, "05-trips-sf.png") });
  await page.locator(".trcard").first().click();
  await page.waitForSelector("#page-trip.active");
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, "06-sf-trip-tab.png") });

  /* ---- (g) paste an sf-move export through the Import UI ---- */
  console.log("\n(g) sf-move import");
  errors.length = 0;
  const sfExport = readFileSync(SF_EXPORT, "utf8");
  const fixture = JSON.parse(sfExport);
  await page.locator("#nav-back").click();
  await page.waitForSelector("#page-trips.active");
  await page.locator("#dataPaste").fill(sfExport);
  dialogs.length = 0;
  await page.locator("#dataImport").click();
  await page.waitForFunction(() => /merged/.test(document.getElementById("dataStatus").textContent));
  eq("an sf-move paste never offers to replace everything", dialogs.length, 0);
  const toastText = await page.locator("#toast").innerText();
  ok("summary toast", /Imported · 2 stamps · 2 packed · 18 spend rows · budget \$1,500/.test(toastText), toastText);

  const merged = await page.evaluate(() => {
    const t = state.trips["sf-2026"];
    return { arrived: Object.keys(t.log.arrived).filter(k => t.log.arrived[k]).sort().join(","),
      rolled: t.log.rolled.strobert, departDate: t.departDate,
      packed: Object.keys(t.pack.packed).filter(k => t.pack.packed[k]).sort().join(","),
      budget: t.spend.budget, rows: t.spend.entries.length,
      onlyTrip: Object.keys(state.trips).join(",") };
  });
  eq("arrived strobert + amarillo", merged.arrived, "amarillo,strobert");
  eq("rolled strobert 08:30", merged.rolled, "2026-09-06T08:30");
  eq("departDate from the paste", merged.departDate, "2026-09-06");
  eq("2 packed", merged.packed, "g-bag,r-skates");
  eq("budget 1500", merged.budget, 1500);
  eq("spend rows = fixture entries", merged.rows, fixture.spend.entries.length);
  eq("merged onto sf-2026 only", merged.onlyTrip, "sf-2026");

  await page.locator(".trcard").first().click();
  await page.waitForSelector("#page-trip.active");
  const after = await page.evaluate(() => ({ pos: routePos(), cumAmarillo: RT.CUM[2] }));
  ok("progress at or past Amarillo", after.pos >= after.cumAmarillo - 0.5, `${after.pos} vs ${after.cumAmarillo}`);
  await page.locator("#nav-back").click();
  await page.waitForSelector("#page-trips.active");

  /* second paste changes no leaf */
  const before2 = await page.evaluate(() => JSON.stringify(state.trips["sf-2026"]));
  await page.locator("#dataPaste").fill(sfExport);
  await page.locator("#dataImport").click();
  await page.waitForFunction(() => /merged/.test(document.getElementById("dataStatus").textContent));
  const after2 = await page.evaluate(() => JSON.stringify(state.trips["sf-2026"]));
  ok("a second paste changes nothing", before2 === after2,
    before2 === after2 ? "" : "trip JSON differs after the second import");
  ok("no console errors importing sf-move data", errors.length === 0, errors.join(" | "));

  /* ---- (h) Mile Marker export → import round-trip ---- */
  console.log("\n(h) Mile Marker export + import");
  errors.length = 0;
  const exported = await page.evaluate(() => exportText());
  const parsed = JSON.parse(exported);
  ok("export is the whole mileMarker_v1 object", !!parsed.trips["sf-2026"] && !!parsed.settings && !!parsed.meta,
    Object.keys(parsed).join(","));
  /* rename the trip inside the export, paste it back, confirm the replace */
  parsed.trips["sf-2026"].name = "Round Trip";
  await page.locator("#dataPaste").fill(JSON.stringify(parsed));
  dialogs.length = 0; dialogAction = "accept";
  await page.locator("#dataImport").click();
  await page.waitForSelector("#page-trip.active, #page-trips.active");
  await page.waitForTimeout(300);
  ok("Mile Marker paste asks before replacing", /Replace everything/.test(dialogs[0] || ""), dialogs.join(" | "));
  eq("state replaced by the paste", await page.evaluate(() => state.trips["sf-2026"].name), "Round Trip");
  /* a cancelled confirm leaves the store alone */
  await page.evaluate(() => { if (!document.body.classList.contains("listview")) document.getElementById("nav-back").click(); });
  await page.waitForSelector("#page-trips.active");
  await page.locator("#dataPaste").fill(JSON.stringify({ trips: {}, meta: { touched: {}, stamped: true } }));
  dialogAction = "dismiss";
  await page.locator("#dataImport").click();
  await page.waitForFunction(() => /cancelled/.test(document.getElementById("dataStatus").textContent));
  eq("cancelling the confirm keeps the trip", await page.evaluate(() => Object.keys(state.trips).join(",")), "sf-2026");
  /* junk is refused */
  await page.locator("#dataPaste").fill("not json at all");
  await page.locator("#dataImport").click();
  await page.waitForFunction(() => /not JSON/.test(document.getElementById("dataStatus").textContent));
  ok("junk paste refused", true);
  ok("no console errors on the export/import round-trip", errors.length === 0, errors.join(" | "));

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
