/* ============================================================================
 * Cloud sync layer (Supabase). Shares one trip document across all devices.
 * No-op unless cloud-config.js is filled in. Loads the Supabase SDK lazily.
 *
 * Model: a single row in table `trips` { id, data (jsonb), updated_at, editor }.
 * On start we pull the shared plan; saves are debounced-pushed; a realtime
 * subscription applies other devices' changes (last-write-wins per save).
 * ========================================================================== */
window.Cloud = (function () {
  const cfg = window.CLOUD || {};
  const configured = !!(cfg.url && cfg.anonKey);
  const myId = Math.random().toString(36).slice(2);
  let client = null, onRemote = null, getLocal = null, pushT = null, pending = null;

  function init(remoteCb, localGetter) {
    onRemote = remoteCb; getLocal = localGetter;
    if (!configured) return;
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = start;
    s.onerror = () => console.warn("[Cloud] could not load supabase-js");
    document.head.appendChild(s);
  }
  async function start() {
    try {
      client = window.supabase.createClient(cfg.url, cfg.anonKey);
      const had = await pull();
      if (!had && getLocal) doPush(getLocal());
      client
        .channel("trip-" + cfg.tripId)
        .on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: "id=eq." + cfg.tripId }, (p) => {
          const row = p.new;
          if (!row || row.editor === myId) return; // skip our own writes
          onRemote && onRemote(row.data, false);
        })
        .subscribe();
      window.dispatchEvent(new CustomEvent("cloud-ready"));
    } catch (e) { console.warn("[Cloud] start failed", e); }
  }
  async function pull() {
    try {
      const { data, error } = await client.from("trips").select("data").eq("id", cfg.tripId).maybeSingle();
      if (!error && data && data.data) { onRemote && onRemote(data.data, true); return true; }
    } catch (e) { console.warn("[Cloud] pull failed", e); }
    return false;
  }
  function push(trip) {
    if (!configured || !client) return;
    pending = trip;
    clearTimeout(pushT);
    pushT = setTimeout(() => doPush(pending), 800);
  }
  async function doPush(trip) {
    if (!client || !trip) return;
    try {
      await client.from("trips").upsert({ id: cfg.tripId, data: trip, updated_at: new Date().toISOString(), editor: myId });
    } catch (e) { console.warn("[Cloud] push failed", e); }
  }
  return { configured, init, push };
})();
