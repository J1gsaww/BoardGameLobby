/* engine.js — เครื่องเกมสลาฟ หนึ่งรอบ
   ─────────────────────────────────────────────────────────────
   ฟังก์ชันบริสุทธิ์ล้วน ไม่แตะ DOM ไม่แตะ Firebase ไม่เก็บสถานะไว้เอง
   รับสถานะเข้า คืนสถานะใหม่ออก — เพราะเจ้าของห้องย้ายเครื่องได้กลางเกม
   เครื่องใหม่ต้องคิดต่อจากสถานะเดียวกันแล้วได้ผลเดียวกันเป๊ะ

   ผังสถานะ
     seats      ที่นั่งตามลำดับ ไม่เปลี่ยนทั้งรอบ
     hands      ไพ่ในมือของทุกคน (ผู้เรียกเป็นคนแยกว่าใครเห็นของใคร)
     dir        1 = ตามเข็ม · -1 = ทวนเข็ม
     turn       ตาของใคร
     pile       ชุดที่อยู่บนกอง + คนลง · null = กองว่าง
     passed     คนที่ผ่านไปแล้วในกองนี้ ผ่านแล้วกลับมาลงอีกไม่ได้
     finished   ลำดับคนที่หมดไพ่
     toppled    คิงที่โดนล้ม ตกเป็นสลาฟทันทีและทิ้งไพ่
     king       คิงของรอบก่อน คนที่ล้มได้ · null ในรอบแรก
     chain      จำนวนครั้งที่ลงตอง/โฟร์ในกองนี้ เอาไว้คิดคะแนน
   ───────────────────────────────────────────────────────────── */

import {
  readCombo, beats, deal, sortHand, fleeDirection,
  forcedLead, rankIndex, BASE, RANKS
} from './cards.js';

const EIGHT = RANKS.indexOf('8');

export const PHASE = { PLAY: 'play', DONE: 'done' };

/* ── สร้างรอบใหม่ ──────────────────────────────────────────── */

/* prevRanking = ลำดับตำแหน่งของรอบก่อน คิงอยู่หน้าสุด สลาฟอยู่ท้ายสุด
   ต้องกรองคนที่ออกจากห้องไปแล้วออกก่อนส่งเข้ามา (เลื่อนอันดับขึ้นทั้งวง) */
export function createRound({ seats, roundNo = 1, prevRanking = null, hands = null, rng = Math.random, rules = BASE }) {
  if (!seats || seats.length < 2) throw new Error('ต้องมีที่นั่งอย่างน้อย 2 ที่');

  const dealt = hands || Object.fromEntries(
    deal(seats.length, rng, rules).map((h, i) => [seats[i], h])
  );

  const state = {
    roundNo,
    seats: [...seats],
    hands: Object.fromEntries(Object.entries(dealt).map(([u, h]) => [u, sortHand(h)])),
    dir: 1,
    turn: null,
    pile: null,
    passed: [],
    finished: [],
    toppled: null,
    king: null,
    mustInclude: null,
    chain: 0,
    revolution: false,          // ปฏิวัติเริ่มใหม่ทุกรอบ
    phase: PHASE.PLAY,
    events: []
  };

  if (prevRanking && prevRanking.length) {
    // รอบสองเป็นต้นไป สลาฟเริ่ม ทิศวนแบบหนีคิง
    const king = prevRanking[0];
    const slave = prevRanking[prevRanking.length - 1];
    state.king = seats.includes(king) ? king : null;
    state.turn = seats.includes(slave) ? slave : seats[0];
    state.dir = fleeDirection(seats.indexOf(state.turn), state.king ? seats.indexOf(state.king) : null, seats.length);
  } else {
    // รอบแรก คนถือดอกจิก 3 เริ่ม และต้องลงใบนั้นในกองแรก
    const opening = rules.openingCard || null;
    state.turn = (opening && seats.find(u => state.hands[u].includes(opening))) || seats[0];
    state.mustInclude = opening;
    state.dir = 1;
  }
  return state;
}

/* ── ตัวช่วยอ่านสถานะ ──────────────────────────────────────── */

export const isOut = (s, uid) => s.finished.includes(uid) || s.toppled === uid;
export const activeSeats = (s) => s.seats.filter(u => !isOut(s, u));
export const handCounts = (s) =>
  Object.fromEntries(s.seats.map(u => [u, isOut(s, u) ? 0 : s.hands[u].length]));

