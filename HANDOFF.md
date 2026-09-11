# Mile Marker — handoff

## Status
v4 · Sep 11 · main = 46d06fa. Build 2.2, cloud session. index.html 2,694 lines. State in localStorage `mileMarker_v1` (+ `mileMarkerActive`, `mileMarkerSync`). The SF trip is pinned to sf-move v110 and a charge's stop now comes from its day, not from whatever stop happened to be nearest.

## Built
- Seed re-pinned to sf-move v110 `b2739ec` (`SF_SEED_REV` index.html:2140). Gate checked before touching anything: HEAD is a descendant of 7a9ff8c and carries both `day1ArrivedFixV1` and `seedH3RetireV1`. Deltas from v107: 29 logged sessions (chg-028 Tejon Ranch, chg-029 Tesla Oasis Lost Hills), nothing planned any more, stops/backups/waypoints/expenses/seed rows unchanged. The existing `applySeed` pass carried it — no new migration code. Verified: `npm test` (f) — 29 sessions, 0 planned, furthest logged charger chg-029, TOTAL still the sum of IMPORT_SF's own legs, Day 1 actuals 301.56 → $302.
- A planned charger the seed no longer carries is retired on refresh (:2361) — v109 fulfilled chg-oasis as chg-029, so it goes; a real session the seed lacks was logged on the phone and stays. Verified: `npm test` (i), which now injects chg-oasis into the Build-2-shaped trip and asserts it is gone while `chg-local` survives.
- **The day decides the stop.** `stopClosingDay(t,d)` (:861) is the one rule — the stop you sleep at that night — and `stampStopFromDay` (:875) applies it in both paths, keeping whatever arrived as `srcStopId`. sf-move stamps charges with `nearestStop()`, so Buckeye, Quartzsite and Indio came over as Day 5 sessions labelled "moms"; they now file under Coalinga. `nearestStop` is deleted. Stats key on `day` and are unmoved. Verified: `npm test` (g) — every Day 5 charging row sits on the stop that closes Day 5, none under Mom's, and the three mis-stamped ones keep `srcStopId:"moms"`. **Mutation check: making `stampStopFromDay` keep the pasted stopId turned 3 assertions red; restored bit-identical.**
- The charging row groups by that derived stop (`renderCharging` :1061): a `DAY n · STOP` heading per day, sessions in time order under it. Verified: shots/w390-2c-charging-day5.png and w1194-2c-charging-day5.png, both looked at — "DAY 5 · COALINGA" over Buckeye · Quartzsite · Indio · Ontario · Castaic · Tejon Ranch · Tesla Oasis, and "DAY 4 · MOM'S" over Payson · Chandler.
- A planned row never outlives its actual: `dropStalePlanned` (:2541) runs after every merge and drops any planned hotel or pet-fee row on a day that already has a real one — scanned by day + category, never by id, so a renamed seed row cannot sneak back. Verified: `npm test` (g) scans the entries rather than trusting ids, and confirms the still-unpaid pet fees are left alone.
- Day 1's arrival lands as 2026-09-06 — sf-move's `day1ArrivedFixV1` rewrites the date and Mile Marker copies log stamps verbatim. Verified: `npm test` (g).
- tests/smoke.mjs is a–j, 114 assertions. tests/make-sf-move-fixture.mjs regenerated against v110 (45 spend rows, 4 arrived stops, disp + removed). Screenshots at 390 and 1194 for Trips, Trip, Trip with the charging row open, the Day 5 group, and Pack.

## Rough
- **The fixture cannot carry `disp` and `removed` for the same id.** sf-move's remove handler does `delete state.disp[it.id]`, so tagging the removed item car and then removing it just wipes the tag — a real export can never hold both. Test (j) therefore builds that pair in memory before pasting, which keeps the committed fixture a faithful export. **Mutation check: dropping the `removed` branch from `packFromDisp` turned 2 assertions red; restored.**
- **Tildes are still in rendered text** — 18 lines. Port #5's sweep is the next build; the rule has been in CLAUDE.md since 2.1. Gate 1 (link wording) returns nothing.
- Still not carried from sf-move: BACKUPS `santarosa` and `winslow` (bare map dots with no owning stop), and PLACES (pl-001, which also seeds a Spend row). Both want the Build 3 map work.
- Everything ran in headless Chromium at 390×844 and 1194×834. Nothing on a real iPhone or iPad.
- Still true: the Gist adapter is dormant; the map uses sf-move's fixed projection and hand-traced outlines; the wide layout is Build 1's single column (port #11); the footer build number is written by hand; this box blocks the Playwright browser download, so both scripts fall back to `/opt/pw-browsers/chromium`.

## Where things live
- Day→stop rule: `stopClosingDay` / `stopForDay` / `stampStopFromDay` at index.html:855–:885; used by `seedCharges` (:1860) and `seedExpenses` (:1873) and by the merge (:2571). Charging row :1035–:1075.
- Seed: `SF_SEED_REV` / `SF_PACK_CATALOGUE` / `IMPORT_SF` / `applySeed` / `seedSFTrip` / `refreshSFSeed` at :2138–:2400; boot :2668. `dropStalePlanned` :2541, `packFromDisp` :2504.
- Docs: docs/milemarker-ports-from-sf-move.md is the port ledger — read it before starting any build.
- Tests: `npm install` then `npm test` (tests/smoke.mjs, a–j). Fixture regen: clone sf-move to /tmp/sf-move, `node tests/make-sf-move-fixture.mjs`. Screenshots land in shots/ (gitignored).

## Last session
Build 2.2 (cloud): gated on the sf-move fix build, re-pinned the seed to v110, made a charge's day authoritative over its stopId across both the seed and the import, retired fulfilled planned chargers, swept planned rows that outlived their actual, grouped the charging row by the derived stop, took tests to 114 with two mutation checks. One commit, pushed.

## Next
- Build 2.3 — ports #1 #5 #6 #7a per docs/milemarker-ports-from-sf-move.md (cloud).
- Then Build 3 per the same ledger, and Builds 4–10 per docs/milemarker-migration-plan.md.
- Ideas logged, not built: a Settings gear on the Trips list; per-trip export; `Stop.detail`/`Stop.note` ride along unrendered until the Stop sheet.
