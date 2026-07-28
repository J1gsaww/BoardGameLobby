/* shout.test.mjs — ประกาศทุกชนิดต้องมีข้อความและหัวข้อของตัวเอง
   ─────────────────────────────────────────────────────────────
   เขียนขึ้นเพราะเคยพลาดสองรอบด้วยเหตุเดียวกัน
   สายเงื่อนไขที่ยาวมากถูกแก้ทีหลังแล้วสาขาหนึ่งหลุดหายไป
   ประกาศจึงไหลไปจบที่สาขาสุดท้ายซึ่งเป็นข้อความคนละเรื่องกันเลย
   และหัวข้อที่ไม่ได้ลงทะเบียนก็ตกไปเป็นคำว่า EVENT ลอย ๆ

   เทสนี้ไม่ได้เรียกฟังก์ชันวาดจริง (ต้องมี DOM) แต่ตรวจสองอย่างที่พังบ่อย
     1. ทุกชนิดที่โค้ดสร้างขึ้นได้ มีสาขาในสายเงื่อนไขจริง
     2. ทุกชนิดมีหัวข้อลงทะเบียนไว้ ไม่ตกไปใช้ค่าเริ่มต้น */

import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function ok(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail++;
  console.log(`  ไม่ผ่าน: ${name}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`);
}

const here = new URL('.', import.meta.url).pathname;
const scene = readFileSync(here + 'scene.js', 'utf8');
const game = readFileSync(here + 'game.js', 'utf8');
const effects = readFileSync(here + 'effects.js', 'utf8');

/* ชนิดประกาศทั้งหมดที่โค้ดสร้างขึ้นได้จริง */
const made = [...new Set(
  [...game.matchAll(/kind:\s*'([a-zA-Z]+)'/g), ...effects.matchAll(/kind:\s*'([a-zA-Z]+)'/g)]
    .map(m => m[1])
)].filter(k => !['ship', 'island', 'boat'].includes(k)).sort();

console.log('\nประกาศทุกชนิดต้องมีข้อความและหัวข้อ');
console.log('  ชนิดที่โค้ดสร้างได้:', made.join(' · '));

/* สาขาในสายเงื่อนไขของข้อความ */
const branches = new Set([...scene.matchAll(/sh\.kind === '([a-zA-Z]+)'/g)].map(m => m[1]));
/* birds กับ bells มีฉากของตัวเองแยกต่างหาก ไม่ได้ใช้สายข้อความนี้ */
const OWN_STAGE = ['birds', 'bells'];
const noBranch = made.filter(k => !OWN_STAGE.includes(k) && !branches.has(k));
ok('ทุกชนิดมีสาขาข้อความของตัวเอง', noBranch, []);

/* หัวข้อที่ลงทะเบียนไว้ในตาราง HEAD */
const headBlock = scene.slice(scene.indexOf('const HEAD = {'), scene.indexOf('};', scene.indexOf('const HEAD = {')));
const heads = new Set([...headBlock.matchAll(/^\s*([a-zA-Z]+):/gm)].map(m => m[1]));
const noHead = made.filter(k => !OWN_STAGE.includes(k) && !heads.has(k));
ok('ทุกชนิดมีหัวข้อลงทะเบียนไว้', noHead, []);

console.log('');
console.log('\u2500'.repeat(46));
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
