/* game.js — สายพานของ Who the fuq are you
   ─────────────────────────────────────────────────────────────
   ต่อ rules.js (กติกาบริสุทธิ์) + effects.js (ผลการ์ด 40 ใบ) เข้ากับห้อง
   แจกลามะลงข้อมูลลับ · สร้างสำรับ · เดินเฟส · รับ action

   เฟส: announce → event → talk → challenge → (รอบใหม่) event ...
   ระบบ pending: การ์ดที่ต้องเลือกจะตั้ง state.pending ค้างไว้ เฟสหยุดรอจนตอบครบ */

import {
  PHASE, MAX_HAND, createGame, dealLlamas, buildDeck,
  eventFlippers, firstChallenger, nextChallenger,
  resolveChallenge, winner, timeoutAction, isOut, activeSeats
} from './rules.js';
import { cardById, traitsOf } from './data.js';
import { makeApi, startCard, resolveCard } from './effects.js';

const TALK_MS = 120000;
const TURN_MS = 60000;

const clone = (s) => structuredClone(s);

/* ── สร้างเกม ─────────────────────────────────────────────── */
export function init({ members, settings }) {
  const players = members.filter(m => m.role === 'player' && !m.left).map(m => m.uid);
  const seats = players.slice(0, 10);
  const names = Object.fromEntries(members.map(m => [m.uid, m.name || '']));

  const state = createGame({ seats, names });
  applySettings(state, settings);
  state.pending = null;
  state.pairs = []; state.mute = []; state.protect = []; state.noChallenge = 0; state.roundMod = null;

  const { assign, removed } = dealLlamas(seats);
  const deck = buildDeck();
  const secrets = { _deck: { deck, removed } };
  seats.forEach(uid => { secrets[uid] = { llama: assign[uid], hand: [], seen: [] }; });

  state.deadline = null;
  return { state, secrets };
}

function applySettings(state, settings = {}) {
  state.talkSeconds = Number(settings.talkSeconds ?? 120);
  state.turnSeconds = Number(settings.turnSeconds ?? 60);
}

/* ── ข้อมูลลับช่วยอ่าน ─────────────────────────────────────── */
const deckOf = (ctx) => ctx.secrets?._deck?.deck || [];
const removedOf = (ctx) => ctx.secrets?._deck?.removed || [];
const assignOf = (ctx) => Object.fromEntries(
  Object.entries(ctx.secrets || {}).filter(([k]) => k !== '_deck').map(([uid, v]) => [uid, v.llama]));
const handOf = (ctx, uid) => ctx.secrets?.[uid]?.hand || [];
const holdsCard = (ctx, uid, id) => (ctx.secrets?.[uid]?.hand || []).includes(id);

/* ── log ──────────────────────────────────────────────────── */
function logInto(st, key, args = {}) {
  st.logSeq = (st.logSeq || 0) + 1;
  st.log = [...(st.log || []), { key, at: st.logSeq, args }].slice(-60);
}

/* รันงานบนสำเนาสถานะ + เก็บ secret patch ผ่าน api */
function run(ctx, fn) {
  const g = clone(ctx.state);
  const api = makeApi(g, ctx);
  const ok = fn(g, api);
  if (ok === false) return null;
  return { state: g, secrets: api.patch };
}

/* ── action ที่ทำได้ตอนนี้ ─────────────────────────────────── */
export function actionsFor(st, uid, ctx) {
  if (!st || !st.phase || st.phase === PHASE.OVER) return [];
  const out = [];
  if (st.pending) {                                   /* มี pending = ตอบก่อน อย่างอื่นหยุด */
    if ((st.pending.waiting || []).includes(uid)) out.push('resolve');
    return out;
  }
  if (ctx?.isHost) out.push('advance');
  if (st.phase === PHASE.ANNOUNCE) {
    if (!isOut(st, uid) && !st.announced.includes(uid)) out.push('announce');
  } else if (st.phase === PHASE.EVENT) {
    if (st.slots.some(s => s && s.by === uid && !s.done)) out.push('flip');
  } else if (st.phase === PHASE.TALK) {
    if ((ctx?.secret?.hand || []).length) out.push('playHeld');
  } else if (st.phase === PHASE.CHALLENGE) {
    if (st.chTurn === uid && !(st.mute || []).includes(uid)) { out.push('challenge'); out.push('skip'); }
    if ((ctx?.secret?.hand || []).length) out.push('playHeld');
  }
  return out;
}

