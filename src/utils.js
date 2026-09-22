export const SPORTS = [
  { id: "all", label: "All sports" },
  { id: "football", label: "Football" },
  { id: "basketball", label: "Basketball" },
  { id: "baseball", label: "Baseball" },
  { id: "icehockey", label: "Ice Hockey" },
  { id: "americanfootball", label: "American FB" },
  { id: "tennis", label: "Tennis" },
  { id: "other", label: "Other" },
];
export const pct = (n, digits = 0) => `${(n * 100).toFixed(digits)}%`;
export const dateKey = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Lagos",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
export const formatDate = (value, short = false) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
  }).format(new Date(value));
export function dayLabel(kickoff, today) {
  if (dateKey(kickoff) === today) return "Today";
  const tomorrow = new Date(`${today}T12:00:00+01:00`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return dateKey(kickoff) === dateKey(tomorrow)
    ? "Tomorrow"
    : formatDate(kickoff, true);
}
export function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function exportCSV(records, mode = "demo") {
  const escape = (value) => {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows = [
    [
      "data_mode",
      "id",
      "sport",
      "league",
      "kickoff_utc",
      "home",
      "away",
      "pick",
      "probability",
      "result",
      "status",
      "published_at",
      "model_version",
    ],
    ...records.map((p) => [
      mode,
      p.id,
      p.sport,
      p.league,
      p.kickoff,
      p.home.name,
      p.away.name,
      p.pick.label,
      p.pick.probability.toFixed(4),
      p.result?.void
        ? "void"
        : p.result
          ? `${p.result.home}-${p.result.away}`
          : "",
      p.status,
      p.publishedAt,
      p.modelVersion,
    ]),
  ];
  const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `vanish-${mode}-results.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function getDashboard() {
  if (window.__VANISH_SNAPSHOT__) return window.__VANISH_SNAPSHOT__;
  const response = await fetch("/api/dashboard");
  if (!response.ok)
    throw new Error("The prediction service is unavailable. Please try again.");
  return response.json();
}
export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const done = document.execCommand("copy");
  field.remove();
  if (!done) throw new Error("Clipboard unavailable");
}
