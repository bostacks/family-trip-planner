/* ============================================================================
 * Cloud sync (OPTIONAL). Fill these in to share ONE live plan across every
 * device and traveller. Leave blank and the app stays local-only (localStorage).
 *
 * One-time setup (~5 min) — see the "Cloud sync" section in README.md:
 *   1. Create a free project at https://supabase.com
 *   2. In the SQL editor, run the snippet from the README (creates the `trips`
 *      table, opens anon access, and turns on realtime).
 *   3. Settings → API: copy the Project URL and the public "anon" key below.
 *      (The anon key is meant to be public — safe to commit.)
 *   4. Commit + push; everyone who opens the site now shares the same plan.
 * ========================================================================== */
window.CLOUD = {
  url: "https://ozsoucyolnxvbicraptl.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96c291Y3lvbG54dmJpY3JhcHRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NzI2NTEsImV4cCI6MjA5NzA0ODY1MX0.ePIwWELH8HgakjIyC9S0RW8gjXgPNNbxTUVpWeZzGZA",
  tripId: "asia-trip-2026",  // shared id — same id = same shared plan
};
