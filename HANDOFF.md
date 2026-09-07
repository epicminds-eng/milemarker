# Mile Marker — handoff

## Status
v1 · Sep 7 · first commit. Single-file PWA scaffolded from sf-move v54: index.html (2,185 lines) + mm-icon.png + docs/ + design/ + tests/smoke.mjs. State in localStorage `mileMarker_v1` (+ `mileMarkerActive` for the per-device active trip, never synced; `mileMarkerSync` for the dormant Gist adapter). Runs with zero trips.

## Built
- Trips launch screen (index.html:2069 renderTrips, :2043 tripSummary, :2062 sortedTrips): card per trip — name · dates · status chip · "N mi · N days · $N"; Live pinned first, then Planning, then Done, newest departure first inside a group; dashed "No trips yet" empty state; "+ New trip" opens a Basics sheet (name + depart + return only, vehicle defaults to Model Y 270 Wh/mi, :2091 openBasics) that creates a Planning trip. Verified: `npm test` (a) and (c), plus shots/01-trips-empty.png and shots/03-trips-two.png, both looked at.
- Trip-scoped state root `{settings, templates, trips:{id:Trip}, meta}` with `T()` (index.html:696) as the one accessor; every renderer reads it. Shapes per docs/milemarker-spec.md. Route model rebuilt from `trip.stops` on each full render (:786 buildRoute) — Stop.route polyline where present, straight segment where not; miles always from Stop.mi; day offsets from `overnight`/`nights`. Verified: `npm test` (b), 550 mi total and Day 1 of 2 derived from the fixture.
- Change tracking kept (leaves/setLeaf/commit/tombstones, :628–:670). ID_ARRAY gains `trips.<id>.stops`, `.charges`, `.expenses`, `.spend.entries`, `.pack.items`, `.pack.beforeLeave` plus templates and vehicles (:624). SYNC_SKIP is now regex-based and skips `trips.<id>.ui` (:622). Verified by inspection only — see Rough.
- Trip tab (:1109 renderTripHead, :1118 renderTripStops): map hero, progress strip, stats dashboard, charging row, stop cards with Arrived + Rolling/Arrived stamps. Node labels place themselves (:850 lblFor) — alternate above/below, anchor flips when the estimated box would leave the canvas. Verified: `npm test` (b) 1–5 and shots/02-trip-tab.png, looked at (all three labels legible, route and nodes correct).
- Zero-state: a trip with no stops renders map hero, progress strip at 0, "No charges logged", stats "—", Pack sections empty with the "Before I leave" card, Spend with no entries and the budget link. Verified: `npm test` (e) and shots/04-trip-zero-state.png, looked at.
- Removed: Move tab, Sort tab, Export card, every dated migration, Joey/USPS/SF copy, Orbitz date derivation, Wallet Shortcut recipe, STOPS/BACKUPS/WAYPTS/CHARGES/EXPENSES constants and seedSpend's hard-coded rows. seedCharges/seedExpenses now read `trip.charges`/`trip.expenses` (:1788, :1801) and record deletions in `trip.spend.dismissed`. Verified: the step-11 grep gate returns nothing.
- Placeholder mm-icon.png 512×512 rendered from build/mm-icon.svg via qlmanage (PIL absent). Verified: looked at it.

## Rough
- Everything was verified in headless Chromium at 390×844 with an iPhone UA. Nothing has run on a real iPhone: map pinch/pan, date pickers, share sheet, geolocation.
- The Gist sync module is dormant and completely unexercised in this build — no gist is configured and no test touches it. The per-leaf merge was only reasoned about after the state-root change, never run.
- The map still uses sf-move's fixed projection (lon −125.5→−84.5, lat 25→49.5) and its hand-traced outlines, so only North-American trips inside that box draw correctly. Build 3 replaces both.
- LOD towns and interstate shields were dropped with the hand-placed sf-move data; only charger names fade in on zoom. They return with the real outline dataset.
- Footer reads `local` for the commit hash — it cannot carry its own commit's hash. Bump the version and date by hand on every commit.
- `build/` holds the assembly chunks used to compose index.html; it is gitignored and not needed again.

## Where things live
- State + change tracking + trip accessors: index.html:616–:745. Dates/geo/route model: :746–:850. Map + charging: :851–:990. Zoom/pan: :992–:1105. Trip hero + stops: :1109–:1300. Stats + progress strip: :1251–:1470. Pack: :1471–:1600. Spend: :1601–:1900. Sync: :1903–:2040. Trips list + Basics sheet + tabs + boot: :2043–:2185.
- New component CSS (Trips cards, status chips, empty state, Basics sheet) sits at the end of the stylesheet and measures only in the --s1…--s6 / --r / --r2 tokens added to :root.
- Test: tests/smoke.mjs — `npm install` then `npm test`. Screenshots land in shots/ (gitignored).

## Last session
Build 1 (local): copied sf-move v54 index.html + the two mockups, stripped Move/Sort/Export/migrations, re-rooted all state on `trips{}` + `activeTripId`, built the Trips list and Basics sheet, added the footer stamp, the placeholder icon, CLAUDE.md, .gitignore, package.json and a 36-assertion Playwright smoke test. One commit.

## Next
- Build 2 — import the SF trip as trip #1 (cloud session). `IMPORT_SF` from sf-move's STOPS/BACKUPS/WAYPTS/CHARGES/EXPENSES in final post-migration shape; one-time import when `trips` is empty; WAYPTS become the SF trip's per-leg `Stop.route`. Verify TOTAL_MI 2569, 6 charges through chg-006, Day 1 spend $302, progress 22.55%.
- Then Builds 3–7 per docs/milemarker-migration-plan.md (outlines + auto-fit projection, new-trip Stops/Review sheets, OSRM routing, Charge sheet + derived Spend, Pack templates).
- Idea logged, not built: the Trips list wants a Settings gear (sync, vehicle defaults, units) — the Sync card sits inline at the bottom of the list for now.
