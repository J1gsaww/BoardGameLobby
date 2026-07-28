/* duel.test.mjs — ยิงแข่งสองลำพร้อมกัน
   ─────────────────────────────────────────────────────────────
   ระบบนี้แยกจากการโหวตปกติทั้งชุด เทสจึงต้องยืนยันสองอย่างพร้อมกัน
     1. วงยิงทำงานถูกตามกติกา
     2. **ไม่ไปแตะการโหวตเดิมเลย** ซึ่งเป็นเหตุผลที่แยกออกมาตั้งแต่แรก */

import { onAction, init } from './game.js';
import { markCount, occupants, placeOf, actionsFor } from './rules.js';
import { hits, tally, duelWaiting, canDuelNow, roomOn, spoilAsks,
         grabFrom, grabTo } from './duel.js';
import { DECK } from './vote.js';

let pass = 0, fail = 0;
function ok(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail++;
  console.log(`  ไม่ผ่าน: ${name}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`);
}

const P = ['a', 'b', 'c', 'd', 'e'];
const members = P.map((uid, i) => ({ uid, role: 'player', left: false, seat: i, online: true }));

const F = DECK.filter(c => c.attack === 'F').map(c => c.id);
const C = DECK.filter(c => c.attack === 'C').map(c => c.id);
const W = DECK.filter(c => c.attack === 'W').map(c => c.id);

/* ซ้ายได้ไพ่ยิงติด ขวาได้ไพ่ยิงไม่ติด */
function table(hands) {
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['vegan', ...out.secrets._deck.slots.slice(1)] };
  const secrets = {};
  P.forEach((u, i) => { secrets[u] = { vote: hands[u], nation: 'B', pick: null }; });
  return {
    state: { ...out.state, phase: 'play', turn: 'a', seats: [...P], out: [],
             names: Object.fromEntries(P.map(u => [u, u.toUpperCase()])),
             pos: { a: 'shipL:C', b: 'shipL:F', c: 'shipR:C', d: 'shipR:F', e: 'island:G' },
             marks: { a: { bird: 1 }, e: { bird: 2 } } },
    members, settings: { turnSeconds: 0 },
    secrets: { ...secrets, _deck: deck }, hostUid: 'a', rng: () => 0
  };
}

const HANDS = {
  a: [C[0], F[0], F[1]], b: [F[2], F[3], C[1]],
  c: [W[0], W[1], W[2]], d: [W[3], W[4], W[5]], e: [W[6], W[7], W[8]]
};

console.log('\nยิงแข่งสองลำ');

/* กติกาการยิงติด */
ok('มีปืนและไฟมากกว่าน้ำ = ติด', hits({ C: 1, F: 2, W: 1 }), true);
ok('ไม่มีปืน = ไม่ติด', hits({ C: 0, F: 5, W: 0 }), false);
ok('น้ำเท่าไฟ = ไม่ติด', hits({ C: 2, F: 2, W: 2 }), false);

/* ไพ่หน้ารวมต้องนับครบ — เคยพลาดตรงนี้เพราะเขียนตัวนับขึ้นเอง
   CF = ปืนใหญ่กับคบเพลิงในใบเดียว · WW = น้ำสองหน่วย */
{
  const cf = DECK.find(c => c.attack === 'CF').id;
  const ww = DECK.find(c => c.attack === 'WW').id;
  ok('ใบรวม CF นับเป็นปืนหนึ่งกับไฟหนึ่ง', tally([cf]), { C: 1, F: 1 });
  ok('ใบรวม CF ใบเดียวก็ยิงติด', hits(tally([cf])), true);
  ok('ใบ WW นับเป็นน้ำสองหน่วย', tally([ww]), { W: 2 });
  ok('น้ำสองหน่วยดับไฟสองได้', hits(tally([cf, F[0], ww])), false);
}

let ctx = table(HANDS);
let s = (await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } })).state;

ok('เปิดแล้ววงยิงเปิดขึ้น', !!s.duel, true);
ok('ไม่ได้ไปแตะการโหวตเดิมเลย', s.vote ?? null, null);
ok('ตายังไม่ผ่าน รอทั้งสองลำก่อน', s.turn, 'a');
ok('รอทุกคนบนเรือทั้งสองลำ', duelWaiting(s.duel).sort(), ['a', 'b', 'c', 'd']);
ok('คนบนเกาะไม่ต้องส่ง', canDuelNow(s, 'e'), false);

/* ส่งทีละคน */
for (const [uid, card] of [['a', C[0]], ['b', F[2]], ['c', W[0]]]) {
  const r = await onAction({ ...ctx, state: s }, { uid, type: 'duelCard', payload: { card } });
  s = r.state;
  ctx = { ...ctx, secrets: { ...ctx.secrets, ...(r.secrets || {}) } };
}
ok('ส่งไปสามคนแล้วยังไม่เปิดผล', !!s.duel, true);
ok('เหลือรออีกคนเดียว', duelWaiting(s.duel), ['d']);

