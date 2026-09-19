# Mile Marker — handoff

## Status
v5 · Sep 19 · main = 622e75e. Build 2.3, cloud session. index.html 2,751 lines. State in localStorage `mileMarker_v1` (+ `mileMarkerActive`, `mileMarkerSync`). The SF trip is pinned to sf-move v116 — the finished trip — and a fresh install now opens on a Done trip at 100%.

## Built
- Seed re-pinned to sf-move v116 `c04cb6c` (`SF_SEED_REV` index.html:2176). Deltas from v110: 32 logged sessions (chg-030/031 Harris Ranch on one address, chg-031 still provisional; chg-032 Pleasanton, the first Day 6 session), the two PLACES rows carried as seeded food entries under their place ids (pl-001 $17.83, pl-002 Prime Steakhouse $156.44 — the Places *layer* is Build 3), exp-009 $252.74, `arrivedAt.sf = "2026-09-11T09:11"` as seed data, stops unchanged. Verified: `npm test` (f).
- **Retired charges.** A charge keeps its id forever; `retired:true` takes it out of the map, the charging row, the stats and Spend seeding through one accessor (`liveCharges`/`chargesOf` :939), and `dropRetiredRows` (:1902) removes its auto-seeded Spend row. A row the user confirmed by hand carries `auto:false` and stays — the seeders set `auto:true`, and the only edit path clears it. Verified: `npm test` (k) — retiring one leaves trip.charges the same length, drops exactly one live session, one charging row, one map node and one day-stat entry, and a hand-edited row at $99.99 survives.
- **Complete-trip rule** (sf-move's sfArrivedV1), `applyComplete` (:746), called from `normalizeTrip` so seed, import and boot all get it: an arrival on the final stop marks every earlier stop arrived, keeping stamps that already exist. Nothing anywhere carries a "complete" flag — miles logged, the strip, the Done pill and the per-stop checks all read `log.arrived`. Day 6 door-to-door is "—" on a fresh install because the seed never invents a roll. Verified: `npm test` (f) — 7/7 arrived, status `done`, strip 2,556 mi / 100% / Remaining 0 / "arrived" — and shots/w390-2-trip.png + w1194-2c-charging-day5.png, both looked at.
- Port #15: the stat line under the map drops "of N mi" once today's day is arrived and reads "2,556 miles · arrived" (:1027). Both forms come from `dayProg(todayDay()).done`; the test reads the same function rather than a constant.
- Port #12: a structural session count — live sessions == highest `chg-NNN` minus retired minus planned, and a gap in the sequence is a failure unless a retired row explains it. No literal count in any test.
- Port #13: every screenshot is gated on `SHOTS=1`, and a routine `npm test` ends by comparing `git status --porcelain` before and after, ignoring gitignored shots/.
- Port #14: the undriven-day case lifts a day's sessions and stamps in-page, asserts the dashes, and puts them back — every day of the SF trip is driven now, so no test may rely on one being empty.
- Import: `arrivedAt.sf` from the paste wins, earlier stops follow the rule, retired charges in a Mile Marker-shaped paste are honoured, and `dropRetiredRows` runs *after* the pasted rows land (see Rough). `dropStalePlanned` now tested with rows planted before the paste. 148 assertions, all green.

## Rough
- **A mutation found a real bug, now fixed.** `dropRetiredRows` was running before the pasted spend rows were merged, so a retired charge's row rode back in on every paste and the second-paste idempotency assertion caught it. It now runs alongside `dropStalePlanned`, after the merge.
- **Ports #12, #13 and #14 were not in the ledger** — the doc had 1–11 — so this build added them rather than editing #12 in place. #13 cites sf-move 8790186; #12, #14 and #15 are marked "raised Sep 19 (2.3)" because I could not pin them to a specific sf-move commit from its log, and I will not invent a hash.
- **pl-001 was carried as well as pl-002**, which the prompt did not name. Without it a fresh install's Day 2 is $17.83 light against the same trip after a paste, and the pasted row would have no backing entry to dismiss against. Say the word and it comes out.
- **Tildes are still in rendered text** — 18 lines. Port #5's sweep is Build 2.4. Gate 1 (link wording) returns nothing.
- Still not carried from sf-move: BACKUPS `santarosa` and `winslow`, and the Places *layer* (Build 3).
- Headless Chromium only, 390×844 and 1194×834. Nothing on a real iPhone or iPad.
- Still true: the Gist adapter is dormant; the map uses sf-move's fixed projection and hand-traced outlines; the wide layout is Build 1's single column (port #11); the footer build number is written by hand; this box blocks the Playwright browser download, so both scripts fall back to `/opt/pw-browsers/chromium`.

## Where things live
- Complete-trip rule: `applyComplete` :746, called from `normalizeTrip` :741. Retired charges: `liveCharges`/`chargesOf` :939, `dropRetiredRows` :1902, `seedCharges` :1915. Today card: :1027. Day→stop rule: :855–:885.
- Seed: `SF_SEED_REV` / `IMPORT_SF` / `applySeed` / `seedSFTrip` / `refreshSFSeed` at :2174–:2470; boot :2725. Merge :2610–:2660.
- Docs: docs/milemarker-ports-from-sf-move.md is the port ledger (15 rows) — read it before starting any build.
- Tests: `npm install` then `npm test` (tests/smoke.mjs, a–l). `SHOTS=1 npm test` writes shots/. Fixture regen: clone sf-move to /tmp/sf-move at the pinned rev, `node tests/make-sf-move-fixture.mjs`.

## Last session
Build 2.3 (cloud): re-pinned the seed to v116 with the trip complete, added retired charges and the complete-trip rule, ported #12–#15, took tests to 148 with four mutation checks, and fixed the merge-ordering bug one of them exposed. One commit, pushed.

## Next
- Build 2.4 — ports #1 #5 #6 #7a per docs/milemarker-ports-from-sf-move.md (cloud).
- Then Build 3 per the same ledger, and Builds 4–10 per docs/milemarker-migration-plan.md.
- Ideas logged, not built: a Settings gear on the Trips list; per-trip export; `Stop.detail`/`Stop.note` and `Charge.note` ride along unrendered until the Stop and Charge sheets.
