/* game.js — Wreckers ฝั่งกติกา
   ตอนนี้มีแค่การเดินบนกระดาน ไว้ดูว่าผังและการวางตำแหน่งใช้ได้จริง
   กติกาที่เหลือ (โหวต การ์ด Event นับแต้ม) ค่อยต่อทีหลัง */

import {
  allSpots, SHIP_SLOTS, EVENT_SLOTS, MAX_VOTE, eventTotal,
  TURN_OPTIONS, graceMs, rollStarter
} from './board.js';
import { deal } from './vote.js';

const seated = (members) =>
  members.filter(m => m.role === 'player' && !m.left && m.seat !== null)
         .sort((a, b) => a.seat - b.seat);

export function init(ctx) {
  // สับลำดับก่อน ตำแหน่งบนเรือจึงสุ่มจริง ไม่ได้เรียงตามที่นั่งในห้อง
  const seats = shuffle(seated(ctx.members).map(p => p.uid));

  /* แจกตำแหน่งสลับลำไปทีละคนตามลำดับศักดิ์
     กัปตันซ้าย · กัปตันขวา · ต้นหนซ้าย · ต้นหนขวา · ลูกเรือซ้าย · ลูกเรือขวา ... */
  const pos = {};
  seats.forEach((uid, i) => {
    const ship = i % 2 === 0 ? 'shipL' : 'shipR';
    const slot = SHIP_SLOTS[Math.floor(i / 2)];
    if (slot) pos[uid] = `${ship}:${slot.id}`;
  });

  // ทอยลูกเต๋าหาคนเริ่ม ทุกเครื่องเห็นหน้าเดียวกันเพราะเจ้าของห้องทอยให้
  const die = rollStarter(seats.length);
  const turnSeconds = Number(ctx.settings?.turnSeconds) || TURN_OPTIONS[2];

  // แจกไพ่โหวตจริง มือแต่ละคนเก็บในข้อมูลลับ เจ้าตัวกับเจ้าของห้องเท่านั้นที่เห็น
  const { hands, pile } = deal(seats, MAX_VOTE);

  return {
    state: {
      phase: 'board',
      roundNo: 1,
      seats,
      names: Object.fromEntries(ctx.members.map(m => [m.uid, m.name || ''])),
      turn: seats[die.face - 1] || seats[0] || null,
      turnSeconds,
      deadline: Date.now() + turnSeconds * 1000,
      graced: false,
      die,                                                     // ผลทอยไว้ให้หน้าจอเล่นภาพ
      pos,
      events: EVENT_SLOTS,                                    // การ์ดคว่ำกลางโต๊ะ
      extraCards: [...(ctx.settings?.extraCards || [])],       // ชุดการ์ดพิเศษที่เลือกใส่
      eventDeck: eventTotal(ctx.settings) - EVENT_SLOTS,       // ที่เหลือในกอง
      voteDeck: pile.length,                                   // ไพ่โหวตที่ยังอยู่ในกอง
      votes: Object.fromEntries(seats.map(u => [u, hands[u].length])), // นับใบในมือ ทุกคนเห็นได้
      maxVote: Object.fromEntries(seats.map(u => [u, MAX_VOTE])),      // เพดานมือ ลดถาวรได้จาก Maroon ซ้ำ
      held: Object.fromEntries(seats.map(u => [u, 0])),         // การ์ดที่เก็บขึ้นมือ
      // ฝั่งซ้ายของทุกลำคือ British ฝั่งขวาคือ France
      cargo: {
        shipL: { B: 1, F: 0 },
        shipR: { B: 0, F: 1 },
        island: { B: 1, F: 1 },
        merchant: 4
      }
    },
    secrets: Object.fromEntries(seats.map(u => [u, { vote: hands[u] }]))
  };
}

export async function onAction(ctx, action) {
  const st = ctx.state;
  if (action.type !== 'move') return null;
  if (st.turn !== action.uid) return null;                     // ยังไม่ถึงตาตัวเอง

  const spot = String(action.payload?.spot || '');
  if (!allSpots().includes(spot)) return null;                 // ช่องไม่มีอยู่จริง
  if (Object.values(st.pos).includes(spot)) return null;       // มีคนยืนอยู่แล้ว
  if (!st.seats.includes(action.uid)) return null;             // คนดูขยับไม่ได้

  const moved = { ...st, pos: { ...st.pos, [action.uid]: spot } };
  return { state: nextTurn(moved, ctx) };
}

/* ── ลำดับตา ────────────────────────────────────────────────
   หนึ่งตาทำได้ 1 Action ทำเสร็จแล้วส่งต่อคนถัดไปตามลำดับที่นั่งบนกระดาน */
function nextTurn(st, ctx) {
  const order = st.seats;
  const here = order.indexOf(st.turn);
  const next = order[(here + 1) % order.length] || order[0];
  return {
    ...st,
    turn: next,
    deadline: Date.now() + st.turnSeconds * 1000,
    graced: false
  };
}

export async function tick(ctx) {
  const st = ctx.state;
  if (!st.turn || !st.deadline || Date.now() < st.deadline - 250) return null;

  // คนถึงตาหลุดอยู่ ให้เวลาผ่อนผันครั้งเดียวก่อนข้าม
  const mine = ctx.members.find(m => m.uid === st.turn);
  if (mine && !mine.online && !st.graced) {
    return { state: { ...st, graced: true, deadline: Date.now() + graceMs(st.turnSeconds) } };
  }
  return { state: nextTurn(st, ctx) };
}

/* สับลำดับแบบ Fisher-Yates */
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
