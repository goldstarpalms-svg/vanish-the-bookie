import { demoFixtures, demoArchive } from "../server/fixtures.js";
import { predict, gradePrediction, MODEL_VERSION } from "../server/model.js";
import { fetchLivePredictions, fetchMultiSourcePredictions } from "../server/live-provider.js";

const MODE = process.env.DATA_MODE || "demo";
const LIVE_REFRESH_MINUTES = Math.min(1440, Math.max(15, Number(process.env.LIVE_REFRESH_MINUTES || 60)));
const config = {
  key: process.env.ODDS_API_KEY,
  sportKeys: (process.env.LIVE_SPORT_KEYS || "aussierules_aflw,baseball_milb,baseball_mlb,basketball_nbl,basketball_wnba,boxing_boxing,cricket_odi,icehockey_liiga,icehockey_mestis,icehockey_sweden_allsvenskan,icehockey_sweden_hockey_league,mma_mixed_martial_arts,soccer_brazil_serie_b,soccer_fa_cup,soccer_uefa_champs_league_women,soccer_usa_mls,tennis_wta_singapore_open").split(",").map(s=>s.trim()).filter(Boolean),
  regions: process.env.ODDS_REGIONS || "us,uk",
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
        if (!config.key) throw new Error("ODDS_API_KEY is not set. Add it in Vercel Environment Variables.");
        let incoming;
        try {
          incoming = await fetchMultiSourcePredictions(config);
        } catch (e) {
          console.warn("Multi-source failed, fallback to single:", e.message);
          incoming = await fetchLivePredictions(config);
        }
        cache.predictions = incoming;
        cache.records = [];
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
      source: MODE === "demo" ? "Synthetic fixtures and ratings" : `The Odds API + MLB Stats API + ESPN (76 games today across 17 leagues) - ${cache.predictions.length} live`,
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
    return res.json({ ok: !d.meta.error, mode: d.meta.mode, generatedAt: d.meta.generatedAt, modelVersion: MODEL_VERSION, games: d.predictions.length });
  }
  if (path === "/api/dashboard") {
    res.setHeader("Cache-Control","no-store");
    const d = await getDashboard();
    return res.json(d);
  }
  if (path === "/api/demo/refresh" && req.method === "POST") {
    if (MODE !== "demo") return res.status(403).json({ error: "Live refresh is scheduled server-side to protect provider quota." });
    cache.generatedAt = null;
    const d = await getDashboard();
    return res.json(d);
  }
  return res.status(404).json({ error: "Not found" });
}
