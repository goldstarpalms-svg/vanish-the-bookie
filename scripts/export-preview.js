import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { demoFixtures, demoArchive } from "../server/fixtures.js";
import { predict, gradePrediction, MODEL_VERSION } from "../server/model.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(
  process.argv[2] || path.join(root, "Vanish-The-Bookie.html"),
);
let html = await readFile(path.join(root, "dist/index.html"), "utf8");
const files = await readdir(path.join(root, "dist/assets"));
const cssFile = files.find((file) => file.endsWith(".css"));
const jsFile = files.find((file) => file.endsWith(".js"));
if (!cssFile || !jsFile) throw new Error("Run npm run build before exporting.");
let css = await readFile(path.join(root, "dist/assets", cssFile), "utf8");
const mime = (file) =>
  file.endsWith(".ttf")
    ? "font/ttf"
    : file.endsWith(".woff2")
      ? "font/woff2"
      : file.endsWith(".svg")
        ? "image/svg+xml"
        : "image/jpeg";
const assetUrls = [...css.matchAll(/url\((['"]?)(\/[^)'"\s]+)\1\)/g)];
for (const match of assetUrls) {
  const file = match[2];
  const buffer = await readFile(path.join(root, "public", file.slice(1)));
  css = css.replaceAll(
    match[0],
    `url("data:${mime(file)};base64,${buffer.toString("base64")}")`,
  );
}
const js = (
  await readFile(path.join(root, "dist/assets", jsFile), "utf8")
).replaceAll("</script", "<\\/script");
const now = new Date();
const snapshot = {
  predictions: demoFixtures(now).map(predict),
  records: demoArchive(now).map((f) => {
    const p = predict(f);
    return {
      ...p,
      status: gradePrediction(p.pick, f.result),
      publishedAt: new Date(
        new Date(f.kickoff).getTime() - 10800000,
      ).toISOString(),
      settledAt: new Date(
        new Date(f.kickoff).getTime() + 7200000,
      ).toISOString(),
    };
  }),
  meta: {
    mode: "demo",
    modelVersion: MODEL_VERSION,
    generatedAt: now.toISOString(),
    nextRun: null,
    refreshMinutes: 5,
    timezone: "Africa/Lagos",
    calibrated: false,
    stale: false,
    error: null,
    warnings: [],
    source: "Synthetic fixtures and ratings · offline snapshot",
    snapshotDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now),
  },
  community: { x: "https://x.com/vanishthebookie", whatsapp: null },
};
html = html.replace(
  /<script\b[^>]*src="\/assets\/[^\"]+\.js"[^>]*><\/script>/,
  "",
);
html = html.replace(
  /<link\b[^>]*href="\/assets\/[^\"]+\.css"[^>]*>/,
  () => `<style>${css}</style>`,
);
const favicon = await readFile(path.join(root, "public/favicon.svg"));
html = html.replace(
  'href="/favicon.svg"',
  `href="data:image/svg+xml;base64,${favicon.toString("base64")}"`,
);
html = html.replace(
  "</head>",
  () =>
    `<script>window.__VANISH_SNAPSHOT__=${JSON.stringify(snapshot).replaceAll("<", "\\u003c")};</script>\n</head>`,
);
html = html.replace(
  "</body>",
  () => `<script type="module">${js}</script>\n</body>`,
);
await writeFile(output, html);
console.log(
  `Exported ${output} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB). All visual assets are embedded; demo mode is explicit.`,
);
