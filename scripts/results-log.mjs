#!/usr/bin/env node
/**
 * Publisher-side REAL results log — freeze picks before kickoff, grade with
 * real scores after final whistle. This is the engine behind the site's
 * "frozen snapshot before kickoff, GitHub tracked" methodology.
 *
 *   node scripts/results-log.mjs                     # freeze + grade (default)
 *   node scripts/results-log.mjs --source http://localhost:3000/api/dashboard
 *   node scripts/results-log.mjs --grade-only        # settle, don't freeze
 *   node scripts/results-log.mjs --stats             # print the record summary
 *
 * Store: data/live-records.json (array of record rows; shared with
 * server/index.js). Rules of the record:
 *   - a pick is recorded the FIRST time it is published (freeze), never edited
 *   - a record settles ONLY from a real final score (ESPN)
 *   - unpublished games are NEVER graded (no pick → no verdict)
 *   - `git add -f data/live-records.json` (CI does this hourly)
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gradePrediction } from "../server/model.js";
import { cleanLeagueName } from "../server/live-provider.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECORDS_PATH = join(__dirname, "..", "data", "live-records.json");
const LIVE_BOARD = "https://goldshopping.name.ng/api/dashboard";

function loadRecords() {
  try {
    const raw = JSON.parse(readFileSync(RECORDS_PATH, "utf8"));
    return Array.isArray(raw) ? raw : Array.isArray(raw.records) ? raw.records : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  mkdirSync(dirname(RECORDS_PATH), { recursive: true });
  writeFileSync(RECORDS_PATH, JSON.stringify(records, null, 2));
}

async function fetchBoard(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`board fetch ${res.status}`);
  return res.json();
}

/** Today's real final scores across sports (ESPN free). */
async function fetchFinals() {
  const finals = [];
  const dates = [0, 1].map((back) => {
    const d = new Date(Date.now() - back * 86400000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d);
  });
  for (const date of dates) {
    const compact = date.replace(/-/g, "");
    for (const sport of ["soccer/all", "baseball/mlb", "basketball/nba", "hockey/nhl", "football/nfl", "tennis/atp"]) {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/scoreboard?dates=${compact}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const data = await res.json();
        for (const ev of data.events || []) {
          const comp = ev.competitions?.[0];
          if (!comp) continue;
          const completed = comp.status?.type?.completed || /final|full_time/i.test(comp.status?.type?.name || "");
          if (!completed) continue;
          const home = comp.competitors?.find((c) => c.homeAway === "home");
          const away = comp.competitors?.find((c) => c.homeAway === "away");
          if (!home || !away) continue;
          const hs = parseInt(home.score), as = parseInt(away.score);
          if (Number.isNaN(hs) || Number.isNaN(as)) continue;
          finals.push({
            league: cleanLeagueName(ev.leagues?.[0]?.name || comp.league?.name || "Football"),
            home: home.team.displayName, away: away.team.displayName,
            homeScore: hs, awayScore: as, kickoff: ev.date, key: `${home.team.displayName}|${away.team.displayName}`,
          });
        }
      } catch { /* one sport failing is fine */ }
    }
  }
  return finals;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
function findFinal(finals, row) {
  return (
    finals.find((f) => norm(f.home) === norm(row.home?.name) && norm(f.away) === norm(row.away?.name)) ||
    finals.find((f) => norm(f.home) === norm(row.away?.name) && norm(f.away) === norm(row.home?.name)) ||
    null
  );
}

async function main() {
  const args = process.argv.slice(2);
  const source = args.includes("--source") ? args[args.indexOf("--source") + 1] : LIVE_BOARD;
  const gradeOnly = args.includes("--grade-only");
  const statsOnly = args.includes("--stats");

  const records = loadRecords();
  const byId = new Map(records.map((r) => [r.id, r]));

  if (statsOnly) {
    const settled = records.filter((r) => r.status === "won" || r.status === "lost");
    const won = settled.filter((r) => r.status === "won").length;
    console.log(`records: ${records.length} frozen | settled: ${settled.length} | won: ${won} | lost: ${settled.length - won} | pending: ${records.filter((r) => r.status === "pending").length}`);
    return;
  }

  // 1) FREEZE — first publication wins; never rewrite a frozen pick.
  let frozenNow = 0;
  if (!gradeOnly) {
    try {
      const board = await fetchBoard(source);
      for (const g of board.predictions || []) {
        if (!g?.pick || !g?.home?.name) continue;
        if (byId.has(g.id)) continue;
        byId.set(g.id, {
          id: g.id, sport: g.sport, sportKey: g.sportKey,
          league: cleanLeagueName(g.league),
          home: g.home, away: g.away, kickoff: g.kickoff,
          pick: g.pick, probabilities: g.probabilities || null,
          independentProbabilities: g.independentProbabilities || null,
          independentModel: g.independentModel || null,
          model: g.model, modelVersion: g.modelVersion,
          publishedAt: g.publishedAt || new Date().toISOString(),
          status: "pending", result: null, settledAt: null,
          scoreSource: null,
        });
        frozenNow++;
      }
    } catch (e) {
      console.warn(`freeze skipped (${e.message})`);
    }
  }

  // 2) GRADE — real final scores only.
  let gradedNow = 0;
  const pending = [...byId.values()].filter((r) => r.status === "pending" && new Date(r.kickoff).getTime() < Date.now());
  if (pending.length) {
    const finals = await fetchFinals();
    for (const row of pending) {
      const f = findFinal(finals, row);
      if (!f) continue;
      row.result = { home: f.homeScore, away: f.awayScore };
      row.status = gradePrediction(row.pick, row.result);
      row.settledAt = new Date().toISOString();
      row.scoreSource = "ESPN — Real Score";
      gradedNow++;
    }
  }

  const merged = [...byId.values()].sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff));
  saveRecords(merged);
  const settled = merged.filter((r) => r.status === "won" || r.status === "lost");
  const won = settled.filter((r) => r.status === "won").length;
  console.log(`records: ${merged.length} frozen (+${frozenNow}) | settled: ${settled.length} (+${gradedNow}) | won: ${won} | lost: ${settled.length - won}`);
}

main().catch((e) => {
  console.error("results-log failed:", e.message);
  process.exit(1);
});
