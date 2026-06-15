/* ===== State & persistence ===== */
const LS_KEY = "asia-trip-2026-v2";
let trip = loadTrip();
let cityFilter = "All";
let currentDayId = null;
let recCtx = null; // { dayId, slot }
let recMode = "todo"; // 'todo' | 'food'
let recQuery = ""; // suggestion search text

function loadTrip() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return structuredClone(window.SEED_TRIP);
}
function saveTrip() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(trip)); } catch {}
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
const SLOT_HINT = { morning: "from 09:00", lunch: "from 12:00", afternoon: "from 14:00", evening: "from 18:00" };
const SLOT_BASE = { morning: 9 * 60, lunch: 12 * 60, afternoon: 14 * 60, evening: 18 * 60 };
const DUR_BY_TYPE = { experience: 180, sight: 120, museum: 120, park: 90, food: 75, shopping: 90, transit: 120 };
const uid = () => "x" + Math.random().toString(36).slice(2, 9);
const stars = (r) => (r ? "★ " + Number(r).toFixed(1) : "");
const fmtKm = (km) => (km >= 10 ? Math.round(km) : km < 1 ? km.toFixed(1) : km.toFixed(1)) + " km";
const itemDur = (it) => it.dur || DUR_BY_TYPE[it.type] || 90;
function fmtHM(min) {
  min = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
function parseHM(s) {
  const m = /^(\d{1,2}):?(\d{2})$/.exec((s || "").trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
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

  // Calendar: one section per part-of-day, each a timeline of timed events.
  const body = SLOTS.map((slot) => {
    const rows = sched.filter((s) => s.slot === slot);
    const events = rows.map((s) => calEvent(d, s, prevOf[s.it.id])).join("");
    const suggest = isTransit ? "" : `<button class="suggest" data-rec="${slot}">✨ Suggest</button>`;
    const empty = rows.length ? "" : `<button class="cal-empty" data-rec="${slot}">＋ Add something to the ${SLOT_LABEL[slot].toLowerCase()}</button>`;
    return `<section class="cal-slot">
      <div class="cal-slot-head">
        <div><span class="cal-slot-name">${SLOT_LABEL[slot]}</span><span class="cal-slot-hint">${SLOT_HINT[slot]}</span></div>
        ${suggest}
      </div>
      <div class="cal-track" data-slot="${slot}">${events || empty}</div>
    </section>`;
  }).join("");

  el.innerHTML = head + dayRouteMap(d) + dayNav + primer + `<div class="cal">${body}</div>` + dayNav;
  el.querySelector(".back").onclick = () => (history.length > 1 ? history.back() : navigate("itinerary"));
  el.querySelectorAll(".day-nav [data-go]").forEach((b) => b.onclick = () => navigate(b.dataset.go));
  el.querySelectorAll("[data-rec]").forEach((b) => b.onclick = () => openRecommend(d.id, b.dataset.rec));
  el.querySelectorAll("[data-act]").forEach((b) => b.onclick = () => itemAction(b.dataset.act, b.dataset.day, b.dataset.slot, b.dataset.item));
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
// One timed event on the calendar: a time rail on the left + a card.
function calEvent(d, s, prev) {
  const it = s.it;
  const meta = [it.area ? `📍 ${it.area}` : "", it.price || "", it.rating ? stars(it.rating) : ""]
    .filter(Boolean).map((x) => `<span>${x}</span>`).join("");
  const a = (act, label, cls = "") =>
    `<button class="ev-act ${cls}" data-act="${act}" data-day="${d.id}" data-slot="${s.slot}" data-item="${it.id}">${label}</button>`;
  const draggable = it.type !== "transit";
  const book = bookingLink(it, d.city);
  const fromName = prev ? prev.name.replace(/\s*\(.*$/, "").trim() : "";
  const fromShort = fromName.length > 26 ? fromName.slice(0, 24) + "…" : fromName;
  const showTransit = prev && it.lat != null && it.type !== "transit";
  return `<article class="cal-ev ${it.locked ? "locked" : ""} ${it.type === "transit" ? "is-transit" : ""}" data-day="${d.id}" data-slot="${s.slot}" data-item="${it.id}">
    <div class="ev-rail"><span class="ev-time">${fmtHM(s.start)}</span><span class="ev-dot"></span><span class="ev-time end">${fmtHM(s.end)}</span></div>
    <div class="ev-card">
      <div class="ev-top">
        ${draggable ? `<span class="ev-drag" title="Drag to move">⠿</span>` : ""}
        <span class="ev-name">${it.name}</span>${it.type ? `<span class="ev-tag">${it.type}</span>` : ""}
      </div>
      ${it.type === "transit" ? "" : galleryShell(it.gq || it.mapsQuery || `${it.name} ${d.city}`)}
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
function dayRouteMap(d) {
  if (d.city === "Transit") return "";
  const hotel = trip.hotels[d.city];
  const anyCoord = hotel || computeSchedule(d).some((s) => s.it.type !== "transit" && s.it.lat != null);
  if (!anyCoord) return "";
  return `<div class="routemap">
    <div class="routemap-head">
      <span class="routemap-title">Day map</span>
      <div class="routemap-actions">
        <span class="routemap-total" id="rm-total"></span>
        <button class="routemap-toggle" id="rm-toggle">Hide route</button>
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
let dayMap = null, dayRouteLayer = null, routeHidden = false;
const dmHotelIcon = () => L.divIcon({ className: "", iconSize: [22, 22], iconAnchor: [11, 11], html: `<div class="dm-hotel">⌂</div>` });
const dmNumIcon = (n, kind) => L.divIcon({ className: "", iconSize: [22, 22], iconAnchor: [11, 11], html: `<div class="dm-num ${kind === "locked" ? "lock" : "tent"}">${n}</div>` });
const dmDistIcon = (t) => L.divIcon({ className: "", iconSize: [0, 0], iconAnchor: [0, 0], html: `<div class="dm-dist">${t}</div>` });
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
    stops.push({ lat: it.lat, lng: it.lng, kind: it.locked ? "locked" : "tent", name: it.name });
  });
  const places = stops.filter((s) => s.kind !== "hotel");

  const map = L.map(el, {
    zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    boxZoom: false, keyboard: false, touchZoom: false, tap: false,
  });
  dayMap = map;
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
    subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap, © CARTO",
  }).addTo(map);
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
  places.forEach((s, i) => L.marker([s.lat, s.lng], { icon: dmNumIcon(i + 1, s.kind) }).addTo(dayRouteLayer).bindPopup(`${i + 1}. ${s.name}`));
  if (!routeHidden) dayRouteLayer.addTo(map);

  const totalEl = document.getElementById("rm-total");
  if (totalEl) totalEl.textContent = places.length ? `≈ ${fmtKm(total)} · ${places.length} stop${places.length === 1 ? "" : "s"}` : "";
  const foot = document.getElementById("rm-foot");
  if (foot) foot.textContent = places.length ? "Numbered in visiting order · tighter clusters mean less travel" : "Your hotel is marked — add stops to see the route.";
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

  // Fit after the container is visible & sized.
  const fit = () => {
    map.invalidateSize();
    const pts = (routeHidden || stops.length < 2) ? (hotel ? [[hotel.lat, hotel.lng]] : line) : line;
    if (pts.length > 1) map.fitBounds(pts, { padding: [28, 28] });
    else if (pts.length === 1) map.setView(pts[0], 14);
  };
  setTimeout(fit, 60);
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
  else if (act === "time") {
    const cur = typeof it.start === "number" ? fmtHM(it.start) : "";
    const input = prompt(`Start time for “${it.name}” (24h, e.g. 09:30):`, cur);
    if (input === null) return;
    const mins = parseHM(input);
    if (input.trim() === "") { delete it.start; }
    else if (mins == null) { alert("Please enter a time like 09:30."); return; }
    else { it.start = mins; }
    saveTrip(); renderDay();
  }
}

