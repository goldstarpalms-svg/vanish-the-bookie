# Vanish The Bookie

A free, multi-sport analysis website for **@vanishthebookie**. Custom dark-green/lime design, football/basketball/tennis coverage, mobile layouts, explainable estimates and a transparent results log.

## What this delivery is — and is not

This is a working **development preview**, not a publicly deployed, validated tipping service. By default, fixtures, ratings, kickoff times and archived outcomes are **synthetic**. The calculations are real baseline calculations; the inputs are fictional. Real team/player names are used only to make the interface understandable. The UI marks these examples as demo content.

No verified win rate, users, testimonials or profitability are invented. Live results are empty in demo mode; the separate demo archive is explicitly fictional. There are no VIP subscriptions, wagering, deposits, payment processing or betting accounts.

### Included

- Branded responsive homepage, predictions, results and model-methodology pages.
- Sport, date and search filters; kickoff/probability sorting; saved matches in local storage.
- Match-analysis dialogs with outcome probabilities, calculations, input tables and limitations.
- Interactive Poisson / basketball-margin / Elo model lab.
- Full synthetic archive, outcome/sport filtering and labelled CSV export.
- Keyboard-accessible dialogs, reduced-motion support, mobile navigation and WAT times.
- Official X link supplied by the owner; optional WhatsApp invite configured server-side.
- Node/Express API and scheduled model refresh. Default demo refresh: **5 minutes**.
- An optional **The Odds API** live adapter. It computes margin-adjusted bookmaker consensus probabilities; it is **not an independently trained forecasting model**.
- A self-contained offline HTML export with embedded assets and local demo recalculation.

## Run locally or in a development sandbox

Requirements: Node.js **20.20+** (or a current supported Node 22 LTS), npm.

```bash
npm ci
npm run dev
```

The server binds to **0.0.0.0:3000**. In an Agent workspace, open the forwarded live preview. All browser API requests use relative `/api/...` paths, so the external preview does not point at a browser's localhost. The development server accepts proxy hosts; use the production build for deployment.

For a production-mode build:

```bash
npm ci
npm run build
npm start
```

This still runs in **demo mode** unless you explicitly configure live data. A running process in this workspace is not public hosting, a purchased domain, or an uptime guarantee.

## Optional configuration

Copy `.env.example` to `.env`. Keep `.env` private and out of version control. Never put API keys in React code, the HTML export, or a public repository.

```env
DATA_MODE=demo
PORT=3000
WHATSAPP_URL=https://chat.whatsapp.com/YOUR_PUBLIC_INVITE
```

Only recognized HTTPS WhatsApp domains are accepted. When no invitation is configured, the UI honestly shows “Invite link hasn't been added yet” rather than a made-up link.

### Connect a real odds feed

