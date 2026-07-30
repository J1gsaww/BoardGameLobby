/* force.test.mjs — บังคับให้คนอื่นเปิดการ์ด เดินครบทั้งสองเส้นทาง
   ─────────────────────────────────────────────────────────────
   เขียนขึ้นเพราะแก้เรื่องนี้ไปสามรอบแล้วยังใช้ไม่ได้จริง
   ทุกรอบพี่เทสแต่เส้นทางเดียว แล้วอีกเส้นทางพังเงียบ ๆ

   เส้นทางเข้ามีสองทาง — กดปุ่มในคอลัมน์ Action แล้วค่อยเลือกคน
   กับกดจากเมนูข้างตัวคนนั้นซึ่งเป้าติดมาแล้ว
   ทั้งสองต้องจบที่จุดเดียวกันเป๊ะ */

import { onAction, init } from './game.js';
import { actionsFor } from './rules.js';

let pass = 0, fail = 0;
function ok(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail++;
  console.log(`  ไม่ผ่าน: ${name}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`);
}

const P = ['a', 'b', 'c'];
const members = P.map((uid, i) => ({ uid, role: 'player', left: false, seat: i, online: true }));

function table() {
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck,
                 slots: ['blackspot', 'pistol', 'albatross', 'facade', 'relief'] };
  const secrets = Object.fromEntries(P.map((u, i) => [u, {
    vote: [1, 2, 3].map(n => 'v' + String(i * 3 + n).padStart(2, '0')),
    nation: 'B', pick: null
  }]));
  return {
    state: { ...out.state, phase: 'play', turn: 'a', seats: [...P], out: [],
             names: { a: 'A', b: 'B', c: 'C' },
             pos: { a: 'shipL:C', b: 'shipL:F', c: 'island:G' } },
    members, settings: { turnSeconds: 0 },
    secrets: { ...secrets, _deck: deck }, hostUid: 'a'
  };
}

console.log('\nบังคับให้คนอื่นเปิดการ์ด');

/* เส้นทาง 1 — กดปุ่มก่อน แล้วค่อยเลือกคน */
{
  const ctx = table();
  const s1 = await onAction(ctx, { uid: 'a', type: 'force', payload: {} });
  ok('กดปุ่มเปล่า ๆ = ถามว่าจะบังคับใคร', s1.state.pending.needs, 'player');
  ok('ยังเป็นตาของคนสั่ง', s1.state.turn, 'a');

  const s2 = await onAction({ ...ctx, state: s1.state },
                            { uid: 'a', type: 'useCard', payload: { target: 'b' } });
  ok('เลือกคนแล้วไปขั้นเลือกการ์ด', s2.state.pending.needs, 'slots');
  ok('จำเป้าไว้ถูกคน', s2.state.pending.picks.player, 'b');
}

/* เส้นทาง 2 — กดจากเมนูข้างตัวคนนั้น เป้าติดมาเลย */
{
  const ctx = table();
  const s1 = await onAction(ctx, { uid: 'a', type: 'force', payload: { target: 'b' } });
  ok('เป้าติดมาแล้ว = ข้ามไปขั้นเลือกการ์ดเลย', s1.state.pending.needs, 'slots');
  ok('ไม่ถามซ้ำสิ่งที่เพิ่งเลือก', s1.state.pending.picks.player, 'b');

  ok('ส่งเป้าเป็นตัวเองไม่ได้ ตกกลับไปถามใหม่',
     (await onAction(ctx, { uid: 'a', type: 'force', payload: { target: 'a' } }))
       .state.pending.needs, 'player');
  ok('ส่งเป้าที่ไม่มีอยู่จริงก็ตกกลับไปถามใหม่',
     (await onAction(ctx, { uid: 'a', type: 'force', payload: { target: 'zz' } }))
       .state.pending.needs, 'player');
}

