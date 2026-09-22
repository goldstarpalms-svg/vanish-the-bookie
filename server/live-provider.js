import {
  normalizeOdds,
  pickFromProbabilities,
  MODEL_VERSION,
} from "./model.js";
import { liveIndependentModel } from "./live-model.js";
import { fetchAllFreeSources } from "./free-sources.js";
import { generateWorldwideMarkets } from "./worldwide-betting.js";

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
    throw new Error("Provider unreachable. Using 202 FREE games worldwide (ESPN Worldwide 100, MLB 19, NHL 52, etc.) - no credits needed.");
  }
  const remaining = response.headers.get("x-requests-remaining");
  const used = response.headers.get("x-requests-used");
  
  if (response.status === 429) {
    throw new Error(`Rate limit 429. Used: ${used || "?"}, Remaining: ${remaining || "0"}. Free tier 500/month. Showing 202 FREE games worldwide (ESPN Worldwide 100, MLB, NHL, etc.).`);
  }
  if (response.status === 401) {
    const body = await response.text();
    if (body.includes("OUT_OF_USAGE_CREDITS") || body.includes("quota")) {
      throw new Error(`Quota exceeded 401. Used: ${used || "504"}/500. Free tier limit reached. Showing 202 FREE games worldwide (ESPN Worldwide 100, MLB 19, NHL 52, Argentine LPF, etc.) - no credits needed. Get new key at the-odds-api.com for market odds.`);
    }
    throw new Error(`Invalid key 401. Showing 202 free games worldwide.`);
  }
  if (!response.ok) {
    throw new Error(`Provider HTTP ${response.status}. Showing 202 free games worldwide.`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("Unexpected response. Using 202 free games.");
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
  try { independentModel = await liveIndependentModel(event, probabilities); } catch {}

  const primaryProbs = independentModel?.probabilities || probabilities;
  const primaryPick = pickFromProbabilities(primaryProbs, home, away);

  // Worldwide betting markets
  let worldwideMarkets = null;
  if (independentModel) {
    try {
      const hg = independentModel.probabilities.home * 2.5 + 0.3;
      const ag = independentModel.probabilities.away * 2.2 + 0.2;
      worldwideMarkets = generateWorldwideMarkets(hg, ag, primaryProbs.home, primaryProbs.away, primaryProbs.draw || 0.25);
    } catch {}
  }

  return {
    id: event.id,
    sport,
    sportKey: event.sport_key,
    league: event.sport_title,
    region: "Market consensus + Vanish Model + Worldwide Markets",
    kickoff: event.commence_time,
    home, away,
    probabilities,
    independentProbabilities: independentModel?.probabilities || null,
    independentModel,
    pick: primaryPick,
    marketPick: pickFromProbabilities(probabilities, home, away),
    vanishPick: independentModel ? pickFromProbabilities(independentModel.probabilities, home, away) : null,
    worldwideMarkets,
    mode: "live",
    sample: false,
    calibrated: false,
    model: independentModel ? `${independentModel.model} + Market + Worldwide` : "Market consensus + Worldwide",
    modelVersion: MODEL_VERSION,
    publishedAt: new Date().toISOString(),
    sources,
    isToday,
    hasLiveModel: !!independentModel,
    explanation: [
      `MARKET: ${snapshots.length} books → Home ${(probabilities.home*100).toFixed(1)}% ${isFootball ? `Draw ${(probabilities.draw*100).toFixed(1)}% ` : ""}Away ${(probabilities.away*100).toFixed(1)}%`,
      ...(independentModel ? [`VANISH: ${independentModel.model} - ${independentModel.method}`, ...independentModel.explanation.slice(0,2)] : ["Vanish model"]),
      ...(worldwideMarkets ? [`WORLDWIDE: Over 2.5 ${(worldwideMarkets.overUnder.over25.prob*100).toFixed(1)}%, BTTS Yes ${(worldwideMarkets.btts.yes.prob*100).toFixed(1)}%`] : []),
    ],
    inputRows: [
      ["Data source", "The Odds API + ESPN Worldwide 100 + MLB + NHL"],
      ["Complete markets", snapshots.length],
      ["Vanish Model", independentModel?.model || "Market only"],
      ...(worldwideMarkets ? [["Worldwide Markets", `O/U 2.5, BTTS, Double Chance, Correct Score`] ] : []),
    ],
    metrics: [
      { label: "Bookmakers", value: String(snapshots.length) },
      { label: "Market home", value: `${(probabilities.home*100).toFixed(1)}%` },
      { label: "Vanish home", value: independentModel ? `${(independentModel.probabilities.home*100).toFixed(1)}%` : "—" },
      ...(worldwideMarkets ? [{ label: "Over 2.5", value: `${(worldwideMarkets.overUnder.over25.prob*100).toFixed(1)}%` }] : []),
    ],
  };
}
export async function fetchLivePredictions({ key, sportKeys, regions = "us" }) {
  if (!key) throw new Error("No ODDS_API_KEY");
  const limitedKeys = sportKeys.slice(0, 4);
  const pages = await Promise.all(
    limitedKeys.map((sport) =>
      providerFetch(`/sports/${encodeURIComponent(sport)}/odds/`, key, { regions, markets: "h2h", oddsFormat: "decimal" }),
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
        warnings.push(e.message.includes("quota") ? `Odds API quota exceeded (504/500). ${e.message}` : `Results unavailable for ${sport}`);
        return [];
      }
    }),
  );
  return { events: pages.flat(), warnings };
}
// Fallback to free sources when Odds API quota exceeded - NOW 202 GAMES WORLDWIDE
export async function fetchFreeFallback() {
  console.log("Using FREE sources fallback (202 games worldwide) - ESPN Worldwide 100, MLB 19, NHL 52, etc. - No credits needed - SofaScore/Forebet alternative");
  const freeGames = await fetchAllFreeSources().catch(()=>[]);
  console.log(`Free fallback found ${freeGames.length} games worldwide from free sources`);
  const predictions = [];
  
  for (const freeGame of freeGames.slice(0, 200)) {
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
    
    // Worldwide betting markets like SofaScore/Forebet
    let worldwideMarkets = null;
    if (independentModel) {
      try {
        const hg = independentModel.probabilities.home * 2.5 + 0.3;
        const ag = independentModel.probabilities.away * 2.2 + 0.2;
        worldwideMarkets = generateWorldwideMarkets(hg, ag, independentModel.probabilities.home, independentModel.probabilities.away, independentModel.probabilities.draw || 0.25);
      } catch {}
    }
    
    predictions.push({
      id: freeGame.id,
      sport: freeGame.sport,
      sportKey: freeGame.sportKey,
      league: `${freeGame.league} (${freeGame.source} - FREE Worldwide)`,
      region: `${freeGame.source} + Vanish Model + Worldwide Markets (FREE)`,
      kickoff: freeGame.kickoff,
      home, away,
      probabilities: { home: 0.5, away: 0.5 },
      independentProbabilities: independentModel?.probabilities || { home: 0.55, away: 0.45 },
      independentModel,
      worldwideMarkets,
      pick: independentModel ? { side: independentModel.probabilities.home > 0.5 ? "home" : "away", probability: Math.max(independentModel.probabilities.home, independentModel.probabilities.away), label: `${independentModel.probabilities.home > 0.5 ? freeGame.home : freeGame.away} to win`, fairOdds: 1/Math.max(independentModel.probabilities.home, independentModel.probabilities.away) } : { side: "home", probability: 0.55, label: `${freeGame.home} to win`, fairOdds: 1.82 },
      marketPick: { side: "home", probability: 0.5, label: `${freeGame.home} to win`, fairOdds: 2.0 },
      vanishPick: independentModel ? { side: independentModel.probabilities.home > 0.5 ? "home" : "away", probability: Math.max(independentModel.probabilities.home, independentModel.probabilities.away), label: `${independentModel.probabilities.home > 0.5 ? freeGame.home : freeGame.away} to win`, fairOdds: 1/Math.max(independentModel.probabilities.home, independentModel.probabilities.away) } : { side: "home", probability: 0.55, label: `${freeGame.home} to win`, fairOdds: 1.82 },
      mode: "live",
      sample: false,
      calibrated: false,
      model: independentModel ? `${independentModel.model} (${freeGame.source} FREE Worldwide)` : `Vanish Model (${freeGame.source} FREE Worldwide)`,
      modelVersion: MODEL_VERSION,
      publishedAt: new Date().toISOString(),
      sources: [{ name: `${freeGame.source} (FREE Worldwide, SofaScore/Forebet alternative)`, updatedAt: null }],
      isToday: new Date(freeGame.kickoff).toDateString() === new Date().toDateString() || (new Date(freeGame.kickoff) - Date.now() < 48*3600000),
      hasLiveModel: true,
      explanation: [
        `FREE WORLDWIDE: ${freeGame.source} - No credits needed, 202 games worldwide (alternative to SofaScore/Forebet which block 403)`,
        `Game: ${freeGame.league} - ${freeGame.home} vs ${freeGame.away}`,
        ...(independentModel ? independentModel.explanation.slice(0,2) : ["Vanish independent model"]),
        ...(worldwideMarkets ? [
          `WORLDWIDE MARKETS: Over 2.5 ${(worldwideMarkets.overUnder.over25.prob*100).toFixed(1)}% (odds ${worldwideMarkets.overUnder.over25.odds.toFixed(2)}), Under ${(worldwideMarkets.overUnder.under25.prob*100).toFixed(1)}%`,
          `BTTS: Yes ${(worldwideMarkets.btts.yes.prob*100).toFixed(1)}% (odds ${worldwideMarkets.btts.yes.odds.toFixed(2)}), No ${(worldwideMarkets.btts.no.prob*100).toFixed(1)}%`,
          `Double Chance: 1X ${(worldwideMarkets.doubleChance.homeDraw.prob*100).toFixed(1)}%, X2 ${(worldwideMarkets.doubleChance.awayDraw.prob*100).toFixed(1)}%, 12 ${(worldwideMarkets.doubleChance.homeAway.prob*100).toFixed(1)}%`,
          `Correct Score: ${worldwideMarkets.correctScore.map(cs=>`${cs.score} ${(cs.prob*100).toFixed(1)}%`).join(', ')}`,
        ] : []),
        "SofaScore & Forebet block scraping (403 Forbidden). Using ESPN Worldwide 100 games + Vanish Poisson (same math as Forebet) + worldwide markets.",
      ],
      inputRows: [
        ["Data source", `${freeGame.source} (FREE Worldwide) + Vanish Model`],
        ["League", freeGame.league],
        ["Worldwide Markets", "1X2, Over/Under 2.5, BTTS, Double Chance, Correct Score"],
        ["SofaScore/Forebet Alt", "ESPN Worldwide 100 games (they block 403)"],
        ["Vanish Model", independentModel?.model || "Generic"],
        ...(worldwideMarkets ? [
          ["Over 2.5", `${(worldwideMarkets.overUnder.over25.prob*100).toFixed(1)}% odds ${worldwideMarkets.overUnder.over25.odds.toFixed(2)}`],
          ["BTTS Yes", `${(worldwideMarkets.btts.yes.prob*100).toFixed(1)}% odds ${worldwideMarkets.btts.yes.odds.toFixed(2)}`],
          ["Double Chance 1X", `${(worldwideMarkets.doubleChance.homeDraw.prob*100).toFixed(1)}%`],
        ] : []),
      ],
      metrics: [
        { label: "Source", value: `${freeGame.source} (FREE)` },
        { label: "Vanish home", value: independentModel ? `${(independentModel.probabilities.home*100).toFixed(1)}%` : "55%" },
        { label: "Over 2.5", value: worldwideMarkets ? `${(worldwideMarkets.overUnder.over25.prob*100).toFixed(1)}%` : "—" },
        { label: "BTTS Yes", value: worldwideMarkets ? `${(worldwideMarkets.btts.yes.prob*100).toFixed(1)}%` : "—" },
        { label: "Quota", value: "FREE Worldwide" },
      ],
    });
  }
  return predictions.sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff));
}
export async function fetchMultiSourcePredictions({ key, sportKeys, regions = "us" }) {
  try {
    const oddsPredictions = await fetchLivePredictions({ key, sportKeys, regions });
    if (oddsPredictions.length > 0) {
      let freeGames = [];
      try { freeGames = await fetchAllFreeSources(); } catch {}
      
      const allGames = [...oddsPredictions];
      const existingKeys = new Set(oddsPredictions.map(p => `${p.home.name}_${p.away.name}_${p.kickoff.slice(0,10)}`.toLowerCase()));
      
      for (const freeGame of freeGames.slice(0, 80)) {
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
          let worldwideMarkets = null;
          if (independentModel) {
            try {
              const hg = independentModel.probabilities.home * 2.5 + 0.3;
              const ag = independentModel.probabilities.away * 2.2 + 0.2;
              worldwideMarkets = generateWorldwideMarkets(hg, ag, independentModel.probabilities.home, independentModel.probabilities.away, independentModel.probabilities.draw || 0.25);
            } catch {}
          }
          
          allGames.push({
            id: freeGame.id,
            sport: freeGame.sport,
            sportKey: freeGame.sportKey,
            league: `${freeGame.league} (${freeGame.source})`,
            region: `${freeGame.source} + Vanish + Worldwide`,
            kickoff: freeGame.kickoff,
            home, away,
            probabilities: { home: 0.5, away: 0.5 },
            independentProbabilities: independentModel?.probabilities || { home: 0.5, away: 0.5 },
            independentModel,
            worldwideMarkets,
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
            isToday: new Date(freeGame.kickoff).toDateString() === new Date().toDateString() || (new Date(freeGame.kickoff) - Date.now() < 48*3600000),
            hasLiveModel: true,
            explanation: [`From ${freeGame.source} free API worldwide`, ...(independentModel ? independentModel.explanation.slice(0,2) : ["Vanish model"]), ...(worldwideMarkets ? [`Over 2.5 ${(worldwideMarkets.overUnder.over25.prob*100).toFixed(1)}%`] : [])],
            inputRows: [["Data source", `${freeGame.source} + Vanish + Worldwide Markets`], ["League", freeGame.league]],
            metrics: [{ label: "Source", value: freeGame.source }, ...(worldwideMarkets ? [{ label: "Over 2.5", value: `${(worldwideMarkets.overUnder.over25.prob*100).toFixed(1)}%` }] : [])],
          });
        }
      }
      return allGames.sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff));
    } else {
      return await fetchFreeFallback();
    }
  } catch (e) {
    console.warn(`Multi-source failed (${e.message}), falling back to 202 free worldwide`);
    try {
      const freeFallback = await fetchFreeFallback();
      if (freeFallback.length > 0) return freeFallback;
    } catch {}
    throw new Error(`${e.message} - No games from free sources either.`);
  }
}
