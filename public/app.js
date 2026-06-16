/* ===== State & persistence ===== */
const LS_KEY = "asia-trip-2026-v2";
let trip = loadTrip();
let cityFilter = "All";
let currentDayId = null;
let recCtx = null; // { dayId, slot }
let recMode = "todo"; // 'todo' | 'food'
let recQuery = ""; // suggestion search text
let recSort = "stops"; // distance-sort reference: 'stops' | 'hotel' | 'me'
const collapsedEv = new Set(); // ids of collapsed event cards (compact day overview)

function loadTrip() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return structuredClone(window.SEED_TRIP);
}
function saveTrip() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(trip)); } catch {}
  if (window.Cloud && Cloud.configured) Cloud.push(trip);
}
// Apply a plan received from the shared cloud (initial pull or another device's
// edit). Writes straight to localStorage (NOT saveTrip) to avoid a push loop.
function applyRemoteTrip(data, initial) {
  if (!data || !Array.isArray(data.days)) return;
  trip = data;
  trip.days.forEach(ensureIds);
  try { localStorage.setItem(LS_KEY, JSON.stringify(trip)); } catch {}
  renderHeader(); renderItinerary();
  if (currentView === "day" && currentDayId && findDay(currentDayId)) renderDay();
  else if (currentView === "map") drawMap();
  if (!initial && typeof toast === "function") toast("Plan updated from another device");
}
function resetTrip() {
  if (confirm("Reset the whole plan back to the original itinerary? Your changes will be lost.")) {
    trip = structuredClone(window.SEED_TRIP);
    saveTrip();
    cityFilter = "All";
    renderAll();
  }
}

/* ===== Helpers ===== */
const SLOTS = ["morning", "lunch", "afternoon", "evening"];
const SLOT_LABEL = { morning: "Morning", lunch: "Midday", afternoon: "Afternoon", evening: "Evening" };
const SLOT_HINT = { morning: "from 9:00 AM", lunch: "from 12:00 PM", afternoon: "from 2:00 PM", evening: "from 6:00 PM" };
const SLOT_BASE = { morning: 9 * 60, lunch: 12 * 60, afternoon: 14 * 60, evening: 18 * 60 };
const DUR_BY_TYPE = { experience: 180, sight: 120, museum: 120, park: 90, food: 75, shopping: 90, transit: 120 };
const uid = () => "x" + Math.random().toString(36).slice(2, 9);
const stars = (r) => (r ? "★ " + Number(r).toFixed(1) : "");
const fmtKm = (km) => (km >= 10 ? Math.round(km) : km < 1 ? km.toFixed(1) : km.toFixed(1)) + " km";
const itemDur = (it) => it.dur || 60; // events default to 1-hour chunks (flights keep their own dur)
function fmtHM(min) {
  min = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60), m = min % 60;
  const ap = h < 12 ? "AM" : "PM";
  const hh = (h % 12) || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}
