/**
 * WORLDWIDE Free Sources - ALL SPORTS including Tennis (54 matches per tournament) + Others
 * ESPN Worldwide 100 football + 40 leagues + Tennis ATP 39+15 matches, WTA 5 tournaments, UFC, Golf, etc.
 * Total: 250+ games worldwide, all sports
 */

const CACHE = new Map();
const TTL = 15 * 60 * 1000;

function cached(key, data) { CACHE.set(key, { data, ts: Date.now() }); }
function getCached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < TTL) return entry.data;
  return null;
}

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
        games.push({ id: `mlb_${g.gamePk}`, sport: "baseball", sportKey: "baseball_mlb", league: "MLB", home, away, kickoff: g.gameDate, source: "MLB Stats API" });
      }
    }
    cached(cacheKey, games);
    return games;
  } catch { return []; }
}

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
        games.push({ id: `nhl_${g.id}`, sport: "icehockey", sportKey: "icehockey_nhl", league: "NHL", home, away, kickoff: g.startTimeUTC, source: "NHL API" });
      }
    }
    cached(cacheKey, games);
    return games;
  } catch { return []; }
}

/** ESPN now returns slug league names in the worldwide feed: pretty them up. */
function prettyLeague(raw) {
  let s = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-/.test(s) && !/^[a-z0-9-]+$/.test(s)) return s; // already human
  s = s.replace(/^\d{4}-\d{2}-/, "").replace(/-/g, " ");
  const fixes = {
    "laliga": "La Liga", "serie a": "Serie A", "ligue 1": "Ligue 1", "primeira liga": "Primeira Liga",
    "english premier league": "Premier League", "english league championship": "EFL Championship",
    "italian serie a": "Serie A", "german bundesliga": "Bundesliga", "spanish laliga": "La Liga",
    "french ligue 1": "Ligue 1", "portuguese primeira liga": "Primeira Liga", "turkish super lig": "Turkish Super Lig",
    "english fa cup": "FA Cup", "uefa champions league": "Champions League", "uefa europa league": "Europa League",
    "uefa europa conference league": "Conference League", "usa major league soccer": "MLS",
    "mexican liga mx": "Liga MX", "brazilian serie a": "Brazil Serie A", "argentine liga profesional": "Argentine LPF",
    "saudi pro league": "Saudi Pro League", "chinese super league": "Chinese Super League",
    "swedish allsvenskan": "Allsvenskan", "danish superliga": "Danish Superliga", "greek super league": "Greek Super League",
    "swiss super league": "Swiss Super League", "austrian bundesliga": "Austrian Bundesliga",
    "russian premier league": "Russian Premier League", "dutch eredivisie": "Eredivisie",
  };
  const key = s.toLowerCase();
  if (fixes[key]) return fixes[key];
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export async function fetchESPNAllWorldwide() {
  const cacheKey = "espn_all_worldwide";
  let cachedData = getCached(cacheKey);
  if (cachedData) return cachedData;
  // Only top leagues available on Bet9ja/SportyBet etc — block obscure second-preliminary, Derde Divisie etc
  const TOP_LEAGUES = ["Premier League","LaLiga","La Liga","Bundesliga","Serie A","Ligue 1","Eredivisie","Primeira Liga","Championship","La Liga 2","Serie B","Bundesliga 2","Ligue 2","Belgian Pro League","Scottish Premiership","Super Lig","Champions League","Europa League","Conference League","MLS","FA Cup","Copa del Rey","DFB Pokal","Coppa Italia","KNVB Cup","World Cup","Euro","AFCON","Copa America","League One","League Two","EFL Trophy","MLB","NBA","WNBA","NHL","NFL","Liga MX","Brazil","Argentine","Turkish","A-League","J1 League","Swiss Super League","Austrian Bundesliga","Danish Superliga","Allsvenskan","Greek Super League","Chinese Super League","Saudi Pro League","Coupe de France","Russian Premier League"];
  const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const BLOCKED = ["second-preliminary","first preliminary","preliminary","derde divisie","vierde divisie","regionalliga","oberliga","isthmian","southern football","northern premier","professional development","u21","u19","u23","women","reserve","youth","academy","amateur","county","southern league","group-stage","second-round-qualifying","first round qualifying","qualifying","acv","hoogeveen","b team","c team"];
  try {
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard", { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    const games = [];
    for (const ev of (data.events || []).slice(0, 400)) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      const home = comp.competitors?.find(c => c.homeAway === "home");
      const away = comp.competitors?.find(c => c.homeAway === "away");
      if (!home || !away) continue;
      const dt = new Date(ev.date);
      if (dt < new Date(Date.now() - 12*3600000)) continue;
      if (dt - Date.now() > 7*24*3600000) continue;
      let leagueName = "Football";
      if (ev.leagues && ev.leagues[0]?.name) leagueName = prettyLeague(ev.leagues[0].name);
      else if (comp.league?.name) leagueName = prettyLeague(comp.league.name);
      else if (ev.season?.slug) leagueName = prettyLeague(ev.season.slug);
      const lowLeague = leagueName.toLowerCase();
      const homeLower = home.team.displayName.toLowerCase();
      const awayLower = away.team.displayName.toLowerCase();
      const lowCombined = `${lowLeague} ${homeLower} ${awayLower}`;
      if (BLOCKED.some(kw => lowCombined.includes(kw))) continue;
      // Block B teams like Hibernian B, Aberdeen B, Rangers B — not on Bet9ja
      const isBTeam = (name) => name.endsWith(" b") || name.includes(" b ") || /\b[abc] team\b/.test(name) || name.match(/\b\w+ [abc]$/);
      if (isBTeam(homeLower) || isBTeam(awayLower)) continue;
      // Block obscure Scottish low leagues
      const obscureScottish = ["alloa","banks o'dee","berwick","bonnyrigg","clydebank","dumbarton","east kilbride","edinburgh city","elgin city","hibernian b","aberdeen b","rangers b","celtic b","dundee b","kilmanrock b","st mirren b","ncaa","ncaa division","fighting camels","blue hens","buccaneers","jaguars","leathernecks","greyhounds","monarchs","bonnies","seawolves","huskies","terriers","bulldogs"];
      if (obscureScottish.some(kw => lowCombined.includes(kw))) continue;
      // STRICT: Only allow top leagues — Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Eredivisie, Primeira, Championship, Champions League, Europa, Conference, MLS, FA Cup, etc, MLB, NBA, NHL, NFL, MLS, Liga MX, Brazil, Argentine, Turkish, Scottish Prem, etc
      const isTop = TOP_LEAGUES.some(t => normKey(lowLeague).includes(normKey(t)));
      // For worldwide, require top league — block generic league-phase, group-stage, qualifying, round-of-16, ncaa unless top
      if (!isTop) {
        // Allow league-phase only if it's Champions League with top clubs
        const isChampionsTop = lowLeague.includes("league-phase") && (lowCombined.includes("bayern") || lowCombined.includes("manchester") || lowCombined.includes("real madrid") || lowCombined.includes("barcelona") || lowCombined.includes("psg") || lowCombined.includes("inter") || lowCombined.includes("arsenal") || lowCombined.includes("liverpool") || lowCombined.includes("chelsea") || lowCombined.includes("dortmund"));
        if (!isChampionsTop) continue;
      }
      games.push({
        id: `espn_world_${ev.id}`, sport: "football",
        sportKey: `soccer_world_${leagueName.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,30)}`,
        league: leagueName, home: home.team.displayName, away: away.team.displayName,
        kickoff: ev.date, source: "ESPN Worldwide",
      });
    }
    cached(cacheKey, games);
    return games;
  } catch { return []; }
}