/* ทั้งสองเส้นทางต้องจบเหมือนกันทุกอย่าง */
{
  const viaButton = await (async () => {
    const ctx = table();
    const s1 = await onAction(ctx, { uid: 'a', type: 'force', payload: {} });
    const s2 = await onAction({ ...ctx, state: s1.state },
                              { uid: 'a', type: 'useCard', payload: { target: 'b' } });
    return onAction({ ...ctx, state: s2.state },
                    { uid: 'a', type: 'useCard', payload: { cards: [0, 3] } });
  })();

  const viaMenu = await (async () => {
    const ctx = table();
    const s1 = await onAction(ctx, { uid: 'a', type: 'force', payload: { target: 'b' } });
    return onAction({ ...ctx, state: s1.state },
                    { uid: 'a', type: 'useCard', payload: { cards: [0, 3] } });
  })();

  ok('เส้นทางปุ่ม · ตั้งสถานะบังคับถูก',
     [viaButton.state.forced.who, viaButton.state.forced.slots], ['b', [0, 3]]);
  ok('เส้นทางเมนู · ตั้งสถานะบังคับถูก',
     [viaMenu.state.forced.who, viaMenu.state.forced.slots], ['b', [0, 3]]);
  ok('สองเส้นทางได้ผลเหมือนกันเป๊ะ',
     JSON.stringify(viaButton.state.forced.slots) === JSON.stringify(viaMenu.state.forced.slots)
     && viaButton.state.forced.who === viaMenu.state.forced.who, true);

  /* คนที่ถูกบังคับเลือกได้แค่สองใบนั้น */
  const ctx = { ...table(), state: viaMenu.state };
  ok('เขาทำได้อย่างเดียวคือเปิด', actionsFor(viaMenu.state, 'b'), ['activate']);
  ok('คนสั่งทำอะไรต่อไม่ได้', actionsFor(viaMenu.state, 'a'), []);
  ok('เปิดใบที่ไม่ได้ถูกชี้ไม่ได้',
     await onAction(ctx, { uid: 'b', type: 'activate', payload: { slot: 1 } }), null);

  const flip = await onAction(ctx, { uid: 'b', type: 'activate', payload: { slot: 0 } });
  ok('ผลตกที่คนเปิด ไม่ใช่คนสั่ง', flip.state.pos.b.startsWith('island'), true);
  ok('คนสั่งไม่โดนอะไร', flip.state.pos.a, 'shipL:C');
  ok('ปลดสถานะบังคับแล้ว', flip.state.forced ?? null, null);
}

/* ไม่มีกองไพ่ถูกส่งมาให้ = ห้ามมีหน้าต่างเลือกไพ่โผล่มา */
{
  const ctx = table();
  const s1 = await onAction(ctx, { uid: 'a', type: 'force', payload: { target: 'b' } });
  ok('ไม่มีกองไพ่ในข้อมูลลับของคนสั่ง', s1.secrets?.a?.pool ?? null, null);
}

/* สั่ง Force ติดกันหลายรอบ — เคยพังเว้นรอบ
   เพราะการ์ดที่เพิ่งเปิดค้างอยู่ในสถานะข้ามตา
   ฉากจึงไปหยิบใบเก่ามาแสดงแทนขั้นเลือก แล้วกดอะไรไม่ได้ */
{
  let ctx = table();
  let s = ctx.state;

  for (let round = 1; round <= 4; round++) {
    const r1 = await onAction({ ...ctx, state: s },
                              { uid: 'a', type: 'force', payload: { target: 'b' } });
    s = r1.state;
    ok('รอบ ' + round + ' · ไม่มีการ์ดเก่าค้างตอนเริ่ม', s.cardUp ?? null, null);
    ok('รอบ ' + round + ' · ขั้นถามเป็นของ Force เอง', s.pending.card, 'force');

    const r2 = await onAction({ ...ctx, state: s },
                              { uid: 'a', type: 'useCard', payload: { cards: [0, 1] } });
    s = r2.state;
    ok('รอบ ' + round + ' · ตั้งสถานะบังคับได้', s.forced.who, 'b');

    const r3 = await onAction({ ...ctx, state: s },
                              { uid: 'b', type: 'activate', payload: { slot: 0 } });

    /* วนกลับมาถึงตาเขาอีกครั้ง — ล้างเฉพาะสิ่งที่ตาใหม่ล้างอยู่แล้ว
       **จงใจไม่ล้าง cardUp** เพราะนั่นคือสิ่งที่เทสนี้ตรวจว่าไม่หลุดข้ามรอบ
       ส่วนใบที่เปิดได้อาจเป็นใบที่ต้องเลือกเป้า จึงต้องล้าง pending ให้เหมือนจบตาจริง */
    s = { ...r3.state, turn: 'a', pending: null, forced: null, aim: null, vote: null };
    ctx = { ...ctx, secrets: { ...ctx.secrets, ...(r3.secrets || {}) } };
  }
}

console.log('');
console.log('\u2500'.repeat(46));
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
