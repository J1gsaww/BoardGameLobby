/* cards.js — แบบจำลองไพ่และการเปรียบเทียบของสลาฟ
   ─────────────────────────────────────────────────────────────
   ไฟล์นี้เป็นฟังก์ชันบริสุทธิ์ล้วน ไม่แตะ DOM ไม่แตะ Firebase
   ทดสอบได้ด้วยตัวเองโดยไม่ต้องเปิดเบราว์เซอร์

   ทั้งเกมหมุนรอบคำถามเดียว: "ชุดนี้ทับชุดที่อยู่บนกองได้ไหม"
   ตอบด้วย beats() ที่อยู่ล่างสุดของไฟล์

   รูปแบบไพ่: ข้อความ 2 ตัวอักษร  แต้ม + ดอก
     แต้ม  3 4 5 6 7 8 9 T J Q K A 2   (T = 10, 2 ใหญ่สุด, 3 เล็กสุด)
     ดอก   C D H S                     (ดอกจิก ข้าวหลามตัด โพแดง โพดำ)
   ตัวอย่าง  '3C' = ดอกจิก 3   'TS' = โพดำ 10   '2S' = โพดำ 2 (ใบใหญ่สุดในสำรับ)
   ───────────────────────────────────────────────────────────── */

export const RANKS = ['3','4','5','6','7','8','9','T','J','Q','K','A','2'];
export const SUITS = ['C','D','H','S'];          // เล็กไปใหญ่: ดอกจิก < ข้าวหลามตัด < โพแดง < โพดำ

export const OPENING_CARD = '3C';                // รอบแรกคนถือดอกจิก 3 เริ่ม และต้องลงใบนี้
/* ตัวล้มโจ๊กเกอร์ = โพดำของแต้มที่อ่อนที่สุดในลำดับตอนนั้น
   ปกติแต้มอ่อนสุดคือ 3 จึงเป็นโพดำ 3 · ตอนปฏิวัติอ่อนสุดคือ 2 จึงเป็นโพดำ 2 */
export const jokerKiller = (rev = false) => (rev ? '2S' : '3S');
export const JOKERS = ['X1', 'X2', 'X3', 'X4'];   // เกมเลือกได้ว่าจะใส่กี่ใบ

/* variant = ความต่างของแต่ละเกม เกมไหนไม่ส่งมาก็ได้กติกาสลาฟเป็นค่าตั้งต้น
     jokers      จำนวนโจ๊กเกอร์ในสำรับ (0 = ไม่มี)
     revolution  เปิดกฎปฏิวัติไหม
     eightCut    ลงเลข 8 แล้วจบกองไหม */
export const BASE = { jokers: 0, revolution: false, eightCut: false };

export const isJoker = (card) => typeof card === 'string' && card[0] === 'X';
export const rankIndex = (card) => isJoker(card) ? RANKS.length : RANKS.indexOf(card[0]);
export const suitIndex = (card) => isJoker(card) ? SUITS.length : SUITS.indexOf(card[1]);

/* ค่าประจำใบ ใช้เรียงลำดับใบเดี่ยว: แต้มมาก่อน แล้วค่อยดอก
   โจ๊กเกอร์อยู่เหนือทุกใบ · ตอนปฏิวัติ ลำดับทั้งหมดกลับหัว */
const TOP = (RANKS.length + 1) * 5;
export const cardValue = (card, rev = false) => {
  const v = rankIndex(card) * 5 + suitIndex(card);
  return rev ? TOP - v : v;
};

export const isCard = (c) =>
  typeof c === 'string' && c.length === 2 && rankIndex(c) >= 0 &&
  (isJoker(c) ? JOKERS.includes(c) : suitIndex(c) >= 0);

export function makeDeck(v = BASE) {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  for (let i = 0; i < (v.jokers || 0); i++) deck.push(JOKERS[i]);
  return deck;
}

export const sortHand = (cards, rev = false) =>
  [...cards].sort((a, b) => cardValue(a, rev) - cardValue(b, rev));

