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
- **Backend:** `server.js` — zero-dependency Node (built-in `http`), serves `public/` and one API route.
  - `POST /api/recommend` → calls the Anthropic Messages API with the `web_search_20250305`
    tool for live research. Context-aware: receives city, date, slot, locked-in activity names,
    hotel location, and a restaurants flag. Returns `{ options:[...], usedAI, note? }`.
    Gracefully returns a note (not an error) when `ANTHROPIC_API_KEY` is absent.
  - `GET /api/health` → `{ ok, ai }`.
- **Frontend:** `public/` (vanilla JS, no build step)
  - `index.html` — shell; loads Leaflet from CDN.
  - `data.js` — seed itinerary with coordinates (`window.SEED_TRIP`).
  - `app.js` — views (Itinerary / Day / Map), localStorage persistence, recommend sheet, map.
  - `styles.css` — mobile-first styling.
- **Map:** Leaflet + OpenStreetMap tiles (no API key). Green pins = locked, purple = tentative, dark = hotels.
- **Directions:** uses browser geolocation to draw route + distance, with a hand-off link to Google Maps (transit mode).
- **Persistence:** localStorage on-device. (Cloud sync across the 5 travellers is a planned upgrade.)
- **Geocoding:** AI-added stops are geocoded client-side via Nominatim so they appear on the map.

## Run
```bash
node server.js                          # http://localhost:8080 (AI off, everything else works)
ANTHROPIC_API_KEY=sk-ant-... node server.js   # with live recommendations
```
No `npm install` needed — there are no runtime dependencies.

Env: `ANTHROPIC_API_KEY` (required for recs), `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`), `PORT` (default 8080).

## Deploy (fly.io)
`Dockerfile` + `fly.toml` are ready (region `nrt` = Tokyo).
```bash
fly launch --no-deploy
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```

## Open TODOs / next steps
1. **Auto-load `.env`** so the key doesn't need to be typed each run (small loader in `server.js`).
2. **Deploy to fly.io** for real phone access (user's primary goal).
3. **Cloud sync** — replace localStorage with a small backend store/DB so all 5 travellers share one plan (chosen as a later upgrade; on-device for now).
4. Optional: swap the schematic/Leaflet map for an embedded provider with richer tiles if a Maps key is added.
5. Optional: per-day transit/timing fields and a printable export.

## Conventions
- Keep the backend dependency-free (built-in modules only) unless there's a strong reason.
- No build step on the frontend; plain ES + Leaflet via CDN.
- Round any user-facing numbers; keep the UI mobile-first.
