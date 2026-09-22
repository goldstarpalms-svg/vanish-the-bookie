/**
 * Improved Training - Elo + Form from Historical Data (Football-Data UK + OpenFootball)
 * Free, no keys, works
 */

const ELO_CACHE = new Map();

function updateElo(rA, rB, result, k=20) {
  const expA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  const newA = rA + k * (result - expA);
  const newB = rB + k * ((1-result) - (1-expA));
  return [newA, newB];
}

export async function fetchHistoricalCSV() {
  try {
    const res = await fetch("https://www.football-data.co.uk/mmz4281/2425/E0.csv", { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const csv = await res.text();
    const lines = csv.split('\n');
    const games = [];
    for (let i=1; i<lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',');
      // E0,16/08/2024,20:00,Man United,Fulham,1,0,H,...
      if (cols.length < 7) continue;
      const home = cols[2]?.trim();
      const away = cols[3]?.trim();
      const fthg = parseInt(cols[4]);
      const ftag = parseInt(cols[5]);
      const ftr = cols[6]?.trim();
      if (!home || !away || isNaN(fthg) || isNaN(ftag) || !ftr) continue;
      games.push({ home, away, fthg, ftag, ftr });
    }
    return games;
  } catch (e) {
    console.warn("CSV fetch failed:", e.message);
    return [];
  }
}

export async function fetchOpenFootball() {
  try {
    const res = await fetch("https://raw.githubusercontent.com/openfootball/football.json/master/2024-25/en.1.json", { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    const games = [];
    for (const m of data.matches || []) {
      if (!m.team1 || !m.team2 || !m.score?.ft) continue;
      const fthg = m.score.ft[0];
      const ftag = m.score.ft[1];
      if (fthg == null || ftag == null) continue;
      const ftr = fthg > ftag ? 'H' : fthg < ftag ? 'A' : 'D';
      games.push({ home: m.team1, away: m.team2, fthg, ftag, ftr });
    }
    return games;
  } catch (e) {
    console.warn("OpenFootball fetch failed:", e.message);
    return [];
  }
}

export async function calculateEloRatings() {
  const cached = ELO_CACHE.get("elo");
  if (cached && Date.now() - cached.ts < 3600000) return cached.data;
  
  const [csvGames, openGames] = await Promise.all([
    fetchHistoricalCSV(),
    fetchOpenFootball(),
  ]);
  
  const historical = [...csvGames, ...openGames];
  console.log(`Training: CSV ${csvGames.length} + OpenFootball ${openGames.length} = ${historical.length} games`);
  
  const elo = new Map();
  
  // Initialize
  for (const g of historical) {
    if (!elo.has(g.home)) elo.set(g.home, 1500);
    if (!elo.has(g.away)) elo.set(g.away, 1500);
  }
  
  // Also add some common teams with variation for worldwide
  const commonTeams = ["Man City", "Arsenal", "Liverpool", "Real Madrid", "Barcelona", "Bayern Munich", "PSG", "Inter", "AC Milan", "Juventus"];
  for (const team of commonTeams) {
    if (!elo.has(team)) {
      // Give top teams higher Elo based on reputation
      const reputation = { "Man City": 1800, "Real Madrid": 1780, "Arsenal": 1750, "Liverpool": 1740, "Barcelona": 1730, "Bayern Munich": 1760, "PSG": 1720 };
      elo.set(team, reputation[team] || 1500);
    }
  }
  
  // Update Elo
  for (const g of historical) {
    const homeElo = elo.get(g.home) || 1500;
    const awayElo = elo.get(g.away) || 1500;
    let result;
    if (g.ftr === 'H') result = 1;
    else if (g.ftr === 'D') result = 0.5;
    else result = 0;
    
    const [newHome, newAway] = updateElo(homeElo, awayElo, result, 20);
    elo.set(g.home, newHome);
    elo.set(g.away, newAway);
  }
  
  const result = { elo, games: historical.length, csvGames: csvGames.length, openGames: openGames.length };
  ELO_CACHE.set("elo", { data: result, ts: Date.now() });
  return result;
}

// Get team rating with fuzzy matching
export function getTeamElo(teamName, eloMap) {
  // Exact match
  if (eloMap.has(teamName)) return eloMap.get(teamName);
  
  // Fuzzy: check if teamName contains known team or vice versa
  const lower = teamName.toLowerCase();
  for (const [known, rating] of eloMap.entries()) {
    const knownLower = known.toLowerCase();
    if (lower.includes(knownLower) || knownLower.includes(lower) || 
        lower.split(' ')[0] === knownLower.split(' ')[0]) {
      return rating;
    }
  }
  
  // Generate consistent rating from team name hash for unknown teams
  // This ensures same team always gets same rating, with variation
  let hash = 0;
  for (let i=0; i<teamName.length; i++) hash = (hash * 31 + teamName.charCodeAt(i)) % 1000;
  const variation = (hash % 200) - 100; // -100 to +100
  return 1500 + variation;
}