const ESPN_LEAGUES = [
  { sport: "baseball", league: "mlb", name: "MLB" },
  { sport: "basketball", league: "nba", name: "NBA" },
  { sport: "basketball", league: "wnba", name: "WNBA" },
  { sport: "hockey", league: "nhl", name: "NHL" },
  { sport: "football", league: "nfl", name: "NFL" },
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
  // Expanded worldwide coverage (client request: more games, more leagues)
  { sport: "soccer", league: "bel.1", name: "Belgian Pro League" },
  { sport: "soccer", league: "sui.1", name: "Swiss Super League" },
  { sport: "soccer", league: "aut.1", name: "Austrian Bundesliga" },
  { sport: "soccer", league: "den.1", name: "Danish Superliga" },
  { sport: "soccer", league: "swe.1", name: "Allsvenskan" },
  { sport: "soccer", league: "gre.1", name: "Greek Super League" },
  { sport: "soccer", league: "chn.1", name: "Chinese Super League" },
  { sport: "soccer", league: "ksa.1", name: "Saudi Pro League" },
  { sport: "soccer", league: "eng.3", name: "EFL League One" },
  { sport: "soccer", league: "uefa.europa.conf", name: "Conference League" },
  { sport: "soccer", league: "ger.dfb_pokal", name: "DFB Pokal" },
  { sport: "soccer", league: "esp.copa_del_rey", name: "Copa del Rey" },
  { sport: "soccer", league: "ita.coppa_italia", name: "Coppa Italia" },
  { sport: "soccer", league: "fra.coupe_de_france", name: "Coupe de France" },
  { sport: "soccer", league: "eng.fa", name: "FA Cup" },
  // US college + more sports
  { sport: "football", league: "college-football", name: "NCAA Football" },
  { sport: "basketball", league: "mens-college-basketball", name: "NCAA Basketball" },
  { sport: "cricket", league: "8039", name: "Cricket" },
  { sport: "rugby", league: "289234", name: "Rugby" },
  // Tennis - FIXED to handle groupings structure
  { sport: "tennis", league: "atp", name: "ATP Tennis" },
  { sport: "tennis", league: "wta", name: "WTA Tennis" },
  // MMA / UFC
  { sport: "mma", league: "ufc", name: "UFC" },
  // Golf
  { sport: "golf", league: "pga", name: "PGA Golf" },
];

