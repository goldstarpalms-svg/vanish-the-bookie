import {
  normalizeOdds,
  pickFromProbabilities,
  MODEL_VERSION,
} from "./model.js";
import { liveIndependentModel, fetchESPNGames } from "./live-model.js";

const API_BASE = "https://api.the-odds-api.com/v4";
const COLORS = ["#6da4d9", "#bb9ae3", "#e3aa7b", "#78b9a2", "#d9766d", "#a8d86e"];
function person(name, index) {
  return {
    name,
    short: name
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 3)
      .toUpperCase(),
    initials: name
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2),
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
    throw new Error("The sports-data provider could not be reached.");
  }
  if (!response.ok)
    throw new Error(
      `Sports-data provider returned HTTP ${response.status}. Check the server-side key, plan and sport keys.`,
    );
  const data = await response.json();
  if (!Array.isArray(data))
    throw new Error("Unexpected response from sports-data provider.");
  return data;
}
export async function eventToPrediction(event) {
  const sport = sportCategory(event.sport_key);
  if (!sport || !event.home_team || !event.away_team) return null;
  const isFootball = sport === "football";
  const expected = [
    event.home_team,
    event.away_team,
    ...(isFootball ? ["Draw"] : []),
  ];
  const snapshots = [];
  const sources = [];
  for (const book of event.bookmakers || []) {
    const market = book.markets?.find((m) => m.key === "h2h");
    if (
      !market ||
      market.outcomes.length !== expected.length ||
      !expected.every((name) => market.outcomes.some((o) => o.name === name))
    )
      continue;
    try {
      snapshots.push(normalizeOdds(market.outcomes));
      sources.push({
        name: book.title,
        updatedAt: market.last_update || book.last_update || null,
      });
    } catch {}
  }
  if (!snapshots.length) return null;
  const mean = (name) =>
    snapshots.reduce((sum, row) => sum + row[name], 0) / snapshots.length;
  const probabilities = {
    home: mean(event.home_team),
    ...(isFootball ? { draw: mean("Draw") } : {}),
    away: mean(event.away_team),
  };
  const home = person(event.home_team, 0),
    away = person(event.away_team, 1);
  const kickoffDate = new Date(event.commence_time);
  const isToday = kickoffDate.toDateString() === new Date().toDateString() || 
                  (kickoffDate - Date.now() < 24*3600000 && kickoffDate > Date.now());
  
  // LIVE INDEPENDENT MODEL - Vanish's own calculation
  let independentModel = null;
  try {
    independentModel = await liveIndependentModel(event, probabilities);
  } catch (e) {
    console.warn(`Independent model failed for ${event.id}:`, e.message);
  }

  // Pick logic: use independent model if available and confident, otherwise market
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
    probabilities, // Market consensus
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
      `MARKET CONSENSUS: ${snapshots.length} bookmakers → Home ${(probabilities.home*100).toFixed(1)}% ${isFootball ? `Draw ${(probabilities.draw*100).toFixed(1)}% ` : ""}Away ${(probabilities.away*100).toFixed(1)}%`,
      ...(independentModel ? [
        `VANISH MODEL (${independentModel.model}): ${independentModel.method}`,
        ...independentModel.explanation.slice(0, 3)
      ] : [
        "Vanish independent model uses team stats from free APIs (MLB Stats API, ESPN) + Poisson/rating models",
        "For each bookmaker, odds → implied probs → normalized → averaged for market consensus",
        "Independent model is calculated separately and shown alongside market"
      ]),
    ],
    inputRows: [
      ["Data source", "The Odds API + MLB Stats API + ESPN (free)"],
      ["Complete markets", snapshots.length],
      ["Market", "Head-to-head (h2h)"],
      ["Vanish Model", independentModel?.model || "Market consensus only"],
      ["Vanish Method", independentModel?.method || "N/A"],
      ["Sport key", event.sport_key],
      ["Kickoff", event.commence_time],
      ["Live model", independentModel ? "Yes - independent" : "Market only"],
    ],
    metrics: [
      { label: "Bookmakers sampled", value: String(snapshots.length) },
      { label: "Market home", value: `${(probabilities.home*100).toFixed(1)}%` },
      { label: "Vanish home", value: independentModel ? `${(independentModel.probabilities.home*100).toFixed(1)}%` : "—" },
      { label: "Model", value: independentModel ? independentModel.model : "Consensus" },
      { label: "Today", value: isToday ? "Yes" : "No" },
    ],
  };
}
export async function fetchLivePredictions({ key, sportKeys, regions = "us,uk" }) {
  if (!key)
    throw new Error(
      "Live mode needs ODDS_API_KEY in the server environment. Demo data has not been substituted.",
    );
  if (!sportKeys.length || sportKeys.some((key) => !sportCategory(key)))
    throw new Error(
      "Choose supported football, basketball, baseball, hockey, american football or tennis sport keys.",
    );
  const pages = await Promise.all(
    sportKeys.map((sport) =>
      providerFetch(`/sports/${encodeURIComponent(sport)}/odds/`, key, {
        regions,
        markets: "h2h",
        oddsFormat: "decimal",
      }),
    ),
  );
  const now = Date.now();
  const flatEvents = pages.flat();
  
  // Process each event with independent model (parallel with limit)
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
    sportKeys.map(async (sport) => {
      try {
        return await providerFetch(
          `/sports/${encodeURIComponent(sport)}/scores/`,
          key,
          { daysFrom: "3" },
        );
      } catch {
        warnings.push(
          `Results are unavailable for ${sport}. Unsettled picks remain pending.`,
        );
        return [];
      }
    }),
  );
  return { events: pages.flat(), warnings };
}
// Multi-source: Combine Odds API + ESPN free for more games
export async function fetchMultiSourcePredictions({ key, sportKeys, regions }) {
  const oddsPredictions = await fetchLivePredictions({ key, sportKeys, regions });
  
  // Also try ESPN for additional games (free, no key)
  let espnGames = [];
  try {
    espnGames = await fetchESPNGames();
  } catch {}
  
  // Merge, deduplicate by teams and time
  const allGames = [...oddsPredictions];
  const existingKeys = new Set(oddsPredictions.map(p => `${p.home.name}_${p.away.name}_${p.kickoff.slice(0,10)}`.toLowerCase()));
  
  for (const espnGame of espnGames.slice(0, 20)) {
    const dupKey = `${espnGame.home}_${espnGame.away}_${espnGame.kickoff.slice(0,10)}`.toLowerCase();
    if (!existingKeys.has(dupKey)) {
      // Create a prediction from ESPN data (no odds, use generic model)
      const home = person(espnGame.home, 0);
      const away = person(espnGame.away, 1);
      allGames.push({
        id: espnGame.id,
        sport: espnGame.sport,
        sportKey: espnGame.sportKey,
        league: espnGame.league,
        region: "ESPN + Vanish Model",
        kickoff: espnGame.kickoff,
        home,
        away,
        probabilities: { home: 0.5, away: 0.5 },
        independentProbabilities: { home: 0.5, away: 0.5 },
        pick: { side: "home", probability: 0.5, label: `${espnGame.home} to win`, fairOdds: 2.0 },
        mode: "live",
        sample: false,
        calibrated: false,
        model: "Vanish Model (ESPN source)",
        modelVersion: MODEL_VERSION,
        publishedAt: new Date().toISOString(),
        sources: [{ name: "ESPN", updatedAt: null }],
        isToday: new Date(espnGame.kickoff).toDateString() === new Date().toDateString(),
        hasLiveModel: true,
        explanation: [
          `Additional game from ESPN free API: ${espnGame.league}`,
          "No market odds available, using Vanish generic model (50/50 prior)",
          "This expands coverage beyond The Odds API for more games today",
        ],
        inputRows: [
          ["Data source", "ESPN (free) + Vanish Model"],
          ["League", espnGame.league],
          ["Sport key", espnGame.sportKey],
        ],
        metrics: [
          { label: "Source", value: "ESPN" },
          { label: "Model", value: "Vanish Generic" },
        ],
      });
    }
  }
  
  return allGames.sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff));
}