/* คนถัดไปที่ยังลงได้ในกองนี้ — ข้ามคนที่ออกไปแล้วและคนที่ผ่านแล้ว */
function nextTurn(s, from, { skipPassed = true } = {}) {
  const n = s.seats.length;
  let i = s.seats.indexOf(from);
  for (let step = 0; step < n; step++) {
    i = (i + s.dir + n) % n;
    const uid = s.seats[i];
    if (isOut(s, uid)) continue;
    if (skipPassed && s.passed.includes(uid)) continue;
    return uid;
  }
  return null;
}

/* ── ตรวจว่าลงได้ไหม ───────────────────────────────────────── */

export function whyNotPlay(s, uid, cards, rules = BASE) {
  if (s.phase !== PHASE.PLAY) return 'roundOver';
  if (s.turn !== uid) return 'notYourTurn';
  if (isOut(s, uid)) return 'youAreOut';

  const hand = s.hands[uid] || [];
  if (!cards || !cards.length) return 'noCards';
  if (new Set(cards).size !== cards.length) return 'duplicate';
  if (!cards.every(c => hand.includes(c))) return 'notInHand';
  if (!readCombo(cards, rules)) return 'notACombo';
  if (s.mustInclude && !cards.includes(s.mustInclude)) return 'mustIncludeOpening';
  if (!beats(cards, s.pile, rules, !!s.revolution)) return 'tooWeak';
  return null;
}

export const canPlay = (s, uid, cards, rules = BASE) => whyNotPlay(s, uid, cards, rules) === null;

export function whyNotPass(s, uid) {
  if (s.phase !== PHASE.PLAY) return 'roundOver';
  if (s.turn !== uid) return 'notYourTurn';
  if (isOut(s, uid)) return 'youAreOut';
  if (!s.pile) return 'mustLead';     // คนเริ่มกองผ่านไม่ได้ ต้องลงอะไรสักอย่าง
  return null;
}

/* ── เดินเกม ───────────────────────────────────────────────── */

const clone = (s) => ({
  ...s,
  seats: [...s.seats],
  hands: Object.fromEntries(Object.entries(s.hands).map(([u, h]) => [u, [...h]])),
  passed: [...s.passed],
  finished: [...s.finished],
  pile: s.pile ? { cards: [...s.pile.cards], by: s.pile.by } : null,
  events: [...s.events]
});

export function apply(state, action, rules = BASE) {
  const s = clone(state);
  if (action.type === 'play') {
    const why = whyNotPlay(s, action.uid, action.cards, rules);
    if (why) return { state, error: why };
    doPlay(s, action.uid, action.cards, rules);
  } else if (action.type === 'pass') {
    const why = whyNotPass(s, action.uid);
    if (why) return { state, error: why };
    doPass(s, action.uid);
  } else {
    return { state, error: 'unknownAction' };
  }
  return { state: s, error: null };
}

function doPlay(s, uid, cards, rules = BASE) {
  const combo = readCombo(cards, rules);
  s.hands[uid] = s.hands[uid].filter(c => !cards.includes(c));
  s.pile = { cards: sortHand(cards), by: uid };
  s.mustInclude = null;
  if (combo.tier === 1) s.chain += 1;              // ตองหรือโฟร์ นับไว้คิดคะแนน
  s.events.push({ t: 'play', uid, cards: s.pile.cards, size: combo.size, chain: s.chain });

  // ปฏิวัติ: ลงโฟร์แล้วลำดับไพ่กลับหัว พลิกกี่ครั้งก็ได้ในรอบเดียวกัน
  if (rules.revolution && combo.size === 4) {
    s.revolution = !s.revolution;
    s.events.push({ t: 'revolution', uid, on: s.revolution });
  }

  if (s.hands[uid].length === 0) finish(s, uid);

  // ลงเลข 8 = จบกองทันที คนลงได้เริ่มกองใหม่เอง
  if (rules.eightCut && combo.rank === EIGHT && s.phase === PHASE.PLAY) {
    s.events.push({ t: 'eightCut', uid });
    if (activeSeats(s).length <= 1) { endRound(s); return; }
    endTrick(s, uid);
    return;
  }

  settle(s, uid);
}

function doPass(s, uid) {
  s.passed.push(uid);
  s.events.push({ t: 'pass', uid });
  settle(s, uid);
}

/* คนหมดไพ่ — และถ้าเป็นคนแรกที่หมดในรอบนี้ อาจล้มคิงได้ */
function finish(s, uid) {
  s.finished.push(uid);
  s.events.push({ t: 'finish', uid, place: s.finished.length });

  const firstOut = s.finished.length === 1;
  if (firstOut && s.king && s.king !== uid && !isOut(s, s.king)) {
    s.toppled = s.king;
    s.hands[s.king] = [];                          // คิงที่โดนล้มทิ้งไพ่ ออกจากรอบทันที
    s.passed = s.passed.filter(u => u !== s.king);
    s.events.push({ t: 'topple', by: uid, king: s.king });
  }
}

