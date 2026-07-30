/* sound.test.mjs — เสียงต้องดังถูกจังหวะ ไม่ดังซ้ำ
   ─────────────────────────────────────────────────────────────
   เสียงผูกกับสถานะ ไม่ใช่การกดปุ่ม ทั้งสองคนจึงได้ยินพร้อมกัน
   ผลข้างเคียงคือหน้าจอวาดใหม่กี่รอบก็เห็นสถานะเดิมนั้นซ้ำ
   ถ้าไม่กันไว้ เสียงจะรัวทุกครั้งที่มีอะไรขยับบนจอ

   ตัวเล่นเสียงจริงผูกกับเบราว์เซอร์ เทสจึงจำลองตรรกะเดียวกันแล้วตรวจลำดับ */

import { FILES } from './sound.js';

let pass = 0, fail = 0;
function ok(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail++;
  console.log(`  ไม่ผ่าน: ${name}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`);
}

console.log('\nเสียงประกอบของ Yahhh');

ok('มีสองไฟล์', FILES.length, 2);
ok('อยู่ในโฟลเดอร์ที่ตกลงไว้',
   FILES.every(f => f.startsWith('assets/effect/')), true);
ok('ชื่อไฟล์ตรงตามที่สั่ง',
   FILES.map(f => f.split('/').pop()).sort(), ['Card.mp3', 'Magic.mp3']);

/* จำลองตรรกะเดียวกับ sound.js แล้วไล่ลำดับเหตุการณ์จริง */
function run(steps) {
  let lastHand = '', lastLeft = -1, lastScore = 0;
  return steps.map(st => {
    const at = st.last?.at || 0;
    if (at && at !== lastScore) {
      lastScore = at; lastHand = st.hand.join(','); lastLeft = st.left;
      return 'Magic';
    }
    const hand = st.hand.join(',');
    const fell = lastLeft >= 0 && st.left < lastLeft;
    const out = (fell && hand !== lastHand) ? 'Card' : '';
    lastHand = hand; lastLeft = st.left;
    return out;
  });
}

const H1 = ['1C', '2D', '3H', '4S', '5X'];
const H2 = ['1C', '2D', '6H', '6S', '6X'];
const H3 = ['3C', '3D', '1H', '2S', '5X'];

ok('เข้าเกมครั้งแรกยังไม่ดัง',
   run([{ hand: H1, left: 4, last: null }]), ['']);

ok('วาดหน้าจอใหม่เฉย ๆ ไม่ดังซ้ำ',
   run([{ hand: H1, left: 4, last: null },
        { hand: H1, left: 4, last: null },
        { hand: H1, left: 4, last: null }]), ['', '', '']);

ok('สุ่มไพ่ใหม่ดังเสียงไพ่',
   run([{ hand: H1, left: 4, last: null },
        { hand: H2, left: 3, last: null }]), ['', 'Card']);

ok('ลงคะแนนดังเสียงเวทมนตร์',
   run([{ hand: H2, left: 3, last: null },
        { hand: H3, left: 4, last: { at: 1 } }]), ['', 'Magic']);

ok('ลงคะแนนแล้วไม่ดังเสียงไพ่ซ้อนมาด้วย',
   run([{ hand: H2, left: 3, last: null },
        { hand: H3, left: 4, last: { at: 1 } },
        { hand: H3, left: 4, last: { at: 1 } }]), ['', 'Magic', '']);

/* ตาใหม่ได้มือใหม่ แต่รอบสุ่มกลับไปเต็ม จึงไม่ใช่การสุ่ม
   ต้องเดินผ่านการลงคะแนนก่อน ไม่งั้นตัวนับยังไม่รู้จักเหตุการณ์นั้น */
ok('ขึ้นตาใหม่ไม่ใช่การสุ่ม จึงไม่ดัง',
   run([{ hand: H2, left: 3, last: null },
        { hand: H1, left: 4, last: { at: 1 } },
        { hand: H3, left: 4, last: { at: 1 } }]), ['', 'Magic', '']);

/* เพิ่งเข้าเกมกลางคัน — เห็นการลงคะแนนครั้งล่าสุดค้างอยู่ในสถานะ
   ดังหนึ่งครั้งแล้วเงียบ ถือว่ารับได้ ดีกว่าพลาดเสียงของตาที่กำลังเล่นอยู่ */
ok('เข้ากลางเกมดังครั้งเดียวแล้วเงียบ',
   run([{ hand: H1, left: 4, last: { at: 7 } },
        { hand: H1, left: 4, last: { at: 7 } }]), ['Magic', '']);

ok('สุ่มติดกันหลายรอบดังทุกรอบ',
   run([{ hand: H1, left: 4, last: null },
        { hand: H2, left: 3, last: null },
        { hand: H3, left: 2, last: null }]), ['', 'Card', 'Card']);

console.log('');
console.log('\u2500'.repeat(46));
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
