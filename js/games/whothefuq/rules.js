/* rules.js — กติกาบริสุทธิ์ของ Who the fuq are you
   ─────────────────────────────────────────────────────────────
   ฟังก์ชันล้วน ไม่แตะ DOM ไม่แตะ Firebase ไม่เก็บสถานะไว้เอง
   รับสถานะเข้า คืนสถานะใหม่ออก — เจ้าของห้องย้ายเครื่องกลางเกมได้
   เครื่องใหม่คิดต่อจากสถานะเดียวกันแล้วต้องได้ผลเป๊ะเดิม (เหมือน engine ของสลาฟ)

   ผังสถานะสาธารณะ (state)
     phase     announce · event · talk · challenge · over
     seats     ที่นั่งวนตามเข็ม ล็อกทั้งเกม (คนออกก็ยังอยู่ในลิสต์)
     out       คนที่ถูกทายถูกแล้ว ออกจากเกมตามลำดับ
     round     รอบที่เท่าไร
     slots     การ์ด 2 ใบที่เปิดรอบนี้ [{card,by}|null, ...]
     flipCursor ตำแหน่งที่นั่งของคนเปิดคนแรกในรอบถัดไป (ขยับทีละ 2)
     flippers  uid ของคนเปิดรอบนี้ (สูงสุด 2)
     holdCount จำนวนการ์ดในมือของแต่ละคน (สาธารณะ ตัวไพ่ลับอยู่ secrets)
     known     กระดานจุดเด่นที่วงยืนยันแล้ว {uid:{t1:'yes'|'no',...}}
     chTurn    ตาตัดสิน challenge ของใครตอนนี้
     chDone    คนที่ตัดสินไปแล้วในเฟส challenge นี้
     used      คนที่ใช้สิทธิ์ challenge ของรอบนี้ไปแล้ว
     chStart   คนที่จะเริ่ม challenge ในรอบถัดไป (คนแรกที่โดนทายรอบนี้)
     noOut     กี่รอบติดที่ไม่มีใครออก (กันเกมตัน 2 รอบ = บังคับความแตก)

   ผังข้อมูลลับ (secrets)
     secrets[uid] = { llama, hand:[cardId] }   เห็นได้เฉพาะเจ้าตัว
     secrets._deck = { deck:[cardId], removed:[llamaId] }   เห็นได้เฉพาะ host
   ───────────────────────────────────────────────────────────── */

import { LLAMA_IDS, EVENT_CARDS } from './data.js';

export const PHASE = {
  ANNOUNCE: 'announce',
  EVENT: 'event',
  TALK: 'talk',
  CHALLENGE: 'challenge',
  OVER: 'over'
};

export const MAX_HAND = 2;      /* การ์ด P2 ถือได้สูงสุด 2 ใบ */

/* ── ตัวช่วยสุ่มแบบส่งเมล็ดได้ (เทสได้ซ้ำ) ──────────────────── */
function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* คลี่การ์ดตามจำนวน count ให้เป็นสำรับใบต่อใบ แล้วสับ */
export function buildDeck(rng = Math.random) {
  const flat = [];
  for (const c of EVENT_CARDS) for (let i = 0; i < c.count; i++) flat.push(c.id);
  return shuffle(flat, rng);
}

/* ── แจกลามะ + ถอดลับ ──────────────────────────────────────
   n คน = แจก n ตัว · ที่เหลือ 10−n ตัวถูกถอดออกคว่ำไว้ (10 คน = ไม่มีถอด) */
export function dealLlamas(seats, rng = Math.random) {
  const bag = shuffle(LLAMA_IDS, rng);
  const assign = {};
  seats.forEach((uid, i) => { assign[uid] = bag[i]; });
  const removed = bag.slice(seats.length);
  return { assign, removed };
}

/* ── สร้างสถานะเริ่มเกม (เฟสประกาศตัว) ────────────────────── */
export function createGame({ seats, names = {}, rng = Math.random }) {
  if (!seats || seats.length < 2) throw new Error('ต้องมีผู้เล่นอย่างน้อย 2 คน');
  return {
    phase: PHASE.ANNOUNCE,
    seats: [...seats],
    out: [],
    round: 1,
    slots: [null, null],
    flippers: [],
    flipCursor: 0,
    holdCount: Object.fromEntries(seats.map(u => [u, 0])),
    known: Object.fromEntries(seats.map(u => [u, {}])),
    announced: [],          /* ใครประกาศตัวไปแล้วในเฟส announce */
    chTurn: null,
    chDone: [],
    used: [],
    chStart: null,
    noOut: 0,
    names: { ...names },
    log: [],
    logSeq: 0,
    result: null
  };
}

/* ── ตัวช่วยอ่านสถานะ ──────────────────────────────────────── */
export const isOut = (s, uid) => s.out.includes(uid);
export const activeSeats = (s) => s.seats.filter(u => !isOut(s, u));

