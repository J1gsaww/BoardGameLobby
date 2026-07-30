/* rules.js — Yahhh
   ─────────────────────────────────────────────────────────────
   ยาห์ทซีที่เปลี่ยนจากลูกเต๋าเป็นไพ่

   สำรับ 30 ใบ — แต้ม A ถึง 6 คูณดอก 5 อย่าง (จิก ข้าวหลามตัด โพแดง โพดำ ดาว)
   ดอกที่ห้าคือ **ดาว** ใส่เข้ามาเพื่อให้แต้มหนึ่งมีครบ 5 ใบ
   จะได้ทำ \"เหมือนกันทั้งห้าใบ\" ได้เหมือนลูกเต๋าห้าลูก

   หนึ่งตา — จั่ว 5 ใบ แล้วสุ่มใหม่ได้อีก 4 รอบ เก็บใบไหนไว้ก็ได้
   **สับสำรับใหม่ทุกต้นตา** ไม่งั้นสำรับ 30 ใบหมดตั้งแต่ตาแรก
   ใบที่ทิ้งระหว่างตากลับเข้ากองของตานั้นทันที เหมือนลูกเต๋าที่ทอยใหม่ได้เรื่อย ๆ

   กระดาน 14 ช่อง ช่องละครั้งเดียวทั้งเกม จึงเล่นคนละ 14 รอบ
   ลงช่องแล้วได้ศูนย์ได้ — เป็นการตัดสินใจทิ้งช่องที่ทำไม่ได้ ไม่ใช่ความผิดพลาด
   ───────────────────────────────────────────────────────────── */

export const SUITS = ['C', 'D', 'H', 'S', 'X'];   /* X = ดาว */
export const RANKS = [1, 2, 3, 4, 5, 6];
export const HAND = 5;
export const REROLLS = 4;

/* ดอกไม่มีผลกับคะแนนเลย ยกเว้นช่อง "ดอกเหมือนกัน" ช่องเดียว */
export const SUIT_ROW_MAX = 4;    /* ช่องดอกเหมือนกันนับได้ไม่เกิน 4 ใบ */

/* [2026-07-28] ถอดช่อง "เหมือนกันทั้งห้าใบ" ออกตามที่ผู้ใช้สั่ง
   เหตุผลคืองงและทำได้ยากเกินไป — ทุ่มทั้งตาไล่ช่องนี้ยังได้แค่ 1.7%
   เพราะแต้มหนึ่งมีแค่ห้าใบในสำรับพอดี ต้องเก็บครบทุกใบที่มีอยู่ในเกม
   กระดานจึงเหลือ 13 ช่อง = เล่นคนละ 13 รอบ รวม 26 ตา */
export const ROWS = [
  'r1', 'r2', 'r3', 'r4', 'r5', 'r6',
  'pair', 'twoPair', 'three', 'four', 'full', 'suit', 'straight'
];

export const cardId = (r, s) => `${r}${s}`;
export const rankOf = (c) => Number(c[0]);
export const suitOf = (c) => c[1];

export function fullDeck() {
  const out = [];
  for (const r of RANKS) for (const s of SUITS) out.push(cardId(r, s));
  return out;
}

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── ตัวช่วยนับ ───────────────────────────────────────────── */

export function countBy(hand, pick) {
  const m = {};
  for (const c of hand) { const k = pick(c); m[k] = (m[k] || 0) + 1; }
  return m;
}

const byRank = (hand) => countBy(hand, rankOf);
const bySuit = (hand) => countBy(hand, suitOf);

/* รวมแต้มของใบที่เข้าชุด — ใช้กับ คู่ สองคู่ ตอง โฟร์
   นับเฉพาะใบที่อยู่ในชุดจริง ไม่รวมใบที่เหลือในมือ
   ต่างจากยาห์ทซีต้นฉบับที่ตองกับโฟร์รวมลูกเต๋าทั้งห้าลูก
   เลือกแบบนี้เพราะอ่านแล้วตรงกับชื่อช่อง — "ตอง" ก็ควรได้แต้มของตองสามใบ */
function setScore(hand, size, groups = 1) {
  const m = byRank(hand);
  const able = Object.keys(m).map(Number).filter(r => m[r] >= size).sort((a, b) => b - a);
  if (able.length < groups) return 0;
  return able.slice(0, groups).reduce((sum, r) => sum + r * size, 0);
}

/* ── คะแนนของแต่ละช่อง ────────────────────────────────────── */

