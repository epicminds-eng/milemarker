# Mile Marker — handoff

## Status
v7 · Oct 9 · Build 3a = the one commit on 2df6f65 (hash in the session report; `git log -1`), cloud session. Numbers only: whole-trip charging share, finished-trip projection (port #18), fixture pin, footer rule (port #9). index.html 2,852 lines. State in localStorage `mileMarker_v1` (+ `mileMarkerActive`, `mileMarkerSync`). Seed still sf-move v118 `a0489f4`. Phone import ran Oct 9: sf-move data merged onto the SF trip.

## Built (this session)
- Charging share: a second accumulator sums chMin ONLY on days with both stamps (`chMinD2d`, tripStats :1365 / scopeStats :1392 / chgDay card :1465); the share divides it by the summed door-to-door. "Time at chargers" and avgMin still read the all-days total — "11h 45m · avg 22m" is byte-identical before and after (captured from the unmodified app at step 0, re-read in (o)). On the fixture the tile now reads "9h 19m · 20% charging" (was 126%). A day without both stamps shows no share (Oct 8 board). Verified: `npm test` (o) at 390 and 1194, shots/w390-2d-trip-stats.png and w1194-2d-trip-stats.png looked at.
- Port #18 (sf-move 4c24b14): spendTotals :1820 reads `done` from the last stop's arrived flag; chEst, foodEst and the tail are 0 when done; `done` and `foodEst` returned; Projection card :1847 carries sf-move's finished copy. Spend hero reads "$1,922 so far · $1,922 projected" (was $1,962). Verified: (q), shots/w390-4-spend-projection.png and w1194-4-spend-projection.png looked at.
- Fixture pin: two generator runs differed in nine Date.now() leaves (meta.touched, seed ts, the hand row's id and ts). The page clock is pinned (`CLOCK`, generator :27) and the page zone is UTC (:58) — sf-move stamps seeded ts in the device zone, so Auckland used to write a different file. Fixture regenerated (hand row is now `e1790256636339`). Verified: two runs share one sha256 under default TZ and Pacific/Auckland, and it is the committed fixture's.
- Footer rule (port #9): :616 reads "Mile Marker v7 · build 2026-10-09", no hash. Verified: (s).
- Ledger rows 9, 11, 18 and the build order; CLAUDE.md footer law. 319 assertions (default TZ and Pacific/Auckland); five mutations all red, restored bit-identical: (i) share without the d2d guard → (o) badge 126% at both widths; (ii) avgMin on the share accumulator → (o) avg badge 3m; (iii) tail unconditional → (q) proj ≠ soFar, hero $1,962; (iv) chEst unconditional → (q) done trip with a live fix estimates $112; (v) hash on the footer → (s).

## Rough
- The fixture determinism test runs the generator twice (~30 s) and only when /tmp/sf-move/index.html is cloned at a0489f4; otherwise it prints a skip line.
- "Tolls · parking · misc" still crowds its $17 at 390 (shots/w390-4-spend.png). The "bad" red styling on the share badge is pre-existing.
- Still true: map uses sf-move's fixed projection; wide layout is Build 1's single column; Gist adapter dormant; this box blocks the Playwright download, so tests fall back to `/opt/pw-browsers/chromium`; nothing run on a real iPhone or iPad. `origin/claude/sf-trip-import-dg11z0` still needs deleting by hand.

## Where things live
- Share accumulators :1362–:1400 and :1463–:1468; spendTotals :1801–:1826; Projection copy :1847; footer :616. Time zones :1040–:1086; seed :2230–:2500; dismissal :2650–:2690.
- Ledger: docs/milemarker-ports-from-sf-move.md (18 rows). Tests: `npm test` (a–s), `TZ=Pacific/Auckland npm test`, `SHOTS=1 npm test` for shots/. Fixture: `git clone https://github.com/epicminds-eng/sf-move /tmp/sf-move && git -C /tmp/sf-move checkout a0489f4`, then `node tests/make-sf-move-fixture.mjs` (FIXTURE_OUT overrides the path).

## Next
- ON HOLD since Oct 9 by Chad's choice. Do not start or offer the next build until he reopens it.
- 3b board ask: Chad does not want to see the Sync and App data cards on the Trips screen. Proposal: one closed "Settings" row at the bottom of Trips holding both, with Import and Export still reachable.
- 3b board ask: no manual import steps for Chad. Phone-only data gets baked in by the build from an export he sends.
- Bottom-row navigation screenshot goes to the board, then /board 3b: five-segment control (dumb: text only, not sticky, no thumb, grid like .statrow), port #11 with todayFigures and the strip, header version stamp under the Trips h1, sub-tab persisted in its own localStorage key. 3c = map. Oct 9 board: D1 no (no owning stop; map nodes in 3c), D2 no (Places with its layer in 3c), D3 resolved by the split.
