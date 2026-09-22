# Vanish The Bookie - Vercel Free Launch (Today)

## 1. Push to GitHub (needs temporary token)
Create empty repo on GitHub: `vanish-the-bookie` (Public, no README).

Then provide:
- Repo URL: https://github.com/YOURNAME/vanish-the-bookie
- Temporary Personal Access Token (classic, `repo` scope) - revoke after push.

We will run:
```
git remote add origin https://YOUR_TOKEN@github.com/YOURNAME/vanish-the-bookie.git
git push -u origin main
```

## 2. Deploy to Vercel (2 min)
1. Go to https://vercel.com/new -> Import your GitHub repo
2. Framework Preset: Vite
3. Build Command: `npm run build` (auto)
4. Output Directory: `dist` (auto)
5. Environment Variables:
   - `DATA_MODE` = `demo` (start with demo, switch to `live` after you have API key)
   - For live later: `DATA_MODE=live`, `ODDS_API_KEY=your_key`, `LIVE_SPORT_KEYS=soccer_epl,basketball_nba`, `ODDS_REGIONS=uk`, `LIVE_REFRESH_MINUTES=120`
   - Optional: `WHATSAPP_URL=https://chat.whatsapp.com/...`
6. Deploy -> you get `https://vanish-the-bookie-xxx.vercel.app`

## 3. Get live odds (free)
- https://the-odds-api.com/ -> Sign up -> Dashboard -> API Key (500 free credits)
- In Vercel: Settings -> Environment Variables -> add `ODDS_API_KEY` and change `DATA_MODE` to `live` -> Redeploy
- Each refresh for 2 leagues = 2-4 credits. At 120min refresh = ~30 credits/day, safe for free.

## Limitations on Vercel Free
- Serverless: no `setInterval`, no persistent file. Results archive resets on cold start.
- Verified live record needs a database (Vercel Postgres/KV or external) - not included in free demo.
- Live mode is market consensus, not a validated profitable model.

## 4. Custom domain (later)
Vercel -> Settings -> Domains -> Add your domain.

## Test locally
npm test
npm run build
npm start
# Vercel function locally:
vercel dev
