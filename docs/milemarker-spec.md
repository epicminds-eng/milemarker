# Mile Marker — product spec v1 (Sep 7, 2026)

Personal road-trip PWA. Single self-contained `index.html`, GitHub Pages under epicminds-eng, repo `~/Developer/milemarker`. Built from a copy of sf-move (v50, main e4c94dd). sf-move is never touched.

## Screens

| Screen | Does |
|---|---|
| **Trips** (launch) | Card per trip: name · dates · status chip (Planning / Live / Done) · one-line stat (mi · days · $). Live trip pinned top, past trips below, `+ New trip` at bottom. Tap = open; every other screen is scoped to that trip. Settings gear here (sync, vehicle defaults, units). |
| **Trip** | Route map (offline outlines, auto-fit to the trip's bbox; optional online tiles), stops list with hotel link + Arrived/Rolling stamps, live tracking dot, progress strip, charging row, stats dashboard (the seven cards from sf-move v50). |
| **Pack** | Base "always" list + template items + per-trip items; packed toggles; "Before I leave" checklist; "Save to template" on any added item. |
| **Spend** | Planned/actual entries per day, projection, budget bar, categories; charges appear automatically; paste import. |
| **Charge** | Lives inside Trip (row under mileage, as today) + a "Log a charge" form: location from GPS or pick a stop, kWh, $/kWh, minutes → one entry drives map node, charging row, stats, and a Spend row. Paste-import block as backup. |

Tab bar: **Trip · Pack · Spend** + a back chevron to Trips. (Charge is a sheet, not a tab.)

## Data model (localStorage `mileMarker_v1`, one object)

```
settings   { units:"mi", currency:"USD", vehicles:[…], defaultVehicleId, mapMode:"offline"|"online" }
templates  { base:[item], byType:{ golf:[item], kane:[item], weekend:[item] } }   item = {id, t, group}
trips      { [tripId]: Trip }
meta       { touched:{path:ms}, stamped }          ← sync change-tracking, as today
```

```
Trip      { id, name, status, departDate, endDate, vehicle:{type:"ev", name, kwhPerMi, epaWhMi}, types:["kane"],
            stops:[Stop], waypts:[{lat,lng,n}], charges:[Charge], expenses:[Expense], spend:{entries:[Entry], budget, dismissed:{}},
            pack:{items:[item], packed:{}, beforeLeave:[item], collapsed:{}},
            log:{ arrived:{stopId:bool}, arrivedAt:{stopId:"YYYY-MM-DDTHH:MM"}, rolled:{…} },
            ui:{ tracking, openDay }  ← per-device, never synced }
Stop      { id, name, short, lat, lng, mi, miSrc:"osrm"|"est"|"manual", route:[[lat,lng]…], overnight:bool, nights:1, hotel, hotelUrl, mapsUrl, petFee, chargerQuery, home:bool,
            backup?:{ name, short, lat, lng, chargerQuery } }   ← backup never counts toward miles/days; Promote swaps it with the stop (id kept)
Charge    { id, name, addr, lat, lng, date, time, kwh, rate, cost, min, stopId?, planned?:bool }
Expense   { id, cat, amount, note, date, time }           ← import path only (sf-move EXPENSES)
Entry     { id, amount, cat, note, day, stopId, ts, planned, billsLater, srcId? }   cats: charging hotel groceries kane food tolls parking misc
```

Rules: leg miles + route line come from OSRM (`router.project-osrm.org`, free, no key) whenever online — real road-following polyline stored as `Stop.route:[[lat,lng]…]` and `Stop.mi`, `Stop.miSrc:"osrm"`. Offline: `mi` = great-circle × 1.25, `miSrc:"est"`, line drawn straight; the next time the app is online with an `est` leg it offers "Refresh route". `mi` is always hand-editable (`miSrc:"manual"`, never overwritten). App sums (TOTAL_MI, CUM). Days derive from `departDate` + stop order (overnight stops advance the day). A charge with `planned:true` is hollow on the map, no Spend row. Deleting an auto-seeded Spend row records `spend.dismissed[srcId]` so it never returns.

## Sync adapter boundary

`Sync = { configure(cfg), push(snapshot), pull() → {snapshot, etag} }` — that is the whole surface. Merge (per-leaf newest-stamp-wins, tombstones, offline queue, backoff) stays in the app, above the adapter. `GistAdapter` implements it against ONE new secret gist, file `milemarker-sync.json` `{state, device, savedAt}`. Replacing Gist with Firebase/Supabase = write a second adapter with the same three functions; nothing else moves. Gist ID/token/device stay in a separate key `mileMarkerSync`, never merged, never the sf-move gist.

## Map

sf-move draws one fixed box (lng −125.5→−84.5, lat 25→49.5) with hand-traced outlines — it does not generalise. Mile Marker inlines a simplified North America outline set (US states + CA provinces + MX states, ~150–250 KB of coordinates) and projects into whatever bbox the trip's stops + waypoints span (padding, near-square hero). Online mode swaps the outline layer for tiles; everything above it (route, nodes, LOD labels, zoom/pan) is the same SVG. Stop coordinates come from Nominatim (address/town → lat/lng) with a manual lat/lng fallback; waypoints are optional and manual.

## From sf-move: generic vs SF-specific

**Carries over (generic, mostly verbatim):** app shell + tabs + scroll memory; iOS row/card CSS; Trip map SVG machinery (zoomLayer, pinch/pan springs, LOD, live tracking, counter-scaled labels); progress strip; stats dashboard (renderStats + dayStats/tripStats); Spend (entries, per-day forms, projection, budget, categories, paste import, URL ingest); Pack renderer + Before-I-leave; charging row + seed-by-id logic; change-tracking + merge + queue; iPad ≥700px layout.

**Rewritten:** state root (trip-scoped, `trips[id]`); every renderer takes the active trip; STOPS/BACKUPS/WAYPTS/CHARGES/EXPENSES become data in the trip object, not code constants; map projection + outlines; the Gist module split into adapter + merge; Spend seed = derived from stops (hotel/pet rows per overnight) instead of hard-coded seed-h2…; Pack items = templates + trip items instead of car/ship/joey lists.

**Removed (SF-specific):** Move tab (7 phases, Reference, EXTRA blocks, custom tasks), Sort tab (116 items, tags, tally tiles), Export app data card (replaced by per-trip export later), every dated migration (`dateMigratedV1/V2`, `day2AmarilloV1`, `day1PetV1`, `day1HotelV1`, `arrivedAtV1`, `rolledV1`, retired-stop resets), Joey/USPS/SF address copy, car/ship/joey packing groups, Orbitz date derivation, Wallet Shortcut recipe.

## Doesn't translate — flagged

1. **Outlines.** Hand-traced paths are worthless outside the SF corridor; a real coordinate dataset is required → the largest single new piece and the biggest file-size jump.
2. **Route line.** sf-move's road-following line is hand-placed WAYPTS. Mile Marker replaces WAYPTS with the OSRM polyline per leg (decided Sep 7); straight lines only when a leg was created offline and not yet refreshed. Manual waypoints stay as an optional nudge.
3. **Progress-bar mockup.** `design/sf-move-progress-bar-mockup.html` does not exist in the repo; assumed = the progress strip as built in index.html.
4. **PWA.** sf-move has no manifest or service worker (Apple meta tags only). Mile Marker ships `manifest.webmanifest` + `sw.js` (cache-first for index.html + icon; the outline data is inlined in index.html so it is cached with the shell; OSRM/Nominatim/tiles are network-only, never cached). Decided Sep 7.
5. **Migrations.** None carry; the SF trip's already-migrated final state is imported as data in Build 2.
6. **Efficiency stats** assume an EPA Wh/mi constant → moves to `vehicle.epaWhMi`.
