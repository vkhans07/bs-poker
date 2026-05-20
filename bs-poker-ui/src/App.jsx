import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

// ─── Constants ────────────────────────────────────────────────────────────────
const RANKS     = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const SUITS     = ["c","d","h","s"];
const RANK_VAL  = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13,"A":14};
const RANK_FULL = {"2":"Deuce","3":"Three","4":"Four","5":"Five","6":"Six","7":"Seven","8":"Eight","9":"Nine","T":"Ten","J":"Jack","Q":"Queen","K":"King","A":"Ace"};
const SUIT_SYM  = { c:"♣", d:"♦", h:"♥", s:"♠" };
const SUIT_NAME = { c:"Clubs", d:"Diamonds", h:"Hearts", s:"Spades" };
const HAND_TYPES = [
  { type:"high_card",       label:"High Card",        needsRanks:1, needsSuit:false },
  { type:"pair",            label:"Pair",              needsRanks:1, needsSuit:false },
  { type:"two_pair",        label:"Two Pair",          needsRanks:2, needsSuit:false },
  { type:"three_of_a_kind", label:"Three of a Kind",   needsRanks:1, needsSuit:false },
  { type:"straight",        label:"Straight",          needsRanks:1, needsSuit:false },
  { type:"flush",           label:"Flush",             needsRanks:1, needsSuit:true  },
  { type:"full_house",      label:"Full House",        needsRanks:2, needsSuit:false },
  { type:"four_of_a_kind",  label:"Four of a Kind",    needsRanks:1, needsSuit:false },
  { type:"straight_flush",  label:"Straight Flush",    needsRanks:1, needsSuit:true  },
];
const HAND_RANK_ORDER = {high_card:0,pair:1,two_pair:2,three_of_a_kind:3,straight:4,flush:5,full_house:6,four_of_a_kind:7,straight_flush:8};
const AVATAR_COLORS   = ["#1d4ed8","#7c3aed","#0e7490","#047857","#b45309","#be123c","#6d28d9","#0f766e"];
const DEFAULT_WS = window.location.hostname === "localhost"
  ? "ws://localhost:3001"
  : "wss://bs-poker.onrender.com";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function claimScore(c) {
  const base = HAND_RANK_ORDER[c.type] * 100000;
  return base + (c.ranks?.[0] ? RANK_VAL[c.ranks[0]] : 0) * 100 + (c.ranks?.[1] ? RANK_VAL[c.ranks[1]] : 0);
}
function formatClaim(c) {
  if (!c) return null;
  const r = x => RANK_FULL[x] || x;
  switch (c.type) {
    case "high_card":       return `${r(c.ranks[0])} High`;
    case "pair":            return `Pair of ${r(c.ranks[0])}s`;
    case "two_pair":        return `${r(c.ranks[0])}s & ${r(c.ranks[1])}s`;
    case "three_of_a_kind": return `Three ${r(c.ranks[0])}s`;
    case "straight":        return `${r(c.ranks[0])}-High Straight`;
    case "flush":           return `${r(c.ranks[0])}-High ${SUIT_NAME[c.suit]} Flush`;
    case "full_house":      return `${r(c.ranks[0])}s Full of ${r(c.ranks[1])}s`;
    case "four_of_a_kind":  return `Four ${r(c.ranks[0])}s`;
    case "straight_flush":  return `${r(c.ranks[0])}-High Straight Flush`;
    default: return "Unknown";
  }
}
function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
}
function avatarColor(name) {
  return AVATAR_COLORS[(name || "").charCodeAt(0) % AVATAR_COLORS.length];
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ code, size = "md", highlight = false, faceDown = false }) {
  const sizes = {
    sm: { w:32, h:46, cf:9,  sf:16 },
    md: { w:48, h:68, cf:12, sf:24 },
    lg: { w:62, h:88, cf:14, sf:30 },
  };
  const s = sizes[size];

  if (faceDown || !code || code === "X") {
    return (
      <div className="card card-back" style={{ width:s.w, height:s.h }}>
        <div className="card-back-pattern" />
      </div>
    );
  }
  const rank = code.slice(0,-1);
  const suit = code.slice(-1);
  const display = rank === "T" ? "10" : rank;
  const red = suit === "d" || suit === "h";
  return (
    <div
      className={`card card-face ${red ? "card-red" : "card-black"} ${highlight ? "card-highlight" : ""}`}
      style={{ width:s.w, height:s.h }}
    >
      <div className="card-corner card-tl" style={{ fontSize:s.cf }}>
        <div>{display}</div>
        <div>{SUIT_SYM[suit]}</div>
      </div>
      <div className="card-center" style={{ fontSize:s.sf }}>{SUIT_SYM[suit]}</div>
      <div className="card-corner card-br" style={{ fontSize:s.cf }}>
        <div>{display}</div>
        <div>{SUIT_SYM[suit]}</div>
      </div>
    </div>
  );
}

