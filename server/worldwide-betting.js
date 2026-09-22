/**
 * Worldwide Betting Options + Corners + SofaScore/Forebet Alternative
 * Generates: 1X2, Over/Under 2.5, BTTS, Double Chance, Correct Score, Corners
 */

export function generateWorldwideMarkets(homeGoals, awayGoals, homeProb, awayProb, drawProb, homeCorners=5, awayCorners=5) {
  const totalGoals = homeGoals + awayGoals;
  const totalCorners = homeCorners + awayCorners;
  
  function poisson(k, lambda) {
    let f=1;
    for (let i=2; i<=k; i++) f*=i;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / f;
  }
  
  const under25Prob = poisson(0, totalGoals) + poisson(1, totalGoals) + poisson(2, totalGoals);
  const over25Prob = 1 - under25Prob;
  
  const bttsYesProb = (1 - Math.exp(-homeGoals)) * (1 - Math.exp(-awayGoals));
  const bttsNoProb = 1 - bttsYesProb;
  
  const homeDrawProb = homeProb + drawProb;
  const awayDrawProb = awayProb + drawProb;
  const homeAwayProb = homeProb + awayProb;
  
  const likelyScores = [];
  for (let h = 0; h <= 3; h++) {
    for (let a = 0; a <= 3; a++) {
      const prob = poisson(h, homeGoals) * poisson(a, awayGoals);
      likelyScores.push({ score: `${h}-${a}`, prob });
    }
  }
  likelyScores.sort((a,b) => b.prob - a.prob);
  
  // Corners markets
  const overCorners95 = totalCorners > 9.5 ? 0.55 + (totalCorners-9.5)*0.05 : 0.45 - (9.5-totalCorners)*0.05;
  const underCorners95 = 1 - overCorners95;
  const overCorners105 = totalCorners > 10.5 ? 0.5 + (totalCorners-10.5)*0.05 : 0.4 - (10.5-totalCorners)*0.05;
  
  // Corner distribution
  const cornerOverUnder = {
    over95: { prob: Math.max(0.1, Math.min(0.9, overCorners95)), odds: 1/Math.max(0.1, overCorners95), label: "Over 9.5 Corners" },
    under95: { prob: Math.max(0.1, Math.min(0.9, underCorners95)), odds: 1/Math.max(0.1, underCorners95), label: "Under 9.5 Corners" },
    over105: { prob: Math.max(0.1, Math.min(0.9, overCorners105)), odds: 1/Math.max(0.1, overCorners105), label: "Over 10.5 Corners" },
    under105: { prob: Math.max(0.1, Math.min(0.9, 1-overCorners105)), odds: 1/Math.max(0.1, 1-overCorners105), label: "Under 10.5 Corners" },
  };
  
  return {
    overUnder: {
      over25: { prob: Math.max(0.05, Math.min(0.95, over25Prob)), odds: 1/Math.max(0.05, over25Prob), label: "Over 2.5 Goals" },
      under25: { prob: Math.max(0.05, Math.min(0.95, under25Prob)), odds: 1/Math.max(0.05, under25Prob), label: "Under 2.5 Goals" },
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
    corners: cornerOverUnder,
    correctScore: likelyScores.slice(0,3),
    totalGoals,
    homeGoals,
    awayGoals,
    totalCorners,
    homeCorners,
    awayCorners,
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