/* ── รับ action ───────────────────────────────────────────── */
export async function onAction(ctx, { uid, type, payload = {} }) {
  const st = ctx.state;
  if (!st || st.phase === PHASE.OVER) return null;

  if (type === 'resolve')  return doResolve(ctx, uid, payload);
  if (st.pending) return null;                        /* ระหว่าง pending ทำได้แค่ resolve */

  if (type === 'advance')  return ctx.isHost ? advance(ctx) : null;
  if (type === 'announce') return doAnnounce(ctx, uid, payload.text || '');
  if (type === 'flip')     return doFlip(ctx, uid, payload.slot);
  if (type === 'playHeld') return doPlayHeld(ctx, uid, payload.card);
  if (type === 'challenge') return doChallenge(ctx, uid, payload.target, payload.guess);
  if (type === 'skip')     return doSkip(ctx, uid);
  if (type === 'devFlip')  return ctx.isHost ? doDevFlip(ctx, uid, payload.card) : null;
  return null;
}

/* ── เฟสประกาศตัว ─────────────────────────────────────────── */
function doAnnounce(ctx, uid, text) {
  const st = ctx.state;
  if (st.phase !== PHASE.ANNOUNCE || st.announced.includes(uid)) return null;
  return run(ctx, (g, api) => {
    g.announced = [...g.announced, uid];
    api.log('wtf.log.announced', { name: g.names[uid] || '?', text: String(text).slice(0, 200) });
  });
}

/* ── เดินเฟส ──────────────────────────────────────────────── */
function advance(ctx) {
  const st = ctx.state;
  if (st.pending) return null;
  if (st.phase === PHASE.ANNOUNCE) return enterEvent(ctx, st);
  if (st.phase === PHASE.EVENT)    return enterTalk(ctx, st);
  if (st.phase === PHASE.TALK)     return enterChallenge(ctx, st);
  if (st.phase === PHASE.CHALLENGE) return endRoundOrNext(ctx, st);
  return null;
}

function enterEvent(ctx, st0) {
  return run(ctx, (g, api) => {
    const flippers = eventFlippers(g);
    const deck = [...deckOf(ctx)];
    const slots = flippers.map(by => ({ by, card: deck.shift() || null, done: false }));
    while (slots.length < 2) slots.push(null);
    g.phase = PHASE.EVENT; g.flippers = flippers; g.slots = slots; g.deadline = null;
    api.patch._deck = { deck, removed: removedOf(ctx) };
    api.log('wtf.log.eventPhase', { round: g.round });
  });
}

function enterTalk(ctx, st) {
  return run(ctx, (g, api) => {
    const secs = g.talkSeconds || 0;
    g.phase = PHASE.TALK; g.deadline = secs ? Date.now() + secs * 1000 : null;
    api.log('wtf.log.talkPhase');
  });
}

function enterChallenge(ctx, st) {
  return run(ctx, (g, api) => {
    g.phase = PHASE.CHALLENGE;
    g.chTurn = firstChallenger(g); g.chDone = []; g.used = []; g.mute = g.mute || [];
    const secs = g.turnSeconds || 0;
    g.deadline = g.chTurn && secs ? Date.now() + secs * 1000 : null;
    api.log('wtf.log.challengePhase');
  });
}