// ─── Seat (positioned around the table) ──────────────────────────────────────
function Seat({ player, isMe, isTurn, isLastClaimer, isReveal, position }) {
  // position: "top"|"bottom"|"left"|"right"|"top-left"|"top-right"|"bottom-left"|"bottom-right"
  const danger  = !player.eliminated && player.cardCount >= 4;
  const warning = !player.eliminated && player.cardCount === 3;

  // Cards to show: revealed cards face-up, otherwise face-down pips
  const cardElements = player.eliminated ? null : isReveal && player.cards
    ? player.cards.map((c,i) => <Card key={i} code={c} size="sm" highlight />)
    : Array(player.cardCount || 0).fill(0).map((_,i) => <Card key={i} faceDown size="sm" />);

  return (
    <div className={[
      "seat",
      `seat-${position}`,
      isMe    ? "seat-me"   : "",
      isTurn  ? "seat-turn" : "",
      player.eliminated ? "seat-out" : "",
    ].filter(Boolean).join(" ")}>

      {/* Cards above/beside the seat depending on position */}
      <div className="seat-cards">
        {cardElements}
      </div>

      {/* Avatar + name block */}
      <div className="seat-player">
        <div
          className={`seat-avatar ${isTurn ? "seat-avatar-turn" : ""}`}
          style={{ background: player.eliminated ? "#374151" : avatarColor(player.name) }}
        >
          {player.eliminated ? "💀" : initials(player.name)}
        </div>
        <div className="seat-label">
          <div className="seat-name">
            {player.name}
            {isMe && <span className="seat-you">you</span>}
          </div>
          <div className={`seat-count ${danger ? "count-danger" : warning ? "count-warning" : ""}`}>
            {player.eliminated ? "out" : `${player.cardCount}/5`}
          </div>
          {isLastClaimer && !player.eliminated && (
            <div className="seat-claimed">claimed</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Poker Table ──────────────────────────────────────────────────────────────
const POSITION_NAMES = {
  1: ["bottom"],
  2: ["bottom","top"],
  3: ["bottom","top-right","top-left"],
  4: ["bottom","right","top","left"],
  5: ["bottom","bottom-right","top-right","top-left","bottom-left"],
  6: ["bottom","bottom-right","top-right","top","top-left","bottom-left"],
  7: ["bottom","right","top-right","top","top-left","left","bottom-left"],
  8: ["bottom","bottom-right","right","top-right","top","top-left","left","bottom-left"],
};

function PokerTable({ players, myId, turnIdx, lastClaimPlayerId, isReveal, isPlaying, currentClaim }) {
  if (!players || players.length === 0) return (
    <div className="table-empty">Waiting for players to join…</div>
  );

  const active = players.filter(p => !p.eliminated);

  // Rotate so "me" is at bottom
  const myIdx = players.findIndex(p => p.id === myId);
  const rotated = myIdx >= 0
    ? [...players.slice(myIdx), ...players.slice(0, myIdx)]
    : players;

  const n = rotated.length;
  const positions = POSITION_NAMES[n] || POSITION_NAMES[8];

  return (
    <div className="table-container">
      <div className="table-felt">
        {/* Table surface */}
        <div className="table-surface">
          {/* Center info */}
          <div className="table-center">
            {currentClaim ? (
              <>
                <div className="table-claim-label">current claim</div>
                <div className="table-claim-text">{formatClaim(currentClaim)}</div>
              </>
            ) : isPlaying ? (
              <div className="table-claim-label">no claim yet</div>
            ) : (
              <div className="table-logo">🃏</div>
            )}
          </div>
        </div>

        {/* Seats */}
        {rotated.map((player, i) => {
          const activeIdx = active.findIndex(a => a.id === player.id);
          return (
            <Seat
              key={player.id}
              player={player}
              isMe={player.id === myId}
              isTurn={!player.eliminated && activeIdx === turnIdx && isPlaying && !isReveal}
              isLastClaimer={player.id === lastClaimPlayerId}
              isReveal={isReveal}
              position={positions[i] || "top"}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Claim Builder ────────────────────────────────────────────────────────────
function ClaimBuilder({ currentClaim, onSubmit }) {
  const [handType, setHandType] = useState("pair");
  const [rank1, setRank1]       = useState("A");
  const [rank2, setRank2]       = useState("K");
  const [suit, setSuit]         = useState("s");
  const [error, setError]       = useState("");

  const htDef    = HAND_TYPES.find(h => h.type === handType);
  const rankOpts = [...RANKS].reverse();

  function submit() {
    const claim = {
      type: handType,
      ranks: htDef.needsRanks === 2 ? [rank1, rank2] : [rank1],
      suit: htDef.needsSuit ? suit : undefined,
    };
    if (htDef.needsRanks === 2 && rank1 === rank2)                     return setError("Ranks must be different");
    if (handType === "two_pair" && RANK_VAL[rank1] <= RANK_VAL[rank2]) return setError("First rank must be higher");
    if (handType === "straight" && RANK_VAL[rank1] < 6)                return setError("Straight needs high card ≥ 6");
    if (currentClaim && claimScore(claim) <= claimScore(currentClaim)) return setError("Must beat: " + formatClaim(currentClaim));
    setError("");
    onSubmit(claim);
  }

  return (
    <div className="builder">
      <div className="builder-header">
        <span className="builder-title">Your Move</span>
        {currentClaim && <span className="builder-beat">Beat: <strong>{formatClaim(currentClaim)}</strong></span>}
      </div>
      <div className="builder-row">
        <div className="field-group">
          <label className="field-label">Hand</label>
          <div className="select-wrap">
            <select className="custom-select" value={handType} onChange={e => { setHandType(e.target.value); setError(""); }}>
              {HAND_TYPES.map(h => <option key={h.type} value={h.type}>{h.label}</option>)}
            </select>
            <ChevronIcon />
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">
            {handType === "full_house" ? "Three of" : handType === "two_pair" ? "High pair" : "Rank"}
          </label>
          <div className="select-wrap">
            <select className="custom-select" value={rank1} onChange={e => { setRank1(e.target.value); setError(""); }}>
              {rankOpts.map(r => <option key={r} value={r}>{RANK_FULL[r]}</option>)}
            </select>
            <ChevronIcon />
          </div>
        </div>

        {htDef.needsRanks === 2 && (
          <div className="field-group">
            <label className="field-label">{handType === "full_house" ? "Pair of" : "Low pair"}</label>
            <div className="select-wrap">
              <select className="custom-select" value={rank2} onChange={e => { setRank2(e.target.value); setError(""); }}>
                {rankOpts.map(r => <option key={r} value={r}>{RANK_FULL[r]}</option>)}
              </select>
              <ChevronIcon />
            </div>
          </div>
        )}

        {htDef.needsSuit && (
          <div className="field-group">
            <label className="field-label">Suit</label>
            <div className="suit-row">
              {SUITS.map(s => (
                <button key={s} type="button"
                  className={`suit-btn suit-${s} ${suit === s ? "active" : ""}`}
                  onClick={() => setSuit(s)}
                >{SUIT_SYM[s]}</button>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-gold" onClick={submit}>
          Claim It <ArrowRightIcon />
        </button>
      </div>
      {error && <div className="builder-error">{error}</div>}
    </div>
  );
}

// ─── Log Panel ────────────────────────────────────────────────────────────────
function LogPanel({ logs }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div className="log-panel" ref={ref}>
      {logs.length === 0
        ? <span className="log-empty">Game log will appear here…</span>
        : logs.map((l,i) => {
            const isEvent = /BS|❌|✅|💀|🏆|🎲/.test(l);
            return <div key={i} className={`log-entry ${isEvent ? "log-event" : ""}`}>{l}</div>;
          })
      }
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function ChevronIcon() {
  return <svg className="chevron" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function ArrowRightIcon() {
  return <svg className="arrow-right" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

// ─── Join Screen ──────────────────────────────────────────────────────────────
function JoinScreen({ onConnect, extErr = "" }) {
  const [name, setName]       = useState("");
  const [url, setUrl]         = useState(DEFAULT_WS);
  const [showAdv, setShowAdv] = useState(false);
  const [err, setErr]         = useState("");

  function go() {
    if (!name.trim()) return setErr("Please enter a name");
    setErr("");
    onConnect(name.trim(), url.trim() || DEFAULT_WS);
  }

  return (
    <div className="join-bg">
      <div className="join-card">
        <div className="join-icon">🃏</div>
        <h1 className="join-title">BS Poker</h1>
        <p className="join-sub">Bluff your friends. Call their bluffs.</p>
        <div className="join-fields">
          <input className="text-input" placeholder="Your name" value={name}
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} autoFocus />
          <button className="adv-toggle" type="button" onClick={() => setShowAdv(v => !v)}>
            {showAdv ? "▲" : "▼"} Advanced
          </button>
          {showAdv && (
            <input className="text-input text-input-sm" placeholder={`Server URL`}
              value={url} onChange={e => setUrl(e.target.value)} />
          )}
          {(err || extErr) && <p className="join-error">{err || extErr}</p>}
          <button className="btn btn-primary btn-full" onClick={go}>
            Join Table <ArrowRightIcon />
          </button>
        </div>
        <p className="join-hint">Run <code>node server.js</code> and share your IP.</p>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [joined,  setJoined]  = useState(false);
  const [myId,    setMyId]    = useState(null);
  const [state,   setState]   = useState(null);
  const [logs,    setLogs]    = useState([]);
  const [connErr, setConnErr] = useState("");
  const ws      = useRef(null);
  const savedId = useRef(localStorage.getItem("bspoker_id"));

  const addLog = useCallback(msg => setLogs(l => [...l.slice(-100), msg]), []);

  function connect(playerName, serverUrl) {
    setConnErr("");
    const id = savedId.current || Math.random().toString(36).slice(2);
    savedId.current = id;
    localStorage.setItem("bspoker_id", id);
    const socket = new WebSocket(serverUrl);
    ws.current = socket;
    socket.onopen    = () => socket.send(JSON.stringify({ type:"join", name:playerName, id }));
    socket.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.type === "joined") { setMyId(msg.id); setJoined(true); }
      if (msg.type === "state")  setState(msg);
      if (msg.type === "log")    addLog(msg.msg);
      if (msg.type === "error")  addLog("⚠ " + msg.msg);
    };
    socket.onclose = () => { setJoined(false); addLog("Disconnected."); };
    socket.onerror = () => setConnErr("Can't connect — is the server running?");

    // keepalive ping every 25s
    const ping = setInterval(() => {
      if (socket.readyState === 1) socket.send(JSON.stringify({ type:"ping" }));
    }, 25000);
    socket.onclose = () => { clearInterval(ping); setJoined(false); addLog("Disconnected."); };
  }

  const send = useCallback(msg => {
    if (ws.current?.readyState === 1) ws.current.send(JSON.stringify(msg));
  }, []);

  if (!joined) return <JoinScreen onConnect={connect} extErr={connErr} />;

  const me           = state?.players?.find(p => p.id === myId);
  const active       = state?.players?.filter(p => !p.eliminated) || [];
  const myTurnPlayer = active[state?.turnIdx];
  const isMyTurn     = myTurnPlayer?.id === myId;
  const isReveal     = state?.phase === "reveal";
  const isPlaying    = state?.phase === "playing" || isReveal;
  const isLobby      = !state || state.phase === "lobby";
  const canStart     = (state?.players?.length || 0) >= 2 && isLobby;
  const canBS        = isPlaying && state?.currentClaim
                       && state?.lastClaimPlayerId !== myId && !me?.eliminated && !isReveal;

  return (
    <div className="game-root">
      <header className="game-header">
        <span className="header-logo">🃏 BS Poker</span>
        <div className="header-right">
          <span className="status-pill">
            <span className="status-dot" />
            {state?.players?.length || 0} players · {state?.phase || "lobby"}
          </span>
          {state?.phase !== "lobby" && (
            <button className="btn btn-ghost btn-sm" onClick={() => send({ type:"restart" })}>Reset</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => { ws.current?.close(); setJoined(false); }}>Leave</button>
        </div>
      </header>

      <main className="game-main">
        {/* Poker table */}
        <PokerTable
          players={state?.players || []}
          myId={myId}
          turnIdx={state?.turnIdx}
          lastClaimPlayerId={state?.lastClaimPlayerId}
          isReveal={isReveal}
          isPlaying={isPlaying}
          currentClaim={state?.currentClaim}
        />

        {/* My hand (large cards at bottom) */}
        {me?.cards?.length > 0 && (
          <section className="hand-section">
            <span className="section-label">Your Hand</span>
            <div className="hand-cards">
              {me.cards.map((c,i) => <Card key={i} code={c} size="lg" highlight={isReveal} />)}
            </div>
          </section>
        )}

        {/* Reveal banner */}
        {isReveal && (
          <div className="reveal-banner">
            <span className="reveal-title">🔍 Revealing all cards…</span>
            <span className="reveal-sub">Checking if the claim holds up</span>
          </div>
        )}

        {/* BS button — shown when not my turn and a claim exists */}
        {canBS && !isReveal && (
          <div className="bs-zone">
            <button className="btn btn-bs btn-bs-big" onClick={() => send({ type:"bs" })}>
              🚨 Call BS
            </button>
          </div>
        )}

        {/* Claim builder */}
        {isMyTurn && !isReveal && isPlaying && (
          <ClaimBuilder currentClaim={state?.currentClaim} onSubmit={claim => send({ type:"claim", claim })} />
        )}

        {/* Waiting indicator */}
        {!isMyTurn && isPlaying && !isReveal && myTurnPlayer && !canBS && (
          <div className="waiting-turn">
            Waiting for <strong>{myTurnPlayer.name}</strong>…
          </div>
        )}

        {/* Lobby */}
        {isLobby && (
          <div className="lobby-actions">
            {canStart
              ? <button className="btn btn-primary" onClick={() => send({ type:"start" })}>
                  Start Game — {state.players.length} players <ArrowRightIcon />
                </button>
              : <p className="lobby-hint">Need at least 2 players to start…</p>
            }
          </div>
        )}

        <LogPanel logs={logs} />
      </main>
    </div>
  );
}
