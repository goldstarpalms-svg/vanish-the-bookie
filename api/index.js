import { demoFixtures, demoArchive } from "../server/fixtures.js";
import { predict, gradePrediction, MODEL_VERSION } from "../server/model.js";
import { fetchLivePredictions, fetchMultiSourcePredictions, fetchFreeFallback } from "../server/live-provider.js";

const MODE = process.env.DATA_MODE || "demo";
const LIVE_REFRESH_MINUTES = Math.min(1440, Math.max(15, Number(process.env.LIVE_REFRESH_MINUTES || 360)));
const config = {
  key: process.env.ODDS_API_KEY,
  sportKeys: (process.env.LIVE_SPORT_KEYS || "baseball_mlb,basketball_wnba,soccer_fa_cup,icehockey_liiga").split(",").map(s=>s.trim()).filter(Boolean),
  regions: process.env.ODDS_REGIONS || "us",
};

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
        if (!config.key) throw new Error("ODDS_API_KEY is not set");
        let incoming;
        let usedFallback = false;
        try {
          incoming = await fetchMultiSourcePredictions(config);
        } catch (e) {
          console.warn(`Live fetch failed (${e.message}), trying free fallback...`);
          if (e.message.includes("401") || e.message.includes("429") || e.message.includes("quota") || e.message.includes("OUT_OF_USAGE")) {
            try {
              incoming = await fetchFreeFallback();
              usedFallback = true;
              cache.warnings = [e.message, "Showing free sources (ESPN, MLB, TheSportsDB) - no quota needed. Get new free key at the-odds-api.com for market odds."];
              console.log(`Free fallback: ${incoming.length} games`);
            } catch (fallbackError) {
              throw new Error(`${e.message} - Free fallback failed: ${fallbackError.message}`);
            }
          } else {
            throw e;
          }
        }
        cache.predictions = incoming;
        cache.records = [];
        if (!usedFallback) cache.warnings = [];
      }
      cache.generatedAt = new Date().toISOString();
      cache.error = null;
    } catch (e) {
      // On 401/429, keep old cache if available, don't break site
      if (e.message.includes("401") || e.message.includes("429") || e.message.includes("quota")) {
        if (cache.predictions.length > 0) {
          console.log(`Keeping ${cache.predictions.length} cached games due to ${e.message.slice(0,100)}`);
          cache.warnings = [e.message, "Showing cached games. Quota exceeded - get new free key at the-odds-api.com or wait for reset."];
          // Don't set error, keep stale as false to show cached data
          cache.error = null;
        } else {
          // No cache, try free fallback
          try {
            console.log("No cache, trying free fallback...");
            cache.predictions = await fetchFreeFallback();
            cache.warnings = [e.message, "Showing free sources (no quota needed)"];
            cache.error = null;
          } catch {
            cache.error = e.message;
          }
        }
      } else {
        cache.error = e.message;
      }
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
      warnings: cache.warnings || [],
      source: MODE === "demo" ? "Synthetic fixtures" : cache.predictions[0]?.region?.includes("Free") ? `Free sources (ESPN, MLB, TheSportsDB) + Vanish Model - ${cache.predictions.length} games (no quota)` : `The Odds API + Vanish Model - ${cache.predictions.length} games (4 leagues, 1 region, 360min = 480 credits/month)`,
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
    return res.json({ ok: !d.meta.error, mode: d.meta.mode, generatedAt: d.meta.generatedAt, modelVersion: MODEL_VERSION, games: d.predictions.length, error: d.meta.error, warnings: d.meta.warnings });
  }
  if (path === "/api/dashboard") {
    res.setHeader("Cache-Control","no-store");
    const d = await getDashboard();
    return res.json(d);
  }
  if (path === "/api/demo/refresh" && req.method === "POST") {
    if (MODE !== "demo") return res.status(403).json({ error: "Live refresh is scheduled server-side" });
    cache.generatedAt = null;
    const d = await getDashboard();
    return res.json(d);
  }
  return res.status(404).json({ error: "Not found" });
}
