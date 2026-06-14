import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");

// Minimal .env loader (no dependencies). Lines like KEY=value; existing
// process.env wins so inline `KEY=... node server.js` still overrides the file.
function loadEnv(file = path.join(__dirname, ".env")) {
  let raw;
  try { raw = fs.readFileSync(file, "utf8"); } catch { return; }
  for (let line of raw.split("\n")) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const PORT = process.env.PORT || 8080;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/health") {
    return json(res, 200, { ok: true, ai: !!ANTHROPIC_KEY });
  }
  if (url.pathname === "/api/recommend" && req.method === "POST") {
    return handleRecommend(req, res);
  }

  // static
  let p = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(PUBLIC, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
  if (!filePath.startsWith(PUBLIC)) return notFound(res);
  fs.readFile(filePath, (err, data) => {
    if (err) return notFound(res);
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});

function notFound(res) { res.writeHead(404); res.end("Not found"); }
function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } });
  });
}

async function handleRecommend(req, res) {
  const body = await readBody(req);
  const {
    city = "", date = "", weekday = "", slot = "afternoon",
    locked = [], wantRestaurants = false, near = null,
  } = body;

  if (!ANTHROPIC_KEY) {
    return json(res, 200, {
      options: [], usedAI: false,
      note: "No ANTHROPIC_API_KEY set, so live AI research is off. Add the key to .env (local) or run `fly secrets set ANTHROPIC_API_KEY=...` (deployed) to enable recommendations.",
    });
  }

  const kind = wantRestaurants ? "restaurants / places to eat" : "activities or sights";
  const lockedList = locked.length ? locked.join("; ") : "nothing locked in yet";
  const nearStr = near?.label
    ? `The travellers are based near: ${near.label} (lat ${near.lat}, lng ${near.lng}).`
    : near ? `The travellers are near lat ${near.lat}, lng ${near.lng}.` : "";

  const prompt = `You are a family travel concierge doing live web research. Recommend ${kind} in ${city} for the ${slot} of ${weekday} ${date}.

Trip context: a family of 5 — two adults and three kids aged 12, 10 and 7. They want options that work for adults and kids, are not exhausting, and fit around what's already planned.

Already locked in for this day: ${lockedList}.
${nearStr}

Use web search to verify places are currently open, and to get up-to-date ratings, prices, and booking/reservation requirements. Prefer options close to what's already locked in and don't duplicate them.

Return ONLY a JSON object, no prose, in exactly this shape:
{"options":[{"name":"","type":"sight|museum|park|food|shopping|experience","area":"neighborhood","why":"one sentence on why it fits this family/day","rating":4.5,"price":"$/$$/$$$ or free","booking":"how to book or 'walk-in'","mapsQuery":"name + city for map lookup"}]}

Give 5 options. Ratings are numbers out of 5.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return json(res, 502, { options: [], usedAI: false, note: `Anthropic API error ${r.status}: ${text.slice(0, 300)}` });
    }
    const data = await r.json();
    const textOut = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return json(res, 200, { options: extractOptions(textOut), usedAI: true });
  } catch (err) {
    return json(res, 500, { options: [], usedAI: false, note: String(err) });
  }
}

function extractOptions(text) {
  if (!text) return [];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(obj.options) ? obj.options : [];
  } catch { return []; }
}

server.listen(PORT, () => {
  console.log(`Trip planner on http://localhost:${PORT}  (AI: ${ANTHROPIC_KEY ? "on" : "off"})`);
});