/* เรียงไพ่บนมือสำหรับ "แสดงผล" — โจ๊กเกอร์อยู่ขวาสุดเสมอ
   ต่างจาก sortHand ที่ใช้ตัดสินกติกา เพราะตอนปฏิวัติโจ๊กเกอร์กลายเป็นใบเล็กสุด
   ถ้าเรียงตามค่าจริง มันจะเด้งไปซ้ายสุดทุกครั้งที่ปฏิวัติ ซึ่งกวนสายตามาก */
export const sortForHand = (cards, rev = false) => [
  ...sortHand(cards.filter(c => !isJoker(c)), rev),
  ...cards.filter(isJoker).sort()
];

/* ── ชุดไพ่ ────────────────────────────────────────────────────
   คู่ ตอง โฟร์ ต้องเป็นแต้มเดียวกันทั้งหมด
   กองแบ่งเป็นสองสาย: คี่ = 1 หรือ 3 ใบ · คู่ = 2 หรือ 4 ใบ
   ลงข้ามสายไม่ได้ กองไหนเริ่มด้วยสายอะไร ทั้งกองต้องสายนั้น
   ในสายเดียวกัน ชุดใหญ่ชนะชุดเล็กเสมอไม่ว่าแต้มอะไร
     ตอง 3 ชนะ โพดำ 2 ใบเดียว · โฟร์ 3 ชนะ คู่ 2
   ──────────────────────────────────────────────────────────── */

export const FAMILY = { ODD: 'odd', EVEN: 'even' };

/* อ่านกองไพ่ที่ลง คืน null ถ้าไม่ใช่ชุดที่ถูกกติกา
   โจ๊กเกอร์เป็นไพ่แทน — คู่ 4 เติมโจ๊กเกอร์อีกใบกลายเป็นตอง 4 ทันที */
export function readCombo(cards, v = BASE) {
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > 4) return null;
  if (!cards.every(isCard)) return null;
  if (new Set(cards).size !== cards.length) return null;          // ไพ่ซ้ำใบ

  const jokers = cards.filter(isJoker);
  const normals = cards.filter(c => !isJoker(c));
  if (jokers.length && !v.jokers) return null;                    // เกมนี้ไม่มีโจ๊กเกอร์

  const rank = normals.length ? rankIndex(normals[0]) : RANKS.length;
  if (!normals.every(c => rankIndex(c) === rank)) return null;    // ตัวจริงต้องแต้มเดียวกัน

  const size = cards.length;
  return {
    size,
    rank,
    cards: sortHand(cards),
    family: (size % 2) ? FAMILY.ODD : FAMILY.EVEN,
    // ชุดใหญ่ของสาย (3 ใบในสายคี่ · 4 ใบในสายคู่) อยู่ชั้นบนเสมอ
    tier: (size === 3 || size === 4) ? 1 : 0,
    // ดอกสูงสุดในชุด ใช้ตัดสินตอนแต้มเท่ากัน — กฎเดียว ใช้ได้ทั้งเดี่ยวและคู่
    top: Math.max(...cards.map(suitIndex)),
    jokers: jokers.length,
    soloJoker: size === 1 && jokers.length === 1
  };
}

/* เทียบสองชุดในสายเดียวกัน คืนบวกถ้า a ใหญ่กว่า
   ต่างสายกันเทียบไม่ได้ ต้องกันไว้ก่อนด้วย beats() */
export function compareCombo(a, b, rev = false) {
  if (a.tier !== b.tier) return a.tier - b.tier;      // ชุดใหญ่ชนะชุดเล็กเสมอ ปฏิวัติไม่เกี่ยว
  const dir = rev ? -1 : 1;
  if (a.rank !== b.rank) return (a.rank - b.rank) * dir;
  return (a.top - b.top) * dir;
}

/* คำถามหลักของเกมทั้งเกม
   cards = ไพ่ที่ผู้เล่นอยากลง · pile = ชุดที่อยู่บนกอง (null = กองว่าง เริ่มใหม่) */
