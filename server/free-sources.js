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
const LEAGUE_CANON = {
  "laliga": "La Liga", "serie a": "Serie A", "ligue 1": "Ligue 1", "primeira liga": "Primeira Liga",
  "english premier league": "Premier League", "english league championship": "EFL Championship",
  "italian serie a": "Serie A", "german bundesliga": "Bundesliga", "spanish laliga": "La Liga",
  "french ligue 1": "Ligue 1", "portuguese primeira liga": "Primeira Liga", "turkish super lig": "Turkish Super Lig",
  "english fa cup": "FA Cup", "uefa champions league": "Champions League", "uefa europa league": "Europa League",
  "uefa europa conference league": "Conference League", "usa major league soccer": "MLS",
  "spanish laliga 2": "LaLiga 2", "spanish copa del rey": "Copa del Rey", "italian coppa italia": "Coppa Italia",
  "mexican liga bbva mx": "Liga MX", "brazilian serie a": "Brasileirão Série A",
  "argentine liga profesional de futbol": "Argentine LPF", "greek super league": "Greek Super League",
  "danish superliga": "Danish Superliga", "swedish allsvenskan": "Allsvenskan",
  "russian premier league": "Russian Premier League", "keuken kampioen divisie": "Eerste Divisie",
  "usl championship": "USL Championship",
  "brasileiro serie b": "Brasileirão Série B", "primera division de chile": "Chilean Primera División",
  "bolivian liga profesional": "Bolivian Liga Profesional", "copa chile": "Copa Chile",
  "copa colombia": "Copa Colombia", "colombian primera a": "Colombian Primera A",
  "peruvian primera division": "Peruvian Primera División", "uruguayan primera division": "Uruguayan Primera División",
  "ecuadorian liga pro": "Ecuadorian Liga Pro", "guatemalan liga nacional": "Guatemalan Liga Nacional",
  "honduran liga nacional": "Honduran Liga Nacional", "argentine primera nacional": "Argentine Primera Nacional",
  "argentine primera b metropolitana": "Argentine Primera B Metropolitana", "ligue 2": "Ligue 2", "afc champions league elite": "AFC Champions League Elite",
};
const LEAGUE_CANON_KEYS = Object.keys(LEAGUE_CANON).sort((a, b) => b.length - a.length);

