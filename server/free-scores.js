/**
 * Free Scores - Get live/finished scores from ESPN free (no API key)
 * Alternative to Odds API scores which needs quota
 */

const CACHE = new Map();
const TTL = 2 * 60 * 1000; // 2 minutes for scores

function getCached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < TTL) return entry.data;
  return null;
}
function setCached(key, data) {
  CACHE.set(key, { data, ts: Date.now() });
}

export async function fetchESPNScores() {
  const cacheKey = "espn_scores";
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  const leagues = [
    { sport: "baseball", league: "mlb" },
    { sport: "basketball", league: "nba" },
    { sport: "basketball", league: "wnba" },
    { sport: "basketball", league: "nba-g-league" },
    { sport: "hockey", league: "nhl" },
    { sport: "football", league: "nfl" },
    { sport: "football", league: "nfl-preseason" },
    { sport: "soccer", league: "eng.1" },
    { sport: "soccer", league: "eng.2" },
    { sport: "soccer", league: "esp.1" },
    { sport: "soccer", league: "esp.2" },
    { sport: "soccer", league: "ita.1" },
    { sport: "soccer", league: "ger.1" },
    { sport: "soccer", league: "fra.1" },
    { sport: "soccer", league: "usa.1" },
    { sport: "soccer", league: "mex.1" },
    { sport: "soccer", league: "arg.1" },
    { sport: "soccer", league: "bra.1" },
    { sport: "soccer", league: "ned.1" },
    { sport: "soccer", league: "por.1" },
    { sport: "soccer", league: "uefa.champions" },
    { sport: "soccer", league: "uefa.europa" },
    { sport: "soccer", league: "tur.1" },
    { sport: "soccer", league: "sco.1" },
    { sport: "soccer", league: "jpn.1" },
    { sport: "soccer", league: "aus.1" },
    { sport: "tennis", league: "atp" },
    { sport: "tennis", league: "wta" },
  ];
  
  const finishedGames = [];
  const liveGames = [];
  
  for (const { sport, league } of leagues) {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const data = await res.json();
      
      for (const ev of (data.events || [])) {
        const comp = ev.competitions?.[0];
        if (!comp) continue;
        
        const status = comp.status?.type?.name || ev.status?.type?.name || "";
        const isCompleted = status.toLowerCase().includes("final") || status.toLowerCase().includes("completed") || comp.status?.type?.completed;
        const isLive = status.toLowerCase().includes("in progress") || status.toLowerCase().includes("live");
        
        if (!isCompleted && !isLive) continue;
        
        const competitors = comp.competitors || [];
        if (competitors.length < 2) continue;
        
        const home = competitors.find(c => c.homeAway === "home") || competitors[0];
        const away = competitors.find(c => c.homeAway === "away") || competitors[1];
        if (!home || !away) continue;
        
        const homeScore = parseInt(home.score);
        const awayScore = parseInt(away.score);
        if (isNaN(homeScore) || isNaN(awayScore)) continue;
        
        // ONLY TODAY'S RESULTS ONLY — filter finished to today only (Africa/Lagos)
        const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        const kickoffKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ev.date));
        const isTodayGame = kickoffKey === todayKey;
        // For finished, only keep today's games — user requested only today's results only
        if (isCompleted && !isTodayGame) {
          // Skip finished that are not today — enforce only today's results
          // To allow some results when no games today, we keep them but will filter later in API
          // For strict today only, we skip here, but we will keep all and filter in API to today with fallback
        }
        
        // Filter obscure leagues — only top leagues available on Bet9ja
        const leagueName = (ev.leagues?.[0]?.name || comp.league?.name || league).toLowerCase();
        const blocked = ["second-preliminary","derde divisie","vierde divisie","regionalliga","oberliga","isthmian","u21","u19","u23","women","group-stage","second-round-qualifying","acv","hoogeveen","banks o'dee","berwick","bonnyrigg","alloa"];
        if (blocked.some(kw => leagueName.includes(kw) || home.team?.displayName?.toLowerCase().includes(kw) || away.team?.displayName?.toLowerCase().includes(kw))) continue;
        const homeLower = (home.team?.displayName || "").toLowerCase();
        const awayLower = (away.team?.displayName || "").toLowerCase();
        const isBTeam = (n) => n.endsWith(" b") || n.includes(" b ");
        if (isBTeam(homeLower) || isBTeam(awayLower)) continue;
        
        const gameData = {
          id: `espn_${ev.id}`,
          homeTeam: home.team.displayName,
          awayTeam: away.team.displayName,
          homeScore,
          awayScore,
          status: isCompleted ? "final" : "live",
          completed: isCompleted,
          league: ev.leagues?.[0]?.name || ev.league?.name || league,
          kickoff: ev.date,
          sport,
          kickoffKey, // For filtering
          isToday: isTodayGame,
        };
        
        if (isCompleted) finishedGames.push(gameData);
        else liveGames.push(gameData);
      }
    } catch {}
  }
  
  const result = { finished: finishedGames.slice(0,100), live: liveGames.slice(0,30), total: finishedGames.length + liveGames.length };
  setCached(cacheKey, result);
  console.log(`ESPN Scores: ${finishedGames.length} finished, ${liveGames.length} live (filtered to top leagues only)`);
  return result;
}

// Try to match finished ESPN scores with our predictions and grade them
export function gradeWithESPNScores(predictions, espnScores) {
  const finished = [];
  const upcoming = [];
  
  for (const pred of predictions) {
    // Find matching ESPN finished game
    const espnMatch = espnScores.finished.find(s => {
      const homeMatch = s.homeTeam.toLowerCase().includes(pred.home.name.toLowerCase()) || pred.home.name.toLowerCase().includes(s.homeTeam.toLowerCase());
      const awayMatch = s.awayTeam.toLowerCase().includes(pred.away.name.toLowerCase()) || pred.away.name.toLowerCase().includes(s.awayTeam.toLowerCase());
      return homeMatch && awayMatch;
    });
    
    if (espnMatch) {
      // Game finished - grade it
      const result = { home: espnMatch.homeScore, away: espnMatch.awayScore };
      let status;
      if (result.home === result.away) {
        status = pred.pick.side === 'draw' ? 'won' : 'lost';
      } else if (result.home > result.away) {
        status = pred.pick.side === 'home' ? 'won' : 'lost';
      } else {
        status = pred.pick.side === 'away' ? 'won' : 'lost';
      }
      
      finished.push({
        ...pred,
        result,
        status,
        settledAt: new Date().toISOString(),
        scoreSource: "ESPN Free",
      });
    } else {
      // Still upcoming
      upcoming.push(pred);
    }
  }
  
  return { finished, upcoming };
}
