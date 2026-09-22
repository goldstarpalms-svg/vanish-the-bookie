# SAFERSTAKE DEEP DIVE — How It Works & What Vanish Learned

Source: https://saferstake.com/ + /merge-bets /split-bets /bet-builder /result-checker /odds-market — studied Sep 22 2026 via fetch_page + web_search.

## What SaferStake Is
- Next.js app, chunks, no login, 2s avg like BetRelay
- Cart 0 items when empty, saved codes 0
- Core promise: Merge, Split, Build bets from free games, convert booking codes — infrastructure layer not tipster

## Pages

### /merge-bets
- Combine 2-50 codes from same bookmaker into one
- Source/Target bookmaker selectors
- Duplicates automatically removed
- Real-time odds comparison side by side (like BetRelay)
- Merge up to 50 bet codes at once (BetRelay claim) — SaferStake says 2-50
- Use case: You have multiple slips on same bookie, want one

### /split-bets
- Input accumulator code → split options
- Controls: Odds Per Ticket, Time UTC, Games Per Ticket 1-50, Number Tickets 1-10, Unique vs Combinations
- Unique: shuffle picks, create N tickets each with K games, random unique
- Combinations: combinatorial — comb(arr,k) = all combinations of K from N, slice 0..numTickets — like system bets
- Output: tickets grid with odds per ticket, games per ticket, mode badge
- Time UTC displayed ISO

### /bet-builder
- Build bets from 252 free games (Vanish has same count from free websites without credits: ESPN, TheSportsDB, MLB Stats, NHL, BallDontLie, OpenLigaDB, football-data.org)
- Filters: Game Time Start/End datetime-local UTC, Sports multi (all + football tennis baseball icehockey basketball), Leagues multi (30 leagues e.g., Premier League, La Liga etc), Markets multi (1X2, Double Chance, Over/Under, BTTS, HT, HT/FT, Asian Handicap, Goalscorers, Cards, Corners), Odds Per Ticket Min/Max number 1-20, Games Per Ticket 1-50, Number Tickets 1-10
- Build button adds picks to cart
- Filtered count of 252 matching
- 12 preview cards safe-tip-card with league — teams — pick + odds 1/prob
- No login, 2s avg like BetRelay, 40+ platforms like SwapBetCode Telegram @swapbetcodebot auto regional detection Stake source-only

### /result-checker
- Check results of booking codes
- Likely polls ESPN free or bookie API

### /odds-market
- Odds comparison market

### Cart + Saved Codes
- Cart 0 items when empty — like header cart counter
- Add to Cart from predictions using Add to Cart button
- In-cart border #4a6b2a box-shadow
- Saved codes 0 — like saved matches vanish:saved but for codes

## How SaferStake Makes Money / Tech
- Free core, no login — reduces friction
- Next.js chunks — fast
- Probably affiliate bookmakers or premium for unlimited conversions (BetRelay 1 free/day, Convat Pro unlimited)
- Infrastructure layer: not providing predictions, but tools to move slips — less regulatory risk than tipster

## What Vanish Implemented (Build 243.89kB -> 254.95kB)

- Cart state vanish:cart persisted localStorage, onCart forceAdd, view builder/cart added hash routing [results,model,builder,cart,comparator,odds]
- MatchCard Add to Cart button small lime/secondary toggle In Cart check icon, in-cart border #4a6b2a
- Header nav Builder NEW badge #4a6b2a + Cart (n) badge #c8e890 + header-actions cart button Layers3 icon Cart 0 items / (n)
- CartView: cart-grid column, cart-card #171e14 #2d3b26 8px 11px, booking-card gradient #1e2e14 #162112 border #4a6b2a total odds product 1/prob combined prob pct(1/totalOdds) $10 returns, clear cart button, copy booking code V{len}{random} mock SportyBet/Bet9ja/1xBet note real needs bookie API like BetRelay 110 routes, split-section border #2a3526 background #121c11, builder-row wrap labels #171e14 inputs #0e1510 #c8e890, tickets grid acca-card Ticket N games Odds
- Split: gamesPerTicket range 1..Math.min(10,cartPicks.length) slider, numTickets 1-10 slider, Time UTC ISO slice, Unique vs Combinations toggle tag green, tickets = splitTickets(gamesPerTicket,numTickets,mode) — Unique shuffled slice, Combinations comb recursive
- BetBuilder: sports multi all+5 tags green toggle logic prev.includes ? remove else add filter all, leagues multi 30 leagues slice 0,30 from predictions [...new Set(league)].slice(0,30), markets multi 10 markets toggle, oddsMin 1.2 oddsMax 5.0 number inputs step 0.1 min1 max20, gamesPerTicket 3 range 1-10, numTickets 2 range 1-10, startTime endTime datetime-local, filtered = predictions.filter sports leagues odds 1/prob between min max time >= start <= end slice 0,50, build picks slice 0,gamesPerTicket*numTickets forEach onCart(id,true) notify Builder: Added N picks — K per ticket x N tickets Sports: ... Markets: ... Odds min-max — like SaferStake /bet-builder
- Styles: cart-grid, cart-card, booking-card, split-section, builder-filters column #121c11 border #2a3526 radius 10 padding 18 margin 18 0, builder-row flex wrap gap10 align center 11px #9aaf88, label flex gap6 background #171e14 border #2d3b26 radius6 padding 6 10, input datetime-local number background #0e1510 border #2d3b26 radius4 color #c8e890 padding 4 6 11px, match-card.in-cart border + box-shadow

