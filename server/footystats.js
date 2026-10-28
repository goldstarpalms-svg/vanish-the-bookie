/**
 * FootyStats integration — https://footystats.org
 *
 * FootyStats is Cloudflare-protected (browser challenge), so live server-side
 * fetches usually fail. We therefore run on a SNAPSHOT (data/footystats/snapshot.json)
 * gathered via browser-rendered fetch, and opportunistically try a live refresh
 * which silently falls back to the snapshot.
 *
 * Data used: team form strings, PPG, H2H records, BTTS %, Over 2.5 %, goals/match,
 * season xG/xGA, home/away splits — always labelled "FootyStats" in the UI.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(__dirname, "..", "data", "footystats", "snapshot.json");

let snapshot = null;

export function loadFootySnapshot() {
  if (snapshot) return snapshot;
  try {
    snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch (e) {
    console.warn("FootyStats snapshot not available:", e.message);
    snapshot = { generatedAt: null, matches: {}, bttsBoard: [], over25Board: [] };
  }
  return snapshot;
}

/* ---------- name normalisation & matching ---------- */

const DROP_TOKENS = new Set([
  "fc", "cf", "sc", "ac", "af", "ca", "cd", "sa", "club",
  "calcio", "de", "del", "della", "of", "the",
  "societa", "esportiva", "sociedad", "anonima", "associazione", "sportiva",
]);

const ALIASES = {
  "inter miami": "intermiami",
  "club internacional de futbol miami": "intermiami",
  "internacional de futbol miami": "intermiami",
  "inter miami cf": "intermiami",
  "red bull new york": "nyredbulls",
  "new york red bulls": "nyredbulls",
  "new york rb": "nyredbulls",
  "red bull bragantino": "bragantino",
  "rb bragantino": "bragantino",
  "heart of midlothian": "hearts",
  "hearts": "hearts",
  "rangers": "rangers",
  "nottingham forest": "forest",
  "real salt lake": "realsaltlake",
  "dc united": "dcunited",
  "d.c. united": "dcunited",
  "inter milan": "inter",
  "internazionale": "inter",
  "fc internazionale milano": "inter",
  "parma calcio 1913": "parma",
  "genoa cfc": "genoa",
  "juventus fc": "juventus",
  "ac milan": "milan",
  "bologna fc 1909": "bologna",
  "celtic fc": "celtic",
  "dundee united fc": "dundeeunited",
  "dundee united": "dundeeunited",
  "argentina juniors": "argentinos",
  "argentina juniors fc": "argentinos",
  "argentinos juniors": "argentinos",
  "montreal impact": "montreal",
  "cf montreal": "montreal",
  "se palmeiras": "palmeiras",
  "sepalmeiras": "palmeiras",
  "santos fc sao paulo": "santos",
  "santosaopaulo": "santos",
  "clube atletico bragantino": "bragantino",
  "clubeatleticobragantino": "bragantino",
  "chapecoense af": "chapecoense",
  "ss monza 1912": "monza",
  "ss monza": "monza",
  "ssmonza": "monza",
  "ssc napoli": "napoli",
  "sscnapoli": "napoli",
  "heart of midlothian fc": "hearts",
  "heartmidlothian": "hearts",
  "saint johnstone fc": "stjohnstone",
  "saintjohnstone": "stjohnstone",
  "saint mirren fc": "stmirren",
  "saintmirren": "stmirren",
};

export function normalizeName(name) {
  if (!name) return "";
  let s = String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  s = s.replace(/\bsaint\b/g, "st");

  if (ALIASES[s]) return ALIASES[s];

  const tokens = s.split(" ").filter((t) => t && !DROP_TOKENS.has(t) && !/^\d{4}$/.test(t));
  const joined = tokens.join("");
  return ALIASES[joined] || joined;
}

function pairKey(home, away) {
  return `${normalizeName(home)}|${normalizeName(away)}`;
}

/**
 * Find a FootyStats match record for a fixture, trying both name orders
 * (FootyStats sometimes lists the away side first in the URL/title).
 */
