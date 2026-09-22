/**
 * Football Data - Additional Free Sources
 * football-data.org (free tier, needs key), API-Football (free tier, needs key), OpenLigaDB (free, no key)
 */

const CACHE = new Map();
const TTL = 10 * 60 * 1000;

function getCached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < TTL) return entry.data;
  return null;
}
function setCached(key, data) {
  CACHE.set(key, { data, ts: Date.now() });
}

// OpenLigaDB - Free, no key, German football + more
export async function fetchOpenLigaDB() {
  const cached = getCached("openligadb");
  if (cached) return cached;
  try {
    // Get current matchday for Bundesliga, 2. Bundesliga, etc.
    const leagues = ["bl1", "bl2", "bl3"]; // Bundesliga 1,2,3
    const games = [];
    for (const league of leagues) {
      try {
        const res = await fetch(`https://api.openligadb.de/getmatchdata/${league}/2024`, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) continue;
        const data = await res.json();
        for (const match of (data || []).slice(0, 20)) {
          const dt = new Date(match.matchDateTimeUTC);
          if (isNaN(dt.getTime())) continue;
          if (dt < new Date()) continue;
          if (dt - Date.now() > 7*24*3600000) continue;
          if (!match.team1?.teamName || !match.team2?.teamName) continue;
          games.push({
            id: `openliga_${match.matchID}`,
            sport: "football",
            sportKey: `soccer_germany_${league}`,
            league: `${match.leagueName || league.toUpperCase()} (OpenLigaDB)`,
            home: match.team1.teamName,
            away: match.team2.teamName,
            kickoff: dt.toISOString(),
            source: "OpenLigaDB",
          });
        }
      } catch {}
    }
    setCached("openligadb", games);
    return games;
  } catch {
    return [];
  }
}

// football-data.org - Free tier, needs API key (10 req/min)
export async function fetchFootballDataOrg(apiKey) {
  if (!apiKey) return [];
  const cached = getCached("footballdataorg");
  if (cached) return cached;
  try {
    const res = await fetch("https://api.football-data.org/v4/matches?status=SCHEDULED", {
      headers: { "X-Auth-Token": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`football-data.org failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const games = [];
    for (const match of (data.matches || []).slice(0, 30)) {
      const dt = new Date(match.utcDate);
      if (dt - Date.now() > 7*24*3600000) continue;
      games.push({
        id: `fdorg_${match.id}`,
        sport: "football",
        sportKey: `soccer_${match.competition?.code?.toLowerCase() || "unknown"}`,
        league: `${match.competition?.name || "Football"} (football-data.org)`,
        home: match.homeTeam?.name || "Home",
        away: match.awayTeam?.name || "Away",
        kickoff: dt.toISOString(),
        source: "football-data.org",
      });
    }
    setCached("footballdataorg", games);
    return games;
  } catch (e) {
    console.warn("football-data.org error:", e.message);
    return [];
  }
}

// API-Football (api-sports.io) - Free tier 100 req/day, needs key
export async function fetchAPIFootball(apiKey) {
  if (!apiKey) return [];
  const cached = getCached("apifootball");
  if (cached) return cached;
  try {
    const today = new Date().toISOString().slice(0,10);
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
      headers: { "x-apisports-key": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`API-Football failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const games = [];
    for (const fixture of (data.response || []).slice(0, 30)) {
      const dt = new Date(fixture.fixture?.date);
      if (isNaN(dt.getTime())) continue;
      games.push({
        id: `apifb_${fixture.fixture?.id}`,
        sport: "football",
        sportKey: `soccer_${fixture.league?.name?.toLowerCase().replace(/\s+/g,"_") || "unknown"}`,
        league: `${fixture.league?.name || "Football"} (API-Football)`,
        home: fixture.teams?.home?.name || "Home",
        away: fixture.teams?.away?.name || "Away",
        kickoff: dt.toISOString(),
        source: "API-Football",
      });
    }
    setCached("apifootball", games);
    return games;
  } catch (e) {
    console.warn("API-Football error:", e.message);
    return [];
  }
}

// Combined football free sources
export async function fetchAllFootballFree() {
  const footballDataKey = process.env.FOOTBALL_DATA_API_KEY;
  const apiFootballKey = process.env.API_FOOTBALL_KEY;
  
  const [openLiga, fdOrg, apiFb] = await Promise.all([
    fetchOpenLigaDB().catch(()=>[]),
    fetchFootballDataOrg(footballDataKey).catch(()=>[]),
    fetchAPIFootball(apiFootballKey).catch(()=>[]),
  ]);
  
  const all = [...openLiga, ...fdOrg, ...apiFb];
  // Deduplicate
  const seen = new Set();
  const deduped = [];
  for (const g of all) {
    const key = `${g.home}_${g.away}_${g.kickoff.slice(0,10)}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(g);
    }
  }
  return deduped.sort((a,b) => new Date(a.kickoff) - new Date(b.kickoff));
}