function prettyLeague(raw) {
  let s = String(raw || "").trim();
  if (!s) return s;
  // a bare year prefix ("2026 Brasileiro Serie B") is feed noise, strip it first
  const yearless = s.replace(/^\d{4}-\d{2}-/, "").replace(/^\d{4}[-\s]+/, "");
  const lookup = (v) => LEAGUE_CANON[v.toLowerCase().replace(/\s+/g, " ").trim()] || null;
  const direct = lookup(yearless);
  if (direct) return direct;
  if (!/^\d{4}-\d{2}-/.test(s) && !/^[a-z0-9-]+$/.test(s)) return yearless; // already human
  s = yearless.replace(/-/g, " ");
  const hit = lookup(s);
  if (hit) return hit;
  // longest-prefix match handles "Italian Serie A 2026" style suffixes
  const lower = s.toLowerCase();
  for (const key of LEAGUE_CANON_KEYS) if (lower.startsWith(key)) return LEAGUE_CANON[key];
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ESPN's soccer scoreboards label many events with the *round* ("Regular
// Season", "League Stage", "Clausura") instead of the competition, which is why
// whole leagues used to vanish from the board. The event uid carries the league
// id (s:600~l:730~e:...), and the core API resolves that id to a real name.
const ESPN_LEAGUE_NAMES = new Map(); // "730" -> "Italian Serie A"

async function resolveEspnLeagueName(id) {
  if (!id) return null;
  if (ESPN_LEAGUE_NAMES.has(id)) return ESPN_LEAGUE_NAMES.get(id);
  try {
    const res = await fetch(`https://sports.core.api.espn.com/v2/sports/soccer/leagues/${id}?lang=en`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) { ESPN_LEAGUE_NAMES.set(id, null); return null; }
    const j = await res.json();
    const name = j.name || j.abbreviation || null;
    ESPN_LEAGUE_NAMES.set(id, name);
    return name;
  } catch {
    ESPN_LEAGUE_NAMES.set(id, null);
    return null;
  }
}

export async function fetchESPNAllWorldwide() {
  const cacheKey = "espn_all_worldwide";
  const cachedData = getCached(cacheKey);
  if (cachedData) return cachedData;

  const TOP_LEAGUES = ["Premier League","LaLiga","Bundesliga","Serie A","Ligue 1","Eredivisie","Primeira Liga","Championship","Serie B","Ligue 2","Belgian Pro League","Scottish Premiership","Super Lig","Champions League","Europa League","Conference League","MLS","Major League Soccer","FA Cup","Copa del Rey","DFB Pokal","Coppa Italia","KNVB Cup","World Cup","Euro","AFCON","Copa America","League One","League Two","Liga MX","Brazil","Argentine","Turkish","A-League","J1 League","Swiss Super League","Austrian Bundesliga","Danish Superliga","Allsvenskan","Greek Super League","Chinese Super League","Saudi Pro League","Coupe de France","Russian Premier League","Keuken Kampioen","Brasileirao","Chilean","Bolivian","Peruvian","Colombian","Uruguayan","Paraguayan","Ecuadorian","Venezuelan","Egyptian","Moroccan","Tunisian","Algerian","South African","Israeli","Polish","Czech","Croatian","Serbian","Romanian","Bulgarian","Slovak","Slovenian","Hungarian","Ukrainian","Norwegian","Finnish","Icelandic","Irish","Welsh","Segunda"];
  const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ROUND_SLUG = /^(regular[- ]?season|league[- ]?stage|clausura|apertura|torneo.*|quarter[- ]?finals?|semi[- ]?finals?|final|final[- ]?stage|group[- ]?stage|playoffs?|round.*|matchday.*|postseason|preseason|.*conference.*)$/i;
  const BLOCKED = ["second-preliminary","first preliminary","preliminary","derde divisie","vierde divisie","regionalliga","oberliga","isthmian","southern football","northern premier","professional development","u21","u19","u23","women"," w ","ladies","reserve","youth","academy","amateur","county","southern league","second-round-qualifying","first round qualifying","qualifying","acv","hoogeveen","b team","c team","ncaa","college"];

  const now = new Date();
  const ymd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  const urls = [
    // rolling window plus an explicit today slate, so a quiet morning request
    // still sees every fixture scheduled for today
    "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?limit=500",
    `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${ymd}&limit=500`,
  ];

  const events = new Map();
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const data = await res.json();
      for (const ev of (data.events || [])) events.set(ev.id, ev);
    } catch {}
  }

  // first pass: keep playable events and collect the league ids we must resolve
  const rows = [];
  const leagueIds = new Set();
  for (const ev of events.values()) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors?.find((c) => c.homeAway === "home");
    const away = comp.competitors?.find((c) => c.homeAway === "away");
    if (!home || !away) continue;
    const dt = new Date(ev.date);
    if (dt < new Date(Date.now() - 12 * 3600000)) continue;
    if (dt - Date.now() > 7 * 24 * 3600000) continue;
    const homeName = home.team?.displayName || home.team?.name;
    const awayName = away.team?.displayName || away.team?.name;
    if (!homeName || !awayName) continue;
    if (/\bTBC\b|\bTBA\b|\bTBD\b/i.test(`${homeName} ${awayName}`)) continue;
    const leagueId = (String(ev.uid || "").match(/~l:(\d+)/) || [])[1] || null;
    if (leagueId) leagueIds.add(leagueId);
    rows.push({ ev, comp, homeName, awayName, leagueId });
  }

  // resolve distinct league ids in small waves (one cold start ≈ 25 short calls)
  const ids = [...leagueIds];
  for (let k = 0; k < ids.length; k += 6) {
    await Promise.all(ids.slice(k, k + 6).map(resolveEspnLeagueName));
  }

  const games = [];
  for (const { ev, comp, homeName, awayName, leagueId } of rows) {
    const candidates = [ev.leagues?.[0]?.name, ev.season?.slug, comp.league?.name]
      .filter(Boolean)
      .map(String);
    const roundFree = candidates.find((s) => {
      const stripped = s.replace(/^\d{4}(-\d{2})?-/, "");
      return !ROUND_SLUG.test(stripped) && !/^\d{4}(-\d{2})?$/.test(s);
    });
    if (leagueId && ESPN_BLOCKED_LEAGUE_IDS.has(Number(leagueId))) continue;
    const resolved = leagueId
      ? (ESPN_LEAGUE_BY_ID.get(String(leagueId)) || ESPN_LEAGUE_NAME_FALLBACK[leagueId] || null)
      : null;
    const leagueName = prettyLeague(resolved || roundFree || candidates[0] || "Football");

    const lowCombined = `${leagueName} ${homeName} ${awayName}`.toLowerCase();
    if (BLOCKED.some((kw) => lowCombined.includes(kw))) continue;
    const isBTeam = (name) => /\s+b$/.test(name) || /\s+b\s/.test(name) || /\b[abc] team\b/.test(name);
    if (isBTeam(homeName.toLowerCase()) || isBTeam(awayName.toLowerCase())) continue;

    games.push({
      id: `espn_world_${ev.id}`,
      sport: "football",
      sportKey: `soccer_world_${normKey(leagueName).slice(0, 30)}`,
      league: leagueName,
      leagueId,
      topLeague: TOP_LEAGUES.some((t) => normKey(leagueName).includes(normKey(t))),
      home: homeName,
      away: awayName,
      kickoff: ev.date,
      source: "ESPN Worldwide",
    });
  }
  cached(cacheKey, games);
  return games;
}

