/**
 * FootyStats OFFICIAL API layer — https://api.football-data-api.com
 * (api.footystats.org 301-redirects here; docs: https://footystats.org/api/docs)
 *
 * Auth: ?key=… query parameter. Free key scope (see KEY_NOTES):
 *   - English Premier League only
 *   - seasons 2018/19 → 2024/25 (1625, 2012, 12325, …)
 *   - cups / other leagues / current seasons answer
 *     "League is not chosen by the user" — the account's league selection at
 *     footystats.org (or a paid plan) unlocks them. The message also warns
 *     about cache delay right after choosing leagues.
 * Budget: 1,800 requests/hour (metadata.request_remaining tracks it).
 *
 * The key is persisted here on purpose (client instruction: never clear
 * pasted credentials). process.env.FOOTYSTATS_API_KEY overrides it.
 */

export const FOOTYSTATS_API_BASE = "https://api.football-data-api.com";
export const FOOTYSTATS_SITE = "https://footystats.org";

/** Persisted free API key (client-provided 2026-11-02). Do not clear. */
export const FOOTYSTATS_FREE_KEY = "test85g57";

export function footyApiKey() {
  return process.env.FOOTYSTATS_API_KEY || FOOTYSTATS_FREE_KEY;
}

export class FootyApiError extends Error {
  constructor(message, { status = 0, body = null } = {}) {
    super(message);
    this.name = "FootyApiError";
    this.status = status;
    this.body = body;
  }
}

let lastRequestRemaining = null;
export function footyRequestBudget() {
  return lastRequestRemaining;
}

/**
 * GET an API path with params, unwrapping the standard envelope
 * { success, data, message, metadata }. Throws FootyApiError on failure.
 */
export async function apiGet(path, params = {}) {
  const url = new URL(FOOTYSTATS_API_BASE + path);
  url.searchParams.set("key", footyApiKey());
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  let body = null;
  try {
    body = await res.json();
  } catch {
    throw new FootyApiError(`Non-JSON response (${res.status}) from ${path}`, { status: res.status });
  }
  const remaining = body?.metadata?.request_remaining;
  if (remaining !== undefined && remaining !== null) lastRequestRemaining = Number(remaining);
  if (!body?.success) {
    throw new FootyApiError(body?.message || `API failure on ${path}`, { status: res.status, body });
  }
  return body.data;
}

/** "Successful Test Call" when the key is active. */
export function testConnection() {
  return apiGet("/test-call");
}

/** All competition-season records for a team — the discovery entry point.
 *  Each record: { competition_id (= season_id for league-* endpoints),
 *  season "2026/2027" | "2026", season_format "Domestic League"|"Cup"|"International", … } */
export async function discoverTeamSeasons(teamId) {
  const data = await apiGet("/team", { team_id: teamId });
  const recs = Array.isArray(data) ? data : [data];
  return recs.filter((r) => r && r.competition_id != null);
}

/** One league-season's fixtures/results (paginated; defaults to first 100). */
export function fetchSeasonMatches(seasonId, { page = 1, maxPerPage = 100 } = {}) {
  return apiGet("/league-matches", { season_id: seasonId, page, max_per_page: maxPerPage });
}

/** Full match detail: H2H + betting_stats + trends + odds + xG. */
export function fetchMatchDetail(matchId) {
  return apiGet("/match", { match_id: matchId });
}

/** League-season averages (BTTS %, Over %, goals/match, …). */
export function fetchLeagueSeason(seasonId) {
  return apiGet("/league-season", { season_id: seasonId });
}

/** All teams of a league-season with per-team season stats. */
export function fetchLeagueTeams(seasonId) {
  return apiGet("/league-teams", { season_id: seasonId, include: "stats", max_per_page: 100 });
}

/* ------------------------------------------------------------------ */
/* Mapper: API match detail → snapshot entry (the shape buildFootyBlock */
/* consumes: { home, away, form, h2h, prediction, teams, url }).        */
/* ------------------------------------------------------------------ */

const num = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** "WWDLW" from a season's completed matches before a timestamp (newest last). */
export function computeFormStrings(seasonMatches, teamId, beforeUnix) {
  const rows = (seasonMatches || [])
    .filter(
      (m) =>
        m.status === "complete" &&
        m.date_unix < beforeUnix &&
        (m.homeID === teamId || m.awayID === teamId)
    )
    .sort((a, b) => b.date_unix - a.date_unix)
    .slice(0, 5)
    .reverse();
  return rows
    .map((m) => {
      const isHome = m.homeID === teamId;
      const mine = num(isHome ? m.homeGoalCount : m.awayGoalCount, 0);
      const theirs = num(isHome ? m.awayGoalCount : m.homeGoalCount, 0);
      return mine > theirs ? "W" : mine === theirs ? "D" : "L";
    })
    .join("");
}