export function findFootyMatch(game) {
  const snap = loadFootySnapshot();
  const h = game?.home?.name;
  const a = game?.away?.name;
  if (!h || !a) return null;

  const nh = normalizeName(h);
  const na = normalizeName(a);
  for (const rec of Object.values(snap.matches)) {
    const rh = normalizeName(rec.home);
    const ra = normalizeName(rec.away);
    if ((rh === nh && ra === na) || (rh === na && ra === nh)) return rec;
  }
  return null;
}

/** Board-level signal (BTTS / Over 2.5 boards) keyed by either team name. */
export function findBoardSignal(game) {
  const snap = loadFootySnapshot();
  const h = normalizeName(game?.home?.name);
  const a = normalizeName(game?.away?.name);
  const hit = (m) => {
    const mh = normalizeName(m.home);
    const ma = normalizeName(m.away);
    return (mh === h && ma === a) || (mh === a && ma === h);
  };
  const btts = (snap.bttsBoard || []).find(hit);
  const over25 = (snap.over25Board || []).find(hit);
  return { btts, over25 };
}

/* ---------- enrichment ---------- */

/**
 * Build a compact, UI-ready FootyStats block for a fixture.
 * Returns null when FootyStats has nothing for the fixture.
 */
export function buildFootyBlock(game) {
  const rec = findFootyMatch(game);
  const board = findBoardSignal(game);

  if (!rec && !board.btts && !board.over25) return null;

  const block = {
    source: "FootyStats",
    updatedAt: loadFootySnapshot().generatedAt || null,
  };

  if (rec) {
    // Determine which side is "home" for our fixture vs the record's orientation.
    const recordIsFlipped = normalizeName(rec.home) === normalizeName(game.away?.name);
    const flip = (obj) =>
      recordIsFlipped
        ? {
            ...obj,
            home: obj.away,
            away: obj.home,
            ppgHome: obj.ppgAway,
            ppgAway: obj.ppgHome,
          }
        : obj;

    block.form = flip(rec.form);
    block.h2h = recordIsFlipped
      ? {
          ...rec.h2h,
          homeWins: rec.h2h.awayWins,
          awayWins: rec.h2h.homeWins,
          csHome: rec.h2h.csAway,
          csAway: rec.h2h.csHome,
        }
      : rec.h2h;
    block.prediction = rec.prediction;
    block.teams = recordIsFlipped
      ? { home: rec.teams.away, away: rec.teams.home }
      : rec.teams;
    block.url = rec.url;
  }
  if (board.btts) {
    block.boardBtts = { pct: board.btts.btts, gpm: board.btts.gpm, odds: board.btts.odds };
  }
  if (board.over25) {
    block.boardOver25 = { pct: board.over25.over25, gpm: board.over25.gpm, odds: board.over25.odds };
  }

  return block;
}

/**
 * FootyStats-informed confidence adjustment.
 * Small, honest nudges — FootyStats is ONE signal, never the whole verdict.
 * Returns { delta, reasons[] } in probability points (e.g. +4 = +4pp).
 */
