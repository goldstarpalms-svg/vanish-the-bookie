#!/usr/bin/env node
// Build data/forebet/snapshot.json from a browser-rendered Forebet capture.
//
//   node scripts/forebet-snapshot.mjs --from data/forebet/raw/2026-11-02.txt
//   node scripts/forebet-snapshot.mjs --dir data/forebet/raw
//   node scripts/forebet-snapshot.mjs --url https://www.forebet.com/en/football-tips-and-predictions-for-today
//
// forebet.com 403s plain HTTP and headless browsers from datacenter IPs, so --url
// is best-effort: when Cloudflare wins, capture the page in a real browser (or the
// fetch_page tool), save the text under data/forebet/raw/, and use --from.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT = join(ROOT, "data/forebet/snapshot.json");
const RAW_DIR = join(ROOT, "data/forebet/raw");
const { parseForebetAny, forebetStats } = await import(join(ROOT, "server/forebet.js"));

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };

const inputs = [];
const from = arg("from");
const dir = arg("dir") || (from || arg("url") ? null : RAW_DIR);
if (from) inputs.push(from);
if (dir && existsSync(dir)) inputs.push(...readdirSync(dir).filter((f) => f.endsWith(".txt")).map((f) => join(dir, f)));

const url = arg("url");
if (url) {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36" });
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    const title = await page.title();
    if (res?.status() !== 200 || /just a moment/i.test(title)) {
      console.error(`blocked: HTTP ${res?.status()} "${title}" — capture the page in a browser instead`);
    } else {
      const text = await page.evaluate(() => document.body.innerText);
      const tmp = join(RAW_DIR, `live-${new Date().toISOString().slice(0, 10)}.txt`);
      writeFileSync(tmp, text);
      inputs.push(tmp);
      console.log(`saved ${tmp}`);
    }
    await browser.close();
  } catch (e) {
    console.error(`--url failed: ${e.message.split("\n")[0]}`);
  }
}

if (!inputs.length) {
  console.error("no input: pass --from <file>, --dir, or --url");
  process.exit(1);
}

let existing = [];
if (existsSync(SNAPSHOT)) {
  try { existing = JSON.parse(readFileSync(SNAPSHOT, "utf8")).matches || []; } catch {}
}

const merged = new Map(existing.map((m) => [m.slug, m]));
let added = 0;
let seen = 0;
for (const file of inputs) {
  const rows = parseForebetAny(readFileSync(file, "utf8"));
  seen += rows.length;
  for (const row of rows) {
    if (!row.slug) continue;
    merged.set(row.slug, row);
    added += 1;
  }
}

// keep the snapshot to recent + upcoming fixtures so it cannot grow forever
const now = Date.now();
const keep = [...merged.values()].filter((m) => {
  const t = m.kickoff ? new Date(m.kickoff).getTime() : 0;
  return !t || t > now - 3 * 86400000;
}).sort((a, b) => new Date(a.kickoff || 0) - new Date(b.kickoff || 0));

writeFileSync(SNAPSHOT, JSON.stringify({ updatedAt: new Date().toISOString(), source: "forebet.com (browser-rendered capture)", matches: keep }, null, 1));
const byDate = {};
for (const m of keep) { const d = (m.kickoff || "?").slice(0, 10); byDate[d] = (byDate[d] || 0) + 1; }
console.log(`parsed ${seen} rows from ${inputs.length} file(s) → snapshot ${keep.length} fixtures`, byDate, forebetStats());
