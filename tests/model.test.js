import test from "node:test";
import assert from "node:assert/strict";
import {
  footballFromGoals,
  basketballModel,
  tennisModel,
  normalCDF,
  predict,
  normalizeOdds,
  gradePrediction,
  poissonMass,
} from "../server/model.js";
import { demoFixtures, demoArchive } from "../server/fixtures.js";
import { eventToPrediction } from "../server/live-provider.js";
const close = (a, b, tolerance = 1e-7) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
test("Poisson probabilities sum to one", () => {
  for (const [h, a] of [
    [1.5, 1.1],
    [0.2, 4],
    [4, 4],
    [10, 10],
  ]) {
    const p = footballFromGoals(h, a);
    close(
      Object.values(p.probabilities).reduce((a, b) => a + b, 0),
      1,
    );
    Object.values(p.probabilities).forEach((p) => assert.ok(p >= 0 && p <= 1));
  }
});
test("Equal football goal rates give equal home and away probability", () => {
  const p = footballFromGoals(1.4, 1.4);
  close(p.probabilities.home, p.probabilities.away);
});
test("Football model responds to stronger home attack", () => {
  assert.ok(
    footballFromGoals(2.5, 1).probabilities.home >
      footballFromGoals(1.2, 1).probabilities.home,
  );
});
test("Goal-market calculations have known limits", () => {
  const p = footballFromGoals(1, 1);
  close(p.over25, 1 - 5 * Math.exp(-2));
  close(p.btts, (1 - Math.exp(-1)) ** 2);
  assert.equal(p.topScores.length, 5);
});
test("Poisson validates inputs", () => {
  assert.throws(() => poissonMass(0, 1));
  assert.throws(() => poissonMass(1, -1));
  assert.throws(() => footballFromGoals(11, 1));
  assert.throws(() => footballFromGoals(NaN, 1));
});
test("Basketball equal ratings and no home advantage give 50 percent", () => {
  close(basketballModel(3, 3, 0).probabilities.home, 0.5);
});
test("Basketball home advantage raises the home estimate", () => {
  assert.ok(basketballModel(3, 3, 2.5).probabilities.home > 0.5);
  assert.throws(() => basketballModel(1, 2, 2, 0));
});
test("Normal CDF is symmetric", () => {
  close(normalCDF(1) + normalCDF(-1), 1);
  close(normalCDF(0), 0.5);
});
test("Elo formula handles equal players and a 400-point gap", () => {
  close(tennisModel(2000, 2000).probabilities.home, 0.5);
  close(tennisModel(2400, 2000).probabilities.home, 10 / 11);
  assert.throws(() => tennisModel(Infinity, 1));
});
test("Every demo prediction is deterministic, valid and visibly synthetic", () => {
  const fixtures = demoFixtures(new Date("2026-09-22T11:00:00Z"));
  assert.equal(fixtures.length, 12);
  const a = fixtures.map(predict),
    b = fixtures.map(predict);
  assert.deepEqual(a, b);
  a.forEach((p) => {
    assert.equal(p.mode, "demo");
    assert.equal(p.calibrated, false);
    close(
      Object.values(p.probabilities).reduce((a, b) => a + b, 0),
      1,
    );
    assert.ok(p.pick.fairOdds > 1);
    assert.ok(p.explanation.length >= 3);
  });
});
test("Fixtures respect Lagos date rollover", () => {
  const f = demoFixtures(new Date("2026-09-22T23:30:00Z"));
  assert.equal(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(
      new Date(f[0].kickoff),
    ),
    "2026-09-23",
  );
});
test("Full synthetic archive includes wins, losses and voids", () => {
  const archive = demoArchive().map(predict);
  const states = archive.map((p) => gradePrediction(p.pick, p.result));
  for (const state of ["won", "lost", "void"])
    assert.ok(states.includes(state));
  assert.equal(states.length, 12);
});
test("Settlement does not hide drawn matches or void outcomes", () => {
  assert.equal(gradePrediction({ side: "draw" }, { home: 1, away: 1 }), "won");
  assert.equal(gradePrediction({ side: "home" }, { home: 1, away: 1 }), "lost");
  assert.equal(gradePrediction({ side: "home" }, { void: true }), "void");
});
test("Market normalization removes overround and rejects invalid odds", () => {
  const p = normalizeOdds([
    { name: "a", price: 1.8 },
    { name: "b", price: 1.8 },
  ]);
  close(p.a, 0.5);
  close(p.a + p.b, 1);
  assert.throws(() =>
    normalizeOdds([
      { name: "a", price: 1 },
      { name: "b", price: 2 },
    ]),
  );
});
const event = {
  id: "e1",
  sport_key: "soccer_epl",
  sport_title: "EPL",
  home_team: "A",
  away_team: "B",
  commence_time: "2026-10-01T19:00:00Z",
  bookmakers: [
    {
      title: "Book 1",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "A", price: 2 },
            { name: "B", price: 4 },
            { name: "Draw", price: 4 },
          ],
        },
      ],
    },
  ],
};
test("Live adapter labels estimates as consensus, never as an independent model", async () => {
  const p = await eventToPrediction(event);
  assert.equal(p.mode, "live");
  assert.ok(p.model.includes("Market"));
  assert.equal(p.sample, false);
  close(p.probabilities.home, 0.5);
  close(p.probabilities.draw, 0.25);
  close(p.probabilities.away, 0.25);
  assert.ok(p.hasLiveModel || p.model.includes("consensus"));
});
test("Live adapter skips incomplete or unsupported markets instead of inventing predictions", async () => {
  assert.equal(await eventToPrediction({ ...event, bookmakers: [] }), null);
  assert.equal(await eventToPrediction({ ...event, sport_key: "unknown_xyz" }), null);
  assert.equal(
    await eventToPrediction({
      ...event,
      bookmakers: [
        { markets: [{ key: "h2h", outcomes: [{ name: "A", price: 2 }] }] },
      ],
    }),
    null,
  );
});
test("Live independent model produces separate Vanish prediction for baseball", async () => {
  const baseballEvent = {
    ...event,
    sport_key: "baseball_mlb",
    sport_title: "MLB",
    home_team: "New York Yankees",
    away_team: "Boston Red Sox",
    bookmakers: [
      {
        title: "Book 1",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "New York Yankees", price: 1.9 },
              { name: "Boston Red Sox", price: 2.1 },
            ],
          },
        ],
      },
    ],
  };
  const p = await eventToPrediction(baseballEvent);
  assert.ok(p);
  assert.equal(p.sport, "baseball");
  assert.ok(p.hasLiveModel);
  assert.ok(p.independentModel);
  assert.ok(p.independentProbabilities);
  assert.ok(p.marketPick);
  assert.ok(p.vanishPick);
  assert.ok(p.independentModel.model.includes("MLB") || p.independentModel.model.includes("Vanish"));
});