/* ===== Recommend sheet (live AI) ===== */
function openRecommend(dayId, slot) {
  recCtx = { dayId, slot };
  recMode = slot === "lunch" ? "food" : "todo";
  recQuery = "";
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
    <div id="rec-results"></div>`;
  const q = bodyEl.querySelector("#rec-q");
  q.oninput = () => { recQuery = q.value; updateRecResults(); };
  bodyEl.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => {
    recMode = b.dataset.mode;
    bodyEl.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("active", x.dataset.mode === recMode));
    updateRecResults();
  });
  updateRecResults();
  if (recQuery) q.focus();
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
  let options = pool.filter((o) => !already.has((o.name || "").toLowerCase()));
  if (terms.length) {
    options = options.filter((o) => {
      const hay = `${o.name} ${o.area || ""} ${o.type || ""} ${o.why || ""} ${o.desc || ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  // Distance sort: order by proximity to what's already planned in earlier slots
  // this day (or the hotel if nothing yet). Options with coords come first.
  const ref = dayReferencePoints(d, recCtx.slot);
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
    ? ranked.map((x, i) => recHtml(x.o, i, x.dist)).join("")
    : `<div class="empty">${query ? "No places match your search." : "Nothing left to suggest here."}</div>`;
  resultsEl.innerHTML = inner;
  window.__recs = ranked.map((x) => x.o);
  resultsEl.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => addRec(+b.dataset.add));
  hydrateGalleries(resultsEl);
}
// Reference points for distance sorting: locations already chosen in EARLIER
// slots of this day; falls back to the city's hotel.
function dayReferencePoints(d, slot) {
  const idx = SLOTS.indexOf(slot);
  const pts = [];
  d.blocks.forEach((b) => {
    if (SLOTS.indexOf(b.slot) >= idx) return;
    b.items.forEach((it) => { if (it.lat != null && it.lng != null && it.type !== "transit") pts.push({ lat: it.lat, lng: it.lng }); });
  });
  if (pts.length) return { pts, label: "your earlier stops" };
  const h = trip.hotels[d.city];
  if (h) return { pts: [{ lat: h.lat, lng: h.lng }], label: "your hotel" };
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
function recHtml(o, i, dist) {
  const city = findDay(recCtx.dayId)?.city;
  const official = !!o.url;
  return `<div class="rec">
    <div class="name">${o.name}</div>
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
  el.innerHTML = parts.join('<span class="crumb-sep">›</span>');
  el.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => navigate(b.dataset.go));
}

/* ===== Init ===== */
function renderAll() { renderHeader(); renderItinerary(); }
document.querySelectorAll(".tab").forEach((t) => t.onclick = () => navigate(t.dataset.view === "map" ? "map" : "itinerary"));
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
