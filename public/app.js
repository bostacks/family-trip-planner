/* ===== State & persistence ===== */
const LS_KEY = "asia-trip-2026-v1";
let trip = loadTrip();
let cityFilter = "All";
let currentDayId = null;
let recCtx = null; // { dayId, slot }
let recMode = "todo"; // 'todo' | 'food'

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
const uid = () => "x" + Math.random().toString(36).slice(2, 9);
const stars = (r) => (r ? "★ " + Number(r).toFixed(1) : "");
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
    b.onclick = () => { cityFilter = b.dataset.city; renderHeader(); renderItinerary(); if (currentView === "map") drawMap(); }
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
function openDay(id) {
  currentDayId = id;
  renderDay();
  switchView("day");
}
function renderDay() {
  const d = findDay(currentDayId);
  if (!d) return;
  const el = document.getElementById("view-day");
  const blocksHtml = SLOTS.map((slot) => {
    const block = d.blocks.find((b) => b.slot === slot);
    const items = block ? block.items : [];
    return `<div class="block">
      <div class="block-title">
        <span class="slot">${SLOT_LABEL[slot]}</span>
        ${d.city !== "Transit" ? `<button class="btn-rec" data-rec="${slot}">✨ Recommend options</button>` : ""}
      </div>
      ${items.length ? items.map((it) => itemHtml(it)).join("") : `<div class="empty">Nothing here yet — tap “Recommend options”.</div>`}
    </div>`;
  }).join("");

  el.innerHTML = `
    <div class="day-head">
      <button class="back">‹ Back</button>
      <div><h2>${fmtDate(d.date, d.weekday)} · ${d.city}</h2>
      <span class="sub">${d.city !== "Transit" ? (trip.hotels[d.city]?.name || "") : "Travel day"}</span></div>
    </div>
    ${blocksHtml}`;

  el.querySelector(".back").onclick = () => switchView("itinerary");
  el.querySelectorAll("[data-rec]").forEach((b) => b.onclick = () => openRecommend(d.id, b.dataset.rec));
  el.querySelectorAll("[data-act]").forEach((b) => b.onclick = () => itemAction(b.dataset.act, b.dataset.day, b.dataset.slot, b.dataset.item));
}
function itemHtml(it) {
  const d = findDay(currentDayId);
  const slot = d.blocks.find((b) => b.items.includes(it))?.slot;
  return `<div class="item ${it.locked ? "locked" : ""}">
    <div class="item-top">
      <span class="name">${it.name}</span>
      <span class="tag">${it.type || ""}</span>
    </div>
    <div class="row">
      ${it.rating ? `<span class="stars">${stars(it.rating)}</span>` : ""}
      ${it.area ? `<span class="pill">📍 ${it.area}</span>` : ""}
      ${it.price ? `<span class="pill">${it.price}</span>` : ""}
      ${it.booking && it.booking !== "—" ? `<span class="pill book">🎟️ ${it.booking}</span>` : ""}
    </div>
    ${it.notes ? `<div class="notes">${it.notes}</div>` : ""}
    <div class="item-actions">
      ${it.lat ? `<button class="mini go" data-act="go" data-day="${d.id}" data-slot="${slot}" data-item="${it.id || ""}">🧭 Directions</button>` : ""}
      <button class="mini lock ${it.locked ? "on" : ""}" data-act="lock" data-day="${d.id}" data-slot="${slot}" data-item="${it.id || ""}">${it.locked ? "✓ Locked" : "Lock in"}</button>
      <button class="mini del" data-act="del" data-day="${d.id}" data-slot="${slot}" data-item="${it.id || ""}">🗑</button>
    </div>
  </div>`;
}
function ensureIds(day) {
  day.blocks.forEach((b) => b.items.forEach((it) => { if (!it.id) it.id = uid(); }));
}
function itemAction(act, dayId, slot, itemId) {
  const d = findDay(dayId); ensureIds(d);
  const block = d.blocks.find((b) => b.slot === slot);
  const it = block?.items.find((x) => x.id === itemId);
  if (!it) return;
  if (act === "lock") { it.locked = !it.locked; saveTrip(); renderDay(); renderItinerary(); }
  else if (act === "del") { block.items = block.items.filter((x) => x.id !== itemId); saveTrip(); renderDay(); renderItinerary(); }
  else if (act === "go") { navigateTo(it); }
}

/* ===== Recommend sheet (live AI) ===== */
function openRecommend(dayId, slot) {
  recCtx = { dayId, slot };
  recMode = slot === "lunch" ? "food" : "todo";
  document.getElementById("sheet").classList.remove("hidden");
  document.getElementById("sheet-title").textContent = `${SLOT_LABEL[slot]} ideas`;
  fetchRecommendations();
}
function closeSheet() { document.getElementById("sheet").classList.add("hidden"); }

