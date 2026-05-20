import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const SUITS = ["c","d","h","s"];
const RANK_VAL = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13,"A":14};
const RANK_NAMES = {"2":"Deuce","3":"Three","4":"Four","5":"Five","6":"Six","7":"Seven","8":"Eight","9":"Nine","T":"Ten","J":"Jack","Q":"Queen","K":"King","A":"Ace"};
const SUIT_SYMBOLS = {c:"♣",d:"♦",h:"♥",s:"♠"};
const SUIT_NAMES = {c:"Club",d:"Diamond",h:"Heart",s:"Spade"};
const SUIT_COLOR = {c:"#1a472a",d:"#c0392b",h:"#c0392b",s:"#0f172a"};
const HAND_TYPES = [
  {type:"high_card",   label:"High Card",       needsRanks:1, needsSuit:false},
  {type:"pair",        label:"Pair",             needsRanks:1, needsSuit:false},
  {type:"two_pair",    label:"Two Pair",         needsRanks:2, needsSuit:false},
  {type:"three_of_a_kind", label:"Three of a Kind", needsRanks:1, needsSuit:false},
  {type:"straight",    label:"Straight",         needsRanks:1, needsSuit:false},
  {type:"flush",       label:"Flush",            needsRanks:1, needsSuit:true},
  {type:"full_house",  label:"Full House",       needsRanks:2, needsSuit:false},
  {type:"four_of_a_kind", label:"Four of a Kind",  needsRanks:1, needsSuit:false},
  {type:"straight_flush", label:"Straight Flush", needsRanks:1, needsSuit:true},
];

const HAND_RANK_ORDER = {high_card:0,pair:1,two_pair:2,three_of_a_kind:3,straight:4,flush:5,full_house:6,four_of_a_kind:7,straight_flush:8};

function claimScore(claim) {
  const base = HAND_RANK_ORDER[claim.type] * 100000;
  const v0 = claim.ranks?.[0] ? RANK_VAL[claim.ranks[0]] : 0;
  const v1 = claim.ranks?.[1] ? RANK_VAL[claim.ranks[1]] : 0;
  return base + v0 * 100 + v1;
}

function formatClaim(claim) {
  if (!claim) return null;
  const rn = r => RANK_NAMES[r] || r;
  switch(claim.type) {
    case "high_card": return `${rn(claim.ranks[0])} High`;
    case "pair": return `Pair of ${rn(claim.ranks[0])}s`;
    case "two_pair": return `${rn(claim.ranks[0])}s & ${rn(claim.ranks[1])}s`;
    case "three_of_a_kind": return `Three ${rn(claim.ranks[0])}s`;
    case "straight": return `${rn(claim.ranks[0])}-High Straight`;
    case "flush": return `${rn(claim.ranks[0])}-High ${SUIT_NAMES[claim.suit]} Flush`;
    case "full_house": return `${rn(claim.ranks[0])}s Full of ${rn(claim.ranks[1])}s`;
    case "four_of_a_kind": return `Four ${rn(claim.ranks[0])}s`;
    case "straight_flush": return `${rn(claim.ranks[0])}-High Straight Flush`;
    default: return "Unknown";
  }
}

