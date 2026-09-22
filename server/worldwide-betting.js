/**
 * Worldwide Betting Options + SofaScore/Forebet Alternative
 * Since SofaScore & Forebet block (403), we use ESPN Worldwide (100 games, 50+ leagues)
 * Generates worldwide betting markets: 1X2, Over/Under, BTTS, Double Chance, Correct Score
 */

export function generateWorldwideMarkets(homeGoals, awayGoals, homeProb, awayProb, drawProb) {
  const totalGoals = homeGoals + awayGoals;
  
  // Poisson for Over/Under 2.5 - P(X <= 2)
  function poisson(k, lambda) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
  }
  function factorial(n) {
    if (n <= 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }
  
  const under25Prob = poisson(0, totalGoals) + poisson(1, totalGoals) + poisson(2, totalGoals);
  const over25Prob = 1 - under25Prob;
  
  // BTTS
  const bttsYesProb = (1 - Math.exp(-homeGoals)) * (1 - Math.exp(-awayGoals));
  const bttsNoProb = 1 - bttsYesProb;
  
  // Double Chance
  const homeDrawProb = homeProb + drawProb;
  const awayDrawProb = awayProb + drawProb;
  const homeAwayProb = homeProb + awayProb;
  
  // Correct Score top 3
  const likelyScores = [];
  for (let h = 0; h <= 3; h++) {
    for (let a = 0; a <= 3; a++) {
      const prob = poisson(h, homeGoals) * poisson(a, awayGoals);
      likelyScores.push({ score: `${h}-${a}`, prob });
    }
  }
  likelyScores.sort((a,b) => b.prob - a.prob);
  
  return {
    overUnder: {
      over25: { prob: Math.max(0.05, Math.min(0.95, over25Prob)), odds: 1/Math.max(0.05, over25Prob), label: "Over 2.5" },
      under25: { prob: Math.max(0.05, Math.min(0.95, under25Prob)), odds: 1/Math.max(0.05, under25Prob), label: "Under 2.5" },
    },
    btts: {
      yes: { prob: bttsYesProb, odds: 1/bttsYesProb, label: "BTTS Yes" },
      no: { prob: bttsNoProb, odds: 1/bttsNoProb, label: "BTTS No" },
    },
    doubleChance: {
      homeDraw: { prob: homeDrawProb, odds: 1/homeDrawProb, label: "1X (Home/Draw)" },
      awayDraw: { prob: awayDrawProb, odds: 1/awayDrawProb, label: "X2 (Away/Draw)" },
      homeAway: { prob: homeAwayProb, odds: 1/homeAwayProb, label: "12 (Home/Away)" },
    },
    correctScore: likelyScores.slice(0,3),
    totalGoals,
    homeGoals,
    awayGoals,
  };
}

export async function fetchESPNAllWorldwide() {
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
      let leagueName = "Football";
      if (ev.leagues && ev.leagues[0]?.name) leagueName = ev.leagues[0].name;
      else if (comp.league?.name) leagueName = comp.league.name;
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
    return games;
  } catch { return []; }
}
