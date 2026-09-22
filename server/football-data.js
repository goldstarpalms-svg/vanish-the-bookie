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

// OpenLigaDB - Free, no key, German football + more - FIXED for 2025/2026 season
export async function fetchOpenLigaDB() {
  const cached = getCached("openligadb");
  if (cached) return cached;
  try {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, 2025, 2024];
    const leagues = ["bl1", "bl2", "bl3"];
    const games = [];
    for (const year of years) {
      for (const league of leagues) {
        try {
          const res = await fetch(`https://api.openligadb.de/getmatchdata/${league}/${year}`, { signal: AbortSignal.timeout(6000) });
          if (!res.ok) continue;
          const data = await res.json();
          for (const match of (data || [])) {
            const dt = new Date(match.matchDateTimeUTC);
            if (isNaN(dt.getTime())) continue;
            if (dt < new Date(Date.now() - 12*3600000)) continue;
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
          if (games.length > 20) break;
        } catch {}
      }
      if (games.length > 0) break;
    }
    setCached("openligadb", games);
    return games;
  } catch {
    return [];
  }
}

// football-data.org - Free tier, needs API key (10 req/min) - WITH YOUR KEY 8e31...
export async function fetchFootballDataOrg(apiKey) {
  if (!apiKey) {
    console.log("football-data.org: No API key, skipping");
    return [];
  }
  const cached = getCached("footballdataorg");
  if (cached) return cached;
  try {
    const today = new Date().toISOString().slice(0,10);
    const nextWeek = new Date(Date.now() + 7*24*3600000).toISOString().slice(0,10);
    console.log(`football-data.org: Fetching ${today} to ${nextWeek} with key ${apiKey.slice(0,4)}...`);
    
    const res = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${nextWeek}`, {
      headers: { "X-Auth-Token": apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`football-data.org failed: ${res.status} - ${text.slice(0,200)}`);
      return [];
    }
    const data = await res.json();
    const games = [];
    for (const match of (data.matches || []).slice(0, 50)) {
      const dt = new Date(match.utcDate);
      games.push({
        id: `fdorg_${match.id}`,
        sport: "football",
        sportKey: `soccer_${(match.competition?.code || "unknown").toLowerCase()}`,
        league: `${match.competition?.name || "Football"} (football-data.org)`,
        home: match.homeTeam?.name || "Home",
        away: match.awayTeam?.name || "Away",
        kickoff: dt.toISOString(),
        source: "football-data.org",
      });
    }
    console.log(`football-data.org: Got ${games.length} games`);
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
    if (!res.ok) return [];
    const data = await res.json();
    const games = [];
    for (const fixture of (data.response || []).slice(0, 30)) {
      const dt = new Date(fixture.fixture?.date);
      if (isNaN(dt.getTime())) continue;
      games.push({
        id: `apifb_${fixture.fixture?.id}`,
        sport: "football",
        sportKey: `soccer_${(fixture.league?.name || "unknown").toLowerCase().replace(/\s+/g,"_")}`,
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

export async function fetchAllFootballFree() {
  const footballDataKey = process.env.FOOTBALL_DATA_API_KEY;
  const apiFootballKey = process.env.API_FOOTBALL_KEY;
  
  console.log(`Football free sources - football-data.org key: ${footballDataKey ? 'YES '+footballDataKey.slice(0,4)+'...' : 'NO'}, API-Football key: ${apiFootballKey ? 'YES' : 'NO'}`);
  
  const [openLiga, fdOrg, apiFb] = await Promise.all([
    fetchOpenLigaDB().catch(()=>[]),
    fetchFootballDataOrg(footballDataKey).catch(()=>[]),
    fetchAPIFootball(apiFootballKey).catch(()=>[]),
  ]);
  
  console.log(`OpenLigaDB: ${openLiga.length}, football-data.org: ${fdOrg.length}, API-Football: ${apiFb.length}`);
  
  const all = [...openLiga, ...fdOrg, ...apiFb];
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