// ─── Card component ───────────────────────────────────────────────────────────
function Card({ code, size = "md", highlight = false }) {
  const sizes = {
    sm: { w: 38, h: 54, font: 13, suitFont: 18 },
    md: { w: 54, h: 76, font: 17, suitFont: 24 },
    lg: { w: 68, h: 96, font: 21, suitFont: 30 },
  };
  const s = sizes[size];

  if (!code || code === "X") {
    return (
      <div style={{
        width: s.w, height: s.h, borderRadius: 7,
        background: "linear-gradient(145deg, #1e3a5f, #0f2440)",
        border: "1.5px solid #2d5986",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow: "inset 0 1px 3px rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}>
        <div style={{
          width:"75%",height:"75%",borderRadius:4,
          border:"1px solid rgba(255,255,255,0.12)",
          background:"repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,0.04) 3px,rgba(255,255,255,0.04) 6px)",
        }}/>
      </div>
    );
  }

  const rank = code.slice(0, -1);
  const suit = code.slice(-1);
  const displayRank = rank === "T" ? "10" : rank;
  const color = SUIT_COLOR[suit];

  return (
    <div style={{
      width: s.w, height: s.h, borderRadius: 7,
      background: "#fff",
      border: highlight ? "2px solid #f59e0b" : "1.5px solid #d1d5db",
      boxShadow: highlight ? "0 0 10px rgba(245,158,11,0.5)" : "0 3px 10px rgba(0,0,0,0.35)",
      display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",
      position:"relative",flexShrink:0,
      transition:"box-shadow 0.3s",
    }}>
      <div style={{position:"absolute",top:3,left:5,color,fontSize:s.font-4,fontWeight:800,lineHeight:1,fontFamily:"Georgia,serif"}}>{displayRank}</div>
      <div style={{color,fontSize:s.suitFont,lineHeight:1}}>{SUIT_SYMBOLS[suit]}</div>
      <div style={{position:"absolute",bottom:3,right:5,color,fontSize:s.font-4,fontWeight:800,lineHeight:1,transform:"rotate(180deg)",fontFamily:"Georgia,serif"}}>{displayRank}</div>
    </div>
  );
}

// ─── Claim Builder ────────────────────────────────────────────────────────────
function ClaimBuilder({ currentClaim, onSubmit, disabled }) {
  const [handType, setHandType] = useState("pair");
  const [rank1, setRank1] = useState("A");
  const [rank2, setRank2] = useState("K");
  const [suit, setSuit] = useState("s");
  const [error, setError] = useState("");

  const htDef = HAND_TYPES.find(h => h.type === handType);

  function buildClaim() {
    const claim = {
      type: handType,
      ranks: htDef.needsRanks === 2 ? [rank1, rank2] : [rank1],
      suit: htDef.needsSuit ? suit : undefined,
    };
    // Basic validation
    if (htDef.needsRanks === 2 && rank1 === rank2) { setError("Ranks must be different"); return; }
    if (handType === "two_pair" && RANK_VAL[rank1] <= RANK_VAL[rank2]) { setError("First rank must be higher"); return; }
    if (handType === "full_house" && rank1 === rank2) { setError("Ranks must differ"); return; }
    if (handType === "straight" && RANK_VAL[rank1] < 6) { setError("Straight needs high card ≥ 6 (5-high = 6-high min)"); return; }
    if (currentClaim && claimScore(claim) <= claimScore(currentClaim)) {
      setError("Must beat: " + formatClaim(currentClaim));
      return;
    }
    setError("");
    onSubmit(claim);
  }

  const sel = (val, setVal, options, labels) => (
    <select value={val} onChange={e => setVal(e.target.value)} style={selStyle}>
      {options.map((o, i) => <option key={o} value={o}>{labels ? labels[i] : o}</option>)}
    </select>
  );

  const rankOptions = [...RANKS].reverse();
  const rankLabels = rankOptions.map(r => RANK_NAMES[r]);

  return (
    <div style={{ background:"rgba(0,0,0,0.55)", backdropFilter:"blur(10px)", border:"1px solid rgba(245,158,11,0.4)", borderRadius:14, padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{color:"#f59e0b",fontWeight:700,fontSize:13,letterSpacing:"0.05em",textTransform:"uppercase"}}>Make a Claim</div>

      <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
        <select value={handType} onChange={e => { setHandType(e.target.value); setError(""); }} style={{...selStyle,minWidth:160}}>
          {HAND_TYPES.map(h => <option key={h.type} value={h.type}>{h.label}</option>)}
        </select>

        {htDef.needsRanks >= 1 && (
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            {handType === "full_house" ? <span style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>trips:</span> :
             handType === "two_pair" ? <span style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>high pair:</span> :
             handType === "straight" || handType === "straight_flush" ? <span style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>high:</span> :
             handType === "flush" ? <span style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>high:</span> : null}
            {sel(rank1, setRank1, rankOptions, rankLabels)}
          </div>
        )}

        {htDef.needsRanks === 2 && (
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>
              {handType === "full_house" ? "pair:" : "low pair:"}
            </span>
            {sel(rank2, setRank2, rankOptions, rankLabels)}
          </div>
        )}

        {htDef.needsSuit && (
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>suit:</span>
            <select value={suit} onChange={e => setSuit(e.target.value)} style={selStyle}>
              {SUITS.map(s => <option key={s} value={s}>{SUIT_NAMES[s]} {SUIT_SYMBOLS[s]}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && <div style={{color:"#f87171",fontSize:12}}>{error}</div>}

      <div style={{display:"flex",gap:8}}>
        <button onClick={buildClaim} disabled={disabled} style={actionBtn("#f59e0b","#1a1a2e")}>
          Claim It →
        </button>
      </div>

      {currentClaim && (
        <div style={{color:"rgba(255,255,255,0.4)",fontSize:12}}>
          Beat: <span style={{color:"rgba(255,255,255,0.7)"}}>{formatClaim(currentClaim)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Player chip ─────────────────────────────────────────────────────────────
function PlayerChip({ player, isMe, isTurn, isLastClaimer, isReveal }) {
  const border = player.eliminated ? "1px solid rgba(255,255,255,0.1)"
    : isTurn ? "2px solid #f59e0b"
    : isMe ? "1.5px solid #60a5fa"
    : "1px solid rgba(255,255,255,0.15)";
  const bg = player.eliminated ? "rgba(0,0,0,0.2)"
    : isTurn ? "rgba(245,158,11,0.12)"
    : "rgba(255,255,255,0.05)";

  const cardDanger = player.cardCount >= 4;
  const cardWarning = player.cardCount === 3;

  return (
    <div style={{
      padding:"10px 14px", borderRadius:12, border, background: bg,
      opacity: player.eliminated ? 0.4 : 1,
      transition:"all 0.3s", minWidth:130,
    }}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
        <div style={{
          width:8,height:8,borderRadius:"50%",flexShrink:0,
          background: player.eliminated ? "#6b7280"
            : isTurn ? "#f59e0b" : "#4ade80",
          boxShadow: isTurn ? "0 0 6px #f59e0b" : "none",
        }}/>
        <span style={{color: isMe ? "#93c5fd" : "white", fontWeight:700, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
          {player.name}{isMe ? " (you)" : ""}
        </span>
      </div>

      {isLastClaimer && !player.eliminated && (
        <div style={{fontSize:10,color:"#f59e0b",marginBottom:4,fontWeight:600}}>CLAIMED</div>
      )}

      {/* Card pips */}
      <div style={{display:"flex",gap:3,alignItems:"center",flexWrap:"wrap"}}>
        {player.cards && isReveal
          ? player.cards.map((c,i) => <Card key={i} code={c} size="sm"/>)
          : Array(player.cardCount).fill(0).map((_,i) => (
              <div key={i} style={{
                width:14,height:20,borderRadius:2,
                background: i === player.cardCount - 1 && (cardDanger||cardWarning)
                  ? cardDanger ? "#ef4444" : "#f59e0b"
                  : "rgba(255,255,255,0.25)",
                border: "1px solid rgba(0,0,0,0.3)",
                transition:"background 0.3s",
              }}/>
            ))
        }
        {player.cardCount === 0 && !player.eliminated && (
          <span style={{color:"rgba(255,255,255,0.3)",fontSize:11}}>no cards</span>
        )}
      </div>

      <div style={{
        marginTop:5, fontSize:11, fontWeight:600,
        color: player.eliminated ? "#6b7280"
          : cardDanger ? "#f87171"
          : cardWarning ? "#fbbf24"
          : "rgba(255,255,255,0.4)",
      }}>
        {player.eliminated ? "💀 OUT" : `${player.cardCount}/5 cards`}
      </div>
    </div>
  );
}

// ─── Log panel ────────────────────────────────────────────────────────────────
function LogPanel({ logs }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div ref={ref} style={{
      height:130, overflowY:"auto",
      background:"rgba(0,0,0,0.4)", borderRadius:10, padding:"8px 12px",
      border:"1px solid rgba(255,255,255,0.07)",
    }}>
      {logs.length === 0 && <div style={{color:"rgba(255,255,255,0.2)",fontSize:12}}>Game log will appear here…</div>}
      {logs.map((l,i) => {
        const isBS = l.includes("BS") || l.includes("❌") || l.includes("✅") || l.includes("💀") || l.includes("🏆");
        return (
          <div key={i} style={{
            color: isBS ? "#fbbf24" : "rgba(255,255,255,0.65)",
            fontSize:12, marginBottom:2,
            fontWeight: isBS ? 600 : 400,
          }}>{l}</div>
        );
      })}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const DEFAULT_WS = window.location.hostname === "localhost" ? "ws://localhost:3001" 
: "https://bs-poker.onrender.com";

export default function BSPoker() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_WS);
  const [playerName, setPlayerName] = useState("");
  const [joined, setJoined] = useState(false);
  const [myId, setMyId] = useState(null);
  const [state, setState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [connErr, setConnErr] = useState("");
  const ws = useRef(null);
  const savedId = useRef(localStorage.getItem("bspoker_id"));

  const addLog = useCallback(msg => setLogs(l => [...l.slice(-100), msg]), []);

  const connect = useCallback(() => {
    if (!playerName.trim()) return setConnErr("Enter a name first");
    setConnErr("");
    const id = savedId.current || Math.random().toString(36).slice(2);
    savedId.current = id;
    localStorage.setItem("bspoker_id", id);

    const socket = new WebSocket(serverUrl);
    ws.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type:"join", name:playerName.trim(), id }));
    };
    socket.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.type === "joined") { setMyId(msg.id); setJoined(true); }
      if (msg.type === "state") setState(msg);
      if (msg.type === "log") addLog(msg.msg);
      if (msg.type === "error") addLog("⚠ " + msg.msg);
    };
    socket.onclose = () => { setJoined(false); addLog("Disconnected."); };
    socket.onerror = () => setConnErr("Can't connect. Is the server running?");
  }, [playerName, serverUrl, addLog]);

  const send = useCallback(msg => {
    if (ws.current?.readyState === 1) ws.current.send(JSON.stringify(msg));
  }, []);

  const me = state?.players?.find(p => p.id === myId);
  const active = state?.players?.filter(p => !p.eliminated) || [];
  const myTurnPlayer = active[state?.turnIdx];
  const isMyTurn = myTurnPlayer?.id === myId;
  const isReveal = state?.phase === "reveal";
  const isPlaying = state?.phase === "playing" || isReveal;
  const isLobby = !state || state.phase === "lobby";
  const canStart = state?.players?.length >= 2 && isLobby;
  const canBS = isPlaying && !isMyTurn && state?.currentClaim && state?.lastClaimPlayerId !== myId && !me?.eliminated && !isReveal;

  // ── Join screen ────────────────────────────────────────────────────────────
  if (!joined) return (
    <div style={{minHeight:"100vh",background:"#0a1a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif"}}>
      <div style={{
        background:"rgba(10,40,20,0.9)", border:"1px solid rgba(255,255,255,0.12)",
        borderRadius:20, padding:"40px 36px", width:340, textAlign:"center",
        backdropFilter:"blur(10px)",
      }}>
        <div style={{fontSize:52,marginBottom:6}}>🃏</div>
        <h1 style={{color:"white",fontSize:26,fontWeight:700,margin:"0 0 4px",letterSpacing:"-0.5px"}}>BS Poker</h1>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:13,margin:"0 0 28px",fontFamily:"system-ui,sans-serif"}}>
          Bluff your friends. Call their bluffs.
        </p>
        <input
          placeholder="Your name"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && connect()}
          style={{...inputSt,marginBottom:8}}
        />
        <input
          placeholder={`Server (default: ${DEFAULT_WS})`}
          value={serverUrl}
          onChange={e => setServerUrl(e.target.value)}
          style={{...inputSt,fontSize:12,color:"rgba(255,255,255,0.45)",marginBottom:12}}
        />
        {connErr && <div style={{color:"#f87171",fontSize:12,marginBottom:10}}>{connErr}</div>}
        <button onClick={connect} style={actionBtn("#16a34a","white",{width:"100%",padding:"12px",fontSize:15,fontFamily:"Georgia,serif"})}>
          Join Table →
        </button>
        <div style={{color:"rgba(255,255,255,0.2)",fontSize:11,marginTop:20,fontFamily:"system-ui,sans-serif",lineHeight:1.7}}>
          Run <code style={{color:"#60a5fa"}}>node server.js</code> then share<br/>your IP with friends to connect.
        </div>
      </div>
    </div>
  );

  // ── Game screen ────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"#081510",fontFamily:"system-ui,sans-serif",display:"flex",flexDirection:"column"}}>

      {/* Header */}
      <div style={{padding:"10px 20px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <span style={{color:"white",fontWeight:700,fontSize:16,fontFamily:"Georgia,serif"}}>🃏 BS Poker</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 5px #4ade80"}}/>
          <span style={{color:"rgba(255,255,255,0.4)",fontSize:12}}>
            {state?.players?.length || 0} players · {state?.phase || "lobby"}
          </span>
          {state?.phase !== "lobby" && (
            <button onClick={() => send({type:"restart"})} style={{...actionBtn("transparent","rgba(255,255,255,0.3)"),padding:"4px 10px",fontSize:11,border:"1px solid rgba(255,255,255,0.15)"}}>
              Reset
            </button>
          )}
        </div>
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column",gap:14,padding:16,maxWidth:880,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>

        {/* Current claim banner */}
        {state?.currentClaim && (
          <div style={{
            background: isReveal ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)",
            border: isReveal ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius:12, padding:"12px 18px",
            display:"flex",alignItems:"center",justifyContent:"space-between",
            transition:"all 0.4s",
          }}>
            <div>
              <div style={{color:"rgba(255,255,255,0.4)",fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>Current Claim</div>
              <div style={{color:"white",fontSize:22,fontWeight:700,fontFamily:"Georgia,serif"}}>{formatClaim(state.currentClaim)}</div>
              <div style={{color:"rgba(255,255,255,0.35)",fontSize:12,marginTop:2}}>
                by {state.players?.find(p => p.id === state.lastClaimPlayerId)?.name}
              </div>
            </div>
            {canBS && !isReveal && (
              <button onClick={() => send({type:"bs"})} style={actionBtn("#ef4444","white",{padding:"10px 22px",fontSize:14,fontFamily:"Georgia,serif"})}>
                🚨 CALL BS
              </button>
            )}
          </div>
        )}

        {/* Players grid */}
        <div style={{display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center"}}>
          {state?.players?.map((p,i) => {
            const activeIdx = active.indexOf(active.find(a => a.id === p.id));
            return (
              <PlayerChip
                key={p.id}
                player={p}
                isMe={p.id === myId}
                isTurn={!p.eliminated && activeIdx === state.turnIdx && isPlaying && !isReveal}
                isLastClaimer={p.id === state.lastClaimPlayerId}
                isReveal={isReveal}
              />
            );
          })}
          {(!state || state.players?.length === 0) && (
            <div style={{color:"rgba(255,255,255,0.2)",fontSize:13,padding:24}}>Waiting for players to join…</div>
          )}
        </div>

        {/* My cards */}
        {me && me.cards && me.cards.length > 0 && (
          <div style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"14px 16px"}}>
            <div style={{color:"rgba(255,255,255,0.4)",fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Your Hand</div>
            <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              {me.cards.map((c,i) => <Card key={i} code={c} size="lg" highlight={isReveal}/>)}
            </div>
          </div>
        )}

        {/* Reveal state overlay */}
        {isReveal && (
          <div style={{
            background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)",
            borderRadius:12,padding:"12px 16px",textAlign:"center",
          }}>
            <div style={{color:"#fbbf24",fontWeight:700,fontSize:15,fontFamily:"Georgia,serif"}}>🔍 Revealing all cards…</div>
            <div style={{color:"rgba(255,255,255,0.5)",fontSize:12,marginTop:4}}>Checking if the claim holds up</div>
          </div>
        )}

        {/* Action area */}
        {isMyTurn && !isReveal && isPlaying && (
          <ClaimBuilder
            currentClaim={state?.currentClaim}
            onSubmit={claim => send({type:"claim", claim})}
            disabled={false}
          />
        )}

        {/* Turn indicator (not my turn) */}
        {!isMyTurn && isPlaying && !isReveal && myTurnPlayer && (
          <div style={{textAlign:"center",color:"rgba(255,255,255,0.4)",fontSize:13}}>
            Waiting for <span style={{color:"#fbbf24",fontWeight:600}}>{myTurnPlayer.name}</span> to act…
            {canBS && (
              <div style={{marginTop:10}}>
                <button onClick={() => send({type:"bs"})} style={actionBtn("#ef4444","white",{padding:"10px 28px",fontSize:14,fontFamily:"Georgia,serif"})}>
                  🚨 CALL BS
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lobby / start */}
        {isLobby && (
          <div style={{textAlign:"center",padding:"10px 0"}}>
            {canStart
              ? <button onClick={() => send({type:"start"})} style={actionBtn("#16a34a","white",{padding:"12px 32px",fontSize:15,fontFamily:"Georgia,serif"})}>
                  Start Game ({state.players.length} players) →
                </button>
              : <div style={{color:"rgba(255,255,255,0.3)",fontSize:13}}>Need at least 2 players to start…</div>
            }
          </div>
        )}

        {/* Log */}
        <LogPanel logs={logs}/>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        select option { background: #1a2e1a; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius:2px; }
      `}</style>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const selStyle = {
  background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)",
  borderRadius:8, color:"white", padding:"6px 10px", fontSize:13,
  fontFamily:"system-ui,sans-serif", cursor:"pointer",
};

const inputSt = {
  width:"100%", padding:"11px 14px",
  background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)",
  borderRadius:10, color:"white", fontSize:14, fontFamily:"system-ui,sans-serif",
  display:"block", marginBottom:0,
};

function actionBtn(bg, color, extra = {}) {
  return {
    background: bg, color, border: "none", borderRadius: 9,
    padding: "9px 18px", fontWeight: 700, fontSize: 13,
    cursor: "pointer", transition: "filter 0.15s", fontFamily: "system-ui,sans-serif",
    ...extra,
  };
}