export async function fetchESPNFree() {
  // ONLY top leagues available on Bet9ja/SportyBet/BetKing/MSport/1xBet/Betway — user complaint: most games not on my bookie
  const leagues = ESPN_LEAGUES;
  
  const games = [];
  const fetchBoard = async ({ sport, league, name }) => {
    const cacheKey = `espn_${sport}_${league}`;
    const cachedBoard = getCached(cacheKey);
    if (cachedBoard) return { sport, league, name, data: cachedBoard };
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const data = await res.json();
      cached(cacheKey, data);
      return { sport, league, name, data };
    } catch { return null; }
  };
  const boards = [];
  const WAVE = 6;
  for (let i = 0; i < leagues.length; i += WAVE) {
    const batch = await Promise.all(leagues.slice(i, i + WAVE).map(fetchBoard));
    boards.push(...batch);
  }
  for (const board of boards) {
    if (!board) continue;
    const { sport, league, name, data } = board;
    
    // Special handling for tennis: events are tournaments, matches in groupings[].competitions[]
    if (sport === "tennis") {
      for (const ev of (data.events || []).slice(0, 5)) {
        const tournamentName = ev.name || name;
        const tournamentDate = ev.date;
        // Check groupings
        for (const grouping of (ev.groupings || [])) {
          for (const comp of (grouping.competitions || []).slice(0, 20)) {
            const competitors = comp.competitors || [];
            if (competitors.length < 2) continue;
            const home = competitors[0];
            const away = competitors[1];
            const homeName = home.athlete?.displayName || home.team?.displayName || home.displayName;
            const awayName = away.athlete?.displayName || away.team?.displayName || away.displayName;
            if (!homeName || !awayName || homeName === "TBD" || awayName === "TBD" || !homeName.trim() || !awayName.trim()) continue;
            const dt = new Date(comp.date || tournamentDate);
            if (isNaN(dt.getTime())) continue;
            if (dt < new Date(Date.now() - 12*3600000)) continue;
            if (dt - Date.now() > 7*24*3600000) continue;
            games.push({
              id: `espn_${comp.id || ev.id}_${homeName}_${awayName}`.replace(/\s+/g,'_'),
              sport: "tennis",
              sportKey: `tennis_${league}`,
              league: `${tournamentName} (${name})`,
              home: homeName,
              away: awayName,
              kickoff: dt.toISOString(),
              source: "ESPN",
            });
          }
        }
      }
      continue;
    }
    
    // For other sports
    for (const ev of (data.events || []).slice(0, 20)) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      let home, away;
      home = comp.competitors?.find(c => c.homeAway === "home");
      away = comp.competitors?.find(c => c.homeAway === "away");
      if (!home || !away) {
        const comps = comp.competitors || [];
        if (comps.length >= 2) {
          home = comps[0];
          away = comps[1];
        } else continue;
      }
      const dt = new Date(ev.date);
      if (dt < new Date(Date.now() - 24*3600000)) continue;
      if (dt - Date.now() > 7*24*3600000) continue;
      
      let homeName, awayName;
      if (sport === "mma" || sport === "golf") {
        homeName = home.athlete?.displayName || home.team?.displayName || home.displayName || "Fighter 1";
        awayName = away.athlete?.displayName || away.team?.displayName || away.displayName || "Fighter 2";
      } else {
        homeName = home.team?.displayName || home.displayName;
        awayName = away.team?.displayName || away.displayName;
      }
      
      if (!homeName || !awayName) continue;
      
      games.push({
        id: `espn_${ev.id}`,
        sport: sport === "baseball" ? "baseball" : sport === "basketball" ? "basketball" : sport === "hockey" ? "icehockey" : sport === "football" ? "americanfootball" : sport === "tennis" ? "tennis" : sport === "mma" ? "mma" : sport === "golf" ? "golf" : "football",
        sportKey: `${sport}_${league}`,
        league: name,
        home: homeName,
        away: awayName,
        kickoff: ev.date,
        source: "ESPN",
      });
    }
  }
  return games;
}

