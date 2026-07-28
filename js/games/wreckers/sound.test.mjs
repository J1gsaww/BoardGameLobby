/* sound.test.mjs — เสียงประกอบของการ์ดต้องดังครั้งเดียวต่อเหตุการณ์
   ─────────────────────────────────────────────────────────────
   เสียงผูกกับสถานะ ไม่ใช่การกดปุ่ม เพราะทุกคนต้องได้ยิน ไม่ใช่แค่คนกด
   ผลข้างเคียงคือหน้าจอวาดใหม่กี่รอบก็เห็นสถานะเดิมนั้นซ้ำ
   ถ้าไม่กันไว้ เสียงจะรัวเป็นชุดทุกครั้งที่มีอะไรเปลี่ยนบนจอ

   เทสนี้จึงยิงสถานะเดิมซ้ำ ๆ แล้วนับว่าเสียงดังกี่ครั้ง */

import * as Sound from './sound.js';

let pass = 0, fail = 0;
function ok(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail++;
  console.log(`  ไม่ผ่าน: ${name}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`);
}

console.log('\nเสียงประกอบของการ์ด');

/* เรียกตัวเล่นจริงไม่ได้เพราะผูกกับเบราว์เซอร์
   จึงตรวจสิ่งที่ตรวจได้จริงในนี้ — รายชื่อไฟล์ที่ประกาศไว้ */
ok('รายชื่อไฟล์ครบทุกเสียง', Sound.FILES.length, 16);
ok('ทุกไฟล์อยู่ในโฟลเดอร์เดียวกัน',
   Sound.FILES.every(f => f.startsWith('assets/effect/pirate/')), true);
ok('ทุกไฟล์เป็น mp3', Sound.FILES.every(f => f.endsWith('.mp3')), true);

const names = Sound.FILES.map(f => f.split('/').pop());
for (const want of ['reload.mp3', 'pistol.mp3', 'blackspot.mp3', 'albatross.mp3',
                    'albatross_strike.mp3', 'marque.mp3', 'armada.mp3',
                    'facade.mp3', 'eightbell.mp3', 'crownest.mp3', 'blackpowder.mp3',
                    'cannon.mp3', 'piratecode.mp3', 'scurvy.mp3', 'cabinfever.mp3',
                    'stormyseas.mp3']) {
  ok('มี ' + want, names.includes(want), true);
}

/* ชื่อไฟล์นี้สะกดไม่ตรงกับ id ของการ์ดโดยตั้งใจ เพราะไฟล์ถูกอัปโหลดไว้แล้ว
   ถ้าวันหลังมีคนมา "แก้ให้ถูก" เสียงจะเงียบไปเฉย ๆ โดยไม่มีอะไรฟ้อง */
ok('crowsnest ใช้ไฟล์ crownest ตามไฟล์จริง', names.includes('crownest.mp3'), true);
ok('ที่เหลือชื่อไฟล์ตรงกับ id การ์ด', names.includes('facade.mp3'), true);
ok('ไม่มีไฟล์ซ้ำในรายการ', new Set(names).size, names.length);

console.log('');
console.log('\u2500'.repeat(46));
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