export const SCORE = {
  /* ช่องบน — รวมแต้มของใบที่เป็นเลขนั้น */
  r1: (h) => rankSum(h, 1),
  r2: (h) => rankSum(h, 2),
  r3: (h) => rankSum(h, 3),
  r4: (h) => rankSum(h, 4),
  r5: (h) => rankSum(h, 5),
  r6: (h) => rankSum(h, 6),

  /* ชุดแต้มเหมือนกัน — รวมแต้มของใบที่เข้าชุด */
  pair:    (h) => setScore(h, 2, 1),
  twoPair: (h) => setScore(h, 2, 2),      /* ต้องเป็นคนละแต้ม */
  three:   (h) => setScore(h, 3, 1),
  four:    (h) => setScore(h, 4, 1),

  /* ดอกเหมือนกัน — รวมแต้มของใบดอกนั้น **นับได้ไม่เกิน 4 ใบ**
     เลือกใบแต้มสูงก่อน เพราะคนเล่นย่อมเลือกแบบนั้นอยู่แล้ว
     เพดาน 4 ใบเพราะดอกทำได้ง่ายกว่าแต้มเหมือนกันถึงสามเท่า */
  suit: (h) => {
    let best = 0;
    for (const s of SUITS) {
      const mine = h.filter(c => suitOf(c) === s).map(rankOf).sort((a, b) => b - a);
      const sum = mine.slice(0, SUIT_ROW_MAX).reduce((a, b) => a + b, 0);
      if (sum > best) best = sum;
    }
    return best;
  },

  /* ช่องคะแนนตายตัว */
  full:     (h) => isFull(h) ? 25 : 0,
  straight: (h) => isStraight(h) ? 35 : 0
};

function rankSum(hand, r) {
  return hand.filter(c => rankOf(c) === r).length * r;
}

export function isFull(hand) {
  const t = Object.values(byRank(hand)).sort((a, b) => b - a);
  return t[0] === 3 && t[1] === 2;
}

/* เรียงห้าใบเต็มเท่านั้น — A-2-3-4-5 หรือ 2-3-4-5-6 */
export function isStraight(hand) {
  const u = [...new Set(hand.map(rankOf))].sort((a, b) => a - b);
  return u.length === HAND && u[HAND - 1] - u[0] === HAND - 1;
}

/* เก็บไว้เผื่อวันหลังอยากเอาช่องนี้กลับมา — ตอนนี้ไม่มีช่องไหนเรียกใช้ */
export const isYahhh = (hand) => Object.values(byRank(hand)).some(n => n === HAND);

/* คะแนนที่จะได้ถ้าลงมือนี้ในช่องนั้น — ศูนย์ก็ลงได้ ถือเป็นการทิ้งช่อง */
export const scoreFor = (row, hand) => (SCORE[row] ? SCORE[row](hand) : 0);

/* ช่องที่ยังว่างอยู่ของคนนี้ */
export const openRows = (sheet) => ROWS.filter(r => sheet?.[r] == null);

export const sheetTotal = (sheet) =>
  ROWS.reduce((n, r) => n + (sheet?.[r] ?? 0), 0);

export const sheetDone = (sheet) => openRows(sheet).length === 0;

/* ── การจั่วในหนึ่งตา ─────────────────────────────────────── */

/* เริ่มตาใหม่ — สับสำรับใหม่ทั้งกอง แล้วจั่วห้าใบ */
export function openHand(rng = Math.random) {
  const deck = shuffle(fullDeck(), rng);
  return { hand: deck.slice(0, HAND), deck: deck.slice(HAND), left: REROLLS };
}

/* สุ่มใหม่เฉพาะใบที่ไม่ได้ล็อก — ใบที่ทิ้งกลับเข้ากองแล้วสับใหม่
   ล็อกครบห้าใบ = ไม่มีอะไรให้สุ่ม ถือว่าจบการจั่ว */
export function reroll(state, keep, rng = Math.random) {
  if (state.left <= 0) return null;
  const lock = new Set(keep);
  if (!keep.every(c => state.hand.includes(c))) return null;
  const toss = state.hand.filter(c => !lock.has(c));
  if (!toss.length) return null;

  const pool = shuffle([...state.deck, ...toss], rng);
  return {
    hand: [...state.hand.filter(c => lock.has(c)), ...pool.slice(0, toss.length)],
    deck: pool.slice(toss.length),
    left: state.left - 1
  };
}
