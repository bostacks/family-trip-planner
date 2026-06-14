# Asia Trip 2026 — Planner

Mobile-first trip planner for the June–July 2026 Tokyo → Osaka → Seoul → Beijing trip.

## What it does
- **Itinerary view** — day cards by city; tap a day to open it.
- **Day blocks** — Morning / Midday / Afternoon / Evening. Lock in the plans you've committed to, add or delete others.
- **✨ Recommend options** — live AI research (Anthropic + web search) suggests activities or restaurants for that slot, aware of what you've already locked in and your hotel location. Tap **＋ Add** to drop one into the day.
- **Embedded map** — Leaflet/OpenStreetMap (no API key) with pins for hotels and stops. Green = locked, purple = tentative.
- **Directions** — uses your phone's location to draw the route and distance, with a one-tap "open turn-by-turn" hand-off to Google Maps (transit mode).
- **Saves on-device** — everything persists in your browser (localStorage). Use **↺ Reset** to restore the original plan.

## Run locally
```bash
cd trip-planner
npm install
cp .env.example .env      # then paste your ANTHROPIC_API_KEY
npm start                 # http://localhost:8080
```
Without a key the app runs fine — only the live "Recommend options" needs it (it shows a note explaining how to enable it).

## Deploy to fly.io (later)
```bash
fly launch --no-deploy        # accepts the included fly.toml
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```
`primary_region` is set to `nrt` (Tokyo). The app listens on `PORT` (8080).

## Notes
- Recommendation engine: `POST /api/recommend` in `server.js`, model configurable via `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`).
- Seed itinerary + coordinates live in `public/data.js`.
- Geocoding of AI-added stops uses the free Nominatim service.