export function footyConfidenceDelta(game, block) {
  if (!block) return { delta: 0, reasons: [] };

  const reasons = [];
  let delta = 0;
  const side = game?.pick?.side; // "home" | "away" | "draw"
  if (!side || side === "draw") return { delta: 0, reasons: [] };

  const mine = block.teams?.[side];
  const theirs = block.teams?.[side === "home" ? "away" : "home"];
  const myPpg = block.form?.[side === "home" ? "ppgHome" : "ppgAway"];
  const theirPpg = block.form?.[side === "home" ? "ppgAway" : "ppgHome"];

  if (mine && theirs) {
    // PPG gap (FootyStats form points per game).
    if (myPpg != null && theirPpg != null) {
      const gap = myPpg - theirPpg;
      if (gap >= 0.75) { delta += 4; reasons.push(`Form edge +${gap.toFixed(2)} PPG (FootyStats)`); }
      else if (gap >= 0.3) { delta += 2; reasons.push(`Better form +${gap.toFixed(2)} PPG (FootyStats)`); }
      else if (gap <= -0.6) { delta -= 3; reasons.push(`Form warning ${gap.toFixed(2)} PPG (FootyStats)`); }
    }
    // xG gap.
    const xgGap = (mine.xg ?? 0) - (theirs.xg ?? 0);
    if (xgGap >= 0.35) { delta += 3; reasons.push(`xG edge ${mine.xg} v ${theirs.xg} (FootyStats)`); }
    else if (xgGap <= -0.35) { delta -= 2; reasons.push(`xG against ${mine.xg} v ${theirs.xg} (FootyStats)`); }

    // Venue-specific win rate.
    const myVenue = side === "home" ? mine.winPctHome : mine.winPctAway;
    const theirVenue = side === "home" ? theirs.winPctAway : theirs.winPctHome;
    if (myVenue != null && theirVenue != null && myVenue - theirVenue >= 25) {
      delta += 2;
      reasons.push(`Venue edge ${myVenue}% v ${theirVenue}% (FootyStats)`);
    }
  }

  // H2H dominance.
  if (block.h2h && side !== "draw") {
    const myWins = side === "home" ? block.h2h.homeWins : block.h2h.awayWins;
    const theirWins = side === "home" ? block.h2h.awayWins : block.h2h.homeWins;
    const total = block.h2h.matches || 0;
    if (total >= 8 && myWins >= total * 0.55 && myWins > theirWins * 1.6) {
      delta += 2;
      reasons.push(`H2H dominance ${myWins}W v ${theirWins}W in ${total} (FootyStats)`);
    }
  }

  return { delta: Math.max(-6, Math.min(8, delta)), reasons };
}

/**
 * Enrich a prediction/game object in place (adds `.footy` + nudges confidence).
 * Safe no-op for non-football games or games with no FootyStats coverage.
 */
export function enrichWithFooty(game) {
  if (!game || (game.sport !== "football" && game.sport !== "soccer")) return game;
  const block = buildFootyBlock(game);
  if (!block) return game;

  const { delta, reasons } = footyConfidenceDelta(game, block);
  block.confidenceDelta = delta;
  block.insight = reasons;

  if (delta !== 0 && game.pick && typeof game.pick.probability === "number") {
    game.pick.probability = Math.max(0.35, Math.min(0.92, game.pick.probability + delta / 100));
    if (game.probabilities && game.independentProbabilities) {
      // Keep the independent model block in sync for transparency.
      const side = game.pick.side;
      if (game.independentProbabilities[side] != null) {
        game.independentProbabilities[side] = game.pick.probability;
      }
    }
    if (game.pick.confidence != null) {
      game.pick.confidence = Math.max(0.35, Math.min(0.95, game.pick.confidence + delta / 100));
    }
  }

  game.footy = block;
  return game;
}

/** Convenience: enrich a list. */
export function enrichMany(games) {
  return (games || []).map((g) => {
    try {
      return enrichWithFooty(g);
    } catch {
      return g;
    }
  });
}

/** Boards for the Stats Hub / market sections. */
export function getFootyBoards() {
  const snap = loadFootySnapshot();
  return {
    source: "FootyStats",
    updatedAt: snap.generatedAt,
    bttsBoard: snap.bttsBoard || [],
    over25Board: snap.over25Board || [],
    topBttsTeams: snap.topBttsTeams || [],
    topOver25Teams: snap.topOver25Teams || [],
  };
}

/**
 * Best-effort live refresh. FootyStats sits behind Cloudflare's browser
 * challenge, so this typically fails from data-center IPs — we log and keep
 * the snapshot either way. Never throws.
 */
export async function tryLiveRefresh() {
  try {
    const res = await fetch("https://footystats.org/stats/btts-stats", {
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; VanishTheBookie/1.0; +https://goldshopping.name.ng)" },
    });
    const text = await res.text();
    if (res.ok && text.includes("BTTS") && !text.includes("Just a moment")) {
      console.log("FootyStats live fetch OK (unexpected but welcome) — snapshot remains source of truth for structure.");
      return true;
    }
    console.log("FootyStats live fetch: Cloudflare challenge present — using snapshot.");
    return false;
  } catch (e) {
    console.log(`FootyStats live fetch failed (${e.message}) — using snapshot.`);
    return false;
  }
}
