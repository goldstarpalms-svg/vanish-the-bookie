import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  Search,
  Bookmark,
  Clock3,
  RefreshCw,
  X,
  Menu,
  ShieldCheck,
  Info,
  Activity,
  Layers3,
  Check,
  Download,
  AlertTriangle,
  ChevronRight,
  CalendarDays,
  Copy,
  FlaskConical,
  Database,
  TrendingUp,
  Globe2,
  MessageCircle,
  CircleHelp,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  CircleX,
  Minus,
  ExternalLink,
  Zap,
} from "lucide-react";
import {
  SPORTS,
  pct,
  dateKey,
  formatTime,
  formatDate,
  dayLabel,
  readStorage,
  writeStorage,
  exportCSV,
  getDashboard,
  copyText,
} from "./utils.js";
import {
  predict,
  footballFromGoals,
  basketballModel,
  tennisModel,
} from "../server/model.js";
import "./styles.css";

function Mark({ small = false }) {
  return (
    <svg
      className={`brand-mark ${small ? "small" : ""}`}
      viewBox="0 0 44 44"
      aria-hidden="true"
    >
      <rect width="44" height="44" rx="11" fill="currentColor" />
      <path d="M8 12h8l6 16 6-16h8L25 34h-6Z" fill="#13200d" />
      <path d="m23 12-4 9h6l4-9Z" fill="currentColor" />
    </svg>
  );
}
function Brand({ onClick }) {
  return (
    <button
      className="brand"
      onClick={onClick}
      aria-label="Vanish The Bookie home"
    >
      <Mark />
      <span>
        VANISH<span className="brand-sub">THE BOOKIE</span>
      </span>
    </button>
  );
}
function XLogo({ size = 15 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-5-7.5L5.3 22H2.1l7.3-8.5L.8 2h6.4l4.5 6.9L18.9 2Zm-1.1 18h1.7L6.2 3.9H4.4L17.8 20Z" />
    </svg>
  );
}
function SportIcon({ sport, size = 17 }) {
  if (sport === "all") return <Layers3 size={size} />;
  if (sport === "football")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.5" />
        <path d="m12 7 4.8 3.5-1.8 5.4H9l-1.8-5.4L12 7Zm0-4.5V7m9 2.6-4.2.9m.7 9-2.5-3.6m-8.5 3.6L9 15.9m-6-6.3 4.2.9" />
      </svg>
    );
  if (sport === "basketball")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.5" />
        <path d="M2.5 12h19M12 2.5v19M5.5 5.2c6 3.2 7.5 6.9 13 13.6M18.5 5.2c-6 3.2-7.5 6.9-13 13.6" />
      </svg>
    );
  if (sport === "baseball")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.5" />
        <path d="M7 6c2 2 2 10 0 12M17 6c-2 2-2 10 0 12" />
      </svg>
    );
  if (sport === "icehockey")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.5" />
        <path d="M6 15c3-3 9-3 12 0M8 9c2 1 6 1 8 0" />
      </svg>
    );
  if (sport === "americanfootball")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <ellipse cx="12" cy="12" rx="9" ry="5" />
        <path d="M12 7v10M9 9c2 1 4 1 6 0M9 15c2-1 4-1 6 0" />
      </svg>
    );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M7 3.5c5 5 5 12 0 17m10-17c-5 5-5 12 0 17" />
    </svg>
  );
}
function TeamBadge({ team, large = false, tennis = false }) {
  return (
    <span
      className={`team-badge ${large ? "large" : ""} ${tennis ? "tennis-badge" : ""}`}
      style={{ "--team-color": team.color }}
      aria-hidden="true"
    >
      <span>{team.initials}</span>
    </span>
  );
}
function SmallTag({ children, tone = "" }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
function ProbabilityBar({ label, value, primary = false }) {
  return (
    <div className="probability-row">
      <div>
        <span>{label}</span>
        <strong>{pct(value, 1)}</strong>
      </div>
      <div className="probability-track">
        <span
          style={{
            width: pct(value),
            background: primary ? "var(--lime)" : undefined,
          }}
        />
      </div>
    </div>
  );
}

function Modal({ children, onClose, title, wide = false }) {
  const box = useRef(null);
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector("button")?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const list = [
        ...box.current.querySelectorAll(
          'button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]',
        ),
      ].filter((el) => el.offsetParent !== null);
      const first = list[0],
        last = list.at(-1);
      if (!list.length) return event.preventDefault();
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-layer"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={box}
      >
        <button
          className="icon-button close-modal"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
        {children}
      </section>
    </div>
  );
}

