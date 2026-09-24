/* Mile Marker — re-runnable smoke test.
   node tests/smoke.mjs   (after `npm install`)
   Headless Chromium, 390x844, iPhone UA. Writes screenshots to shots/ (gitignored). */
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

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

/* Port #13: verify shots are written only with SHOTS=1. A routine `npm test` writes nothing
   outside shots/ — which is gitignored — and the run ends by proving the tree is still clean. */
const SHOTS_ON = !!process.env.SHOTS;
let shotCount = 0;

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
        { id: "chg-local", name: "Logged on the phone", addr: "Somewhere", lat: 36.0, lng: -96.0, date: "2026-09-07", time: "12:30", kwh: 10, rate: 0.4, cost: 4, min: 8 },
        { id: "chg-oasis", planned: true, name: "Tesla Oasis – Lost Hills, CA", addr: "22422 Highway 46, Lost Hills, CA 93249", lat: 35.6175, lng: -119.6945, leg: "Mom's → Coalinga" }
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

const gitState = () => {
  try {
    return execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" })
      .split("\n").filter(l => l.trim() && !/(^|\/)shots\//.test(l)).sort().join("\n");
  } catch (e) { return null; }   /* not a checkout — skip the check rather than fail it */
};

const run = async () => {
  const gitBefore = gitState();
  if (SHOTS_ON) mkdirSync(SHOTS, { recursive: true });
  const shot = async (page, name, opts) => {
    if (!SHOTS_ON) return;
    await page.screenshot({ path: join(SHOTS, name), ...(opts || {}) });
    shotCount++;
  };
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
  await shot(page, "01-trips-empty.png");

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
  await shot(page, "02-trip-tab.png", { fullPage: false });

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
  await shot(page, "03-trips-two.png");

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
  await shot(page, "04-trip-zero-state.png");

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
    seedReal: IMPORT_SF().charges.filter(c => !c.planned && !c.retired).length,
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
  eq("seed revision recorded", sf.rev, "sf-move v118 a0489f4");
  eq("trip carries the seed revision", sf.seedRev, sf.rev);
  eq("TOTAL == the sum of IMPORT_SF's legs", sf.total, sf.seedTotal);
  eq("6 days", sf.days, 6);
  eq("v107 stop ids", sf.ids, "start,strobert,amarillo,holbrook,moms,coalinga,sf");
  eq("Stop.tz carried as data", sf.tz,
    "America/Chicago,America/Chicago,America/Chicago,America/Phoenix,America/Phoenix,America/Los_Angeles,America/Los_Angeles");
  eq("WAYPTS rebuilt as per-leg routes", sf.wp, 23);
  eq("charges = IMPORT_SF's sessions", sf.real, sf.seedReal);
  eq("nothing planned any more — v109 fulfilled the Oasis", sf.planned, 0);
  /* Port #12 — structural session count. Ids are never renumbered, so the live sessions must equal
     the highest chg id minus the retired ones, and any gap in the sequence has to be explained by a
     retired row. No literal count anywhere: the shape of the data proves itself. */
  const seq = await page.evaluate(() => {
    const all = T().charges.filter(c => /^chg-\d+$/.test(c.id));
    const num = c => +c.id.slice(4);
    const high = Math.max(...all.map(num));
    const present = new Set(all.map(num));
    const retired = all.filter(c => c.retired).map(num);
    const missing = [];
    for (let i = 1; i <= high; i++) if (!present.has(i)) missing.push(i);
    return { high, retired, missing,
      live: all.filter(c => !c.retired && !c.planned).length,
      planned: all.filter(c => c.planned).length };
  });
  eq("no unexplained gap in the charge sequence", seq.missing.join(","), "");
  eq("live sessions == highest id − retired − planned",
    seq.live, seq.high - seq.retired.length - seq.planned);
  eq("charging row agrees with the sequence", sf.real, seq.live);
  eq("meta.sfSeededV1 flagged", sf.seeded, true);
  const sfProg = await page.locator("#tripProg").innerText();
  ok(`progress strip shows ${sf.total.toLocaleString()} mi`, sfProg.includes(sf.total.toLocaleString()), sfProg.split("\n")[1]);
  eq("furthest logged charger is the last of the trip", sf.furthest.split("|")[0], "chg-0" + seq.high);
  ok("the last session is Pleasanton", /Pleasanton/.test(sf.furthest), sf.furthest);

  /* the trip is complete: one arrival on the final stop, everything else derived */
  const done = await page.evaluate(() => {
    const t = T(), st = t.stops.filter(s => !s.retired);
    return { arrived: st.filter(s => t.log.arrived[s.id]).length, stops: st.length,
      sfStamp: t.log.arrivedAt.sf, status: tripStatus(t),
      pos: routePos(), total: RT.TOTAL,
      todayDay: todayDay(), todayDone: dayProg(todayDay()).done,
      d2dDay6: (dayStats(RT.DAYS) || {}).d2d };
  });
  eq("every stop arrived", `${done.arrived}/${done.stops}`, `${done.stops}/${done.stops}`);
  eq("the SF stamp is the seed's", done.sfStamp, "2026-09-11T09:11");
  eq("status derives to done", done.status, "done");
  eq("the strip is at the end", Math.round(done.pos), done.total);
  const stripText = await page.locator("#tripProg").innerText();
  ok("progress shows 100%", /100%/.test(stripText), stripText.split("\n").slice(0, 3).join(" | "));
  ok("nothing left to go", /\b0\b/.test((await page.locator("#tripProg .tptiles > div").first().innerText())),
    await page.locator("#tripProg .tptiles > div").first().innerText());
  ok("the last label reads arrived", /arrived/.test(stripText), stripText.replace(/\n/g, " | "));
  /* Day 6 door-to-door needs a roll, and the seed never invents one */
  eq("Day 6 door-to-door is unknown on a fresh install", done.d2dDay6 == null, true);
  /* Port #15 — the today card drops "of N mi" once that day is arrived. Read the app's own dayProg. */
  const statLine = await page.locator("#tripStat").innerText();
  if (done.todayDone) {
    ok("today arrived → 'N miles', no 'of N mi'", / miles/.test(statLine) && !/ of .* mi/.test(statLine), statLine);
  } else {
    ok("today not arrived → 'N of N mi'", / of .* mi/.test(statLine), statLine);
  }
  const dots = await page.evaluate(() => [...document.querySelectorAll("#tripProg .tps")].map(d => d.className));
  eq("7 stop dots", dots.length, 7);
  ok("every dot is passed on a finished trip", dots.every(d => d.includes("on")), dots.join(" | "));
  const sfChg = await page.locator("#chgRow .chgh").innerText();
  ok(`charging row: ${sf.real} stops, nothing planned`,
    new RegExp(`${sf.real}\\s+stops`).test(sfChg) && !/planned/.test(sfChg), sfChg.replace(/\n/g, " | "));
  await page.locator("#nav-spend").click();
  await page.waitForSelector("#page-spend.active");
  /* Day 1 = its charges + its receipts + its seeded actuals, every figure read from IMPORT_SF — since v118
     closed the trip out, seed-t1 (the $5 Illinois Tollway) is an actual, so Day 1 is no longer $302 */
  const day1 = await page.locator('#spendDays .spday[data-day="1"] .dayh b').innerText();
  const d1 = await page.evaluate(() => {
    const seed = IMPORT_SF(), t = T();
    let want = 0, have = 0;
    seed.charges.forEach(c => { if (!c.planned && !c.retired && dayForDate(parseYMD(c.date)) === 1) want += +c.cost || 0; });
    seed.expenses.forEach(x => { if (dayForDate(parseYMD(x.date)) === 1) want += +x.amount || 0; });
    seed.spend.entries.forEach(e => { if (!e.planned && e.day === 1) want += e.amount; });
    t.spend.entries.forEach(e => { if (!e.planned && e.day === 1) have += e.amount; });
    return { want: Math.round(want * 100) / 100, have: Math.round(have * 100) / 100, money: money(want) };
  });
  eq("Day 1 actuals == IMPORT_SF's Day 1 charges + receipts + seeded actuals", d1.have, d1.want);
  eq("Day 1 header renders that sum in whole dollars", day1.trim(), d1.money);
  /* v118 retired Ship Sticks: nothing seeds seed-m0, and Pre-trip (Day 0) carries nothing it would have */
  const m0 = await page.evaluate(() => ({
    anywhere: JSON.stringify(state).indexOf("seed-m0") >= 0,
    day0: T().spend.entries.filter(e => e.day === 0).reduce((a, e) => a + e.amount, 0),
    day0Rows: T().spend.entries.filter(e => e.day === 0).map(e => e.id) }));
  ok("no seed-m0 row anywhere on a fresh install", !m0.anywhere);
  eq("Day 0 total excludes Ship Sticks", m0.day0, m0.day0Rows.length ? m0.day0 : 0);
  ok("Day 0 has no $240 row", !m0.day0Rows.length || m0.day0 !== 240, JSON.stringify(m0));
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
  ok(`Trips card: Done · Sept 6 – … · ${sf.total.toLocaleString()} mi · 6 days`,
    /Done/.test(sfCard) && /Sept 6 – …/.test(sfCard) &&
    new RegExp(`${sf.total.toLocaleString()} mi · 6 days · \\$`).test(sfCard), sfCard);
  ok("no console errors on the seeded SF trip", errors.length === 0, errors.join(" | "));
  await shot(page, "05-trips-sf.png");
  await page.locator(".trcard").first().click();
  await page.waitForSelector("#page-trip.active");
  await page.waitForTimeout(500);
  await shot(page, "06-sf-trip-tab.png");

  /* ---- (g) paste an sf-move export through the Import UI ---- */
  console.log("\n(g) sf-move import");
  errors.length = 0;
  const sfExport = readFileSync(SF_EXPORT, "utf8");
  const fixture = JSON.parse(sfExport);
  const INJ_SWEPT = ["inj-h3", "inj-p3"];            /* planned, on a day with an actual of the same kind */
  /* actuals the sweep never touches, plus a planned pet fee on Day 4 — Mom's, where no pet fee was ever
     paid — which must survive because nothing real stands beside it. Since v118 closed the trip out the
     fixture itself has no planned rows left, so this planted one is what keeps the leave-alone branch tested. */
  const INJ_SURVIVORS = ["inj-keep", "inj-p3-paid", "inj-p4"];
  /* planting a real Day 3 pet fee also retires the fixture's own planned one; work out which of the
     fixture's rows the sweep is entitled to take rather than guessing at a total */
  const INJ_ACTUALS = [["hotel", 3], ["kane", 3]];
  const fixtureSwept = fixture.spend.entries.filter(e =>
    e.planned && INJ_ACTUALS.some(([cat, day]) => e.cat === cat && e.day === day)).map(e => e.id);
  await page.locator("#nav-back").click();
  await page.waitForSelector("#page-trips.active");
  /* three rows planted before the paste so dropStalePlanned has something of ours to sweep:
     two planned Day 3 rows (Day 3 has a real hotel, exp-007) and one confirmed by hand, which stays */
  await page.evaluate(() => {
    const t = state.trips["sf-2026"];
    t.spend.entries.push(
      { id: "inj-h3", amount: 150, cat: "hotel", note: "Hotel · Holbrook (TBD)", day: 3, stopId: "holbrook", ts: 1, planned: true, billsLater: false },
      { id: "inj-p3", amount: 50, cat: "kane", note: "Pet fee · Holbrook (TBD)", day: 3, stopId: "holbrook", ts: 1, planned: true, billsLater: false },
      { id: "inj-keep", amount: 231.21, cat: "hotel", note: "Arizonian, confirmed by hand", day: 3, stopId: "holbrook", ts: 1, planned: false, auto: false, billsLater: false },
      /* Day 3 has a real hotel (exp-007) but no real pet fee, so plant one — otherwise the pet-fee
         branch of the sweep has nothing to sweep against and would never be exercised */
      { id: "inj-p3-paid", amount: 50, cat: "kane", note: "Pet fee · Holbrook, paid", day: 3, stopId: "holbrook", ts: 1, planned: false, auto: false, billsLater: false },
      { id: "inj-p4", amount: 20, cat: "kane", note: "Pet fee · Mom's (planned)", day: 4, stopId: "moms", ts: 1, planned: true, billsLater: false });
    save(state);
  });
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
  /* the paste stamps the final stop; every earlier stop follows, including "start", which sf-move
     never flags because it has no card to tap */
  eq("arrived stamps from the paste, plus the ones the rule fills",
    merged.arrived, [...new Set(fxArrived.concat(["start"]))].sort().join(","));
  eq("rolled strobert 08:30", merged.rolled, "2026-09-06T08:30");
  eq("departDate from the paste", merged.departDate, "2026-09-06");
  eq("2 packed", merged.packed, "g-bag,r-skates");
  eq("budget 1500", merged.budget, 1500);
  /* a charge the seed retires takes its pasted row with it too — ask the app which ids those are
     rather than assuming the shipped data has none */
  const retiredIds = await page.evaluate(() => IMPORT_SF().charges.filter(c => c.retired).map(c => c.id));
  const fixtureRetired = fixture.spend.entries.filter(e => retiredIds.includes(e.id)).map(e => e.id);
  eq("spend rows = fixture entries + planted survivors − what the sweeps take",
    merged.rows,
    fixture.spend.entries.length + INJ_SURVIVORS.length - fixtureSwept.length - fixtureRetired.length);
  const sweptGone = await page.evaluate(ids => ids.filter(id => state.trips["sf-2026"].spend.entries.some(e => e.id === id)), fixtureSwept);
  eq("every fixture row the sweep was entitled to take is gone", sweptGone.join(","), "");
  eq("merged onto sf-2026 only", merged.onlyTrip, "sf-2026");

  /* the day decides the stop: sf-move stamps Buckeye/Quartzsite/Indio with nearestStop() → "moms",
     but they are Day 5 sessions and Day 5 closes at Coalinga */
  const day5 = await page.evaluate(() => {
    const t = state.trips["sf-2026"];
    const closes = d => { const st = t.stops.filter(s => !s.retired);
      const off = []; st.forEach((s, i) => off.push(i === 0 ? 0 : off[i - 1] + (i === 1 ? 0 : (s0 => s0.overnight ? Math.max(1, +s0.nights || 1) : 0)(st[i - 1]))));
      for (let i = 1; i < st.length; i++) if (off[i] === d - 1) return st[i].id;
      return st[st.length - 1].id; };
    const rows = t.spend.entries.filter(e => e.day === 5 && e.cat === "charging");
    return { closesDay5: closes(5), rows: rows.map(r => ({ id: r.id, stopId: r.stopId, src: r.srcStopId || null })) };
  });
  eq("Day 5 closes at Coalinga", day5.closesDay5, "coalinga");
  ok("every Day 5 charge sits on the stop that closes Day 5",
    day5.rows.length > 0 && day5.rows.every(r => r.stopId === day5.closesDay5),
    JSON.stringify(day5.rows));
  ok("no Day 5 charge is filed under Mom's", day5.rows.every(r => r.stopId !== "moms"), JSON.stringify(day5.rows));
  const moved = day5.rows.filter(r => r.src === "moms");
  ok("the ones sf-move mis-stamped keep srcStopId moms", moved.length >= 3,
    `${moved.length} rows carry srcStopId "moms": ${JSON.stringify(day5.rows)}`);

  /* the finished trip came over whole */
  const fin = await page.evaluate(() => {
    const t = state.trips["sf-2026"];
    return { sf: t.log.arrivedAt.sf, rolledSf: t.log.rolled.sf || null };
  });
  eq("arrivedAt.sf equals the paste's", fin.sf, fixture.trip.arrivedAt.sf);
  const d2d6 = await page.evaluate(() => {
    const st = state.trips["sf-2026"];
    return { rolled: st.log.rolled.sf || null, at: st.log.arrivedAt.sf || null };
  });
  ok("Day 6 door-to-door has both ends after the paste, or neither",
    (!!d2d6.rolled) === (!!fixture.trip.rolled.sf), JSON.stringify(d2d6));

  /* the sf-move migration fixed the Day 1 arrival date; Mile Marker copies stamps verbatim */
  eq("Day 1 arrival lands on Sept 6",
    (await page.evaluate(() => state.trips["sf-2026"].log.arrivedAt.strobert || "")).slice(0, 10), "2026-09-06");

  /* a planned row never outlives its actual — scanned by day + category, not by id */
  const stale = await page.evaluate(() => {
    const e = state.trips["sf-2026"].spend.entries, bad = [];
    ["hotel", "kane"].forEach(cat => {
      const actualDays = new Set(e.filter(x => !x.planned && x.cat === cat).map(x => x.day));
      e.forEach(x => { if (x.planned && x.cat === cat && actualDays.has(x.day)) bad.push(cat + " day " + x.day + " " + x.id); });
    });
    return { bad, hotelActualDays: [...new Set(e.filter(x => !x.planned && x.cat === "hotel").map(x => x.day))].sort(),
      plannedKane: e.filter(x => x.planned && x.cat === "kane").map(x => x.id + "@" + x.day),
      injected: e.filter(x => ["inj-h3", "inj-p3"].includes(x.id)).map(x => x.id),
      keptConfirmed: ["inj-keep", "inj-p3-paid"].every(id => e.some(x => x.id === id && x.planned === false)) };
  });
  ok("actual hotel rows exist to sweep against", stale.hotelActualDays.length >= 3, JSON.stringify(stale.hotelActualDays));
  eq("the injected Day 3 planned rows are gone", stale.injected.join(","), "");
  ok("the hand-confirmed Day 3 rows survive", stale.keptConfirmed, "a planted actual went missing");
  eq("no planned row survives on a day that has an actual of the same kind", stale.bad.join(","), "");
  ok("a planned pet fee on a day with no real one is left alone", stale.plannedKane.includes("inj-p4@4"), JSON.stringify(stale.plannedKane));

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

  /* ---- (g) cont. — same-id replace carries the close-out, and the seed-row dismissal rule ---- */
  const pasteJSON = async obj => {
    await page.locator("#dataPaste").fill(JSON.stringify(obj));
    await page.locator("#dataImport").click();
    await page.waitForFunction(() => /merged/.test(document.getElementById("dataStatus").textContent));
  };
  const trip = () => page.evaluate(() => state.trips["sf-2026"]);
  const handRow = fixture.spend.entries.find(e => e.amount === 18.72);
  ok("the fixture carries the renamed hand row", !!handRow && handRow.note === "Water", JSON.stringify(handRow));
  ok("the fixture carries the close-out flag", fixture.spend.spendCloseoutV1 === true);
  /* a phone BEFORE the close-out: the five rows planned, "Watter", Ship Sticks planned */
  const pre = JSON.parse(sfExport);
  const PRE_BILLS = { "seed-t1": true, "seed-t2": true };
  pre.spend.entries.forEach(e => {
    if (/^seed-/.test(e.id)) { e.planned = true; e.billsLater = !!PRE_BILLS[e.id]; }
    if (e.id === handRow.id) e.note = "Watter";
  });
  pre.spend.entries.push({ id: "seed-m0", amount: 240, cat: "misc", note: "Ship Sticks · 3 pieces", day: 0, stopId: null, ts: 1, planned: true, billsLater: false });
  delete pre.spend.spendCloseoutV1;
  await pasteJSON(pre);
  let tr = await trip();
  eq("before the close-out the hand row reads Watter", tr.spend.entries.find(e => e.id === handRow.id).note, "Watter");
  eq("before the close-out seed-p2 is planned", tr.spend.entries.find(e => e.id === "seed-p2").planned, true);
  /* now the real, closed-out export: same ids, so the replace must carry the change */
  await pasteJSON(fixture);
  tr = await trip();
  const p2 = tr.spend.entries.find(e => e.id === "seed-p2"), hr = tr.spend.entries.find(e => e.id === handRow.id);
  eq("same-id replace carries planned → actual", p2.planned, false);
  eq("same-id replace carries the rename, under the original id", hr && hr.note, "Water");
  ok("Ship Sticks, absent from the closed-out paste, is dismissed — shape (a)",
    !tr.spend.entries.some(e => e.id === "seed-m0") && tr.spend.dismissed["seed-m0"] === true);

  /* the three shapes, built in memory from the regenerated fixture */
  const shaped = JSON.parse(sfExport);
  shaped.spend.entries = shaped.spend.entries.filter(e => e.id !== "seed-t1");          /* (a) absent */
  shaped.spend.entries.find(e => e.id === "seed-t2").retired = true;                  /* (b) retired:true */
  shaped.spend.retired = ["seed-p3"];                                                 /* (c) named */
  await pasteJSON(shaped);
  tr = await trip();
  const ids = tr.spend.entries.map(e => e.id);
  ["seed-t1", "seed-t2", "seed-p3"].forEach(id => {
    ok(`${id} is gone from entries`, !ids.includes(id));
    eq(`${id} is in spend.dismissed`, tr.spend.dismissed[id], true);
  });
  const keep = id => tr.spend.entries.find(e => e.id === id);
  ok("seed-p2 stays, an actual at 75", keep("seed-p2") && keep("seed-p2").planned === false && keep("seed-p2").amount === 75,
    JSON.stringify(keep("seed-p2")));
  ok("seed-p5 stays, an actual at 50", keep("seed-p5") && keep("seed-p5").planned === false && keep("seed-p5").amount === 50,
    JSON.stringify(keep("seed-p5")));
  ok("the Water row stays under its original id at 18.72",
    keep(handRow.id) && keep(handRow.id).note === "Water" && keep(handRow.id).amount === 18.72, JSON.stringify(keep(handRow.id)));
  /* the kept seed rows render as ordinary actuals — no planned tag, the amount shown plain */
  await page.locator(".trcard").first().click();
  await page.waitForSelector("#page-trip.active");
  await page.locator("#nav-spend").click();
  await page.waitForSelector("#page-spend.active");
  const cap = await page.evaluate(() => ["seed-p2", "seed-p5"].map(id => {
    const r = document.querySelector(`#spendDays .sprow[data-id="${id}"]`);
    return r ? { id, text: r.innerText.replace(/\n/g, " | "), plan: r.classList.contains("plan") } : { id, missing: true };
  }));
  cap.forEach(c => ok(`${c.id} renders as an actual (${c.text || "missing"})`, !c.missing && !c.plan && !/planned/.test(c.text)));
  await page.locator("#nav-back").click();
  await page.waitForSelector("#page-trips.active");
  const shapedBefore = await page.evaluate(() => JSON.stringify(state.trips["sf-2026"]));
  await pasteJSON(shaped);
  const shapedAfter = await page.evaluate(() => JSON.stringify(state.trips["sf-2026"]));
  ok("pasting the three shapes again changes nothing", shapedBefore === shapedAfter);
  /* and a seed refresh never brings a dismissed row back */
  await page.evaluate(() => { state.trips["sf-2026"].seedRev = "an older build"; save(state); });
  await page.reload();
  await page.waitForSelector("#page-trip.active, #page-trips.active");
  const reseeded = await page.evaluate(() => {
    const t = state.trips["sf-2026"];
    return { rev: t.seedRev, back: ["seed-t1", "seed-t2", "seed-p3", "seed-m0"].filter(id => t.spend.entries.some(e => e.id === id)) };
  });
  eq("the refresh ran", reseeded.rev, "sf-move v118 a0489f4");
  eq("no dismissed seed row came back with it", reseeded.back.join(","), "");
  eq("the map form of a named list is read too", await page.evaluate(() => listIds({ a: true, b: false, c: 1 }).join(",")), "a,c");
  if (await page.locator("#page-trip.active").count()) { await page.locator("#nav-back").click(); await page.waitForSelector("#page-trips.active"); }
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
      oasis: t.charges.some(c => c.id === "chg-oasis"),
      seedCharges: IMPORT_SF().charges.length,
      p2: t.spend.entries.find(e => e.id === "seed-p2"),
      m0: t.spend.entries.some(e => e.id === "seed-m0"),
      p3: t.spend.entries.find(e => e.id === "seed-p3"),
      strip: [...document.querySelectorAll("#tripProg .tps")].length,
      cards: [...document.querySelectorAll("#tripStops .card[data-stop]")].map(c => c.getAttribute("data-stop")).join(","),
      nodes: document.querySelectorAll("#nodeG circle.nd").length
    };
  });
  eq("seedRev brought forward", ref.seedRev, "sf-move v118 a0489f4");
  eq("abq + la retired", ref.retired, "abq,la");
  ok("retired stops are kept in the data", /abq/.test(ref.kept) && /la/.test(ref.kept), ref.kept);
  eq("route skips the retired stops", ref.route, "start,strobert,amarillo,holbrook,moms,coalinga,sf");
  eq("stop list skips them too", ref.cards, "start,strobert,amarillo,holbrook,moms,coalinga,sf");
  eq("progress strip has 7 dots", ref.strip, 7);
  eq("map draws 7 stop nodes", ref.nodes, 7);
  ok("abq's Arrived stamp survives", ref.abqStamp, JSON.stringify(ref.abqStamp));
  eq("every seeded session plus the locally logged one", ref.charges, ref.seedCharges + 1);
  eq("no duplicate charge ids", ref.dupIds, 0);
  ok("a locally logged charge is kept", ref.localCharge);
  ok("the fulfilled planned charger is gone", !ref.oasis, "chg-oasis survived the refresh");
  /* v118 seeds the pet fee as an actual: the old planned row is replaced wholesale by the seed's */
  ok("planned row refreshed to the seed's actual", ref.p2 && ref.p2.amount === 75 && ref.p2.planned === false,
    JSON.stringify(ref.p2));
  ok("a planned seed row the seed no longer carries is gone (Ship Sticks)", !ref.m0, "seed-m0 survived the refresh");
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
  /* sf-move's own remove handler deletes the disp, so a real export can never carry both. Tag the
     removed id car here so the only thing keeping it out of the pack list is `removed` itself —
     without this the branch is untestable (drop `gone[id]` from packFromDisp and (j) still passes). */
  const withDisp = JSON.parse(sfExport);
  const removedId = Object.keys(withDisp.removed || {})[0];
  withDisp.disp[removedId] = "car";
  await page.locator("#dataPaste").fill(JSON.stringify(withDisp));
  await page.locator("#dataImport").click();
  await page.waitForFunction(() => /merged/.test(document.getElementById("dataStatus").textContent));
  const dispExpect = { ...withDisp.disp }; delete dispExpect[removedId];
  const removedExpect = Object.keys(withDisp.removed || {});
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
  eq("the removed id really is tagged car in the paste", withDisp.disp[removedId], "car");
  ok("a removed item stays out even with a car disp", removedExpect.every(id => !packed.ids.includes(id + ":")),
    `${removedExpect.join(",")} vs ${packed.ids}`);
  eq("packed count unchanged", packed.packedCount,
    Object.keys(fixture.packed).filter(k => fixture.packed[k]).length);
  ok("no console errors on the disp import", errors.length === 0, errors.join(" | "));

  /* ---- screenshots: Trips, Trip and Pack at 390 and at 1194 ---- */
  console.log("\n390 and 1194: tabs, sheets, gate 2 (no tildes) and the stat rows (port #7a)");
  await page.waitForTimeout(2800);   /* let the import toast expire so it is not in the shots */
  /* gate 2: no "~" anywhere a user can read it */
  const noTilde = async label => {
    const txt = await page.evaluate(() => document.body.innerText);
    const i = txt.indexOf("~");
    ok(`no "~" rendered — ${label}`, i < 0, i < 0 ? "" : JSON.stringify(txt.slice(Math.max(0, i - 40), i + 40)));
  };
  /* port #7a: every visible stat row — equal columns (±1px), nothing clipped, no ellipsis, whole dollars */
  const statRowsOk = async label => {
    const rows = await page.evaluate(() => [...document.querySelectorAll(".statrow")].filter(r => r.offsetParent).map(r => {
      const cells = [...r.children];
      return { id: r.className, widths: cells.map(c => c.getBoundingClientRect().width),
        clipped: cells.filter(c => c.scrollWidth > c.clientWidth + 1 || [...c.querySelectorAll("*")].some(k => k.scrollWidth > k.clientWidth + 1)).length,
        cs: cells.map(c => getComputedStyle(c).justifyContent), text: r.innerText };
    }));
    ok(`${label}: at least one stat row is on screen`, rows.length > 0);
    rows.forEach(r => {
      const spread = Math.max(...r.widths) - Math.min(...r.widths);
      ok(`${label} · ${r.id}: ${r.widths.length} equal columns (spread ${spread.toFixed(2)}px)`, spread <= 1);
      eq(`${label} · ${r.id}: nothing overflows its cell`, r.clipped, 0);
      ok(`${label} · ${r.id}: no ellipsis`, !/…/.test(r.text), r.text);
      ok(`${label} · ${r.id}: cells sit on the bottom`, r.cs.every(v => v === "flex-end"), r.cs.join(","));
      const cents = (r.text.match(/\$[\d,]+\.\d+/g) || []);
      eq(`${label} · ${r.id}: every $ figure is whole dollars`, cents.join(" "), "");
    });
  };
  for (const w of [390, 1194]) {
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : 834 });
    await page.locator("#nav-back").click();
    await page.waitForSelector("#page-trips.active");
    await page.waitForTimeout(300);
    await shot(page, `w${w}-1-trips.png`);
    await noTilde(`${w} Trips`);
    /* the sheets the suite opens: New trip (Basics) and the App-data export */
    await page.locator("#newTripBtn").click();
    await page.waitForSelector("#basicsSheet");
    await noTilde(`${w} New trip sheet`);
    await page.locator("#btCancel").click();
    await page.locator("#dataExport").click();
    await page.waitForSelector(".modal-back");
    await noTilde(`${w} App data export`);
    await page.locator(".modal-back #dmDone").click();
    await page.locator(".trcard").first().click();
    await page.waitForSelector("#page-trip.active");
    await page.waitForTimeout(600);
    await shot(page, `w${w}-2-trip.png`);
    await noTilde(`${w} Trip`);
    await statRowsOk(`${w} Trip`);
    await page.evaluate(() => document.querySelector("#tripStats").scrollIntoView({ block: "start" }));
    await page.waitForTimeout(250);
    await shot(page, `w${w}-2d-trip-stats.png`);
    await page.locator('#tripStats [data-act="filter"]').click();
    await page.waitForSelector("#statsFilter");
    await noTilde(`${w} Stats filter sheet`);
    await page.locator("#statsFilter [data-close]").click();
    /* charging row open: the sessions are grouped by the stop that closes their day.
       The app scrolls inside #scroll, so fullPage would only ever capture one viewport. */
    await page.evaluate(() => { if (!document.getElementById("chgRow").classList.contains("open")) document.querySelector("#chgRow .chgh").click(); });
    await page.waitForTimeout(450);
    await page.evaluate(() => document.querySelector("#chgRow .chgh").scrollIntoView({ block: "start" }));
    await page.waitForTimeout(250);
    await shot(page, `w${w}-2b-trip-charging.png`);
    /* and the Day 5 group — Buckeye, Quartzsite and Indio come over stamped "moms" and must show here */
    await page.evaluate(() => {
      const g = [...document.querySelectorAll("#chgRow .chgl .chgg")].find(e => /DAY 5/i.test(e.textContent));
      if (g) g.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(250);
    await shot(page, `w${w}-2c-charging-day5.png`);
    await page.evaluate(() => { document.getElementById("scroll").scrollTop = 0;
      if (document.getElementById("chgRow").classList.contains("open")) document.querySelector("#chgRow .chgh").click(); });
    await page.locator("#nav-pack").click();
    await page.waitForSelector("#page-pack.active");
    await page.waitForTimeout(400);
    await shot(page, `w${w}-3-pack.png`);
    await noTilde(`${w} Pack`);
    await page.locator("#nav-spend").click();
    await page.waitForSelector("#page-spend.active");
    await page.waitForTimeout(400);
    await shot(page, `w${w}-4-spend.png`);
    await noTilde(`${w} Spend`);
    await statRowsOk(`${w} Spend`);
    for (const d of [0, 2]) {
      await page.evaluate(d => { const c = document.querySelector(`#spendDays .spday[data-day="${d}"]`); if (c) c.scrollIntoView({ block: "start" }); }, d);
      await page.waitForTimeout(200);
      await shot(page, `w${w}-4-spend-day${d}.png`);
    }
    await page.locator("#importLink").click();
    await page.waitForSelector(".modal-back textarea.imp");
    await noTilde(`${w} Import transactions sheet`);
    await page.locator("#impClose").click();
  }
  /* the words themselves: no seed note and no fixture note carries a tilde either */
  const seedNotes = await page.evaluate(() => JSON.stringify(IMPORT_SF()));
  ok("no tilde in any IMPORT_SF string", seedNotes.indexOf("~") < 0);
  ok("no tilde in any fixture string", sfExport.indexOf("~") < 0);
  ok("no console errors at either width", errors.length === 0, errors.join(" | "));

  /* ---- (k) retired charges ---- */
  console.log("\n(k) a retired charge keeps its id and leaves everything else");
  errors.length = 0;
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("#page-trip.active");
  const before = await page.evaluate(() => {
    const t = T();
    return { charges: t.charges.length, live: realCharges().length,
      rows: t.spend.entries.filter(e => e.cat === "charging").length,
      nodes: document.querySelectorAll("#nodeG .chg").length };
  });
  /* pick a session the seed has not already retired, so the deltas below are always real */
  const victim = await page.evaluate(() => {
    const live = T().charges.filter(c => !c.retired && !c.planned && /^chg-\d+$/.test(c.id));
    return live[live.length - 1].id;
  });
  await page.evaluate(id => {
    T().charges.filter(c => c.id === id)[0].retired = true;
    save(state); renderAll();
  }, victim);
  await page.waitForTimeout(200);
  const afterRetire = await page.evaluate(id => {
    const t = T();
    return { stillThere: t.charges.some(c => c.id === id), charges: t.charges.length,
      live: realCharges().length, inChargesOf: chargesOf().some(c => c.id === id),
      row: t.spend.entries.some(e => e.id === id),
      rows: t.spend.entries.filter(e => e.cat === "charging").length,
      nodes: document.querySelectorAll("#nodeG .chg").length,
      inDayStats: (dayStats(5) || { ch: [] }).ch.some(c => c.id === id),
      header: document.querySelector("#chgRow .chgh").innerText };
  }, victim);
  ok("the retired charge is still in trip.charges", afterRetire.stillThere);
  eq("nothing was renumbered or deleted", afterRetire.charges, before.charges);
  ok("it is out of chargesOf()", !afterRetire.inChargesOf);
  eq("one fewer live session", afterRetire.live, before.live - 1);
  ok("its Spend row is gone", !afterRetire.row);
  eq("one fewer charging row", afterRetire.rows, before.rows - 1);
  eq("one fewer map node", afterRetire.nodes, before.nodes - 1);
  ok("it is out of the day's stats", !afterRetire.inDayStats);
  ok("the charging row header counts the live ones",
    new RegExp(`${afterRetire.live}\\s+stops`).test(afterRetire.header), afterRetire.header);
  /* a row the user confirmed by hand is theirs, not the seeder's */
  await page.evaluate(id => {
    const t = T();
    t.charges.filter(c => c.id === id)[0].retired = false;
    save(state); renderAll();
  }, victim);
  await page.waitForTimeout(150);
  await page.evaluate(id => {
    const t = T(), row = t.spend.entries.filter(e => e.id === id)[0];
    row.auto = false; row.amount = 99.99;
    t.charges.filter(c => c.id === id)[0].retired = true;
    save(state); renderAll();
  }, victim);
  await page.waitForTimeout(150);
  const kept = await page.evaluate(id => {
    const e = T().spend.entries.filter(x => x.id === id)[0];
    return e ? e.amount : null;
  }, victim);
  eq("a hand-confirmed row survives its charge being retired", kept, 99.99);
  /* and the structural count still adds up with a retired row in the sequence */
  const seq2 = await page.evaluate(() => {
    const all = T().charges.filter(c => /^chg-\d+$/.test(c.id)), n = c => +c.id.slice(4);
    return { high: Math.max(...all.map(n)), retired: all.filter(c => c.retired).length,
      live: all.filter(c => !c.retired && !c.planned).length };
  });
  eq("live == highest id − retired, with a retired row explaining the gap",
    seq2.live, seq2.high - seq2.retired);
  ok("no console errors retiring a charge", errors.length === 0, errors.join(" | "));

  /* ---- (l) an undriven day reads dashes — built in-page, never by relying on empty fixture data ---- */
  console.log("\n(l) undriven day");
  errors.length = 0;
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("#page-trip.active");
  /* Port #14: every day of the SF trip is driven now, so lift one day's sessions and stamps, assert
     the dashes, then put them back. No test may depend on a day happening to be empty. */
  const dashes = await page.evaluate(() => {
    const t = T(), DAY = 4;
    const stop = stopClosingDay(t, DAY);
    const lifted = t.charges.filter(c => c.date && dayForDate(parseYMD(c.date)) === DAY);
    const keptCharges = t.charges.slice();
    const keptRolled = t.log.rolled[stop.id], keptAt = t.log.arrivedAt[stop.id], keptArr = t.log.arrived[stop.id];
    t.charges = t.charges.filter(c => lifted.indexOf(c) < 0);
    delete t.log.rolled[stop.id]; delete t.log.arrivedAt[stop.id]; delete t.log.arrived[stop.id];
    buildRoute();
    const empty = dayStats(DAY);
    const out = { lifted: lifted.length, stop: stop.id, emptyIsNull: empty === null,
      d2d: empty ? empty.d2d : null, sessions: empty ? empty.ch.length : 0 };
    /* restore */
    t.charges = keptCharges;
    if (keptRolled) t.log.rolled[stop.id] = keptRolled;
    if (keptAt) t.log.arrivedAt[stop.id] = keptAt;
    if (keptArr) t.log.arrived[stop.id] = keptArr;
    buildRoute();
    out.restored = t.charges.length;
    out.restoredStats = !!dayStats(DAY);
    return out;
  });
  ok("the day had sessions to lift", dashes.lifted > 0, `${dashes.lifted} lifted from ${dashes.stop}`);
  ok("with nothing driven the day has no stats at all", dashes.emptyIsNull || (dashes.d2d === null && dashes.sessions === 0),
    JSON.stringify(dashes));
  ok("and everything was put back", dashes.restoredStats, JSON.stringify(dashes));
  const hm6 = await page.evaluate(() => hm(null));
  eq("an unknown duration renders as a dash", hm6, "—");
  ok("no console errors on the undriven-day check", errors.length === 0, errors.join(" | "));

  /* ---- (m) time-zone-aware timing — port #1, sf-move a750b1a, test/trip-time.test.js at a0489f4 ----
     Every stamp is a zone-less wall clock, so a span is only right if each end is read in the zone it
     was taken in. These drive the app's OWN dayStats(); the stamps and the expected strings are sf-move's
     test's, and the expected spans come from its `naive` formula, never retyped. Run under a foreign
     TZ (TZ=Pacific/Auckland npm test) and every number here must still hold — that is the falsifier
     for "never the phone's zone". */
  console.log(`\n(m) time zones (device TZ ${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
  errors.length = 0;
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("#page-trip.active");
  const naive = (a, b) => (Date.parse(b + "Z") - Date.parse(a + "Z")) / 60000;
  const hmS = m => Math.floor(m / 60) + "h " + String(m % 60).padStart(2, "0") + "m";
  const zones = await page.evaluate(() => T().stops.map(s => s.id + "=" + (s.tz || "?")));
  ok(`every seeded stop carries an IANA zone (${zones.join(" ")})`, zones.every(z => !/=\?$/.test(z)));
  const tzDay = (stopId, d, rolled, arrived) => page.evaluate(({ stopId, d, rolled, arrived }) => {
    const t = T(); t.log.rolled[stopId] = rolled; t.log.arrivedAt[stopId] = arrived; t.log.arrived[stopId] = true;
    const r = dayStats(d);
    return { d2d: r.d2d, rolledTz: r.rolledTz, tz: r.tz,
      shown: (r.rolled ? fmtTime(r.rolled) : "") + " → " + (r.arrived ? fmtTime(r.arrived) : "") };
  }, { stopId, d, rolled, arrived });
  {   /* Day 3: Amarillo (CDT, UTC-5) → Holbrook (MST, UTC-7) — crosses a zone */
    const R = "2026-09-08T08:00", A = "2026-09-08T16:30", r = await tzDay("holbrook", 3, R, A);
    ok(`Day 3 reads each stamp in its own zone (${r.rolledTz} → ${r.tz})`, r.rolledTz === "America/Chicago" && r.tz === "America/Phoenix");
    eq(`Day 3 door to door = the wall clocks' ${hmS(naive(R, A))} + the two hours the zone change adds`, r.d2d, naive(R, A) + 120);
    eq("Day 3 door to door reads 10h 30m", hmS(r.d2d), "10h 30m");
    eq("Day 3 still SHOWS the stamps as written", r.shown, "8:00 AM → 4:30 PM");
  }
  {   /* Day 5: Mom's (MST) → Coalinga (PDT) — same offset in September, so no shift */
    const R = "2026-09-10T07:15", A = "2026-09-10T14:45", r = await tzDay("coalinga", 5, R, A);
    ok(`Day 5 crosses Phoenix → Los Angeles (${r.rolledTz} → ${r.tz})`, r.rolledTz === "America/Phoenix" && r.tz === "America/Los_Angeles");
    eq("Day 5 door to door is unshifted — Arizona keeps no DST", r.d2d, naive(R, A));
    eq("Day 5 still SHOWS the stamps as written", r.shown, "7:15 AM → 2:45 PM");
  }
  {   /* the primitive itself */
    const z = await page.evaluate(() => {
      const C = id => T().charges.filter(c => c.id === id)[0];
      return { chi: zonedToEpoch("2026-09-08T08:00", "America/Chicago"), phx: zonedToEpoch("2026-09-08T08:00", "America/Phoenix"),
        den: zonedToEpoch("2026-09-08T08:00", "America/Denver"), la: zonedToEpoch("2026-09-08T08:00", "America/Los_Angeles"),
        winter: zonedToEpoch("2026-12-08T08:00", "America/Los_Angeles"), summer: zonedToEpoch("2026-07-08T08:00", "America/Los_Angeles"),
        c19: { tz: chgTz(C("chg-019")), ts: chgTs(C("chg-019")) },
        tx: chgTz(C("chg-012")), nm: chgTz(C("chg-016")), ca: chgTz(C("chg-029")), il: chgTz(C("chg-001")),
        wall22: fmtTime(chgWall(C("chg-022"))), stored22: C("chg-022").time };
    });
    const H = 3600000;
    eq("Phoenix is two hours behind Chicago on a September morning", (z.phx - z.chi) / H, 2);
    eq("Denver is one hour behind Chicago", (z.den - z.chi) / H, 1);
    eq("Los Angeles and Phoenix are the same clock in September", (z.la - z.phx) / H, 0);
    ok("the same wall clock is a different instant in PST and PDT — the solve follows DST",
      z.winter - z.summer !== 0 && (z.winter % H) - (z.summer % H) === 0);
    ok(`a charge takes its zone from its address (TX ${z.tx} · NM ${z.nm} · CA ${z.ca} · IL ${z.il})`,
      z.tx === "America/Chicago" && z.nm === "America/Denver" && z.ca === "America/Los_Angeles" && z.il === "America/Chicago");
    ok(`an Arizona charge is an instant in Phoenix (${z.c19.tz})`, z.c19.tz === "America/Phoenix" && !isNaN(z.c19.ts));
    ok(`a charge still displays its station-local clock (${z.stored22} → ${z.wall22})`, z.wall22 === "1:51 PM" && z.stored22 === "13:51");
  }
  {   /* the finished trip — sf-move's SF-arrival block. Fresh install: the seed carries 9:11 and no roll */
    const SF = "2026-09-11T09:11";
    const f6 = await page.evaluate(SF => { const t = T(), sf = t.stops.filter(s => !s.retired).pop(), r = dayStats(RT.DAYS);
      return { at: t.log.arrivedAt.sf, arrivedT: r ? r.arrivedT : null, want: zonedToEpoch(SF, sf.tz), rolled: t.log.rolled.sf || null, d2d: r ? r.d2d : null }; }, SF);
    eq("fresh install: arrivedAt.sf is 9:11", f6.at, SF);
    eq("fresh install: the Day 6 arrival instant is 9:11 read in SF's own zone", f6.arrivedT, f6.want);
    ok('fresh install: no Day 6 roll, so door to door stays "—" (not fabricated)', f6.rolled === null && f6.d2d === null);
    /* the device that tapped: sf-move's TAPPED stamps, pasted. Day 6 is Coalinga → SF, one zone */
    const TAPPED = { trip: { departDate: "2026-09-06",
        arrived: { strobert: true, amarillo: true, holbrook: true, moms: true, coalinga: true, sf: true },
        arrivedAt: { strobert: "2026-09-06T17:49", amarillo: "2026-09-07T19:30", holbrook: "2026-09-08T16:30", moms: "2026-09-09T12:45", coalinga: "2026-09-10T15:10", sf: SF },
        rolled: { strobert: "2026-09-06T08:30", amarillo: "2026-09-07T07:19", holbrook: "2026-09-08T07:05", moms: "2026-09-09T08:15", coalinga: "2026-09-10T07:30", sf: "2026-09-11T06:40" } },
      spend: { seededV1: false, entries: [] } };
    await page.locator("#nav-back").click();
    await page.waitForSelector("#page-trips.active");
    await page.locator("#dataPaste").fill(JSON.stringify(TAPPED));
    await page.locator("#dataImport").click();
    await page.waitForFunction(() => /merged/.test(document.getElementById("dataStatus").textContent));
    await page.locator(".trcard").first().click();
    await page.waitForSelector("#page-trip.active");
    const t6 = await page.evaluate(() => { const r = dayStats(RT.DAYS), r3 = dayStats(3);
      return { d2d: r.d2d, rolledTz: r.rolledTz, tz: r.tz, d3: r3.d2d }; });
    eq("tapped device: Day 6 is one zone, Coalinga → SF", `${t6.rolledTz} → ${t6.tz}`, "America/Los_Angeles → America/Los_Angeles");
    eq(`tapped device: Day 6 door to door from 9:11 — ${hmS(naive(TAPPED.trip.rolled.sf, SF))} from a 06:40 roll`, t6.d2d, naive(TAPPED.trip.rolled.sf, SF));
    eq("tapped device: Day 3 across the zone line keeps its two hours",
      t6.d3, naive(TAPPED.trip.rolled.holbrook, TAPPED.trip.arrivedAt.holbrook) + 120);
  }
  {   /* a stop with no tz reads in the trip's FIRST stop's zone — never the phone's. The New-trip flow
         will fill tz from the geocoder (Build 4); until then this fallback is the rule, and it is tested. */
    const fb = await page.evaluate(() => {
      const t = JSON.parse(JSON.stringify(T())), mid = t.stops[3];
      delete mid.tz;
      return { first: t.stops[0].tz, got: stopTz(mid, t), ownWhenSet: stopTz(T().stops[3], T()) };
    });
    eq("a stop without tz falls back to the first stop's zone", fb.got, fb.first);
    eq("a stop with its own tz keeps it", fb.ownWhenSet, "America/Phoenix");
  }
  ok("no console errors in the time-zone block", errors.length === 0, errors.join(" | "));

  /* ---- (n) port #6 — Minutes at each charger opens on the whole trip ---- */
  console.log("\n(n) charger-day picker");
  errors.length = 0;
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("#page-trip.active");
  const minCard = () => page.evaluate(() => {
    const c = [...document.querySelectorAll("#tripStats .card")].find(k => /Minutes at each charger/.test(k.querySelector("h2").textContent));
    const sel = c.querySelector('select[data-sel="chgDay"]');
    return { pill: c.querySelector("label.pill").childNodes[0].textContent.trim(), first: sel.options[0].textContent,
      firstVal: sel.options[0].value, value: sel.value, rows: c.querySelectorAll("[data-chg]").length,
      chgDay: T().stats.chgDay === undefined ? null : T().stats.chgDay };
  });
  let mc = await minCard();
  eq("fresh install: stats.chgDay is unset", mc.chgDay, null);
  eq('"Trip · every logged session" is the first option', mc.first, "Trip · every logged session");
  eq("…and the default", mc.value, "all");
  eq("the pill reads it", mc.pill, "Trip · every logged session");
  const allWant = await page.evaluate(() => liveCharges(T()).filter(c => !c.planned && c.kwh > 0 && c.min > 0).length);
  eq("the card shows every logged session", mc.rows, allWant);
  await page.locator('#tripStats select[data-sel="chgDay"]').selectOption("5");
  await page.waitForTimeout(200);
  mc = await minCard();
  const d5Want = await page.evaluate(() => liveCharges(T()).filter(c => !c.planned && c.min > 0 && c.date && dayForDate(parseYMD(c.date)) === 5).length);
  eq("pick Day 5 → the pill follows", mc.pill, "Day 5");
  eq("pick Day 5 → only Day 5's sessions", mc.rows, d5Want);
  ok("Day 5 is a real subset", d5Want > 0 && d5Want < allWant, `${d5Want} of ${allWant}`);
  ok("no console errors on the charger-day picker", errors.length === 0, errors.join(" | "));

  await browser.close();
  /* Port #13: a routine run leaves the tree exactly as it found it */
  if (!SHOTS_ON) {
    const gitAfter = gitState();
    if (gitBefore === null) console.log("  skip  git cleanliness (not a checkout)");
    else eq("a run without SHOTS=1 changes nothing outside shots/", gitAfter, gitBefore);
    eq("and takes no screenshots", shotCount, 0);
  } else {
    ok(`SHOTS=1 wrote ${shotCount} screenshots`, shotCount > 0);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
