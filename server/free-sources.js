/**
 * WORLDWIDE Free Sources + SofaScore/Forebet Alternative
 * Since SofaScore & Forebet block (403 Forbidden), we use:
 * - ESPN ALL soccer worldwide (50+ leagues, 100 games in one call, free no key) - BEST
 * - ESPN 40 leagues individual (free)
 * - MLB Stats API (16/day free), NHL API (51/week free)
 * - TheSportsDB 23 leagues (free), OpenLigaDB, football-data.org 13 comps
 * Total: 100-200 games free worldwide
 */

const CACHE = new Map();
const TTL = 15 * 60 * 1000;

function cached(key, data) { CACHE.set(key, { data, ts: Date.now() }); }
function getCached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < TTL) return entry.data;
  return null;
}

// MLB Stats API - FREE, unlimited, no key
export async function fetchMLBStats() {
  const cacheKey = "mlb_stats";
  let cachedData = getCached(cacheKey);
  if (cachedData) return cachedData;
  try {
    const today = new Date().toISOString().slice(0,10);
    const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const games = [];
    for (const date of data.dates || []) {
      for (const g of date.games || []) {
        const home = g.teams?.home?.team?.name;
        const away = g.teams?.away?.team?.name;
        if (!home || !away) continue;
        const dt = new Date(g.gameDate);
        if (dt < new Date(Date.now() - 24*3600000)) continue;
        games.push({
          id: `mlb_${g.gamePk}`,
          sport: "baseball",
          sportKey: "baseball_mlb",
          league: "MLB",
          home, away,
          kickoff: g.gameDate,
          source: "MLB Stats API",
        });
      }
    }
    cached(cacheKey, games);
    return games;
  } catch { return []; }
}

// NHL API - FREE, unlimited
export async function fetchNHLFree() {
  const cacheKey = "nhl_free";
  let cachedData = getCached(cacheKey);
  if (cachedData) return cachedData;
  try {
    const res = await fetch("https://api-web.nhle.com/v1/schedule/now", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const games = [];
    for (const week of data.gameWeek || []) {
      for (const g of week.games || []) {
        const home = g.homeTeam?.placeName?.default ? `${g.homeTeam.placeName.default} ${g.homeTeam.commonName?.default || ''}`.trim() : g.homeTeam?.commonName?.default;
        const away = g.awayTeam?.placeName?.default ? `${g.awayTeam.placeName.default} ${g.awayTeam.commonName?.default || ''}`.trim() : g.awayTeam?.commonName?.default;
        if (!home || !away) continue;
        const dt = new Date(g.startTimeUTC);
        if (dt < new Date(Date.now() - 24*3600000)) continue;
        if (dt - Date.now() > 7*24*3600000) continue;
        games.push({
          id: `nhl_${g.id}`,
          sport: "icehockey",
          sportKey: "icehockey_nhl",
          league: "NHL",
          home, away,
          kickoff: g.startTimeUTC,
          source: "NHL API",
        });
      }
    }
    cached(cacheKey, games);
    return games;
  } catch { return []; }
}

// ESPN ALL Soccer Worldwide - ONE CALL gets 100 games worldwide (free, no key, 847k data)
// This is the BEST alternative to SofaScore/Forebet which block with 403
export async function fetchESPNAllWorldwide() {
  const cacheKey = "espn_all_worldwide";
  let cachedData = getCached(cacheKey);
  if (cachedData) return cachedData;
  try {
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard", { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    const games = [];
    for (const ev of (data.events || []).slice(0, 150)) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      const home = comp.competitors?.find(c => c.homeAway === "home");
      const away = comp.competitors?.find(c => c.homeAway === "away");
      if (!home || !away) continue;
      const dt = new Date(ev.date);
      if (dt < new Date(Date.now() - 12*3600000)) continue;
      if (dt - Date.now() > 7*24*3600000) continue;
      
      // Get real league name from event
      let leagueName = "Football";
      if (ev.leagues && ev.leagues[0]?.name) leagueName = ev.leagues[0].name;
      else if (comp.league?.name) leagueName = comp.league.name;
      else if (ev.season?.slug) leagueName = ev.season.slug;
      
      games.push({
        id: `espn_world_${ev.id}`,
        sport: "football",
        sportKey: `soccer_world_${leagueName.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,30)}`,
        league: leagueName,
        home: home.team.displayName,
        away: away.team.displayName,
        kickoff: ev.date,
        source: "ESPN Worldwide",
      });
    }
    cached(cacheKey, games);
    console.log(`ESPN ALL Worldwide: ${games.length} games worldwide (alternative to SofaScore/Forebet)`);
    return games;
  } catch { return []; }
}