// Accepts 24h ("14:30") or 12h ("2:30 PM").
function parseHM(s) {
  const m = /^(\d{1,2}):?(\d{2})\s*(am|pm)?$/i.exec((s || "").trim());
  if (!m) return null;
  let h = +m[1]; const mi = +m[2], ap = m[3] && m[3].toLowerCase();
  if (mi > 59) return null;
  if (ap) { if (h < 1 || h > 12) return null; if (ap === "pm" && h !== 12) h += 12; if (ap === "am" && h === 12) h = 0; }
  else if (h > 23) return null;
  return h * 60 + mi;
}
// Lay items out on a timeline. Honours an explicit it.start; otherwise flows
// sequentially from each part-of-day's base time, leaving a 15-min gap.
function computeSchedule(day) {
  const out = [];
  for (const slot of SLOTS) {
    const block = day.blocks.find((b) => b.slot === slot);
    if (!block) continue;
    let cursor = SLOT_BASE[slot] ?? 9 * 60;
    for (const it of block.items) {
      const start = (typeof it.start === "number") ? it.start : Math.max(cursor, SLOT_BASE[slot] ?? cursor);
      const end = start + itemDur(it);
      out.push({ it, slot, start, end });
      cursor = end + 15;
    }
  }
  return out;
}
function cities() {
  const seen = [];
  trip.days.forEach((d) => { if (!seen.includes(d.city)) seen.push(d.city); });
  return seen;
}
function filteredDays() {
  return cityFilter === "All" ? trip.days : trip.days.filter((d) => d.city === cityFilter);
}
function findDay(id) { return trip.days.find((d) => d.id === id); }
function fmtDate(iso, wd) {
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${wd} ${months[+m - 1]} ${+d}`;
}

/* ===== Header / city strip ===== */
function renderHeader() {
  document.getElementById("trip-title").textContent = trip.title;
  document.getElementById("trip-sub").textContent = trip.party;
  const sb = document.getElementById("sync-badge");
  if (sb) sb.textContent = (window.Cloud && Cloud.configured) ? "☁ Shared" : "";
  const strip = document.getElementById("city-strip");
  const list = ["All", ...cities()];
  strip.innerHTML = list
    .map((c) => `<button class="chip ${c === cityFilter ? "active" : ""}" data-city="${c}">${c}</button>`)
    .join("") + `<button class="chip" data-reset="1">↺ Reset</button>`;
  strip.querySelectorAll("[data-city]").forEach((b) =>
    b.onclick = () => {
      cityFilter = b.dataset.city;
      renderHeader();
      renderItinerary();
      // A filter is a list action: if we're on a day (or map), drop back to the
      // day-by-day itinerary so the filter is actually visible.
      if (currentView === "map") drawMap();
      else if (currentView !== "itinerary") navigate("itinerary");
    }
  );
  strip.querySelector("[data-reset]").onclick = resetTrip;
}

/* ===== Itinerary view ===== */
function renderItinerary() {
  const el = document.getElementById("view-itinerary");
  const days = filteredDays();
  el.innerHTML = days.map((d) => {
    const main = mainItem(d);
    const cls = d.city === "Transit" ? "transit" : "";
    return `<div class="daycard" data-day="${d.id}">
      <div class="daycard-top">
        <span class="date">${fmtDate(d.date, d.weekday)}</span>
        <span class="city ${cls}">${d.city}</span>
      </div>
      <div class="main">${main ? main.name : "—"}</div>
      <div class="meta">
        ${main && main.rating ? `<span class="stars">${stars(main.rating)}</span>` : ""}
        ${main && main.booking && main.booking !== "—" ? `<span>🎟️ ${main.booking}</span>` : ""}
        <span>${countItems(d)} stop${countItems(d) === 1 ? "" : "s"}</span>
      </div>
    </div>`;
  }).join("");
  el.querySelectorAll("[data-day]").forEach((c) => c.onclick = () => openDay(c.dataset.day));
}
function mainItem(day) {
  for (const b of day.blocks) for (const it of b.items) if (it.locked && it.type !== "transit") return it;
  for (const b of day.blocks) for (const it of b.items) if (it.locked) return it;
  return day.blocks[0]?.items[0] || null;
}
function countItems(day) { return day.blocks.reduce((n, b) => n + b.items.length, 0); }

/* ===== Day detail view ===== */
// Navigation goes through the URL hash so the browser back/forward buttons and
// breadcrumbs all stay in sync (see router section near the bottom).
function openDay(id) { navigate(id); }
function renderDay() {
  const d = findDay(currentDayId);
  if (!d) return;
  ensureIds(d);
  const el = document.getElementById("view-day");
  const sched = computeSchedule(d);
  const isTransit = d.city === "Transit";

  const head = `
    <div class="day-head">
      <button class="back">‹ Back</button>
      <div class="day-head-text">
        <span class="eyebrow">${fmtDate(d.date, d.weekday)}</span>
        <h2>${isTransit ? "Travel day" : d.city}</h2>
        <span class="sub">${isTransit ? "In transit" : (trip.hotels[d.city]?.name || "")}</span>
      </div>
    </div>`;

  // Prev/next walk the list you came from (filtered if a city is selected),
  // falling back to the full itinerary if the current day isn't in that list.
  let list = filteredDays();
  if (!list.some((x) => x.id === d.id)) list = trip.days;
  const pos = list.findIndex((x) => x.id === d.id);
  const prev = list[pos - 1], next = list[pos + 1];
  const navBtn = (day, dir) => day
    ? `<button class="daynav ${dir}" data-go="${day.id}"><span class="daynav-dir">${dir === "prev" ? "‹ Previous" : "Next ›"}</span><span class="daynav-day">${fmtDate(day.date, day.weekday)} · ${day.city === "Transit" ? "Travel" : day.city}</span></button>`
    : `<span class="daynav empty"></span>`;
  const dayNav = `<div class="day-nav">${navBtn(prev, "prev")}${navBtn(next, "next")}</div>`;

  // "Getting around" transit primer for this city.
  const tr = window.CITY_TRANSIT?.[d.city];
  const primer = (!isTransit && tr) ? `
    <details class="primer">
      <summary><span>🚇 Getting around ${d.city}</span><span class="primer-hint">passes &amp; transit</span></summary>
      <div class="primer-body">
        <p>${tr.intro}</p>
        <p><strong>Passes:</strong> ${tr.pass}</p>
        <p><strong>Tips:</strong> ${tr.tips}</p>
      </div>
    </details>` : "";

  // For each event, the previous stop (or the hotel for the first) — used to
  // build a "transit from here" directions link.
  const hotel = trip.hotels[d.city];
  const prevOf = {};
  sched.forEach((s, i) => {
    const p = i > 0 ? sched[i - 1].it : null;
    prevOf[s.it.id] = (p && p.lat != null) ? { name: p.name, lat: p.lat, lng: p.lng }
      : (hotel ? { name: hotel.name, lat: hotel.lat, lng: hotel.lng } : null);
  });

  // Order of movable (non-transit) stops, for enabling the move up/down buttons.
  const navIds = sched.filter((x) => x.it.type !== "transit").map((x) => x.it.id);
  // Calendar: one section per part-of-day, each a timeline of timed events.
  const body = SLOTS.map((slot) => {
    const rows = sched.filter((s) => s.slot === slot);
    const events = rows.map((s) => {
      const ni = navIds.indexOf(s.it.id);
      return calEvent(d, s, prevOf[s.it.id], ni > 0, ni >= 0 && ni < navIds.length - 1);
    }).join("");
    const suggest = isTransit ? "" : `<div class="slot-actions"><button class="slot-add" data-add-slot="${slot}">＋ Add</button><button class="suggest" data-rec="${slot}">✨ Suggest</button></div>`;
    const empty = rows.length ? "" : `<button class="cal-empty" data-rec="${slot}">＋ Add something to the ${SLOT_LABEL[slot].toLowerCase()}</button>`;
    return `<section class="cal-slot">
      <div class="cal-slot-head">
        <div><span class="cal-slot-name">${SLOT_LABEL[slot]}</span><span class="cal-slot-hint">${SLOT_HINT[slot]}</span></div>
        ${suggest}
      </div>
      <div class="cal-track" data-slot="${slot}">${events || empty}</div>
    </section>`;
  }).join("");

  el.innerHTML = head + dayRouteMap(d) + optimiseBar(d) + dayNav + primer + calTools(d) + `<div class="cal">${body}</div>` + dayNav;
  el.querySelector(".back").onclick = () => (history.length > 1 ? history.back() : navigate("itinerary"));
  el.querySelectorAll(".day-nav [data-go]").forEach((b) => b.onclick = () => navigate(b.dataset.go));
  el.querySelectorAll("[data-rec]").forEach((b) => b.onclick = () => openRecommend(d.id, b.dataset.rec));
  el.querySelectorAll("[data-add-slot]").forEach((b) => b.onclick = () => addCustomEvent(d.id, b.dataset.addSlot));
  el.querySelectorAll("[data-act]").forEach((b) => b.onclick = () => itemAction(b.dataset.act, b.dataset.day, b.dataset.slot, b.dataset.item));
  el.querySelectorAll(".ev-collapse").forEach((b) => b.onclick = () => toggleCollapse(b));
  const caBtn = el.querySelector("#collapse-all"); if (caBtn) { caBtn.onclick = collapseAll; updateCollapseAllLabel(); }
  const optBtn = el.querySelector("#opt-btn"); if (optBtn) optBtn.onclick = optimizeDay;
  const hideBtn = el.querySelector("#rm-hide"); if (hideBtn) hideBtn.onclick = () => setMapHidden(true);
  const showBtn = el.querySelector("#rm-show"); if (showBtn) showBtn.onclick = () => setMapHidden(false);
  renderDayMap(d);
  hydrateGalleries(el);
}

// Make a booking note clickable when it implies an action (reserve/buy/ticket…).
// Links to the item's official/booking URL if it has one, else a Google search.
function bookingLink(it, city) {
  if (!it.booking || it.booking === "—") return null;
  if (/^(conf|booked|flight)\b/i.test(it.booking)) return null; // already done / not bookable
  if (!/reserve|book|buy|ticket|online|advance|passport|klook|e-ticket|smartex/i.test(it.booking)) return null;
  return it.url || `https://www.google.com/search?q=${encodeURIComponent(`${it.name} ${city || ""} tickets booking`)}`;
}
function transitUrl(prev, it) {
  return `https://www.google.com/maps/dir/?api=1&origin=${prev.lat},${prev.lng}&destination=${it.lat},${it.lng}&travelmode=transit`;
}
// Airport ground-transfers (the 🧳 checkout/travel-to-airport buffers): with five
// people and luggage a ride-hail usually beats the train, so offer Uber up front
// instead of defaulting to transit. The buffer's own lat/lng is the airport, so we
// deep-link a drop-off there. Mainland China has no Uber — hand off to DiDi/taxi.
const AIRPORT_CODES = ["YVR", "HND", "NRT", "KIX", "ITM", "ICN", "GMP", "PEK", "PKX", "PVG"];
const CHINA_AIRPORTS = ["PEK", "PKX", "PVG", "SHA", "CAN", "CTU", "SZX"];
function hasCode(it, codes) {
  const hay = `${it.name || ""} ${it.area || ""}`;
  return codes.some((c) => new RegExp(`\\b${c}\\b`).test(hay));
}
function isAirportRun(it) {
  return it.type === "transit" && /🧳/.test(it.name || "") && it.lat != null && hasCode(it, AIRPORT_CODES);
}
function dirTo(it, mode, origin) {
  const o = origin ? `origin=${origin.lat},${origin.lng}&` : "";
  return `https://www.google.com/maps/dir/?api=1&${o}destination=${it.lat},${it.lng}&travelmode=${mode}`;
}
// Ride-hail hand-off for an airport run. Returns the primary (ride) + transit fallback.
function rideHail(it, prev) {
  const dest = (it.area || "").replace(/^.*→\s*/, "").trim() || "airport";
  if (hasCode(it, CHINA_AIRPORTS)) {
    // Uber doesn't operate in mainland China; DiDi is the local equivalent (driving route).
    return { label: `🚗 DiDi / taxi to ${dest}`, url: dirTo(it, "driving", prev), alt: dirTo(it, "transit", prev) };
  }
  const u = `https://m.uber.com/ul/?action=setPickup&pickup=my_location` +
    `&dropoff[latitude]=${it.lat}&dropoff[longitude]=${it.lng}&dropoff[nickname]=${encodeURIComponent(dest)}`;
  return { label: `🚗 Uber to ${dest}`, url: u, alt: dirTo(it, "transit", prev) };
}
// One timed event on the calendar: a time rail on the left + a card.
function calEvent(d, s, prev, canUp, canDown) {
  const it = s.it;
  const meta = [it.area ? `📍 ${it.area}` : "", it.price || "", it.rating ? stars(it.rating) : ""]
    .filter(Boolean).map((x) => `<span>${x}</span>`).join("");
  const a = (act, label, cls = "") =>
    `<button class="ev-act ${cls}" data-act="${act}" data-day="${d.id}" data-slot="${s.slot}" data-item="${it.id}">${label}</button>`;
  const mv = (act, label, on) =>
    `<button class="ev-move-btn" data-act="${act}" data-day="${d.id}" data-slot="${s.slot}" data-item="${it.id}" aria-label="Move ${act}"${on ? "" : " disabled"}>${label}</button>`;
  const draggable = it.type !== "transit";
  const reorder = draggable ? `<span class="ev-move">${mv("up", "↑", canUp)}${mv("down", "↓", canDown)}</span>` : "";
  const collapsed = collapsedEv.has(it.id);
  const book = bookingLink(it, d.city);
  const fromName = prev ? prev.name.replace(/\s*\(.*$/, "").trim() : "";
  const fromShort = fromName.length > 26 ? fromName.slice(0, 24) + "…" : fromName;
  const showTransit = prev && it.lat != null && it.type !== "transit";
  return `<article class="cal-ev ${it.locked ? "locked" : ""} ${it.type === "transit" ? "is-transit" : ""} ${collapsed ? "collapsed" : ""}" data-day="${d.id}" data-slot="${s.slot}" data-item="${it.id}">
    <div class="ev-rail"><span class="ev-time">${fmtHM(s.start)}</span><span class="ev-dot"></span><span class="ev-time end">${fmtHM(s.end)}</span></div>
    <div class="ev-card">
      <div class="ev-top">
        ${draggable ? `<span class="ev-drag" title="Drag to move">⠿</span>` : ""}
        <span class="ev-name">${it.name}</span>${it.type ? `<span class="ev-tag">${it.type}</span>` : ""}
        ${reorder}
        <button class="ev-collapse" aria-label="Expand or collapse" title="Expand or collapse">▾</button>
      </div>
      ${it.type === "transit" ? "" : galleryShell(it.gq || it.mapsQuery || `${it.name} ${d.city}`)}
      ${isAirportRun(it) ? (() => { const r = rideHail(it, prev); return `<div class="ev-ride">
        <a class="ev-transit ride" href="${r.url}" target="_blank" rel="noopener">${r.label} ↗</a>
        <a class="ev-transit alt" href="${r.alt}" target="_blank" rel="noopener">🚆 or train ↗</a>
      </div>` })() : ""}
      ${showTransit ? `<a class="ev-transit" href="${transitUrl(prev, it)}" target="_blank" rel="noopener">🚇 Transit from ${fromShort} ↗</a>` : ""}
      ${meta ? `<div class="ev-meta">${meta}</div>` : ""}
      ${it.booking && it.booking !== "—" ? (book
        ? `<a class="ev-book link" href="${book}" target="_blank" rel="noopener">🎟️ ${it.booking} ↗</a>`
        : `<div class="ev-book">🎟️ ${it.booking}</div>`) : ""}
      ${it.notes ? `<p class="ev-notes">${it.notes}</p>` : ""}
      ${it.desc ? `<p class="ev-desc">${it.desc}</p>` : ""}
      <div class="ev-actions">
        ${it.url ? `<a class="ev-act" href="${it.url}" target="_blank" rel="noopener">Open ↗</a>` : ""}
        ${it.lat ? a("go", "Directions") : ""}
        ${a("time", "Time")}
        ${a("lock", it.locked ? "✓ Locked" : "Lock", it.locked ? "on" : "")}
        ${a("del", "✕")}
      </div>
    </div>
  </article>`;
}
function ensureIds(day) {
  day.blocks.forEach((b) => b.items.forEach((it) => { if (!it.id) it.id = uid(); }));
}

// Container for the day's reference map (a real city map with the hotel + the
// day's stops). Filled in by renderDayMap() after the day view is in the DOM.
const MAPH_LS = "asia-trip-daymap-hidden";
let mapHidden = (() => { try { return localStorage.getItem(MAPH_LS) === "1"; } catch { return false; } })();
function setMapHidden(v) { mapHidden = v; try { localStorage.setItem(MAPH_LS, v ? "1" : "0"); } catch {} renderDay(); }
function dayRouteMap(d) {
  if (d.city === "Transit") return "";
  const hotel = trip.hotels[d.city];
  const anyCoord = hotel || computeSchedule(d).some((s) => s.it.type !== "transit" && s.it.lat != null);
  if (!anyCoord) return "";
  if (mapHidden) return `<button class="daymap-show" id="rm-show">🗺 Show day map</button>`;
  return `<div class="routemap">
    <div class="routemap-head">
      <span class="routemap-title">Day map</span>
      <div class="routemap-actions">
        <span class="routemap-total" id="rm-total"></span>
        <button class="routemap-toggle" id="rm-toggle">Hide route</button>
        <button class="routemap-close" id="rm-hide" title="Hide day map" aria-label="Hide day map">✕</button>
      </div>
    </div>
    <div id="day-map" class="day-map"></div>
    <div class="routemap-foot" id="rm-foot"></div>
  </div>`;
}

// Day reference map: light "Positron" city tiles (landmarks/streets) with the
// hotel always marked, and the day's stops + connecting route as a toggleable
// overlay. Non-interactive so it never traps the page scroll. Rebuilt each
// renderDay(), so it tracks plan changes.
let dayMap = null, dayRouteLayer = null, routeHidden = false, dayUserMarker = null, userLoc = null;
const dmMeIcon = () => L.divIcon({ className: "", iconSize: [18, 18], iconAnchor: [9, 9], html: `<div class="dm-me"></div>` });
const dmHotelIcon = () => L.divIcon({ className: "", iconSize: [22, 22], iconAnchor: [11, 11], html: `<div class="dm-hotel">⌂</div>` });
const dmNumIcon = (n, kind, food) => L.divIcon({ className: "", iconSize: [22, 22], iconAnchor: [11, 11], html: `<div class="dm-num ${kind === "locked" ? "lock" : "tent"}${food ? " food" : ""}">${n}${food ? `<span class="dm-food">🍴</span>` : ""}</div>` });
const dmDistIcon = (t) => L.divIcon({ className: "", iconSize: [0, 0], iconAnchor: [0, 0], html: `<div class="dm-dist">${t}</div>` });
const dmLandIcon = (name) => L.divIcon({ className: "", iconSize: [0, 0], iconAnchor: [4, 4], html: `<div class="dm-land"><span class="dm-land-dot"></span><span class="dm-land-lbl">${escAttr(name)}</span></div>` });
function renderDayMap(d) {
  const el = document.getElementById("day-map");
  if (!el || typeof L === "undefined") return;
  if (dayMap) { try { dayMap.remove(); } catch {} dayMap = null; }

  const hotel = trip.hotels[d.city];
  const stops = [];
  if (hotel) stops.push({ lat: hotel.lat, lng: hotel.lng, kind: "hotel", name: hotel.name });
  computeSchedule(d).forEach((s) => {
    const it = s.it;
    if (it.type === "transit" || it.lat == null || it.lng == null) return;
    stops.push({ lat: it.lat, lng: it.lng, kind: it.locked ? "locked" : "tent", name: it.name, food: it.type === "food" });
  });
  const places = stops.filter((s) => s.kind !== "hotel");

  // Zoom everywhere (buttons + pinch + double-tap + wheel). On touch, disable
  // one-finger drag so a vertical swipe scrolls the PAGE (pinch still zooms);
  // on desktop, allow full drag-to-pan.
  const touch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const map = L.map(el, { zoomControl: true, boxZoom: false, dragging: !touch, tap: false, touchZoom: true, doubleClickZoom: true, scrollWheelZoom: true });
  dayMap = map;
  if (touch) el.style.touchAction = "pan-y";
  // Voyager: cream/paper land, visible roads + highways, blue water, green parks.
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
    subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap, © CARTO",
  }).addTo(map);
  // Major-landmark reference markers (always visible, non-interactive).
  ((window.CITY_LANDMARKS || {})[d.city] || []).forEach((l) =>
    L.marker([l.lat, l.lng], { icon: dmLandIcon(l.name), interactive: false, keyboard: false, zIndexOffset: -400 }).addTo(map));
  if (hotel) L.marker([hotel.lat, hotel.lng], { icon: dmHotelIcon() }).addTo(map).bindPopup(`🏨 ${hotel.name}`);

  dayRouteLayer = L.layerGroup();
  let total = 0;
  const line = stops.map((s) => [s.lat, s.lng]);
  if (stops.length >= 2) {
    L.polyline(line, { color: "#b15c38", weight: 2.5, opacity: .7, dashArray: "5 6" }).addTo(dayRouteLayer);
    for (let i = 1; i < stops.length; i++) {
      const km = haversine(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng); total += km;
      L.marker([(stops[i - 1].lat + stops[i].lat) / 2, (stops[i - 1].lng + stops[i].lng) / 2], { icon: dmDistIcon(fmtKm(km)) }).addTo(dayRouteLayer);
    }
  }
  places.forEach((s, i) => L.marker([s.lat, s.lng], { icon: dmNumIcon(i + 1, s.kind, s.food) }).addTo(dayRouteLayer).bindPopup(`${i + 1}. ${s.food ? "🍴 " : ""}${s.name}`));
  if (!routeHidden) dayRouteLayer.addTo(map);

  const totalEl = document.getElementById("rm-total");
  if (totalEl) totalEl.textContent = places.length ? `≈ ${fmtKm(total)} · ${places.length} stop${places.length === 1 ? "" : "s"}` : "";
  const foot = document.getElementById("rm-foot");
  if (foot) foot.textContent = places.length ? "Numbered in visiting order · 🍴 = meal stop · tighter clusters mean less travel" : "Your hotel is marked — add stops to see the route.";
  const tgl = document.getElementById("rm-toggle");
  if (tgl) {
    tgl.disabled = places.length === 0;
    tgl.textContent = routeHidden ? "Show route" : "Hide route";
    tgl.onclick = () => {
      routeHidden = !routeHidden;
      if (routeHidden) map.removeLayer(dayRouteLayer); else dayRouteLayer.addTo(map);
      tgl.textContent = routeHidden ? "Show route" : "Hide route";
    };
  }

  // "My location" control — drops a live pin so you can see where you are
  // relative to the route (asks for browser permission on first use).
  const addMe = () => {
    if (dayUserMarker) { try { dayUserMarker.remove(); } catch {} dayUserMarker = null; }
    if (userLoc) dayUserMarker = L.marker([userLoc.lat, userLoc.lng], { icon: dmMeIcon(), zIndexOffset: 1000 }).addTo(map).bindPopup("You are here");
  };
  const locate = () => {
    if (!navigator.geolocation) { alert("Location isn't available in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        addMe();
        const pts = line.concat([[userLoc.lat, userLoc.lng]]);
        if (hotel) pts.push([hotel.lat, hotel.lng]);
        map.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
        if (currentView === "day") updateRecResults && document.getElementById("rec-results") && updateRecResults();
      },
      () => alert("Couldn't get your location. Make sure location access is allowed for this site."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };
  const Locate = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const b = L.DomUtil.create("button", "dm-locate");
      b.type = "button"; b.innerHTML = "📍"; b.title = "Show my location";
      L.DomEvent.on(b, "click", (ev) => { L.DomEvent.stop(ev); locate(); });
      L.DomEvent.disableClickPropagation(b);
      return b;
    },
  });
  map.addControl(new Locate());
  if (userLoc) addMe();

  // Fit after the container is visible & sized.
  const fit = () => {
    map.invalidateSize();
    const pts = (routeHidden || stops.length < 2) ? (hotel ? [[hotel.lat, hotel.lng]] : line) : line;
    if (pts.length > 1) map.fitBounds(pts, { padding: [28, 28] });
    else if (pts.length === 1) map.setView(pts[0], 14);
  };
  setTimeout(fit, 60);
}

