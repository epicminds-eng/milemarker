# Mile Marker — handoff

## Status
v6 · Sep 24 · Build 2.4 = 2e5e0cc (last app commit), cloud session. index.html 2,843 lines. State in localStorage `mileMarker_v1` (+ `mileMarkerActive`, `mileMarkerSync`). The SF trip is pinned to sf-move v118 — the finished trip with its spend closed out — and every time on it is read in the zone it was written in.

## Built
- Seed re-pinned to sf-move v118 `a0489f4` (`SF_SEED_REV` index.html:2232). STOPS/CHARGES/EXPENSES/PLACES byte-identical to c04cb6c; seedSpend lifted from a0489f4 — pet fees seed-p2/p3/p5 and tolls seed-t1/t2 seed as ACTUALS at the same amounts, Ship Sticks (seed-m0) does not seed. A refresh drops a still-planned seed row the seed no longer carries (:2470), so an old install lands where sf-move's spendCloseoutV1 leaves a phone. Day 1 is now $307, not $302: seed-t1 is real. Verified: `npm test` (f), Day 1 derived from IMPORT_SF, no seed-m0 anywhere, Pre-trip $0 (shots/w1194-4-spend-day0.png, looked at).
- Seed-row dismissal (`dismissSeedRows` :2664), only when the paste has `spend.seededV1`: a seed-* row (a) absent from the paste, (b) pasted with `retired:true`, or (c) named in `spend.retired/removed/dismissed` (map or array) goes to `spend.dismissed`, leaves entries, and neither `applySeed` nor the paste brings it back. Verified: `npm test` (g) — a pre-close-out paste then the real one proves same-id replace carries planned→actual and "Watter"→"Water" under the original id; the three shapes built from the fixture all land in dismissed; p2/p5 render as actuals; second paste identical; a forced seed refresh re-adds nothing.
- Port #1, time zones (sf-move a750b1a): `zonedToEpoch` via Intl (:1058), `stopTz` falls back to the trip's first stop's zone, never the phone's (:1070), `rolledTz` = previous stop, `chgTz` from the address state, `chgWall` for display (:1085). `dayStats` (:1342) reads rolled in the previous stop's zone and arrived in its own. Verified: `npm test` (m) with sf-move's stamps and expected strings — Day 3 Amarillo→Holbrook 10h 30m, Day 5 unshifted, the primitive's offsets, charge zones, the tapped device's Day 6 — **and the whole suite passes under `TZ=Pacific/Auckland`**.
- Port #5, tilde sweep: every rendered tilde removed (17 lines, 18 strings); gate 2 asserts `document.body.innerText` has none on every tab and sheet the suite opens at 390 and 1194, plus every IMPORT_SF and fixture string.
- Port #6: Minutes at each charger opens on "Trip · every logged session" — first option, default when `stats.chgDay` is unset (:1458). Verified: `npm test` (n), counts from `liveCharges` by day.
- Port #7a, stat rows (sf-move 542ed6c): `.statrow` (:328) — `--n` equal `minmax(0,1fr)` columns, nowrap, no ellipsis, bottom-aligned, token spacing — on the progress-strip tiles and the Spend summary; whole-dollar money, a sub-dollar rate reads in cents ("75¢ per mile"). Verified: `npm test` at 390 and 1194 and shots/w390-4-spend.png, looked at.
- Ledger: rows 12/14/15 re-sourced, 16 (Tesla importer tz) and 17 (this re-pin + dismissal) added, seed history and build order updated. 249 assertions (default TZ and Pac/Auckland); five mutations all red, restored bit-identical.

## Rough
- **Port #6's source is a different picker.** At aaf8e17 "Trip · every logged session" heads sf-move's Highlights scope select (`hlScope`); the ledger assigns it to the charger-day picker, so I lifted the option pattern onto Mile Marker's `chgDay` select.
- **Port #7a picked two rows, not four columns.** Mile Marker has no sf-move-style four-cell statrow yet (those live in Build 3's sub-tab sections). The rule landed on the two single-line stat rows it does have — both three cells. The 2×2 KPI cards in Trip stats are cards, not a row, and were left alone.
- **"75¢ per mile" is a judgment call** — whole-dollar money would print a $0.75 rate as "$1".
- **The fixture reconstructs a pre-v118 phone** (five rows planned, Ship Sticks planned, flag unset) and reloads so sf-move's OWN spendCloseoutV1 renames "Watter" and closes it out; "Watter" itself is added through the real Add expense sheet.
- **Seen in the shots, not fixed (out of scope):** "126% charging" on Time on the road — whole-trip charger minutes over door-to-door from the one day that has both stamps; Projection still adds a $40 misc tail to a finished trip ($1,962 vs $1,922 spent); "Tolls · parking · misc" crowds its $17 at 390; the fixture's seed rows show sf-move's own seed-time clock ("1:30 PM").
- One tilde survives, index.html:415 — a CSS comment, never rendered. Gate 1 (link wording) returns nothing.
- Still true: map uses sf-move's fixed projection; wide layout is Build 1's single column; Gist adapter dormant; footer hand-written; this box blocks the Playwright download, so tests fall back to `/opt/pw-browsers/chromium`; nothing run on a real iPhone or iPad. `origin/claude/sf-trip-import-dg11z0` still needs deleting by hand.

## Where things live
- Time zones :1040–:1086; dayStats :1342. Charger-day picker :1455–:1466. Stat row CSS :328. Seed :2230–:2500; dismissal :2650–:2690; merge :2700–:2770.
- Ledger: docs/milemarker-ports-from-sf-move.md (17 rows). Tests: `npm test` (a–n), `TZ=Pacific/Auckland npm test`, `SHOTS=1 npm test` for shots/. Fixture: clone sf-move to /tmp/sf-move at the pinned rev, `node tests/make-sf-move-fixture.mjs`.

## Last session
Oct 9 (local, rules only): CLAUDE.md gained a Canary section and the board-room chair-first rule (with the BOARD-REVIEWED: exception), copied verbatim from ~/.claude/CLAUDE.md; later that day the Board room paragraph gained the /board fallback sentence for phone and cloud sessions (board-room Build 1.3.2). No app files touched, no version bump, no Playwright run. App state is still Build 2.4 below.
Build 2.4 (cloud): re-pinned to v118's close-out, added the seed-row dismissal rule, ported #1 (time zones), #5 (tildes), #6 (charger-day default) and #7a (stat rows), extended the ledger, ran five mutations. One commit, pushed.

## Next
- Build 3 is PARKED until the next road trip. Do not start it or offer it unprompted.
- Before Build 3: the bottom-row navigation needs work. Chad sends a screenshot, then it goes to the board.
- Build 3 decisions already made (Oct 8, board room): days without both stamps show no charging share; the segmented control regroups existing Trip content only; no BACKUPS chips and no Places layer in Build 3.
- The Build 3 prompt lives in the board-room Build 1 report (base 2e5e0cc, target v7).
- Worth a look before then: the 126% charging share and the finished-trip projection tail.
