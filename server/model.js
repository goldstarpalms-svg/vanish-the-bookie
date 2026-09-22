// Transparent demonstration baselines. These models are NOT validated or calibrated.
// Pure functions are shared between the server, the model lab and the tests.
export const MODEL_VERSION = "0.1.0";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function finitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${label} must be a positive finite number`);
}
export function poissonMass(lambda, k) {
  finitePositive(lambda, "lambda");
  if (!Number.isInteger(k) || k < 0)
    throw new Error("k must be a non-negative integer");
  let value = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) value *= lambda / i;
  return value;
}
export function footballFromGoals(homeGoals, awayGoals) {
  finitePositive(homeGoals, "homeGoals");
  finitePositive(awayGoals, "awayGoals");
  if (homeGoals > 10 || awayGoals > 10)
    throw new Error("Expected goals must be 10 or less");
  let home = 0,
    draw = 0,
    away = 0,
    total = 0;
  const scores = [];
  for (let h = 0; h <= 40; h++) {
    for (let a = 0; a <= 40; a++) {
      const p = poissonMass(homeGoals, h) * poissonMass(awayGoals, a);
      total += p;
      if (h > a) home += p;
      else if (a > h) away += p;
      else draw += p;
      if (h < 6 && a < 6) scores.push({ home: h, away: a, probability: p });
    }
  }
  const sum = homeGoals + awayGoals;
  const over25 = 1 - Math.exp(-sum) * (1 + sum + (sum * sum) / 2);
  const btts = (1 - Math.exp(-homeGoals)) * (1 - Math.exp(-awayGoals));
  return {
    probabilities: {
      home: home / total,
      draw: draw / total,
      away: away / total,
    },
    expectedHome: homeGoals,
    expectedAway: awayGoals,
    over25: clamp(over25, 0, 1),
    btts: clamp(btts, 0, 1),
    topScores: scores.sort((a, b) => b.probability - a.probability).slice(0, 5),
  };
}
export function normalCDF(x) {
  const abs = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * abs);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-abs * abs);
  return clamp((1 + (x < 0 ? -erf : erf)) / 2, 0, 1);
}
export function basketballModel(
  homeRating,
  awayRating,
  homeAdvantage = 2.5,
  sigma = 12,
) {
  if (![homeRating, awayRating, homeAdvantage].every(Number.isFinite))
    throw new Error("Ratings must be finite");
  finitePositive(sigma, "sigma");
  const margin = homeRating - awayRating + homeAdvantage;
  const home = normalCDF(margin / sigma);
  return { probabilities: { home, away: 1 - home }, margin, sigma };
}
export function tennisModel(eloA, eloB) {
  if (![eloA, eloB].every(Number.isFinite))
    throw new Error("Elo ratings must be finite");
  const home = 1 / (1 + 10 ** ((eloB - eloA) / 400));
  return { probabilities: { home, away: 1 - home }, eloGap: eloA - eloB };
}
export function pickFromProbabilities(probabilities, home, away) {
  const [side, probability] = Object.entries(probabilities).sort(
    (a, b) => b[1] - a[1],
  )[0];
  return {
    side,
    probability,
    label:
      side === "draw"
        ? "Draw"
        : `${side === "home" ? home.name : away.name} to win`,
    fairOdds: Number((1 / probability).toFixed(2)),
  };
}
export function predict(fixture) {
  const i = fixture.inputs;
  let output, model, explanation, inputRows, metrics;
  if (fixture.sport === "football") {
    const homeGoals =
      i.leagueGoals * i.homeAttack * i.awayDefence + i.homeAdvantage;
    const awayGoals = i.leagueGoals * i.awayAttack * i.homeDefence;
    output = footballFromGoals(homeGoals, awayGoals);
    model = "Poisson";
    explanation = [
      `The baseline expects ${homeGoals.toFixed(2)} goals for ${fixture.home.name} and ${awayGoals.toFixed(2)} for ${fixture.away.name}.`,
      `A synthetic home-advantage adjustment adds ${i.homeAdvantage.toFixed(2)} goals to the home team's estimate.`,
      "Independent Poisson score distributions turn those goal estimates into win, draw and loss probabilities. Team news and lineups are not included.",
    ];
    inputRows = [
      ["League goals per team", i.leagueGoals.toFixed(2)],
      ["Home attack index", i.homeAttack.toFixed(2)],
      ["Away attack index", i.awayAttack.toFixed(2)],
      ["Home defence index", i.homeDefence.toFixed(2)],
      ["Away defence index", i.awayDefence.toFixed(2)],
      ["Home advantage (goals)", i.homeAdvantage.toFixed(2)],
    ];
    metrics = [
      { label: "Expected home goals", value: homeGoals.toFixed(2) },
      { label: "Expected away goals", value: awayGoals.toFixed(2) },
    ];
  } else if (fixture.sport === "basketball") {
    output = basketballModel(
      i.homeRating,
      i.awayRating,
      i.homeAdvantage,
      i.sigma,
    );
    model = "Rating + normal";
    explanation = [
      `The synthetic team-rating difference is ${(i.homeRating - i.awayRating).toFixed(1)} points before the home-court adjustment.`,
      `Adding ${i.homeAdvantage.toFixed(1)} home-court points produces an expected home margin of ${output.margin > 0 ? "+" : ""}${output.margin.toFixed(1)}.`,
      `A normal margin distribution with a ${i.sigma}-point standard deviation converts the margin into a win probability. This simplified baseline ignores injuries and schedule effects.`,
    ];
    inputRows = [
      ["Home team strength (points)", i.homeRating.toFixed(1)],
      ["Away team strength (points)", i.awayRating.toFixed(1)],
      ["Home advantage (points)", i.homeAdvantage.toFixed(1)],
      ["Margin standard deviation", i.sigma.toFixed(1)],
    ];
    metrics = [
      {
        label: "Expected home margin",
        value: `${output.margin > 0 ? "+" : ""}${output.margin.toFixed(1)}`,
      },
      { label: "Margin spread (σ)", value: `${i.sigma} pts` },
    ];
  } else if (fixture.sport === "tennis") {
    output = tennisModel(i.homeElo, i.awayElo);
    model = "Elo";
    explanation = [
      `${fixture.home.name} has an illustrative Elo rating of ${i.homeElo}; ${fixture.away.name} has ${i.awayElo}. These are not current player ratings.`,
      `The ${Math.abs(output.eloGap)}-point gap maps to a win probability using the standard base-10 Elo formula.`,
      "This baseline does not adjust for court surface, injuries, match format or recent form. It demonstrates the calculation, not a proven forecasting edge.",
    ];
    inputRows = [
      [`${fixture.home.name} · demo Elo`, i.homeElo],
      [`${fixture.away.name} · demo Elo`, i.awayElo],
      ["Elo scale factor", 400],
    ];
    metrics = [
      { label: "Player A demo Elo", value: String(i.homeElo) },
      { label: "Player B demo Elo", value: String(i.awayElo) },
    ];
  } else throw new Error(`Unsupported sport: ${fixture.sport}`);
  const pick = pickFromProbabilities(
    output.probabilities,
    fixture.home,
    fixture.away,
  );
  return {
    ...fixture,
    ...output,
    pick,
    model,
    explanation,
    inputRows,
    metrics,
    mode: "demo",
    calibrated: false,
    modelVersion: MODEL_VERSION,
  };
}
export function gradePrediction(pick, result) {
  if (!result || result.void) return "void";
  const actual =
    result.home > result.away
      ? "home"
      : result.away > result.home
        ? "away"
        : "draw";
  return pick.side === actual ? "won" : "lost";
}
export function normalizeOdds(outcomes) {
  const valid = outcomes.filter((o) => Number.isFinite(o.price) && o.price > 1);
  if (valid.length !== outcomes.length || valid.length < 2)
    throw new Error("Invalid decimal odds");
  const total = valid.reduce((sum, o) => sum + 1 / o.price, 0);
  return Object.fromEntries(valid.map((o) => [o.name, 1 / o.price / total]));
}
