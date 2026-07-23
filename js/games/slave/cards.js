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

export const rankIndex = (card) => RANKS.indexOf(card[0]);
export const suitIndex = (card) => SUITS.indexOf(card[1]);

/* ค่าประจำใบ ใช้เรียงลำดับใบเดี่ยว: แต้มมาก่อน แล้วค่อยดอก */
export const cardValue = (card) => rankIndex(card) * 4 + suitIndex(card);

export const isCard = (c) =>
  typeof c === 'string' && c.length === 2 && rankIndex(c) >= 0 && suitIndex(c) >= 0;

export function makeDeck() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  return deck;                                    // 52 ใบ ไม่มีโจ๊กเกอร์
}

export const sortHand = (cards) => [...cards].sort((a, b) => cardValue(a) - cardValue(b));

/* ── ชุดไพ่ ────────────────────────────────────────────────────
   คู่ ตอง โฟร์ ต้องเป็นแต้มเดียวกันทั้งหมด
   กองแบ่งเป็นสองสาย: คี่ = 1 หรือ 3 ใบ · คู่ = 2 หรือ 4 ใบ
   ลงข้ามสายไม่ได้ กองไหนเริ่มด้วยสายอะไร ทั้งกองต้องสายนั้น
   ในสายเดียวกัน ชุดใหญ่ชนะชุดเล็กเสมอไม่ว่าแต้มอะไร
     ตอง 3 ชนะ โพดำ 2 ใบเดียว · โฟร์ 3 ชนะ คู่ 2
   ──────────────────────────────────────────────────────────── */

export const FAMILY = { ODD: 'odd', EVEN: 'even' };

/* อ่านกองไพ่ที่ลง คืน null ถ้าไม่ใช่ชุดที่ถูกกติกา */
export function readCombo(cards) {
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > 4) return null;
  if (!cards.every(isCard)) return null;
  if (new Set(cards).size !== cards.length) return null;          // ไพ่ซ้ำใบ

  const rank = rankIndex(cards[0]);
  if (!cards.every(c => rankIndex(c) === rank)) return null;      // ต้องแต้มเดียวกัน

  const size = cards.length;
  return {
    size,
    rank,
    cards: sortHand(cards),
    family: (size % 2) ? FAMILY.ODD : FAMILY.EVEN,
    // ชุดใหญ่ของสาย (3 ใบในสายคี่ · 4 ใบในสายคู่) อยู่ชั้นบนเสมอ
    tier: (size === 3 || size === 4) ? 1 : 0,
    // ดอกสูงสุดในชุด ใช้ตัดสินตอนแต้มเท่ากัน — กฎเดียว ใช้ได้ทั้งเดี่ยวและคู่
    top: Math.max(...cards.map(suitIndex))
  };
}

/* เทียบสองชุดในสายเดียวกัน คืนบวกถ้า a ใหญ่กว่า
   ต่างสายกันเทียบไม่ได้ ต้องกันไว้ก่อนด้วย beats() */
export function compareCombo(a, b) {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.top - b.top;
}

/* คำถามหลักของเกมทั้งเกม
   cards = ไพ่ที่ผู้เล่นอยากลง · pile = ชุดที่อยู่บนกอง (null = กองว่าง เริ่มใหม่) */
export function beats(cards, pile) {
  const play = readCombo(cards);
  if (!play) return false;
  if (!pile) return true;                          // กองว่าง ลงอะไรก็ได้
  const top = readCombo(pile.cards ? pile.cards : pile);
  if (!top) return true;
  if (play.family !== top.family) return false;    // ข้ามสายไม่ได้
  return compareCombo(play, top) > 0;
}

/* ── ตัวช่วยที่กติกาเรียกใช้ ───────────────────────────────── */

/* ไพ่ที่ระบบบังคับลงเมื่อคนเริ่มกองหมดเวลา
   หยิบไพ่แต้มน้อยสุดในมือ "ทั้งหมด" ถ้าบังเอิญถือเป็นคู่หรือตองก็เสียไปทั้งชุด
   หมายเหตุ รอบแรกกฎนี้จะหยิบดอกจิก 3 ติดมาเองเสมอ เพราะ 3 เป็นแต้มเล็กสุดของสำรับ */
export function forcedLead(hand) {
  if (!hand || !hand.length) return [];
  const low = Math.min(...hand.map(rankIndex));
  return sortHand(hand.filter(c => rankIndex(c) === low));
}

/* ไพ่ที่สลาฟต้องยกให้คิง — ใบที่ดีที่สุด n ใบ ระบบเลือกให้ เจ้าตัวไม่มีสิทธิ์เลือก */
export function bestCards(hand, n) {
  return sortHand(hand).slice(-n).reverse();
}

/* แจกไพ่วนไปเรื่อย ๆ จนหมดสำรับ ใครได้มากได้น้อยไม่สำคัญ
   rng ส่งเข้ามาได้เพื่อให้ทดสอบซ้ำได้ผลเดิม */
export function deal(playerCount, rng = Math.random) {
  const deck = makeDeck();
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