/* ── เฟส EVENT — พลิกการ์ด แล้วรันผล ───────────────────────── */
function doFlip(ctx, uid, slotIdx) {
  const st = ctx.state;
  if (st.phase !== PHASE.EVENT) return null;
  const idx = Number(slotIdx);
  const slot = st.slots[idx];
  if (!slot || slot.by !== uid || slot.done || !slot.card) return null;

  return run(ctx, (g, api) => {
    g.slots = g.slots.map((s, i) => i === idx ? { ...s, done: true } : s);
    const card = cardById(slot.card);
    if (card && card.timing === 'P2') {
      const hand = api.getHand(uid);
      if (hand.length < MAX_HAND) { hand.push(card.id); api.setHand(uid, hand); }
      api.log('wtf.log.held', { name: g.names[uid] || '?', card: card.id });
    } else {
      api.log('wtf.log.flipped', { name: g.names[uid] || '?', card: card ? card.id : '?' });
      startCard(g, slot.card, uid, ctx, api, false);
    }
  });
}

/* ── ใช้การ์ดในมือ (P2) ────────────────────────────────────── */
function doPlayHeld(ctx, uid, cardId) {
  if (!holdsCard(ctx, uid, cardId)) return null;
  return run(ctx, (g, api) => {
    const hand = api.getHand(uid).filter(c => c !== cardId);
    api.setHand(uid, hand);
    api.log('wtf.log.played', { name: g.names[uid] || '?', card: cardId });
    startCard(g, cardId, uid, ctx, api, true);
  });
}

/* ── ตอบ pending ──────────────────────────────────────────── */
function doResolve(ctx, uid, payload) {
  const st = ctx.state;
  const p = st.pending;
  if (!p || !(p.waiting || []).includes(uid)) return null;

  /* pending ที่ game.js ดูแลเอง (ทายลามะ) เพราะต้องแตะ out/known */
  if (p.kind === 'freeGuess') return resolveFreeGuess(ctx, uid, payload);
  if (p.kind === 'duelGuess') return resolveDuel(ctx, uid, payload);
  if (p.kind === 'guessBack') return resolveGuessBack(ctx, uid, payload);

  /* ที่เหลือส่งให้ effects.js */
  return run(ctx, (g, api) => { resolveCard(g, p.card, uid, payload, ctx, api); });
}

/* ── เฟส CHALLENGE ────────────────────────────────────────── */
function challengeBlocked(st, ctx, uid, target) {
  if (st.noChallenge === st.round) return 'truce';
  if ((st.protect || []).includes(target)) return 'protected';
  if ((st.mute || []).includes(uid)) return 'muted';
  const pair = (st.pairs || []).find(pp =>
    ((pp.a === uid && pp.b === target) || (pp.a === target && pp.b === uid)) && st.round < pp.until);
  if (pair) return 'friend';
  return null;
}

function doChallenge(ctx, uid, target, guess) {
  const st = ctx.state;
  if (st.phase !== PHASE.CHALLENGE || st.chTurn !== uid) return null;
  if (!target || target === uid || isOut(st, target)) return null;
  if (challengeBlocked(st, ctx, uid, target)) return null;

  return run(ctx, (g, api) => {
    applyChallenge(g, api, ctx, uid, target, guess, { free: false });
    if (winner(g)) { finishInto(g, winner(g)); return; }
    if (!g.pending) advanceChallengeInto(g);
  });
}

