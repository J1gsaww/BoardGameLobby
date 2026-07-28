/* duel.test.mjs — ยิงแข่งสองลำพร้อมกัน
   ─────────────────────────────────────────────────────────────
   ระบบนี้แยกจากการโหวตปกติทั้งชุด เทสจึงต้องยืนยันสองอย่างพร้อมกัน
     1. วงยิงทำงานถูกตามกติกา
     2. **ไม่ไปแตะการโหวตเดิมเลย** ซึ่งเป็นเหตุผลที่แยกออกมาตั้งแต่แรก */

import { onAction, init } from './game.js';
import { markCount, occupants, placeOf } from './rules.js';
import { hits, tally, duelWaiting, canDuelNow } from './duel.js';
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
ok('มีปืนและไฟมากกว่าน้ำ = ติด', hits({ cannon: 1, fire: 2, water: 1 }), true);
ok('ไม่มีปืน = ไม่ติด', hits({ cannon: 0, fire: 5, water: 0 }), false);
ok('น้ำเท่าไฟ = ไม่ติด', hits({ cannon: 2, fire: 2, water: 2 }), false);

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

console.log('');
console.log('\u2500'.repeat(46));
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
