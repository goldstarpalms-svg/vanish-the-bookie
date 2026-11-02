// Forebet adapter.
//
// forebet.com answers 403 to plain HTTP and to headless browsers from datacenter
// IPs (Cloudflare), so the only working route is the browser-rendered page, which
// is captured into data/forebet/raw/*.txt and compiled into
// data/forebet/snapshot.json by scripts/forebet-snapshot.mjs.
//
// The server never scrapes: it reads the committed snapshot and matches fixtures
// to our board by slug, so a stale snapshot can at worst miss a fixture, never
// show a wrong one.

import { readFileSync } from "node:fs";

const SNAPSHOT_URL = new URL("../data/forebet/snapshot.json", import.meta.url);

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "02/11/2026 12:00" — Forebet renders UTC (verified against ESPN kickoffs) -> ISO
export function forebetDateToIso(dateStr, offsetHours = 0) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(String(dateStr).trim());
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mins] = m;
  const utc = Date.UTC(+yyyy, +mm - 1, +dd, +hh - offsetHours, +mins);
  return Number.isFinite(utc) ? new Date(utc).toISOString() : null;
}

// Compact form:  code | slug | DD/MM/YYYY HH:MM | H/D/A | tip | score | avg | odds
const COMPACT = /^([A-Za-z0-9.]+)\s*\|\s*([\w\-.()%]+)\s*\|\s*(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})\s*\|\s*([\d/\-]+)\s*\|\s*([12X])\s*\|\s*(\d{1,2})-(\d{1,2})\s*\|\s*([\d.]+|-)\s*\|\s*([\d/\-]+)\s*$/;

export function parseForebetText(text) {
  const rows = [];
  for (const rawLine of String(text).split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = COMPACT.exec(line);
    if (!m) continue;
    const [, code, slug, when, probs, tip, sh, sa, avg, odds] = m;
    const [ph, pd, pa] = probs.split("/").map(Number);
    if (!Number.isFinite(ph) || ph + pd + pa !== 100) continue;
    rows.push({
      code,
      slug,
      id: (slug.match(/-(\d+)$/) || [])[1] || null,
      kickoff: forebetDateToIso(when),
      probabilities: { home: ph / 100, draw: pd / 100, away: pa / 100 },
      tip,
      predictedScore: { home: Number(sh), away: Number(sa) },
      avgGoals: avg === "-" ? null : Number(avg),
      odds: odds === "-" ? null : odds,
      source: "Forebet",
      url: `https://www.forebet.com/en/football/matches/${slug}`,
    });
  }
  return rows;
}

// Markdown-block form: what a browser-rendered capture of the predictions page
// looks like (blank line between fields). Kept so a fresh capture can be dropped
// into data/forebet/raw/ unchanged.
export function parseForebetMarkdown(text) {
  const rows = [];
  const blocks = String(text).split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  for (let i = 0; i < blocks.length; i++) {
    const link = /\[(.+?)(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})\]\((https:\/\/www\.forebet\.com\/en\/football\/matches\/[^)]+)\)/.exec(blocks[i]);
    if (!link) continue;
    let j = i;
    let probs = null;
    let tipRow = null;
    let avg = null;
    let odds = null;
    while (j < Math.min(i + 8, blocks.length) && (!probs || !tipRow)) {
      j += 1;
      const b = (blocks[j] || "").trim();
      if (!probs && /^\d{5,6}$/.test(b)) {
        const [h, d, a] = b.length === 6 ? [b.slice(0, 2), b.slice(2, 4), b.slice(4, 6)] : [b.slice(0, 1), b.slice(1, 3), b.slice(3, 5)];
        if (Number(h) + Number(d) + Number(a) === 100) probs = { home: Number(h) / 100, draw: Number(d) / 100, away: Number(a) / 100 };
        continue;
      }
      if (probs && !tipRow) {
        const t = /^([12X])(\d{1,2})-(\d{1,2})$/.exec(b);
        if (t) { tipRow = { tip: t[1], predictedScore: { home: Number(t[2]), away: Number(t[3]) } }; continue; }
      }
      if (tipRow && avg === null && /^\d+\.\d+$/.test(b)) { avg = Number(b); continue; }
      if (tipRow && odds === null && /^\d+\/\d+$/.test(b)) { odds = b; }
    }
    if (!probs || !tipRow) continue;
    const url = link[3];
    const slug = url.split("/matches/")[1];
    const codeBlock = blocks.slice(Math.max(0, i - 3), i).reverse().find((b) => /^!\[\]\([^)]*\)[A-Za-z0-9.]+$/.test(b));
    rows.push({
      code: codeBlock ? codeBlock.replace(/^!\[\]\([^)]*\)/, "") : null,
      slug,
      id: (slug.match(/-(\d+)$/) || [])[1] || null,
      kickoff: forebetDateToIso(link[2]),
      probabilities: probs,
      tip: tipRow.tip,
      predictedScore: tipRow.predictedScore,
      avgGoals: avg,
      odds,
      source: "Forebet",
      url: url.replace("https://www.forebet.com", "https://www.forebet.com"),
    });
  }
  return rows;
}

export function parseForebetAny(text) {
  const compact = parseForebetText(text);
  return compact.length ? compact : parseForebetMarkdown(text);
}

let cached = null;
export function loadForebetSnapshot() {
  if (cached) return cached;
  try {
    const raw = JSON.parse(readFileSync(SNAPSHOT_URL, "utf8"));
    cached = { updatedAt: raw.updatedAt || null, matches: Array.isArray(raw.matches) ? raw.matches : [] };
  } catch {
    cached = { updatedAt: null, matches: [] };
  }
  return cached;
}

const STOPWORDS = new Set(["fc", "cf", "sc", "ac", "afc", "cd", "fk", "ii", "b", "the", "de", "do", "da", "al", "us"]);

function tokens(name) {
  return slugify(name)
    .split("-")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Find Forebet's numbers for one of our fixtures. Matched on the URL slug (the
// feed gives us a clean slug even when the visible team names are concatenated),
// and never across a 36-hour window, so a repeat fixture cannot leak in.
export function forebetFor(home, away, kickoff) {
  const { matches } = loadForebetSnapshot();
  if (!matches.length) return null;
  const kick = kickoff ? new Date(kickoff).getTime() : null;
  const homeSlug = slugify(home);
  const awaySlug = slugify(away);
  const homeToks = tokens(home);
  const awayToks = tokens(away);
  let best = null;
  let bestScore = 0;
  for (const m of matches) {
    const slug = m.slug || "";
    if (kick && m.kickoff && Math.abs(new Date(m.kickoff).getTime() - kick) > 36 * 3600000) continue;
    let score = 0;
    if (homeSlug && awaySlug && slug.includes(`${homeSlug}-${awaySlug}`)) score = 10;
    else {
      const hitHome = homeToks.filter((t) => slug.includes(t)).length;
      const hitAway = awayToks.filter((t) => slug.includes(t)).length;
      const all = hitHome + hitAway;
      if (all >= 2 && hitHome >= 1 && hitAway >= 1) score = all;
    }
    if (score > bestScore) { best = m; bestScore = score; }
  }
  if (!best) return null;
  return {
    probabilities: best.probabilities,
    tip: best.tip,
    predictedScore: best.predictedScore,
    avgGoals: best.avgGoals ?? null,
    odds: best.odds ?? null,
    code: best.code || null,
    url: best.url || null,
    updatedAt: loadForebetSnapshot().updatedAt,
  };
}

export function forebetStats() {
  const snap = loadForebetSnapshot();
  return { updatedAt: snap.updatedAt, matches: snap.matches.length };
}