/* ===== "Make day efficient" — route optimiser ===== */
const geoD = (a, b) => haversine(a.lat, a.lng, b.lat, b.lng);
const slotOfTime = (t) => (t < 720 ? "morning" : t < 840 ? "lunch" : t < 1080 ? "afternoon" : "evening");
function routeLen(start, items) { let t = 0, prev = start; for (const it of items) { t += geoD(prev, it); prev = it; } return t; }
// 2-opt that never reverses a segment containing a fixed node (hotel / booked).
function twoOpt(route, fixed) {
  let improved = true, guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let i = 1; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        let blocked = false;
        for (let m = i; m <= k; m++) if (fixed[m]) { blocked = true; break; }
        if (blocked) continue;
        const a = route[i - 1], b = route[i], c = route[k], nxt = route[k + 1];
        const before = geoD(a, b) + (nxt ? geoD(c, nxt) : 0);
        const after = geoD(a, c) + (nxt ? geoD(b, nxt) : 0);
        if (after + 1e-9 < before) { route.splice(i, k - i + 1, ...route.slice(i, k + 1).reverse()); improved = true; }
      }
    }
  }
}
function optimizeDay() {
  const d = findDay(currentDayId);
  const hotel = trip.hotels[d.city];
  const movable = [];
  d.blocks.forEach((b) => b.items.forEach((it) => { if (it.type !== "transit" && it.lat != null && it.lng != null) movable.push(it); }));
  if (!hotel || movable.length < 3) { toast("Add a few more located stops to optimise the route."); return; }

  const start = { lat: hotel.lat, lng: hotel.lng };
  const before = routeLen(start, computeSchedule(d).map((s) => s.it).filter((it) => movable.includes(it)));

  // Booked-time items stay fixed (in time order); cheapest-insert the rest, then 2-opt.
  const pinned = movable.filter((it) => typeof it.start === "number").sort((a, b) => a.start - b.start);
  const free = movable.filter((it) => typeof it.start !== "number");
  const route = [start, ...pinned], fixed = route.map(() => true);
  for (const it of free) {
    let bestPos = 1, bestInc = Infinity;
    for (let pos = 1; pos <= route.length; pos++) {
      const p = route[pos - 1], nx = route[pos];
      const inc = geoD(p, it) + (nx ? geoD(it, nx) - geoD(p, nx) : 0);
      if (inc < bestInc) { bestInc = inc; bestPos = pos; }
    }
    route.splice(bestPos, 0, it); fixed.splice(bestPos, 0, false);
  }
  twoOpt(route, fixed);
  const order = route.slice(1);
  const after = routeLen(start, order);

  // Assign slots via a rough time-walk (honour booked times; keep meals >= midday).
  let cursor = 540, prev = start;
  const newB = { morning: [], lunch: [], afternoon: [], evening: [] };
  for (const it of order) {
    const arr = (typeof it.start === "number") ? it.start : cursor + Math.max(10, Math.round(geoD(prev, it) * 6));
    let slot = slotOfTime(arr);
    if (it.type === "food" && slot === "morning") slot = "lunch";
    newB[slot].push(it);
    cursor = arr + itemDur(it); prev = it;
  }
  // Keep flights/buffers and coordless items in their original-ish slot.
  d.blocks.forEach((b) => b.items.forEach((it) => {
    if (movable.includes(it)) return;
    const slot = (typeof it.start === "number") ? slotOfTime(it.start) : b.slot;
    (newB[slot] = newB[slot] || []).push(it);
  }));
  const effT = (it, s) => (typeof it.start === "number" ? it.start : SLOT_BASE[s] ?? 540);
  for (const s in newB) newB[s].sort((a, b) => effT(a, s) - effT(b, s));
  d.blocks = SLOTS.filter((s) => newB[s] && newB[s].length).map((s) => ({ slot: s, items: newB[s] }));

  saveTrip(); renderDay(); renderItinerary();
  const saved = before - after;
  toast(saved > 0.15 ? `Route tightened to ≈ ${fmtKm(after)} (saved ≈ ${fmtKm(saved)}).` : `Already efficient — ≈ ${fmtKm(after)}.`);
}
// Collapse/expand cards for a compact whole-day overview (no re-render, so the
// map isn't rebuilt). State lives in collapsedEv for the session.
function calTools(d) {
  const n = d.blocks.flatMap((b) => b.items).length;
  return n >= 2 ? `<div class="cal-tools"><button id="collapse-all" class="cal-tool-btn">Collapse all</button></div>` : "";
}
function toggleCollapse(btn) {
  const card = btn.closest(".cal-ev"); if (!card) return;
  const id = card.dataset.item;
  const nowCollapsed = card.classList.toggle("collapsed");
  if (nowCollapsed) collapsedEv.add(id); else collapsedEv.delete(id);
  updateCollapseAllLabel();
}
function collapseAll() {
  const cards = [...document.querySelectorAll("#view-day .cal-ev")];
  const collapse = cards.some((c) => !c.classList.contains("collapsed")); // collapse if any are open
  cards.forEach((c) => { c.classList.toggle("collapsed", collapse); collapse ? collapsedEv.add(c.dataset.item) : collapsedEv.delete(c.dataset.item); });
  updateCollapseAllLabel();
}
function updateCollapseAllLabel() {
  const ca = document.getElementById("collapse-all"); if (!ca) return;
  const cards = [...document.querySelectorAll("#view-day .cal-ev")];
  ca.textContent = (cards.length && cards.every((c) => c.classList.contains("collapsed"))) ? "Expand all" : "Collapse all";
}
function optimiseBar(d) {
  if (d.city === "Transit") return "";
  const n = d.blocks.flatMap((b) => b.items).filter((it) => it.type !== "transit" && it.lat != null && it.lng != null).length;
  if (n < 3 || !trip.hotels[d.city]) return "";
  const ico = `<svg class="opt-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18 L10 8 L20 13"/><circle cx="4" cy="18" r="1.7" fill="currentColor" stroke="none"/><circle cx="10" cy="8" r="1.7" fill="currentColor" stroke="none"/><circle cx="20" cy="13" r="1.7" fill="currentColor" stroke="none"/></svg>`;
  return `<div class="day-tools"><button id="opt-btn" class="opt-btn">${ico}<span>Make day efficient</span></button></div>`;
}
let toastT = null;
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 3400);
}

