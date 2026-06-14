# Asia Trip 2026 — Planner (project context)

This file gives Claude Code the full context for this project. Read it first.

## What this is
A mobile-first web app to plan and customize a 4-city family trip across Asia (June–July 2026).
It ships with the itinerary preloaded and lets the family lock in plans, get live AI
recommendations (activities + restaurants), and navigate via an embedded map.

## The trip
- **Party:** 2 adults + 3 kids (ages 12, 10, 7).
- **Style preference:** one main activity per day to avoid overtiring, with optional secondary
  add-ons nearby. Balanced mix of adult landmarks and kid fun.
- **Flights:** Depart Vancouver (YVR) Thu Jun 18, 4:45pm on ANA NH115 → arrive Tokyo Haneda
  (HND) Fri Jun 19, 7:00pm (crosses date line; Jun 19 is arrival-only, no sightseeing).
- **Hotels:**
  - Tokyo (Jun 19–23): Mimaru Suites Tokyo Nihombashi
  - Osaka (Jun 23–25): Imperial Hotel Osaka
  - Seoul (Jun 25–28): Uh Suite The Seoul, 211 Mallijae-ro, Jung-gu
  - Beijing (Jun 28–Jul 2): Grand Hyatt Beijing (Wangfujing)

## Finalized itinerary (one main activity/day + secondary options)
| Date | City | Main activity | Secondary options |
|---|---|---|---|
| Thu Jun 18 | Transit | Depart YVR 4:45pm (NH115) | — |
| Fri Jun 19 | Tokyo | Arrive HND 7:00pm (arrival only) | Dinner near Nihombashi |
| Sat Jun 20 | Tokyo | Imperial Palace East Gardens | Kitanomaru Park, Marunouchi |
| Sun Jun 21 | Tokyo | teamLab Planets — BOOKED 12:00–12:30 | Toyosu Market, Odaiba + Gundam |
| Mon Jun 22 | Tokyo | Senso-ji + Tokyo Skytree | Nakamise St, Sumida Aquarium |
| Tue Jun 23 | Osaka | Shinkansen + Osaka Castle | Dōtonbori, Shinsaibashi |
| Wed Jun 24 | Osaka | Universal Studios Japan | Universal CityWalk |
| Thu Jun 25 | Seoul | Fly to Seoul + Myeongdong | Namdaemun, Myeongdong Cathedral |
| Fri Jun 26 | Seoul | Gyeongbokgung Palace | Bukchon Hanok Village, Insadong |
| Sat Jun 27 | Seoul | Lotte World | Seoul Sky (Lotte Tower), aquarium |
| Sun Jun 28 | Beijing | Fly to Beijing + Wangfujing | Tiananmen at night |
| Mon Jun 29 | Beijing | Great Wall (Mutianyu) | Huairou lunch |
| Tue Jun 30 | Beijing | Forbidden City | Jingshan viewpoint, Tiananmen Square |
| Wed Jul 1 | Beijing | Summer Palace | Kunming Lake boat, Houhai/hutong |
| Thu Jul 2 | Transit | Depart Beijing | — |

## Booking action items (real-world, time-sensitive)
- **teamLab Planets:** already booked, Sun Jun 21, 12:00–12:30 entry.
- **Universal Studios Japan (Jun 24):** no gate sales — buy Studio Pass + Express Pass online ASAP (Klook/official); Express Passes sell out.
- **Forbidden City (Jun 30):** passport real-name reservation opens exactly 7 days ahead — Jun 23, 8pm Beijing time. Closed Mondays (Jun 30 is Tue, OK). Morning session.
- **Summer Palace (Jul 1):** same passport-reservation system, opens Jun 24.
- **Great Wall Mutianyu (Jun 29):** arrange transport (private car/driver or Klook shared van, ~1.5 hrs each way) + chairlift-up/toboggan-down combo ticket (~¥140).
- **Gyeongbokgung (Jun 26):** ₩3,000 or free in hanbok; Changing of the Guard 10am & 2pm (not Tuesdays).

## Architecture
- **Recommendations are STATIC and baked in** — no API key needed. The ✨ Recommend
  sheet reads `public/recommendations.js` (`window.SEED_RECS`), pre-researched curated
  options per city. See "Regenerating recommendations" below.
- **Backend:** `server.js` — zero-dependency Node (built-in `http`), serves `public/`.
  - `GET /api/health` → `{ ok, ai }`.
  - `POST /api/recommend` → legacy live-AI path (Anthropic Messages API + `web_search_20250305`).
    **No longer used by the frontend** (kept as an optional fallback). Needs `ANTHROPIC_API_KEY`;
    returns a note instead of erroring when absent.