const last = await onAction({ ...ctx, state: s }, { uid: 'd', type: 'duelCard', payload: { card: W[3] } });
s = last.state;

ok('ครบแล้วปิดวง', s.duel ?? null, null);
ok('เปิดผลทั้งสองฝั่ง', [s.lastDuel.sides.shipL.hit, s.lastDuel.sides.shipR.hit], [true, false]);
ok('สรุปว่าลำซ้ายชนะ', s.lastDuel.won, 'shipL');
ok('ลำที่ชนะไม่โดนอะไร', [s.pos.a, s.pos.b], ['shipL:C', 'shipL:F']);
ok('ลำที่แพ้ลงเกาะทั้งลำ', [placeOf(s.pos.c), placeOf(s.pos.d)], ['island', 'island']);
ok('คนบนเกาะเดิมเสียไพ่โหวตถาวร', s.maxVote.e, 2);
ok('คนบนเรือที่รอดไม่เสียไพ่', s.maxVote.a, 3);
ok('เก็บนกคืนหมดทั้งกระดาน',
   [markCount(s, 'a', 'bird'), markCount(s, 'e', 'bird')], [0, 0]);
ok('ผ่านตาหลังจบ', s.turn !== 'a', true);

/* เสมอกัน — ยิงไม่ติดทั้งคู่ */
{
  const all = { a: [W[0], W[1], W[2]], b: [W[3], W[4], W[5]],
                c: [W[6], W[7], W[8]], d: [W[9], W[10], W[11]], e: [F[0], F[1], F[2]] };
  let c2 = table(all);
  let t = (await onAction(c2, { uid: 'a', type: 'activate', payload: { slot: 0 } })).state;
  for (const [uid, card] of [['a', W[0]], ['b', W[3]], ['c', W[6]], ['d', W[9]]]) {
    const r = await onAction({ ...c2, state: t }, { uid, type: 'duelCard', payload: { card } });
    t = r.state;
    c2 = { ...c2, secrets: { ...c2.secrets, ...(r.secrets || {}) } };
  }
  ok('ยิงไม่ติดทั้งคู่ = เสมอ', t.lastDuel.won, 'tie');
  ok('เสมอแล้วลงเกาะทุกคน',
     ['a', 'b', 'c', 'd'].every(u => placeOf(t.pos[u]) === 'island'), true);
  ok('ลำดับที่ลงเกาะถูกสุ่มมาครบทุกคน', [...t.lastDuel.order].sort(), ['a', 'b', 'c', 'd']);
}

/* ไพ่ต้องถูกคืนหลังจบวงยิง เหมือนหลังโหวตปกติ
   ลืมข้อนี้ไปรอบแรก ผลคือคนที่ส่งไพ่เข้าวงยิงเหลือไพ่น้อยลงถาวร
   ซึ่งคนละเรื่องกับโทษเสียไพ่ถาวรของคนที่อยู่บนเกาะ */
{
  let c3 = table(HANDS);
  let u = (await onAction(c3, { uid: 'a', type: 'activate', payload: { slot: 0 } })).state;
  for (const [uid, card] of [['a', C[0]], ['b', F[2]], ['c', W[0]], ['d', W[3]]]) {
    const r = await onAction({ ...c3, state: u }, { uid, type: 'duelCard', payload: { card } });
    u = r.state;
    c3 = { ...c3, secrets: { ...c3.secrets, ...(r.secrets || {}) } };
  }
  ok('คนบนเรือได้ไพ่คืนจนเต็มมือ',
     ['a', 'b', 'c', 'd'].map(x => c3.secrets[x].vote.length), [3, 3, 3, 3]);
  ok('เพดานของคนบนเรือไม่ลด',
     ['a', 'b', 'c', 'd'].map(x => u.maxVote[x]), [3, 3, 3, 3]);
  ok('คนบนเกาะเพดานลดหนึ่งตามกติกา', u.maxVote.e, 2);
  ok('ตัวเลขที่หน้าจอโชว์ตรงกับมือจริง', u.votes.a, 3);
}

/* ── พวกล่อเรือ — ใช้วงยิงเดียวกัน แต่ผลตอนจบต่างกัน ────── */
console.log('\nพวกล่อเรือ · ชิงกล่อง');