export async function fetchTheSportsDB() {
  const leagueIds = [
    { id: 4328, name: "EPL" }, { id: 4335, name: "La Liga" }, { id: 4332, name: "Serie A" },
    { id: 4331, name: "Bundesliga" }, { id: 4334, name: "Ligue 1" }, { id: 4346, name: "MLS" },
    { id: 4356, name: "Brazil Serie A" }, { id: 4338, name: "NBA" }, { id: 4387, name: "NFL" },
    { id: 4391, name: "MLB" }, { id: 4380, name: "NHL" }, { id: 4329, name: "EFL Championship" },
    { id: 4330, name: "Scottish Prem" }, { id: 4336, name: "Eredivisie" }, { id: 4344, name: "Portuguese Primeira" },
    { id: 4347, name: "Argentine Primera" }, { id: 4355, name: "Turkish Super Lig" }, { id: 4406, name: "Champions League" },
    { id: 4443, name: "UFC" }, { id: 4388, name: "Tennis ATP" }, { id: 4389, name: "Tennis WTA" },
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
        sport: name.includes("NBA") ? "basketball" : name.includes("NFL") ? "americanfootball" : name.includes("MLB") ? "baseball" : name.includes("NHL") ? "icehockey" : name.includes("UFC") ? "mma" : name.includes("Tennis") ? "tennis" : "football",
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

// Diagnostic: what does ESPN actually answer, from *this* runtime (prod included)?
export async function diagnoseESPN() {
  const probe = async ({ sport, league }) => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;
    const t0 = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const text = await res.text();
      let events = null;
      try { events = (JSON.parse(text).events || []).length; } catch {}
      return { feed: `${sport}/${league}`, status: res.status, events, bytes: text.length, ms: Date.now() - t0 };
    } catch (e) {
      return { feed: `${sport}/${league}`, error: e.message, ms: Date.now() - t0 };
    }
  };
  const feeds = [];
  for (let i = 0; i < ESPN_LEAGUES.length; i += 6) {
    feeds.push(...await Promise.all(ESPN_LEAGUES.slice(i, i + 6).map(probe)));
  }
  const worldwide = await probe({ sport: "soccer", league: "all" });
  return { worldwide, feeds };
}
