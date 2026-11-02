import test from "node:test";
import assert from "node:assert/strict";
import { parseForebetText, forebetDateToIso, forebetFor, slugify } from "../server/forebet.js";

test("compact row parses into probabilities, tip and score", () => {
  const row = parseForebetText("Es2 | tenerife-fc-andorra-2509411 | 02/11/2026 13:00 | 39/38/23 | 1 | 1-0 | 1.17 | 6/5")[0];
  assert.equal(row.code, "Es2");
  assert.deepEqual(row.probabilities, { home: 0.39, draw: 0.38, away: 0.23 });
  assert.equal(row.tip, "1");
  assert.deepEqual(row.predictedScore, { home: 1, away: 0 });
  assert.equal(row.avgGoals, 1.17);
  assert.equal(row.odds, "6/5");
  assert.equal(row.id, "2509411");
});

test("rows whose percentages do not sum to 100 are rejected", () => {
  assert.equal(parseForebetText("Es2 | x-y-1 | 02/11/2026 13:00 | 39/38/20 | 1 | 1-0 | 1.17 | -").length, 0);
});

test("forebet kickoff is parsed as UTC", () => {
  assert.equal(forebetDateToIso("02/11/2026 13:00"), "2026-11-02T13:00:00.000Z");
  assert.equal(forebetDateToIso("nonsense"), null);
});

test("slugify folds accents and punctuation", () => {
  assert.equal(slugify("Ferroviário Nampula"), "ferroviario-nampula");
  assert.equal(slugify("Al Najma (KSA)"), "al-najma-ksa");
});

test("lookup matches our fixture to Forebet's row", () => {
  const hit = forebetFor("Tenerife", "FC Andorra", "2026-11-02T12:00:00Z");
  assert.ok(hit, "expected a match");
  assert.equal(hit.tip, "1");
  assert.equal(hit.probabilities.home, 0.39);
});

test("lookup refuses a fixture outside the 36h window", () => {
  assert.equal(forebetFor("Tenerife", "FC Andorra", "2026-11-05T12:00:00Z"), null);
});

test("short slug fragments never match a different fixture", () => {
  assert.equal(forebetFor("RC Deportivo La Coruña", "CA Osasuna", "2026-11-02T20:00:00Z"), null);
});

test("lookup refuses teams that are not in the snapshot", () => {
  assert.equal(forebetFor("Real Madrid", "Barcelona", "2026-11-02T19:45:00Z"), null);
});