## Gaps vs SaferStake Still

- Real bet code conversion backend proxy to bookie APIs: Bet9ja SportyBet 1xBet etc have private APIs, need scraping or partner like BetRelay 12 bookmakers 110 routes 100% coverage merge up to 50 real-time odds comparison side by side, Convat 40+ sportsbooks split merge bulk 8 multi-bookie Mega Convert AI picks daily Smart Scan camera Rebook preview change picks Optimize odds Move every game to one market web+app+Telegram bot, AccuratePredict Africa first 12k market identifiers odds reconciliation API 5 min to 5 sec 7% boost, Betloy 100+ bookmakers 10 sports 50+ markets Telegram bot widget API odds scanner AI analyser editor saver viewer, ConvertBetBot Telegram @ConvertBetBot 20 bookies convert split merge payments subscription instant support, SwapBetCode @swapbetcodebot 40+ platforms auto regional Stake source-only — Vanish currently mock V+random, needs backend
- Result-checker real integration: poll ESPN free or bookie result API
- Odds-market real comparison 13 bookmakers Stake 1xbet Melbet Betwinner 22bet Bet365 Roobet BC Game 888Starz Betway Tonybet Betsson Shangrila best price flagged overround arbitrage like SportyTrader
- No login 2s avg — Vanish already no login, but need performance optimization

## How to Be Better Than SaferStake

- Combine SaferStake infrastructure (merge 2-50 split 1-50 1-10 Unique/Combinations builder Game Time Sports multi Leagues multi Markets multi Odds Per Ticket cart 0 items) + Forebet 10 markets Values Kelly + PredictZ/WinDrawWin 100+ leagues accas Best Bets + FootyStats 1500 leagues Stats Hub xG + NerdyTips NT Apex transparency GitHub CSV Trust Score 0-10 + SportyTrader 18 sports 13 bookies 15 markets odds comparison + BetRelay 110 routes merge 50 real-time odds + Convat 40+ bulk multi-bookie Smart Scan Rebook Optimize + AccuratePredict 12k identifiers 7% boost + Betloy 100+ bookmakers API widget
- Add Vanish independent model (Elo 50%+Form30%+Goals20%+Home8%+Corners) + 252 free games ESPN TheSportsDB MLB Stats NHL BallDontLie OpenLigaDB football-data.org + 57 finished auto-move live-dot pulse + Safe Tips 79% curated + Best Bets Today + Values Kelly + Accas double/treble/5-fold + Team Comparator 70+ stats xG viz H2H Live + Odds Converter Decimal Fractional American Implied Kelly
- Free means free, no VIP paywall, free core + premium $4.99-$9.99 no ads like Footbot $9.99 Forebet $7.99 FotMob $4.99
- Community @vanishthebookie X WhatsApp Telegram game 18 languages member area €500
- Transparency green/red frozen snapshot GitHub CSV 5 checks methodology admit weakness Strong Over/Under Corners tight low-scoring Weak winner high-variance backtest 380 games 87.6% not guarantee football randomness best 52-53% 1X2 Pinnacle 56-58% most accurate

SaferStake is infrastructure, Vanish is infrastructure + predictions + transparency — can be best of both.