/* คนถัดไปที่ยังอยู่ในเกม เริ่มนับจากตำแหน่งที่นั่ง i (ไม่รวมตัวเอง) */
function nextActiveFrom(s, i) {
  const n = s.seats.length;
  for (let step = 1; step <= n; step++) {
    const uid = s.seats[(i + step) % n];
    if (!isOut(s, uid)) return uid;
  }
  return null;
}

/* ── เฟส EVENT — ใครเปิดการ์ด ─────────────────────────────
   เอาคนที่ยังอยู่ 2 คนถัดไปจาก flipCursor · เหลือ 3 คนก็ยังเปิด 2 ใบ
   เหลือ ≤2 คน คืนเท่าที่มี (ปลายเกมเข้าโหมดดวลเดือดแทน) */
export function eventFlippers(s) {
  const active = activeSeats(s);
  if (active.length <= 1) return [];
  const out = [];
  let i = (s.flipCursor - 1 + s.seats.length) % s.seats.length;
  const want = Math.min(2, active.length);
  while (out.length < want) {
    const uid = nextActiveFrom(s, i);
    if (uid == null) break;
    if (!out.includes(uid)) out.push(uid);
    i = s.seats.indexOf(uid);
  }
  return out;
}

/* ── เฟส CHALLENGE — ลำดับการตัดสิน ───────────────────────
   เริ่มจาก chStart (คนแรกที่โดนทายรอบก่อน) ถ้าไม่มีให้เริ่มที่คนเปิดคนแรก
   วนตามเข็ม คนละ 1 ครั้ง (challenge หรือ skip) จนครบวง */
export function firstChallenger(s) {
  const active = activeSeats(s);
  if (!active.length) return null;
  const anchor = (s.chStart && !isOut(s, s.chStart)) ? s.chStart
               : (s.flippers.find(u => !isOut(s, u)) || active[0]);
  return anchor;
}

/* คนถัดไปในเฟส challenge ที่ยังไม่ได้ตัดสิน */
export function nextChallenger(s) {
  const i = s.chTurn == null ? -1 : s.seats.indexOf(s.chTurn);
  const n = s.seats.length;
  for (let step = 1; step <= n; step++) {
    const uid = s.seats[(i + step + n) % n];
    if (!isOut(s, uid) && !s.chDone.includes(uid)) return uid;
  }
  return null;      /* ทุกคนตัดสินครบแล้ว */
}

/* ── เฉลย challenge ───────────────────────────────────────
   ต้องมี assign (host มีครบใน secrets) · pure เมื่อรู้คำเฉลย
   คืนว่าถูกไหม และถ้าถูกใครออก — ไม่แตะ state ตรงนี้ (game.js เป็นคนเขียนผล) */
export function resolveChallenge(assign, targetUid, guessLlama) {
  if (!LLAMA_IDS.includes(guessLlama)) return { ok: false, correct: false };
  return { ok: true, correct: assign[targetUid] === guessLlama };
}

/* ── จบเกมหรือยัง ─────────────────────────────────────────
   เหลือคนเดียว = คนนั้นชนะ */
export function winner(s) {
  const active = activeSeats(s);
  return active.length <= 1 ? (active[0] || null) : null;
}

/* ── ตาที่หมดเวลา — คืน action ที่ระบบเล่นแทน ──────────────
   เฟส challenge: ข้าม (skip) · เฟส event: ยังไม่ผูก (จะให้ระบบเปิดใบให้เอง)
   เฟส talk/announce: ปล่อยผ่านไปเฟสถัดไป */
export function timeoutAction(s) {
  if (s.phase === PHASE.CHALLENGE && s.chTurn) return { type: 'skip', uid: s.chTurn };
  return null;
}

/* ── บันทึกลงกระดานจุดเด่นที่วงยืนยันแล้ว ───────────────────
   ใช้ตอนการ์ดบังคับเปิดจุดเด่นจริง — value 'yes'/'no' */
export function markKnown(known, uid, traitId, value) {
  return { ...known, [uid]: { ...(known[uid] || {}), [traitId]: value } };
}

/* ── ตัวช่วยสำหรับผลการ์ด ─────────────────────────────────── */

/* คนข้างๆ ที่ยังอยู่ในเกม (ซ้าย/ขวา ตามที่นั่งวง) — ไม่รวมตัวเอง */
export function neighborsOf(s, uid) {
  const n = s.seats.length;
  const i = s.seats.indexOf(uid);
  if (i < 0) return [];
  const out = [];
  for (let d = 1; d <= n; d++) { const u = s.seats[(i - d + n) % n]; if (!isOut(s, u) && u !== uid) { out.push(u); break; } }
  for (let d = 1; d <= n; d++) { const u = s.seats[(i + d) % n]; if (!isOut(s, u) && u !== uid && !out.includes(u)) { out.push(u); break; } }
  return out;
}

/* คนถัดไปตามเข็ม (ยังอยู่ในเกม) — ใช้กับเก้าอี้ดนตรี */
export function nextSeat(s, uid) {
  const n = s.seats.length;
  const i = s.seats.indexOf(uid);
  for (let d = 1; d <= n; d++) { const u = s.seats[(i + d) % n]; if (!isOut(s, u)) return u; }
  return uid;
}
