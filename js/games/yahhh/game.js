/* game.js — สายพานของ Yahhh
   ─────────────────────────────────────────────────────────────
   สองคน ผลัดกันเล่นคนละ 14 รอบ รวม 28 ตา

   หนึ่งตามีสามช่วง
     1. จั่ว 5 ใบ (ระบบจั่วให้เอง ไม่ต้องกด)
     2. ล็อกใบที่ชอบแล้วสุ่มใหม่ ได้อีก 4 รอบ · ข้ามได้ตลอด
     3. เลือกช่องที่จะลง — ลงได้ทุกช่องที่ยังว่าง ได้ศูนย์ก็ลงได้

   **มือของแต่ละคนเปิดให้ทุกคนเห็น** เพราะเกมนี้ไม่มีข้อมูลลับเลย
   เหมือนลูกเต๋าที่ทอยแล้วทุกคนเห็นเหมือนกัน จึงเก็บไว้ในสถานะสาธารณะ
   ต่างจากเกมไพ่อื่นบนแพลตฟอร์มที่มือต้องซ่อน */

import {
  ROWS, HAND, openHand, reroll, scoreFor, openRows, sheetTotal, sheetDone
} from './rules.js';

const TURN_MS = 90000;      /* เพดานเวลาต่อตา กันคนหลุดแล้วเกมค้าง */

const emptySheet = () => Object.fromEntries(ROWS.map(r => [r, null]));

export function init({ members, settings }) {
  const seats = members.filter(m => m.role === 'player' && !m.left).map(m => m.uid).slice(0, 2);
  const first = seats[Math.floor(Math.random() * seats.length)] || seats[0];

  const roll = openHand();
  return {
    state: {
      phase: 'play',
      seats,
      turn: first,
      first,                       /* ใครเริ่ม — ใช้นับรอบใหญ่ ไม่ใช่ที่นั่งแรก */
      sheets: Object.fromEntries(seats.map(u => [u, emptySheet()])),
      hand: roll.hand,
      left: roll.left,
      keep: [],
      round: 1,
      deadline: Date.now() + TURN_MS,
      log: [],
      logSeq: 0,
      names: Object.fromEntries(members.map(m => [m.uid, m.name || '']))
    },
    secrets: { _deck: { rest: roll.deck } }
  };
}

const deckOf = (ctx) => ctx.secrets?._deck?.rest || [];

/* เริ่มตาใหม่ให้คนถัดไป — สับสำรับใหม่ทั้งกองเสมอ */
function nextTurn(st) {
  const i = st.seats.indexOf(st.turn);
  const to = st.seats[(i + 1) % st.seats.length];
  const roll = openHand();
  return {
    state: {
      ...st,
      turn: to,
      hand: roll.hand,
      left: roll.left,
      keep: [],
      /* ครบหนึ่งรอบใหญ่เมื่อวนกลับมาถึงคนที่เริ่ม ไม่ใช่คนที่นั่งแรก
         ถ้าใช้ที่นั่งแรก เกมที่คนที่สองเริ่มจะนับรอบเกินไปหนึ่งเสมอ */
      round: to === st.first ? st.round + 1 : st.round,
      deadline: Date.now() + TURN_MS
    },
    secrets: { _deck: { rest: roll.deck } }
  };
}

/* จบเกมเมื่อทุกคนลงครบทุกช่อง */
function finish(st) {
  const totals = Object.fromEntries(st.seats.map(u => [u, sheetTotal(st.sheets[u])]));
  const best = Math.max(...Object.values(totals));
  const winners = st.seats.filter(u => totals[u] === best);
  return {
    ...st,
    phase: 'over',
    deadline: null,
    result: { totals, winners, draw: winners.length > 1 }
  };
}

export function actionsFor(st, uid) {
  if (st.phase !== 'play' || st.turn !== uid) return [];
  const out = ['score'];
  if (st.left > 0) out.push('reroll');
  return out;
}

export async function onAction(ctx, { uid, type, payload = {} }) {
  const st = ctx.state;
  if (st.phase !== 'play') return null;
  if (!actionsFor(st, uid).includes(type)) return null;

  if (type === 'reroll') return doReroll(ctx, uid, payload.keep || []);
  if (type === 'score') return doScore(ctx, uid, payload.row);
  return null;
}

/* ล็อกใบที่ชอบแล้วสุ่มที่เหลือใหม่ */
function doReroll(ctx, uid, keep) {
  const st = ctx.state;
  const next = reroll({ hand: st.hand, deck: deckOf(ctx), left: st.left }, keep);
  if (!next) return null;

  return {
    state: { ...st, hand: next.hand, left: next.left, keep: [...keep] },
    secrets: { _deck: { rest: next.deck } }
  };
}

/* ลงคะแนนในช่องที่เลือก แล้วส่งตาให้อีกคน */
function doScore(ctx, uid, row) {
  const st = ctx.state;
  if (!ROWS.includes(row)) return null;
  if (st.sheets[uid]?.[row] != null) return null;          /* ช่องนี้ลงไปแล้ว */

  const got = scoreFor(row, st.hand);
  const sheets = { ...st.sheets, [uid]: { ...st.sheets[uid], [row]: got } };
  const said = {
    ...st, sheets,
    log: [...(st.log || []), { key: 'yahhh.log.score', at: (st.logSeq || 0) + 1,
                               args: { name: st.names?.[uid] || '?', row, n: got } }].slice(-40),
    logSeq: (st.logSeq || 0) + 1,
    last: { by: uid, row, n: got, hand: [...st.hand], at: (st.logSeq || 0) + 1 }
  };

  if (st.seats.every(u => sheetDone(sheets[u]))) return { state: finish(said) };
  return nextTurn(said);
}

/* หมดเวลาแล้วยังไม่ลง — ระบบลงให้ในช่องที่ได้คะแนนมากที่สุด
   ทิ้งไปเฉย ๆ ไม่ได้ เพราะกระดานต้องเต็มพอดี 14 ช่องถึงจะจบเกม
   เลือกช่องที่ดีที่สุดแทนการสุ่ม จะได้ไม่ลงโทษคนที่เน็ตหลุดเกินจำเป็น */
export async function tick(ctx) {
  const st = ctx.state;
  if (st.phase !== 'play' || !st.deadline) return null;
  if (Date.now() < st.deadline) return null;

  const open = openRows(st.sheets[st.turn]);
  if (!open.length) return null;
  const best = open.reduce((a, b) => (scoreFor(b, st.hand) > scoreFor(a, st.hand) ? b : a));
  return doScore(ctx, st.turn, best);
}
