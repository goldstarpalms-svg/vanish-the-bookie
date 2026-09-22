/**
 * Additional Free Sources - No API keys needed
 * ESPN, TheSportsDB, NHL, MLB, etc.
 */

const CACHE = new Map();
const TTL = 15 * 60 * 1000;

function cached(key, data) {
  CACHE.set(key, { data, ts: Date.now() });
}
function getCached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < TTL) return entry.data;
  return null;
}

// ESPN - Free, no key, many sports
export async function fetchESPNFree() {
  const leagues = [
    { sport: "baseball", league: "mlb", name: "MLB" },
    { sport: "basketball", league: "wnba", name: "WNBA" },
    { sport: "basketball", league: "nba", name: "NBA" },
    { sport: "basketball", league: "nbl", name: "NBL" },
    { sport: "hockey", league: "nhl", name: "NHL" },
    { sport: "football", league: "nfl", name: "NFL" },
    { sport: "soccer", league: "eng.1", name: "EPL" },
    { sport: "soccer", league: "esp.1", name: "La Liga" },
    { sport: "soccer", league: "ita.1", name: "Serie A" },
    { sport: "soccer", league: "ger.1", name: "Bundesliga" },
    { sport: "soccer", league: "fra.1", name: "Ligue 1" },
    { sport: "soccer", league: "usa.1", name: "MLS" },
    { sport: "soccer", league: "bra.1", name: "Brazil Serie A" },
  ];
  
  const games = [];
  for (const { sport, league, name } of leagues) {
    const cacheKey = `espn_${sport}_${league}`;
    let data = getCached(cacheKey);
    if (!data) {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) continue;
        data = await res.json();
        cached(cacheKey, data);
      } catch { continue; }
    }
    for (const ev of (data.events || []).slice(0, 15)) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      const home = comp.competitors?.find(c => c.homeAway === "home");
      const away = comp.competitors?.find(c => c.homeAway === "away");
      if (!home || !away) continue;
      const dt = new Date(ev.date);
      if (dt < new Date()) continue; // Only future
      if (dt - Date.now() > 7*24*3600000) continue; // Within 7 days
      games.push({
        id: `espn_${ev.id}`,
        sport: sport === "baseball" ? "baseball" : sport === "basketball" ? "basketball" : sport === "hockey" ? "icehockey" : sport === "football" ? "americanfootball" : "football",
        sportKey: `${sport}_${league}`,
        league: name,
        home: home.team.displayName,
        away: away.team.displayName,
        kickoff: ev.date,
        source: "ESPN",
      });
    }
  }
  return games;
}

// TheSportsDB - Free, no key, 1000s of leagues
export async function fetchTheSportsDB() {
  const leagueIds = [
    { id: 4328, name: "EPL" },
    { id: 4335, name: "La Liga" },
    { id: 4332, name: "Serie A" },
    { id: 4331, name: "Bundesliga" },
    { id: 4334, name: "Ligue 1" },
    { id: 4346, name: "MLS" },
    { id: 4356, name: "Brazil Serie A" },
  ];
  
  const games = [];
  for (const { id, name } of leagueIds) {
    const cacheKey = `tsdb_${id}`;
    let data = getCached(cacheKey);
    if (!data) {
      try {
        const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=${id}`, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) continue;
        data = await res.json();
        cached(cacheKey, data);
      } catch { continue; }
    }
    for (const ev of (data.events || []).slice(0, 10)) {
      if (!ev.strHomeTeam || !ev.strAwayTeam) continue;
      const dt = new Date(`${ev.dateEvent}T${ev.strTime || "15:00:00"}`);
      if (isNaN(dt.getTime())) continue;
      if (dt < new Date()) continue;
      if (dt - Date.now() > 7*24*3600000) continue;
      games.push({
        id: `tsdb_${ev.idEvent}`,
        sport: "football",
        sportKey: `soccer_${name.toLowerCase().replace(/ /g,"_")}`,
        league: name,
        home: ev.strHomeTeam,
        away: ev.strAwayTeam,
        kickoff: dt.toISOString(),
        source: "TheSportsDB",
      });
    }
  }
  return games;
}

// Combined free sources
export async function fetchAllFreeSources() {
  const [espn, tsdb] = await Promise.all([
    fetchESPNFree().catch(()=>[]),
    fetchTheSportsDB().catch(()=>[]),
  ]);
  
  const all = [...espn, ...tsdb];
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
