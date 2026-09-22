# Vanish The Bookie - Go Live Today (Free Tier)

## What "Live" Means Right Now
- Demo mode = synthetic fixtures, transparent baseline math, no real edge.
- Live mode = market-implied estimates from bookmaker odds (The Odds API). NOT a validated profitable model yet. Needs history, backtests, calibration.

## Option A: Free Live with Render (recommended for today)

### 1. Get a free Odds API key (2 minutes)
1. Go to https://the-odds-api.com/
2. Sign up -> Dashboard -> Copy API Key (500 free credits/month)
3. Keep it secret - you will paste it into Render, NOT into GitHub.

Free credits: Each refresh for 2 sports (EPL + NBA) costs ~2-4 credits. At 60min refresh = ~100 credits/day. Use 120-240 min refresh on free to stay under 500.

### 2. Push to GitHub
If you have not created a repo yet:
- On github.com -> New repository -> `vanish-the-bookie` -> Public -> Create (DO NOT add README).

Then in this workspace:
```bash
git remote add origin https://github.com/YOURUSERNAME/vanish-the-bookie.git
git push -u origin main
```
If GitHub asks for auth, create a Personal Access Token (classic) with `repo` scope and use it as password.

### 3. Deploy to Render (free)
1. Go to https://dashboard.render.com/ -> New + -> Web Service -> Connect your GitHub repo
2. Settings:
   - Name: vanish-the-bookie
   - Runtime: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Instance Type: Free
3. Environment Variables (in Render dashboard):
   - `DATA_MODE` = `live`
   - `ODDS_API_KEY` = `your_key_here` (secret)
   - `LIVE_SPORT_KEYS` = `soccer_epl,basketball_nba`
   - `ODDS_REGIONS` = `uk`
   - `LIVE_REFRESH_MINUTES` = `120` (free-friendly, 15-1440 allowed)
   - `WHATSAPP_URL` = (optional, your invite link)
   - `NODE_ENV` = `production`
4. Deploy. Your URL will be `https://vanish-the-bookie-xxxx.onrender.com`

### Limitations on Free
- Render free sleeps after 15min no traffic -> refresh pauses until next visit.
- No persistent disk on free -> `data/live-records.json` resets on deploy/sleep. Verified live record will show "No verified results" until you add paid disk.
- Tennis needs active tournament keys (e.g., `tennis_atp_french_open`) - not reliable on free.

### 4. Make it truly yours
- Add your WhatsApp link in Render env.
- Add custom domain later in Render -> Settings -> Custom Domain.

## Option B: GitHub Pages (demo only, no server)
The file `Vanish-The-Bookie.html` in your home is fully offline. You can upload it anywhere, but it will NOT have live odds or server refresh.

## Next Phase (to claim real edge)
1. Licensed historical data, chronological backtests, no leakage.
2. Calibration (Brier score, log loss).
3. Prospective complete results log with frozen odds.
4. Responsible gambling pages and age gate if you take users.

## Local test
```bash
npm test
npm run build
DATA_MODE=live ODDS_API_KEY=xxx npm start
```
