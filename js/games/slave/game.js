/* game.js — สลาฟ ฝั่งกติกา ต่อกับสัญญาของแพลตฟอร์ม
   ─────────────────────────────────────────────────────────────
   init / onAction / tick รันที่เครื่องเจ้าของห้องเท่านั้น
   และเป็นฟังก์ชันบริสุทธิ์ — ไม่เก็บอะไรไว้ในหน่วยความจำเลย
   ทุกอย่างอ่านจาก state กับ secrets ที่ส่งเข้ามา แล้วคืนของใหม่ออกไป
   เจ้าของห้องจึงเปลี่ยนตัวได้กลางเกมโดยไม่ต้องส่งต่ออะไร

   ช่วงของเกม
     exchange   แลกไพ่ก่อนเริ่มรอบสองเป็นต้นไป
     play       เล่นจริง
     roundEnd   จบรอบ ประกาศอันดับ รอไปต่อ
     gameOver   จบเกม
   ───────────────────────────────────────────────────────────── */

import {
  createRound, apply, ranking, titles, timeoutAction,
  handCounts, exchangePairs, applyExchange, PHASE
} from './engine.js';
import { readCombo, bestCards } from './cards.js';
import { rankPoints, playPoints, toppleBonus, addScores } from './score.js';

const MIN_PLAYERS = 4;

/* ── ตัวช่วย ───────────────────────────────────────────────── */

const seatedPlayers = (members) =>
  members.filter(m => m.role === 'player' && m.seat !== null && m.seat !== undefined)
         .sort((a, b) => a.seat - b.seat);

/* ประกอบสถานะเครื่องเกมกลับมาจากสถานะสาธารณะ + ไพ่ในมือทุกคน */
const hydrate = (st, secrets) => ({
  roundNo: st.roundNo,
  seats: st.seats,
  dir: st.dir,
  turn: st.turn,
  pile: st.pile || null,
  passed: st.passed || [],
  finished: st.finished || [],
  toppled: st.toppled || null,
  king: st.king || null,
  mustInclude: st.mustInclude || null,
  chain: st.chain || 0,
  phase: PHASE.PLAY,
  events: [],
  hands: Object.fromEntries(st.seats.map(u => [u, (secrets[u] && secrets[u].hand) || []]))
});

/* ถอดไพ่ในมือออก เหลือแต่ของที่ทุกคนเห็นได้ */
const publish = (g, base) => ({
  ...base,
  dir: g.dir,
  turn: g.turn,
  pile: g.pile,
  passed: g.passed,
  finished: g.finished,
  toppled: g.toppled,
  king: g.king,
  mustInclude: g.mustInclude,
  chain: g.chain,
  counts: handCounts(g)
});

/* เขียนเฉพาะมือที่เปลี่ยนจริง ไม่ต้องเขียนทั้งวงทุกครั้ง */
function changedHands(before, after) {
  const out = {};
  for (const uid of Object.keys(after)) {
    const a = before[uid] || [], b = after[uid];
    if (a.length !== b.length || a.some((c, i) => c !== b[i])) out[uid] = { hand: b };
  }
  return out;
}

const allHands = (g) =>
  Object.fromEntries(Object.entries(g.hands).map(([u, h]) => [u, { hand: h }]));

/* ตั้งเวลาหมดตาใหม่ทุกครั้งที่เปลี่ยนตา — เก็บไว้ในสถานะสาธารณะ
   เจ้าของห้องคนใหม่จึงตั้งนาฬิกาต่อได้เองโดยไม่ต้องรู้อะไรเพิ่ม */
const withClock = (st) => ({
  ...st,
  deadline: (st.phase === 'play' && st.turnSeconds > 0 && st.turn)
    ? Date.now() + st.turnSeconds * 1000
    : null
});

const nameMap = (members) => Object.fromEntries(members.map(m => [m.uid, m.name || '']));

/* ── เริ่มเกม ──────────────────────────────────────────────── */

export function init(ctx) {
  const players = seatedPlayers(ctx.members);
  const seats = players.map(p => p.uid);
  const g = createRound({ seats, roundNo: 1 });

  const state = withClock(publish(g, {
    phase: 'play',
    roundNo: 1,
    mode: ctx.settings.mode || 'normal',
    turnSeconds: Number(ctx.settings.turnSeconds || 0),
    seats,
    names: nameMap(ctx.members),
    scores: Object.fromEntries(seats.map(u => [u, 0])),
    gained: null,
    ranking: null,
    prevRanking: null,
    votes: {},
    exchange: null,
    notice: null
  }));

  return { state, secrets: allHands(g) };
}

/* ── คำขอจากผู้เล่น ────────────────────────────────────────── */

export async function onAction(ctx, action) {
  const st = ctx.state;
  const { uid, type, payload = {} } = action;

  if (st.phase === 'play' && (type === 'play' || type === 'pass')) {
    return move(ctx, st, { type, uid, cards: payload.cards });
  }
  if (st.phase === 'exchange' && type === 'give') return give(ctx, st, uid, payload.cards);
  if (st.phase === 'roundEnd' && type === 'vote') return vote(ctx, st, uid, !!payload.yes);
  if (st.phase === 'roundEnd' && type === 'next' && uid === ctx.hostUid) return nextRound(ctx, st);
  return null;
}

/* ── ลงไพ่ / ผ่าน ──────────────────────────────────────────── */