export function beats(cards, pile, v = BASE, rev = false) {
  const play = readCombo(cards, v);
  if (!play) return false;
  if (!pile) return true;                          // กองว่าง ลงอะไรก็ได้
  const top = readCombo(pile.cards ? pile.cards : pile, v);
  if (!top) return true;
  if (play.family !== top.family) return false;    // ข้ามสายไม่ได้

  // โจ๊กเกอร์เดี่ยวชนะไพ่เดี่ยวทุกใบ แต่มีใบเดียวที่ล้มมันได้
  // เป็นข้อยกเว้นตรง ๆ ไม่ใช่ลำดับปกติ เพราะมันวนเป็นวงกลม —
  // โจ๊กเกอร์ทับตัวล้มได้ และตัวล้มก็ทับโจ๊กเกอร์ได้เหมือนกัน
  // การปฏิวัติไม่ได้ทำให้โจ๊กเกอร์อ่อนลง แค่เปลี่ยนว่าใบไหนล้มมันได้
  if (v.jokers) {
    if (top.soloJoker) return cards.length === 1 && cards[0] === jokerKiller(rev);
    if (play.soloJoker && top.size === 1) return true;
  }

  return compareCombo(play, top, rev) > 0;
}

/* ── ตัวช่วยที่กติกาเรียกใช้ ───────────────────────────────── */

/* ไพ่ที่ระบบบังคับลงเมื่อคนเริ่มกองหมดเวลา
   หยิบไพ่แต้มน้อยสุดในมือ "ทั้งหมด" ถ้าบังเอิญถือเป็นคู่หรือตองก็เสียไปทั้งชุด
   หมายเหตุ รอบแรกกฎนี้จะหยิบดอกจิก 3 ติดมาเองเสมอ เพราะ 3 เป็นแต้มเล็กสุดของสำรับ */
export function forcedLead(hand, v = BASE, rev = false) {
  if (!hand || !hand.length) return [];
  const sorted = sortHand(hand, rev);
  const first = sorted[0];
  const r = rankIndex(first);
  return sorted.filter(c => rankIndex(c) === r);
}

/* ไพ่ที่สลาฟต้องยกให้คิง — ใบที่ดีที่สุด n ใบ ระบบเลือกให้ เจ้าตัวไม่มีสิทธิ์เลือก */
export function bestCards(hand, n) {
  return sortHand(hand).slice(-n).reverse();       // "ดีที่สุด" วัดจากลำดับปกติเสมอ
}

/* แจกไพ่วนไปเรื่อย ๆ จนหมดสำรับ ใครได้มากได้น้อยไม่สำคัญ
   rng ส่งเข้ามาได้เพื่อให้ทดสอบซ้ำได้ผลเดิม */
export function deal(playerCount, rng = Math.random, v = BASE) {
  const deck = makeDeck(v);
  for (let i = deck.length - 1; i > 0; i--) {      // สับแบบ Fisher-Yates
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hands = Array.from({ length: playerCount }, () => []);
  deck.forEach((card, i) => hands[i % playerCount].push(card));
  return hands.map(sortHand);
}

/* ทิศ "หนีคิง" — ทิศที่กว่าจะถึงตาคิงนานที่สุด นับจากคนเริ่ม (สลาฟ)
   เท่ากันให้ทวนเข็ม เพราะค่าตั้งต้นของเกมคือตามเข็ม การทวนเข็มคือการหนี
   คืน 1 = ตามเข็ม · -1 = ทวนเข็ม */
export function fleeDirection(startSeat, kingSeat, seatCount) {
  if (kingSeat === null || kingSeat === undefined || kingSeat === startSeat) return 1;
  const cw  = (kingSeat - startSeat + seatCount) % seatCount;
  const ccw = (startSeat - kingSeat + seatCount) % seatCount;
  return cw > ccw ? 1 : -1;
}
