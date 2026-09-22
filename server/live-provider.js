import {
  normalizeOdds,
  pickFromProbabilities,
  MODEL_VERSION,
} from "./model.js";
import { liveIndependentModel } from "./live-model.js";
import { fetchAllFreeSources } from "./free-sources.js";

const API_BASE = "https://api.the-odds-api.com/v4";
const COLORS = ["#6da4d9", "#bb9ae3", "#e3aa7b", "#78b9a2", "#d9766d", "#a8d86e"];
function person(name, index) {
  return {
    name,
    short: name.split(" ").map((s) => s[0]).join("").slice(0, 3).toUpperCase(),
    initials: name.split(" ").map((s) => s[0]).join("").slice(0, 2),
    color: COLORS[index % COLORS.length],
  };
}
export function sportCategory(key) {
  if (key.startsWith("soccer_")) return "football";
  if (key.startsWith("basketball_")) return "basketball";
  if (key.startsWith("baseball_")) return "baseball";
  if (key.startsWith("icehockey_")) return "icehockey";
  if (key.startsWith("americanfootball_")) return "americanfootball";
  if (key.startsWith("tennis_")) return "tennis";
  if (key.startsWith("cricket_")) return "cricket";
  if (key.startsWith("rugby") || key.startsWith("aussierules_") || key.startsWith("boxing_") || key.startsWith("mma_") || key.startsWith("handball_")) return "other";
  return null;
}
async function providerFetch(path, key, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  url.search = new URLSearchParams({ ...params, apiKey: key });
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(18000) });
  } catch {
    throw new Error("The sports-data provider could not be reached. Showing cached data.");
  }
  if (response.status === 429) {
    const remaining = response.headers.get("x-requests-remaining");
    const used = response.headers.get("x-requests-used");
    throw new Error(
      `Rate limit reached (429). Used: ${used || "unknown"}, Remaining: ${remaining || "0"}. Free tier is 500 credits/month. Reduce leagues or increase refresh interval. Showing last cached data.`,
    );
  }
  if (!response.ok) {
    // For other errors, keep cache and warn
    throw new Error(
      `Sports-data provider returned HTTP ${response.status}. Showing cached data. Check key and sport keys.`,
    );
  }
  const data = await response.json();
  if (!Array.isArray(data))
    throw new Error("Unexpected response from provider. Showing cached data.");
  return data;
}
export async function eventToPrediction(event) {
  const sport = sportCategory(event.sport_key);
  if (!sport || !event.home_team || !event.away_team) return null;
  const isFootball = sport === "football";
  const expected = [event.home_team, event.away_team, ...(isFootball ? ["Draw"] : [])];
  const snapshots = [];
  const sources = [];
  for (const book of event.bookmakers || []) {
    const market = book.markets?.find((m) => m.key === "h2h");
    if (!market || market.outcomes.length !== expected.length || !expected.every((name) => market.outcomes.some((o) => o.name === name))) continue;
    try {
      snapshots.push(normalizeOdds(market.outcomes));
      sources.push({ name: book.title, updatedAt: market.last_update || book.last_update || null });
    } catch {}
  }
  if (!snapshots.length) return null;
  const mean = (name) => snapshots.reduce((sum, row) => sum + row[name], 0) / snapshots.length;
  const probabilities = {
    home: mean(event.home_team),
    ...(isFootball ? { draw: mean("Draw") } : {}),
    away: mean(event.away_team),
  };
  const home = person(event.home_team, 0), away = person(event.away_team, 1);
  const kickoffDate = new Date(event.commence_time);
  const isToday = kickoffDate.toDateString() === new Date().toDateString() || (kickoffDate - Date.now() < 24*3600000 && kickoffDate > Date.now());
  
  let independentModel = null;
  try {
    independentModel = await liveIndependentModel(event, probabilities);
  } catch {}

  const primaryProbs = independentModel?.probabilities || probabilities;
  const primaryPick = pickFromProbabilities(primaryProbs, home, away);

  return {
    id: event.id,
    sport,
    sportKey: event.sport_key,
    league: event.sport_title,
    region: "Market consensus + Vanish Model",
    kickoff: event.commence_time,
    home,
    away,
    probabilities,
    independentProbabilities: independentModel?.probabilities || null,
    independentModel,
    pick: primaryPick,
    marketPick: pickFromProbabilities(probabilities, home, away),
    vanishPick: independentModel ? pickFromProbabilities(independentModel.probabilities, home, away) : null,
    mode: "live",
    sample: false,
    calibrated: false,
    model: independentModel ? `${independentModel.model} + Market` : "Market consensus",
    modelVersion: MODEL_VERSION,
    publishedAt: new Date().toISOString(),
    sources,
    isToday,
    hasLiveModel: !!independentModel,
    explanation: [
      `MARKET: ${snapshots.length} books → Home ${(probabilities.home*100).toFixed(1)}% ${isFootball ? `Draw ${(probabilities.draw*100).toFixed(1)}% ` : ""}Away ${(probabilities.away*100).toFixed(1)}%`,
      ...(independentModel ? [`VANISH: ${independentModel.model} - ${independentModel.method}`, ...independentModel.explanation.slice(0,2)] : ["Vanish model uses free APIs + Poisson/rating models"]),
    ],
    inputRows: [
      ["Data source", "The Odds API + MLB Stats API + ESPN (free)"],
      ["Complete markets", snapshots.length],
      ["Vanish Model", independentModel?.model || "Market only"],
      ["Sport key", event.sport_key],
    ],
    metrics: [
      { label: "Bookmakers", value: String(snapshots.length) },
      { label: "Market home", value: `${(probabilities.home*100).toFixed(1)}%` },
      { label: "Vanish home", value: independentModel ? `${(independentModel.probabilities.home*100).toFixed(1)}%` : "—" },
    ],
  };
}
export async function fetchLivePredictions({ key, sportKeys, regions = "us" }) {
  if (!key) throw new Error("Live mode needs ODDS_API_KEY");
  if (!sportKeys.length) throw new Error("No sport keys");
  // Filter to only supported and limit to 4 leagues max for free tier
  const limitedKeys = sportKeys.slice(0, 5);
  if (sportKeys.length > 5) {
    console.warn(`Free tier: Limiting from ${sportKeys.length} to 5 leagues to avoid 429. Requested: ${sportKeys.join(",")}`);
  }
  const pages = await Promise.all(
    limitedKeys.map((sport) =>
      providerFetch(`/sports/${encodeURIComponent(sport)}/odds/`, key, {
        regions,
        markets: "h2h",
        oddsFormat: "decimal",
      }),
    ),
  );
  const now = Date.now();
  const flatEvents = pages.flat();
  const predictions = [];
  for (const event of flatEvents) {
    const pred = await eventToPrediction(event);
    if (pred && new Date(pred.kickoff).getTime() > now && new Date(pred.kickoff).getTime() < now + 30 * 86400000) {
      predictions.push(pred);
    }
  }
  return predictions.sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff));
}
export async function fetchLiveScores({ key, sportKeys }) {
  const warnings = [];
  const pages = await Promise.all(
    sportKeys.slice(0,3).map(async (sport) => {
      try {
        return await providerFetch(`/sports/${encodeURIComponent(sport)}/scores/`, key, { daysFrom: "3" });
      } catch (e) {
        if (e.message.includes("429")) {
          warnings.push(`Rate limit (429) - results update paused. Showing cached picks.`);
        } else {
          warnings.push(`Results unavailable for ${sport}`);
        }
        return [];
      }
    }),
  );
  return { events: pages.flat(), warnings };
}
export async function fetchMultiSourcePredictions({ key, sportKeys, regions = "us" }) {
  try {
    const oddsPredictions = await fetchLivePredictions({ key, sportKeys, regions });
    let freeGames = [];
    try {
      freeGames = await fetchAllFreeSources();
    } catch {}
    
    const allGames = [...oddsPredictions];
    const existingKeys = new Set(oddsPredictions.map(p => `${p.home.name}_${p.away.name}_${p.kickoff.slice(0,10)}`.toLowerCase()));
    
    for (const freeGame of freeGames.slice(0, 20)) {
      const dupKey = `${freeGame.home}_${freeGame.away}_${freeGame.kickoff.slice(0,10)}`.toLowerCase();
      if (!existingKeys.has(dupKey)) {
        const home = person(freeGame.home, 0);
        const away = person(freeGame.away, 1);
        const mockEvent = {
          sport_key: freeGame.sportKey,
          sport_title: freeGame.league,
          home_team: freeGame.home,
          away_team: freeGame.away,
          commence_time: freeGame.kickoff,
          bookmakers: [{ title: freeGame.source, markets: [{ key: "h2h", outcomes: [{ name: freeGame.home, price: 2.0 }, { name: freeGame.away, price: 2.0 }] }] }]
        };
        let independentModel = null;
        try { independentModel = await liveIndependentModel(mockEvent, { home: 0.5, away: 0.5 }); } catch {}
        
        allGames.push({
          id: freeGame.id,
          sport: freeGame.sport,
          sportKey: freeGame.sportKey,
          league: `${freeGame.league} (${freeGame.source})`,
          region: `${freeGame.source} + Vanish`,
          kickoff: freeGame.kickoff,
          home, away,
          probabilities: { home: 0.5, away: 0.5 },
          independentProbabilities: independentModel?.probabilities || { home: 0.5, away: 0.5 },
          independentModel,
          pick: independentModel ? { side: "home", probability: independentModel.probabilities.home, label: `${freeGame.home} to win`, fairOdds: 1/independentModel.probabilities.home } : { side: "home", probability: 0.5, label: `${freeGame.home} to win`, fairOdds: 2.0 },
          marketPick: { side: "home", probability: 0.5, label: `${freeGame.home} to win`, fairOdds: 2.0 },
          vanishPick: independentModel ? { side: independentModel.probabilities.home > 0.5 ? "home" : "away", probability: Math.max(independentModel.probabilities.home, independentModel.probabilities.away), label: `${independentModel.probabilities.home > 0.5 ? freeGame.home : freeGame.away} to win`, fairOdds: 1/Math.max(independentModel.probabilities.home, independentModel.probabilities.away) } : null,
          mode: "live",
          sample: false,
          calibrated: false,
          model: independentModel ? `${independentModel.model} (${freeGame.source})` : `Vanish (${freeGame.source})`,
          modelVersion: MODEL_VERSION,
          publishedAt: new Date().toISOString(),
          sources: [{ name: freeGame.source, updatedAt: null }],
          isToday: new Date(freeGame.kickoff).toDateString() === new Date().toDateString() || (new Date(freeGame.kickoff) - Date.now() < 24*3600000),
          hasLiveModel: true,
          explanation: [`From ${freeGame.source} free API: ${freeGame.league}`, ...(independentModel ? independentModel.explanation.slice(0,2) : ["Vanish model"])],
          inputRows: [["Data source", `${freeGame.source} + Vanish`], ["League", freeGame.league]],
          metrics: [{ label: "Source", value: freeGame.source }, { label: "Vanish home", value: independentModel ? `${(independentModel.probabilities.home*100).toFixed(1)}%` : "50%" }],
        });
      }
    }
    return allGames.sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff));
  } catch (e) {
    if (e.message.includes("429")) {
      throw new Error(`Rate limit 429: ${e.message} - Showing cached data. Reduce LIVE_SPORT_KEYS to 3-4 leagues and set LIVE_REFRESH_MINUTES=360 for free tier (500 credits/month).`);
    }
    throw e;
  }
}