function teamStatsBlock(stats, fallbackXg) {
  if (!stats) {
    return fallbackXg != null ? { xg: num(fallbackXg) } : null;
  }
  const playedHome = num(stats.seasonMatchesPlayed_home, 0) || 0;
  const playedAway = num(stats.seasonMatchesPlayed_away, 0) || 0;
  return {
    xg: num(stats.xg_for_avg_overall, num(fallbackXg)),
    xga: num(stats.xg_against_avg_overall),
    ppg: num(stats.seasonPPG_overall),
    ppgHome: num(stats.seasonPPG_home),
    ppgAway: num(stats.seasonPPG_away),
    winPctHome: playedHome ? Math.round((100 * num(stats.seasonWinsNum_home, 0)) / playedHome) : null,
    winPctAway: playedAway ? Math.round((100 * num(stats.seasonWinsNum_away, 0)) / playedAway) : null,
    scoredAvg: num(stats.seasonScoredAVG_overall),
    concededAvg: num(stats.seasonConcededAVG_overall),
    bttsPct: num(stats.seasonBTTSPercentage_overall),
  };
}

/**
 * Map a /match detail (+ optional league averages & per-team stats) into the
 * snapshot entry schema used by server/footystats.js buildFootyBlock().
 */
export function mapMatchToEntry(detail, { leagueSeason = null, teamStats = null, formStrings = null, country = null } = {}) {
  const bs = detail?.h2h?.betting_stats || {};
  const pmr = detail?.h2h?.previous_matches_results || {};
  const avg = (key) => (leagueSeason ? num(leagueSeason[key]) : null);

  const entry = {
    home: detail.home_name,
    away: detail.away_name,
    country: country || leagueSeason?.country || null,
    source: "FootyStats API",
    matchId: detail.id,
    url: detail.match_url
      ? detail.match_url.startsWith("http")
        ? detail.match_url
        : FOOTYSTATS_SITE + detail.match_url
      : FOOTYSTATS_SITE,
    form: {
      home: formStrings?.home ?? null,
      away: formStrings?.away ?? null,
      ppgHome: num(detail.pre_match_home_ppg, num(detail.home_ppg)),
      ppgAway: num(detail.pre_match_away_ppg, num(detail.away_ppg)),
    },
    h2h: {
      matches: num(pmr.totalMatches, num(detail.h2h?.previous_matches_ids?.length, 0)),
      homeWins: num(pmr.team_a_wins, 0),
      draws: num(pmr.draw, 0),
      awayWins: num(pmr.team_b_wins, 0),
      over15: num(bs.over15Percentage, 0),
      over25: num(bs.over25Percentage, 0),
      over35: num(bs.over35Percentage, 0),
      btts: num(bs.bttsPercentage, 0),
      csHome: num(bs.clubACSPercentage, 0),
      csAway: num(bs.clubBCSPercentage, 0),
      avgGoals: num(bs.avg_goals),
    },
    prediction: {
      over25: num(bs.over25Percentage, 0),
      over25Avg: avg("seasonOver25Percentage_overall"),
      over15: num(bs.over15Percentage, 0),
      over15Avg: avg("seasonOver15Percentage_overall"),
      btts: num(bs.bttsPercentage, 0),
      bttsAvg: avg("seasonBTTSPercentage"),
      gpm: num(bs.avg_goals),
      gpmAvg: avg("seasonAVG_overall"),
    },
    teams: {
      home: teamStatsBlock(teamStats?.home, detail.team_a_xg_prematch),
      away: teamStatsBlock(teamStats?.away, detail.team_b_xg_prematch),
    },
  };
  return entry;
}

/**
 * End-to-end: match id + season id → snapshot entry.
 * Costs 2–4 requests (match detail + league-season + league-teams, cached per
 * season via `seasonCache`).
 */
export async function buildEntryForMatch(matchId, seasonId, { seasonCache = new Map(), withForm = true } = {}) {
  if (!seasonCache.has(`ls:${seasonId}`)) {
    seasonCache.set(`ls:${seasonId}`, await fetchLeagueSeason(seasonId).catch(() => null));
  }
  if (!seasonCache.has(`lt:${seasonId}`)) {
    seasonCache.set(`lt:${seasonId}`, await fetchLeagueTeams(seasonId).catch(() => null));
  }
  const leagueSeason = seasonCache.get(`ls:${seasonId}`);
  const leagueTeams = seasonCache.get(`lt:${seasonId}`);

  const detail = await fetchMatchDetail(matchId);

  let teamStats = null;
  if (leagueTeams) {
    const byId = new Map(leagueTeams.map((t) => [t.id, t.stats]));
    teamStats = {
      home: byId.get(detail.homeID) || null,
      away: byId.get(detail.awayID) || null,
    };
  }

  let formStrings = null;
  if (withForm) {
    if (!seasonCache.has(`lm:${seasonId}`)) {
      const rows = [];
      for (let page = 1; page <= 4; page++) {
        const batch = await fetchSeasonMatches(seasonId, { page, maxPerPage: 100 }).catch(() => []);
        rows.push(...batch);
        if (batch.length < 100) break;
      }
      seasonCache.set(`lm:${seasonId}`, rows);
    }
    const matches = seasonCache.get(`lm:${seasonId}`) || [];
    formStrings = {
      home: computeFormStrings(matches, detail.homeID, detail.date_unix) || null,
      away: computeFormStrings(matches, detail.awayID, detail.date_unix) || null,
    };
  }

  return mapMatchToEntry(detail, {
    leagueSeason,
    teamStats,
    formStrings,
    country: leagueSeason?.country || null,
  });
}
