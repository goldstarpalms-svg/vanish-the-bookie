# Live Today on Vercel - 3 Steps

Repo is now live on GitHub: https://github.com/goldstarpalms-svg/vanish-the-bookie

## Step 1: Import to Vercel (1 minute)
1. Go to https://vercel.com/new
2. Import `goldstarpalms-svg/vanish-the-bookie`
3. Framework: Vite (auto)
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Click Deploy - you will get a URL like `https://vanish-the-bookie-xxx.vercel.app` - THIS IS DEMO MODE

## Step 2: Add live odds (2 minutes) - OPTIONAL FOR TODAY
1. Get free key: https://the-odds-api.com/ -> Sign up -> Dashboard -> Copy key (500 free credits)
2. In Vercel: Project -> Settings -> Environment Variables -> Add:
   - `DATA_MODE` = `live`
   - `ODDS_API_KEY` = `your_key`
   - `LIVE_SPORT_KEYS` = `soccer_epl,basketball_nba`
   - `ODDS_REGIONS` = `uk`
   - `LIVE_REFRESH_MINUTES` = `120`
   - `WHATSAPP_URL` = your WhatsApp link (optional)
3. Deployments -> Redeploy

## Step 3: What you get on free
- ✅ Public URL today
- ✅ Demo predictions work immediately
- ✅ Live market consensus when you add ODDS_API_KEY
- ⚠️ Free Vercel: no persistent results DB, sleeps on cold start (expected)
- ⚠️ Live is market consensus, NOT proven edge - needs backtests, calibration

## Your links
- GitHub: https://github.com/goldstarpalms-svg/vanish-the-bookie
- X: https://x.com/vanishthebookie
- Vercel will give you URL after import

## Next: Make it yours
- Add custom domain in Vercel -> Settings -> Domains
- Add WhatsApp invite link in env vars
