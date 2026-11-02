#!/usr/bin/env node
/**
 * FootyStats API snapshot refresher.
 *
 *   node scripts/footystats-api-refresh.mjs --demo
 *       End-to-end proof on a real (accessible) EPL match → writes
 *       data/footystats/api-sample.json and prints the mapped entry.
 *
 *   node scripts/footystats-api-refresh.mjs --season <id> [--since-days N]
 *       Map every completed match of a league-season from the last N days
 *       (default 3) into data/footystats/snapshot.json (merged, never dropped).
 *
 *   node scripts/footystats-api-refresh.mjs --status
 *       Report which league-seasons the key can reach.
 *
 * Snapshot entries are keyed `country|home|away` like the scraper snapshot —
 * data/ is gitignored; `git add -f data/footystats/snapshot.json` on deploy.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  testConnection,
  fetchSeasonMatches,
  buildEntryForMatch,
  footyApiKey,
  footyRequestBudget,
  FOOTYSTATS_API_BASE,
} from "../server/footystats-api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data", "footystats");
const SNAPSHOT = join(DATA_DIR, "snapshot.json");
const SAMPLE = join(DATA_DIR, "api-sample.json");

/** Current-season ids we know about (discovered 2026-11-02 via /team records).
 *  The free key can only *read* seasons the account has chosen. */
const KNOWN_CURRENT_SEASONS = {
  "Premier League 2026/27": 17146,
  "Premier League 2025/26": 15050,
  "Premier League 2024/25": 12325,
  "Bundesliga 2026/27": 17210,
  "2. Bundesliga 2026/27": 17212,
  "Superliga (Denmark) 2026/27": 17091,
  "MLS 2026": 16504,
};

function loadSnapshot() {
  try {
    return JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  } catch {
    return { generatedAt: null, matches: {}, bttsBoard: [], over25Board: [] };
  }
}

function saveSnapshot(snap) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(SNAPSHOT, JSON.stringify(snap, null, 2));
}

function entryKey(e) {
  return `${(e.country || "world").toLowerCase()}|${e.home}|${e.away}`;
}

function parseArgs(argv) {
  const args = { mode: "demo", seasons: [], sinceDays: 3 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--demo") args.mode = "demo";
    else if (a === "--status") args.mode = "status";
    else if (a === "--season") { args.mode = "season"; args.seasons.push(argv[++i]); }
    else if (a === "--since-days") args.sinceDays = Number(argv[++i]);
  }
  return args;
}

async function reportStatus() {
  console.log(`FootyStats API: ${FOOTYSTATS_API_BASE}  (key …${footyApiKey().slice(-4)})`);
  const msg = await testConnection();
  console.log(`test-call: ${msg}  (budget remaining: ${footyRequestRemaining()})`);
  console.log("\nKnown league-seasons and reachability:");
  for (const [label, id] of Object.entries(KNOWN_CURRENT_SEASONS)) {
    try {
      const rows = await fetchSeasonMatches(id, { maxPerPage: 1 });
      console.log(`  ✓ ${label} (season_id=${id}) — ${rows.length ? "reachable" : "empty"}`);
    } catch (e) {
      const chosen = /not chosen/i.test(e.message);
      console.log(`  ✗ ${label} (season_id=${id}) — ${chosen ? "league not chosen for this key" : e.message}`);
    }
  }
  console.log(`\nBudget remaining: ${footyRequestRemaining()} / 1800 per hour`);
}

function footyRequestRemaining() {
  return footyRequestBudget() ?? "unknown";
}

async function runDemo() {
  console.log("Demo: mapping one real EPL 2024/25 match end-to-end…");
  const seasonId = 12325; // EPL 2024/25 — accessible with the free key
  const matches = await fetchSeasonMatches(seasonId, { maxPerPage: 100 });
  const done = matches.filter((m) => m.status === "complete").sort((a, b) => b.date_unix - a.date_unix);
  const target = done[0];
  if (!target) throw new Error("No completed matches found in season 12325");
  console.log(`  match: ${target.home_name} vs ${target.away_name} (id ${target.id})`);
  const entry = await buildEntryForMatch(target.id, seasonId);
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(SAMPLE, JSON.stringify({ generatedAt: new Date().toISOString(), entry }, null, 2));
  console.log("\nMapped snapshot entry:");
  console.log(JSON.stringify(entry, null, 2));
  console.log(`\nWritten to ${SAMPLE}`);
  console.log(`Budget remaining: ${footyRequestRemaining()} / 1800 per hour`);
}

async function runSeason(seasonIds, sinceDays) {
  const snap = loadSnapshot();
  const cutoff = Date.now() / 1000 - sinceDays * 86400;
  const cache = new Map();
  let added = 0, skipped = 0, failed = 0;
  for (const seasonId of seasonIds) {
    let matches = [];
    try {
      for (let page = 1; page <= 4; page++) {
        const batch = await fetchSeasonMatches(seasonId, { page, maxPerPage: 100 });
        matches.push(...batch);
        if (batch.length < 100) break;
      }
    } catch (e) {
      console.error(`season ${seasonId}: ${e.message}`);
      failed++;
      continue;
    }
    const recent = matches.filter((m) => m.status === "complete" && m.date_unix >= cutoff);
    console.log(`season ${seasonId}: ${recent.length} completed match(es) in the last ${sinceDays}d`);
    for (const m of recent) {
      try {
        const entry = await buildEntryForMatch(m.id, Number(seasonId), { seasonCache: cache });
        const key = entryKey(entry);
        if (snap.matches[key] && snap.matches[key].source !== "FootyStats API") {
          skipped++; // keep the scraper's richer entry
          continue;
        }
        snap.matches[key] = entry;
        added++;
      } catch (e) {
        console.error(`  ${m.home_name} vs ${m.away_name}: ${e.message}`);
        failed++;
      }
    }
  }
  if (added) {
    snap.generatedAt = new Date().toISOString();
    saveSnapshot(snap);
  }
  console.log(`\nDone. added=${added} kept-existing=${skipped} failed=${failed}`);
  console.log(`Budget remaining: ${footyRequestRemaining()} / 1800 per hour`);
}

const args = parseArgs(process.argv);
try {
  if (args.mode === "status") await reportStatus();
  else if (args.mode === "season") await runSeason(args.seasons, args.sinceDays);
  else await runDemo();
} catch (e) {
  console.error("FootyStats API refresh failed:", e.message);
  process.exit(1);
}
