# Mile Marker — handoff

## Status
v2 · Sep 7 · main = 58590a6 (last content commit before this one). Build 2, cloud session. index.html 2,494 lines. State in localStorage `mileMarker_v1` (+ `mileMarkerActive`, `mileMarkerSync`). A fresh install now opens on the SF trip.

## Built
- `IMPORT_SF()` (index.html:2072) — the SF move as trip #1 `sf-2026`, code-seeded from sf-move v55 in final post-migration shape: 7 stops keeping sf-move's ids (start/strobert/amarillo/abq/moms/la/sf), BACKUPS as `stop.backup`, WAYPTS split at their `stop:` markers into per-leg `Stop.route` polylines, 8 charges (chg-001…chg-007 + planned chg-oasis), 4 expenses, the 7 surviving seed-* planned rows, BEFORE_LEAVE (bl-*, 10), 99 Pack items in groups car/ship/joey. Verified: `npm test` (f) — TOTAL 2,569 mi, 6 days, 21 waypoints, 7 logged + 1 planned, Day 1 spend $302, and shots/06-sf-trip-tab.png, looked at (route follows the road exactly as sf-move draws it).
- One-time seed at boot (:2478): `trips` empty and no `meta.sfSeededV1` → add IMPORT_SF, make it active, flag it. An install that already made trips is left alone; "Restore the SF trip" (:456, `refreshRestore` :2412) does it on demand and hides itself once the trip exists. Verified: `npm test` (f) + shots/05-trips-sf.png, looked at.
- Trips card reads `Live · Sept 6 – … · 2,569 mi · 6 days · $334`. `tripDates` (:2250) renders an open-ended range; `tripSummary` (:2233) now counts charges/expenses not yet seeded into `spend.entries`, so the card is right before the trip is ever opened. Verified: `npm test` (f).
- App data card (:469) — Export (share sheet, select-all modal fallback, `exportShare` :2337) and Import (`importPasted` :2393). Import sniffs the format: a Mile Marker export replaces the store after a confirm; an sf-move export merges onto `sf-2026` only (`mergeSfMove` :2355, seeding the trip first if missing). Verified: `npm test` (g) and (h).
- sf-move merge, pasted state wins: arrived/arrivedAt/rolled → `log.*` by stopId, departDate, `packed` → `pack.packed`, `customTasks.bl` → extra beforeLeave items, `spend.entries` replace-by-id (this is how confirmed hotel amounts and `planned:false` arrive) / unknown ids added / dismissed ids into `spend.dismissed`, budget, stats. done/disp/notes/removed/collapsed/custom ignored. Toast: "Imported · 2 stamps · 2 packed · 18 spend rows · budget $1,500". Verified: `npm test` (g), including a second paste changing no leaf of `trips["sf-2026"]`.
- `pack.beforeLeave` is now the trip's own list, seeded from `DEFAULT_BEFORE_LEAVE()` (:1473) on first normalize; only rows the trip added (`own:true`) carry a delete. Pack section heads read through `GROUP_LABEL` (:1485). Verified: shots/08-sf-pack.png and shots/09-sf-pack-groups.png, both looked at (Car 80 · Ship 17 · Joey 2 · This trip 0).
- tests/smoke.mjs: assertion 5 is scoped to the Charging-spend KPI tile's own `.n`. Proved: ×10-ing the cost sum in `tripStats` (:1225) makes the tile read $111 while the old whole-section match still found $11.10 in the sessions table — the new one fails. Reverted after the run.
- tests/fixtures/sf-move-export.json, built by tests/make-sf-move-fixture.mjs against a fresh sf-move install (tag two Sort items Car, pack both, Arrived on Amarillo, budget 1500). 75 assertions, all green.

## Rough
- **The progress strip reads 27%, not the 22.55% in the plan.** sf-move gained chg-007 (Tulsa) in v55, so the furthest logged charger is Tulsa, not Joplin, and the ring sits at 681 of 2,569 mi. Springfield is still passed. Nothing is wrong; the plan's number predates v55.
- **Pack groups are derived, not copied.** sf-move keeps each item's car/ship/joey disposition in per-device state (`state.disp`), never in code — only the SORT catalogue and its notes are. The groups in IMPORT_SF come from each item's note / sub-header / the EXTRA reference verdicts; anything reading leave/sell/donate is left out, as sf-move's Pack tab leaves out anything untagged. Ids are SORT's, so a pasted `packed` still lands. Chad should eyeball the three lists.
- Everything ran in headless Chromium at 390×844 with an iPhone UA. Nothing on a real iPhone: share sheet, paste into the Import textarea, map pinch/pan, date pickers.
- This box blocks the Playwright browser download, so both test scripts fall back to `/opt/pw-browsers/chromium` when the cached build is missing. On the Mac the default path wins and the fallback never fires.
- Still true from Build 1: the Gist sync module is dormant and unexercised; the map uses sf-move's fixed projection and hand-traced outlines; LOD towns and shields are gone until Build 3; the footer hash is written by hand.

## Where things live
- IMPORT_SF + `seedSFTrip` (:2222): index.html:2050–:2230. App data card markup :469; export/import/merge :2314–:2418. Trips list + card summary :2231–:2313. Boot seed :2478.
- Pack (beforeLeave defaults, group labels, renderers): :1473–:1620. Everything else is where Build 1 left it.
- Tests: `npm install` then `npm test` (tests/smoke.mjs, a–h). Fixture regen: clone sf-move to /tmp/sf-move, `node tests/make-sf-move-fixture.mjs`. Screenshots land in shots/ (gitignored).

## Last session
Build 2 (cloud): IMPORT_SF + the one-time seed + the restore link, the App data Export/Import card with the sf-move merge, beforeLeave as trip data, the scoped KPI assertion, the sf-move fixture, tests (f)(g)(h), footer to v2. One commit, pushed.

## Next
- Build 3 — outlines + auto-fit projection (cloud).
- Then Builds 4–10 per docs/milemarker-migration-plan.md.
- Ideas logged, not built: a Settings gear on the Trips list (sync, vehicle defaults, units); per-trip export rather than the whole store; `Stop.detail` is rendered nowhere yet (the LA/SF/ABQ addresses ride along unused until the Stop sheet in Build 4).