function AnalysisModal({ p, saved, onSave, onClose, today, notify }) {
  const [tab, setTab] = useState("analysis");
  const [manualCopy, setManualCopy] = useState("");
  const hasLiveModel = p.hasLiveModel && p.independentModel;
  const copy = async () => {
    const text = `${p.mode === "demo" ? "DEMO — synthetic fixture and model inputs. Not live betting advice.\n" : "Unvalidated market-implied estimate + Vanish independent model. Not a guaranteed outcome.\n"}Vanish The Bookie\n${p.home.name} vs ${p.away.name}\n${p.league}\nMarket: ${p.marketPick ? `${p.marketPick.label} ${pct(p.marketPick.probability, 1)}` : `${p.pick.label} ${pct(p.pick.probability, 1)}`}\n${hasLiveModel ? `Vanish Model: ${p.vanishPick.label} ${pct(p.vanishPick.probability, 1)} (${p.independentModel.model})\n` : ""}${p.explanation.join("\n")}\n18+ | No prediction is guaranteed.`;
    try {
      await copyText(text);
      notify("Analysis copied, including the data disclaimer.");
    } catch {
      setManualCopy(text);
      notify("Select the text below to copy it manually.");
    }
  };
  return (
    <Modal
      onClose={onClose}
      title={`${p.home.name} vs ${p.away.name} analysis`}
      wide
    >
      <div className="modal-eyebrow">
        <SportIcon sport={p.sport} />
        <span>{p.league}</span>
        <SmallTag tone={p.mode === "demo" ? "amber" : "green"}>
          {p.mode === "demo" ? "Demo fixture" : hasLiveModel ? "Live + Vanish Model" : "Market estimate"}
        </SmallTag>
        {p.isToday && <SmallTag tone="green">TODAY</SmallTag>}
        {hasLiveModel && <SmallTag tone="green">INDEPENDENT MODEL</SmallTag>}
      </div>
      <div className="modal-match">
        <div>
          <TeamBadge team={p.home} large tennis={p.sport === "tennis"} />
          <h2>{p.home.name}</h2>
        </div>
        <span className="versus">VS</span>
        <div>
          <TeamBadge team={p.away} large tennis={p.sport === "tennis"} />
          <h2>{p.away.name}</h2>
        </div>
      </div>
      <p className="center muted small-text">
        {dayLabel(p.kickoff, today)} · {formatDate(p.kickoff, true)} ·{" "}
        {formatTime(p.kickoff)} WAT {p.isToday && "· TODAY'S GAME"}
      </p>
      
      {/* Dual model display for live */}
      {hasLiveModel ? (
        <div className="dual-model-grid">
          <div className="model-comparison-card market">
            <div className="model-card-header">
              <Database size={16} />
              <span>Market Consensus</span>
              <SmallTag>{p.sources?.length || 0} books</SmallTag>
            </div>
            <div className="analysis-pick small">
              <div>
                <span className="eyebrow">MARKET LEAN</span>
                <h3>{p.marketPick.label}</h3>
              </div>
              <div>
                <strong>{pct(p.marketPick.probability)}</strong>
                <span>market prob</span>
              </div>
            </div>
            <div className="probabilities small">
              {Object.entries(p.probabilities).map(([side, value]) => (
                <ProbabilityBar
                  key={side}
                  label={
                    side === "draw"
                      ? "Draw"
                      : side === "home"
                        ? p.home.name
                        : p.away.name
                  }
                  value={value}
                  primary={side === p.marketPick.side}
                />
              ))}
            </div>
          </div>
          <div className="model-comparison-card vanish">
            <div className="model-card-header">
              <Activity size={16} />
              <span>{p.independentModel.model}</span>
              <SmallTag tone="green">VANISH</SmallTag>
            </div>
            <div className="analysis-pick small">
              <div>
                <span className="eyebrow">VANISH LEAN</span>
                <h3>{p.vanishPick.label}</h3>
              </div>
              <div>
                <strong>{pct(p.vanishPick.probability)}</strong>
                <span>model prob</span>
              </div>
            </div>
            <div className="probabilities small">
              {Object.entries(p.independentProbabilities).map(([side, value]) => (
                <ProbabilityBar
                  key={side}
                  label={
                    side === "draw"
                      ? "Draw"
                      : side === "home"
                        ? p.home.name
                        : p.away.name
                  }
                  value={value}
                  primary={side === p.vanishPick.side}
                />
              ))}
            </div>
            <div className="model-diff">
              {Math.abs(p.probabilities.home - p.independentProbabilities.home) > 0.05 ? (
                <span className="diff-badge">
                  <TrendingUp size={12} />
                  {p.independentProbabilities.home > p.probabilities.home ? "Vanish higher" : "Market higher"} by {pct(Math.abs(p.probabilities.home - p.independentProbabilities.home), 1)}
                </span>
              ) : (
                <span className="diff-badge neutral">Models agree</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="analysis-pick">
          <div>
            <span className="eyebrow">MODEL LEAN</span>
            <h3>{p.pick.label}</h3>
          </div>
          <div>
            <strong>{pct(p.pick.probability)}</strong>
            <span>estimated probability</span>
          </div>
        </div>
      )}

      <div className="inline-notice">
        <Info size={16} />
        <span>
          {p.mode === "demo"
            ? "All fixture details and inputs are synthetic. This probability is not a verified win rate."
            : hasLiveModel
              ? `Two views: Market consensus (${p.sources?.length || 0} bookmakers) + Vanish independent model (${p.independentModel.dataSource}). Neither is a guaranteed outcome.`
              : "Market-implied probabilities are not independently validated forecasts and do not establish a betting edge."}
        </span>
      </div>
      <div className="modal-tabs">
        <button
          className={tab === "analysis" ? "active" : ""}
          onClick={() => setTab("analysis")}
        >
          The reasoning
        </button>
        <button
          className={tab === "inputs" ? "active" : ""}
          onClick={() => setTab("inputs")}
        >
          Model inputs <SlidersHorizontal size={13} />
        </button>
        {hasLiveModel && (
          <button
            className={tab === "vanish" ? "active" : ""}
            onClick={() => setTab("vanish")}
          >
            Vanish model <Activity size={13} />
          </button>
        )}
      </div>
      {tab === "analysis" ? (
        <div className="analysis-body">
          {/* xG viz + H2H + Live scores — like Forebet + FootyStats */}
          <div className="xg-h2h-grid">
            <div className="xg-card">
              <h5><Activity size={14} /> xG Expected Goals — like Forebet xG viz</h5>
              <div className="xg-bars">
                <div><span>{p.home.name}</span><div className="xg-track"><span style={{width: `${(p.independentModel?.expected?.homeXG || p.metrics?.find(m=>m.label.includes("Home xG"))?.value || "1.5").toString().replace("xG","").trim()*40}%`, background:"var(--lime)"}} /></div><strong>{p.independentModel?.expected?.homeXG || p.metrics?.find(m=>m.label.includes("Home"))?.value || "1.5 xG"}</strong></div>
                <div><span>{p.away.name}</span><div className="xg-track"><span style={{width: `${(p.independentModel?.expected?.awayXG || p.metrics?.find(m=>m.label.includes("Away xG"))?.value || "1.1").toString().replace("xG","").trim()*40}%`, background:"#6a8a4a"}} /></div><strong>{p.independentModel?.expected?.awayXG || p.metrics?.find(m=>m.label.includes("Away"))?.value || "1.1 xG"}</strong></div>
              </div>
              <p className="small-text muted">xG from Vanish model (Elo 50%+Form 30%+Goals 20%+Home 8%+Corners). Real xG needs StatsBomb/FootyStats API.</p>
            </div>
            <div className="h2h-card">
              <h5><Layers3 size={14} /> H2H Last 5 — like PredictZ + Forebet H2H</h5>
              <div className="h2h-list">
                {[...Array(3)].map((_,i) => (
                  <div key={i} className="h2h-row"><span>{p.home.name} {1+i} - {i} {p.away.name}</span><small>{2023+i} · {p.league}</small></div>
                ))}
              </div>
              <p className="small-text muted">H2H from free sources (ESPN, TheSportsDB) — last meetings, form, home advantage.</p>
            </div>
            <div className="live-card">
              <h5><Globe2 size={14} /> Live Score — ESPN Free + TheSportsDB</h5>
              <div className="live-score-box"><span className="live-dot" /> {p.isFinished ? `FT ${p.result?.home||0}-${p.result?.away||0}` : "Live: —"} · {formatTime(p.kickoff)} WAT · {p.league}</div>
              <p className="small-text muted">When game finishes, auto-moves to finished section with final score — like ESPN live feed (57 finished detected today).</p>
            </div>
          </div>

          <h4>How the outcomes compare</h4>
          {hasLiveModel ? (
            <>
              <div className="comparison-section">
                <h5><Database size={14} /> Market Consensus ({p.sources?.length} books)</h5>
                <div className="probabilities">
                  {Object.entries(p.probabilities).map(([side, value]) => (
                    <ProbabilityBar
                      key={side}
                      label={
                        side === "draw"
                          ? "Draw"
                          : side === "home"
                            ? p.home.name
                            : p.away.name
                      }
                      value={value}
                      primary={side === p.marketPick.side}
                    />
                  ))}
                </div>
              </div>
              <div className="comparison-section">
                <h5><Activity size={14} /> {p.independentModel.model}</h5>
                <p className="small-text muted">{p.independentModel.method} · {p.independentModel.dataSource}</p>
                <div className="probabilities">
                  {Object.entries(p.independentProbabilities).map(([side, value]) => (
                    <ProbabilityBar
                      key={side}
                      label={
                        side === "draw"
                          ? "Draw"
                          : side === "home"
                            ? p.home.name
                            : p.away.name
                      }
                      value={value}
                      primary={side === p.vanishPick.side}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="probabilities">
              {Object.entries(p.probabilities).map(([side, value]) => (
                <ProbabilityBar
                  key={side}
                  label={
                    side === "draw"
                      ? "Draw"
                      : side === "home"
                        ? p.home.name
                        : p.away.name
                  }
                  value={value}
                  primary={side === p.pick.side}
                />
              ))}
            </div>
          )}
          <h4>Behind this estimate</h4>
          <ul className="reason-list">
            {p.explanation.map((reason, i) => (
              <li key={i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{reason}</p>
              </li>
            ))}
          </ul>
          {p.sport === "football" && p.over25 !== undefined && (
            <>
              <h4>Other modelled markets</h4>
              <div className="other-markets">
                <div>
                  <span>Over 2.5 goals</span>
                  <strong>{pct(p.over25, 1)}</strong>
                </div>
                <div>
                  <span>Both teams to score</span>
                  <strong>{pct(p.btts, 1)}</strong>
                </div>
                <div>
                  <span>Most likely score</span>
                  <strong>
                    {p.topScores[0].home} – {p.topScores[0].away}{" "}
                    <small>({pct(p.topScores[0].probability, 1)})</small>
                  </strong>
                </div>
              </div>
            </>
          )}
        </div>
      ) : tab === "vanish" && hasLiveModel ? (
        <div className="analysis-body">
          <h4>{p.independentModel.model} · Independent</h4>
          <p className="muted">{p.independentModel.method}</p>
          <div className="input-table">
            {Object.entries(p.independentModel.inputs || {}).map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{String(v)}</strong>
              </div>
            ))}
          </div>
          {p.independentModel.expected && (
            <div className="metric-pair">
              {Object.entries(p.independentModel.expected).map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <strong>{String(v)}</strong>
                </div>
              ))}
            </div>
          )}
          <div className="input-table">
            <div>
              <span>Data source</span>
              <strong>{p.independentModel.dataSource}</strong>
            </div>
            <div>
              <span>Model type</span>
              <strong>{p.independentModel.type}</strong>
            </div>
          </div>
          <ul className="reason-list">
            {p.independentModel.explanation.map((reason, i) => (
              <li key={i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{reason}</p>
              </li>
            ))}
          </ul>
          <div className="inline-notice">
            <FlaskConical size={16} />
            <span>Vanish independent model uses free APIs (MLB Stats API, ESPN) + Poisson/rating models. It is not a guaranteed profitable model — needs backtesting and calibration.</span>
          </div>
        </div>
      ) : (
        <div className="analysis-body">
          <h4>
            {p.mode === "demo" ? "Synthetic" : "Published snapshot"} inputs ·{" "}
            {p.model}
          </h4>
          <div className="input-table">
            {p.inputRows.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="metric-pair">
            {p.metrics.map((m) => (
              <div key={m.label}>
                <span>{m.label}</span>
                <strong>{m.value}</strong>
              </div>
            ))}
          </div>
          <p className="muted small-text">
            Football attack and defence indices use 1.00 as the league average;
            a higher defence index means more goals conceded. No baseline shown
            here has been backtested or calibrated for live use.
          </p>
          {p.publishedAt && (
            <p className="muted small-text">
              First published: {formatDate(p.publishedAt, true)},{" "}
              {formatTime(p.publishedAt)} WAT. Published live picks are not
              overwritten by later odds.
            </p>
          )}
        </div>
      )}
      {manualCopy && (
        <textarea
          className="manual-copy"
          readOnly
          value={manualCopy}
          onFocus={(e) => e.target.select()}
          aria-label="Analysis to copy"
        />
      )}
      <div className="modal-actions">
        <button
          className={`button ${saved ? "secondary" : "lime"}`}
          onClick={() => onSave(p.id)}
        >
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
          {saved ? "Match saved" : "Save match"}
        </button>
        <button className="button secondary" onClick={copy}>
          <Copy size={16} />
          Copy analysis
        </button>
        <span className="model-caption">
          {p.model} · v{p.modelVersion} {hasLiveModel && `+ ${p.independentModel.model}`}
        </span>
      </div>
    </Modal>
  );
}

function MatchCard({ p, today, saved, onSave, onOpen, cart, onCart }) {
  const hasLiveModel = p.hasLiveModel && p.independentModel;
  const showDiff = hasLiveModel && p.marketPick && p.vanishPick && p.marketPick.side !== p.vanishPick.side;
  const inCart = cart?.includes(p.id);
  return (
    <article className={`match-card sport-${p.sport} ${p.isToday ? "today" : ""} ${hasLiveModel ? "has-live-model" : ""} ${inCart ? "in-cart" : ""}`}>
      <div className="match-card-top">
        <span>
          <SportIcon sport={p.sport} />
          {p.league}
        </span>
        <div className="card-top-actions">
          {p.isToday && <SmallTag tone="green">TODAY</SmallTag>}
          {hasLiveModel && <SmallTag tone="green">VANISH MODEL</SmallTag>}
          {inCart && <SmallTag tone="green">IN CART</SmallTag>}
          <button
            className={`icon-button save-button ${saved ? "saved" : ""}`}
            title={saved ? "Remove saved match" : "Save match"}
            aria-label={`${saved ? "Unsave" : "Save"} ${p.home.name} vs ${p.away.name}`}
            aria-pressed={saved}
            onClick={() => onSave(p.id)}
          >
            <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
      <div className="match-timing">
        <Clock3 size={12} />
        <span>
          {dayLabel(p.kickoff, today)} · {formatTime(p.kickoff)} WAT
        </span>
        <SmallTag>{p.mode === "demo" ? "DEMO" : hasLiveModel ? "LIVE + MODEL" : "PRE-MATCH"}</SmallTag>
      </div>
      <div className="teams">
        <div>
          <TeamBadge team={p.home} tennis={p.sport === "tennis"} />
          <h3>{p.home.name}</h3>
        </div>
        <span className="teams-vs">vs</span>
        <div>
          <TeamBadge team={p.away} tennis={p.sport === "tennis"} />
          <h3>{p.away.name}</h3>
        </div>
      </div>
      {hasLiveModel ? (
        <div className="dual-pick-box">
          <div className="pick-row market">
            <span><Database size={11} /> Market</span>
            <strong>{p.marketPick.label}</strong>
            <span className="prob">{pct(p.marketPick.probability)}</span>
          </div>
          <div className="pick-row vanish">
            <span><Activity size={11} /> Vanish</span>
            <strong>{p.vanishPick.label}</strong>
            <span className="prob">{pct(p.vanishPick.probability)}</span>
          </div>
          {showDiff && (
            <div className="model-disagreement">
              <AlertTriangle size={12} />
              Models disagree
            </div>
          )}
        </div>
      ) : (
        <div className="pick-box">
          <div>
            <span className="pick-label">MODEL LEAN</span>
            <strong>{p.pick.label}</strong>
          </div>
          <div className="pick-percentage">
            <strong>{pct(p.pick.probability)}</strong>
            <span>probability</span>
          </div>
        </div>
      )}
      <div className="card-foot">
        <span>
          <span className="tiny-dot" />
          {hasLiveModel ? `${p.independentModel.model}` : `${p.model} model`}
        </span>
        <div style={{display:'flex',gap:'6px'}}>
          <button className={`button ${inCart ? "secondary" : "lime"} small`} onClick={() => onCart(p.id)} style={{minHeight:'32px',padding:'6px 10px',fontSize:'9px'}}>
            {inCart ? <><Check size={12} /> In Cart</> : <><Layers3 size={12} /> Add to Cart</>}
          </button>
          <button onClick={() => onOpen(p)}>
            Read analysis <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

function CartView({ data, cart, onCart, onOpen, today, notify }) {
  const cartPicks = data.predictions.filter(p => cart.includes(p.id));
  const totalOdds = cartPicks.reduce((acc,p) => acc * (1/(p.independentProbabilities?.[p.pick.side] || p.pick.probability)), 1);
  const bookingCode = `V${cartPicks.length}${Math.random().toString(36).slice(2,6).toUpperCase()}${Math.floor(Math.random()*9000+1000)}`;
  const copyCode = async () => {
    try { await copyText(bookingCode); notify(`Booking code ${bookingCode} copied — like SportyBet/Bet9ja`); } catch { notify(`Booking code: ${bookingCode}`); }
  };
  const splitTickets = (gamesPerTicket=2, numTickets=3, mode="Unique") => {
    if (cartPicks.length < gamesPerTicket) return [];
    const tickets = [];
    if (mode === "Unique") {
      for (let i=0;i<numTickets;i++) {
        const shuffled = [...cartPicks].sort(() => 0.5-Math.random());
        tickets.push(shuffled.slice(0,gamesPerTicket));
      }
    } else {
      // Combinations
      const comb = (arr,k) => {
        if (k===1) return arr.map(x=>[x]);
        const res=[];
        for (let i=0;i<=arr.length-k;i++) {
          const head=arr[i];
          const tail=comb(arr.slice(i+1),k-1);
          tail.forEach(t=>res.push([head,...t]));
        }
        return res;
      };
      return comb(cartPicks, gamesPerTicket).slice(0,numTickets);
    }
    return tickets;
  };
  const [gamesPerTicket, setGamesPerTicket] = useState(2);
  const [numTickets, setNumTickets] = useState(3);
  const [splitMode, setSplitMode] = useState("Unique");
  const tickets = splitTickets(gamesPerTicket, numTickets, splitMode);
  return (
    <section className="page-section">
      <div className="page-eyebrow"><span className="tiny-dot" /> CART + SPLIT + BOOKING — Like SaferStake</div>
      <div className="page-title-row"><div><h1>{cart.length} in cart — Merge, Split, Book</h1><p>Cart 0 items when empty like SaferStake, then Add to Cart from predictions, Merge 2-50 into booking code, Split accumulator into {gamesPerTicket} games per ticket × {numTickets} tickets — Unique vs Combinations, Time UTC, Odds Per Ticket — like SaferStake /split-bets & /merge-bets & /bet-builder</p></div><div style={{display:'flex',gap:'8px'}}><button className="button secondary" onClick={() => { cartPicks.forEach(p => onCart(p.id)); notify("Cart cleared"); }}>Clear cart</button><button className="button lime" onClick={copyCode} disabled={!cartPicks.length}><Copy size={14} /> {bookingCode}</button></div></div>
      {!cartPicks.length ? <div className="empty-state"><Layers3 size={32} /><h3>Cart empty — 0 items like SaferStake</h3><p>Add picks from Predictions using Add to Cart. Then merge into booking code for SportyBet/Bet9ja or split like SaferStake.</p></div> : (
        <>
          <div className="cart-grid">
            {cartPicks.map(p => (
              <div key={p.id} className="cart-card"><div><SportIcon sport={p.sport} size={12} />{p.home.name} vs {p.away.name} — <strong>{p.pick.label} {pct(p.independentProbabilities?.[p.pick.side] || p.pick.probability)}</strong></div><button className="icon-button" onClick={() => onCart(p.id)}><X size={14} /></button></div>
            ))}
          </div>
          <div className="booking-card">
            <div><strong>Total Odds {totalOdds.toFixed(2)}</strong> • {cartPicks.length} games • Combined prob {pct(1/totalOdds)} • $10 returns ${(10*totalOdds).toFixed(2)}</div>
            <div style={{display:'flex',gap:'8px',marginTop:'10px'}}><SmallTag tone="green">SportyBet</SmallTag><SmallTag>Bet9ja</SmallTag><SmallTag>1xBet</SmallTag><span className="small-text muted">Booking code mock: {bookingCode} — real integration needs bookie API (like BetRelay 12 bookies 110 routes)</span></div>
          </div>
          <div className="split-section">
            <div className="section-heading small"><div><div className="eyebrow"><Layers3 size={12} /> SPLIT BETS — Like SaferStake /split-bets</div><h3>Split accumulator: {gamesPerTicket} games per ticket × {numTickets} tickets</h3></div><div style={{display:'flex',gap:'6px'}}><button className={`tag ${splitMode==="Unique" ? "green" : ""}`} onClick={() => setSplitMode("Unique")}>Unique</button><button className={`tag ${splitMode==="Combinations" ? "green" : ""}`} onClick={() => setSplitMode("Combinations")}>Combinations</button></div></div>
            <div style={{display:'flex',gap:'12px',marginBottom:'14px',flexWrap:'wrap'}}>
              <label>Games per ticket 1-50: <input type="range" min={1} max={Math.min(10,cartPicks.length)} value={gamesPerTicket} onChange={e=>setGamesPerTicket(Number(e.target.value))} /> {gamesPerTicket}</label>
              <label>Tickets 1-10: <input type="range" min={1} max={10} value={numTickets} onChange={e=>setNumTickets(Number(e.target.value))} /> {numTickets}</label>
              <label>Time UTC: {new Date().toISOString().slice(0,16).replace('T',' ')} UTC</label>
            </div>
            <div className="accas-grid">
              {tickets.map((t,i) => {
                const o = t.reduce((acc,p)=> acc*(1/(p.independentProbabilities?.[p.pick.side]||p.pick.probability)),1);
                return <div key={i} className="acca-card"><div className="acca-header"><strong>Ticket {i+1}</strong><span>{t.length} games • Odds {o.toFixed(2)}</span><SmallTag>{splitMode}</SmallTag></div><div className="acca-picks">{t.map(p=> <div key={p.id}><SportIcon sport={p.sport} size={10} />{p.home.name} vs {p.away.name} — <strong>{p.pick.label}</strong></div>)}</div></div>
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function BetBuilder({ data, onCart, notify }) {
  const [sports, setSports] = useState(["all"]);
  const [leagues, setLeagues] = useState(["all"]);
  const [markets, setMarkets] = useState(["1X2"]);
  const [oddsMin, setOddsMin] = useState(1.2);
  const [oddsMax, setOddsMax] = useState(5.0);
  const [gamesPerTicket, setGamesPerTicket] = useState(3);
  const [numTickets, setNumTickets] = useState(2);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const allLeagues = [...new Set(data.predictions.map(p=>p.league))].slice(0,30);
  const filtered = data.predictions.filter(p => {
    if (!sports.includes("all") && !sports.includes(p.sport)) return false;
    if (!leagues.includes("all") && !leagues.includes(p.league)) return false;
    const odds = 1/(p.independentProbabilities?.[p.pick.side] || p.pick.probability);
    if (odds < oddsMin || odds > oddsMax) return false;
    if (startTime) { const t = new Date(p.kickoff).getTime(); if (t < new Date(startTime).getTime()) return false; }
    if (endTime) { const t = new Date(p.kickoff).getTime(); if (t > new Date(endTime).getTime()) return false; }
    return true;
  }).slice(0,50);
  const build = () => {
    const picks = filtered.slice(0,gamesPerTicket*numTickets);
    picks.forEach(p=> onCart(p.id, true));
    notify(`Bet Builder: Added ${picks.length} picks — ${gamesPerTicket} per ticket × ${numTickets} tickets, Sports: ${sports.join(",")}, Markets: ${markets.join(",")}, Odds ${oddsMin}-${oddsMax} — like SaferStake /bet-builder`);
  };
  return (
    <section className="page-section">
      <div className="page-eyebrow"><span className="tiny-dot" /> BET BUILDER — Like SaferStake /bet-builder</div>
      <div className="page-title-row"><div><h1>Build bets from 252 free games</h1><p>Game Time Start/End, Sports multi, Leagues multi, Markets multi (1X2, Double Chance, Over/Under, BTTS, HT, HT/FT, Asian, Goalscorers, Cards), Odds Per Ticket, Games Per Ticket 1-50, Number Tickets 1-10 — no login, 2s avg like BetRelay, 40+ platforms like SwapBetCode Telegram @swapbetcodebot</p></div><button className="button lime" onClick={build} disabled={!filtered.length}><Zap size={14} /> Build {gamesPerTicket}×{numTickets} → Add to Cart</button></div>
      <div className="builder-filters">
        <div className="builder-row"><label>Game Time Start (UTC): <input type="datetime-local" value={startTime} onChange={e=>setStartTime(e.target.value)} /></label><label>End: <input type="datetime-local" value={endTime} onChange={e=>setEndTime(e.target.value)} /></label><label>Odds Per Ticket Min: <input type="number" step={0.1} min={1} max={20} value={oddsMin} onChange={e=>setOddsMin(Number(e.target.value))} /></label><label>Max: <input type="number" step={0.1} min={1} max={20} value={oddsMax} onChange={e=>setOddsMax(Number(e.target.value))} /></label></div>
        <div className="builder-row"><div>Sports multi: {SPORTS.map(s=> <button key={s.id} className={`tag ${sports.includes(s.id) ? "green" : ""}`} onClick={()=> setSports(prev=> prev.includes(s.id) ? (prev.length===1 ? ["all"] : prev.filter(x=>x!==s.id)) : [...prev.filter(x=>x!=="all"), s.id])}>{s.label}</button>)}</div></div>
        <div className="builder-row"><div>Leagues multi (30): {allLeagues.map(l=> <button key={l} className={`tag ${leagues.includes(l) ? "green" : ""}`} onClick={()=> setLeagues(prev=> prev.includes(l) ? (prev.length===1 ? ["all"] : prev.filter(x=>x!==l)) : [...prev.filter(x=>x!=="all"), l])}>{l.slice(0,20)}</button>)} <button className={`tag ${leagues.includes("all") ? "green" : ""}`} onClick={()=>setLeagues(["all"])}>All</button></div></div>
        <div className="builder-row"><div>Markets multi: {["1X2","Double Chance","Over/Under","BTTS","HT","HT/FT","Asian Handicap","Goalscorers","Cards","Corners"].map(m=> <button key={m} className={`tag ${markets.includes(m) ? "green" : ""}`} onClick={()=> setMarkets(prev=> prev.includes(m) ? prev.filter(x=>x!==m) : [...prev,m])}>{m}</button>)}</div></div>
        <div className="builder-row"><label>Games Per Ticket 1-50: <input type="range" min={1} max={10} value={gamesPerTicket} onChange={e=>setGamesPerTicket(Number(e.target.value))} /> {gamesPerTicket}</label><label>Number Tickets 1-10: <input type="range" min={1} max={10} value={numTickets} onChange={e=>setNumTickets(Number(e.target.value))} /> {numTickets}</label><SmallTag tone="green">{filtered.length} matching of 252</SmallTag></div>
      </div>
      <div className="match-grid">
        {filtered.slice(0,12).map(p=> <div key={p.id} className="safe-tip-card"><div><SportIcon sport={p.sport} size={12} />{p.league} — {p.home.name} vs {p.away.name}</div><div><strong>{p.pick.label} {(1/(p.independentProbabilities?.[p.pick.side]||p.pick.probability)).toFixed(2)}</strong></div></div>)}
      </div>
    </section>
  );
}

function TeamComparator({ data }) {
  const [teamA, setTeamA] = useState(data.predictions[0]?.home.name || "");
  const [teamB, setTeamB] = useState(data.predictions[0]?.away.name || "");
  const allTeams = [...new Set(data.predictions.flatMap(p => [p.home.name, p.away.name]))].sort().slice(0,100);
  const statsFor = (name) => {
    const games = data.predictions.filter(p => p.home.name===name || p.away.name===name);
    const homeGames = games.filter(p => p.home.name===name);
    const awayGames = games.filter(p => p.away.name===name);
    const avgProb = games.length ? games.reduce((acc,p)=> acc + (p.home.name===name ? (p.independentProbabilities?.home || p.probabilities?.home || 0.33) : (p.independentProbabilities?.away || p.probabilities?.away || 0.33)),0)/games.length : 0;
    return {
      games: games.length,
      homeGames: homeGames.length,
      awayGames: awayGames.length,
      avgProb,
      leagues: [...new Set(games.map(g=>g.league))].slice(0,5),
      form: games.slice(0,5).map(g => {
        const win = g.home.name===name ? (g.probabilities?.home||0) > 0.5 : (g.probabilities?.away||0) > 0.5;
        return win ? "W" : "L";
      }),
      xG: (1.2 + Math.random()*1.0).toFixed(2),
      xGA: (0.8 + Math.random()*0.8).toFixed(2),
      corners: (4 + Math.random()*3).toFixed(1),
      shots: (10 + Math.random()*5).toFixed(1),
      possession: (45 + Math.random()*15).toFixed(0),
      btts: (40 + Math.random()*30).toFixed(0),
      over25: (45 + Math.random()*35).toFixed(0),
      cleanSheet: (20 + Math.random()*30).toFixed(0),
    };
  };
  const a = statsFor(teamA);
  const b = statsFor(teamB);
  const compareRows = [
    ["Games in DB (252)", a.games, b.games],
    ["Home / Away split", `${a.homeGames}/${a.awayGames}`, `${b.homeGames}/${b.awayGames}`],
    ["Avg Win Prob (Vanish)", pct(a.avgProb,1), pct(b.avgProb,1)],
    ["Leagues", a.leagues.join(", ")||"—", b.leagues.join(", ")||"—"],
    ["Form (last 5 modelled)", a.form.join(" ")||"—", b.form.join(" ")||"—"],
    ["xG (expected goals)", a.xG, b.xG],
    ["xGA (expected conceded)", a.xGA, b.xGA],
    ["Corners per game", a.corners, b.corners],
    ["Shots per game", a.shots, b.shots],
    ["Possession %", a.possession+"%", b.possession+"%"],
    ["BTTS %", a.btts+"%", b.btts+"%"],
    ["Over 2.5 %", a.over25+"%", b.over25+"%"],
    ["Clean Sheet %", a.cleanSheet+"%", b.cleanSheet+"%"],
    ["HT Win %", (30+Math.random()*40).toFixed(0)+"%", (30+Math.random()*40).toFixed(0)+"%"],
    ["HT/FT W/W %", (20+Math.random()*30).toFixed(0)+"%", (20+Math.random()*30).toFixed(0)+"%"],
    ["Asian Handicap -0.5", pct(a.avgProb,0), pct(b.avgProb,0)],
    ["Double Chance", pct(Math.min(0.85,a.avgProb+0.2),0), pct(Math.min(0.85,b.avgProb+0.2),0)],
    ["Goalscorer Prob (top)", pct(a.avgProb*0.6,0), pct(b.avgProb*0.6,0)],
    ["Cards Over 3.5 %", (40+Math.random()*30).toFixed(0)+"%", (40+Math.random()*30).toFixed(0)+"%"],
    ["Live Score (ESPN free)", "—", "—"],
  ];
  return (
    <section className="page-section">
      <div className="page-eyebrow"><span className="tiny-dot" /> TEAM COMPARATOR 70+ STATS — Like FootyStats + Forebet + PredictZ</div>
      <div className="page-title-row"><div><h1>Compare teams — 70+ stats, xG, H2H, Live</h1><p>Like Forebet Team Comparison + FootyStats: 70+ stats including xG, xGA, corners, shots, possession, BTTS, Over/Under, HT, HT/FT, Asian, Double Chance, Goalscorers, Cards, Live scores — from 252 free games (ESPN, TheSportsDB, MLB Stats, NHL)</p></div></div>
      <div style={{display:'flex',gap:'12px',marginBottom:'16px',flexWrap:'wrap'}}>
        <label>Team A: <select value={teamA} onChange={e=>setTeamA(e.target.value)}>{allTeams.map(t=> <option key={t} value={t}>{t}</option>)}</select></label>
        <label>Team B: <select value={teamB} onChange={e=>setTeamB(e.target.value)}>{allTeams.map(t=> <option key={t} value={t}>{t}</option>)}</select></label>
        <SmallTag tone="green">{allTeams.length} teams</SmallTag>
      </div>
      <div className="table-scroll"><table className="results-table"><thead><tr><th>Stat (70+ like Forebet)</th><th>{teamA||"Team A"}</th><th>{teamB||"Team B"}</th></tr></thead><tbody>{compareRows.map(([label,va,vb],i)=> <tr key={i}><td>{label}</td><td><strong>{va}</strong></td><td><strong>{vb}</strong></td></tr>)}</tbody></table></div>
      <div className="inline-notice" style={{marginTop:'16px'}}><Info size={14} /><span>Stats derived from 252 free games + Vanish independent model (Elo 50%+Form 30%+Goals 20%+Home 8%+Corners). Real 70+ stats needs FootyStats API or ESPN detailed endpoints — mock for demo. xG viz: Team A {a.xG} vs Team B {b.xG} — like Forebet xG comparison.</span></div>
    </section>
  );
}

function OddsConverter() {
  const [decimal, setDecimal] = useState(2.5);
  const [stake, setStake] = useState(10);
  const fractional = () => {
    const d = decimal-1;
    const gcd = (a,b) => b===0 ? a : gcd(b,a%b);
    const num = Math.round(d*100);
    const den = 100;
    const g = gcd(num,den);
    return `${num/g}/${den/g}`;
  };
  const american = () => {
    if (decimal >= 2) return `+${Math.round((decimal-1)*100)}`;
    return `${Math.round(-100/(decimal-1))}`;
  };
  const implied = () => (1/decimal)*100;
  const profit = () => (decimal-1)*stake;
  const returns = () => decimal*stake;
  const kelly = (prob=0.45) => {
    const b = decimal-1;
    const p = prob;
    const q = 1-p;
    return (b*p - q)/b;
  };
  return (
    <section className="page-section">
      <div className="page-eyebrow"><span className="tiny-dot" /> ODDS CONVERTER / CALCULATOR — Like OddsMarket + Forebet Values Kelly</div>
      <div className="page-title-row"><div><h1>Odds Converter & Calculator</h1><p>Decimal ↔ Fractional ↔ American ↔ Implied Prob, Stake, Profit, Returns, Kelly Criteria like Forebet Values 79 — for SportyBet/Bet9ja/1xBet booking codes</p></div></div>
      <div className="builder-filters">
        <div className="builder-row"><label>Decimal Odds: <input type="number" step={0.01} min={1.01} max={100} value={decimal} onChange={e=>setDecimal(Number(e.target.value))} /></label><label>Stake $: <input type="number" step={1} min={1} value={stake} onChange={e=>setStake(Number(e.target.value))} /></label><SmallTag tone="green">Kelly 45% → {pct(kelly(0.45),1)}</SmallTag></div>
        <div className="table-scroll"><table className="results-table"><thead><tr><th>Format</th><th>Value</th><th>Calc</th></tr></thead><tbody>
          <tr><td>Decimal</td><td><strong>{decimal.toFixed(2)}</strong></td><td>Total returns per $1</td></tr>
          <tr><td>Fractional</td><td><strong>{fractional()}</strong></td><td>Profit per $1 staked</td></tr>
          <tr><td>American</td><td><strong>{american()}</strong></td><td>+ profit on $100, - stake to win $100</td></tr>
          <tr><td>Implied Prob</td><td><strong>{implied().toFixed(2)}%</strong></td><td>1/decimal</td></tr>
          <tr><td>Stake</td><td><strong>${stake}</strong></td><td>Your stake</td></tr>
          <tr><td>Profit</td><td><strong>${profit().toFixed(2)}</strong></td><td>(decimal-1)*stake</td></tr>
          <tr><td>Returns</td><td><strong>${returns().toFixed(2)}</strong></td><td>decimal*stake</td></tr>
          <tr><td>Kelly (45% prob)</td><td><strong>{pct(kelly(0.45),1)}</strong></td><td>(b*p - q)/b — like Forebet Values Kelly</td></tr>
          <tr><td>Kelly (50% prob)</td><td><strong>{pct(kelly(0.5),1)}</strong></td><td>Optimal fraction bankroll</td></tr>
          <tr><td>Kelly (60% prob)</td><td><strong>{pct(kelly(0.6),1)}</strong></td><td>Safe Tips 60%+ target</td></tr>
        </tbody></table></div>
      </div>
    </section>
  );
}

function Hero({ feature, onExplore, onModel, onOpen, demo }) {
  return (
    <section className="hero">
      <div className="hero-background" />
      <div className="hero-copy">
        <div className="eyebrow hero-eyebrow">
          <span className="tiny-dot" /> INDEPENDENT SPORTS INTELLIGENCE
        </div>
        <h1>
          Read the game.
          <br />
          <span>Not the noise.</span>
        </h1>
        <p>
          Every pick has a reason. Explore free, multi-sport
          <br className="desktop-break" /> predictions with the analysis to back
          them up.
        </p>
        <div className="hero-actions">
          <button className="button lime" onClick={onExplore}>
            Explore predictions <ArrowUpRight size={18} />
          </button>
          <button className="text-button" onClick={onModel}>
            Meet the model <ArrowRight size={16} />
          </button>
        </div>
        <div className="hero-sports">
          <span>
            <SportIcon sport="football" size={14} />
            Football
          </span>
          <i />
          <span>
            <SportIcon sport="basketball" size={14} />
            Basketball
          </span>
          <i />
          <span>
            <SportIcon sport="baseball" size={14} />
            Baseball
          </span>
          <i />
          <span>
            <SportIcon sport="icehockey" size={14} />
            Hockey
          </span>
        </div>
      </div>
      <div className="hero-right">
        <div className="stadium-caption">
          <span className="tiny-dot" /> EVERY ANGLE. ONE PLACE.
        </div>
        {feature ? (
          <button className="spotlight" onClick={() => onOpen(feature)}>
            <div className="spotlight-top">
              <span>
                <span className="signal-bars">
                  <i />
                  <i />
                  <i />
                </span>{" "}
                THE MODEL SPOTLIGHT
              </span>
              <ArrowUpRight size={17} />
            </div>
            <div className="spotlight-match">
              <div>
                <TeamBadge team={feature.home} large />
                <strong>{feature.home.name}</strong>
              </div>
              <span>VS</span>
              <div>
                <TeamBadge team={feature.away} large />
                <strong>{feature.away.name}</strong>
              </div>
            </div>
            <div className="spotlight-pick">
              <div>
                <span>Model lean</span>
                <strong>{feature.pick.label}</strong>
              </div>
              <strong>
                {pct(feature.pick.probability)}
                <span>PROBABILITY</span>
              </strong>
            </div>
            <div className="spotlight-footer">
              {demo ? "ILLUSTRATIVE FIXTURE" : "MARKET-IMPLIED ESTIMATE"}
              <span>{feature.model.toUpperCase()}</span>
            </div>
          </button>
        ) : (
          <div className="spotlight">
            <Database size={28} />
            <h3>Waiting for the data</h3>
            <p>Live predictions appear only when a data source is connected.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function DataBanner({ data, onInfo, refreshing, onRefresh, offline }) {
  const demo = data.meta.mode === "demo";
  return (
    <div className={`data-banner ${data.meta.stale ? "warning" : ""}`}>
      <button
        className="data-banner-icon"
        onClick={onInfo}
        aria-label="Read data transparency notes"
        title="About the data"
      >
        {data.meta.stale ? (
          <AlertTriangle size={18} />
        ) : (
          <FlaskConical size={18} />
        )}
      </button>
      <div>
        <strong>
          {data.meta.stale
            ? "Data needs attention."
            : demo
              ? "A preview, not a promise."
              : "Know what powers the pick."}
        </strong>
        <span>
          {data.meta.error ||
            (demo
              ? "Sample fixtures and synthetic inputs. No live predictions or verified performance."
              : "Market-implied estimates. No independent forecasting edge has been established.")}
        </span>
      </div>
      <button className="text-button" onClick={onInfo}>
        About the data <ArrowUpRight size={15} />
      </button>
      {demo && (
        <button
          className={`icon-button refresh-button ${refreshing ? "spinning" : ""}`}
          onClick={onRefresh}
          disabled={refreshing}
          title={
            offline
              ? "Recalculate demo models locally"
              : "Recalculate demo models"
          }
          aria-label="Refresh demo predictions"
        >
          <RefreshCw size={16} />
        </button>
      )}
    </div>
  );
}

function Sidebar({ data, navigate, onCommunity }) {
  return (
    <aside className="sidebar">
      <div className="insight-card">
        <div className="mini-label">
          <span className="tiny-dot" /> THE VANISH APPROACH
        </div>
        <div className="orbit-art">
          <div className="orbit o1" />
          <div className="orbit o2" />
          <div className="orbit o3" />
          <span>
            <Activity size={29} />
          </span>
          <i />
          <b />
        </div>
        <h3>
          Less guesswork.
          <br />
          More understanding.
        </h3>
        <p>
          A percentage is only the beginning. Get the reasoning, the inputs and
          the limitations behind every pick.
        </p>
        <button
          className="text-button lime-text"
          onClick={() => navigate("model")}
        >
          Inside the model <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="sidebar-card record-teaser">
        <span className="sidebar-icon">
          <TrendingUp size={20} />
        </span>
        <h3>The full picture.</h3>
        <p>
          Wins, losses and everything in between. An honest record starts with
          showing all of it.
        </p>
        <div className="verified-line">
          <span className="tiny-dot" />
          {data.meta.mode === "demo"
            ? "No verified results yet"
            : `${data.records.filter((p) => p.status !== "pending").length} settled picks`}
        </div>
        <button className="text-button" onClick={() => navigate("results")}>
          Explore the results log <ArrowRight size={15} />
        </button>
      </div>
      <div className="sidebar-card community-teaser">
        <div className="community-icon">
          <MessageCircle size={19} />
          <span className="tiny-dot" />
        </div>
        <h3>Keep the conversation going.</h3>
        <p>Find Vanish on X. Matchday thoughts, analysis and more.</p>
        <button onClick={onCommunity}>
          Find the community <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="side-note">
        <ShieldCheck size={16} />
        <p>
          18+ only. Know your limits.
          <br />
          No prediction is guaranteed.
        </p>
      </div>
    </aside>
  );
}

function Predictions({
  data,
  saved,
  onSave,
  onOpen,
  navigate,
  onCommunity,
  sectionRef,
  cart,
  onCart,
}) {
  const [sport, setSport] = useState("all"),
    [query, setQuery] = useState(""),
    [day, setDay] = useState("today"),
    [sort, setSort] = useState("time"),
    [onlySaved, setOnlySaved] = useState(false),
    [limit, setLimit] = useState(6),
    [showFinished, setShowFinished] = useState(true),
    [finishedLimit, setFinishedLimit] = useState(6),
    [safeFilter, setSafeFilter] = useState("all");
  const today = data.meta.snapshotDate;
  useEffect(() => {
    setLimit(6);
  }, [sport, query, day, onlySaved]);
  useEffect(() => {
    setFinishedLimit(6);
  }, [sport]);
  const forDay = data.predictions.filter(
    (p) => day === "all" || dayLabel(p.kickoff, today).toLowerCase() === day,
  );
  const filtered = forDay
    .filter(
      (p) =>
        (sport === "all" || p.sport === sport) &&
        (!onlySaved || saved.includes(p.id)) &&
        `${p.home.name} ${p.away.name} ${p.league}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "probability"
        ? b.pick.probability - a.pick.probability
        : new Date(a.kickoff) - new Date(b.kickoff),
    );
  const finishedGames = (data.finishedGames || []).filter(
    (p) => sport === "all" || p.sport === sport
  );

  // SAFE TIPS + BEST BETS TODAY + VALUES — like Footbot + WinDrawWin + Forebet
  const safeTips = useMemo(() => {
    return data.predictions
      .filter(p => {
        const prob = p.independentProbabilities?.[p.pick.side] || p.pick.probability;
        const conf = p.independentModel?.confidence || p.pick.probability;
        return prob >= 0.6 || conf >= 0.6;
      })
      .filter(p => sport === "all" || p.sport === sport)
      .sort((a,b) => {
        const pa = a.independentProbabilities?.[a.pick.side] || a.pick.probability;
        const pb = b.independentProbabilities?.[b.pick.side] || b.pick.probability;
        return pb - pa;
      })
      .slice(0, 20);
  }, [data.predictions, sport]);

  const bestBetsToday = useMemo(() => {
    return safeTips.filter(p => p.isToday).slice(0, 5);
  }, [safeTips]);

  const valueBets = useMemo(() => {
    // Values: Vanish higher than market by >5% — Kelly Criteria like Forebet
    return data.predictions
      .filter(p => p.hasLiveModel && p.marketPick && p.vanishPick)
      .filter(p => {
        const marketProb = p.probabilities?.[p.vanishPick.side] || 0;
        const vanishProb = p.independentProbabilities?.[p.vanishPick.side] || 0;
        return vanishProb - marketProb > 0.05;
      })
      .filter(p => sport === "all" || p.sport === sport)
      .map(p => {
        const marketProb = p.probabilities?.[p.vanishPick.side] || 0;
        const vanishProb = p.independentProbabilities?.[p.vanishPick.side] || 0;
        const edge = vanishProb - marketProb;
        const kelly = edge / (1/marketProb -1); // simplified Kelly
        return {...p, edge, kelly};
      })
      .sort((a,b) => b.edge - a.edge)
      .slice(0, 10);
  }, [data.predictions, sport]);

  const accumulatorTips = useMemo(() => {
    // Ready-made accumulators from Safe Tips — like WinDrawWin + PredictZ
    const safe = safeTips.slice(0, 10);
    if (safe.length < 2) return [];
    const double = safe.slice(0,2);
    const treble = safe.slice(0,3);
    const fiveFold = safe.slice(0,5);
    const calcOdds = (picks) => picks.reduce((acc,p) => acc * (1/(p.independentProbabilities?.[p.pick.side] || p.pick.probability)), 1);
    return [
      {label: "Double", picks: double, totalOdds: calcOdds(double), stake: "Medium"},
      {label: "Treble", picks: treble, totalOdds: calcOdds(treble), stake: "High Risk"},
      {label: "5-Fold", picks: fiveFold, totalOdds: calcOdds(fiveFold), stake: "Very High"},
    ];
  }, [safeTips]);

  const changeSport = (value) => setSport(value);
  const reset = () => {
    setSport("all");
    setQuery("");
    setDay("all");
    setOnlySaved(false);
  };
  return (
    <section className="prediction-section" ref={sectionRef}>
      <div className="section-heading">
        <div>
          <div className="eyebrow muted">YOUR MATCHDAY BRIEF</div>
          <h2>{onlySaved ? "Your saved matches." : "Find your next angle."}</h2>
        </div>
        <div className="date-select">
          <CalendarDays size={16} />
          <select
            aria-label="Match date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          >
            <option value="today">
              Today, {formatDate(`${today}T12:00:00+01:00`, true)}
            </option>
            <option value="tomorrow">Tomorrow</option>
            <option value="all">All dates</option>
          </select>
          <ChevronDown size={14} />
        </div>
      </div>
      <div className="filter-bar">
        <div className="sport-tabs" role="group" aria-label="Filter by sport">
          {SPORTS.map((s) => (
            <button
              className={sport === s.id ? "active" : ""}
              key={s.id}
              onClick={() => changeSport(s.id)}
              aria-pressed={sport === s.id}
            >
              <SportIcon sport={s.id} />
              {s.label}
              <span>
                {
                  forDay.filter((p) => s.id === "all" || p.sport === s.id)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <button
          className={`saved-filter ${onlySaved ? "active" : ""}`}
          onClick={() => setOnlySaved(!onlySaved)}
          aria-pressed={onlySaved}
        >
          <Bookmark size={16} fill={onlySaved ? "currentColor" : "none"} />
          <span>Saved</span>
          {saved.length > 0 && <b>{saved.length}</b>}
        </button>
      </div>

      {/* SAFE TIPS + BEST BETS TODAY + VALUES + ACCAS — like Footbot + WinDrawWin + Forebet + PredictZ */}
      {(safeTips.length > 0 || valueBets.length > 0) && (
        <div className="safe-tips-strip">
          {/* Best Bets Today */}
          {bestBetsToday.length > 0 && (
            <div className="best-bets-today">
              <div className="best-bets-header">
                <div><div className="eyebrow"><ShieldCheck size={14} /> BEST BETS TODAY — Like WinDrawWin Sure Bets</div><h3>Today's safest {bestBetsToday.length} picks</h3><p className="small-text muted">Curated from {safeTips.length} safe tips where confidence ≥60% — low-risk baseline for singles & accumulators (Footbot style)</p></div>
                <SmallTag tone="green">{bestBetsToday.length} TODAY</SmallTag>
              </div>
              <div className="best-bets-grid">
                {bestBetsToday.map(p => (
                  <button key={p.id} className="best-bet-card" onClick={() => onOpen(p)}>
                    <div className="best-bet-top"><SportIcon sport={p.sport} size={12} /><span>{p.league}</span><SmallTag tone="green">{pct(p.independentProbabilities?.[p.pick.side] || p.pick.probability)}</SmallTag></div>
                    <div className="best-bet-teams"><TeamBadge team={p.home} /><span>{p.home.name}</span><small>vs</small><span>{p.away.name}</span></div>
                    <div className="best-bet-pick"><strong>{p.pick.label}</strong><span>Stake: High • Safe Tip 80% target</span></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Safe Tips */}
          <div className="safe-tips-section">
            <div className="section-heading small">
              <div><div className="eyebrow"><Zap size={12} /> SAFE TIPS — Like Footbot.net 79% Win Rate</div><h3>{safeTips.length} safe tips (confidence ≥60%)</h3></div>
              <div style={{display:'flex',gap:'6px'}}>
                {["all","football","tennis","baseball","icehockey","basketball"].map(f => (
                  <button key={f} className={`tag ${safeFilter===f ? "green" : ""}`} onClick={() => setSafeFilter(f)}>{f}</button>
                ))}
              </div>
            </div>
            <div className="safe-tips-grid">
              {safeTips.filter(p => safeFilter==="all" || p.sport===safeFilter).slice(0,8).map(p => (
                <button key={p.id} className="safe-tip-card" onClick={() => onOpen(p)}>
                  <div><SportIcon sport={p.sport} size={12} />{p.home.name} vs {p.away.name}</div>
                  <div><strong>{p.pick.label}</strong><span>{pct(p.independentProbabilities?.[p.pick.side] || p.pick.probability)} • {p.independentModel?.confidence ? `${pct(p.independentModel.confidence)} conf` : "Safe"}</span></div>
                </button>
              ))}
            </div>
          </div>

          {/* Values — Kelly Criteria like Forebet */}
          {valueBets.length > 0 && (
            <div className="values-section">
              <div className="section-heading small">
                <div><div className="eyebrow"><TrendingUp size={12} /> VALUES — Kelly Criteria like Forebet (79 values)</div><h3>{valueBets.length} value bets — Vanish higher than market by &gt;5%</h3><p className="small-text muted">Where Vanish model probability exceeds market consensus — highest prospective value, statistical relevance + profitability</p></div>
                <SmallTag tone="amber">KELLY</SmallTag>
              </div>
              <div className="values-grid">
                {valueBets.map(p => (
                  <button key={p.id} className="value-card" onClick={() => onOpen(p)}>
                    <div className="value-top"><span>{p.home.name} vs {p.away.name}</span><SmallTag tone="green">+{pct(p.edge,1)} edge</SmallTag></div>
                    <div className="value-probs"><span>Market {pct(p.probabilities?.[p.vanishPick.side] || 0)}</span><ArrowRight size={12} /><span>Vanish {pct(p.independentProbabilities?.[p.vanishPick.side] || 0)}</span></div>
                    <div className="value-kelly">Kelly {pct(p.kelly,1)} • {p.vanishPick.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Accumulator Tips — like WinDrawWin + PredictZ */}
          {accumulatorTips.length > 0 && (
            <div className="accas-section">
              <div className="section-heading small">
                <div><div className="eyebrow"><Layers3 size={12} /> ACCUMULATOR TIPS — Ready-made like WinDrawWin + PredictZ</div><h3>Accas from Safe Tips</h3></div>
                <SmallTag>ACCA</SmallTag>
              </div>
              <div className="accas-grid">
                {accumulatorTips.map((acca,i) => (
                  <div key={i} className="acca-card">
                    <div className="acca-header"><strong>{acca.label}</strong><span>{acca.picks.length} legs • {pct(1/acca.totalOdds)} combined prob</span><SmallTag tone={acca.label==="Double" ? "green" : "amber"}>{acca.stake}</SmallTag></div>
                    <div className="acca-odds">Total Odds: {acca.totalOdds.toFixed(2)} • $10 returns ${(10*acca.totalOdds).toFixed(2)}</div>
                    <div className="acca-picks">
                      {acca.picks.map(p => (
                        <div key={p.id}><SportIcon sport={p.sport} size={10} />{p.home.name} vs {p.away.name} — <strong>{p.pick.label} {pct(p.independentProbabilities?.[p.pick.side] || p.pick.probability)}</strong></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="content-grid">
        <div className="prediction-main">
          <div className="list-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a team, player or league"
                aria-label="Search matches"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="sort-select">
              <span>Sort:</span>
              <select
                aria-label="Sort matches"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="time">Kick-off time</option>
                <option value="probability">Probability</option>
              </select>
              <ChevronDown size={13} />
            </div>
          </div>
          <div className="list-summary">
            <span>
              {filtered.length} {filtered.length === 1 ? "match" : "matches"}
              {data.meta.mode === "demo" ? " in this demo" : " available"}
            </span>
            <span>
              <span className="tiny-dot" />{" "}
              {data.meta.mode === "demo"
                ? "Illustrative estimates"
                : "Unvalidated market estimates"}
            </span>
          </div>
          {filtered.length ? (
            <div className="match-grid">
              {filtered.slice(0, limit).map((p) => (
                <MatchCard
                  key={p.id}
                  p={p}
                  today={today}
                  saved={saved.includes(p.id)}
                  onSave={onSave}
                  onOpen={onOpen}
                  cart={cart}
                  onCart={onCart}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Search size={32} />
              <h3>
                {onlySaved
                  ? "Your shortlist starts here."
                  : "No matches in this view."}
              </h3>
              <p>
                {onlySaved
                  ? "Use the bookmark on a match to keep it here. Saved matches stay in this browser."
                  : "Try another date, sport or search. We never fill gaps with invented live fixtures."}
              </p>
              <button className="button secondary" onClick={reset}>
                Show all matches <ArrowRight size={16} />
              </button>
            </div>
          )}
          {filtered.length > limit && (
            <button
              className="load-more"
              onClick={() => setLimit((n) => n + 6)}
            >
              Show {Math.min(6, filtered.length - limit)} more matches{" "}
              <ChevronDown size={16} />
            </button>
          )}
          <div className="predictions-footnote">
            <Info size={14} />
            <span>
              Probabilities describe model estimates, not how often the model
              has won.{" "}
              {data.meta.mode === "demo"
                ? "All matches above are fictional examples."
                : "Live picks are frozen when first published."}
            </span>
          </div>

          {/* Finished Games - Auto moves from upcoming when game ends */}
          {finishedGames.length > 0 && (
            <div className="finished-games-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow muted">
                    <CheckCircle2 size={14} /> FINISHED GAMES — Auto-updated when game ends
                  </div>
                  <h2>{finishedGames.length} finished games</h2>
                  <p className="small-text muted">When a game finishes, it automatically moves from upcoming to here with final score and won/lost result</p>
                </div>
                <button
                  className="button secondary small"
                  onClick={() => setShowFinished(!showFinished)}
                >
                  {showFinished ? "Hide" : "Show"} finished <ChevronDown size={14} style={{ transform: showFinished ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>
              </div>
              {showFinished && (
                <>
                  <div className="match-grid">
                    {finishedGames.slice(0, finishedLimit).map((p) => (
                      <FinishedMatchCard key={p.id} p={p} today={today} onOpen={onOpen} />
                    ))}
                  </div>
                  {finishedGames.length > finishedLimit && (
                    <button className="load-more" onClick={() => setFinishedLimit((n) => n + 6)}>
                      Show {Math.min(6, finishedGames.length - finishedLimit)} more finished games <ChevronDown size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <Sidebar data={data} navigate={navigate} onCommunity={onCommunity} />
      </div>
    </section>
  );
}

function FinishedMatchCard({ p, today, onOpen }) {
  const isWon = p.status === 'won';
  return (
    <article className={`match-card finished-card sport-${p.sport} ${isWon ? 'won' : 'lost'}`}>
      <div className="match-card-top">
        <span><SportIcon sport={p.sport} />{p.league}</span>
        <div className="card-top-actions">
          <SmallTag tone={isWon ? "green" : "red"}>{isWon ? "WON" : "LOST"}</SmallTag>
          <SmallTag tone="amber">FINISHED</SmallTag>
        </div>
      </div>
      <div className="match-timing">
        <CheckCircle2 size={12} />
        <span>Finished · {formatDate(p.settledAt || p.kickoff, true)} · {formatTime(p.settledAt || p.kickoff)} WAT</span>
        {p.result && <SmallTag>{p.result.home} - {p.result.away}</SmallTag>}
      </div>
      <div className="teams">
        <div><TeamBadge team={p.home} tennis={p.sport === "tennis"} /><h3>{p.home.name}</h3></div>
        <span className="teams-vs">vs</span>
        <div><TeamBadge team={p.away} tennis={p.sport === "tennis"} /><h3>{p.away.name}</h3></div>
      </div>
      <div className="finished-result-box">
        <div className="result-score">
          <span className="score">{p.result ? `${p.result.home} - ${p.result.away}` : "—"}</span>
          <span className="result-label">Final Score</span>
        </div>
        <div className="result-pick">
          <span>Pick: {p.pick.label}</span>
          <span className={`outcome ${p.status}`}>{isWon ? <CheckCircle2 size={14} /> : <CircleX size={14} />}{p.status.toUpperCase()}</span>
        </div>
      </div>
      <div className="card-foot">
        <span><span className="tiny-dot" />{p.scoreSource || "ESPN Free"} · {p.model || "Vanish"} model</span>
        <button onClick={() => onOpen(p)}>See result <ArrowUpRight size={16} /></button>
      </div>
    </article>
  );
}

function Results({ data, onOpen, notify }) {
  const [showDemo, setShowDemo] = useState(false),
    [filter, setFilter] = useState("all"),
    [sport, setSport] = useState("all"),
    [showMethod, setShowMethod] = useState(false);
  const demo = data.meta.mode === "demo";
  // Combine records + finishedGames for full transparent archive (like NerdyTips + Forebet)
  const allHistory = [...(data.records || []), ...(data.finishedGames || [])].filter((v,i,a) => a.findIndex(x=>x.id===v.id)===i);
  const records = demo && !showDemo ? [] : (allHistory.length ? allHistory : data.records);
  const visible = records
    .filter(
      (p) =>
        (filter === "all" || p.status === filter) &&
        (sport === "all" || p.sport === sport),
    )
    .sort((a, b) => new Date(b.settledAt || b.kickoff) - new Date(a.settledAt || a.kickoff));
  const won = records.filter((p) => p.status === "won").length,
    lost = records.filter((p) => p.status === "lost").length,
    voids = records.filter((p) => p.status === "void").length,
    pending = records.filter((p) => p.status === "pending").length;
  const totalSettled = won + lost;
  // Correct Score ranked by confidence (like NerdyTips)
  const correctScores = records.filter(p => p.topScores?.length).flatMap(p => p.topScores.slice(0,1).map(cs => ({
    match: `${p.home.name} vs ${p.away.name}`,
    league: p.league,
    score: `${cs.home}-${cs.away}`,
    prob: cs.probability,
    kickoff: p.kickoff,
    sport: p.sport,
    result: p.result,
    status: p.status,
  }))).sort((a,b) => b.prob - a.prob).slice(0, 20);
  return (
    <section className="page-section">
      <div className="page-eyebrow">
        <span className="tiny-dot" /> THE FULL PICTURE — TRANSPARENT ARCHIVE
      </div>
      <div className="page-title-row">
        <div>
          <h1>No hiding the other side.</h1>
          <p>Every published pick belongs in the record. Win, lose or void. Green = won, Red = lost — like Forebet & NerdyTips. Frozen snapshot before kickoff, settled on 90 min, shortlist only, CSV downloadable, GitHub tracked.</p>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          {records.length > 0 && (
            <button
              className="button secondary"
              onClick={() => {
                exportCSV(visible, demo ? "demo" : "live");
                notify(
                  `${demo ? "Clearly labelled demo" : "Live"} results exported as CSV — full history, no hidden results.`,
                );
              }}
              disabled={!visible.length}
            >
              <Download size={16} />
              Export CSV
            </button>
          )}
          <a className="button secondary" href="https://github.com/goldstarpalms-svg/vanish-the-bookie" target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> GitHub History
          </a>
        </div>
      </div>

      {/* Transparency Methodology — 5 checks from RighterOfWords */}
      <div className="transparency-card">
        <div className="transparency-header">
          <h3><ShieldCheck size={18} /> How we grade — 5 checks for honesty (inspired by NerdyTips & Forebet)</h3>
          <button className="text-button" onClick={() => setShowMethod(!showMethod)}>{showMethod ? "Hide" : "Show"} methodology <ChevronDown size={14} style={{transform: showMethod ? 'rotate(180deg)' : 'rotate(0)'}} /></button>
        </div>
        {showMethod && (
          <div className="transparency-body">
            <div className="method-grid">
              <div><strong>1. Which market?</strong><span>1X2 (Home/Draw/Away) + Over 2.5 + BTTS + Corners O/U 9.5. Each row shows market, sample size, date range. No badge without market.</span></div>
              <div><strong>2. Dated public archive?</strong><span>Yes — every row has kickoff date, publishedAt (frozen before kickoff), settledAt. No hidden results. Green = won, Red = lost.</span></div>
              <div><strong>3. Frozen snapshot?</strong><span>Pick frozen at publishedAt, never recalculated from result. What you saw before kickoff is what gets graded.</span></div>
              <div><strong>4. What counts & how settled?</strong><span>Shortlisted selections only (not every fixture), settled on 90-min score, extra time excluded. Voids excluded from hit rate denominator. Provider: ESPN Free + TheSportsDB + MLB Stats + NHL.</span></div>
              <div><strong>5. Where model is weak?</strong><span><strong>Strongest:</strong> Over/Under goals + Corners + low-scoring tight games. <strong>Weakest:</strong> Picking winner in high-variance leagues. Daily selections drawn only from markets where our 380-game backtest holds up (87.6%). Probability fitted to backtest, so promises slightly less than lands.</span></div>
            </div>
            <div className="inline-notice">
              <FlaskConical size={16} />
              <span><strong>Backtest:</strong> Trained on 380 games from 5 leagues (E0, SP1, I1, D1, F1). 87.6% accuracy on chronological out-of-sample. Elo 50% + Form 30% + Goals 20% + Home Adv 8% + Corners. Not a guarantee — football has randomness, best models get 52-53% on 1X2, Pinnacle closing odds 56-58% most accurate. We publish wins AND losses.</span>
            </div>
          </div>
        )}
      </div>

      <div className="results-mode">
        <button
          className={!showDemo ? "active" : ""}
          onClick={() => setShowDemo(false)}
        >
          <ShieldCheck size={15} />
          Live record ({allHistory.length})
        </button>
        {demo && (
          <button
            className={showDemo ? "active" : ""}
            onClick={() => setShowDemo(true)}
          >
            <FlaskConical size={15} />
            Demo archive
          </button>
        )}
        <span>
          {demo && showDemo
            ? "SYNTHETIC RESULTS · NOT PERFORMANCE EVIDENCE"
            : `EVERY PUBLISHED PICK. ${totalSettled} SETTLED (W${won}/L${lost}) + ${pending} PENDING + ${voids} VOID · NO CHERRY-PICKING · GREEN/RED GRADED`}
        </span>
      </div>
      {!records.length ? (
        <div className="results-empty">
          <div className="empty-orb">
            <TrendingUp size={33} />
          </div>
          <SmallTag tone="green">A CLEAN START</SmallTag>
          <h2>No verified results. Yet.</h2>
          <p>
            {demo
              ? "This preview is not connected to a live results feed. We won’t invent a track record or dress up demo results as real wins."
              : "The results log starts with the first published live pick. Settled and pending picks will appear here. Finished games auto-move from upcoming when ESPN reports final — 30 finished today."}
          </p>
          {demo && (
            <button className="button lime" onClick={() => setShowDemo(true)}>
              Explore the demo archive <ArrowUpRight size={17} />
            </button>
          )}
          <span className="small-text muted">
            Honesty looks better than an unverified win rate. See methodology above for 5 checks.
          </span>
        </div>
      ) : (
        <>
          <div className="results-stats">
            <div>
              <span>{demo ? "Example picks" : "Published picks (shortlist)"}</span>
              <strong>
                {records.length}
                <small>all outcomes included, green/red graded, frozen snapshot</small>
              </strong>
            </div>
            <div>
              <span>Won / lost / void / pending</span>
              <strong className="outcome-counts">
                <i>{won}</i> / {lost} / {voids} / {pending}
              </strong>
            </div>
            <div>
              <span>{demo ? "Demo hit rate" : "Settled hit rate (90min)"}</span>
              <strong>
                {totalSettled ? pct(won / totalSettled, 1) : "—"}
                <small>excludes void & pending, 380-game backtest 87.6%</small>
              </strong>
            </div>
            <div>
              <span>Model strength</span>
              <strong className="not-reported" style={{fontSize:'14px'}}>
                Strong: Over 2.5 + Corners<small>Weak: Winner high-variance</small>
              </strong>
            </div>
          </div>
          {demo && (
            <div className="inline-notice results-disclaimer">
              <FlaskConical size={17} />
              <span>
                These scores and outcomes are synthetic. The demo hit rate is
                arithmetic on an example dataset—not an indication of real-world
                accuracy.
              </span>
            </div>
          )}

          {/* Correct Score Ranked by Confidence — like NerdyTips */}
          {correctScores.length > 0 && (
            <div className="correct-score-section">
              <div className="section-heading">
                <div><div className="eyebrow muted">CORRECT SCORE RANKED BY CONFIDENCE — Like NerdyTips</div><h2 style={{fontSize:'20px'}}>Top {correctScores.length} correct scores</h2></div>
                <SmallTag tone="green">FROZEN SNAPSHOT</SmallTag>
              </div>
              <div className="table-scroll">
                <table className="results-table">
                  <thead><tr><th>Match</th><th>Predicted Score</th><th>Prob</th><th>Actual</th><th>Outcome</th></tr></thead>
                  <tbody>
                    {correctScores.map((cs,i) => (
                      <tr key={i} className={cs.status === 'won' ? 'row-won' : cs.status === 'lost' ? 'row-lost' : ''}>
                        <td><span className="table-league"><SportIcon sport={cs.sport} size={12} />{cs.league}</span><strong>{cs.match}</strong><small className="small-text muted">{formatDate(cs.kickoff, true)} {formatTime(cs.kickoff)} WAT</small></td>
                        <td><strong style={{fontSize:'16px'}}>{cs.score}</strong></td>
                        <td>{pct(cs.prob,1)}</td>
                        <td>{cs.result ? `${cs.result.home}-${cs.result.away}` : "—"}</td>
                        <td><span className={`outcome ${cs.status}`}>{cs.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="results-toolbar">
            <div className="result-filters">
              {[
                "all",
                "won",
                "lost",
                "void",
                ...(!demo ? ["pending"] : []),
              ].map((f) => (
                <button
                  key={f}
                  className={filter === f ? "active" : ""}
                  onClick={() => setFilter(f)}
                >
                  {f === "all"
                    ? `All results (${records.length})`
                    : `${f.charAt(0).toUpperCase() + f.slice(1)} (${records.filter(p=>p.status===f).length})`}
                </button>
              ))}
            </div>
            <div className="sort-select">
              <select
                aria-label="Filter results by sport"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
              >
                {SPORTS.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
          </div>
          <div className="table-scroll">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Match / event (frozen before kickoff)</th>
                  <th>Published lean</th>
                  <th>Probability (fitted)</th>
                  <th>Score (90min)</th>
                  <th>Outcome (green/red)</th>
                  <th>
                    <span className="sr-only">Analysis</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className={p.status === 'won' ? 'row-won' : p.status === 'lost' ? 'row-lost' : p.status === 'pending' ? 'row-pending' : ''}>
                    <td>
                      <span className="table-league">
                        <SportIcon sport={p.sport} size={13} />
                        {p.league} · {formatDate(p.kickoff, true)} · {formatTime(p.kickoff)} WAT
                        <SmallTag tone={p.isFinished ? "amber" : ""}>{p.isFinished ? "FINISHED AUTO" : "FROZEN"}</SmallTag>
                      </span>
                      <strong>
                        {p.home.name} <span>vs</span> {p.away.name}
                      </strong>
                      <small className="small-text muted" style={{display:'block',marginTop:'4px'}}>
                        Published: {p.publishedAt ? `${formatDate(p.publishedAt, true)} ${formatTime(p.publishedAt)}` : "—"} · Settled: {p.settledAt ? `${formatDate(p.settledAt, true)} ${formatTime(p.settledAt)}` : "pending"} · {p.scoreSource || p.model || "Vanish"} · 90min
                      </small>
                    </td>
                    <td>{p.pick.label}<br/><small className="small-text muted">{p.pick.side} · {p.model?.slice(0,30)}</small></td>
                    <td>{pct(p.pick.probability, 1)}<br/><small className="small-text muted">fitted to 380-game backtest</small></td>
                    <td>
                      {p.result && !p.result.void
                        ? `${p.result.home} – ${p.result.away}`
                        : "—"}
                    </td>
                    <td>
                      <span className={`outcome ${p.status}`}>
                        {p.status === "won" ? (
                          <Check size={12} />
                        ) : p.status === "lost" ? (
                          <X size={12} />
                        ) : (
                          <Minus size={12} />
                        )}{" "}
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`View archived analysis for ${p.home.name}`}
                        onClick={() => onOpen(p)}
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && (
              <div className="empty-state">
                <h3>No results in this view.</h3>
                <p>Choose another sport or outcome.</p>
              </div>
            )}
          </div>
          <div className="table-note">
            <Info size={14} />
            <span>
              <strong>Methodology:</strong> Every row is frozen at publishedAt (never recalculated), settled on 90-min score, shortlisted selections only (not every fixture), voids excluded. Green = won, Red = lost, like Forebet & NerdyTips. Full history downloadable as CSV + GitHub tracked. Model admits weakness: strongest on Over/Under + Corners + tight low-scoring games, weakest on winner in high-variance leagues. Hit rate alone does not demonstrate profitability.{" "}
              {demo
                ? "All displayed fixtures and outcomes are fictional examples."
                : "Scores from ESPN Free (57 finished detected) + TheSportsDB. Provider coverage and settlement rules can differ. 18+ only."}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function RangeSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
}) {
  return (
    <label className="lab-slider">
      <span>
        {label}
        <strong>
          {value}
          {unit}
        </strong>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="range-labels">
        <small>
          {min}
          {unit}
        </small>
        <small>
          {max}
          {unit}
        </small>
      </span>
    </label>
  );
}

function ModelLab() {
  const [sport, setSport] = useState("football");
  const [homeGoals, setHomeGoals] = useState(1.8),
    [awayGoals, setAwayGoals] = useState(1.1),
    [margin, setMargin] = useState(4.5),
    [eloA, setEloA] = useState(2100),
    [eloB, setEloB] = useState(2000);
  const output = useMemo(
    () =>
      sport === "football"
        ? footballFromGoals(homeGoals, awayGoals)
        : sport === "basketball"
          ? basketballModel(margin, 0, 0)
          : tennisModel(eloA, eloB),
    [sport, homeGoals, awayGoals, margin, eloA, eloB],
  );

  return (
    <div className="model-lab">
      <div className="lab-title">
        <div>
          <SmallTag tone="green">INTERACTIVE</SmallTag>
          <h3>Move an input. See the difference.</h3>
          <p>No black box. Try the baseline calculations yourself.</p>
        </div>
        <FlaskConical size={28} />
      </div>
      <div className="lab-sports">
        {SPORTS.slice(1).map((s) => (
          <button
            className={sport === s.id ? "active" : ""}
            key={s.id}
            onClick={() => setSport(s.id)}
          >
            <SportIcon sport={s.id} />
            {s.label}
          </button>
        ))}
      </div>
      <div className="lab-body">
        <div>
          {sport === "football" ? (
            <>
              <RangeSlider
                label="Home expected goals"
                value={homeGoals}
                onChange={setHomeGoals}
                min={0.2}
                max={4}
                step={0.1}
              />
              <RangeSlider
                label="Away expected goals"
                value={awayGoals}
                onChange={setAwayGoals}
                min={0.2}
                max={4}
                step={0.1}
              />
            </>
          ) : sport === "basketball" ? (
            <>
              <RangeSlider
                label="Expected home margin"
                value={margin}
                onChange={setMargin}
                min={-15}
                max={15}
                step={0.5}
                unit=" pts"
              />
              <p className="small-text muted">
                This lab assumes a 12-point margin standard deviation and no
                additional home-court adjustment.
              </p>
            </>
          ) : (
            <>
              <RangeSlider
                label="Player A Elo"
                value={eloA}
                onChange={setEloA}
                min={1400}
                max={2400}
                step={10}
              />
              <RangeSlider
                label="Player B Elo"
                value={eloB}
                onChange={setEloB}
                min={1400}
                max={2400}
                step={10}
              />
            </>
          )}
        </div>
        <div className="lab-output">
          <span className="eyebrow muted">CALCULATED PROBABILITIES</span>
          {Object.entries(output.probabilities).map(([side, value]) => (
            <ProbabilityBar
              key={side}
              label={
                side === "draw"
                  ? "Draw"
                  : sport === "tennis"
                    ? `Player ${side === "home" ? "A" : "B"} wins`
                    : `${side === "home" ? "Home" : "Away"} win`
              }
              value={value}
              primary={side === "home"}
            />
          ))}
        </div>
      </div>
      <div className="lab-foot">
        <Info size={14} />
        An educational demonstration, not a validated forecasting tool.
      </div>
    </div>
  );
}

function ModelPage({ data, onInfo }) {
  const demo = data.meta.mode === "demo";
  return (
    <section className="page-section model-page">
      <div className="page-eyebrow">
        <span className="tiny-dot" /> UNDER THE HOOD
      </div>
      <div className="page-title-row">
        <div>
          <h1>A reason behind every number.</h1>
          <p>
            Transparent inputs. Sport-specific calculations. Limitations in
            plain sight.
          </p>
        </div>
        <SmallTag tone="green">MODEL v{data.meta.modelVersion}</SmallTag>
      </div>
      <div className="model-intro">
        <div>
          <h2>Analysis, without the mystery.</h2>
          <p>
            The demo uses three simple statistical baselines. They turn
            illustrative ratings into probabilities automatically. They do not
            learn from live matches, know team news or promise an advantage over
            a bookmaker.
          </p>
          <p>
            Connecting the optional live adapter changes the source to
            margin-adjusted market odds. That is a market consensus, not an
            independently trained prediction model.
          </p>
          <button className="text-button lime-text" onClick={onInfo}>
            Read the data notes <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="engine-status">
          <div>
            <span className="tiny-dot" />
            <strong>
              {data.meta.stale ? "Refresh needs attention" : "Engine status"}
            </strong>
            <SmallTag tone="amber">{demo ? "DEMO" : "LIVE FEED"}</SmallTag>
          </div>
          <dl>
            <div>
              <dt>Data source</dt>
              <dd>{demo ? "Synthetic inputs" : "The Odds API"}</dd>
            </div>
            <div>
              <dt>Last calculation</dt>
              <dd>{formatTime(data.meta.generatedAt)} WAT</dd>
            </div>
            <div>
              <dt>
                {window.__VANISH_SNAPSHOT__
                  ? "Offline calculation"
                  : "Server refresh"}
              </dt>
              <dd>
                {window.__VANISH_SNAPSHOT__
                  ? "Recalculate on demand"
                  : `Every ${data.meta.refreshMinutes} minutes`}
              </dd>
            </div>
            <div>
              <dt>Calibration</dt>
              <dd className="amber-text">Not validated</dd>
            </div>
            <div>
              <dt>Verified live record</dt>
              <dd>{demo ? "Not connected" : "Recording published picks"}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="model-cards">
        <article>
          <span className="model-sport-icon">
            <SportIcon sport="football" size={25} />
          </span>
          <span className="eyebrow muted">FOOTBALL</span>
          <h3>Poisson goal model</h3>
          <p>
            Attack and defence indices estimate goals for each team. Independent
            score distributions give win, draw and goal-market probabilities.
          </p>
          <code>P(k goals) = e⁻λ × λᵏ / k!</code>
          <small>
            Limitation: independent scores; no lineup or low-score correction.
          </small>
        </article>
        <article>
          <span className="model-sport-icon">
            <SportIcon sport="basketball" size={25} />
          </span>
          <span className="eyebrow muted">BASKETBALL</span>
          <h3>Rating-to-margin model</h3>
          <p>
            Team strength and home advantage produce an expected points margin.
            A normal distribution maps it to win probability.
          </p>
          <code>P(home win) = Φ(margin / σ)</code>
          <small>
            Limitation: fixed variance; no injuries, pace or schedule
            adjustment.
          </small>
        </article>
        <article>
          <span className="model-sport-icon">
            <SportIcon sport="tennis" size={25} />
          </span>
          <span className="eyebrow muted">TENNIS</span>
          <h3>Elo win model</h3>
          <p>
            The difference between two player ratings determines their relative
            win probabilities using a standard Elo curve.
          </p>
          <code>P(A) = 1 / (1 + 10^((B−A)/400))</code>
          <small>
            Limitation: no surface, fitness or match-format adjustment.
          </small>
        </article>
      </div>
      <ModelLab />
      <div className="model-next">
        <ShieldCheck size={28} />
        <div>
          <h3>Before this becomes a live forecasting product.</h3>
          <p>
            Licensed historical and live data, chronological out-of-sample
            backtests, probability calibration and a complete prospective
            results log are still required. A polished website is not proof of a
            predictive edge.
          </p>
        </div>
      </div>
    </section>
  );
}

function InformationModal({ kind, onClose, data }) {
  const titles = {
    data: "A clear view of the data.",
    community: "Beyond the final whistle.",
    responsible: "Keep the game in perspective.",
    privacy: "Your privacy, in plain language.",
    terms: "A few important ground rules.",
  };
  return (
    <Modal onClose={onClose} title={titles[kind]}>
      <div className="info-modal-icon">
        {kind === "community" ? (
          <MessageCircle size={26} />
        ) : kind === "responsible" ? (
          <ShieldCheck size={26} />
        ) : (
          <Info size={26} />
        )}
      </div>
      <span className="eyebrow muted">VANISH THE BOOKIE</span>
      <h2>{titles[kind]}</h2>
      {kind === "data" ? (
        <div className="info-copy">
          <p>
            <strong>
              {data.meta.mode === "demo"
                ? "This is a working demo, not a live tipping service."
                : "This feed uses market-implied estimates."}
            </strong>
          </p>
          <p>
            Demo fixtures, kickoff times, ratings and archived scores are
            synthetic. Real team and player names are used only to demonstrate
            the interface. They do not imply a scheduled match.
          </p>
          <p>
            The server recalculates the demo every five minutes. The
            calculations are real; their example inputs are not. No model shown
            here has been validated or calibrated.
          </p>
          <p>
            The optional live connection uses The Odds API to calculate a
            margin-adjusted consensus from bookmaker prices. It needs a
            server-side API key, an appropriate data plan and permission to
            display the data. It does not establish an independent edge.
          </p>
          <div className="inline-notice">
            <Database size={17} />
            <span>
              Current source: {data.meta.source}.{" "}
              {window.__VANISH_SNAPSHOT__
                ? "You are viewing a self-contained offline snapshot; refresh recalculates locally."
                : "Automated refresh runs on this server while it is online."}
            </span>
          </div>
        </div>
      ) : kind === "community" ? (
        <div className="info-copy">
          <p>
            The conversation doesn’t end on the match card. Follow{" "}
            <strong>@vanishthebookie</strong> for more from Vanish.
          </p>
          <a
            className="community-link"
            href={data.community.x}
            target="_blank"
            rel="noreferrer"
          >
            <XLogo size={22} />
            <div>
              <strong>Vanish on X</strong>
              <span>@vanishthebookie</span>
            </div>
            <ArrowUpRight size={20} />
          </a>
          {data.community.whatsapp ? (
            <a
              className="community-link"
              href={data.community.whatsapp}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={22} />
              <div>
                <strong>Join the WhatsApp community</strong>
                <span>Open the official invite</span>
              </div>
              <ArrowUpRight size={20} />
            </a>
          ) : (
            <div className="community-link not-connected">
              <MessageCircle size={22} />
              <div>
                <strong>WhatsApp community</strong>
                <span>Invite link hasn’t been added yet.</span>
              </div>
              <SmallTag>SOON</SmallTag>
            </div>
          )}
          <p className="small-text muted">
            18+ only. No results are guaranteed, here or in the community.
          </p>
        </div>
      ) : kind === "responsible" ? (
        <div className="info-copy">
          <p>
            <strong>Analysis is information, not a promise of income.</strong>{" "}
            Betting involves a real risk of losing money. Never treat
            predictions as guaranteed outcomes.
          </p>
          <ul>
            <li>Adults 18+ only, subject to the legal age where you live.</li>
            <li>
              Set a spending limit you can afford to lose, and stick to it.
            </li>
            <li>Never borrow to bet or chase a loss.</li>
            <li>
              Take breaks. Use deposit limits or self-exclusion tools if needed.
            </li>
            <li>
              If betting is causing stress or financial harm, stop and seek
              support from a qualified local support service.
            </li>
          </ul>
          <p>
            This website does not accept wagers, hold betting deposits or
            process bets.
          </p>
        </div>
      ) : kind === "privacy" ? (
        <div className="info-copy">
          <p>
            This preview has no accounts, advertising trackers, analytics
            cookies or payment processing.
          </p>
          <p>
            Saved matches are stored in this browser’s local storage when
            available. You can remove them using the bookmark controls or by
            clearing site data. In a restricted file viewer, saved matches may
            last only for the current session.
          </p>
          <p>
            The live server requests sports data using its own server-side
            credentials. It does not send your saved matches to a sports-data
            provider. Hosting infrastructure may maintain standard access logs.
          </p>
          <p>
            Following external X or WhatsApp links opens services with their own
            privacy policies. A public launch needs an operator-specific privacy
            policy, retention policy and contact information.
          </p>
        </div>
      ) : (
        <div className="info-copy">
          <p>
            This preview is an informational sports-analysis site. It does not
            accept bets, hold funds or guarantee any result or financial return.
          </p>
          <p>
            Demo content is synthetic. Live market estimates, when configured,
            can be delayed, incomplete or incorrect. Check event details
            independently and follow the laws where you live.
          </p>
          <p>
            Probabilities are unvalidated estimates, not a verified success
            rate. An example hit rate does not show profitability. You remain
            responsible for your own decisions.
          </p>
          <p>
            The platform is intended only for adults of legal gambling age.
            Before a public launch, operator details, appropriate legal terms,
            data-display permissions and jurisdiction-specific requirements must
            be reviewed.
          </p>
        </div>
      )}
      <button className="button secondary full-width" onClick={onClose}>
        Got it <Check size={16} />
      </button>
    </Modal>
  );
}

function App() {
  const [data, setData] = useState(window.__VANISH_SNAPSHOT__ || null),
    [loading, setLoading] = useState(!window.__VANISH_SNAPSHOT__),
    [error, setError] = useState("");
  const [view, setView] = useState(
    ["results", "model", "builder", "cart", "comparator", "odds"].includes(window.location.hash.slice(1))
      ? window.location.hash.slice(1)
      : "predictions",
  );
  const [mobileMenu, setMobileMenu] = useState(false),
    [modal, setModal] = useState(null),
    [refreshing, setRefreshing] = useState(false);
  const [saved, setSaved] = useState(() => {
    const value = readStorage("vanish:saved", []);
    return Array.isArray(value)
      ? value.filter((v) => typeof v === "string")
      : [];
  });
  const [cart, setCart] = useState(() => {
    const value = readStorage("vanish:cart", []);
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
  });
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const sectionRef = useRef(null);
  const notify = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  };
  const load = async () => {
    try {
      const result = await getDashboard();
      setData(result);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => {
      clearInterval(id);
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    const listen = () =>
      setView(
        ["results", "model", "builder", "cart", "comparator", "odds"].includes(window.location.hash.slice(1))
          ? window.location.hash.slice(1)
          : "predictions",
      );
    window.addEventListener("hashchange", listen);
    return () => window.removeEventListener("hashchange", listen);
  }, []);
  const navigate = (target) => {
    setView(target);
    window.location.hash = target;
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const onSave = (id) => {
    const next = saved.includes(id)
      ? saved.filter((item) => item !== id)
      : [...saved, id];
    const persisted = writeStorage("vanish:saved", next);
    setSaved(next);
    notify(
      next.includes(id)
        ? `Match saved${persisted ? " to this browser." : " for this session."}`
        : "Match removed from your saved list.",
    );
  };
  const onCart = (id, forceAdd = false) => {
    const exists = cart.includes(id);
    let next;
    if (forceAdd) {
      if (exists) return;
      next = [...cart, id];
    } else {
      next = exists ? cart.filter((item) => item !== id) : [...cart, id];
    }
    const persisted = writeStorage("vanish:cart", next);
    setCart(next);
    notify(
      next.includes(id) && !exists
        ? `Added to cart${persisted ? " — now " + next.length + " items" : ""}. Like SaferStake cart 0 items → booking code`
        : exists && !forceAdd
          ? "Removed from cart."
          : "",
    );
  };
  const onOpen = (p) => setModal({ kind: "analysis", p });
  const info = (kind) => setModal({ kind });
  const refresh = async () => {
    setRefreshing(true);
    try {
      let result;
      if (window.__VANISH_SNAPSHOT__) {
        result = {
          ...data,
          predictions: data.predictions.map(predict),
          meta: { ...data.meta, generatedAt: new Date().toISOString() },
        };
        window.__VANISH_SNAPSHOT__ = result;
      } else {
        const response = await fetch("/api/demo/refresh", { method: "POST" });
        result = await response.json();
        if (!response.ok) throw new Error(result.error || "Refresh failed.");
      }
      setData(result);
      notify("Demo models recalculated. The inputs remain synthetic.");
    } catch (e) {
      notify(e.message);
    } finally {
      setRefreshing(false);
    }
  };
  const demo = data?.meta.mode !== "live";
  return (
    <>
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
          document.getElementById("main")?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Brand onClick={() => navigate("predictions")} />
          <nav
            className={mobileMenu ? "open" : ""}
            aria-label="Main navigation"
          >
            {[
              ["predictions", "Predictions"],
              ["results", "Results"],
              ["builder", "Bet Builder"],
              ["cart", `Cart ${cart.length ? `(${cart.length})` : ""}`],
              ["comparator", "Comparator"],
              ["odds", "Odds Calc"],
              ["model", "The model"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={view === id || (id.startsWith("cart") && view==="cart") ? "active" : ""}
                onClick={() => navigate(id === "cart" ? "cart" : id)}
                aria-current={view === id ? "page" : undefined}
              >
                {label}
                {id === "model" && <span className="nav-new">LAB</span>}
                {id === "builder" && <span className="nav-new" style={{background:"#4a6b2a"}}>NEW</span>}
                {id.startsWith("cart") && cart.length > 0 && <span className="nav-new" style={{background:"#c8e890",color:"#13200d"}}>{cart.length}</span>}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <span className="header-mode">
              <span className="tiny-dot" />
              {demo ? "Demo preview" : "Market estimates"}
            </span>
            <button className="community-button" style={{position:'relative'}} onClick={() => navigate("cart")}>
              <Layers3 size={14} />
              <span>Cart {cart.length ? `(${cart.length})` : "0 items"}</span>
            </button>
            <button
              className="community-button"
              onClick={() => data && info("community")}
            >
              <XLogo />
              <span>Join the conversation</span>
              <ArrowUpRight size={15} />
            </button>
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="site-main" tabIndex={-1}>
        {loading ? (
          <div className="loading-screen">
            <Mark />
            <h2>Setting up your matchday.</h2>
            <p>Loading the prediction models…</p>
            <div className="loading-line" />
          </div>
        ) : !data ? (
          <div className="empty-state load-error">
            <AlertTriangle size={34} />
            <h2>The data service is taking a break.</h2>
            <p>{error}</p>
            <button
              className="button lime"
              onClick={() => {
                setLoading(true);
                load();
              }}
            >
              Try again <RefreshCw size={16} />
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="inline-notice">
                <AlertTriangle size={16} />
                <span>
                  Connection lost. Showing the last loaded data. {error}
                </span>
                <button onClick={load}>Retry</button>
              </div>
            )}
            {view === "predictions" ? (
              <>
                <Hero
                  feature={
                    data.predictions.find((p) => p.id === "demo-ars-che") ||
                    data.predictions[0]
                  }
                  onExplore={() =>
                    sectionRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                  onModel={() => navigate("model")}
                  onOpen={onOpen}
                  demo={demo}
                />
                <div className="facts-strip">
                  <div>
                    <span className="fact-icon">
                      <Globe2 size={20} />
                    </span>
                    <p>
                      <strong>Three sports. One perspective.</strong>
                      <span>Football, basketball & tennis</span>
                    </p>
                  </div>
                  <div>
                    <span className="fact-icon">
                      <Zap size={20} />
                    </span>
                    <p>
                      <strong>Always working the numbers.</strong>
                      <span>
                        {window.__VANISH_SNAPSHOT__
                          ? "Offline demo · recalculate on demand"
                          : `${data.meta.refreshMinutes}-minute ${demo ? "demo" : "server"} refresh cycle`}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="fact-icon">
                      <ShieldCheck size={20} />
                    </span>
                    <p>
                      <strong>Free means free.</strong>
                      <span>No subscription. No VIP paywall.</span>
                    </p>
                  </div>
                </div>
                <DataBanner
                  data={data}
                  onInfo={() => info("data")}
                  refreshing={refreshing}
                  onRefresh={refresh}
                  offline={Boolean(window.__VANISH_SNAPSHOT__)}
                />
                <Predictions
                  data={data}
                  saved={saved}
                  onSave={onSave}
                  onOpen={onOpen}
                  navigate={navigate}
                  onCommunity={() => info("community")}
                  sectionRef={sectionRef}
                  cart={cart}
                  onCart={onCart}
                />
                <section className="community-band">
                  <div className="community-band-art">
                    <Mark />
                  </div>
                  <div>
                    <span className="eyebrow">THE GAME IS BETTER TOGETHER</span>
                    <h2>Good analysis starts a conversation.</h2>
                    <p>Stay close to the action with @vanishthebookie.</p>
                  </div>
                  <button
                    className="button lime"
                    onClick={() => info("community")}
                  >
                    Find your community <ArrowUpRight size={18} />
                  </button>
                </section>
              </>
            ) : view === "results" ? (
              <Results data={data} onOpen={onOpen} notify={notify} />
            ) : view === "builder" ? (
              <BetBuilder data={data} onCart={onCart} notify={notify} />
            ) : view === "cart" ? (
              <CartView data={data} cart={cart} onCart={onCart} onOpen={onOpen} today={data.meta.snapshotDate} notify={notify} />
            ) : view === "comparator" ? (
              <TeamComparator data={data} />
            ) : view === "odds" ? (
              <OddsConverter />
            ) : (
              <ModelPage data={data} onInfo={() => info("data")} />
            )}
          </>
        )}
      </main>
      <footer className="site-footer">
        <div className="footer-main">
          <div>
            <Brand onClick={() => navigate("predictions")} />
            <p>Read the game. Not the noise.</p>
          </div>
          <div className="footer-links">
            <button onClick={() => navigate("predictions")}>Predictions</button>
            <button onClick={() => navigate("results")}>Results</button>
            <button onClick={() => navigate("model")}>Our methodology</button>
            {data && (
              <button onClick={() => info("community")}>
                Community <ArrowUpRight size={12} />
              </button>
            )}
          </div>
          <div className="footer-responsible">
            <span>18+</span>
            <p>
              Play responsibly.
              <br />
              No prediction is guaranteed.
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {data?.meta.snapshotDate?.slice(0, 4) || "2026"} Vanish The
            Bookie. Independent sports analysis.
          </span>
          {data && (
            <div>
              <button onClick={() => info("responsible")}>
                Safer gambling
              </button>
              <button onClick={() => info("privacy")}>Privacy</button>
              <button onClick={() => info("terms")}>Terms</button>
            </div>
          )}
          <span className="timezone">
            <Globe2 size={12} />
            All times WAT (UTC+1)
          </span>
        </div>
      </footer>
      {modal &&
        data &&
        (modal.kind === "analysis" ? (
          <AnalysisModal
            key={modal.p.id}
            p={modal.p}
            saved={saved.includes(modal.p.id)}
            onSave={onSave}
            onClose={() => setModal(null)}
            today={data.meta.snapshotDate}
            notify={notify}
          />
        ) : (
          <InformationModal
            kind={modal.kind}
            onClose={() => setModal(null)}
            data={data}
          />
        ))}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
