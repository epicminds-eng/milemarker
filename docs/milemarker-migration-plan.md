# Mile Marker — migration plan from sf-move (Sep 7, 2026)

Source: sf-move v54, main 4b176c2, index.html 2,797 lines (line refs below re-checked against it Sep 7 evening). Target: `~/Developer/milemarker`, GitHub `epicminds-eng/milemarker`, Pages at epicminds-eng.github.io/milemarker. One Claude Code session and one verified commit per build; nothing layers on an unverified build. sf-move is read, never written.

## Carries over verbatim (copy, rename keys only)

| Piece | sf-move lines | Notes |
|---|---|---|
| App shell: `#scroll`, fixed nav, per-tab scroll memory, ≥700px layout | :468, :664, :343 + :454, :2597 | tabs become Trip · Pack · Spend + back chevron |
| iOS row / card / chip CSS, Spend colours, stats `.stx` styles | stylesheet | tokens unchanged |
| Map machinery: zoomLayer, pinch/pan springs, LOD, counter-scaled labels, live dot, `locate`, `updateTripMap` | :559, :1666, :1775–:1827 | projection call sites swap to the auto-fit `proj` |
| Progress strip card `#tripProg` (`routePos`, `renderTripProg`) + Rolling/Arrived stamps (`stampRow`) | :624, :2220–:2292, :2042 | reads `trip.log.*`; flag spend figure via `spendProj` |
| Stats dashboard: `dayStats` / `tripStats` / `stS` / `renderStats` + all eight live controls | :2074–:2220 | EPA constant → `vehicle.epaWhMi`; `state.stats` → `trip.stats` |
| Charging row + Apple Maps links | :1844 | reads `trip.charges` |
| Spend: entries, per-day forms, `spendProj` (single source for hero + strip), budget bar, `CATS`, paste import + merchant table, `?add=` ingest, `seedCharges`/`seedExpenses` by id | :2335–:2546 | `seedSpend` replaced (below) |
| Pack renderer, circle-only toggle, Before-I-leave | :1355, :1400 | item source changes |
| Change tracking: `leaves` / `setLeaf` / `commit` / tombstones / `ID_ARRAY` | :970–:1010 | `ID_ARRAY` gains `trips.<id>.stops`, `.charges`, `.spend.entries`, `.pack.items` |
| Merge + offline queue + backoff + ETag pull | :2601–:2700 (`mergeRemote` :2656) | moves above the adapter, calls `Sync.push/pull` |

## Rewritten

| Piece | Why |
|---|---|
| State root → `{settings, templates, trips:{id:Trip}, meta}`; `activeTripId` per device | many trips |
| Every renderer takes `T = trips[activeTripId]` instead of globals `STOPS/CHARGES/EXPENSES/WAYPTS/BACKUPS` | data, not code |
| `proj(lat,lng)` → fit to bbox of stops + routes + backups, padded, aspect 380/300 | any geography |
| Outline layer → inlined simplified GeoJSON (US + CA + MX), drawn through `proj` (:1646 today) | replaces the hand-traced paths inside `#zoomLayer` |
| Route line → per-leg `Stop.route` polyline (OSRM) or straight segment | replaces WAYPTS |
| `seedSpend` → derived: hotel + pet-fee planned rows per overnight, charging projection line | replaces seed-h2…seed-p3 |
| Pack source → `templates.base` + `templates.byType[...]` + `trip.pack.items` | replaces car/ship/joey |
| Gist module → `GistAdapter {configure, push, pull}` | swap-able backend |
| Trips list, New-trip flow (4 sheets), Stop sheet, Charge sheet, Settings | new screens |
| `manifest.webmanifest` + `sw.js` | real offline |

## Removed
Move tab (renderMove :1110) + Reference + EXTRA + custom tasks · Sort tab (renderSort :1189) · Export card · all dated migrations (`arrivedAtV1`, `rolledV1`, `dateMigratedV1/V2`, `day2AmarilloV1`, `day1PetV1`, `day1HotelV1`, retired-stop resets, "both"→"undecided") · Joey/USPS/SF address copy · Orbitz date derivation · Wallet Shortcut recipe · `sfMoveApp_v1` / `sfMoveSync` keys.

