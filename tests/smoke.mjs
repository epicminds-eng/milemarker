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
  eq("seed revision recorded", sf.rev, "sf-move v116 c04cb6c");
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
  const day1 = await page.locator('#spendDays .spday[data-day="1"] .dayh b').innerText();
  eq("Day 1 spend $302", day1.trim(), "$302");
  eq("Day 1 actuals sum to 301.56, rendered $302",
    (await page.evaluate(() => {
      let v = 0; T().spend.entries.forEach(e => { if (!e.planned && e.day === 1) v += e.amount; });
      return Math.round(v * 100) / 100;
    })).toFixed(2), "301.56");
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
  const INJ_SURVIVORS = ["inj-keep", "inj-p3-paid"]; /* actuals — the sweep never touches them */
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
      { id: "inj-p3-paid", amount: 50, cat: "kane", note: "Pet fee · Holbrook, paid", day: 3, stopId: "holbrook", ts: 1, planned: false, auto: false, billsLater: false });
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
  ok("planting a real Day 3 pet fee retired the fixture's planned one",
    fixtureSwept.includes("seed-p3"), fixtureSwept.join(",") || "(nothing swept)");
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
  ok("a pet fee with no actual is left alone", stale.plannedKane.length > 0, JSON.stringify(stale.plannedKane));

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
      oasis: t.charges.some(c => c.id === "chg-oasis"),
      seedCharges: IMPORT_SF().charges.length,
      p2: t.spend.entries.find(e => e.id === "seed-p2"),
      p3: t.spend.entries.find(e => e.id === "seed-p3"),
      strip: [...document.querySelectorAll("#tripProg .tps")].length,
      cards: [...document.querySelectorAll("#tripStops .card[data-stop]")].map(c => c.getAttribute("data-stop")).join(","),
      nodes: document.querySelectorAll("#nodeG circle.nd").length
    };
  });
  eq("seedRev brought forward", ref.seedRev, "sf-move v116 c04cb6c");
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
  console.log("\nscreenshots at 390 and 1194");
  await page.waitForTimeout(2800);   /* let the import toast expire so it is not in the shots */
  for (const w of [390, 1194]) {
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : 834 });
    await page.locator("#nav-back").click();
    await page.waitForSelector("#page-trips.active");
    await page.waitForTimeout(300);
    await shot(page, `w${w}-1-trips.png`);
    await page.locator(".trcard").first().click();
    await page.waitForSelector("#page-trip.active");
    await page.waitForTimeout(600);
    await shot(page, `w${w}-2-trip.png`);
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
  }
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
