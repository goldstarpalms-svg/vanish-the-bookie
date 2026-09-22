import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { demoFixtures, demoArchive } from "./fixtures.js";
import { predict, gradePrediction, MODEL_VERSION } from "./model.js";
import { fetchLivePredictions, fetchLiveScores, fetchMultiSourcePredictions } from "./live-provider.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.env.DATA_MODE || "demo";
if (!["demo", "live"].includes(mode))
  throw new Error("DATA_MODE must be demo or live.");
const liveMinutes = Number(process.env.LIVE_REFRESH_MINUTES || 60);
if (!Number.isFinite(liveMinutes) || liveMinutes < 15 || liveMinutes > 1440)
  throw new Error("LIVE_REFRESH_MINUTES must be a number between 15 and 1440.");
const interval = mode === "demo" ? 300000 : liveMinutes * 60000;
const config = {
  key: process.env.ODDS_API_KEY,
  sportKeys: (process.env.LIVE_SPORT_KEYS || "baseball_mlb,basketball_wnba,soccer_fa_cup,soccer_epl,basketball_nba")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  regions: process.env.ODDS_REGIONS || "us,uk",
};
let predictions = [],
  records = [],
  generatedAt = null,
  lastError = null,
  warnings = [],
  refreshing = false;
const recordPath = path.join(root, "data/live-records.json");
async function readRecords() {
  try {
    return JSON.parse(await readFile(recordPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(
      "The results archive could not be read. Restore it before restarting live mode.",
    );
  }
}
async function persistRecords(value) {
  await mkdir(path.dirname(recordPath), { recursive: true });
  await writeFile(`${recordPath}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${recordPath}.tmp`, recordPath);
}
function generateDemo() {
  const now = new Date();
  predictions = demoFixtures(now).map(predict);
  records = demoArchive(now).map((f) => {
    const prediction = predict(f);
    return {
      ...prediction,
      status: gradePrediction(prediction.pick, f.result),
      publishedAt: new Date(
        new Date(f.kickoff).getTime() - 3 * 3600000,
      ).toISOString(),
      settledAt: new Date(
        new Date(f.kickoff).getTime() + 2 * 3600000,
      ).toISOString(),
    };
  });
}
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    if (mode === "demo") generateDemo();
    else {
      // Multi-source: Odds API + ESPN free for more games + independent Vanish model
      let incoming;
      try {
        incoming = await fetchMultiSourcePredictions(config);
      } catch {
        incoming = await fetchLivePredictions(config);
      }
      const archive = await readRecords();
      const byId = new Map(archive.map((row) => [row.id, row]));
      for (const prediction of incoming) {
        // Freeze the first public pick. Later odds cannot rewrite a published result.
        if (!byId.has(prediction.id))
          byId.set(prediction.id, { ...prediction, status: "pending" });
      }
      const scores = await fetchLiveScores(config);
      warnings = scores.warnings;
      for (const event of scores.events) {
        const row = byId.get(event.id);
        if (
          !row ||
          row.status !== "pending" ||
          !event.completed ||
          !event.scores?.length
        )
          continue;
        const homeScore = event.scores.find((s) => s.name === row.home.name);
        const awayScore = event.scores.find((s) => s.name === row.away.name);
        if (
          !homeScore ||
          !awayScore ||
          homeScore.score == null ||
          awayScore.score == null
        )
          continue;
        const result = {
          home: Number(homeScore.score),
          away: Number(awayScore.score),
        };
        if (!Number.isFinite(result.home) || !Number.isFinite(result.away))
          continue;
        // Two-outcome markets may have provider-specific overtime/retirement rules.
        // An unresolvable tie is never silently treated as a loss.
        if (result.home === result.away && !("draw" in row.probabilities))
          continue;
        byId.set(row.id, {
          ...row,
          result,
          status: gradePrediction(row.pick, result),
          settledAt: new Date().toISOString(),
        });
      }
      const allRecords = [...byId.values()];
      await persistRecords(allRecords);
      records = allRecords;
      predictions = allRecords.filter(
        (p) =>
          p.status === "pending" && new Date(p.kickoff).getTime() > Date.now(),
      );
    }
    generatedAt = new Date().toISOString();
    lastError = null;
  } catch (error) {
    lastError = error.message;
    console.error(`Prediction refresh: ${error.message}`);
  } finally {
    refreshing = false;
  }
}
function communityUrl() {
  const value = process.env.WHATSAPP_URL || "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      [
        "wa.me",
        "chat.whatsapp.com",
        "whatsapp.com",
        "www.whatsapp.com",
      ].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function dashboard() {
  return {
    predictions,
    records,
    meta: {
      mode,
      modelVersion: MODEL_VERSION,
      generatedAt,
      nextRun: generatedAt
        ? new Date(new Date(generatedAt).getTime() + interval).toISOString()
        : null,
      refreshMinutes: interval / 60000,
      timezone: "Africa/Lagos",
      calibrated: false,
      stale:
        Boolean(lastError) ||
        (generatedAt &&
          Date.now() - new Date(generatedAt).getTime() > interval * 2),
      error: lastError,
      warnings,
      source:
        mode === "demo"
          ? "Synthetic fixtures and ratings"
          : "The Odds API · normalized market consensus",
      snapshotDate: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    },
    community: { x: "https://x.com/vanishthebookie", whatsapp: communityUrl() },
  };
}
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.get("/api/dashboard", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(dashboard());
});
app.get("/api/health", (req, res) =>
  res.json({ ok: !lastError, mode, generatedAt, modelVersion: MODEL_VERSION }),
);
let lastManualRefresh = 0;
app.post("/api/demo/refresh", async (req, res) => {
  if (mode !== "demo")
    return res
      .status(403)
      .json({
        error:
          "Live refresh is scheduled server-side to protect provider quota.",
      });
  if (Date.now() - lastManualRefresh < 10000)
    return res
      .status(429)
      .json({
        error:
          "Already up to date. Please wait a few seconds before refreshing again.",
      });
  lastManualRefresh = Date.now();
  await refresh();
  res.json(dashboard());
});
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
const server = http.createServer(app);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist"), { index: false }));
  app.get("*", (req, res) => res.sendFile(path.join(root, "dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true, allowedHosts: true, hmr: false },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
await refresh();
const timer = setInterval(refresh, interval);
timer.unref();
const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () =>
  console.log(`Vanish The Bookie is ready on 0.0.0.0:${port} (${mode} mode)`),
);
process.on("SIGTERM", () => {
  clearInterval(timer);
  server.close(() => process.exit(0));
});