1. Choose a provider plan and confirm your rights to display/reuse its data.
2. Obtain a key privately from [The Odds API](https://the-odds-api.com/).
3. Review its [v4 documentation](https://the-odds-api.com/liveapi/guides/v4/), supported sports, markets, scores coverage, and usage-credit rules.
4. Configure the server environment:

```env
DATA_MODE=live
ODDS_API_KEY=YOUR_PRIVATE_SERVER_SIDE_KEY
LIVE_SPORT_KEYS=soccer_epl,basketball_nba
ODDS_REGIONS=uk
LIVE_REFRESH_MINUTES=60
```

5. Restart the server and inspect the data/status notes. A key has **not** been provided or tested for this delivery.

The adapter supports configured `soccer_`, `basketball_`, and `tennis_` keys. Tennis has tournament-specific keys: select an **active, supported tournament** from the provider's sports endpoint. Do not assume a permanent all-tennis key. Default live configuration requests only EPL and NBA. An inactive league may correctly produce no upcoming events.

The baseline converts each complete head-to-head market to normalized implied probabilities, then averages across the available bookmakers. Its most probable outcome becomes the displayed lean. Normalization removes total overround proportionally; it does not recover a known true probability or demonstrate an edge. It is not an odds-shopping or profitable-bet recommendation system.

Refresh defaults to **60 minutes**, configurable from 15–1440. It is not a real-time trading feed. Provider calls and credits are incurred per configured sport and request type; verify your plan before enabling it. No provider calls are made in demo mode. Frontend polling reads only this server's cache.

If live requests fail, the error is displayed and cached data is flagged stale. Demo fixtures are **never silently substituted** for live data. API errors do not include the secret key.

### Live archive and settlement

The first publication of each live pick is persisted to `data/live-records.json` and not rewritten by later odds. This is a basic single-instance local archive, not a tamper-proof audit system. Use a persistent disk, back it up, and migrate to a proper database/transactional job system before scaling beyond one process.

The optional scores endpoint grades completed head-to-head outcomes when the provider supplies both numeric scores. Results that cannot be resolved remain **pending**; ties in a two-outcome market are not silently graded as losses. Scores coverage can differ from odds coverage, particularly for tennis. The provider's three-day scores lookback also means extended downtime can leave old picks pending. Resolve those with a verified source rather than deleting them.

Before relying on settlement, verify sport-specific rules (regulation time versus overtime, extra time, retirements, postponements and voids). No bookmaker entry prices, stakes or payouts are tracked, so the site intentionally does **not** claim a live ROI or profit record. A high hit rate alone does not establish profitability.

## Model notes

All demo models are **unvalidated and uncalibrated**.

- **Football:** independent Poisson goals. Home expected goals = league goals × home attack × away defence + home advantage. Away expected goals = league goals × away attack × home defence. A defence index above 1 means more goals conceded, not better defence. Team news, correlated low-score effects and lineups are excluded.
- **Basketball:** a normal-distribution margin baseline using team-strength difference plus home advantage; standard deviation is an illustrative fixed 12 points. Not a possession-level model.
- **Tennis:** standard base-10 Elo formula with a 400-point scale. No surface, health, format or recent-form adjustments.

To build a real independent forecasting service, the next phase needs licensed historical results and current data, reproducible preprocessing, sport-specific feature engineering, chronological out-of-sample backtests without leakage, probability calibration, model monitoring and a prospective complete results log. Connecting an API alone does not do this work.

## Tests

```bash
npm test
```

Unit tests cover probability sums, model symmetry and monotonicity, input validation, timezone rollover, deterministic demo generation, all archive outcomes, odds normalization and malformed/incomplete live markets.

Browser checks (start the server first):

```bash
npx playwright install --with-deps chromium
node tests/browser-checks.js
```

These verify major interactions and mobile overflow. The live adapter has fixture-based unit tests, but no end-to-end test against a paid provider key has been performed.

## Offline export

```bash
npm run build
node scripts/export-preview.js ../Vanish-The-Bookie.html
```

The resulting file embeds the bundled application, styles, fonts, stadium image and a clearly marked synthetic snapshot. It needs **no network access** to render. Refresh recomputes the demo locally, rather than calling an unavailable server. Local storage, the clipboard, downloads and opening social links may be limited by a restricted viewer; in a regular browser they work according to its permissions. A blocked clipboard offers selectable text instead.

## Public-launch checklist

- [ ] Owner approval of brand, content, logo and official WhatsApp invite.
- [ ] Domain, TLS and persistent Node hosting with process restarts and monitoring.
- [ ] Appropriate licensed data plan and publication rights; secure environment secrets.
- [ ] Validated independent model if advertising independent predictions rather than odds consensus.
- [ ] Provider-specific settlement verification and a durable, auditable results database.
- [ ] Backend hardening, dependency updates, security review, rate limiting and operational alerts.
- [ ] Operator details, support contact, privacy/retention policy and final legal terms.
- [ ] Review the gambling-advertising, affiliate and other rules applicable to the operator and audience.
- [ ] Appropriate age controls and responsible-gambling measures. This preview has 18+ labelling but no age-verification flow.

## Project structure

```text
src/main.jsx                 Website pages and interactive components
src/styles.css               Responsive styling
src/utils.js                 Formatting, storage, CSV and network helpers
server/model.js              Pure, testable baseline mathematics
server/fixtures.js           Explicitly synthetic demo fixtures and results
server/live-provider.js      Optional server-side data adapter
server/index.js              HTTP API, scheduled refresh and archive
public/                      Local fonts, monogram favicon and stadium image
scripts/export-preview.js    Self-contained HTML export
.env.example                 Safe configuration template
```

The stadium illustration is AI-generated. Team badges are simple original initial-based placeholders, not official crests. DM Sans and Space Grotesk are distributed under the SIL Open Font License; their license files are included. React, Vite, Express and Lucide retain their respective licenses.
