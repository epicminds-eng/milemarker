# Mile Marker — ports from sf-move (Sep 10, 2026)

Source: epicminds-eng/sf-move, main 0d8b246 (v107). Build 2.1's seed refresh takes STOPS/BACKUPS/WAYPTS/CHARGES/EXPENSES from v107. Lift the code from the named commits; never re-derive. Each item names the build that carries it.

| # | Port | sf-move commit | Mile Marker build | Rule |
|---|---|---|---|---|
| 1 | Time-zone-aware timing: Stop.tz (IANA), zonedToEpoch() via Intl, rolled read in the previous stop's zone / arrived in its own, charges take tz from their address state, chgWall() for display. Port test/trip-time.test.js. | a750b1a | 2.2 | Every trip crosses zones; door-to-door never depends on the phone's zone. New-trip flow fills tz from the geocoder (address → state → zone table), editable in the Stop sheet. |
| 2 | Sub-tab drives the map frame: frameMapFor()/fitPts() — Overview·Charging·Itinerary·Hotels = full-route reset; Daily = that day's leg + chargers; Places = that day's places. Layer toggles never re-frame. Port test/trip-map.test.js. | aaf8e17 | 3 | Decided Sep 10: Mile Marker adopts the Trip segmented control (#tripSeg) in Build 3. |
| 3 | Map popups: popPill(href, name, meta) — whole pill is the Apple Maps link, two lines, no "Open in". | aaf8e17 | 3 | Never let a line-height:0 map container leak into overlays. |
| 4 | Link wording rule (CLAUDE.md). | aaf8e17 | 2.1 | grep gate returns nothing. |
| 5 | No tildes in rendered text. | aaf8e17 | 2.1 rule · 2.2 sweep | |
| 6 | Charger-day picker: "Trip · every logged session" first and default. | aaf8e17 | 2.2 | stats.chgDay |
| 7 | Stat rows: one line, no ellipsis, whole-dollar money, four equal bottom-aligned columns. Map layer control = full-width frosted bar flush at the map's bottom edge. | 542ed6c | rows 2.2 · bar 3 | |
| 8 | Lifetime charging = single source: lifeRows() feeds lifeClusters() and lifeSummary(); LIFETIME + non-planned CHARGES, de-duped on date+time; VB_LIFE crops; caches keyed on CHARGES length + last id; LIFETIME never written; trip totals CHARGES-only. Mile Marker: lifetime at the root, a trip = date-range filter, auto-updated from the car. | c09a2d2 (v106) | 6.5 | Data source TBD: Tesla Fleet API vs Tessie/TeslaFi. data/*.json + scheduled Action inlining at build. |
| 9 | Footer = era + build: "Mile Marker 1.0 · bN · Mon D"; bN +1 every commit; era only on instruction. | pending in sf-move | 3 onward | |
| 10 | Charger clusters merge by identical address only, never by proximity. | open in sf-move | 3 and 6 | |
| 11 | Wide (≥768) column follows the sub-tab: Overview = route list; Daily/Charging/Places/Hotels/Itinerary = 3-number strip + one-line list; todayFigures() shared with the strip under the map; test asserts strip == section cell for cell; Itinerary rows lead with destination. Port the pattern, not SF data. | 0d8b246 (v107) | 3 | |

Build order: 2.1 seed refresh + disp + rules · 2.2 ports #1 #5 #6 #7a · 3 outlines + auto-fit + segmented control + #2 #3 #7b #9 #10 #11 · 4–5 new-trip flow, routing · 6 charge sheet · 6.5 lifetime (#8) · 7–10 pack templates, sync adapter, PWA, polish.
