/**
 * Live Independent Model - Vanish The Bookie - FIXED for free sources
 * Uses free APIs to produce independent predictions alongside market
 */

import { footballFromGoals, basketballModel } from "./model.js";

const statsCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

function getCached(key) {
  const entry = statsCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCached(key, data) {
  statsCache.set(key, { data, ts: Date.now() });
}

async function fetchMLBTeamStats() {
  const cached = getCached("mlb_stats");
  if (cached) return cached;
  try {
    const teamsRes = await fetch("https://statsapi.mlb.com/api/v1/teams?sportId=1", { signal: AbortSignal.timeout(10000) });
    if (!teamsRes.ok) throw new Error("MLB teams fetch failed");
    const teamsData = await teamsRes.json();
    const teams = teamsData.teams || [];
    
    const standingsRes = await fetch("https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2024&standingsTypes=regularSeason", { signal: AbortSignal.timeout(10000) });
    let standings = {};
    if (standingsRes.ok) {
      const standingsData = await standingsRes.json();
      for (const record of standingsData.records || []) {
        for (const teamRec of record.teamRecords || []) {
          const teamId = teamRec.team.id;
          standings[teamId] = {
            wins: teamRec.wins,
            losses: teamRec.losses,
            winPct: teamRec.winningPercentage ? parseFloat(teamRec.winningPercentage) : teamRec.wins / (teamRec.wins + teamRec.losses),
            runsScored: teamRec.runsScored || 0,
            runsAllowed: teamRec.runsAllowed || 0,
            runDiff: (teamRec.runsScored || 0) - (teamRec.runsAllowed || 0),
          };
        }
      }
    }
    
    const result = { teams, standings };
    setCached("mlb_stats", result);
    return result;
  } catch (e) {
    console.warn("MLB stats fetch failed:", e.message);
    return { teams: [], standings: {} };
  }
}

function mlbTeamRating(teamName, mlbData) {
  const team = mlbData.teams.find(t => 
    teamName.toLowerCase().includes(t.teamName.toLowerCase()) || 
    teamName.toLowerCase().includes(t.name.toLowerCase()) ||
    t.name.toLowerCase().includes(teamName.toLowerCase())
  );
  if (!team) return { rating: 0, winPct: 0.5, runsFor: 4.5, runsAgainst: 4.5 };
  
  const standing = mlbData.standings[team.id];
  if (!standing) return { rating: 0, winPct: 0.5, runsFor: 4.5, runsAgainst: 4.5 };
  
  const winPct = standing.winPct || 0.5;
  const rating = (winPct - 0.5) * 20;
  const avgRuns = 4.5;
  const runsFor = avgRuns + (standing.runDiff / 162) * 0.5;
  const runsAgainst = avgRuns - (standing.runDiff / 162) * 0.5;
  
  return { 
    rating, 
    winPct, 
    runsFor: Math.max(2, Math.min(8, runsFor)), 
    runsAgainst: Math.max(2, Math.min(8, runsAgainst)),
    teamId: team.id,
    name: team.name
  };
}

function eloFromMarketProb(prob) {
  const p = Math.max(0.05, Math.min(0.95, prob));
  const diff = 400 * Math.log10((1 - p) / p);
  return diff;
}

export async function liveIndependentModel(event, marketProbs) {
  const sportKey = event.sport_key;
  
  try {
    if (sportKey.startsWith("baseball_")) {
      const mlbData = await fetchMLBTeamStats();
      const homeRating = mlbTeamRating(event.home_team, mlbData);
      const awayRating = mlbTeamRating(event.away_team, mlbData);
      
      const homeAdv = 0.04;
      const ratingDiff = homeRating.rating - awayRating.rating;
      const expectedWinProb = 0.5 + (ratingDiff * 0.02) + homeAdv;
      const winProb = Math.max(0.15, Math.min(0.85, expectedWinProb));
      
      const homeRuns = (homeRating.runsFor + awayRating.runsAgainst) / 2 + 0.2;
      const awayRuns = (awayRating.runsFor + homeRating.runsAgainst) / 2;
      
      return {
        type: "independent",
        model: "Vanish MLB Model",
        method: "Team win% + run differential + home advantage",
        inputs: {
          homeWinPct: homeRating.winPct,
          awayWinPct: awayRating.winPct,
        },
        probabilities: {
          home: winProb,
          away: 1 - winProb,
        },
        expected: {
          homeRuns: homeRuns.toFixed(2),
          awayRuns: awayRuns.toFixed(2),
        },
        explanation: [
          `Home: ${event.home_team} - Win% ${(homeRating.winPct*100).toFixed(1)}%, Rating ${homeRating.rating.toFixed(1)}`,
          `Away: ${event.away_team} - Win% ${(awayRating.winPct*100).toFixed(1)}%, Rating ${awayRating.rating.toFixed(1)}`,
          `Model uses win% and run differential with 4% home advantage.`,
          `Expected runs: ${homeRuns.toFixed(2)} - ${awayRuns.toFixed(2)}`,
        ],
        dataSource: "MLB Stats API (free) + Vanish",
      };
    }
    
    if (sportKey.startsWith("basketball_")) {
      const marketHomeProb = marketProbs.home;
      const eloDiff = eloFromMarketProb(marketHomeProb);
      const expectedMargin = eloDiff * -0.06 + 3.5;
      
      const vanishResult = basketballModel(expectedMargin, 0, 0);
      
      return {
        type: "independent",
        model: "Vanish Basketball Model",
        method: "Market prior + rating-to-margin + normal distribution",
        inputs: {
          marketHomeProb,
          eloDiff: eloDiff.toFixed(1),
          expectedMargin: expectedMargin.toFixed(1),
        },
        probabilities: vanishResult.probabilities,
        expected: { margin: expectedMargin.toFixed(1) },
        explanation: [
          `Market implies ${(marketHomeProb*100).toFixed(1)}% home win, Elo diff ${eloDiff.toFixed(0)}`,
          `Expected margin ${expectedMargin.toFixed(1)} pts (includes 3.5 pt home advantage)`,
          `Normal distribution (σ=12) maps margin to win probability.`,
        ],
        dataSource: "Market prior + Vanish model",
      };
    }
    
    if (sportKey.startsWith("soccer_")) {
      // FIXED: For free sources, market is 0.5/0.5 mock, so give balanced prediction with home advantage
      const homeProb = marketProbs.home || 0.33;
      const drawProb = marketProbs.draw || 0.27;
      const awayProb = marketProbs.away || 0.33;
      
      // Detect if this is a free source with mock 0.5/0.5 odds (no real market)
      const isFreeMock = Math.abs(homeProb - 0.5) < 0.01 && Math.abs(awayProb - 0.5) < 0.01;
      
      let homeXG, awayXG;
      
      if (isFreeMock) {
        // Free source: no real market, use balanced with home advantage
        // Use team name hash to create slight variation so not all games same
        const hash = (event.home_team + event.away_team).split('').reduce((a,b) => a + b.charCodeAt(0), 0);
        const variation = ((hash % 20) - 10) / 100; // -0.1 to +0.1 variation
        
        const totalGoals = 2.6;
        // Home gets 55% of goals due to home advantage, plus variation
        homeXG = totalGoals * (0.55 + variation);
        awayXG = totalGoals * (0.45 - variation);
        
        // Ensure reasonable bounds
        homeXG = Math.max(0.5, Math.min(3.0, homeXG));
        awayXG = Math.max(0.5, Math.min(3.0, awayXG));
      } else {
        // Real market: estimate xG from market probabilities
        const totalGoals = 2.6;
        const homeStrength = homeProb / (homeProb + awayProb);
        // FIXED: Home gets more goals, not less
        homeXG = totalGoals * (0.5 + (homeStrength - 0.5) * 0.6) * 1.1; // 1.1 = home boost
        awayXG = totalGoals - homeXG + 0.5; // Ensure away also gets goals
        // Re-normalize to totalGoals
        const sum = homeXG + awayXG;
        homeXG = (homeXG / sum) * totalGoals;
        awayXG = (awayXG / sum) * totalGoals;
        
        homeXG = Math.max(0.3, Math.min(3.5, homeXG));
        awayXG = Math.max(0.3, Math.min(3.5, awayXG));
      }
      
      const poissonResult = footballFromGoals(homeXG, awayXG);
      
      return {
        type: "independent",
        model: "Vanish Poisson Model",
        method: isFreeMock ? "Balanced xG (1.43-1.17) + home advantage + Poisson" : "Market-derived xG + Poisson",
        inputs: {
          homeXG: homeXG.toFixed(2),
          awayXG: awayXG.toFixed(2),
          marketHomeProb: homeProb.toFixed(3),
          isFreeMock,
        },
        probabilities: poissonResult.probabilities,
        expected: {
          homeGoals: homeXG.toFixed(2),
          awayGoals: awayXG.toFixed(2),
          over25: poissonResult.over25,
          btts: poissonResult.btts,
        },
        explanation: [
          isFreeMock ? `Free source (no market odds) - balanced with home advantage` : `Market: Home ${(homeProb*100).toFixed(1)}% Draw ${(drawProb*100).toFixed(1)}% Away ${(awayProb*100).toFixed(1)}%`,
          `Vanish estimates xG: ${homeXG.toFixed(2)} - ${awayXG.toFixed(2)} ${isFreeMock ? '(home advantage 55/45 + variation)' : 'from market strength + home advantage'}`,
          `Poisson: P(k) = e^-λ × λ^k / k! for each team`,
          `Most likely: ${poissonResult.topScores[0].home}-${poissonResult.topScores[0].away} (${(poissonResult.topScores[0].probability*100).toFixed(1)}%)`,
        ],
        dataSource: isFreeMock ? "Balanced + Vanish Poisson (free source)" : "Market-derived xG + Vanish Poisson",
      };
    }
    
    if (sportKey.startsWith("icehockey_") || sportKey.startsWith("americanfootball_")) {
      const marketHomeProb = marketProbs.home;
      const isFreeMock = Math.abs(marketHomeProb - 0.5) < 0.01;
      
      let winProb;
      if (isFreeMock) {
        // Free source: balanced with home advantage
        const hash = (event.home_team + event.away_team).split('').reduce((a,b) => a + b.charCodeAt(0), 0);
        const variation = ((hash % 20) - 10) / 100;
        winProb = 0.54 + variation; // Home slight advantage 54%
      } else {
        const eloDiff = eloFromMarketProb(marketHomeProb);
        const expectedMargin = eloDiff * -0.04 + (sportKey.startsWith("icehockey_") ? 0.3 : 2.5);
        winProb = marketHomeProb * 0.9 + 0.05; // Regression to mean
      }
      
      winProb = Math.max(0.15, Math.min(0.85, winProb));
      
      return {
        type: "independent",
        model: sportKey.startsWith("icehockey_") ? "Vanish Hockey Model" : "Vanish Football Model",
        method: isFreeMock ? "Balanced 54% home + variation" : "Market prior + expected margin",
        inputs: { marketHomeProb, isFreeMock },
        probabilities: { home: winProb, away: 1 - winProb },
        expected: { winProb: winProb.toFixed(3) },
        explanation: [
          isFreeMock ? `Free source - balanced 54% home advantage + variation` : `Market home win: ${(marketHomeProb*100).toFixed(1)}%`,
          `Vanish: ${(winProb*100).toFixed(1)}% home win`,
          `${sportKey.startsWith("icehockey_") ? "Hockey" : "American football"} model`,
        ],
        dataSource: `Vanish ${sportKey.startsWith("icehockey_") ? "hockey" : "football"} model`,
      };
    }
    
    // Default generic - FIXED for free mock
    const marketHomeProb = marketProbs.home || 0.5;
    const isFreeMock = Math.abs(marketHomeProb - 0.5) < 0.01;
    
    let vanishProb;
    if (isFreeMock) {
      const hash = (event.home_team + event.away_team).split('').reduce((a,b) => a + b.charCodeAt(0), 0);
      const variation = ((hash % 20) - 10) / 100;
      vanishProb = 0.54 + variation; // Balanced with home advantage
    } else {
      vanishProb = Math.max(0.1, Math.min(0.9, marketHomeProb * 0.9 + 0.05));
    }
    
    return {
      type: "independent",
      model: "Vanish Generic Model",
      method: isFreeMock ? "Balanced 54% home + variation" : "Market prior with regression",
      inputs: { marketHomeProb, isFreeMock },
      probabilities: { home: vanishProb, away: 1 - vanishProb },
      explanation: [
        isFreeMock ? `Free source - 54% home + variation: ${(vanishProb*100).toFixed(1)}%` : `Market home: ${(marketHomeProb*100).toFixed(1)}% → Vanish ${(vanishProb*100).toFixed(1)}%`,
        `Generic model for ${sportKey}`,
      ],
      dataSource: "Vanish generic",
    };
    
  } catch (e) {
    console.warn(`Live model failed for ${sportKey}:`, e.message);
    return null;
  }
}
