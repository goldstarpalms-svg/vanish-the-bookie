import { demoFixtures, demoArchive } from "../server/fixtures.js";
import { predict, gradePrediction, MODEL_VERSION } from "../server/model.js";
import { fetchLivePredictions } from "../server/live-provider.js";

const MODE = process.env.DATA_MODE || "demo";
const LIVE_REFRESH_MINUTES = Math.min(1440, Math.max(15, Number(process.env.LIVE_REFRESH_MINUTES || 120)));
const config = {
  key: process.env.ODDS_API_KEY,
  sportKeys: (process.env.LIVE_SPORT_KEYS || "soccer_epl,basketball_nba").split(",").map(s=>s.trim()).filter(Boolean),
  regions: process.env.ODDS_REGIONS || "uk",
};

// Simple in-memory cache for Vercel serverless (resets on cold start, which is expected on free tier)
let cache = { predictions: [], records: [], generatedAt: null, error: null, warnings: [] };

function communityUrl() {
  const v = process.env.WHATSAPP_URL || "";
  try {
    const u = new URL(v);
    return u.protocol === "https:" && ["wa.me","chat.whatsapp.com","whatsapp.com","www.whatsapp.com"].includes(u.hostname) ? u.href : null;
  } catch { return null; }
}

async function getDashboard() {
  const now = Date.now();
  const stale = !cache.generatedAt || (now - new Date(cache.generatedAt).getTime() > LIVE_REFRESH_MINUTES * 60000);
  if (stale) {
    try {
      if (MODE === "demo") {
        const dt = new Date();
        cache.predictions = demoFixtures(dt).map(predict);
        cache.records = demoArchive(dt).map(f => {
          const p = predict(f);
          return {
            ...p,
            status: gradePrediction(p.pick, f.result),
            publishedAt: new Date(new Date(f.kickoff).getTime() - 3*3600000).toISOString(),
            settledAt: new Date(new Date(f.kickoff).getTime() + 2*3600000).toISOString(),
          };
        });
      } else {
        // Live on Vercel: market consensus, no persistent archive on free tier
        if (!config.key) throw new Error("ODDS_API_KEY is not set. Add it in Vercel Environment Variables.");
        const incoming = await fetchLivePredictions(config);
        cache.predictions = incoming;
        cache.records = []; // Free tier Vercel has no persistent disk - verified record needs paid storage
      }
      cache.generatedAt = new Date().toISOString();
      cache.error = null;
      cache.warnings = [];
    } catch (e) {
      cache.error = e.message;
    }
  }
  return {
    predictions: cache.predictions,
    records: cache.records,
    meta: {
      mode: MODE,
      modelVersion: MODEL_VERSION,
      generatedAt: cache.generatedAt,
      nextRun: cache.generatedAt ? new Date(new Date(cache.generatedAt).getTime() + LIVE_REFRESH_MINUTES*60000).toISOString() : null,
      refreshMinutes: LIVE_REFRESH_MINUTES,
      timezone: "Africa/Lagos",
      calibrated: false,
      stale: Boolean(cache.error) || !cache.generatedAt,
      error: cache.error,
      warnings: cache.warnings,
      source: MODE === "demo" ? "Synthetic fixtures and ratings" : "The Odds API · normalized market consensus",
      snapshotDate: new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),
    },
    community: { x: "https://x.com/vanishthebookie", whatsapp: communityUrl() },
  };
}

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === "/api/health") {
    const d = await getDashboard();
    return res.json({ ok: !d.meta.error, mode: d.meta.mode, generatedAt: d.meta.generatedAt, modelVersion: MODEL_VERSION });
  }
  if (path === "/api/dashboard") {
    res.setHeader("Cache-Control","no-store");
    const d = await getDashboard();
    return res.json(d);
  }
  if (path === "/api/demo/refresh" && req.method === "POST") {
    if (MODE !== "demo") return res.status(403).json({ error: "Live refresh is scheduled server-side to protect provider quota." });
    cache.generatedAt = null; // force refresh
    const d = await getDashboard();
    return res.json(d);
  }
  return res.status(404).json({ error: "Not found" });
}