// ESPN's sport keys -> the labels the app uses. Anything unknown keeps its own
// key rather than being silently relabelled as football.
const ESPN_SPORT_MAP = {
  baseball: "baseball",
  basketball: "basketball",
  hockey: "icehockey",
  football: "americanfootball",
  soccer: "football",
  tennis: "tennis",
  mma: "mma",
  golf: "golf",
  cricket: "cricket",
  rugby: "rugby",
};

// ESPN labels many scoreboard events with the round ("Regular Season") rather
// than the competition. Every per-league board we fetch tells us the real
// id -> name pair, so remember them and reuse it for the worldwide feed.
// ESPN league ids we see in the worldwide feed but do not fetch per-league
// boards for (so the id -> name map never learns them). Kept explicit so no
// fixture ever reaches the board labelled "Regular Season".
const ESPN_LEAGUE_NAME_FALLBACK = {
  3902: "AFC Champions League Elite",
  3903: "Argentine Primera Nacional",
  3904: "Argentine Primera B Metropolitana",
  3928: "Guatemalan Liga Nacional",
  3929: "Honduran Liga Nacional",
  3931: "Italian Serie B",
  3934: "Paraguayan Primera División",
  3943: "Salvadoran Primera División",
  3949: "Venezuelan Primera División",
  660: "Ecuadorian Liga Pro",
  650: "Colombian Primera A",
  670: "Peruvian Primera División",
  680: "Uruguayan Primera División",
  4002: "USL Championship",
  8306: "Copa do Brasil",
  8312: "Copa Chile",
  8313: "Copa Colombia",
  19915: "USL League One",
  23541: "Mexican Liga de Expansión",
};
// women's competitions ESPN surfaces in the same feed
const ESPN_BLOCKED_LEAGUE_IDS = new Set([8301, 23286, 20956]); // NWSL, Northern SL, Liga F — women's competitions

const ESPN_LEAGUE_BY_ID = new Map(); // "770" -> "MLS"

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
      const lg = data.leagues?.[0];
      if (lg?.id && (lg.name || lg.abbreviation)) {
        ESPN_LEAGUE_BY_ID.set(String(lg.id), lg.name || lg.abbreviation);
      }
      cached(cacheKey, data);
      return { sport, league, name, data };
    } catch { return null; }
  };
  const boards = [];
  const WAVE = 10;
  for (let i = 0; i < leagues.length; i += WAVE) {
    const batch = await Promise.all(leagues.slice(i, i + WAVE).map(fetchBoard));
    boards.push(...batch);
  }
  for (const board of boards) {
    if (!board) continue;
    const { sport, league, name, data } = board;
    
    // Special handling for tennis: events are tournaments, matches live in groupings[].competitions[]
    if (sport === "tennis") {
      const lo = Date.now() - 12 * 3600000;
      const hi = Date.now() + 7 * 86400000;
      const found = [];
      for (const ev of (data.events || [])) {
        const tournamentName = ev.name || name;
        for (const grouping of (ev.groupings || [])) {
          for (const comp of (grouping.competitions || [])) {
            const competitors = comp.competitors || [];
            if (competitors.length < 2) continue;
            const homeName = competitors[0].athlete?.displayName || competitors[0].team?.displayName || competitors[0].displayName;
            const awayName = competitors[1].athlete?.displayName || competitors[1].team?.displayName || competitors[1].displayName;
            if (!homeName || !awayName) continue;
            if (/\bTBD\b|\bTBA\b/i.test(homeName + awayName)) continue;
            const dt = new Date(comp.date || ev.date);
            const t = dt.getTime();
            if (!Number.isFinite(t) || t < lo || t > hi) continue;
            if ((comp.status?.type?.name || "").toUpperCase().includes("FINAL")) continue;
            found.push({
              id: `espn_tennis_${comp.id || ev.id}_${homeName}_${awayName}`.replace(/[^a-z0-9_]+/gi, "_").toLowerCase(),
              sport: "tennis",
              sportKey: `tennis_${league}`,
              league: tournamentName,
              home: homeName,
              away: awayName,
              kickoff: dt.toISOString(),
              source: "ESPN",
            });
          }
        }
      }
      // kickoff order, cap so tennis never swamps the football board
      found.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
      games.push(...found.slice(0, 40));
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
      // placeholders like "TBC v TBC" (ESPN cricket) are not fixtures
      if (/\bTBC\b|\bTBA\b|\bTBD\b/i.test(`${homeName} ${awayName}`)) continue;

      games.push({
        id: `espn_${ev.id}`,
        sport: ESPN_SPORT_MAP[sport] || sport,
        sportKey: `${sport}_${league}`,
        league: prettyLeague(name),
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
  // per-league boards first: they teach the worldwide feed what each league id
  // is called (ESPN labels many events with the round instead of the competition)
  const espn = await fetchESPNFree().catch(()=>[]);
  const [espnAll, tsdb, football, mlb, nhl] = await Promise.all([
    fetchESPNAllWorldwide().catch(()=>[]),
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