- **Frontend:** `public/` (vanilla JS, no build step)
  - `index.html` — shell; loads Fraunces+Inter and Leaflet from CDN, then `data.js`, `recommendations.js`, `app.js`.
  - `data.js` — seed itinerary with coordinates (`window.SEED_TRIP`) + `window.CITY_TRANSIT`
    (per-city transit primer: system, how to get a pass, tips). Real flights are seed events with
    `start`/`dur` minutes (incl. cross-timezone legs where `dur` is the clock-delta so the end label
    matches the ticket); each flight is preceded by a 🧳 checkout/travel-to-airport buffer event.
    Bumping `LS_KEY` (`app.js`) forces a reload of the seed over saved localStorage.
  - `recommendations.js` — static curated recs (`window.SEED_RECS`), keyed by city → `{ todo, food }`
    (~74 options total, ~9–11 per list). Each: `name, type, area, why, rating, price, booking, url?, lat, lng, mapsQuery`.
  - `app.js` — hash router + breadcrumbs, views (Itinerary / Day / Map), localStorage, recommend sheet, media galleries, map.
  - `styles.css` — paper-minimalist theme (warm paper surfaces, hairlines, serif display, single clay accent, faint grain).
- **Day view = calendar.** `renderDay()` lays items on a per-part-of-day timeline (`computeSchedule()` assigns
  times from each slot's base time + a 15-min gap; honours an explicit `it.start`). Each event shows a time rail
  + card; the "Time" action edits the start time. Part-of-day base times in `SLOT_BASE`, durations in `DUR_BY_TYPE`.
  - **Drag-to-reschedule:** each event has a ⠿ handle; pointer-based drag (`onDragDown/Move/Up` + `moveItem()`,
    works on touch + mouse) moves it to another slot/position, then times reflow from that slot's base
    (an explicit `it.start` is cleared on drop). Transit items aren't draggable.
- **Image lightbox.** Tapping any gallery photo opens a full-screen swipe/scroll-through viewer
  (`openLightbox()`, `#lightbox`), opening at the tapped image with a `N / total` counter, arrows (desktop),
  Esc/←/→ keys, and backdrop-to-close.
- **Routing & breadcrumbs.** `location.hash` is the single source of truth (`#`/`itinerary`, `map`, `<dayId>`).
  `navigate()` pushes history → `hashchange` → `route()` renders, so browser Back/Forward and the `#crumbs` bar stay in sync.
- **Media galleries.** Each recommendation/event shows a horizontally-scrollable photo strip + a YouTube-search
  "Videos" tile. Images are pulled live (embedded, never downloaded) from **Openverse** (keyless, CORS, CC images),
  lazy-loaded via `IntersectionObserver`, and cached in memory + `localStorage` (`asia-trip-img-v1`) so each query
  is fetched once and revisits work offline.
- **Map:** Leaflet + OpenStreetMap tiles (no API key). Clay pins = locked, taupe = tentative, ink = hotels.
- **Directions:** uses browser geolocation to draw route + distance, with a hand-off link to Google Maps (transit mode).
- **Persistence:** localStorage on-device. (Cloud sync across the 5 travellers is a planned upgrade.)
- **Geocoding:** coordinates are baked into `SEED_RECS`; any stop missing one is geocoded client-side via Nominatim.

## Run
```bash
node server.js         # http://localhost:8080 — fully functional, NO API key needed
```
No `npm install`, no key, no `.env` required — recommendations are baked into
`recommendations.js`. (`server.js` still has a built-in `.env` loader for the legacy
live-AI route; a real `process.env` value overrides the file.)

## Regenerating recommendations
The curated recs in `public/recommendations.js` are static. To refresh them, open this
project in Claude Code and say "refresh the recommendations." Claude re-runs the web
research (family of 5, kids 12/10/7, one main activity/day, near each hotel) and rewrites
`recommendations.js` — including `lat`/`lng` (instant map pins) and `url` (official/booking
page; otherwise the app builds a Google Maps search link from `mapsQuery`). No key needed;
the research runs through Claude Code's own tools, not the app's API route.

Env: `ANTHROPIC_API_KEY` (required for recs), `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`), `PORT` (default 8080).

## Deploy (fly.io)
`Dockerfile` + `fly.toml` are ready (region `nrt` = Tokyo).
```bash
fly launch --no-deploy
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```

## Open TODOs / next steps
1. ~~**Auto-load `.env`**~~ — done (`loadEnv()` in `server.js`).
2. **Deploy to fly.io** for real phone access (user's primary goal).
3. **Cloud sync** — replace localStorage with a small backend store/DB so all 5 travellers share one plan (chosen as a later upgrade; on-device for now).
4. Optional: swap the schematic/Leaflet map for an embedded provider with richer tiles if a Maps key is added.
5. Optional: per-day transit/timing fields and a printable export.

## Conventions
- Keep the backend dependency-free (built-in modules only) unless there's a strong reason.
- No build step on the frontend; plain ES + Leaflet via CDN.
- Round any user-facing numbers; keep the UI mobile-first.
