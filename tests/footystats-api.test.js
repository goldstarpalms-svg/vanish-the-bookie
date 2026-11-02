import test from "node:test";
import assert from "node:assert/strict";
import {
  mapMatchToEntry,
  computeFormStrings,
  FOOTYSTATS_SITE,
} from "../server/footystats-api.js";

/* Trimmed /match payload in the exact shape of match 579101
 * (Sheffield United vs Burnley, EPL) as returned by api.football-data-api.com. */
const DETAIL = {
  id: 579101,
  home_name: "Sheffield United",
  away_name: "Burnley",
  homeID: 145,
  awayID: 251,
  date_unix: 1572706800,
  match_url: "/england/burnley-fc-vs-sheffield-united-fc-h2h-stats#579101",
  home_ppg: 1.74,
  away_ppg: 1.37,
  pre_match_home_ppg: 1.2,
  pre_match_away_ppg: 0.6,
  team_a_xg_prematch: 1.28,
  team_b_xg_prematch: 1.22,
  h2h: {
    previous_matches_ids: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
    previous_matches_results: {
      team_a_win_home: 1,
      team_a_win_away: 1,
      team_b_win_home: 1,
      team_b_win_away: 1,
      draw: 1,
      team_a_wins: 2,
      team_b_wins: 2,
      totalMatches: 5,
    },
    betting_stats: {
      over15: 3,
      over25: 3,
      over35: 3,
      btts: 3,
      clubACS: 0,
      clubBCS: 2,
      over15Percentage: 60,
      over25Percentage: 60,
      over35Percentage: 60,
      bttsPercentage: 60,
      clubACSPercentage: 0,
      clubBCSPercentage: 40,
      avg_goals: 3.8,
      total_goals: 19,
    },
  },
};

const LEAGUE_SEASON = {
  country: "England",
  seasonOver25Percentage_overall: 56,
  seasonOver15Percentage_overall: 74,
  seasonBTTSPercentage: 51,
  seasonAVG_overall: 2.85,
};

const TEAM_STATS = {
  home: {
    xg_for_avg_overall: 1.61,
    xg_against_avg_overall: 0.98,
    seasonPPG_overall: 1.95,
    seasonPPG_home: 2.05,
    seasonPPG_away: 1.84,
    seasonWinsNum_home: 11,
    seasonWinsNum_away: 9,
    seasonMatchesPlayed_home: 19,
    seasonMatchesPlayed_away: 19,
    seasonScoredAVG_overall: 1.82,
    seasonConcededAVG_overall: 0.89,
    seasonBTTSPercentage_overall: 58,
  },
  away: {
    xg_for_avg_overall: 1.12,
    xg_against_avg_overall: 1.4,
    seasonPPG_overall: 1.1,
    seasonWinsNum_home: 5,
    seasonWinsNum_away: 3,
    seasonMatchesPlayed_home: 19,
    seasonMatchesPlayed_away: 19,
  },
};

test("mapMatchToEntry wires h2h from betting_stats + previous_matches_results", () => {
  const e = mapMatchToEntry(DETAIL, {});
  assert.equal(e.home, "Sheffield United");
  assert.equal(e.away, "Burnley");
  assert.equal(e.source, "FootyStats API");
  assert.equal(e.h2h.matches, 5);
  assert.equal(e.h2h.homeWins, 2);
  assert.equal(e.h2h.draws, 1);
  assert.equal(e.h2h.awayWins, 2);
  assert.equal(e.h2h.over15, 60);
  assert.equal(e.h2h.over25, 60);
  assert.equal(e.h2h.over35, 60);
  assert.equal(e.h2h.btts, 60);
  assert.equal(e.h2h.csHome, 0);
  assert.equal(e.h2h.csAway, 40);
  assert.equal(e.h2h.avgGoals, 3.8);
});

test("mapMatchToEntry compares H2H rates with league-season averages", () => {
  const e = mapMatchToEntry(DETAIL, { leagueSeason: LEAGUE_SEASON });
  assert.equal(e.prediction.over25, 60);
  assert.equal(e.prediction.over25Avg, 56);
  assert.equal(e.prediction.over15, 60);
  assert.equal(e.prediction.over15Avg, 74);
  assert.equal(e.prediction.btts, 60);
  assert.equal(e.prediction.bttsAvg, 51);
  assert.equal(e.prediction.gpm, 3.8);
  assert.equal(e.prediction.gpmAvg, 2.85);
  assert.equal(e.country, "England");
});

test("mapMatchToEntry builds teams blocks with xG and venue win %", () => {
  const e = mapMatchToEntry(DETAIL, { teamStats: TEAM_STATS });
  assert.equal(e.teams.home.xg, 1.61);
  assert.equal(e.teams.home.xga, 0.98);
  assert.equal(e.teams.home.ppg, 1.95);
  assert.equal(e.teams.home.winPctHome, 58); // 11/19
  assert.equal(e.teams.home.winPctAway, 47); // 9/19
  assert.equal(e.teams.away.xg, 1.12);
  assert.equal(e.teams.away.winPctHome, 26); // 5/19
});

test("teams fall back to pre-match xG when team stats are missing", () => {
  const e = mapMatchToEntry(DETAIL, {});
  assert.equal(e.teams.home.xg, 1.28);
  assert.equal(e.teams.away.xg, 1.22);
});

test("form block takes pre-match PPG and optional form strings", () => {
  const e = mapMatchToEntry(DETAIL, {
    formStrings: { home: "WWDLL", away: "DLWWD" },
  });
  assert.equal(e.form.ppgHome, 1.2);
  assert.equal(e.form.ppgAway, 0.6);
  assert.equal(e.form.home, "WWDLL");
  assert.equal(e.form.away, "DLWWD");
});

test("url is absolute against footystats.org", () => {
  const e = mapMatchToEntry(DETAIL, {});
  assert.equal(e.url, `${FOOTYSTATS_SITE}/england/burnley-fc-vs-sheffield-united-fc-h2h-stats#579101`);
});

test("computeFormStrings reads the last five results before kickoff", () => {
  const matches = [
    { status: "complete", date_unix: 100, homeID: 1, awayID: 2, homeGoalCount: 2, awayGoalCount: 0 }, // W
    { status: "complete", date_unix: 200, homeID: 3, awayID: 1, homeGoalCount: 1, awayGoalCount: 1 }, // D
    { status: "complete", date_unix: 300, homeID: 1, awayID: 4, homeGoalCount: 0, awayGoalCount: 3 }, // L
    { status: "complete", date_unix: 400, homeID: 5, awayID: 1, homeGoalCount: 0, awayGoalCount: 1 }, // W
    { status: "complete", date_unix: 500, homeID: 1, awayID: 6, homeGoalCount: 4, awayGoalCount: 4 }, // D
    { status: "complete", date_unix: 600, homeID: 1, awayID: 7, homeGoalCount: 9, awayGoalCount: 0 }, // after kickoff — ignored
    { status: "incomplete", date_unix: 150, homeID: 1, awayID: 8, homeGoalCount: 1, awayGoalCount: 0 }, // not complete
  ];
  assert.equal(computeFormStrings(matches, 1, 550), "WDLWD");
  assert.equal(computeFormStrings(matches, 2, 550), "L");
});
