/* Lightweight password gate.
 *
 * Only the SHA-256 HASH of the password is stored here — never the plaintext.
 * On submit we hash the entry and compare. A correct entry stores the hash in
 * localStorage so you stay unlocked on this device.
 *
 * NOTE: this is a soft gate on a *public* static site — it keeps casual visitors
 * out, but anyone technical can read the page source / data files directly. It
 * is NOT real security. That's why all genuinely private data (booking
 * confirmation codes, seat numbers) was removed from the app entirely.
 */
(function () {
  var HASH = "f7efb05fcc85dffef87efba53223d110be6b0256ffc41a815c19292920ce3d9f";
  var KEY = "trip-auth-v1";

  var authed = false;
  try { authed = localStorage.getItem(KEY) === HASH; } catch (e) {}
  if (!authed) document.documentElement.classList.add("locked"); // hide app until unlocked (no flash)

  async function sha256(str) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }
  onReady(function () {
    var form = document.getElementById("gate-form");
    if (!form) return;
    var pw = document.getElementById("gate-pw");
    var err = document.getElementById("gate-err");
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var h = await sha256(pw.value);
      if (h === HASH) {
        try { localStorage.setItem(KEY, h); } catch (e) {}
        pw.value = "";
        document.documentElement.classList.remove("locked");
        if (window.__onUnlock) window.__onUnlock(); // re-render now that views are visible (sizes the map)
      } else {
        err.textContent = "Incorrect password. Try again.";
        pw.select();
      }
    });
  });
})();