/* จบกองหรือยัง จบรอบหรือยัง แล้วส่งตาให้ใครต่อ */
function settle(s, actor) {
  if (activeSeats(s).length <= 1) { endRound(s); return; }

  const contenders = activeSeats(s).filter(u => u !== s.pile?.by && !s.passed.includes(u));
  if (s.pile && contenders.length === 0) { endTrick(s); return; }

  s.turn = nextTurn(s, actor);
  if (s.turn === null) endTrick(s);
}

function endTrick(s, forcedWinner) {
  const winner = forcedWinner || s.pile.by;
  const winnerOut = isOut(s, winner);
  s.events.push({ t: 'trick', winner, chain: s.chain, reversed: winnerOut });

  s.pile = null;
  s.passed = [];
  s.chain = 0;

  if (activeSeats(s).length <= 1) { endRound(s); return; }

  if (winnerOut) {
    // คนชนะกองไม่มีไพ่แล้ว — สลับทิศ แล้วค่อยเลือกคนถัดไปในทิศใหม่
    s.dir = -s.dir;
    s.turn = nextTurn(s, winner, { skipPassed: false });
  } else {
    s.turn = winner;                               // คนชนะกองเริ่มกองใหม่ ลงอะไรก็ได้
  }
}

function endRound(s) {
  const left = activeSeats(s);
  s.phase = PHASE.DONE;
  s.turn = null;
  s.pile = null;
  s.passed = [];
  s.events.push({ t: 'roundEnd', ranking: ranking(s) });
  void left;
}

/* ── ผลของรอบ ──────────────────────────────────────────────── */

/* ลำดับตำแหน่ง คิงอยู่หน้าสุด สลาฟอยู่ท้ายสุด
   คิงที่โดนล้มถูกดันไปท้ายสุดเสมอ ไม่ว่าจะเหลือไพ่อยู่เท่าไร */
export function ranking(s) {
  const out = [...s.finished];
  for (const uid of s.seats) {
    if (!out.includes(uid) && uid !== s.toppled) out.push(uid);
  }
  if (s.toppled) out.push(s.toppled);
  return out;
}

/* ชื่อตำแหน่งตามจำนวนคน — คิง ควีน ประชาชน รองสลาฟ สลาฟ */
export function titles(rank) {
  const n = rank.length;
  return rank.map((uid, i) => {
    let title;
    if (i === 0) title = 'king';
    else if (i === 1) title = 'queen';
    else if (i === n - 1) title = 'slave';
    else if (i === n - 2) title = 'viceSlave';
    else title = 'people';
    return { uid, title, place: i + 1 };
  });
}

/* ── ตาที่หมดเวลา ──────────────────────────────────────────── */

/* คนเริ่มกองผ่านไม่ได้ ต้องลงไพ่แต้มน้อยสุดในมือทั้งชุด — ถือเป็นคู่ตองก็เสียทั้งชุด
   คนที่ไม่ได้เริ่มกอง ให้ผ่าน */
export function timeoutAction(s, rules = BASE) {
  const uid = s.turn;
  if (!uid || s.phase !== PHASE.PLAY) return null;
  return s.pile
    ? { type: 'pass', uid }
    : { type: 'play', uid, cards: forcedLead(s.hands[uid], rules, !!s.revolution) };
}

/* ── การแลกไพ่ก่อนเริ่มรอบ ─────────────────────────────────── */

/* ฝั่งล่างยกไพ่ดีที่สุดให้ เลือกเองไม่ได้ · ฝั่งบนคืนอะไรก็ได้
   คืนรายการคู่แลก ผู้เรียกเอาไปถามฝั่งบนว่าจะคืนใบไหน */
export function exchangePairs(rank) {
  const n = rank.length;
  const pairs = [{ upper: rank[0], lower: rank[n - 1], count: 2 }];
  if (n >= 4) pairs.push({ upper: rank[1], lower: rank[n - 2], count: 1 });
  return pairs;
}

export function applyExchange(hands, upper, lower, fromUpper, fromLower) {
  const next = Object.fromEntries(Object.entries(hands).map(([u, h]) => [u, [...h]]));
  next[upper] = sortHand(next[upper].filter(c => !fromUpper.includes(c)).concat(fromLower));
  next[lower] = sortHand(next[lower].filter(c => !fromLower.includes(c)).concat(fromUpper));
  return next;
}

export { rankIndex };