/* ===== Drag-to-reschedule (pointer-based, works on touch + mouse) ===== */
// Drag an event by its ⠿ handle to another part-of-day or position; times then
// reflow from that slot's base time (use the "Time" button to pin an exact time).
let drag = null;
function moveItem(fromSlot, itemId, toSlot, toIndex) {
  const d = findDay(currentDayId);
  const fromBlock = d.blocks.find((b) => b.slot === fromSlot);
  const i = fromBlock?.items.findIndex((x) => x.id === itemId);
  if (i == null || i < 0) return;
  const [it] = fromBlock.items.splice(i, 1);
  let toBlock = d.blocks.find((b) => b.slot === toSlot);
  if (!toBlock) { toBlock = { slot: toSlot, items: [] }; d.blocks.push(toBlock); }
  delete it.start; // position now determines the time; reflow from slot base
  toBlock.items.splice(Math.max(0, Math.min(toIndex, toBlock.items.length)), 0, it);
  saveTrip(); renderDay(); renderItinerary();
}
function onDragDown(e) {
  const handle = e.target.closest(".ev-drag");
  if (!handle) return;
  const ev = handle.closest(".cal-ev");
  if (!ev) return;
  e.preventDefault();
  drag = { slot: ev.dataset.slot, itemId: ev.dataset.item, ev, startX: e.clientX, startY: e.clientY, moved: false, ghost: null, ind: null, target: null };
  document.addEventListener("pointermove", onDragMove);
  document.addEventListener("pointerup", onDragUp, { once: true });
}
function onDragMove(e) {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
  e.preventDefault();
  if (!drag.moved) {
    drag.moved = true;
    const r = drag.ev.querySelector(".ev-card").getBoundingClientRect();
    const ghost = drag.ev.querySelector(".ev-card").cloneNode(true);
    ghost.querySelectorAll(".gallery").forEach((g) => g.remove()); // keep the floating card light
    ghost.className = "ev-card drag-ghost";
    ghost.style.width = r.width + "px";
    document.body.appendChild(ghost);
    drag.ghost = ghost; drag.gw = r.width; drag.gh = ghost.getBoundingClientRect().height;
    drag.ind = Object.assign(document.createElement("div"), { className: "drop-indicator" });
    drag.ev.classList.add("dragging");
    document.body.classList.add("is-dragging");
  }
  drag.ghost.style.left = (e.clientX - drag.gw / 2) + "px";
  drag.ghost.style.top = (e.clientY - 18) + "px";
  drag.ghost.style.display = "none"; // hide so elementFromPoint sees what's underneath
  const under = document.elementFromPoint(e.clientX, e.clientY);
  drag.ghost.style.display = "";
  const track = under && under.closest(".cal-track");
  if (!track) { if (drag.ind.parentNode) drag.ind.remove(); drag.target = null; return; }
  const cards = [...track.querySelectorAll(".cal-ev")].filter((c) => c !== drag.ev);
  let idx = cards.length;
  for (let i = 0; i < cards.length; i++) {
    const cr = cards[i].getBoundingClientRect();
    if (e.clientY < cr.top + cr.height / 2) { idx = i; break; }
  }
  if (cards[idx]) track.insertBefore(drag.ind, cards[idx]); else track.appendChild(drag.ind);
  drag.target = { slot: track.dataset.slot, idx };
}
function onDragUp() {
  document.removeEventListener("pointermove", onDragMove);
  const d = drag;
  if (d) {
    if (d.ghost) d.ghost.remove();
    if (d.ind && d.ind.parentNode) d.ind.remove();
    d.ev.classList.remove("dragging");
    document.body.classList.remove("is-dragging");
    if (d.moved && d.target) moveItem(d.slot, d.itemId, d.target.slot, d.target.idx);
  }
  drag = null;
}
function itemAction(act, dayId, slot, itemId) {
  const d = findDay(dayId); ensureIds(d);
  const block = d.blocks.find((b) => b.slot === slot);
  const it = block?.items.find((x) => x.id === itemId);
  if (!it) return;
  if (act === "lock") { it.locked = !it.locked; saveTrip(); renderDay(); renderItinerary(); }
  else if (act === "del") { block.items = block.items.filter((x) => x.id !== itemId); saveTrip(); renderDay(); renderItinerary(); }
  else if (act === "go") { navigateTo(it); }
  else if (act === "up") { moveItemDir(dayId, itemId, -1); }
  else if (act === "down") { moveItemDir(dayId, itemId, +1); }
  else if (act === "time") {
    const cur = typeof it.start === "number" ? fmtHM(it.start) : "";
    const input = prompt(`Start time for “${it.name}” (e.g. 9:30 AM):`, cur);
    if (input === null) return;
    const mins = parseHM(input);
    if (input.trim() === "") { delete it.start; }
    else if (mins == null) { alert("Please enter a time like 9:30 AM."); return; }
    else { it.start = mins; }
    saveTrip(); renderDay();
  }
}
// Move an item one position earlier/later in the day's sequence (skips flights);
// the slot/time reflows to its new position. Helps reordering on mobile.
function moveItemDir(dayId, itemId, dir) {
  const d = findDay(dayId);
  const seq = [];
  SLOTS.forEach((s) => { const b = d.blocks.find((x) => x.slot === s); if (b) b.items.forEach((it) => seq.push({ slot: s, it })); });
  const i = seq.findIndex((x) => x.it.id === itemId);
  if (i < 0) return;
  let j = i + dir;
  while (j >= 0 && j < seq.length && seq[j].it.type === "transit") j += dir;
  if (j < 0 || j >= seq.length) return;
  const a = seq[i].it; seq[i].it = seq[j].it; seq[j].it = a; // swap items, slots stay with positions
  const map = {};
  seq.forEach((x) => { (map[x.slot] = map[x.slot] || []).push(x.it); });
  d.blocks = SLOTS.filter((s) => map[s] && map[s].length).map((s) => ({ slot: s, items: map[s] }));
  saveTrip(); renderDay(); renderItinerary();
}

