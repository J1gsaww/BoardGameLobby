/* nodata.test.mjs — ไล่หาค่า undefined ในสถานะที่จะถูกเขียนขึ้น Firestore
   ─────────────────────────────────────────────────────────────
   Firestore **ปฏิเสธทั้งชุดคำสั่ง** ถ้าเจอ undefined แม้ตัวเดียว
   ไม่ใช่ข้ามฟิลด์นั้นไป แต่ล้มทั้งก้อน

   ผลคือผู้เล่นกดปุ่มแล้วเงียบสนิท ไม่มีอะไรเกิดขึ้นและไม่มีอะไรบอกว่าทำไม
   ส่วนเทสปกติจะผ่านหมด เพราะตรรกะถูกต้องทุกบรรทัด ปัญหาอยู่ที่รูปร่างข้อมูล

   เทสนี้จึงเดินการ์ดทุกใบที่ทำแล้ว แล้วไล่ทุกกิ่งของสถานะกับข้อมูลลับ
   ถ้าเจอ undefined ที่ไหนก็ฟ้องพร้อมบอกเส้นทางว่าอยู่ตรงไหน */

import { init, onAction } from './game.js';

let pass = 0, fail = 0;
function ok(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail++;
  console.log(`  ไม่ผ่าน: ${name}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`);
}

/* ไล่ทุกกิ่งแบบเดียวกับที่ Firestore ไล่ตอนเขียน */
function findBlank(v, path = '') {
  const out = [];
  if (v === undefined) return [path || '(root)'];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, x] of Object.entries(v)) out.push(...findBlank(x, path ? `${path}.${k}` : k));
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => out.push(...findBlank(x, `${path}[${i}]`)));
  }
  return out;
}

const P = ['a', 'b', 'c', 'd'];
const members = P.map((uid, i) => ({ uid, role: 'player', left: false, seat: i, online: true }));

function table(card, pos) {
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: [card, ...out.secrets._deck.slots.slice(1)] };
  const secrets = Object.fromEntries(P.map((u, i) => [u, {
    vote: [1, 2, 3].map(n => 'v' + String(i * 3 + n).padStart(2, '0')),
    nation: 'B', pick: null
  }]));
  return {
    state: { ...out.state, phase: 'play', turn: 'a', seats: [...P], out: [],
             names: Object.fromEntries(P.map(u => [u, u.toUpperCase()])),
             pos: pos || { a: 'shipL:C', b: 'shipL:F', c: 'shipR:C', d: 'island:G' } },
    members, settings: { turnSeconds: 0 },
    secrets: { ...secrets, _deck: deck }, hostUid: 'a'
  };
}

function check(label, res) {
  const blanks = [...findBlank(res?.state || {}, 'state'),
                  ...findBlank(res?.secrets || {}, 'secrets')];
  ok(label, blanks, []);
}

console.log('\nไม่มีค่า undefined หลุดไปถึง Firestore');

/* การ์ดที่ผลเกิดทันทีตอนเปิด */
for (const card of ['blackspot', 'albatross', 'facade', 'eightbell', 'piratecode']) {
  const ctx = table(card);
  check(card + ' · เปิดแล้วจบในตัว',
        await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } }));
}

/* การ์ดที่ต้องเลือกเป้าเป็นคน */
{
  const ctx = table('pistol');
  const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  check('pistol · ตอนถามเป้า', up);
  check('pistol · ตอนใช้จริง',
        await onAction({ ...ctx, state: up.state }, { uid: 'a', type: 'useCard', payload: { target: 'b' } }));
}

/* การ์ดที่ต้องเลือกเรือเล็ก — ใบที่เคยทำให้ทั้งชุดคำสั่งล้ม
   เพราะบรรทัดบันทึกไปหาชื่อผู้เล่นของ 'boatL' ซึ่งไม่มีอยู่จริง */
{
  const ctx = table('blackpowder');
  const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  check('blackpowder · ตอนถามเรือเล็ก', up);
  check('blackpowder · ตอนระเบิดจริง',
        await onAction({ ...ctx, state: up.state }, { uid: 'a', type: 'useCard', payload: { target: 'boatL' } }));
}

/* แผนที่ — เปิดแล้วยกให้คนอื่น */
for (const card of ['fountain', 'atlantis', 'eldorado']) {
  const ctx = table(card);
  const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  check(card + ' · ตอนถามคนรับ', up);
  check(card + ' · ตอนยกให้',
        await onAction({ ...ctx, state: up.state }, { uid: 'a', type: 'useCard', payload: { target: 'b' } }));
}

/* จดหมาย — เก็บเข้ามือแล้วใช้ทีหลัง */
{
  const ctx = table('marque');
  const got = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  check('marque · ตอนเข้ามือ', got);

  const mine = { ...got.state, turn: 'a' };
  const c2 = { ...ctx, state: mine, secrets: { ...ctx.secrets, a: got.secrets.a } };
  const play = await onAction(c2, { uid: 'a', type: 'playHeld', payload: { card: 'marque' } });
  check('marque · ตอนหยิบมาใช้', play);

  const c3 = { ...c2, state: play.state };
  const who = await onAction(c3, { uid: 'a', type: 'useCard', payload: { target: 'd' } });
  check('marque · ตอนเลือกคน', who);
  check('marque · ตอนเลือกเรือ',
        await onAction({ ...c3, state: who.state }, { uid: 'a', type: 'useCard', payload: { target: 'shipR' } }));
}

/* รังกา — เลือกคนแล้วเลือกไพ่สามใบ */
{
  const ctx = table('crowsnest');
  const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  const who = await onAction({ ...ctx, state: up.state }, { uid: 'a', type: 'useCard', payload: { target: 'b' } });
  check('crowsnest · ตอนส่งกองให้เลือก', who);

  const c2 = { ...ctx, state: who.state, secrets: { ...ctx.secrets, a: who.secrets.a } };
  check('crowsnest · ตอนเลือกครบสามใบ',
        await onAction(c2, { uid: 'a', type: 'useCard', payload: { cards: who.secrets.a.pool.slice(0, 3) } }));
}

console.log('');
console.log('\u2500'.repeat(46));
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
