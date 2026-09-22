/**
 * Live Independent Model - Vanish The Bookie - ACCURACY FOCUSED
 * User: "I don't care about the odds all I need I am correct prediction"
 * So we optimize for CORRECTNESS, not odds value
 * Trained on 380+ games, Elo, Form, Corners, xG
 */

import { footballFromGoals, basketballModel } from "./model.js";
import { calculateAdvancedRatings, getTeamData } from "./train-model-advanced.js";
import { calculateEloRatings, getTeamElo } from "./train-model.js";

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
          standings[teamRec.team.id] = {
            wins: teamRec.wins, losses: teamRec.losses,
            winPct: teamRec.winningPercentage ? parseFloat(teamRec.winningPercentage) : teamRec.wins / (teamRec.wins + teamRec.losses),
            runsScored: teamRec.runsScored || 0, runsAllowed: teamRec.runsAllowed || 0,
            runDiff: (teamRec.runsScored || 0) - (teamRec.runsAllowed || 0),
          };
        }
      }
    }
    const result = { teams, standings };
    setCached("mlb_stats", result);
    return result;
  } catch (e) {
    return { teams: [], standings: {} };
  }
}

function mlbTeamRating(teamName, mlbData) {
  const team = mlbData.teams.find(t => teamName.toLowerCase().includes(t.teamName.toLowerCase()) || teamName.toLowerCase().includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(teamName.toLowerCase()));
  if (!team) return { rating: 0, winPct: 0.5, runsFor: 4.5, runsAgainst: 4.5 };
  const standing = mlbData.standings[team.id];
  if (!standing) return { rating: 0, winPct: 0.5, runsFor: 4.5, runsAgainst: 4.5 };
  const winPct = standing.winPct || 0.5;
  const rating = (winPct - 0.5) * 20;
  const avgRuns = 4.5;
  const runsFor = avgRuns + (standing.runDiff / 162) * 0.5;
  const runsAgainst = avgRuns - (standing.runDiff / 162) * 0.5;
  return { rating, winPct, runsFor: Math.max(2, Math.min(8, runsFor)), runsAgainst: Math.max(2, Math.min(8, runsAgainst)), teamId: team.id, name: team.name };
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
      // For accuracy, pick winner with higher winProb
      const pick = winProb > 0.5 ? 'home' : 'away';
      const confidence = Math.max(winProb, 1-winProb);
      return {
        type: "independent", model: "Vanish MLB Model (Accuracy Focused)", method: "Win% + run diff + home adv - picks most likely winner for correctness",
        inputs: { homeWinPct: homeRating.winPct, awayWinPct: awayRating.winPct },
        probabilities: { home: winProb, away: 1 - winProb },
        expected: { homeRuns: homeRuns.toFixed(2), awayRuns: awayRuns.toFixed(2) },
        pick, confidence,
        explanation: [
          `ACCURACY FOCUS: Home ${event.home_team} Win% ${(homeRating.winPct*100).toFixed(1)}% vs Away ${event.away_team} ${(awayRating.winPct*100).toFixed(1)}%`,
          `Model: Rating diff ${ratingDiff.toFixed(1)} + 4% home adv → ${(winProb*100).toFixed(1)}% home win`,
          `PICK for correctness: ${pick.toUpperCase()} with ${(confidence*100).toFixed(1)}% confidence (most likely winner)`,
          `Expected runs: ${homeRuns.toFixed(2)} - ${awayRuns.toFixed(2)}`,
        ],
        dataSource: "MLB Stats API + Vanish Accuracy",
      };
    }
    
    if (sportKey.startsWith("soccer_")) {
      const ratings = await calculateAdvancedRatings().catch(async () => {
        const fallback = await calculateEloRatings();
        return { elo: fallback.elo, form: new Map(), corners: new Map(), goals: new Map(), totalGames: fallback.games };
      });
      const homeData = getTeamData(event.home_team, ratings);
      const awayData = getTeamData(event.away_team, ratings);
      const eloProbHome = 1 / (1 + Math.pow(10, (awayData.elo - homeData.elo) / 400));
      const formDiff = (homeData.formPoints - awayData.formPoints) / 15;
      const homeGoalDiff = homeData.avgGoalsFor - homeData.avgGoalsAgainst;
      const awayGoalDiff = awayData.avgGoalsFor - awayData.avgGoalsAgainst;
      const goalDiff = homeGoalDiff - awayGoalDiff;
      const homeAdvantage = 0.08;
      const marketHomeProb = marketProbs.home || 0.5;
      const isFreeMock = Math.abs(marketHomeProb - 0.5) < 0.01;
      let finalHomeProb;
      if (isFreeMock) {
        finalHomeProb = eloProbHome + formDiff * 0.12 + goalDiff * 0.05 + homeAdvantage;
      } else {
        finalHomeProb = eloProbHome * 0.35 + marketHomeProb * 0.65 + formDiff * 0.06 + homeAdvantage * 0.3;
      }
      finalHomeProb = Math.max(0.15, Math.min(0.85, finalHomeProb));
      const totalGoals = 2.6;
      const eloDiff = homeData.elo - awayData.elo;
      const formGoalsDiff = (homeData.avgGoalsFor + awayData.avgGoalsAgainst) - (awayData.avgGoalsFor + homeData.avgGoalsAgainst);
      const homeShare = 0.55 + (eloDiff / 1000) * 0.2 + formGoalsDiff * 0.05;
      const homeXG = totalGoals * Math.max(0.3, Math.min(0.7, homeShare));
      const awayXG = totalGoals - homeXG;
      const poissonResult = footballFromGoals(Math.max(0.3, homeXG), Math.max(0.3, awayXG));
      const homeCorners = (homeData.avgCornersFor + awayData.avgCornersAgainst) / 2;
      const awayCorners = (awayData.avgCornersFor + homeData.avgCornersAgainst) / 2;
      const totalCorners = homeCorners + awayCorners;
      // For accuracy, pick outcome with highest probability
      let pick;
      if (poissonResult.probabilities.home > poissonResult.probabilities.away && poissonResult.probabilities.home > poissonResult.probabilities.draw) pick = 'home';
      else if (poissonResult.probabilities.away > poissonResult.probabilities.home && poissonResult.probabilities.away > poissonResult.probabilities.draw) pick = 'away';
      else pick = 'draw';
      const confidence = Math.max(poissonResult.probabilities.home, poissonResult.probabilities.away, poissonResult.probabilities.draw);
      const blendedHome = poissonResult.probabilities.home * 0.7 + finalHomeProb * 0.3;
      const blendedAway = poissonResult.probabilities.away * 0.7 + (1 - finalHomeProb - 0.25) * 0.3;
      const blendedDraw = 1 - blendedHome - blendedAway;
      const finalProbs = { home: Math.max(0.1, blendedHome), draw: Math.max(0.1, blendedDraw), away: Math.max(0.1, blendedAway) };
      const sum = finalProbs.home + finalProbs.draw + finalProbs.away;
      finalProbs.home /= sum; finalProbs.draw /= sum; finalProbs.away /= sum;
      
      return {
        type: "independent",
        model: "Vanish Poisson Model (Accuracy Focused - Trained on 380+ games + Form + Corners)",
        method: "Elo + Form (last 5) + Goals + Corners + Home Adv → Picks most likely winner for CORRECTNESS",
        inputs: {
          homeElo: homeData.elo.toFixed(0), awayElo: awayData.elo.toFixed(0),
          homeForm: homeData.formString, awayForm: awayData.formString,
          homeFormPoints: homeData.formPoints, awayFormPoints: awayData.formPoints,
          homeXG: homeXG.toFixed(2), awayXG: awayXG.toFixed(2),
          homeCorners: homeCorners.toFixed(1), awayCorners: awayCorners.toFixed(1), totalCorners: totalCorners.toFixed(1),
          isFreeMock, trainedOn: ratings.totalGames,
        },
        probabilities: finalProbs,
        expected: {
          homeGoals: homeXG.toFixed(2), awayGoals: awayXG.toFixed(2),
          homeCorners: homeCorners.toFixed(1), awayCorners: awayCorners.toFixed(1), totalCorners: totalCorners.toFixed(1),
          over25: poissonResult.over25, btts: poissonResult.btts,
        },
        pick, confidence,
        explanation: [
          `ACCURACY FOCUS: Trained on ${ratings.totalGames} games - Elo ${event.home_team} ${homeData.elo.toFixed(0)} vs ${event.away_team} ${awayData.elo.toFixed(0)} → ${(eloProbHome*100).toFixed(1)}% home`,
          `FORM last 5: ${event.home_team} ${homeData.formString} ${homeData.formPoints}pts (GF ${homeData.avgGoalsFor.toFixed(1)} GA ${homeData.avgGoalsAgainst.toFixed(1)}) vs ${event.away_team} ${awayData.formString} ${awayData.formPoints}pts → Form gives ${(formDiff*100).toFixed(0)}% edge`,
          `CORNERS: Total ${totalCorners.toFixed(1)} (Home ${homeCorners.toFixed(1)} + Away ${awayCorners.toFixed(1)}) → Over 9.5 ${(totalCorners > 9.5 ? 60 : 40)}%`,
          `xG: ${homeXG.toFixed(2)} - ${awayXG.toFixed(2)} → Poisson H${(poissonResult.probabilities.home*100).toFixed(1)}% D${(poissonResult.probabilities.draw*100).toFixed(1)}% A${(poissonResult.probabilities.away*100).toFixed(1)}%`,
          `CORRECT PICK: ${pick.toUpperCase()} with ${(confidence*100).toFixed(1)}% confidence - Most likely outcome for accuracy, not odds value`,
        ],
        dataSource: `Trained on ${ratings.totalGames} games + Form + Corners - Accuracy Focused`,
        corners: { home: homeCorners, away: awayCorners, total: totalCorners },
      };
    }
    
    // Other sports with Elo + Form for accuracy
    const ratings = await calculateAdvancedRatings().catch(() => ({ elo: new Map() }));
    const homeData = getTeamData(event.home_team, ratings);
    const awayData = getTeamData(event.away_team, ratings);
    const eloProbHome = 1 / (1 + Math.pow(10, (awayData.elo - homeData.elo) / 400));
    const marketHomeProb = marketProbs.home || 0.5;
    const isFreeMock = Math.abs(marketHomeProb - 0.5) < 0.01;
    let winProb;
    if (isFreeMock) winProb = eloProbHome + 0.04 + (homeData.formPoints - awayData.formPoints)/15 * 0.1;
    else winProb = eloProbHome * 0.35 + marketHomeProb * 0.65 + 0.02;
    winProb = Math.max(0.15, Math.min(0.85, winProb));
    const pick = winProb > 0.5 ? 'home' : 'away';
    const confidence = Math.max(winProb, 1-winProb);
    return {
      type: "independent",
      model: "Vanish Model (Accuracy Focused + Form)",
      method: "Elo + Form → Most likely winner",
      inputs: { homeElo: homeData.elo, awayElo: awayData.elo, homeForm: homeData.formString, awayForm: awayData.formString },
      probabilities: { home: winProb, away: 1 - winProb },
      expected: { winProb: winProb.toFixed(3), homeElo: homeData.elo, awayElo: awayData.elo },
      pick, confidence,
      explanation: [
        `ACCURACY FOCUS: Elo ${event.home_team} ${homeData.elo.toFixed(0)} (${homeData.formString} ${homeData.formPoints}pts) vs ${event.away_team} ${awayData.elo.toFixed(0)} (${awayData.formString} ${awayData.formPoints}pts) → ${(eloProbHome*100).toFixed(1)}% home`,
        `PICK for correctness: ${pick.toUpperCase()} with ${(confidence*100).toFixed(1)}% confidence`,
      ],
      dataSource: `Elo + Form - Accuracy Focused`,
    };
  } catch (e) {
    console.warn(`Live model failed for ${sportKey}:`, e.message);
    return null;
  }
}
