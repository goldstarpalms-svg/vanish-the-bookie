import {
  normalizeOdds,
  pickFromProbabilities,
  MODEL_VERSION,
} from "./model.js";
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
function leagueLabel(sportTitle, sportKey) {
  // Keep provider title but add context
  return sportTitle;
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
export function eventToPrediction(event) {
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
    } catch {
      /* Ignore malformed/incomplete books rather than invent probabilities. */
    }
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
  return {
    id: event.id,
    sport,
    sportKey: event.sport_key,
    league: leagueLabel(event.sport_title, event.sport_key),
    region: "Market consensus",
    kickoff: event.commence_time,
    home,
    away,
    probabilities,
    pick: pickFromProbabilities(probabilities, home, away),
    mode: "live",
    sample: false,
    calibrated: false,
    model: "Market consensus",
    modelVersion: MODEL_VERSION,
    publishedAt: new Date().toISOString(),
    sources,
    isToday,
    explanation: [
      `${snapshots.length} complete bookmaker market${snapshots.length === 1 ? "" : "s"} contributed to this estimate.`,
      "For each bookmaker, decimal odds are converted to implied probabilities and normalized to sum to 100%. Those normalized probabilities are then averaged.",
      "This is a market-implied baseline, not an independently trained forecast. It provides no evidence of an edge over the market and does not incorporate a separately verified injury or lineup model.",
      isToday ? "Kickoff is within 24 hours - today’s testing window." : `Kickoff: ${kickoffDate.toLocaleString()}`
    ],
    inputRows: [
      ["Data source", "The Odds API"],
      ["Complete markets", snapshots.length],
      ["Market", "Head-to-head (h2h)"],
      ["Normalization", "Proportional margin removal"],
      ["Sport key", event.sport_key],
      ["Kickoff", event.commence_time],
    ],
    metrics: [
      { label: "Bookmakers sampled", value: String(snapshots.length) },
      { label: "Estimation method", value: "Consensus" },
      { label: "Live window", value: isToday ? "Today" : "Upcoming" },
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
  return pages
    .flat()
    .map(eventToPrediction)
    .filter(Boolean)
    .filter(
      (p) =>
        new Date(p.kickoff).getTime() > now &&
        new Date(p.kickoff).getTime() < now + 30 * 86400000,
    )
    .sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff));
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