function tableW(hands, cargo, pos) {
  const o = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...o.secrets._deck, slots: ['wreckers', ...o.secrets._deck.slots.slice(1)] };
  const secrets = {};
  P.forEach(u => { secrets[u] = { vote: hands[u], nation: 'B', pick: null }; });
  return {
    state: { ...o.state, phase: 'play', turn: 'a', seats: [...P], out: [], cargo,
             names: Object.fromEntries(P.map(u => [u, u.toUpperCase()])),
             pos: pos || { a: 'shipL:C', b: 'shipL:F', c: 'shipR:C', d: 'shipR:F', e: 'island:G' } },
    members, settings: { turnSeconds: 0 },
    secrets: { ...secrets, _deck: deck }, hostUid: 'a', rng: () => 0
  };
}

async function playDuel(ctx, picks) {
  let s = (await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } })).state;
  for (const [uid, card] of picks) {
    const r = await onAction({ ...ctx, state: s }, { uid, type: 'duelCard', payload: { card } });
    s = r.state;
    ctx = { ...ctx, secrets: { ...ctx.secrets, ...(r.secrets || {}) } };
  }
  return { state: s, ctx };
}

const WIN = [['a', C[0]], ['b', F[2]], ['c', W[0]], ['d', W[3]]];
const TIE = [['a', W[0]], ['b', W[3]], ['c', W[6]], ['d', W[9]]];
const ALLW = { a: [W[0], W[1], W[2]], b: [W[3], W[4], W[5]],
               c: [W[6], W[7], W[8]], d: [W[9], W[10], W[11]], e: [F[0], F[1], F[2]] };

/* ชนะ = กัปตันของลำที่ชนะเลือกเองทีละใบ ว่าเอาฝั่งไหนมาใส่ฝั่งไหน
   กติกาเดียวกับการยิงปกติ ไม่ใช่คำนวณให้เอง */
{
  /* กล่องทั้งเกมมีแปดใบเสมอ ตัวตั้งต้องรวมได้แปดพอดี */
  const cargo = { shipL: { B: 1, F: 0 }, shipR: { B: 2, F: 1 }, island: { B: 1, F: 1 }, merchant: 2 };
  let { state: s, ctx: c } = await playDuel(tableW(HANDS, cargo), WIN);

  ok('ชนะแล้วยังไม่ผ่านตา ต้องเลือกกล่องก่อน', s.turn, 'a');
  ok('ถามกัปตันของลำที่ชนะ', [s.grab.who, s.grab.ship], ['a', 'shipL']);
  ok('เริ่มที่ขั้นเลือกต้นทาง', s.grab.step, 'from');
  ok('ต้องชิงสองใบ', s.grab.left, 2);
  ok('คนอื่นทำอะไรไม่ได้', actionsFor(s, 'b'), []);
  ok('กัปตันตอบได้', actionsFor(s, 'a'), ['grabPick']);

  /* ใบแรก — เอา F จากขวา ไปใส่ B ที่ซ้าย */
  const a1 = await onAction({ ...c, state: s }, { uid: 'a', type: 'grabPick', payload: { side: 'F' } });
  ok('เลือกต้นทางแล้วไปถามปลายทาง', a1.state.grab.step, 'to');
  ok('กล่องยังไม่ขยับจนกว่าจะเลือกครบสองขั้น', a1.state.cargo.shipR.F, 1);

  const a2 = await onAction({ ...c, state: a1.state }, { uid: 'a', type: 'grabPick', payload: { side: 'B' } });
  ok('ย้ายตามที่เลือกจริง',
     [a2.state.cargo.shipR.F, a2.state.cargo.shipL.B], [0, 2]);
  ok('เหลืออีกใบ', a2.state.grab.left, 1);

  /* ใบที่สอง — เอา B จากขวา ไปใส่ F ที่ซ้าย */
  const b1 = await onAction({ ...c, state: a2.state }, { uid: 'a', type: 'grabPick', payload: { side: 'B' } });
  const b2 = await onAction({ ...c, state: b1.state }, { uid: 'a', type: 'grabPick', payload: { side: 'F' } });

  ok('ชิงครบสองใบแล้วจบ', b2.state.grab ?? null, null);
  ok('ปลายทางเป็นไปตามที่กัปตันเลือก',
     b2.state.cargo.shipL, { B: 2, F: 1 });
  ok('ลำที่แพ้เสียไปสองใบ', b2.state.cargo.shipR.B + b2.state.cargo.shipR.F, 1);
  ok('กล่องรวมทั้งเกมไม่เปลี่ยน',
     b2.state.cargo.shipL.B + b2.state.cargo.shipL.F
     + b2.state.cargo.shipR.B + b2.state.cargo.shipR.F
     + b2.state.cargo.island.B + b2.state.cargo.island.F + b2.state.cargo.merchant, 8);
  ok('เลือกครบแล้วผ่านตา', b2.state.turn !== 'a', true);
}

