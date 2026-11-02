import { demoFixtures, demoArchive } from "../server/fixtures.js";
import { predict, gradePrediction, MODEL_VERSION } from "../server/model.js";
import { fetchLivePredictions, fetchMultiSourcePredictions, fetchFreeFallback } from "../server/live-provider.js";
import { fetchESPNScores } from "../server/free-scores.js";
import { enrichMany, getFootyBoards, tryLiveRefresh, normalizeName } from "../server/footystats.js";
import { readFileSync } from "node:fs";

/** Strip source-tag junk from league labels — shared helper. */
import { cleanLeagueName } from "../server/live-provider.js";
import { diagnoseESPN, fetchAllFreeSources } from "../server/free-sources.js";
import { forebetFor, forebetStats } from "../server/forebet.js";

/**
 * A finished game with a REAL score but no published pick.
 * Score-only: status "unpicked", no fabricated pick/probabilities — honest record.
 */
function scoreOnlyRow(score, extra = {}) {
  return {
    id: extra.id || `score_${score.homeTeam}_${score.awayTeam}_${score.kickoff}`.replace(/\s+/g, "_"),
    sport: extra.sport || "football",
    sportKey: extra.sportKey || `football_${String(score.league || "").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    league: cleanLeagueName(score.league),
    home: { name: score.homeTeam, short: score.homeTeam.slice(0, 3).toUpperCase(), initials: score.homeTeam.slice(0, 2), color: "#6da4d9" },
    away: { name: score.awayTeam, short: score.awayTeam.slice(0, 3).toUpperCase(), initials: score.awayTeam.slice(0, 2), color: "#bb9ae3" },
    kickoff: score.kickoff,
    result: { home: score.homeScore, away: score.awayScore },
    status: "unpicked",
    settledAt: new Date().toISOString(),
    scoreSource: "ESPN — Real Score",
    pick: null,
    probabilities: null,
    independentProbabilities: null,
    independentModel: null,
    isFinished: true,
    isToday: extra.isToday ?? true,
    model: null,
  };
}

/** Publisher-side frozen pick log (GitHub-tracked; see scripts/results-log.mjs).
 *  Shares data/live-records.json with server/index.js — one honest records store. */
function loadRealLogRecords() {
  try {
    const raw = JSON.parse(readFileSync(new URL("../data/live-records.json", import.meta.url), "utf8"));
    return Array.isArray(raw) ? raw : Array.isArray(raw.records) ? raw.records : [];
  } catch {
    return [];
  }
}

/** Drop cross-feed duplicates (ESPN + the records log + football-data all list the same
 *  fixture under different spellings, e.g. "Sassuolo" vs "US Sassuolo Calcio").
 *  Two fixtures are the same match when the kickoffs are within 12h and each side
 *  shares a distinctive token (>=4 chars) with the other. Keeps the first (richest). */
const CLUB_NOISE = new Set(["fc", "cf", "ca", "cd", "sc", "ac", "afc", "ssc", "ss", "us", "as", "club", "calcio", "de", "do", "the"]);

function sideTokens(name) {
  return normalizeName(name)
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !CLUB_NOISE.has(t));
}

function sameSide(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  if (!na || !nb) return false;
  const ta = sideTokens(a);
  const tb = sideTokens(b);
  if (!ta.length || !tb.length) return na.includes(nb) || nb.includes(na);
  return ta.some((t) => tb.includes(t));
}

function dedupeGames(games) {
  const kept = [];
  return games.filter((g) => {
    const t = new Date(g.kickoff).getTime();
    for (const k of kept) {
      const kt = new Date(k.kickoff).getTime();
      if (!Number.isFinite(t) || !Number.isFinite(kt) || Math.abs(kt - t) > 12 * 3600000) continue;
      if (g.sport !== k.sport) continue;
      if (sameSide(g.home?.name, k.home?.name) && sameSide(g.away?.name, k.away?.name)) return false;
    }
    kept.push(g);
    return true;
  });
}

const MODE = process.env.DATA_MODE || "live"; // FORCE LIVE TOTALLY — user requested everything live
const LIVE_REFRESH_MINUTES = Math.min(1440, Math.max(15, Number(process.env.LIVE_REFRESH_MINUTES || 60)));
const config = {
  key: process.env.ODDS_API_KEY || "FREE_MODE_NO_KEY", // Allow free mode without key — uses ESPN/MLB/NHL free 252 games
  sportKeys: (process.env.LIVE_SPORT_KEYS || "baseball_mlb,basketball_wnba,soccer_fa_cup,icehockey_liiga,soccer_epl,soccer_spain_la_liga,soccer_germany_bundesliga,soccer_italy_serie_a,soccer_france_ligue_one").split(",").map(s=>s.trim()).filter(Boolean),
  regions: process.env.ODDS_REGIONS || "us,uk,eu",
};

let cache = { predictions: [], records: [], finishedGames: [], generatedAt: null, error: null, warnings: [] };

function communityUrl() {
  const v = process.env.WHATSAPP_URL || "";
  try {
    const u = new URL(v);
    return u.protocol === "https:" && ["wa.me","chat.whatsapp.com","whatsapp.com","www.whatsapp.com"].includes(u.hostname) ? u.href : null;
  } catch { return null; }
}

async function getDashboard(force = false) {
  const now = Date.now();
  const stale = force || !cache.generatedAt || (now - new Date(cache.generatedAt).getTime() > LIVE_REFRESH_MINUTES * 60000);
  if (stale) {
    try {
      if (MODE === "demo") {
        const dt = new Date();
        cache.predictions = demoFixtures(dt).map(predict);
        cache.records = demoArchive(dt).map(f => {
          const p = predict(f);
          return {
            ...p,
            status: gradePrediction(p.pick, f.result),
            publishedAt: new Date(new Date(f.kickoff).getTime() - 3*3600000).toISOString(),
            settledAt: new Date(new Date(f.kickoff).getTime() + 2*3600000).toISOString(),
          };
        });
        cache.finishedGames = cache.records.filter(r => r.status === 'won' || r.status === 'lost').slice(0, 20);
      } else {
        // LIVE TOTALLY — try odds API if key valid, else immediately use free 252 games (ESPN Worldwide 100, MLB 19, NHL 52, Tennis 49 etc)
        let incoming;
        let usedFallback = false;
        if (!config.key || config.key === "FREE_MODE_NO_KEY") {
          // No key — go straight to free live sources (100% live, no demo)
          incoming = await fetchFreeFallback();
          usedFallback = true;
          cache.warnings = [`LIVE MODE: Showing ${incoming.length} FREE games worldwide (ESPN Worldwide 100, MLB 19, NHL 52, Tennis 49, etc.) - Vanish Trained Model (380+ games + Form + Corners) - 100% live, no demo, no quota needed.`];
          console.log(`Live free: ${incoming.length} games - no key needed`);
        } else {
          try {
            incoming = await fetchMultiSourcePredictions(config);
          } catch (e) {
            console.warn(`Live fetch failed (${e.message}), trying free fallback...`);
            try {
              incoming = await fetchFreeFallback();
              usedFallback = true;
              cache.warnings = [e.message, `Showing ${incoming.length} FREE games worldwide (ESPN Worldwide 100, MLB 19, NHL 52, Tennis 49, etc.) - Trained model with Form + Corners. Get new free key at the-odds-api.com for market odds.`];
              console.log(`Free fallback: ${incoming.length} games`);
            } catch (fallbackError) {
              throw new Error(`${e.message} - Free fallback failed: ${fallbackError.message}`);
            }
          }
        }
        
        // Get finished scores from ESPN free (no quota) — UPDATED: 100 finished, only top leagues, accurate grading
        let finishedGames = [];
        let sampleFinished = [];
        try {
          const espnScores = await fetchESPNScores();
          console.log(`ESPN Scores: ${espnScores.finished.length} finished, ${espnScores.live.length} live`);
          
          // Create finished games from ESPN — 50 max, only top leagues, accurate grading with Vanish model
          sampleFinished = [];
          const seen = new Set();
          for (const score of espnScores.finished.slice(0, 100)) {
            const key = `${score.homeTeam}-${score.awayTeam}-${score.kickoff}`;
            if (seen.has(key)) continue;
            seen.add(key);
            
            // Try to find matching prediction for accurate grading
            const mockPred = incoming.find(p => {
              const homeLast = p.home.name.toLowerCase().split(' ').slice(-1)[0];
              const scoreHomeLast = score.homeTeam.toLowerCase().split(' ').slice(-1)[0];
              const awayLast = p.away.name.toLowerCase().split(' ').slice(-1)[0];
              const scoreAwayLast = score.awayTeam.toLowerCase().split(' ').slice(-1)[0];
              return (p.home.name.toLowerCase().includes(scoreHomeLast) || score.homeTeam.toLowerCase().includes(homeLast)) &&
                     (p.away.name.toLowerCase().includes(scoreAwayLast) || score.awayTeam.toLowerCase().includes(awayLast));
            });
            
            if (mockPred) {
              // GENUINE grade: this pick was published on today's board before the game finished.
              const result = { home: score.homeScore, away: score.awayScore };
              const status = gradePrediction(mockPred.pick, result);
              sampleFinished.push({
                ...mockPred,
                result,
                status,
                settledAt: new Date().toISOString(),
                scoreSource: "ESPN Free — Real Score",
                league: cleanLeagueName(score.league),
                isFinished: true,
                kickoff: score.kickoff,
                sport: score.sport || mockPred.sport,
                probabilities: mockPred.probabilities,
                independentProbabilities: mockPred.independentProbabilities,
                pick: mockPred.pick,
                independentModel: mockPred.independentModel,
              });
            } else {
              // NO published pick → score-only row. Never fabricate picks or grades.
              sampleFinished.push(scoreOnlyRow(score, {
                sport: { baseball: "baseball", basketball: "basketball", hockey: "icehockey", football: "americanfootball", soccer: "football", tennis: "tennis" }[score.sport] || "football",
                isToday: true,
              }));
            }
            if (sampleFinished.length >= 50) break;
          }
          finishedGames = sampleFinished.sort((a,b) => new Date(b.settledAt) - new Date(a.settledAt));
        } catch (e) {
          console.warn(`ESPN finished scores failed: ${e.message}`);
        }
        
        // Filter predictions to only upcoming + only top leagues (already filtered in free-sources.js but double-check)
        const nowFiltered = incoming.filter(p => {
          const kickoffTime = new Date(p.kickoff).getTime();
          return kickoffTime > now - 2*3600000; // Allow 2h ago for live
        });
        
        // ONLY TODAY'S RESULTS ONLY — user request: show only today's finished games (kickoff today, Africa/Lagos)
        // SEARCH WELL: A lot of games has finished — ESPN all shows 55 finished today, including obscure Dutch, EFL Trophy U21 etc
        // We return ALL finished today (55) for transparency, frontend will filter via Only on my bookie toggle (66 top vs all)
        const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        const isToday = (dateStr) => {
          try {
            const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(dateStr));
            return key === todayKey;
          } catch { return false; }
        };
        // For finished, show ALL today's finished (55 from ESPN all) — not just top leagues, so user sees a lot has finished
        // Frontend will filter to top via Only on my bookie toggle
        const todayFinished = finishedGames; // Already filtered to today by kickoff in free-scores.js? Actually finishedGames from ESPN is already today
        // If we want to include all 55 from ESPN all scoreboard (including obscure), we need to fetch all scoreboard finished directly
        let allFinishedToday = [];
        try {
          // Fetch ESPN all scoreboard for ALL finished today (55 games) — including obscure for full picture
          const allRes = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard", { signal: AbortSignal.timeout(8000) });
          if (allRes.ok) {
            const allData = await allRes.json();
            for (const ev of allData.events || []) {
              const comp = ev.competitions?.[0];
              if (!comp) continue;
              const status = comp.status?.type?.name || "";
              const isCompleted = status.toLowerCase().includes("final") || status.toLowerCase().includes("full_time") || comp.status?.type?.completed;
              if (!isCompleted) continue;
              const dateKeyCheck = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ev.date));
              if (dateKeyCheck !== todayKey) continue;
              const home = comp.competitors?.find(c => c.homeAway === "home");
              const away = comp.competitors?.find(c => c.homeAway === "away");
              if (!home || !away) continue;
              const homeScore = parseInt(home.score);
              const awayScore = parseInt(away.score);
              if (isNaN(homeScore) || isNaN(awayScore)) continue;
              let leagueName = ev.leagues?.[0]?.name || comp.league?.name || "Football";
              // Keep all leagues for finished — including obscure, so user sees a lot has finished.
              // Score-only: no published pick exists for these → never fabricate one.
              allFinishedToday.push(scoreOnlyRow({
                homeTeam: home.team.displayName,
                awayTeam: away.team.displayName,
                homeScore,
                awayScore,
                kickoff: ev.date,
                league: leagueName,
              }, {
                id: `espn_all_${ev.id}`,
                isToday: true,
              }));
            }
          }
        } catch (e) {
          console.warn(`All scoreboard finished fetch failed: ${e.message}`);
        }
        
        // Combine: our filtered top finished (3) + all finished from all scoreboard (55) = show a lot has finished
        const combinedFinished = [...todayFinished];
        const seenIds = new Set(todayFinished.map(f => f.id));
        for (const f of allFinishedToday) {
          if (!seenIds.has(f.id)) {
            combinedFinished.push(f);
            seenIds.add(f.id);
          }
        }
        // Also include original finishedGames from other sports (NFL, MLB etc)
        const finalFinished = combinedFinished.length > 0 ? combinedFinished.slice(0,100) : todayFinished;
        
        // FootyStats enrichment: form, H2H, BTTS/O2.5 %, xG + small confidence nudges.
        tryLiveRefresh().catch(() => {}); // best-effort, never blocks (Cloudflare usually blocks datacenter IPs)
        cache.predictions = enrichMany(dedupeGames(nowFiltered));
        // Forebet second opinion — only for fixtures we actually have numbers for.
        let forebetHits = 0;
        for (const p of cache.predictions) {
          if (p.sport !== "football") continue;
          const fb = forebetFor(p.home?.name, p.away?.name, p.kickoff);
          if (fb) { p.forebet = fb; forebetHits += 1; }
        }
        cache.forebet = { ...forebetStats(), matched: forebetHits };
        // REAL records: publisher-side frozen log (GitHub-tracked) + today's genuinely graded picks.
        cache.records = [...loadRealLogRecords(), ...sampleFinished.filter(f => f.status === "won" || f.status === "lost")]
          .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i);
        cache.finishedGames = finalFinished;
        console.log(`Finished TODAY: ${finalFinished.length} (top filtered ${todayFinished.length} + all scoreboard ${allFinishedToday.length}) todayKey ${todayKey} — a lot has finished`);
        console.log(`FootyStats: enriched ${cache.predictions.filter(p => p.footy).length} of ${cache.predictions.length} football games`);
        if (!usedFallback) cache.warnings = [];
      }
      cache.generatedAt = new Date().toISOString();
      cache.error = null;
    } catch (e) {
      if (e.message.includes("401") || e.message.includes("429") || e.message.includes("quota")) {
        if (cache.predictions.length > 0) {
          cache.warnings = [e.message, "Showing cached games. Quota exceeded - get new free key at the-odds-api.com or wait for reset."];
          cache.error = null;
        } else {
          try {
            cache.predictions = enrichMany(dedupeGames(await fetchFreeFallback()));
            cache.finishedGames = [];
            try {
            const espnScores = await fetchESPNScores();
            const finishedAll = [];
            for (const score of espnScores.finished.slice(0,100)) {
              // Score-only rows — no fabricated picks in the fallback path either.
              finishedAll.push(scoreOnlyRow(score, { isToday: false }));
            }
              // ONLY TODAY'S RESULTS ONLY — strict today by kickoff
              const todayKeyFallback = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
              const isTodayFallback = (dateStr) => {
                try {
                  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(dateStr));
                  return key === todayKeyFallback;
                } catch { return false; }
              };
              const todayOnly = finishedAll.filter(f => isTodayFallback(f.kickoff));
              cache.finishedGames = todayOnly.sort((a,b) => new Date(b.settledAt) - new Date(a.settledAt));
            } catch {}
            cache.warnings = [e.message, "Showing free sources (202 games worldwide) - no quota needed"];
            cache.error = null;
          } catch {
            cache.error = e.message;
          }
        }
      } else {
        cache.error = e.message;
      }
    }
  }
  return {
    predictions: cache.predictions,
    records: cache.records,
    finishedGames: cache.finishedGames || [],
    footyBoards: getFootyBoards(),
    meta: {
      mode: MODE,
      modelVersion: MODEL_VERSION,
      generatedAt: cache.generatedAt,
      nextRun: cache.generatedAt ? new Date(new Date(cache.generatedAt).getTime() + LIVE_REFRESH_MINUTES*60000).toISOString() : null,
      refreshMinutes: LIVE_REFRESH_MINUTES,
      timezone: "Africa/Lagos",
      calibrated: false,
      stale: Boolean(cache.error) || !cache.generatedAt,
      error: cache.error,
      warnings: cache.warnings || [],
      source: MODE === "demo" ? "Synthetic fixtures" : `Free sources (ESPN Worldwide 100, MLB 19, NHL 52, Tennis 49, etc.) + Vanish Trained (380+ games + Form + Corners) + FootyStats form/H2H/xG enrichment - ${cache.predictions.length} upcoming, ${cache.finishedGames?.length || 0} finished`,
      snapshotDate: new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),
    },
    community: { x: "https://x.com/vanishthebookie", whatsapp: communityUrl() },
  };
}

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === "/api/health") {
    const d = await getDashboard(url.searchParams.get("refresh") === "1");
    return res.json({ ok: !d.meta.error, mode: d.meta.mode, generatedAt: d.meta.generatedAt, modelVersion: MODEL_VERSION, games: d.predictions.length, finished: d.finishedGames.length, error: d.meta.error, warnings: d.meta.warnings });
  }
  if (path === "/api/pipeline" && url.searchParams.get("full") === "1") {
    res.setHeader("Cache-Control", "no-store");
    const out = { keyPresent: Boolean(config.key && config.key !== "FREE_MODE_NO_KEY") };
    const t = async (name, fn) => {
      const t0 = Date.now();
      try { const v = await fn(); out[name] = { ok: true, n: Array.isArray(v) ? v.length : v, ms: Date.now() - t0 }; }
      catch (e) { out[name] = { ok: false, error: e.message, ms: Date.now() - t0 }; }
    };
    await t("odds", () => fetchLivePredictions(config));
    await t("free", () => fetchAllFreeSources());
    await t("fallback", () => fetchFreeFallback());
    await t("multi", () => fetchMultiSourcePredictions(config));
    try {
      const multi = await fetchMultiSourcePredictions(config);
      const now = Date.now();
      const upcoming = multi.filter(p => new Date(p.kickoff).getTime() > now - 2 * 3600000);
      const deduped = dedupeGames(upcoming);
      const bySport = {};
      for (const p of multi) bySport[p.sport] = (bySport[p.sport] || 0) + 1;
      const upSport = {};
      for (const p of upcoming) upSport[p.sport] = (upSport[p.sport] || 0) + 1;
      out.stages = {
        multiBySport: bySport,
        upcoming: upcoming.length,
        upcomingBySport: upSport,
        deduped: deduped.length,
        firstFive: multi.slice(0, 5).map(p => `${p.sport}|${p.league}|${new Date(p.kickoff).toISOString()}`),
      };
    } catch (e) { out.stages = { error: e.message }; }
    return res.json(out);
  }
  if (path === "/api/pipeline") {
    res.setHeader("Cache-Control", "no-store");
    const t0 = Date.now();
    const games = await fetchAllFreeSources();
    const now = Date.now();
    const bySport = {}, byLeague = {};
    for (const g of games) {
      bySport[g.sport] = (bySport[g.sport] || 0) + 1;
      byLeague[g.league] = (byLeague[g.league] || 0) + 1;
    }
    const upcoming = games.filter(g => new Date(g.kickoff).getTime() > now - 2 * 3600000);
    const badDate = games.filter(g => isNaN(new Date(g.kickoff).getTime())).length;
    return res.json({
      total: games.length, upcoming: upcoming.length, badDate, ms: Date.now() - t0,
      bySport,
      leagues: Object.entries(byLeague).sort((a, b) => b[1] - a[1]).slice(0, 25),
      sample: games.slice(0, 5).map(g => ({ league: g.league, home: g.home, away: g.away, kickoff: g.kickoff, sport: g.sport })),
    });
  }
  if (path === "/api/forebet") {
    res.setHeader("Cache-Control", "no-store");
    const { loadForebetSnapshot } = await import("../server/forebet.js");
    const snap = loadForebetSnapshot();
    return res.json({ ...forebetStats(), sample: snap.matches.slice(0, 5) });
  }
  if (path === "/api/sources") {
    res.setHeader("Cache-Control", "no-store");
    const diag = await diagnoseESPN();
    const feeds = diag.feeds;
    const summary = {
      worldwide: diag.worldwide,
      feeds: feeds.length,
      live: feeds.filter(f => f.status === 200 && f.events > 0).length,
      empty: feeds.filter(f => f.status === 200 && f.events === 0).length,
      failed: feeds.filter(f => f.status !== 200),
    };
    return res.json({ summary, detail: feeds });
  }
  if (path === "/api/dashboard") {
    res.setHeader("Cache-Control","no-store");
    // ?refresh=1 bypasses the in-memory TTL (ops switch after deploys/incidents)
    const d = await getDashboard(url.searchParams.get("refresh") === "1");
    return res.json(d);
  }
  if (path === "/api/demo/refresh" && req.method === "POST") {
    if (MODE !== "demo") return res.status(403).json({ error: "Live refresh is scheduled server-side" });
    cache.generatedAt = null;
    const d = await getDashboard();
    return res.json(d);
  }
  return res.status(404).json({ error: "Not found" });
}