// ESPN - 40+ leagues individual
export async function fetchESPNFree() {
  const leagues = [
    { sport: "baseball", league: "mlb", name: "MLB" },
    { sport: "basketball", league: "nba", name: "NBA" },
    { sport: "basketball", league: "wnba", name: "WNBA" },
    { sport: "basketball", league: "nbl", name: "NBL" },
    { sport: "basketball", league: "mens-college-basketball", name: "NCAA Basketball" },
    { sport: "hockey", league: "nhl", name: "NHL" },
    { sport: "football", league: "nfl", name: "NFL" },
    { sport: "football", league: "college-football", name: "NCAA Football" },
    { sport: "soccer", league: "eng.1", name: "EPL" },
    { sport: "soccer", league: "eng.2", name: "EFL Championship" },
    { sport: "soccer", league: "esp.1", name: "La Liga" },
    { sport: "soccer", league: "esp.2", name: "LaLiga2" },
    { sport: "soccer", league: "ita.1", name: "Serie A" },
    { sport: "soccer", league: "ger.1", name: "Bundesliga" },
    { sport: "soccer", league: "fra.1", name: "Ligue 1" },
    { sport: "soccer", league: "usa.1", name: "MLS" },
    { sport: "soccer", league: "bra.1", name: "Brazil Serie A" },
    { sport: "soccer", league: "mex.1", name: "Liga MX" },
    { sport: "soccer", league: "ned.1", name: "Eredivisie" },
    { sport: "soccer", league: "por.1", name: "Primeira Liga" },
    { sport: "soccer", league: "uefa.champions", name: "Champions League" },
    { sport: "soccer", league: "uefa.europa", name: "Europa League" },
    { sport: "soccer", league: "arg.1", name: "Argentine LPF" },
    { sport: "soccer", league: "tur.1", name: "Turkish Super Lig" },
    { sport: "soccer", league: "sco.1", name: "Scottish Prem" },
    { sport: "soccer", league: "jpn.1", name: "J1 League" },
    { sport: "soccer", league: "aus.1", name: "A-League" },
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
    for (const ev of (data.events || []).slice(0, 20)) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      const home = comp.competitors?.find(c => c.homeAway === "home");
      const away = comp.competitors?.find(c => c.homeAway === "away");
      if (!home || !away) continue;
      const dt = new Date(ev.date);
      if (dt < new Date(Date.now() - 24*3600000)) continue;
      if (dt - Date.now() > 7*24*3600000) continue;
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

// TheSportsDB - 23 leagues
export async function fetchTheSportsDB() {
  const leagueIds = [
    { id: 4328, name: "EPL" }, { id: 4335, name: "La Liga" }, { id: 4332, name: "Serie A" },
    { id: 4331, name: "Bundesliga" }, { id: 4334, name: "Ligue 1" }, { id: 4346, name: "MLS" },
    { id: 4356, name: "Brazil Serie A" }, { id: 4338, name: "NBA" }, { id: 4387, name: "NFL" },
    { id: 4391, name: "MLB" }, { id: 4380, name: "NHL" }, { id: 4329, name: "EFL Championship" },
    { id: 4330, name: "Scottish Prem" }, { id: 4336, name: "Eredivisie" }, { id: 4344, name: "Portuguese Primeira" },
    { id: 4347, name: "Argentine Primera" }, { id: 4355, name: "Turkish Super Lig" }, { id: 4406, name: "Champions League" },
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
    for (const ev of (data.events || []).slice(0, 15)) {
      if (!ev.strHomeTeam || !ev.strAwayTeam) continue;
      const dt = new Date(`${ev.dateEvent}T${ev.strTime || "15:00:00"}`);
      if (isNaN(dt.getTime())) continue;
      if (dt < new Date(Date.now() - 12*3600000)) continue;
      if (dt - Date.now() > 7*24*3600000) continue;
      games.push({
        id: `tsdb_${ev.idEvent}`,
        sport: name === "NBA" ? "basketball" : name === "NFL" ? "americanfootball" : name === "MLB" ? "baseball" : name === "NHL" ? "icehockey" : "football",
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

export async function fetchAllFreeSources() {
  const { fetchAllFootballFree } = await import("./football-data.js");
  
  const [espnAll, espn, tsdb, football, mlb, nhl] = await Promise.all([
    fetchESPNAllWorldwide().catch(()=>[]),
    fetchESPNFree().catch(()=>[]),
    fetchTheSportsDB().catch(()=>[]),
    fetchAllFootballFree().catch(()=>[]),
    fetchMLBStats().catch(()=>[]),
    fetchNHLFree().catch(()=>[]),
  ]);
  
  const all = [...espnAll, ...espn, ...tsdb, ...football, ...mlb, ...nhl];
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