/* แกนการทาย — ใช้ทั้ง challenge ปกติและทายฟรี */
function applyChallenge(g, api, ctx, uid, target, guess, { free }) {
  const res = resolveChallenge(assignOf(ctx), target, guess);
  if (!res.ok) return;

  /* vanish: เป้าถือการ์ดหายตัว → ยกเลิกการทายนี้ */
  if (holdsCard(ctx, target, 'vanish')) {
    const hand = (ctx.secrets?.[target]?.hand || []).filter(c => c !== 'vanish');
    api.setHand(target, hand);
    api.log('wtf.fx.vanished', { name: g.names[target] || '?' });
    if (!free) { g.used = [...g.used, uid]; g.chDone = [...g.chDone, uid]; }
    return;
  }

  /* ป้าข้างบ้าน: คนถือ nosey แอบรู้ว่าใครทายอะไร */
  g.seats.forEach(u => {
    if (u !== uid && !isOut(g, u) && holdsCard(ctx, u, 'nosey'))
      api.see(u, 'wtf.seen.nosey', { a: g.names[uid] || '?', b: g.names[target] || '?', llama: guess });
  });

  if (res.correct) {
    /* ดวลเดือด (การ์ด lastduel): เป้าทายกลับได้ก่อนออก */
    if (holdsCard(ctx, target, 'lastduel')) {
      const hand = (ctx.secrets?.[target]?.hand || []).filter(c => c !== 'lastduel');
      api.setHand(target, hand);
      api.pending({ card: 'lastduel', by: target, kind: 'guessBack', waiting: [target], data: { guesser: uid, target } });
      if (!free) { g.used = [...g.used, uid]; g.chDone = [...g.chDone, uid]; }
      return;
    }
    g.out = [...g.out, target];
    if (!g.chStart || g.chStart === target) g.chStart = target;
    if (!g.firstChallenged) g.firstChallenged = target;
    api.log('wtf.log.hit', { a: g.names[uid] || '?', b: g.names[target] || '?' });
  } else if (!free) {
    /* โทษทายผิด (ร่าง): เปิดจุดเด่นสุ่มของผู้ทายให้ทั้งวง · manlyroad = 2 ข้อ */
    const n = g.roundMod?.penalty2 ? 2 : 1;
    const mine = [...traitsOf(assignOf(ctx)[uid])].sort(() => Math.random() - 0.5).slice(0, n);
    mine.forEach(tr => api.reveal(uid, tr, 'yes'));
    api.log('wtf.log.miss', { a: g.names[uid] || '?', b: g.names[target] || '?' });
  } else {
    api.log('wtf.log.missFree', { a: g.names[uid] || '?', b: g.names[target] || '?' });
  }

  if (!free) { g.used = [...g.used, uid]; g.chDone = [...g.chDone, uid]; }
}

function resolveFreeGuess(ctx, uid, payload) {
  return run(ctx, (g, api) => {
    const forced = g.pending?.data?.forced;
    api.clear();
    if (payload.target && payload.guess)
      applyChallenge(g, api, ctx, uid, payload.target, payload.guess, { free: !forced });
    if (winner(g)) finishInto(g, winner(g));
  });
}

function resolveDuel(ctx, uid, payload) {
  const st = ctx.state;
  return run(ctx, (g, api) => {
    const d = g.pending.data;
    d.guesses = { ...d.guesses, [uid]: payload.guess };
    g.pending.waiting = g.pending.waiting.filter(u => u !== uid);
    if (g.pending.waiting.length) return;              /* รออีกฝ่าย */
    const { a, b, guesses } = d;
    const assign = assignOf(ctx);
    const aRight = guesses[a] === assign[b];
    const bRight = guesses[b] === assign[a];
    api.clear();
    if (aRight) { g.out = [...g.out, b]; api.log('wtf.log.hit', { a: g.names[a] || '?', b: g.names[b] || '?' }); }
    else { const t = rndTrait(assign[a]); if (t) api.reveal(a, t, 'yes'); }
    if (bRight && !isOut(g, b)) { g.out = [...g.out, a]; api.log('wtf.log.hit', { a: g.names[b] || '?', b: g.names[a] || '?' }); }
    else if (!bRight) { const t = rndTrait(assign[b]); if (t) api.reveal(b, t, 'yes'); }
    if (winner(g)) finishInto(g, winner(g));
    else advanceChallengeInto(g);
  });
}

function resolveGuessBack(ctx, uid, payload) {
  return run(ctx, (g, api) => {
    const { guesser, target } = g.pending.data;
    const assign = assignOf(ctx);
    api.clear();
    g.out = [...g.out, target];                        /* ผู้ถูกทายถูกต้องออกอยู่ดี */
    if (payload.guess === assign[guesser]) {           /* ทายกลับถูก → ผู้ทายเดิมออกด้วย */
      g.out = [...g.out, guesser];
      api.log('wtf.log.guessBackHit', { a: g.names[target] || '?', b: g.names[guesser] || '?' });
    } else {
      api.log('wtf.log.hit', { a: g.names[guesser] || '?', b: g.names[target] || '?' });
    }
    if (winner(g)) { finishInto(g, winner(g)); return; }
    advanceChallengeInto(g);
  });
}