/* ===== Recommend sheet (live AI) ===== */
function openRecommend(dayId, slot) {
  recCtx = { dayId, slot };
  recMode = slot === "lunch" ? "food" : "todo";
  recQuery = "";
  // Default the sort reference: earlier stops if there are any, else the hotel.
  recSort = hasPriorStops(findDay(dayId), slot) ? "stops" : "hotel";
  document.getElementById("sheet").classList.remove("hidden");
  document.getElementById("sheet-title").textContent = `${SLOT_LABEL[slot]} ideas`;
  buildSheet();
}
function closeSheet() { document.getElementById("sheet").classList.add("hidden"); }

// Build the sheet shell ONCE (search box + toolbar + results container) so that
// typing in search doesn't rebuild/refocus the input. Only the results refresh.
function buildSheet() {
  const d = findDay(recCtx.dayId);
  const bodyEl = document.getElementById("sheet-body");
  bodyEl.innerHTML = `
    <div class="rec-search">
      <span class="rec-search-ico">🔎</span>
      <input id="rec-q" type="search" placeholder="Search places in ${d.city}…" autocomplete="off" value="${recQuery.replace(/"/g, "&quot;")}" />
    </div>
    <div class="rec-toolbar">
      <button class="${recMode === "todo" ? "active" : ""}" data-mode="todo">Things to do</button>
      <button class="${recMode === "food" ? "active" : ""}" data-mode="food">Restaurants</button>
    </div>
    <div class="rec-sort">
      <span class="rec-sort-lbl">Nearest to</span>
      <div class="rec-sort-btns">
        <button data-sort="stops">Earlier stops</button>
        <button data-sort="hotel">Hotel</button>
        <button data-sort="me">My location</button>
      </div>
    </div>
    <div id="rec-results"></div>`;
  const q = bodyEl.querySelector("#rec-q");
  q.oninput = () => { recQuery = q.value; updateRecResults(); };
  bodyEl.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => {
    recMode = b.dataset.mode;
    bodyEl.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("active", x.dataset.mode === recMode));
    updateRecResults();
  });
  bodyEl.querySelectorAll("[data-sort]").forEach((b) => b.onclick = () => {
    const v = b.dataset.sort;
    if (v === "me") { ensureUserLoc((ok) => { if (ok) { recSort = "me"; } syncSortButtons(); updateRecResults(); }); return; }
    recSort = v; syncSortButtons(); updateRecResults();
  });
  syncSortButtons();
  updateRecResults();
  if (recQuery) q.focus();
}
function syncSortButtons() {
  document.querySelectorAll(".rec-sort [data-sort]").forEach((x) => x.classList.toggle("active", x.dataset.sort === recSort));
}
// Get the browser location once (shared with the day map's pin), then call back.
function ensureUserLoc(cb) {
  if (userLoc) { cb(true); return; }
  if (!navigator.geolocation) { alert("Location isn't available in this browser."); cb(false); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => { userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude }; cb(true); },
    () => { alert("Couldn't get your location. Make sure location access is allowed for this site."); cb(false); },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// Recommendations come from the baked-in SEED_RECS (no API key). With a search
// query we match across BOTH things-to-do and restaurants for the city; without
// one we show the active toggle's list. Anything already on the day is hidden.
function updateRecResults() {
  const d = findDay(recCtx.dayId);
  const city = (window.SEED_RECS || {})[d.city];
  const resultsEl = document.getElementById("rec-results");
  const toolbar = document.querySelector(".rec-toolbar");
  if (!resultsEl) return;
  if (!city) {
    resultsEl.innerHTML = `<div class="notice">No baked-in recommendations for ${d.city} yet.</div>`;
    return;
  }
  const query = recQuery.trim().toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  if (toolbar) toolbar.style.display = query ? "none" : "";
  const already = new Set(d.blocks.flatMap((b) => b.items).map((i) => (i.name || "").toLowerCase()));
  let pool = query ? [...city.todo, ...city.food] : (recMode === "food" ? city.food : city.todo);
  let options = pool.slice(); // show ALL suggestions (added ones are marked, not hidden)
  if (terms.length) {
    options = options.filter((o) => {
      const hay = `${o.name} ${o.area || ""} ${o.type || ""} ${o.why || ""} ${o.desc || ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  // Distance sort: order by proximity to the chosen reference (earlier stops /
  // hotel / your location). Options with coords come first.
  const ref = refPointsForSort(d, recCtx.slot, recSort);
  const ranked = options.map((o) => {
    let dist = null;
    if (o.lat != null && o.lng != null && ref.pts.length) {
      dist = Math.min(...ref.pts.map((p) => haversine(p.lat, p.lng, o.lat, o.lng)));
    }
    return { o, dist };
  });
  if (ref.pts.length) {
    ranked.sort((a, b) => (a.dist == null) - (b.dist == null) || (a.dist - b.dist));
  }

  let inner = query ? `<div class="rec-count">${options.length} match${options.length === 1 ? "" : "es"} in ${d.city}</div>` : "";
  if (ref.pts.length && ranked.some((x) => x.dist != null)) {
    inner += `<div class="rec-sortnote">↕ Sorted by distance from ${ref.label}</div>`;
  }
  inner += ranked.length
    ? ranked.map((x, i) => recHtml(x.o, i, x.dist, already.has((x.o.name || "").toLowerCase()))).join("")
    : `<div class="empty">${query ? "No places match your search." : "Nothing to suggest here."}</div>`;
  resultsEl.innerHTML = inner;
  window.__recs = ranked.map((x) => x.o);
  resultsEl.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => addRec(+b.dataset.add));
  hydrateGalleries(resultsEl);
}
function priorStops(d, slot) {
  const idx = SLOTS.indexOf(slot);
  const pts = [];
  d.blocks.forEach((b) => {
    // Include everything planned SO FAR today (this slot + earlier ones); only
    // skip later slots. Otherwise stops in the current slot are ignored and the
    // sort falls back to the hotel — which made "Earlier stops" look broken.
    if (SLOTS.indexOf(b.slot) > idx) return;
    b.items.forEach((it) => { if (it.lat != null && it.lng != null && it.type !== "transit") pts.push({ lat: it.lat, lng: it.lng }); });
  });
  return pts;
}
const hasPriorStops = (d, slot) => priorStops(d, slot).length > 0;
// Reference points for the chosen sort mode (with sensible fallbacks).
function refPointsForSort(d, slot, mode) {
  const hotel = trip.hotels[d.city];
  if (mode === "me" && userLoc) return { pts: [{ lat: userLoc.lat, lng: userLoc.lng }], label: "your location" };
  if (mode === "stops") {
    const pts = priorStops(d, slot);
    if (pts.length) return { pts, label: "your stops so far" };
  }
  if (hotel) return { pts: [{ lat: hotel.lat, lng: hotel.lng }], label: "your hotel" };
  return { pts: [], label: "" };
}
// Outbound link: prefer a curated official/booking URL, else a Google Maps
// search that always resolves to the real place (hours, reviews, directions).
function recLink(o, city) {
  if (o.url) return o.url;
  const q = o.mapsQuery || `${o.name} ${city || ""}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/* ===== Media gallery =====================================================
 * Images are pulled live (embedded, never downloaded) from Openverse — a
 * keyless, CORS-enabled Creative-Commons image search — by place name. Results
 * are cached in memory AND localStorage so a query is fetched at most once, and
 * revisits/offline still show photos. A YouTube-search tile gives videos too.
 */
const IMG_LS = "asia-trip-img-v1";
const galleryCache = new Map(Object.entries(loadImgCache()));
function loadImgCache() { try { return JSON.parse(localStorage.getItem(IMG_LS) || "{}"); } catch { return {}; } }
function saveImgCache() { try { localStorage.setItem(IMG_LS, JSON.stringify(Object.fromEntries(galleryCache))); } catch {} }
const escAttr = (s) => String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");

async function fetchImages(query) {
  if (galleryCache.has(query)) return galleryCache.get(query);
  let imgs = [];
  try {
    const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=8&mature=false`);
    if (r.ok) {
      const d = await r.json();
      imgs = (d.results || []).map((x) => x.thumbnail || x.url).filter(Boolean).slice(0, 8);
    }
  } catch {}
  galleryCache.set(query, imgs);
  saveImgCache();
  return imgs;
}
// Placeholder strip; real media is injected by hydrateGalleries() after render.
function galleryShell(query) {
  return `<div class="gallery" data-gallery="${escAttr(query)}">
    <div class="gallery-skel"></div><div class="gallery-skel"></div><div class="gallery-skel"></div>
  </div>`;
}
async function fillGallery(el) {
  if (el.dataset.done) return;
  el.dataset.done = "1";
  const query = el.dataset.gallery;
  const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const imgs = await fetchImages(query);
  if (!imgs.length) {
    el.classList.add("empty");
    el.innerHTML = `<a class="gv-video solo" href="${yt}" target="_blank" rel="noopener">▶ Search videos &amp; photos ↗</a>`;
    return;
  }
  el.innerHTML =
    imgs.map((u) => `<img loading="lazy" src="${escAttr(u)}" alt="" onerror="this.remove()">`).join("") +
    `<a class="gv-video" href="${yt}" target="_blank" rel="noopener" title="Search videos">▶<span>Videos</span></a>`;
}
// Lazy: only fetch a gallery's images once it scrolls near the viewport, so a
// long list doesn't fire dozens of API calls at once.
function hydrateGalleries(root) {
  const els = [...root.querySelectorAll("[data-gallery]:not([data-done])")];
  if (!("IntersectionObserver" in window)) { els.forEach(fillGallery); return; }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((en) => { if (en.isIntersecting) { fillGallery(en.target); obs.unobserve(en.target); } });
  }, { root: null, rootMargin: "300px 0px" });
  els.forEach((el) => io.observe(el));
}

/* ===== Image lightbox ===== */
// Tap any gallery photo to open a full-screen, swipe/scroll-through viewer.
let lbImages = [], lbIndex = 0;
function openLightbox(images, index) {
  lbImages = images; lbIndex = Math.max(0, Math.min(index, images.length - 1));
  const lb = document.getElementById("lightbox");
  const track = document.getElementById("lb-track");
  track.innerHTML = images.map((u) => `<div class="lb-slide"><img src="${escAttr(u)}" alt=""></div>`).join("");
  lb.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  // jump to the tapped image (no smooth scroll so it lands instantly)
  requestAnimationFrame(() => { track.scrollTo({ left: lbIndex * track.clientWidth, behavior: "instant" }); updateLbCount(); });
}
function closeLightbox() {
  document.getElementById("lightbox").classList.add("hidden");
  document.body.style.overflow = "";
  document.getElementById("lb-track").innerHTML = "";
}
function lbGo(delta) {
  const track = document.getElementById("lb-track");
  lbIndex = Math.max(0, Math.min(lbIndex + delta, lbImages.length - 1));
  track.scrollTo({ left: lbIndex * track.clientWidth, behavior: "smooth" });
  updateLbCount();
}
function updateLbCount() {
  const track = document.getElementById("lb-track");
  lbIndex = Math.round(track.scrollLeft / track.clientWidth) || 0;
  document.getElementById("lb-count").textContent = `${lbIndex + 1} / ${lbImages.length}`;
  document.getElementById("lb-prev").classList.toggle("hide", lbIndex === 0);
  document.getElementById("lb-next").classList.toggle("hide", lbIndex >= lbImages.length - 1);
}
function initLightbox() {
  const lb = document.getElementById("lightbox");
  const track = document.getElementById("lb-track");
  document.getElementById("lb-close").onclick = closeLightbox;
  lb.querySelector(".lb-backdrop").onclick = closeLightbox;
  document.getElementById("lb-prev").onclick = () => lbGo(-1);
  document.getElementById("lb-next").onclick = () => lbGo(1);
  track.addEventListener("scroll", () => { clearTimeout(track._t); track._t = setTimeout(updateLbCount, 80); });
  document.addEventListener("keydown", (e) => {
    if (lb.classList.contains("hidden")) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") lbGo(-1);
    else if (e.key === "ArrowRight") lbGo(1);
  });
  // Delegated: any photo in any gallery opens the lightbox at that image.
  document.addEventListener("click", (e) => {
    const img = e.target.closest(".gallery img");
    if (!img) return;
    const imgs = [...img.closest(".gallery").querySelectorAll("img")].map((i) => i.src);
    openLightbox(imgs, imgs.indexOf(img.src));
  });
}

/* ===== Pull-to-refresh (touch) ===== */
// Custom because the app sets overscroll-behavior:none (which disables the
// browser's native pull-to-refresh). Only engages at the very top of the
// itinerary/day views, not in the map/sheet/lightbox or while dragging a card.
function initPullToRefresh() {
  const ptr = document.createElement("div");
  ptr.id = "ptr"; ptr.className = "ptr";
  ptr.innerHTML = `<div class="ptr-ring"></div>`;
  document.body.appendChild(ptr);
  const ring = ptr.querySelector(".ptr-ring");
  const TH = 70, MAX = 110;
  let startY = null, startX = null, pulling = false, dist = 0;

  const scrollTop = () => Math.max(window.scrollY || 0, document.documentElement.scrollTop || 0, document.body.scrollTop || 0);
  const atTop = () => scrollTop() <= 0;
  function eligible(t) {
    if (document.documentElement.classList.contains("locked")) return false;
    if (drag) return false;
    if (currentView === "map") return false;
    if (!document.getElementById("sheet").classList.contains("hidden")) return false;
    if (!document.getElementById("lightbox").classList.contains("hidden")) return false;
    if (t && t.closest && t.closest("#map, .sheet, .lightbox, .ev-drag")) return false;
    return true;
  }
  function set(d) {
    dist = d;
    ptr.style.transform = `translateY(${d - 58}px)`;
    ptr.style.opacity = Math.min(1, d / TH);
    ring.style.transform = `rotate(${d * 3}deg)`;
    ptr.classList.toggle("ready", d >= TH);
  }
  function reset() {
    ptr.classList.add("animating");
    ptr.style.transform = "translateY(-58px)"; ptr.style.opacity = "0";
    ring.classList.remove("spin"); ptr.classList.remove("ready"); dist = 0;
  }
  function refresh() {
    ptr.classList.add("animating", "ready");
    ptr.style.transform = "translateY(10px)"; ptr.style.opacity = "1";
    ring.style.transform = ""; ring.classList.add("spin");
    setTimeout(() => location.reload(), 550);
  }
  document.addEventListener("touchstart", (e) => {
    pulling = false;
    // Must be at the very top AND the finger must start near the top of the
    // screen — so a swipe lower down (e.g. scrolling up from the bottom) never
    // arms the pull-to-refresh.
    if (e.touches.length !== 1 || !atTop() || e.touches[0].clientY > 150 || !eligible(e.target)) { startY = null; return; }
    startY = e.touches[0].clientY; startX = e.touches[0].clientX;
    ptr.classList.remove("animating");
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (startY == null) return;
    const dy = e.touches[0].clientY - startY, dx = e.touches[0].clientX - startX;
    if (!pulling) {
      if (dy < 10 || Math.abs(dx) > Math.abs(dy)) { if (dy < -2) startY = null; return; }
      if (!atTop() || drag) { startY = null; return; }
      pulling = true;
    }
    e.preventDefault(); // hold the page while pulling
    set(Math.min(MAX, dy * 0.5));
  }, { passive: false });
  function end() {
    if (pulling) { dist >= TH ? refresh() : reset(); }
    startY = null; pulling = false;
  }
  document.addEventListener("touchend", end);
  document.addEventListener("touchcancel", end);
}
function recHtml(o, i, dist, added) {
  const city = findDay(recCtx.dayId)?.city;
  const official = !!o.url;
  return `<div class="rec">
    <div class="name">${o.name}${added ? ` <span class="rec-added">✓ Added</span>` : ""}</div>
    ${galleryShell(o.mapsQuery || `${o.name} ${city || ""}`)}
    <div class="row">
      ${dist != null ? `<span class="pill dist">📍 ${fmtKm(dist)}</span>` : ""}
      ${o.rating ? `<span class="stars">${stars(o.rating)}</span>` : ""}
      ${o.area ? `<span class="pill">📍 ${o.area}</span>` : ""}
      ${o.type ? `<span class="pill">${o.type}</span>` : ""}
      ${o.price ? `<span class="pill">${o.price}</span>` : ""}
      ${o.booking ? `<span class="pill book">🎟️ ${o.booking}</span>` : ""}
    </div>
    ${o.why ? `<div class="why">${o.why}</div>` : ""}
    ${o.desc ? `<div class="desc">${o.desc}</div>` : ""}
    <div class="rec-actions">
      <a class="reclink" href="${recLink(o, city)}" target="_blank" rel="noopener">${official ? "Official site ↗" : "View on map ↗"}</a>
      <button class="add" data-add="${i}">＋ Add to ${SLOT_LABEL[recCtx.slot]}</button>
    </div>
  </div>`;
}
// Pull a name + coordinates out of a pasted Google Maps URL (best-effort; full
// /maps/place/... links carry coords, short maps.app.goo.gl links don't).
function parseGoogleMapsUrl(s) {
  if (!/^https?:\/\//i.test(s) || !/google\.[^/]+\/maps|maps\.app\.goo\.gl|maps\.google|goo\.gl\/maps/i.test(s)) return null;
  let name = "", lat = null, lng = null;
  const pm = s.match(/\/place\/([^/@?]+)/);
  if (pm) name = decodeURIComponent(pm[1].replace(/\+/g, " ")).trim();
  const cm = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll|center)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (cm) { lat = +cm[1]; lng = +cm[2]; }
  if (!name) {
    const qm = s.match(/[?&](?:q|query)=([^&]+)/);
    if (qm) { const v = decodeURIComponent(qm[1].replace(/\+/g, " ")); if (!/^-?\d+\.\d+\s*,/.test(v)) name = v.trim(); }
  }
  return { name, lat, lng, url: s, readable: !!(name || lat != null) };
}
// Add a custom (your-own) event to a part-of-day as a 1-hour chunk. You can type
// a name OR paste a Google Maps link — we pull the place name/coords from it and
// store it like a suggestion (with a map link + photo gallery). Geocodes by name
// if the link/name has no coordinates.
function addCustomEvent(dayId, slot) {
  const input = (prompt(`Add to the ${SLOT_LABEL[slot]} — type a place, or paste a Google Maps link:`) || "").trim();
  if (!input) return;
  const isUrl = /^https?:\/\//i.test(input);
  const g = parseGoogleMapsUrl(input);
  if (isUrl && (!g || !g.readable)) {
    alert("Couldn't read that link. Open the place in Google Maps and paste the full URL from the address bar — short links like maps.app.goo.gl can't be read.");
    return;
  }
  const d = findDay(dayId);
  let block = d.blocks.find((b) => b.slot === slot);
  if (!block) { block = { slot, items: [] }; d.blocks.push(block); }
  const item = (g && g.readable)
    ? { id: uid(), name: g.name || "Pinned location", type: "", rating: null, area: "", price: "", notes: "", booking: "", url: g.url, gq: g.name || "", locked: false, lat: g.lat, lng: g.lng }
    : { id: uid(), name: input, type: "", rating: null, area: "", price: "", notes: "", booking: "", locked: false, lat: null, lng: null };
  block.items.push(item);
  saveTrip(); renderDay(); renderItinerary();
  if (item.lat == null) {
    geocode(g ? g.name : `${item.name} ${d.city}`).then((c) => { if (c) { item.lat = c.lat; item.lng = c.lng; saveTrip(); renderDay(); } });
  }
}
async function addRec(i) {
  const o = window.__recs[i];
  if (!o) return;
  const d = findDay(recCtx.dayId);
  let block = d.blocks.find((b) => b.slot === recCtx.slot);
  if (!block) { block = { slot: recCtx.slot, items: [] }; d.blocks.push(block); }
  const item = {
    id: uid(), name: o.name, type: o.type || (recMode === "food" ? "food" : "experience"),
    rating: o.rating || null, area: o.area || "", price: o.price || "",
    notes: o.why || "", desc: o.desc || "", booking: o.booking || "", url: o.url || recLink(o, d.city),
    gq: o.mapsQuery || `${o.name} ${d.city}`,
    locked: false, lat: o.lat ?? null, lng: o.lng ?? null,
  };
  block.items.push(item);
  saveTrip();
  closeSheet();
  renderDay(); renderItinerary();
  // Coordinates are baked into SEED_RECS; only geocode if one slipped through.
  if (item.lat == null || item.lng == null) {
    geocode(o.mapsQuery || `${o.name} ${d.city}`).then((c) => {
      if (c) { item.lat = c.lat; item.lng = c.lng; saveTrip(); }
    });
  }
}

async function geocode(q) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { "Accept-Language": "en" },
    });
    const arr = await r.json();
    if (arr && arr[0]) return { lat: +arr[0].lat, lng: +arr[0].lon };
  } catch {}
  return null;
}

/* ===== Map view ===== */
let map, layer, userMarker, routeLine;
function initMap() {
  if (map) return;
  map = L.map("map", { zoomControl: true }).setView([35.68, 139.77], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap",
  }).addTo(map);
  layer = L.layerGroup().addTo(map);
  // locate control
  const Locate = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function () {
      const b = L.DomUtil.create("button", "");
      b.innerHTML = "📍"; b.title = "My location";
      b.style.cssText = "width:34px;height:34px;font-size:16px;background:#fff;border:none;border-radius:6px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3)";
      L.DomEvent.on(b, "click", (e) => { L.DomEvent.stop(e); locateMe(); });
      return b;
    },
  });
  map.addControl(new Locate());
}
function drawMap() {
  initMap();
  layer.clearLayers();
  const days = filteredDays().filter((d) => d.city !== "Transit");
  const pts = [];
  // hotels
  const hotelCities = [...new Set(days.map((d) => d.city))];
  hotelCities.forEach((c) => {
    const h = trip.hotels[c];
    if (h) {
      L.marker([h.lat, h.lng], { icon: dot("#2f2a24") }).addTo(layer)
        .bindPopup(`<b>🏨 ${h.name}</b>`);
      pts.push([h.lat, h.lng]);
    }
  });
  // activities
  days.forEach((d) => {
    d.blocks.forEach((b) => b.items.forEach((it) => {
      if (!it.lat || !it.lng) return;
      const color = it.locked ? "#b15c38" : "#b8ae9c";
      L.marker([it.lat, it.lng], { icon: dot(color) }).addTo(layer)
        .bindPopup(`<b>${it.name}</b><br>${fmtDate(d.date, d.weekday)} · ${SLOT_LABEL[b.slot] || ""}` +
          `${it.rating ? `<br>★ ${it.rating}` : ""}` +
          `<br><a href="#" onclick="navigateById('${d.id}','${b.slot}','${it.id || ""}');return false;">🧭 Directions</a>`);
      pts.push([it.lat, it.lng]);
    }));
  });
  if (pts.length) map.fitBounds(pts, { padding: [40, 40] });
  setTimeout(() => map.invalidateSize(), 80);
}
function dot(color) {
  return L.divIcon({
    className: "", iconSize: [16, 16], iconAnchor: [8, 8],
    html: `<div style="width:16px;height:16px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
  });
}
window.navigateById = (dayId, slot, itemId) => {
  const d = findDay(dayId); ensureIds(d);
  const it = d.blocks.find((b) => b.slot === slot)?.items.find((x) => x.id === itemId);
  if (it) navigateTo(it);
};

function navigateTo(it) {
  if (!it.lat || !it.lng) { alert("No map location yet for this stop."); return; }
  switchView("map");
  initMap();
  setTimeout(() => {
    map.invalidateSize();
    map.setView([it.lat, it.lng], 15);
    if (!navigator.geolocation) { openExternal(it); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const u = [pos.coords.latitude, pos.coords.longitude];
        if (userMarker) userMarker.remove();
        if (routeLine) routeLine.remove();
        userMarker = L.marker(u, { icon: dot("#5b8aa6") }).addTo(map).bindPopup("You are here");
        routeLine = L.polyline([u, [it.lat, it.lng]], { color: "#5b8aa6", weight: 4, opacity: .7, dashArray: "6 8" }).addTo(map);
        map.fitBounds([u, [it.lat, it.lng]], { padding: [60, 60] });
        const km = haversine(u[0], u[1], it.lat, it.lng).toFixed(1);
        L.popup().setLatLng([it.lat, it.lng])
          .setContent(`<b>${it.name}</b><br>~${km} km away<br><a href="${mapsUrl(u, it)}" target="_blank">Open turn-by-turn ↗</a>`)
          .openOn(map);
      },
      () => openExternal(it),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, 120);
}
function openExternal(it) {
  L.popup().setLatLng([it.lat, it.lng])
    .setContent(`<b>${it.name}</b><br><a href="${mapsUrl(null, it)}" target="_blank">Open in Maps ↗</a>`)
    .openOn(map);
}
function mapsUrl(from, it) {
  const dest = `${it.lat},${it.lng}`;
  if (from) return `https://www.google.com/maps/dir/?api=1&origin=${from[0]},${from[1]}&destination=${dest}&travelmode=transit`;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=transit`;
}
function locateMe() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    const u = [pos.coords.latitude, pos.coords.longitude];
    if (userMarker) userMarker.remove();
    userMarker = L.marker(u, { icon: dot("#5b8aa6") }).addTo(map).bindPopup("You are here").openPopup();
    map.setView(u, 14);
  });
}
function haversine(la1, lo1, la2, lo2) {
  const R = 6371, dLa = (la2 - la1) * Math.PI / 180, dLo = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ===== View switching (pure DOM; navigation is the router's job) ===== */
let currentView = "itinerary";
function switchView(v) {
  currentView = v;
  document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
  document.getElementById("view-" + v).classList.add("active");
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === v || (v === "day" && t.dataset.view === "itinerary")));
  if (v === "map") drawMap();
  window.scrollTo(0, 0);
}

/* ===== Hash router + breadcrumbs ===== */
// Single source of truth = location.hash. Changing the hash pushes a history
// entry, so browser Back/Forward "just work"; route() renders whatever the hash
// says. Hashes: "" / "itinerary" → list, "map" → map, "<dayId>" → that day.
function navigate(hash) {
  hash = hash || "itinerary";
  if (location.hash.slice(1) === hash) route();   // same hash → re-render
  else location.hash = hash;                        // else push history → hashchange → route
}
function route() {
  const h = location.hash.slice(1);
  if (h === "map") { switchView("map"); }
  else if (h && findDay(h)) { currentDayId = h; renderDay(); switchView("day"); }
  else { currentDayId = null; switchView("itinerary"); }
  renderCrumbs();
}
function renderCrumbs() {
  const el = document.getElementById("crumbs");
  const crumb = (label, hash, current) =>
    current ? `<span class="crumb current" aria-current="page">${label}</span>`
            : `<button class="crumb" data-go="${hash}">${label}</button>`;
  let parts = [];
  if (currentView === "day") {
    const d = findDay(currentDayId);
    parts = [crumb("Itinerary", "itinerary", false),
             crumb(d ? `${d.city === "Transit" ? "Travel" : d.city} · ${fmtDate(d.date, d.weekday)}` : "Day", "", true)];
  } else if (currentView === "map") {
    parts = [crumb("Itinerary", "itinerary", false), crumb("Map", "", true)];
  } else {
    parts = [crumb("Itinerary", "", true)];
  }
  // Right-aligned full-trip map toggle (replaces the old bottom tab bar).
  const mapBtn = currentView === "map"
    ? `<button class="crumb-map" data-go="itinerary">✕ Close map</button>`
    : `<button class="crumb-map" data-go="map">🗺 Map</button>`;
  el.innerHTML = `<span class="crumb-path">${parts.join('<span class="crumb-sep">›</span>')}</span>${mapBtn}`;
  el.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => navigate(b.dataset.go));
}

/* ===== Init ===== */
function renderAll() { renderHeader(); renderItinerary(); }
document.getElementById("sheet-close").onclick = closeSheet;
document.querySelector(".sheet-backdrop").onclick = closeSheet;
initLightbox();
initPullToRefresh();
document.getElementById("view-day").addEventListener("pointerdown", onDragDown);
// Left/right arrows page between days (when in a day view and no lightbox open).
document.addEventListener("keydown", (e) => {
  if (currentView !== "day") return;
  if (!document.getElementById("lightbox").classList.contains("hidden")) return;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  let list = filteredDays();
  if (!list.some((x) => x.id === currentDayId)) list = trip.days;
  const pos = list.findIndex((x) => x.id === currentDayId);
  const target = e.key === "ArrowLeft" ? list[pos - 1] : list[pos + 1];
  if (target) { e.preventDefault(); navigate(target.id); }
});
trip.days.forEach(ensureIds); saveTrip();
renderAll();
window.addEventListener("hashchange", route);
window.__onUnlock = () => route();   // re-render after gate unlock so the day map sizes correctly
route();   // honour any deep-link hash on load
if (window.Cloud) Cloud.init(applyRemoteTrip, () => trip);   // shared cloud sync (no-op unless configured)
