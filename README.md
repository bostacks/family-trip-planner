# Asia Trip 2026 — Planner

Mobile-first, **fully static** trip planner for the June–July 2026 Tokyo → Osaka → Seoul → Beijing trip.
No build step, no server, no API keys — runs straight from `public/` and deploys to GitHub Pages.

## What it does
- **Itinerary view** — day cards by city; tap a day to open it. Filter by city from the top chips.
- **Calendar day view** — a timeline with real times; drag activities (⠿ handle) between time blocks, set exact times, lock in plans, and page **Previous / Next day**.
- **Flights & airport buffers** — real flight legs (times, terminals, seats, confirmations) sit on the calendar, each preceded by a 🧳 checkout + travel-to-airport block.
- **🚇 Getting around** — a per-city transit primer (how the subway works, how to get a Suica/ICOCA/T-money/transit-QR pass), plus a **Transit from <previous stop>** directions link on each activity.
- **✨ Suggest** — curated, pre-researched activity & restaurant picks per city (family of 5, kids 12/10/7), each with a description, **official/booking & map links**, and a **scrollable photo gallery** (tap a photo for a full-screen swipe-through lightbox).
- **🎟️ Booking links** — reservation/ticket notes ("Reserve seats", "Ticket at door/online", …) link straight out to book.
- **Map** — Leaflet/OpenStreetMap (no key); clay pins = locked, taupe = tentative, ink = hotels. Directions hand off to Google Maps (transit).
- **Installable** — add to your phone's home screen (PWA manifest) for a full-screen app. Saves on-device (localStorage); **↺ Reset** restores the original plan.

## Run locally
It's static — open `public/index.html` directly, or serve the folder any way you like:
```bash
cd trip-planner
python3 -m http.server -d public 8080   # → http://localhost:8080
# or: npm start   (the included zero-dependency Node server in server.js)
```
No install, no API key. To refresh the curated picks, open the project in Claude Code and ask it to "refresh the recommendations."

## Access
The app is behind a simple password gate (`public/auth.js`). Only the **SHA-256 hash** of the
password is stored — never the plaintext. It's a soft gate for a public static site (it keeps
casual visitors out, not a determined one), which is why all genuinely private data (booking
confirmation codes, seat numbers) has been removed from the app entirely.

## Cloud sync (optional — share one live plan)
By default the plan is saved per-device in `localStorage` (no sync). To share **one
live plan** across every device/traveller, set up a free Supabase project (~5 min):

1. Create a project at <https://supabase.com>.
2. In the **SQL editor**, run:
   ```sql
   create table trips (
     id text primary key,
     data jsonb,
     updated_at timestamptz default now(),
     editor text
   );
   alter table trips enable row level security;
   create policy "anon all" on trips for all to anon using (true) with check (true);
   alter publication supabase_realtime add table trips;
   ```
3. **Settings → API**: copy the **Project URL** and the public **anon key** into
   `public/cloud-config.js` (the anon key is meant to be public — safe to commit).
4. Commit + push. Everyone who opens the site now shares the same plan
   (`tripId`), with edits syncing in near-real-time (last-write-wins per save).

A small **☁ Shared** badge appears in the header when sync is active. Note: anon
read/write is open (fine for a family trip behind the password gate, not real
security) — that's why private booking data was removed from the app.

## Deploy (GitHub Pages)
Already wired: `.github/workflows/pages.yml` publishes `public/` to Pages on every push to `main`.
One-time: in the repo, **Settings → Pages → Source: GitHub Actions**. Site goes live at
`https://<user>.github.io/family-trip-planner/`.

## Notes
- Images load live (embedded, not downloaded) from **Openverse** (keyless) and cache to localStorage.
- Seed itinerary, flights and the transit primer live in `public/data.js`; curated recs in `public/recommendations.js`.
- `server.js` (+ its legacy `POST /api/recommend`) is only for optional local dev — the deployed app is 100% static.