/* ต้นทางที่ไม่มีกล่องเลือกไม่ได้ · ปลายทางที่เต็มเลือกไม่ได้ */
{
  const cargo = { shipL: { B: 3, F: 0 }, shipR: { B: 0, F: 2 }, island: { B: 1, F: 1 }, merchant: 1 };
  const { state: s, ctx: c } = await playDuel(tableW(HANDS, cargo), WIN);
  ok('ลำที่แพ้มีแต่ฝั่ง F จึงเลือกได้ฝั่งเดียว', grabFrom(s.cargo, 'shipR'), ['F']);
  ok('ลำที่ชนะฝั่ง B เต็ม จึงเก็บได้แต่ฝั่ง F', grabTo(s.cargo, 'shipL'), ['F']);
  ok('เลือกต้นทางที่ไม่มีกล่องไม่ได้',
     await onAction({ ...c, state: s }, { uid: 'a', type: 'grabPick', payload: { side: 'B' } }), null);
}

/* ลำที่แพ้หมดแล้ว = หยิบจากเรือสินค้าแทน ข้ามขั้นเลือกต้นทาง */
{
  const cargo = { shipL: { B: 1, F: 0 }, shipR: { B: 0, F: 0 }, island: { B: 1, F: 1 }, merchant: 5 };
  const { state: s } = await playDuel(tableW(HANDS, cargo), WIN);
  ok('ไม่มีต้นทางให้เลือก จึงถามปลายทางเลย', s.grab.step, 'to');
}

/* ลำที่ชนะเต็ม = นับเป็นแพ้ ตกไปใช้กติกาเสมอ */
{
  const cargo = { shipL: { B: 3, F: 3 }, shipR: { B: 1, F: 0 }, island: { B: 1, F: 1 }, merchant: 0 };
  const { state: s } = await playDuel(tableW(HANDS, cargo), WIN);
  ok('ลำที่ชนะเต็มแล้ว = ไม่มีที่ว่าง', roomOn(cargo, 'shipL'), 0);
  ok('จึงตกไปใช้กติกาเสมอ', s.lastDuel.won, 'tie');
  ok('ต้องถามลูกเรือว่าคืนฝั่งไหน', !!s.spoils, true);
}

/* เสมอ = ถามลูกเรือคนท้ายของแต่ละลำ แล้วคืนกล่องทั้งหมด */
{
  const cargo = { shipL: { B: 2, F: 1 }, shipR: { B: 1, F: 2 }, island: { B: 1, F: 1 }, merchant: 0 };
  let { state: s, ctx: c } = await playDuel(tableW(ALLW, cargo), TIE);

  ok('ถามคนท้ายสุดของแต่ละลำ', s.spoils.asks, { shipL: 'b', shipR: 'd' });
  ok('ตายังไม่ผ่านจนกว่าจะตอบครบ', s.turn, 'a');
  ok('คนที่ถูกถามตอบได้', actionsFor(s, 'b'), ['spoilPick']);
  ok('คนอื่นทำอะไรไม่ได้', actionsFor(s, 'e'), []);

  const r1 = await onAction({ ...c, state: s }, { uid: 'b', type: 'spoilPick', payload: { side: 'B' } });
  ok('ตอบคนแรกแล้วยังรออีกคน', !!r1.state.spoils, true);
  ok('ตอบซ้ำไม่ได้',
     await onAction({ ...c, state: r1.state }, { uid: 'b', type: 'spoilPick', payload: { side: 'F' } }), null);

  const r2 = await onAction({ ...c, state: r1.state }, { uid: 'd', type: 'spoilPick', payload: { side: 'F' } });
  ok('ครบแล้วกล่องกลับเรือสินค้าหมด',
     [r2.state.cargo.shipL, r2.state.cargo.shipR], [{ B: 0, F: 0 }, { B: 0, F: 0 }]);
  ok('เรือสินค้าได้ครบหกใบ', r2.state.cargo.merchant, 6);
  ok('กล่องรวมทั้งเกมยังแปด',
     r2.state.cargo.island.B + r2.state.cargo.island.F + r2.state.cargo.merchant, 8);
  ok('ตอบครบแล้วผ่านตา', r2.state.turn !== 'a', true);
}

/* เรือว่างทั้งสองลำ = สองคนท้ายเกาะเลือกแทน */
{
  const pos = { a: 'island:G', b: 'island:2', c: 'island:3', d: 'island:4', e: 'island:5' };
  ok('ท้ายสุดเลือกลำขวา · รองท้ายเลือกลำซ้าย',
     spoilAsks(pos), { shipL: 'd', shipR: 'e' });
}

console.log('');
console.log('\u2500'.repeat(46));
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
