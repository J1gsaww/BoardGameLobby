/* duel.js — ยิงแข่งสองลำพร้อมกัน
   ─────────────────────────────────────────────────────────────
   **แยกจากระบบโหวตเดิมโดยตั้งใจ** ไม่แตะ `st.vote` เลยสักบรรทัด

   เหตุผล: การโหวตเดิมมีวงเดียวเสมอ ทั้งกติกา หน้าจอ และฉากเล่าผล
   ถูกเขียนบนสมมติฐานนั้นหมด ถ้าดัดให้รับสองวงจะกระทบทุกใบที่มีโหวต
   ซึ่งตอนนี้มีสิบกว่าใบแล้ว การพังหนึ่งจุดจะลามไปทั้งเกม

   ใช้กับสองใบ — **มังสวิรัส** (แพ้แล้วโดน Maroon) และ **พวกล่อเรือ** (แพ้แล้วเสียกล่อง)
   ทั้งคู่ใช้กลไกยิงแข่งเดียวกัน ต่างกันแค่ผลตอนจบ

   ยืมของเดิมมาใช้ได้เฉพาะ **ภาพไพ่กับตัวนับหน้าไพ่** ซึ่งเป็นข้อมูลดิบ ไม่ใช่กลไก */

import { DECK } from './vote.js';
import { SHIP_IDS, occupants, placeOf, shuffle, tallyRow, attackPasses } from './rules.js';

/* นับหน้า Attack แล้วตัดสินว่ายิงติดไหม

   **ใช้ตัวเดียวกับการสั่งยิงปกติ ไม่เขียนใหม่**

   รอบแรกพี่เขียนตัวนับขึ้นเองเพราะอยากให้สองระบบแยกจากกันสนิท
   แล้วพลาดทันที เพราะสำรับมีไพ่หน้ารวมอยู่ด้วย — `CF` คือปืนใหญ่กับคบเพลิง
   ในใบเดียว และ `WW` คือน้ำสองหน่วย ตัวนับที่เขียนเองรู้จักแต่ตัวเดียวโดด ๆ
   ไพ่พวกนั้นจึงถูกนับเป็นศูนย์ ผลออกมาว่ายิงไม่ติดทั้งที่ควรติด

   บทเรียน: **แยกกลไกได้ แต่ห้ามแยกการอ่านข้อมูลดิบ**
   หน้าไพ่คือข้อมูลของสำรับ ไม่ใช่กติกาของใบใดใบหนึ่ง */
export const tally = (ids) => tallyRow(ids, 'attack');
export const hits = (n) => attackPasses(n);

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

/* ── ผลของ "พวกล่อเรือ" ────────────────────────────────────
   แยกออกมาจากตัววงยิง เพราะวงยิงเป็นกลไกกลาง ส่วนนี้เป็นกติกาของใบเดียว

   ลำที่ยิงติดฝ่ายเดียวชิงกล่องจากอีกลำ 2 ใบ
   ถ้าลำนั้นรับไม่ไหว (เต็ม) นับเป็นแพ้ไปเลย แล้วตกไปใช้กติกาเสมอ
   เสมอ = กล่องของทั้งสองลำกลับเรือสินค้า โดยมีคนเลือกว่าคืนฝั่งไหน */

const SHIP_CAP_SIDE = 3;   /* เรือหนึ่งลำเก็บได้ประเทศละ 3 กล่อง */

/* ลำนี้ยังรับกล่องเพิ่มได้อีกกี่ใบ */
export const roomOn = (cargo, ship) =>
  Math.max(0, SHIP_CAP_SIDE - (cargo[ship]?.B || 0))
  + Math.max(0, SHIP_CAP_SIDE - (cargo[ship]?.F || 0));

/* ── ชิงกล่องทีละใบ โดยคนชนะเลือกเอง ──────────────────────
   กติกาเดียวกับการยิงปกติ — กัปตันเลือกทั้งว่าเอาจากฝั่งไหน และเก็บไว้ฝั่งไหน
   จึงต้องถามทีละใบ ไม่ใช่คำนวณให้เอง

   ต้นทางเลือกได้เฉพาะฝั่งที่มีกล่องจริง · ปลายทางเลือกได้เฉพาะฝั่งที่ยังไม่เต็ม
   กล่องบนเรือสินค้าไม่มีประเทศ ถ้าหยิบจากตรงนั้นจึงข้ามขั้นเลือกต้นทางไป */
export const grabFrom = (cargo, loser) =>
  ['B', 'F'].filter(k => (cargo[loser]?.[k] || 0) > 0);

export const grabTo = (cargo, winner) =>
  ['B', 'F'].filter(k => (cargo[winner]?.[k] || 0) < SHIP_CAP_SIDE);

