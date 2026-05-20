const express = require("express");
const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;
const http = require("http");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3001;

// ─── Card & Deck helpers ────────────────────────────────────────────────────
const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const SUITS = ["c","d","h","s"];
const RANK_VAL = { "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13,"A":14 };

function makeDeck() {
  const d = [];
  for (const r of RANKS) for (const s of SUITS) d.push(r + s);
  return d;
}
function shuffle(d) {
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
function cardRank(c) { return c.slice(0, -1); }
function cardSuit(c) { return c.slice(-1); }

// ─── Hand ranking ──────────────────────────────────────────────────────────
const HAND_RANK = {
  high_card: 0, pair: 1, two_pair: 2, three_of_a_kind: 3,
  straight: 4, flush: 5, full_house: 6, four_of_a_kind: 7, straight_flush: 8
};

function claimScore(claim) {
  const base = HAND_RANK[claim.type] * 100000;
  const r = claim.ranks || [];
  var v0 = r[0] ? RANK_VAL[r[0]] : 0;
  const v1 = r[1] ? RANK_VAL[r[1]] : 0;

  if (claim.type === "flush") {
    v0 = 15 - v0; // for flushes, a lower high card is less likely, so invert value
  }

  return base + v0 * 100 + v1;
}

function claimBeats(newClaim, oldClaim) {
  if (!oldClaim) return true;
  return claimScore(newClaim) > claimScore(oldClaim);
}

// ─── Verify a claim against the collective cards ────────────────────────────
function verifyClaim(claim, allCards) {
  const rankGroups = {};
  const suitGroups = {};
  for (const c of allCards) {
    const r = cardRank(c), s = cardSuit(c);
    rankGroups[r] = (rankGroups[r] || 0) + 1;
    suitGroups[s] = (suitGroups[s] || 0) + 1;
  }

  function hasNOfRank(n, r) { return (rankGroups[r] || 0) >= n; }
  function hasStraightHigh(high) {
    const needed = [high, high - 1, high - 2, high - 3, high - 4];
    if (needed[4] < 2) return false;
    return needed.every(v => {
      const rankStr = Object.keys(RANK_VAL).find(k => RANK_VAL[k] === v);
      return rankStr && rankGroups[rankStr];
    });
  }

  function hasFlushHigh(high, suit) {
    if ((suitGroups[suit] || 0) < 5) return false;
    const suitCards = allCards.filter(c => cardSuit(c) === suit)
    .map(c => RANK_VAL[cardRank(c)]).sort((a,b) => b-a);
    return suitCards[0] === high;
  }

  const { type, ranks, suit } = claim;
  switch (type) {
    case "high_card": return hasNOfRank(1, ranks[0]);
    case "pair": return hasNOfRank(2, ranks[0]);
    case "two_pair": return hasNOfRank(2, ranks[0]) && hasNOfRank(2, ranks[1]);
    case "three_of_a_kind": return hasNOfRank(3, ranks[0]);
    case "straight": return hasStraightHigh(RANK_VAL[ranks[0]]);
    case "flush": return hasFlushHigh(RANK_VAL[ranks[0]], suit);
    case "full_house": return hasNOfRank(3, ranks[0]) && hasNOfRank(2, ranks[1]);
    case "four_of_a_kind": return hasNOfRank(4, ranks[0]);
    case "straight_flush": {
      const high = RANK_VAL[ranks[0]];
      for (const s of SUITS) {
        const sc = allCards.filter(c => cardSuit(c) === s).map(c => RANK_VAL[cardRank(c)]);
        const needed = [high, high-1, high-2, high-3, high-4];
        if (needed[4] >= 2 && needed.every(v => sc.includes(v))) return true;
      }
      return false;
    }
    default: return false;
  }
}

function formatClaim(claim) {
  if (!claim) return "none";
  const rn = r => rankName(r);
  switch (claim.type) {
    case "high_card": return `${rn(claim.ranks[0])} high`;
    case "pair": return `pair of ${rn(claim.ranks[0])}s`;
    case "two_pair": return `${rn(claim.ranks[0])}s and ${rn(claim.ranks[1])}s`;
    case "three_of_a_kind": return `three ${rn(claim.ranks[0])}s`;
    case "straight": return `${rn(claim.ranks[0])}-high straight`;
    case "flush": return `${rn(claim.ranks[0])}-high ${suitName(claim.suit)} flush`;
    case "full_house": return `${rn(claim.ranks[0])}s full of ${rn(claim.ranks[1])}s`;
    case "four_of_a_kind": return `four ${rn(claim.ranks[0])}s`;
    case "straight_flush": return `${rn(claim.ranks[0])}-high straight flush`;
    default: return "?";
  }
}

function rankName(r) {
  const n = {"2":"deuce","3":"three","4":"four","5":"five","6":"six","7":"seven","8":"eight","9":"nine","T":"ten","J":"jack","Q":"queen","K":"king","A":"ace"};
  return n[r] || r;
}
function suitName(s) {
  return {c:"club",d:"diamond",h:"heart",s:"spade"}[s] || s;
}

// ─── Game state ─────────────────────────────────────────────────────────────
let game = {
  phase: "lobby",
  players: [],      // { id, name, cards, eliminated }
  turnIdx: 0,
  currentClaim: null,
  lastClaimPlayer: null,
  log: [],
};
const clients = new Map();

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const [ws] of clients) if (ws.readyState === 1) ws.send(data);
}

function addLog(msg) {
  const ts = new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
  game.log.push(`[${ts}] ${msg}`);
  if (game.log.length > 80) game.log = game.log.slice(-80);
  broadcast({ type: "log", msg: `[${ts}] ${msg}` });
}

