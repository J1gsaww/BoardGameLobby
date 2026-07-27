/* hand.test.mjs — ใช้การ์ดในมือตอนที่ยังไม่ถึงตาตัวเองได้จริงไหม
   ─────────────────────────────────────────────────────────────
   เขียนขึ้นเพราะแก้เรื่องนี้ไปสี่รอบแล้วยังใช้ไม่ได้จริง
   สาเหตุคือเทสแต่ฟังก์ชันเดี่ยว ๆ ไม่เคยเทสทั้งเส้นทางตั้งแต่คำขอจนถึงผล

   เทสนี้จึงยิงคำขอเข้าไปแบบเดียวกับที่ผู้เล่นกดปุ่มจริง
   และเช็กทุกด่านที่คำขอต้องผ่าน ไม่ใช่แค่ด่านสุดท้าย */

import { onAction, init } from './game.js';
import { actionsFor } from './rules.js';
import { usableAnytime } from './effects.js';

let pass = 0, fail = 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ok(name, got, want) {
  if (same(got, want)) { pass++; return; }
  fail++;
  console.log(`  ไม่ผ่าน: ${name}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`);
}

const P = ['a', 'b', 'c', 'd', 'e'];
const members = P.map((uid, i) => ({ uid, role: 'player', left: false, seat: i, online: true }));

function table(holder, card) {
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const st = {
    ...out.state, phase: 'play', seats: [...P], turn: 'b', out: [],
    names: Object.fromEntries(P.map(u => [u, u])),
    pos: { a: 'shipL:C', b: 'shipL:F', c: 'shipR:C', d: 'shipR:F', e: 'island:G' },
    held: { [holder]: 1 }
  };
  const secrets = Object.fromEntries(P.map(u => [u, { vote: ['v01'], nation: 'B', pick: null }]));
  secrets[holder] = { ...secrets[holder], held: [card] };
  return { state: st, members, settings: { turnSeconds: 0 },
           secrets: { ...secrets, _deck: out.secrets._deck }, hostUid: 'a' };
}

console.log('\nใช้การ์ดในตาคนอื่น');
{
  const ctx = table('e', 'atlantis');
  const st = ctx.state;

  ok('ยังไม่ถึงตาของคนถือการ์ด', st.turn !== 'e', true);
  ok('กติกาบอกว่าใบนี้ใช้ได้ทุกตา', usableAnytime('atlantis'), true);
  ok('รายการ Action ปกติว่างเปล่าเพราะยังไม่ถึงตา', actionsFor(st, 'e'), []);

  /* ด่านที่คำขอต้องผ่าน — จุดที่เคยตกคือด่านนี้ ไม่ใช่ตัวผลการ์ด */
  const r = await onAction(ctx, { uid: 'e', type: 'playHeld', payload: { card: 'atlantis' } });
  ok('คำขอผ่านด่าน ไม่ถูกปฏิเสธ', r !== null, true);
  ok('จองไว้รอจบตา', r?.state?.queued?.card, 'atlantis');
  ok('ล็อกเป้าเป็นคนที่จะเล่นตาถัดไป', r?.state?.queued?.target, 'c');
  ok('ตายังเป็นของคนเดิม', r?.state?.turn, 'b');
  ok('การ์ดออกจากมือทันที', r?.secrets?.e?.held, []);
}
{
  /* ใบที่ไม่ใช่แบบใช้ได้ทุกตา ต้องยังถูกปฏิเสธเหมือนเดิม */
  const ctx = table('e', 'marque');
  const r = await onAction(ctx, { uid: 'e', type: 'playHeld', payload: { card: 'marque' } });
  ok('ใบธรรมดายังต้องรอตาตัวเอง', r, null);
}
{
  /* ถือการ์ดแต่ไม่ใช่เจ้าของ — สั่งแทนกันไม่ได้ */
  const ctx = table('e', 'atlantis');
  const r = await onAction(ctx, { uid: 'd', type: 'playHeld', payload: { card: 'atlantis' } });
  ok('คนที่ไม่ได้ถือ สั่งไม่ได้', r, null);
}
{
  /* ผลต้องเกิดจริงหลังเจ้าของตาทำ Action เสร็จ */
  const ctx = table('e', 'atlantis');
  const q = await onAction(ctx, { uid: 'e', type: 'playHeld', payload: { card: 'atlantis' } });
  const ctx2 = { ...ctx, state: q.state, secrets: { ...ctx.secrets, e: q.secrets.e } };
  const done = await onAction(ctx2, { uid: 'b', type: 'toBoat', payload: { boat: 'boatL' } });
  ok('จบตาแล้วผลเกิดจริง', done?.state?.pos?.e?.startsWith('shipR'), true);
  ok('ล้างของที่จองไว้', done?.state?.queued, null);
}

console.log('');
console.log('\u2500'.repeat(46));
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
