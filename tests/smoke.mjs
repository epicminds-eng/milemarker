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

/* A trip as Build 2 left it: sf-move v55 stops (abq and la, which v107 dropped), an Arrived stamp
   on abq, 7 charges plus one logged on the phone, the old planned rows — one of them confirmed by
   hand — and no seedRev. Boot must bring it forward without losing any of that. */
const buildTwoShapedState = () => ({
  settings: { units: "mi", currency: "USD", mapMode: "offline",
    vehicles: [{ id: "v-my", name: "Model Y", type: "ev", kwhPerMi: 0.27, epaWhMi: 270 }], defaultVehicleId: "v-my" },
  templates: { base: [], byType: {} },
  trips: {
    "sf-2026": {
      id: "sf-2026", name: "Chicago → San Francisco", status: "live",
      departDate: "2026-09-06", endDate: "",
      vehicle: { id: "v-my", type: "ev", name: "Model Y", kwhPerMi: 0.27, epaWhMi: 270 },
      types: ["kane"],
      stops: [
        { id: "start", name: "South Barrington, IL", short: "Start", lat: 42.0914, lng: -88.1562, mi: 0, miSrc: "manual" },
        { id: "strobert", name: "Springfield, MO", short: "Springfield", lat: 37.244, lng: -93.2718, mi: 505, miSrc: "manual", overnight: true, nights: 1 },
        { id: "amarillo", name: "Amarillo, TX", short: "Amarillo", lat: 35.222, lng: -101.8313, mi: 545, miSrc: "manual", overnight: true, nights: 1, hotel: "Hotel TBD" },
        { id: "abq", name: "Albuquerque, NM", short: "Albuquerque", lat: 35.099215, lng: -106.590972, mi: 289, miSrc: "manual", overnight: true, nights: 1 },
        { id: "moms", name: "Sun Lakes, AZ", short: "Mom's", lat: 33.22721, lng: -111.8861, mi: 465, miSrc: "manual", overnight: true, nights: 1, home: true },
        { id: "la", name: "LA — Seychelle's", short: "LA", lat: 34.0525, lng: -118.372, mi: 380, miSrc: "manual", overnight: true, nights: 1, home: true },
        { id: "sf", name: "San Francisco, CA", short: "SF", lat: 37.7757, lng: -122.44, mi: 385, miSrc: "manual", home: true }
      ],
      waypts: [],
      charges: [
        ...["001,Normal,40.5327,-88.9918,10:27,10.43", "002,Springfield IL,39.7755,-89.6089,11:41,15.76",
            "003,Fenton,38.5093,-90.4527,13:45,16.10", "004,Rolla,37.9448,-91.7967,15:23,13.19",
            "005,Springfield MO,37.2683,-93.2340,17:14,16.88"].map(r => {
          const [n, name, lat, lng, time, cost] = r.split(",");
          return { id: `chg-${n}`, name, addr: name, lat: +lat, lng: +lng, date: "2026-09-06", time, kwh: 30, rate: 0.4, cost: +cost, min: 20 };
        }),
        { id: "chg-006", name: "Joplin, MO", addr: "Joplin", lat: 37.0392, lng: -94.5487, date: "2026-09-07", time: "09:35", kwh: 36.29, rate: 0.37, cost: 13.42, min: 23 },
        { id: "chg-007", name: "Tulsa, OK", addr: "Tulsa", lat: 36.1006, lng: -95.885, date: "2026-09-07", time: "11:46", kwh: 48.25, rate: 0.4, cost: 19.3, min: 33 },
        { id: "chg-local", name: "Logged on the phone", addr: "Somewhere", lat: 36.0, lng: -96.0, date: "2026-09-07", time: "12:30", kwh: 10, rate: 0.4, cost: 4, min: 8 }
      ],
      expenses: [{ id: "exp-001", cat: "groceries", amount: 10.65, note: "County Market · Springfield IL", date: "2026-09-06", time: "11:48" }],
      spend: {
        entries: [
          { id: "seed-p2", amount: 50, cat: "kane", note: "Pet fee", day: 2, stopId: "amarillo", ts: 1, planned: true, billsLater: false },
          { id: "seed-p3", amount: 42, cat: "kane", note: "Pet fee · confirmed by hand", day: 3, stopId: "abq", ts: 1, planned: false, billsLater: false },
          { id: "seed-m0", amount: 240, cat: "misc", note: "Ship Sticks · 3 pieces", day: 0, stopId: null, ts: 1, planned: true, billsLater: false }
        ], dismissed: {}
      },
      pack: { items: [], packed: {}, beforeLeave: [], collapsed: {}, blSeeded: true },
      log: { arrived: { strobert: true, abq: true }, arrivedAt: { strobert: "2026-09-06T17:49", abq: "2026-09-08T16:30" }, rolled: { strobert: "2026-09-06T08:30" } },
      ui: {}, stats: {}
    }
  },
  meta: { touched: {}, stamped: true, sfSeededV1: true }
});

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
    rev: IMPORT_SF.rev, seedRev: T().seedRev,
    total: RT.TOTAL, seedTotal: IMPORT_SF().stops.reduce((a, s) => a + (+s.mi || 0), 0),
    days: RT.DAYS, stops: RT.stops.length, wp: RT.WP.length,
    charges: T().charges.length, real: realCharges().length, planned: T().charges.filter(c => c.planned).length,
    seedReal: IMPORT_SF().charges.filter(c => !c.planned).length,
    ids: T().stops.map(s => s.id).join(","),
    tz: T().stops.map(s => s.tz).join(","),
    pct: routePos() / RT.TOTAL * 100, pos: routePos(),
    seeded: !!state.meta.sfSeededV1,
    /* the furthest logged charger, the same way routePos picks it */
    furthest: (() => { let best = null, bm = -1;
      T().charges.forEach(c => { if (c.planned || !c.date) return;
        const l = locate({ lat: +c.lat, lng: +c.lng });
        if (l && l.miles > bm && l.miles <= RT.TOTAL) { bm = l.miles; best = c; } });
      return best ? best.id + "|" + best.name : "none"; })()
  }));
  eq("seed revision recorded", sf.rev, "sf-move v107 0d8b246");
  eq("trip carries the seed revision", sf.seedRev, sf.rev);
  eq("TOTAL == the sum of IMPORT_SF's legs", sf.total, sf.seedTotal);
  eq("6 days", sf.days, 6);
  eq("v107 stop ids", sf.ids, "start,strobert,amarillo,holbrook,moms,coalinga,sf");
  eq("Stop.tz carried as data", sf.tz,
    "America/Chicago,America/Chicago,America/Chicago,America/Phoenix,America/Phoenix,America/Los_Angeles,America/Los_Angeles");
  eq("WAYPTS rebuilt as per-leg routes", sf.wp, 23);
  eq("charges = IMPORT_SF's sessions", sf.real, sf.seedReal);
  eq("1 planned charger", sf.planned, 1);
  eq("meta.sfSeededV1 flagged", sf.seeded, true);
  const sfProg = await page.locator("#tripProg").innerText();
  ok(`progress strip shows ${sf.total.toLocaleString()} mi`, sfProg.includes(sf.total.toLocaleString()), sfProg.split("\n")[1]);
  eq("furthest logged charger is Castaic", sf.furthest.split("|")[0], "chg-027");
  ok("Castaic is the Castaic, CA session", /Castaic/.test(sf.furthest), sf.furthest);
  const dots = await page.evaluate(() => [...document.querySelectorAll("#tripProg .tps")].map(d => d.className));
  eq("7 stop dots", dots.length, 7);
  ok("Mom's passed", dots[4].includes("on"), dots.join(" | "));
  ok("SF not yet reached", dots[6].includes("up"), dots.join(" | "));
  const sfChg = await page.locator("#chgRow .chgh").innerText();
  ok(`charging row: ${sf.real} stops, 1 planned`,
    new RegExp(`${sf.real}\\s+stops`).test(sfChg) && sfChg.includes("1 planned"), sfChg.replace(/\n/g, " | "));
  await page.locator("#nav-spend").click();
  await page.waitForSelector("#page-spend.active");
  const day1 = await page.locator('#spendDays .spday[data-day="1"] .dayh b').innerText();
  eq("Day 1 spend $302", day1.trim(), "$302");
  await page.locator("#nav-pack").click();
  await page.waitForSelector("#page-pack.active");
  const packGroups = await page.evaluate(() => [...document.querySelectorAll("#packGroups .sec-head .t")].map(e => e.textContent));
  /* Pack items come from a pasted `disp`, never from the seed — a fresh install has none */
  eq("no seeded pack groups", packGroups.join(","), "This trip");
  ok('Before I leave has the bl-* list', (await page.locator("#beforeLeave .sec-head .m").innerText()).startsWith("0/10"),
    await page.locator("#beforeLeave .sec-head .m").innerText());
  await page.locator("#nav-back").click();
  await page.waitForSelector("#page-trips.active");
  const sfCard = (await page.locator(".trcard").first().innerText()).replace(/\n/g, " · ");
  ok(`Trips card: Live · Sept 6 – … · ${sf.total.toLocaleString()} mi · 6 days`,
    /Live/.test(sfCard) && /Sept 6 – …/.test(sfCard) &&
    new RegExp(`${sf.total.toLocaleString()} mi · 6 days · \\$`).test(sfCard), sfCard);
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
  const fxArrived = Object.keys(fixture.trip.arrived).filter(k => fixture.trip.arrived[k]);
  ok("summary toast", new RegExp(`Imported · ${fxArrived.length} stamps · 3 pack items · 2 packed · ` +
    `${fixture.spend.entries.length} spend rows · budget \\$1,500`).test(toastText), toastText);

  const merged = await page.evaluate(() => {
    const t = state.trips["sf-2026"];
    return { arrived: Object.keys(t.log.arrived).filter(k => t.log.arrived[k]).sort().join(","),
      rolled: t.log.rolled.strobert, departDate: t.departDate,
      packed: Object.keys(t.pack.packed).filter(k => t.pack.packed[k]).sort().join(","),
      budget: t.spend.budget, rows: t.spend.entries.length,
      onlyTrip: Object.keys(state.trips).join(",") };
  });
  eq("arrived stamps from the paste", merged.arrived, fxArrived.slice().sort().join(","));
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

  /* ---- (i) seed refresh: a Build-2-shaped trip is brought forward, not rebuilt ---- */
  console.log("\n(i) seed refresh retires dropped stops");
  errors.length = 0;
  await page.evaluate(s => {
    localStorage.clear();
    localStorage.setItem("mileMarker_v1", JSON.stringify(s));
    localStorage.setItem("mileMarkerActive", "sf-2026");
  }, buildTwoShapedState());
  await page.reload();
  await page.waitForSelector("#page-trip.active");
  const ref = await page.evaluate(() => {
    const t = state.trips["sf-2026"];
    return {
      seedRev: t.seedRev,
      route: RT.stops.map(s => s.id).join(","),
      retired: t.stops.filter(s => s.retired).map(s => s.id).sort().join(","),
      kept: t.stops.map(s => s.id).join(","),
      abqStamp: t.log.arrived.abq === true && t.log.arrivedAt.abq === "2026-09-08T16:30",
      charges: t.charges.length,
      dupIds: t.charges.length - new Set(t.charges.map(c => c.id)).size,
      localCharge: t.charges.some(c => c.id === "chg-local"),
      p2: t.spend.entries.find(e => e.id === "seed-p2"),
      p3: t.spend.entries.find(e => e.id === "seed-p3"),
      strip: [...document.querySelectorAll("#tripProg .tps")].length,
      cards: [...document.querySelectorAll("#tripStops .card[data-stop]")].map(c => c.getAttribute("data-stop")).join(","),
      nodes: document.querySelectorAll("#nodeG circle.nd").length
    };
  });
  eq("seedRev brought forward", ref.seedRev, "sf-move v107 0d8b246");
  eq("abq + la retired", ref.retired, "abq,la");
  ok("retired stops are kept in the data", /abq/.test(ref.kept) && /la/.test(ref.kept), ref.kept);
  eq("route skips the retired stops", ref.route, "start,strobert,amarillo,holbrook,moms,coalinga,sf");
  eq("stop list skips them too", ref.cards, "start,strobert,amarillo,holbrook,moms,coalinga,sf");
  eq("progress strip has 7 dots", ref.strip, 7);
  eq("map draws 7 stop nodes", ref.nodes, 7);
  ok("abq's Arrived stamp survives", ref.abqStamp, JSON.stringify(ref.abqStamp));
  eq("28 charges after the refresh", ref.charges, 28 + 1);   /* 27 logged + 1 planned + the locally logged one */
  eq("no duplicate charge ids", ref.dupIds, 0);
  ok("a locally logged charge is kept", ref.localCharge);
  ok("planned row refreshed to the v107 amount", ref.p2 && ref.p2.amount === 75 && ref.p2.planned === true,
    JSON.stringify(ref.p2));
  ok("a hand-confirmed row is left alone", ref.p3 && ref.p3.planned === false && ref.p3.amount === 42,
    JSON.stringify(ref.p3));
  const boot1 = await page.evaluate(() => JSON.stringify(state.trips["sf-2026"]));
  await page.reload();
  await page.waitForSelector("#page-trip.active");
  const boot2 = await page.evaluate(() => JSON.stringify(state.trips["sf-2026"]));
  ok("a second boot changes no leaf", boot1 === boot2, boot1 === boot2 ? "" : "trip JSON differs after the second boot");
  ok("no console errors on the seed refresh", errors.length === 0, errors.join(" | "));

  /* ---- (j) disp import drives the Pack groups ---- */
  console.log("\n(j) Pack groups come from the pasted disp");
  errors.length = 0;
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("#page-trip.active");
  await page.locator("#nav-back").click();
  await page.waitForSelector("#page-trips.active");
  await page.locator("#dataPaste").fill(sfExport);
  await page.locator("#dataImport").click();
  await page.waitForFunction(() => /merged/.test(document.getElementById("dataStatus").textContent));
  const dispExpect = fixture.disp, removedExpect = Object.keys(fixture.removed || {});
  const wantCar = Object.keys(dispExpect).filter(k => dispExpect[k] === "car").length;
  const wantShip = Object.keys(dispExpect).filter(k => dispExpect[k] === "ship").length;
  const sellIds = Object.keys(dispExpect).filter(k => ["sell", "leave"].includes(dispExpect[k]));
  await page.locator(".trcard").first().click();
  await page.waitForSelector("#page-trip.active");
  await page.locator("#nav-pack").click();
  await page.waitForSelector("#page-pack.active");
  const packed = await page.evaluate(() => {
    const t = state.trips["sf-2026"];
    return { ids: t.pack.items.map(i => i.id + ":" + i.group).sort().join(","),
      packedCount: Object.keys(t.pack.packed).filter(k => t.pack.packed[k]).length,
      groups: [...document.querySelectorAll("#packGroups .sec-head")].map(h =>
        h.querySelector(".t").textContent + " " + h.querySelector(".m").textContent.trim()) };
  });
  const inGroup = g => Object.keys(dispExpect).filter(k => dispExpect[k] === g);
  const packedIn = g => inGroup(g).filter(k => fixture.packed[k]).length;
  eq(`Car ${wantCar}`, packed.groups[0], `Car ${packedIn("car")}/${wantCar}`);
  eq(`Ship ${wantShip}`, packed.groups[1], `Ship ${packedIn("ship")}/${wantShip}`);
  ok("no Undecided group when nothing is undecided", !packed.groups.some(g => /^Undecided/.test(g)),
    packed.groups.join(" | "));
  ok("sell-tagged items are not packed", sellIds.every(id => !packed.ids.includes(id + ":")),
    `${sellIds.join(",")} vs ${packed.ids}`);
  ok("removed items are not packed", removedExpect.every(id => !packed.ids.includes(id + ":")),
    `${removedExpect.join(",")} vs ${packed.ids}`);
  eq("packed count unchanged", packed.packedCount,
    Object.keys(fixture.packed).filter(k => fixture.packed[k]).length);
  ok("no console errors on the disp import", errors.length === 0, errors.join(" | "));

  /* ---- screenshots: Trips, Trip and Pack at 390 and at 1194 ---- */
  console.log("\nscreenshots at 390 and 1194");
  await page.waitForTimeout(2800);   /* let the import toast expire so it is not in the shots */
  for (const w of [390, 1194]) {
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : 834 });
    await page.locator("#nav-back").click();
    await page.waitForSelector("#page-trips.active");
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOTS, `w${w}-1-trips.png`) });
    await page.locator(".trcard").first().click();
    await page.waitForSelector("#page-trip.active");
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(SHOTS, `w${w}-2-trip.png`) });
    await page.locator("#nav-pack").click();
    await page.waitForSelector("#page-pack.active");
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, `w${w}-3-pack.png`) });
  }
  ok("no console errors at either width", errors.length === 0, errors.join(" | "));

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