function publicState(forId) {
  return {
    type: "state",
    phase: game.phase,
    turnIdx: game.turnIdx,
    currentClaim: game.currentClaim,
    lastClaimPlayerId: game.lastClaimPlayer,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.cards.length,
      eliminated: p.eliminated,
      cards: p.id === forId ? p.cards : (game.phase === "reveal" ? p.cards : null),
    })),
    log: game.log.slice(-30),
  };
}
function broadcastState() {
  for (const [ws, id] of clients) {
    if (ws.readyState === 1) ws.send(JSON.stringify(publicState(id)));
  }
}

function activePlayers() { return game.players.filter(p => !p.eliminated); }

function dealRound(starterIdx) {
  const deck = shuffle(makeDeck());
  const active = activePlayers();
  for (const p of active) {
    const count = p.cards.length;
    p.cards = [];
    for (let i = 0; i < count; i++) p.cards.push(deck.pop());
  }
  game.currentClaim = null;
  game.lastClaimPlayer = null;
  game.phase = "playing";
  game.turnIdx = starterIdx < 0 ? 0 : starterIdx % active.length;
}

function startGame() {
  const active = activePlayers();
  game.phase = "playing";
  game.currentClaim = null;
  game.lastClaimPlayer = null;
  game.turnIdx = 0;
  game.log = [];

  const deck = shuffle(makeDeck());
  for (const p of active) {
    p.eliminated = false;
    p.cards = [deck.pop(), deck.pop()];
  }
  broadcastState();
  addLog(`🎲 Game started! ${active.length} players · 2 cards each.`);
  addLog(`▶ ${active[0].name} makes the first claim.`);
}

function handleClaim(playerId, claim) {
  const active = activePlayers();
  if (!active[game.turnIdx] || active[game.turnIdx].id !== playerId) return;
  if (!claimBeats(claim, game.currentClaim)) {
    const ws = [...clients].find(([,id]) => id === playerId)?.[0];
    if (ws?.readyState === 1) ws.send(JSON.stringify({ type: "error", msg: "Claim must beat the current claim!" }));
    return;
  }
  const p = active[game.turnIdx];
  game.currentClaim = claim;
  game.lastClaimPlayer = playerId;
  game.turnIdx = (game.turnIdx + 1) % active.length;
  addLog(`🗣 ${p.name}: "${formatClaim(claim)}"`);
  addLog(`▶ ${active[game.turnIdx].name}'s turn — raise or call BS.`);
  broadcastState();
}

function handleBS(callerId) {
  const active = activePlayers();
  const caller = active.find(p => p.id === callerId);
  if (!caller || !game.currentClaim || callerId === game.lastClaimPlayer) return;
  const claimer = game.players.find(p => p.id === game.lastClaimPlayer);
  const allCards = active.flatMap(p => p.cards);
  const valid = verifyClaim(game.currentClaim, allCards);

  game.phase = "reveal";
  broadcastState();

  addLog(`🚨 ${caller.name} calls BS on "${formatClaim(game.currentClaim)}"!`);
  addLog(`📋 All ${allCards.length} cards: ${allCards.join(" ")}`);

  if (valid) {
    addLog(`✅ Hand EXISTS — ${caller.name} takes a penalty card next round.`);
    caller.cards.push("X");
  } else {
    addLog(`❌ BS confirmed! Hand doesn't exist — ${claimer?.name} takes a penalty card.`);
    if (claimer) claimer.cards.push("X");
  }

  setTimeout(() => {
    // Check elimination (5 cards)
    for (const p of activePlayers()) {
      if (p.cards.length >= 5) {
        p.eliminated = true;
        p.cards = [];
        addLog(`💀 ${p.name} is eliminated!`);
      }
    }

    const remaining = activePlayers();
    if (remaining.length <= 1) {
      game.phase = "lobby";
      broadcastState();
      if (remaining.length === 1) addLog(`🏆 ${remaining[0].name} wins!`);
      return;
    }

    // Loser starts next round
    const loser = valid ? caller : claimer;
    const nextActive = activePlayers();
    const starterIdx = nextActive.findIndex(p => p.id === loser?.id);
    dealRound(starterIdx < 0 ? 0 : starterIdx);
    broadcastState();
    addLog(`🃏 New round! ${nextActive[starterIdx < 0 ? 0 : starterIdx]?.name} starts.`);
  }, 4000);
}

// ─── WebSocket ───────────────────────────────────────────────────────────────
wss.on("connection", ws => {
  ws.on("message", raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const pid = clients.get(ws);

    if (msg.type === "join") {
      const id = msg.id || Math.random().toString(36).slice(2);
      clients.set(ws, id);
      const ex = game.players.find(p => p.id === id);
      if (!ex) {
        game.players.push({ id, name: msg.name, cards: [], eliminated: false });
        addLog(`${msg.name} joined 👋`);
      } else { ex.name = msg.name; }
      ws.send(JSON.stringify({ type: "joined", id }));
      broadcastState();
      return;
    }

    if (msg.type === "start" && game.phase === "lobby" && game.players.length >= 2) startGame();
    if (msg.type === "claim") handleClaim(pid, msg.claim);
    if (msg.type === "bs") handleBS(pid);
    if (msg.type === "restart") {
      for (const p of game.players) { p.eliminated = false; p.cards = []; }
      game.phase = "lobby";
      broadcastState();
      addLog("Game reset.");
    }
    if (msg.type === "leave") {
      game.players = game.players.filter(p => p.id !== pid);
      clients.delete(ws);
      broadcastState();
    }
  });
  ws.on("close", () => clients.delete(ws));
});

app.get("/health", (_, res) => res.json({ ok: true, players: game.players.length, phase: game.phase }));
server.listen(PORT, () => console.log(`🃏 BS Poker server on :${PORT}`));