async function fetchRecommendations() {
  const d = findDay(recCtx.dayId);
  const body = {
    city: d.city, date: d.date, weekday: d.weekday, slot: recCtx.slot,
    wantRestaurants: recMode === "food",
    locked: d.blocks.flatMap((b) => b.items).filter((i) => i.locked).map((i) => i.name),
    near: trip.hotels[d.city] ? { lat: trip.hotels[d.city].lat, lng: trip.hotels[d.city].lng, label: trip.hotels[d.city].name } : null,
  };
  const bodyEl = document.getElementById("sheet-body");
  bodyEl.innerHTML = `
    <div class="rec-toolbar">
      <button class="${recMode === "todo" ? "active" : ""}" data-mode="todo">Things to do</button>
      <button class="${recMode === "food" ? "active" : ""}" data-mode="food">Restaurants</button>
    </div>
    <div class="loading"><div class="spinner"></div>Researching live options in ${d.city}…</div>`;
  bodyEl.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => { recMode = b.dataset.mode; fetchRecommendations(); });

  try {
    const res = await fetch("/api/recommend", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    renderRecs(data);
  } catch (e) {
    renderRecs({ options: [], usedAI: false, note: "Could not reach the recommendation service. Is the server running?" });
  }
}
function renderRecs(data) {
  const bodyEl = document.getElementById("sheet-body");
  const toolbar = `
    <div class="rec-toolbar">
      <button class="${recMode === "todo" ? "active" : ""}" data-mode="todo">Things to do</button>
      <button class="${recMode === "food" ? "active" : ""}" data-mode="food">Restaurants</button>
    </div>`;
  let inner = "";
  if (data.note) inner += `<div class="notice">${data.note}</div>`;
  if (!data.options || !data.options.length) {
    inner += `<div class="empty">No options returned. Try again, or switch mode.</div>`;
  } else {
    inner += data.options.map((o, i) => recHtml(o, i)).join("");
  }
  bodyEl.innerHTML = toolbar + inner;
  bodyEl.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => { recMode = b.dataset.mode; fetchRecommendations(); });
  // stash options for add
  window.__recs = data.options || [];
  bodyEl.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => addRec(+b.dataset.add));
}
function recHtml(o, i) {
  return `<div class="rec">
    <div class="name">${o.name}</div>
    <div class="row">
      ${o.rating ? `<span class="stars">${stars(o.rating)}</span>` : ""}
      ${o.area ? `<span class="pill">📍 ${o.area}</span>` : ""}
      ${o.type ? `<span class="pill">${o.type}</span>` : ""}
      ${o.price ? `<span class="pill">${o.price}</span>` : ""}
      ${o.booking ? `<span class="pill book">🎟️ ${o.booking}</span>` : ""}
    </div>
    ${o.why ? `<div class="why">${o.why}</div>` : ""}
    <button class="add" data-add="${i}">＋ Add to ${SLOT_LABEL[recCtx.slot]}</button>
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
    notes: o.why || "", booking: o.booking || "", locked: false, lat: null, lng: null,
  };
  block.items.push(item);
  saveTrip();
  closeSheet();
  renderDay(); renderItinerary();
  // geocode in background so it shows on the map
  geocode(o.mapsQuery || `${o.name} ${d.city}`).then((c) => {
    if (c) { item.lat = c.lat; item.lng = c.lng; saveTrip(); }
  });
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
      L.marker([h.lat, h.lng], { icon: dot("#0f172a") }).addTo(layer)
        .bindPopup(`<b>🏨 ${h.name}</b>`);
      pts.push([h.lat, h.lng]);
    }
  });
  // activities
  days.forEach((d) => {
    d.blocks.forEach((b) => b.items.forEach((it) => {
      if (!it.lat || !it.lng) return;
      const color = it.locked ? "#10b981" : "#6366f1";
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
        userMarker = L.marker(u, { icon: dot("#0ea5e9") }).addTo(map).bindPopup("You are here");
        routeLine = L.polyline([u, [it.lat, it.lng]], { color: "#0ea5e9", weight: 4, opacity: .7, dashArray: "6 8" }).addTo(map);
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
    userMarker = L.marker(u, { icon: dot("#0ea5e9") }).addTo(map).bindPopup("You are here").openPopup();
    map.setView(u, 14);
  });
}
function haversine(la1, lo1, la2, lo2) {
  const R = 6371, dLa = (la2 - la1) * Math.PI / 180, dLo = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ===== View switching ===== */
let currentView = "itinerary";
function switchView(v) {
  currentView = v;
  document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
  document.getElementById("view-" + v).classList.add("active");
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === v || (v === "day" && t.dataset.view === "itinerary")));
  if (v === "map") drawMap();
  window.scrollTo(0, 0);
}

/* ===== Init ===== */
function renderAll() { renderHeader(); renderItinerary(); }
document.querySelectorAll(".tab").forEach((t) => t.onclick = () => switchView(t.dataset.view));
document.getElementById("sheet-close").onclick = closeSheet;
document.querySelector(".sheet-backdrop").onclick = closeSheet;
trip.days.forEach(ensureIds); saveTrip();
renderAll();