function doSkip(ctx, uid) {
  const st = ctx.state;
  if (st.phase !== PHASE.CHALLENGE || st.chTurn !== uid) return null;
  return run(ctx, (g, api) => {
    g.chDone = [...g.chDone, uid];
    api.log('wtf.log.skipped', { name: g.names[uid] || '?' });
    advanceChallengeInto(g);
  });
}

function advanceChallengeInto(g) {
  const nxt = nextChallenger(g);
  if (nxt == null) { g.chTurn = null; g.deadline = null; return; }
  const secs = g.turnSeconds || 0;
  g.chTurn = nxt; g.deadline = secs ? Date.now() + secs * 1000 : null;
}

/* ── จบรอบ → รอบใหม่ ─────────────────────────────────────── */
function endRoundOrNext(ctx, st) {
  if (winner(st)) return run(ctx, (g) => { finishInto(g, winner(g)); });
  return run(ctx, (g, api) => {
    const nobodyOut = !(g.log || []).some(e => e.key === 'wtf.log.hit' && e.at > (g._roundMark || 0));
    const nextNoOut = nobodyOut ? (g.noOut || 0) + 1 : 0;
    const n = g.seats.length;
    g.round += 1;
    g.flipCursor = (g.flipCursor + 2) % n;
    g.slots = [null, null]; g.flippers = [];
    g.chTurn = null; g.chDone = []; g.used = [];
    g.mute = []; g.protect = []; g.roundMod = null;
    if (g.noChallenge && g.noChallenge < g.round) g.noChallenge = 0;
    g.chStart = g.firstChallenged || g.chStart; g.firstChallenged = null;
    g.noOut = nextNoOut; g.forceCrack = nextNoOut >= 2;
    g._roundMark = g.logSeq; g.deadline = null;
    api.log('wtf.log.roundEnd', { round: g.round - 1 });
    /* เข้าเฟส event รอบใหม่เลย */
    const flippers = eventFlippers(g);
    const deck = [...deckOf(ctx)];
    const slots = flippers.map(by => ({ by, card: deck.shift() || null, done: false }));
    while (slots.length < 2) slots.push(null);
    g.phase = PHASE.EVENT; g.flippers = flippers; g.slots = slots;
    api.patch._deck = { deck, removed: removedOf(ctx) };
    api.log('wtf.log.eventPhase', { round: g.round });
  });
}

function finishInto(g, winnerUid) {
  g.phase = PHASE.OVER; g.chTurn = null; g.deadline = null; g.pending = null;
  g.result = { winner: winnerUid, name: g.names[winnerUid] || '?' };
}

/* ── เครื่องมือทดสอบ ?dev=card — เสกการ์ดมารันผลทันที (host) ─── */
function doDevFlip(ctx, uid, cardId) {
  if (!cardById(cardId)) return null;
  return run(ctx, (g, api) => {
    api.log('wtf.log.devFlip', { card: cardId });
    startCard(g, cardId, uid, ctx, api, false);
  });
}

/* ── ตัวช่วย ───────────────────────────────────────────────── */
function rndTrait(llamaId) {
  const t = traitsOf(llamaId);
  return t.length ? t[Math.floor(Math.random() * t.length)] : null;
}

/* ── หมดเวลา ──────────────────────────────────────────────── */
export async function tick(ctx) {
  const st = ctx.state;
  if (!st || !st.deadline || st.phase === PHASE.OVER || st.pending) return null;
  if (Date.now() < st.deadline) return null;
  const act = timeoutAction(st);
  if (act && act.type === 'skip') return doSkip(ctx, act.uid);
  if (st.phase === PHASE.TALK) return enterChallenge(ctx, st);
  return null;
}
