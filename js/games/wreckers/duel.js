/* duel.js — ยิงแข่งสองลำพร้อมกัน
   ─────────────────────────────────────────────────────────────
   **แยกจากระบบโหวตเดิมโดยตั้งใจ** ไม่แตะ `st.vote` เลยสักบรรทัด

   เหตุผล: การโหวตเดิมมีวงเดียวเสมอ ทั้งกติกา หน้าจอ และฉากเล่าผล
   ถูกเขียนบนสมมติฐานนั้นหมด ถ้าดัดให้รับสองวงจะกระทบทุกใบที่มีโหวต
   ซึ่งตอนนี้มีสิบกว่าใบแล้ว การพังหนึ่งจุดจะลามไปทั้งเกม

   ใช้กับสองใบ — **มังสวิรัส** (แพ้แล้วโดน Maroon) และ **พวกล่อเรือ** (แพ้แล้วเสียกล่อง)
   ทั้งคู่ใช้กลไกยิงแข่งเดียวกัน ต่างกันแค่ผลตอนจบ

   ยืมของเดิมมาใช้ได้เฉพาะ **ภาพไพ่กับตัวนับหน้าไพ่** ซึ่งเป็นข้อมูลดิบ ไม่ใช่กลไก */

import { DECK, cardById } from './vote.js';
import { SHIP_IDS, occupants, placeOf, shuffle } from './rules.js';

/* หน้า Attack ของไพ่โหวต — ปืนใหญ่ ไฟ น้ำ
   ยิงติดเมื่อ **มีปืนใหญ่อย่างน้อยหนึ่ง และไฟมากกว่าน้ำ** (น้ำ 1 ดับไฟ 1)
   กติกาเดียวกับการสั่งยิงปกติ เขียนซ้ำที่นี่เพราะไม่อยากผูกกับตัวเดิม
   ถ้าวันหลังแก้กติกายิงของใบใดใบหนึ่ง อีกใบจะได้ไม่เปลี่ยนตาม */
export function tally(ids) {
  const out = { cannon: 0, fire: 0, water: 0 };
  for (const id of ids) {
    const c = cardById(id);
    if (!c) continue;
    if (c.attack === 'C') out.cannon++;
    else if (c.attack === 'F') out.fire++;
    else if (c.attack === 'W') out.water++;
  }
  return out;
}

export const hits = (counts) => counts.cannon >= 1 && counts.fire > counts.water;

/* เปิดวงยิงแข่ง — ทั้งสองลำพร้อมกัน
   ลำที่ไม่มีคนอยู่เลยถือว่า "ว่าง" ไม่ต้องรอ และนับว่ายิงไม่ติด */
export function startDuel(st, { card, by }) {
  const sides = {};
  for (const ship of SHIP_IDS) {
    const crew = occupants(st.pos, ship);
    sides[ship] = { crew, done: [], sent: {}, empty: crew.length === 0 };
  }
  return {
    ...st,
    duel: { card, by, sides, at: (st.logSeq || 0) + 1 }
  };
}

/* ยังรอใครอยู่บ้าง — ลำที่ว่างไม่ต้องรอ */
export const duelWaiting = (duel) =>
  SHIP_IDS.flatMap(s => duel.sides[s].crew.filter(u => !duel.sides[s].done.includes(u)));

export const duelReady = (duel) => duelWaiting(duel).length === 0;

/* คนนี้ส่งไพ่เข้าวงยิงแข่งได้ไหม */
export function canDuelNow(st, uid) {
  const d = st.duel;
  if (!d) return false;
  const ship = placeOf(st.pos?.[uid] || '');
  if (!SHIP_IDS.includes(ship)) return false;
  return d.sides[ship].crew.includes(uid) && !d.sides[ship].done.includes(uid);
}

/* บันทึกไพ่ที่ส่งเข้ามา — คืนวงใหม่ ไม่แก้ของเดิม */
export function duelSubmit(duel, uid, ship, cardId) {
  const side = duel.sides[ship];
  return {
    ...duel,
    sides: { ...duel.sides,
      [ship]: { ...side,
        done: [...side.done, uid],
        sent: { ...side.sent, [uid]: cardId } } }
  };
}

/* เปิดผลทั้งสองฝั่งพร้อมกัน
   กองกลางเติมให้ฝั่งละหนึ่งใบเหมือนการโหวตปกติ ลำที่ว่างไม่ได้เติม */
export function resolveDuel(st, hands, rng = Math.random) {
  const d = st.duel;
  const held = new Set(Object.values(hands).flat());
  const bag = shuffle(DECK.map(c => c.id).filter(id => !held.has(id)), rng);

  const out = {};
  for (const ship of SHIP_IDS) {
    const side = d.sides[ship];
    const sent = side.crew.map(u => side.sent[u]).filter(Boolean);
    const bonus = side.empty ? [] : bag.splice(0, 1);
    const pot = shuffle([...sent, ...bonus], rng);
    const counts = tally(pot);
    out[ship] = { pot, counts, sent: side.sent, hit: side.empty ? false : hits(counts),
                  empty: side.empty };
  }

  const L = out.shipL.hit, R = out.shipR.hit;
  const won = L && !R ? 'shipL' : R && !L ? 'shipR' : 'tie';

  return { sides: out, won, both: L && R, neither: !L && !R };
}

/* ลำดับที่คนจะถูกส่งลงเกาะ — สุ่มทั้งหมด ไม่อิงลำดับเดิมบนเรือ
   คนละลำถูกรวมกันก่อนแล้วค่อยสุ่ม จึงสลับกันไปมาได้จริง */
export const marchOrder = (list, rng = Math.random) => shuffle(list, rng);
