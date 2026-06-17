/* ===========================================================================
 * Live daily weather forecast — keyless & CORS, from Open-Meteo (same spirit as
 * the keyless Openverse photos and OSM tiles). Fetched per location for the
 * whole forecast window (~16 days) and cached in localStorage so revisits and
 * offline still show the last forecast. Days beyond the forecast horizon simply
 * show no chip. Exposes window.Weather = { shell, hydrate }.
 *   - shell(date, lat, lng) → placeholder HTML injected during render.
 *   - hydrate(root)         → fills every placeholder under `root` (async).
 * ========================================================================== */
(function () {
  const LS = "asia-trip-wx-v1";
  const TTL = 3 * 60 * 60 * 1000; // refetch a given location at most every 3 hours
  let cache = load();
  function load() { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify(cache)); } catch {} }

  // WMO weather interpretation codes → emoji + short label.
  const CODES = {
    0: ["☀️", "Clear"], 1: ["🌤️", "Mainly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Overcast"],
    45: ["🌫️", "Fog"], 48: ["🌫️", "Rime fog"],
    51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌧️", "Heavy drizzle"],
    56: ["🌧️", "Freezing drizzle"], 57: ["🌧️", "Freezing drizzle"],
    61: ["🌦️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"],
    66: ["🌧️", "Freezing rain"], 67: ["🌧️", "Freezing rain"],
    71: ["🌨️", "Light snow"], 73: ["🌨️", "Snow"], 75: ["🌨️", "Heavy snow"], 77: ["🌨️", "Snow grains"],
    80: ["🌦️", "Light showers"], 81: ["🌧️", "Showers"], 82: ["⛈️", "Violent showers"],
    85: ["🌨️", "Snow showers"], 86: ["🌨️", "Snow showers"],
    95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Thunderstorm + hail"], 99: ["⛈️", "Thunderstorm + hail"],
  };
  function describe(code) { return CODES[code] || ["•", "—"]; }

  const keyFor = (lat, lng) => `${(+lat).toFixed(2)},${(+lng).toFixed(2)}`;

  // Fetch (or reuse cached) daily forecast for a location, keyed date → fields.
  async function fetchLoc(lat, lng) {
    const key = keyFor(lat, lng);
    const ent = cache[key];
    if (ent && Date.now() - ent.t < TTL && ent.d) return { t: ent.t, daily: ent.d };
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=16`;
    try {
      const r = await fetch(url);
      if (r.ok) {
        const dd = (await r.json()).daily || {};
        const daily = {};
        (dd.time || []).forEach((date, i) => {
          daily[date] = {
            code: dd.weather_code ? dd.weather_code[i] : null,
            tmax: dd.temperature_2m_max ? dd.temperature_2m_max[i] : null,
            tmin: dd.temperature_2m_min ? dd.temperature_2m_min[i] : null,
            pop: dd.precipitation_probability_max ? dd.precipitation_probability_max[i] : null,
          };
        });
        cache[key] = { t: Date.now(), d: daily };
        save();
        return { t: cache[key].t, daily };
      }
    } catch { /* offline → fall back to whatever was cached */ }
    return ent ? { t: ent.t, daily: ent.d } : { t: null, daily: {} };
  }

  // Human "how long ago" label for the forecast's fetch time.
  function ago(t) {
    if (!t) return "";
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return "just now";
    const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }

  // Placeholder chip; real data is injected by hydrate() after render.
  function shell(date, lat, lng) {
    if (!date || lat == null || lng == null) return "";
    return `<span class="wx" data-wx="${date}" data-lat="${lat}" data-lng="${lng}"><span class="wx-skel"></span></span>`;
  }

  function fill(el, info, t) {
    if (!info || info.code == null || info.tmax == null) { el.remove(); return; } // no forecast → hide chip
    const [ico, label] = describe(info.code);
    const hi = Math.round(info.tmax), lo = Math.round(info.tmin), pop = info.pop;
    const updated = ago(t);
    el.classList.add("ready");
    el.title = `${label}${pop != null ? ` · ${pop}% chance of rain` : ""} (°C)${updated ? ` · updated ${updated}` : ""}`;
    el.innerHTML =
      `<span class="wx-ico">${ico}</span>` +
      `<span class="wx-temp">${hi}°<span class="wx-lo">/${lo}°</span></span>` +
      (pop != null && pop >= 30 ? `<span class="wx-pop">💧${pop}%</span>` : "");
    // In the day-view header, also show the update time visibly beside the chip.
    const host = el.closest(".day-wx");
    if (host && updated) {
      let note = host.querySelector(".wx-updated");
      if (!note) { note = document.createElement("span"); note.className = "wx-updated"; host.appendChild(note); }
      note.textContent = `Updated ${updated}`;
    }
  }

  // Fill every weather placeholder under `root`, one fetch per unique location.
  async function hydrate(root) {
    const els = [...(root || document).querySelectorAll(".wx[data-wx]:not([data-done])")];
    const groups = new Map();
    els.forEach((el) => {
      el.dataset.done = "1";
      const k = `${el.dataset.lat},${el.dataset.lng}`;
      (groups.get(k) || groups.set(k, []).get(k)).push(el);
    });
    for (const [k, list] of groups) {
      const [lat, lng] = k.split(",").map(Number);
      const { t, daily } = await fetchLoc(lat, lng);
      list.forEach((el) => fill(el, daily[el.dataset.wx], t));
    }
  }

  window.Weather = { shell, hydrate, describe };
})();