## Build order — one session, one commit, verify on device before the next

| # | Build | Verified by |
|---|---|---|
| 1 | **Scaffold.** Copy sf-move → milemarker; strip Move/Sort/Export/migrations; introduce `trips{}` + `activeTripId`; Trips list with cards + empty state; all renderers trip-scoped; new keys; footer version stamp; Playwright smoke test file in repo; HANDOFF.md, CLAUDE.md, docs/, design/. App runs with zero trips. | Playwright headless: loads, Trips empty state, tabs render with a fixture trip injected via localStorage |
| 2 | **Import the SF trip as trip #1.** `IMPORT_SF` object = STOPS/BACKUPS/WAYPTS/CHARGES/EXPENSES + planned seeds, final post-migration shape; one-time import on first run when `trips` is empty; `waypts` become the SF trip's `route` polylines; stats/charging/Spend match sf-move v50 numbers. | Playwright: TOTAL_MI 2569, every CHARGES/EXPENSES row present as of the import day (6 charges through chg-006 Joplin at v54 — re-count at build time), Day 1 spend $302, progress strip 22.55% with Springfield passed, stats cards non-"—"; then on iPhone |
| 3 | **Outlines + auto-fit projection.** Inline simplified NA GeoJSON, `proj` fit to bbox, SF trip still looks like sf-move's map, a fixture Tahoe trip renders CA/NV. | Playwright screenshots of both trips; on iPhone pinch/pan |
| 4 | **New-trip flow.** Basics → Stops (Nominatim lookup, coordinates, overnight/nights, hotel, pet fee, home, backup) → Review → Create. Manual miles; straight legs. | Playwright: create a 4-stop trip end-to-end from fixtures (Nominatim mocked); on iPhone with real lookup |
| 5 | **Routing.** OSRM per leg, `miSrc`, est. fallback ×1.25, Refresh est. legs, reorder/insert/delete re-routing, swap-town Keep/Clear prompt, backup Promote. | Playwright with OSRM mocked + offline mode; on iPhone with signal |
| 6 | **Charge sheet + Spend derivation.** Log a charge (GPS or stop), paste import, planned rows derived from stops, charging projection. | Playwright: log 2 charges → map nodes, row, Spend; on iPhone |
| 7 | **Pack templates.** Base list seeded from SF trip, type templates, Save to template, per-trip items. | Playwright + iPhone |
| 8 | **Sync adapter.** Extract `GistAdapter`, new gist + PAT, `mileMarkerSync` key, `trips` in `ID_ARRAY`. | Mock api.github.com in Playwright; then iPhone + iPad against the real gist |
| 9 | **PWA.** manifest, sw.js cache-first shell, green mile-sign icon, install on iPhone + iPad, offline launch. | On device: airplane mode launch |
| 10 | **Polish + Trips list stats / Done state / archive.** | On device |

Builds 3–7 can be reordered; 1 → 2 is fixed. Build 8 before any real multi-device use; Build 9 before relying on offline maps.

## Repo layout after Build 1

```text
~/Developer/milemarker/
├── index.html                 single-file app (footer: "Mile Marker v1 · <commit date>")
├── manifest.webmanifest       (Build 9)
├── sw.js                      (Build 9)
├── mm-icon.png                green mile-sign, 512×512 (placeholder in Build 1)
├── CLAUDE.md                  handoff rule + repo law
├── HANDOFF.md                 ≤40 lines, rewritten before every commit
├── docs/
│   ├── milemarker-spec.md
│   ├── milemarker-new-trip-flow.md
│   └── milemarker-migration-plan.md
├── design/
│   ├── milemarker-stops-mockup.html
│   ├── milemarker-review-mockup.html
│   ├── sf-move-stats-dashboard-mockup.html   (copied from sf-move as the card/KPI reference)
│   └── sf-move-spend-mockup.html
└── tests/
    └── smoke.spec.mjs         Playwright, re-runnable: node tests/smoke.spec.mjs
```
