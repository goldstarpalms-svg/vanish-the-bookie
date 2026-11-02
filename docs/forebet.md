# Forebet source

Forebet's 1X2 probabilities are used as a **second opinion** on games already on
our board. They never replace the Vanish model and they never create a game by
themselves.

## Why there is a snapshot file

`forebet.com` answers **403** to:

- plain `fetch()`/curl (any user agent)
- headless Chromium from datacenter IPs (Cloudflare "Just a moment…")
- the in-repo `scripts/forebet-snapshot.mjs --url …` path, from Vercel or CI

The site only renders for a real browser on a residential IP. So the worker
never scrapes at request time. Instead:

```
browser-rendered capture  ->  data/forebet/raw/<date>.txt
                          ->  node scripts/forebet-snapshot.mjs --dir data/forebet/raw
                          ->  data/forebet/snapshot.json  (committed)
                          ->  server/forebet.js  (slug matching at request time)
```

`api/index.js` attaches `game.forebet` only when a fixture matches, and the UI
renders a `FOREBET 59 / 25 / 16 · tip home · 2-1` strip on those cards.

## Capturing

Open one of these in a normal browser, copy the fixture rows, and save them as
`data/forebet/raw/YYYY-MM-DD.txt`:

- `https://www.forebet.com/en/football-tips-and-predictions-for-today`
- `https://www.forebet.com/en/football-tips-and-predictions-for-tomorrow`
- league pages: `https://www.forebet.com/en/football-tips-and-predictions-for-<country>/<league>`
  (e.g. `…-for-italy/serie-a`, `…-for-england/championship`)

Both row shapes parse:

```
# compact (one line per fixture)
Es2 | tenerife-fc-andorra-2509411 | 02/11/2026 13:00 | 39/38/23 | 1 | 1-0 | 1.17 | 6/5
```

or the raw page text (blank-line separated blocks) exactly as rendered —
`node scripts/forebet-snapshot.mjs --from capture.txt` handles both. Dates parse
as EU `DD/MM/YYYY HH:MM` or US `MM/DD/YYYY h:mm AM/PM`; times are UTC.

## Coverage rules

- **Publication timing**: Forebet prices a round roughly 1–2 days out. League
  pages for a future matchday can show the fixtures with `-` in the prediction
  columns (e.g. the Nov 4–5 Champions League round on 2 Nov). Nothing to match
  until the numbers appear — recapture closer to kickoff.
- **Matching**: whole slug segments only, each side needs a distinctive segment
  (≥4 chars), home before away, within 36 hours of kickoff. Substring matching
  once attached a La Liga game to a Montenegrin one, so this is deliberately
  strict: a miss is acceptable, a wrong match is not.
- Snapshots older than 3 days are pruned on rebuild, so a stale file can never
  put wrong numbers on a live card.

## Tests

`tests/forebet.test.js` covers row parsing, both date formats, percentage
sanity (must sum to 100), the 36-hour window, and the false-positive
regression.