/* ย้ายหนึ่งกล่องตามที่เลือก — from เป็น null แปลว่าหยิบจากเรือสินค้า */
export function moveOne(cargo, winner, loser, from, to) {
  const c = { ...cargo,
    [winner]: { ...cargo[winner] },
    [loser]: { ...cargo[loser] } };
  if ((c[winner][to] || 0) >= SHIP_CAP_SIDE) return null;

  if (from) {
    if (!(c[loser][from] > 0)) return null;
    c[loser][from]--;
  } else {
    if (!(c.merchant > 0)) return null;
    c.merchant--;
  }
  c[winner][to] = (c[winner][to] || 0) + 1;
  return c;
}

/* ยังชิงได้อีกไหม — ลำที่แพ้หมดแล้วและเรือสินค้าก็หมด ก็จบเท่านั้น */
export const canGrab = (cargo, winner, loser) =>
  grabTo(cargo, winner).length > 0
  && (grabFrom(cargo, loser).length > 0 || (cargo.merchant || 0) > 0);

/* ตัวคำนวณอัตโนมัติ — เก็บไว้ใช้ตอนหมดเวลาแล้วไม่มีใครตอบ */
export function grabBoxes(cargo, winner, loser, n = 2) {
  let c = { ...cargo, [winner]: { ...cargo[winner] }, [loser]: { ...cargo[loser] } };
  let got = 0;

  const put = (side) => {
    if ((c[winner][side] || 0) >= SHIP_CAP_SIDE) return false;
    c[winner][side]++;
    return true;
  };

  /* จากลำที่แพ้ก่อน */
  while (got < n) {
    const from = (c[loser].B || 0) >= (c[loser].F || 0) ? 'B' : 'F';
    if (!(c[loser][from] > 0)) break;
    if (!put(from)) {
      const alt = from === 'B' ? 'F' : 'B';
      if (!(c[loser][alt] > 0) || !put(alt)) break;
      c[loser][alt]--;
    } else c[loser][from]--;
    got++;
  }

  /* ยังไม่ครบและเรือสินค้ายังมี ก็เอาจากเรือสินค้าต่อ
     กล่องบนเรือสินค้ายังไม่มีประเทศ ผู้ชนะจึงลงฝั่งที่ยังว่างกว่า */
  while (got < n && (c.merchant || 0) > 0) {
    const side = (c[winner].B || 0) <= (c[winner].F || 0) ? 'B' : 'F';
    if (!put(side)) break;
    c.merchant--;
    got++;
  }

  return { cargo: c, got };
}

/* ตอนเสมอ ใครเป็นคนเลือกว่าลำนั้นคืนกล่องฝั่งไหน
   ลำที่มีคน = ลูกเรือคนท้ายสุดของลำนั้น (กัปตันอยู่คนเดียวก็นับเป็นคนท้ายสุด)
   ลำที่ว่าง = คนท้ายเกาะ — ท้ายสุดเลือกลำขวา รองท้ายเลือกลำซ้าย */
export function spoilAsks(pos) {
  const isle = occupants(pos, 'island');
  const last = isle[isle.length - 1] || null;
  const second = isle[isle.length - 2] || null;

  const asks = {};
  for (const ship of SHIP_IDS) {
    const crew = occupants(pos, ship);
    if (crew.length) asks[ship] = crew[crew.length - 1];
    else asks[ship] = ship === 'shipR' ? last : second;
  }

  /* คนเดียวกันถูกขอสองลำไม่ได้ — ถ้าเกาะมีคนเดียว ลำซ้ายจึงไม่มีใครเลือก */
  if (asks.shipL && asks.shipL === asks.shipR) asks.shipL = null;

  return asks;
}

/* คืนกล่องของลำหนึ่งกลับเรือสินค้า โดยเลือกได้ว่าจะคืนฝั่งไหนก่อน
   ไม่มีคนเลือก = คืนทั้งลำตามที่มีอยู่ */
export function dumpShip(cargo, ship, side = null) {
  const c = { ...cargo, [ship]: { ...cargo[ship] } };
  const total = (c[ship].B || 0) + (c[ship].F || 0);
  if (!total) return c;

  if (side) {
    /* ฝั่งที่เลือกคืนก่อน แล้วอีกฝั่งตามไป — ปลายทางเดียวกันคือเรือสินค้า
       การเลือกจึงมีผลกับลำดับ ไม่ใช่กับจำนวน แต่เก็บไว้เพราะกติกาบอกให้เลือก */
    c.merchant = (c.merchant || 0) + total;
  } else {
    c.merchant = (c.merchant || 0) + total;
  }
  c[ship] = { B: 0, F: 0 };
  return c;
}
