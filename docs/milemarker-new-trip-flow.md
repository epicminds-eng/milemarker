# Mile Marker — new-trip flow v1 (Sep 7, 2026)

Five screens. Every one is a full-height sheet over the Trips list, iOS rows, one primary button pinned above the home indicator. Back chevron top-left keeps a draft (`trips[id].status:"draft"`) so a half-built trip survives a phone lock.

## 0 · Trips (launch)

Cards, newest first, Live trip pinned. Empty state (fresh install, before Build 2's import): one dashed card "No trips yet" + primary button **New trip**. Same button sits at the bottom of a populated list.

## 1 · Basics

| Row | Control | Rule |
|---|---|---|
| Name | text | required; placeholder "Michigan golf, Kane to Tahoe…" |
| Depart | date picker | required; becomes `departDate`, the single source for every date |
| Return | date picker | optional; blank = one-way (SF trip is one-way) |
| Vehicle | picker | defaults to `settings.defaultVehicleId` (Model Y, 270 Wh/mi EPA); "Add vehicle…" opens name + type (EV only today, Gas shown greyed "later") + Wh/mi |
| Trip type | chips, multi | Kane · Golf · Weekend · (none); drives Pack templates and the pet-fee planned rows |
| Budget | money | optional; blank = no budget bar until set from Spend |

Primary: **Next: stops**. Creates the trip object with `status:"draft"`, empty `stops`, `pack` seeded now (base list + chosen templates) so Pack is usable even if the route never gets finished.

## 2 · Stops

List starts with one row **Start** — defaults to the current GPS position reverse-geocoded, with a **Change** link that opens the same Stop sheet (lookup / coordinates / pick a saved place such as Home). Below it, rows for each stop; a dashed **+ Add stop** row at the bottom. Each row: drag handle · short name · overnight pill (☾ N nights) · one-line detail (hotel · pet fee) · leg miles with a `road` / `est.` / `manual` badge · chevron. Swipe left = delete.

**Reorder:** drag the ≡ handle (long-press on iOS; ▲▼ buttons inside the Stop sheet as the fallback). On drop, only the legs that changed re-route — the leg into the moved stop, the leg out of it, and the leg that now bridges the gap it left; all other legs keep their miles/polyline/`miSrc`. Same rule for **insert** (a small **+** sits on the separator between every pair of rows: tap → new Stop sheet pre-positioned there) and **delete** (the bridging leg re-routes). Days, hotel planned rows and pet-fee rows re-derive from the new order.

**Swap the town, keep the stop:** editing an existing stop's location (new lookup or coordinates) shows a one-time prompt — *Keep* (default) keeps the stop id, hotel fields, Arrived/Rolling stamps and every Spend row pointing at it; *Clear hotel + rows* blanks hotel/pet fee and deletes the planned rows (actuals are never deleted). Either way the two touching legs re-route. This is the Weatherford → Amarillo / St. Robert → Springfield case done in the UI instead of a migration.

**Backup stop:** any overnight stop can carry one backup (Stop sheet → Backup stop → same lookup). It renders as a dashed chip under the row and a hollow grey node on the map, never counts toward miles or days. **Promote** swaps it in as the real stop under the Keep rule above (the old town becomes the backup, so it's reversible in one tap).

Tapping a row or **+ Add stop** opens the **Stop sheet**:

| Row | Control | Rule |
|---|---|---|
| Search | text + Lookup button | Nominatim `search?format=json&limit=5&countrycodes=us,ca,mx`; results list as rows (display name); pick one → lat/lng + short name filled. 1 req/s, custom User-Agent header, no autocomplete-on-keystroke (their usage policy). |
| Manual | disclosure "Enter coordinates" | lat / lng numeric; also accepts a pasted "37.2440, -93.2718" Apple Maps string in one field |
| Short name | text | auto from lookup (town), editable; this is the map label |
| Overnight | toggle | on → hotel rows appear; advances the day counter |
| Hotel | text | name · address; **Paste Apple Maps link** button fills name/address/`mapsUrl` from a maps.apple.com URL |
| Hotel link | url | booking/confirmation link (Orbitz, email) — opens externally |
| Pet fee | money | shown only when trip type includes Kane; seeds a planned Spend row |
| Home stop | toggle | Mom's / Seychelle's style: no hotel rows, auto-arrive radius ~5 mi |
| Backup stop | lookup | optional alternate town; chip + hollow node; Promote swaps it in |
| Charger search | auto | `chargerQuery` = "Tesla Supercharger <town> <state>" generated, editable |

Primary: **Save stop**. On save the leg to the previous stop is routed:

- Online → OSRM `route/v1/driving/{lng,lat};{lng,lat}?overview=simplified&geometries=geojson` → `mi` (meters → mi, 1 dp) + polyline. Row shows "512 mi · road".
- Offline / OSRM error → great-circle × 1.25, row shows "~480 mi · est." in amber; the `est` badge persists until refreshed.
- Miles cell is tappable in every state → number field → `miSrc:"manual"`, never auto-overwritten.

Footer above the primary button: running total **"2,569 mi · 5 nights · 6 days"** recomputed on every change; day numbers derive from `departDate` + overnight count.

Primary: **Next: review**. Requires ≥ 2 stops (start + one).

## 3 · Review

Read-only, dashboard style: the route map hero (auto-fit projection, road lines where routed, straight + amber where estimated), then three KPI tiles — **Miles**, **Days**, **Est. charging $** (miles × vehicle Wh/mi × settings default $/kWh, 0.38 until the first real charge). Below, the stop list as compact rows. Any row taps back into its sheet. A **Refresh est. legs** link appears if any leg is `est` and the app is online.

Primary: **Create trip** → `status:"planning"`, sync push, opens the trip on the Trip tab.

## 4 · First-run state inside the trip

- **Trip tab:** map + stops, no progress yet (strip shows 0 mi, Day 1 date), Rolling button armed on Start, all stats cards render "—", charging row reads "No charges logged · Log a charge".
- **Pack tab:** base "always" list + template sections (each collapsible, ordered base → types), everything unpacked; "Before I leave" card at top, empty custom section with **+ Add item** and "Save to template" on each added item.
- **Spend tab:** planned rows auto-seeded from stops — one hotel row per overnight stop (amount blank → "set" until you type it, or the hotel field's price if entered), one pet-fee row per overnight when Kane is on, one **Charging (est.)** projected line from the Review tile; budget bar only if a budget was set.
- **Trips list:** the new card reads "Planning · Sep 20–25 · 2,569 mi · 6 days · $—".
- Status flips to **Live** on the first Rolling stamp and **Done** when the last stop is marked Arrived; both can be forced from the trip's ⋯ menu (Edit trip · Duplicate as template · Archive · Delete).

## What is NOT in the flow (deliberately)

- No route optimisation; reorder/insert/delete only re-run the affected legs.
- Mockups: `design/milemarker-stops-mockup.html` (list + Stop sheet with the swap prompt) and `design/milemarker-review-mockup.html`. Screens 1 and 4 have none.
- No hotel search inside the app — paste a link.
- No per-stop dates; days are derived. A multi-night stop = `nights:2` on the stop (Stop sheet stepper, shown only when overnight is on).