function move(ctx, st, act) {
  const g = hydrate(st, ctx.secrets);
  const before = { ...g.hands };
  const r = apply(g, act.type === 'play'
    ? { type: 'play', uid: act.uid, cards: act.cards }
    : { type: 'pass', uid: act.uid });

  if (r.error) return null;                 // คำขอผิดกติกา ทิ้งเงียบ ๆ
  const g2 = r.state;

  let state = publish(g2, { ...st, notice: null });

  if (st.mode === 'endless' && act.type === 'play') {
    const combo = readCombo(act.cards);
    state.scores = addScores(st.scores, { [act.uid]: playPoints(combo.size, g2.chain || 1) });
  }
  if (g2.toppled && !st.toppled) {
    state.notice = { t: 'topple', by: g2.finished[0], king: g2.toppled };
  }

  const secrets = changedHands(before, g2.hands);

  if (g2.phase === PHASE.DONE) return endRound(ctx, state, g2, secrets);
  return { state: withClock(state), secrets };
}

/* ── นาฬิกาหมดตา ───────────────────────────────────────────── */

export async function tick(ctx) {
  const st = ctx.state;
  if (st.phase !== 'play' || !st.deadline || Date.now() < st.deadline - 250) return null;

  const g = hydrate(st, ctx.secrets);
  const act = timeoutAction(g);
  if (!act) return null;

  const out = move(ctx, st, act.type === 'play'
    ? { type: 'play', uid: act.uid, cards: act.cards }
    : { type: 'pass', uid: act.uid });

  if (out && out.state) out.state = { ...out.state, notice: { t: 'timeout', uid: act.uid } };
  return out;
}

/* ── จบรอบ ─────────────────────────────────────────────────── */

function endRound(ctx, state, g, secrets) {
  const rank = ranking(g);
  const titled = titles(rank);
  let scores = state.scores;
  let gained = null;

  if (state.mode === 'endless') {
    const delta = rankPoints(titled, g.toppled);
    if (g.toppled) {
      const toppler = g.finished[0];
      const prev = (state.prevRanking || []).indexOf(toppler);
      const prevTitle = prev >= 0 ? titles(state.prevRanking)[prev].title : 'people';
      delta[toppler] = (delta[toppler] || 0) + toppleBonus(prevTitle);
    }
    scores = addScores(scores, delta);
    gained = delta;
  }

  const twoRoundsDone = state.mode === 'normal' && state.roundNo >= 2;

  return {
    state: {
      ...state,
      phase: twoRoundsDone ? 'gameOver' : 'roundEnd',
      deadline: null,
      ranking: rank,
      titles: titled,
      scores,
      gained,
      votes: {}
    },
    secrets
  };
}

/* ── รอบถัดไป ──────────────────────────────────────────────── */

function nextRound(ctx, st) {
  const players = seatedPlayers(ctx.members);
  const seats = players.map(p => p.uid);

  if (seats.length < MIN_PLAYERS) {
    return { state: { ...st, phase: 'gameOver', deadline: null, notice: { t: 'tooFew' } } };
  }

  // คนที่ออกจากห้องไปแล้วหลุดจากอันดับเอง = เลื่อนอันดับขึ้นทั้งวง
  const prevRanking = (st.ranking || []).filter(u => seats.includes(u));
  const g = createRound({ seats, roundNo: st.roundNo + 1, prevRanking });

  const base = publish(g, {
    ...st,
    roundNo: st.roundNo + 1,
    seats,
    names: { ...st.names, ...nameMap(ctx.members) },
    prevRanking,
    ranking: null,
    titles: null,
    gained: null,
    votes: {},
    notice: null
  });

  const pairs = prevRanking.length >= MIN_PLAYERS ? exchangePairs(prevRanking) : [];
  if (!pairs.length) {
    return { state: withClock({ ...base, phase: 'play', exchange: null }), secrets: allHands(g) };
  }
  return {
    state: { ...base, phase: 'exchange', deadline: null, exchange: { pairs, given: {} } },
    secrets: allHands(g)
  };
}

/* ── แลกไพ่ ────────────────────────────────────────────────── */

function give(ctx, st, uid, cards) {
  const ex = st.exchange;
  const pair = ex.pairs.find(p => p.upper === uid);
  if (!pair || ex.given[uid]) return null;

  const hand = (ctx.secrets[uid] && ctx.secrets[uid].hand) || [];
  if (!Array.isArray(cards) || cards.length !== pair.count) return null;
  if (new Set(cards).size !== cards.length) return null;
  if (!cards.every(c => hand.includes(c))) return null;

  const given = { ...ex.given, [uid]: cards };
  const waiting = ex.pairs.some(p => !given[p.upper]);
  if (waiting) return { state: { ...st, exchange: { ...ex, given } } };

  // ครบทุกคู่แล้ว สลับไพ่จริง — ฝั่งล่างเลือกไม่ได้ ระบบหยิบใบดีที่สุดให้
  let hands = Object.fromEntries(st.seats.map(u => [u, [...((ctx.secrets[u] || {}).hand || [])]]));
  for (const p of ex.pairs) {
    const fromLower = bestCards(hands[p.lower], p.count);
    hands = applyExchange(hands, p.upper, p.lower, given[p.upper], fromLower);
  }

  const counts = Object.fromEntries(Object.entries(hands).map(([u, h]) => [u, h.length]));
  return {
    state: withClock({ ...st, phase: 'play', exchange: null, counts }),
    secrets: Object.fromEntries(Object.entries(hands).map(([u, h]) => [u, { hand: h }]))
  };
}

/* ── โหวตเล่นต่อ ───────────────────────────────────────────── */

function vote(ctx, st, uid, yes) {
  if (!st.seats.includes(uid)) return null;
  const votes = { ...st.votes, [uid]: yes };
  const here = seatedPlayers(ctx.members).map(p => p.uid);
  const waiting = here.some(u => votes[u] === undefined);

  if (waiting) return { state: { ...st, votes } };
  if (here.every(u => votes[u])) return nextRound(ctx, { ...st, votes });
  return { state: { ...st, votes, phase: 'gameOver', deadline: null } };
}
