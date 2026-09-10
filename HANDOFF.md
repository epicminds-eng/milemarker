# Mile Marker — handoff

## Status
v3 · Sep 10 · main = e07279c. Build 2.1, cloud session. index.html 2,632 lines. State in localStorage `mileMarker_v1` (+ `mileMarkerActive`, `mileMarkerSync`). The SF trip is now seeded from sf-move v107 and refreshes itself when the seed revision moves.

## Built
- `IMPORT_SF()` (index.html:2148) rebuilt from sf-move v107 (0d8b246), stamped `IMPORT_SF.rev = "sf-move v107 0d8b246"` (:2100). Stops are start · strobert · amarillo · holbrook · moms · coalinga · sf with ids unchanged, each carrying `tz` as data (nothing reads it until Build 2.2); 23 WAYPTS split into per-leg `Stop.route`; 27 logged charges + the planned Tesla Oasis; expenses through exp-009; the six surviving planned rows (every hotel seed is booked now). Verified: `npm test` (f) — TOTAL equals the sum of IMPORT_SF's own legs (2,556 mi), 6 days, furthest logged charger chg-027 Castaic at 86%, Day 1 spend $302, and shots/w390-2-trip.png + w1194-2-trip.png, both looked at.
- The seed is additive and retiring, not one-shot: `applySeed` (:2289) rewrites the seed's definition fields on matching stops, adds new ones in the seed's order, and marks a stop the seed no longer has `retired:true` — hidden from map, stop list, progress strip, day maths and Spend seeding through `liveStops` (:737) while its stamps and spend rows stay in the data. Charges and expenses merge by id (locally logged ones kept, dismissed ids left dismissed); a planned `seed-*` row is replaced unless the trip's copy is `planned:false`. log/pack/budget/stats untouched. First run, the Restore link and boot (`seedSFTrip` :2331, `refreshSFSeed` :2340, boot :2616) all go through it. Verified: `npm test` (i) — a Build-2-shaped trip retires abq + la, keeps abq's Arrived stamp, ends with 28 seeded + 1 local charge and no duplicate ids, refreshes seed-p2 to $75, leaves a hand-confirmed row at $42, and a second boot changes no leaf.
- Pack groups now come from the pasted `disp`, replacing Build 2's note-derived guess: `SF_PACK_CATALOGUE` (:2102) is the Sort catalogue by id, `packFromDisp` (:2478) maps car/ship/joey → `item.group`, undecided → its own group, and drops leave/sell and anything in `removed`. Groups render Car · Ship · Joey · Undecided in that fixed order (`GROUP_ORDER` :1515), an empty one never rendering. Verified: `npm test` (j) and shots/w390-4-pack-groups.png, looked at — Car 2/2, Ship 0/1, no Undecided, the sell and removed items absent, packed count unchanged.
- Two label collisions the v107 geometry exposed: `placeLabels` (:877) resolves node labels once per route build, trying the alternating side, then the other, then a nudge, so Holbrook and Mom's no longer print as "Mom'sbrook"; the progress strip drops a middle label within 12% of either end (`END_GAP` :1394) so Coalinga no longer sits on SF. Verified: the before/after screenshots at 390, looked at.
- CLAUDE.md gains four rules (link wording + its grep gate, no tildes, the per-build checklist, mockups are LOOK not STRUCTURE). docs/milemarker-ports-from-sf-move.md written — 11 ports, each with its sf-move commit and the build that carries it.
- tests/smoke.mjs is a–j, 102 assertions, all green; screenshots at 390 and 1194 for Trips, Trip and Pack. tests/make-sf-move-fixture.mjs now tags car/car/ship/sell and removes one item, so the fixture carries `disp` and `removed`.

## Rough
- **Tildes are still everywhere in rendered text** — 18 lines in index.html. The rule lands this build, the sweep is Build 2.2 (port #5 in the ports doc). Gate 1 (link wording) returns nothing.
- **Two BACKUPS were not carried.** v107's `santarosa` and `winslow` are bare gray map dots with no owning stop; `Stop.backup` can only express one backup per stop, so only rolla (strobert) and shamrock (amarillo) came across. They belong with the Build 3 map work.
- **PLACES was not carried.** v107 seeds a Places layer (pl-001 Rudy's BBQ) that feeds a Spend row; it is outside this prompt's list and has no home in the spec's model yet.
- Everything ran in headless Chromium at 390×844 and 1194×834. Nothing on a real iPhone or iPad: share sheet, pasting into Import, map pinch/pan, date pickers.
- The wide layout is still Build 1's single column — the sub-tab-driven wide column is port #11, Build 3.
- Still true: the Gist adapter is dormant and unexercised; the map uses sf-move's fixed projection and hand-traced outlines; the footer build number is written by hand; this box blocks the Playwright browser download, so both scripts fall back to `/opt/pw-browsers/chromium`.

## Where things live
- Seed: `SF_SEED_REV` / `SF_PACK_CATALOGUE` / `IMPORT_SF` / `applySeed` / `seedSFTrip` / `refreshSFSeed` at index.html:2098–:2348; boot :2616. `liveStops` :737. Label placement :868–:900; progress-strip labels :1390–:1400. Pack groups :1513–:1600; `packFromDisp` :2478 inside the App-data section (:2440–:2545).
- Docs: docs/milemarker-ports-from-sf-move.md is the port ledger — read it before starting any build.
- Tests: `npm install` then `npm test` (tests/smoke.mjs, a–j). Fixture regen: clone sf-move to /tmp/sf-move at 0d8b246, `node tests/make-sf-move-fixture.mjs`. Screenshots land in shots/ (gitignored).

## Last session
Build 2.1 (cloud): rebuilt the seed from v107 with `tz` and a recorded revision, made it additive and retiring, moved Pack grouping onto the pasted `disp`, added the four repo rules and the ports ledger, fixed two label collisions, took tests to a–j at 390 and 1194. One commit, pushed.

## Next
- Build 2.2 — ports #1 #5 #6 #7a per docs/milemarker-ports-from-sf-move.md (cloud).
- Then Build 3 per the same ledger, and Builds 4–10 per docs/milemarker-migration-plan.md.
- Ideas logged, not built: a Settings gear on the Trips list; per-trip export; `Stop.detail`/`Stop.note` ride along unrendered until the Stop sheet.
