/* bump.mjs — เปลี่ยนเลขรุ่นให้ครบทุกจุดในคำสั่งเดียว
   node bump.mjs            เอาวันนี้ ต่อเลขจากรุ่นเดิม
   node bump.mjs 2026-07-25.70   กำหนดเอง

   เลขรุ่นอยู่ 6 จุด แก้มือแล้วตกจุดเดียวจะเจ็บหนัก
     version.json          ตัวจริงที่หน้าเว็บดึงสดมาเทียบ
     index.html data-build รุ่นของหน้าที่กำลังเปิดอยู่
     index.html ?v= สามที่ ตัวล้างแคชของ css/app.css · js/env.js · js/app.js
     js/env.js window.BUILD

   ตกที่ version.json จุดเดียว = แถบแดงขึ้นค้างตลอด กด Reload ก็ไม่หาย
   ตกที่ ?v= = ไฟล์ใหม่ขึ้นไปแล้วแต่เบราว์เซอร์ยังหยิบของเก่ามาใช้ */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OLD = JSON.parse(readFileSync('version.json', 'utf8')).build;

function nextBuild() {
  const d = new Date();
  const today = [d.getFullYear(), d.getMonth() + 1, d.getDate()]
    .map((n, i) => (i ? String(n).padStart(2, '0') : n)).join('-');
  const [oldDay, oldNo] = OLD.split('.');
  return `${today}.${oldDay === today ? Number(oldNo) + 1 : Number(oldNo) + 1}`;
}

const NEW = process.argv[2] || nextBuild();
if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(NEW)) {
  console.log(`รูปแบบเลขรุ่นต้องเป็น 2026-07-25.70 — ได้มา "${NEW}"`);
  process.exit(1);
}

const STAMP = /\d{4}-\d{2}-\d{2}\.\d+/;

/* แก้เฉพาะจุดที่เป็นเลขรุ่นจริง ๆ ไม่ได้ไล่แทนที่ทุกอย่างที่หน้าตาเหมือนวันที่
   เพราะถ้าจุดใดจุดหนึ่งค้างเป็นรุ่นเก่าอยู่ การไล่แทนที่ค่าเดิมจะข้ามจุดนั้นไปเงียบ ๆ */
const edits = {
  'version.json': [[/("build"\s*:\s*")[^"]+(")/, `$1${NEW}$2`]],
  'index.html': [
    [/(data-build=")[^"]+(")/g, `$1${NEW}$2`],
    /* จับเฉพาะค่าที่อยู่ใน src= หรือ href= จริง ๆ
       ของเดิมจับคำว่าเลขรุ่นที่ไหนก็ได้ในไฟล์ พอมีคอมเมนต์อธิบายเรื่องนี้
       คอมเมนต์เองก็โดนกินไปด้วย แล้วแท็บข้างล่างพังตามทั้งบล็อก */
    [/((?:src|href)="[^"]*\?v=)[^"]*(")/g, `$1${NEW}$2`]
  ],
  'js/env.js': [[/(window\.BUILD\s*=\s*')[^']+(')/, `$1${NEW}$2`]]
};

let total = 0;
for (const [f, rules] of Object.entries(edits)) {
  let src = readFileSync(f, 'utf8');
  let hits = 0;
  for (const [re, to] of rules) {
    src = src.replace(re, (...m) => { hits++; return to.replace(/\$(\d)/g, (_, i) => m[i]); });
  }
  writeFileSync(f, src);
  total += hits;
  console.log(`  ${f} — เปลี่ยน ${hits} จุด`);
}

if (!total) { console.log('\nไม่พบจุดที่ต้องเปลี่ยนเลย ตรวจโครงไฟล์ก่อน'); process.exit(1); }

/* ── แผนที่โมดูล ────────────────────────────────────────────
   ?v= ที่ต่อท้าย app.js บังคับให้โหลดใหม่ได้แค่ตัวมันเอง
   ไฟล์ที่มัน import ต่อ (i18n.js, board.js, rules.js, ...) เขียนเป็นชื่อไฟล์เปล่า
   เบราว์เซอร์จึงหยิบของเก่าในแคชมาใช้ปนกับไฟล์ใหม่ — อาการคือแก้แล้วไม่เปลี่ยน
   หรือเปลี่ยนครึ่ง ๆ เช่นปุ่มใหม่โผล่แต่คำแปลยังเป็นคีย์ดิบ

   แก้ด้วย importmap: ประกาศไว้ว่าทุก path ให้ไปหยิบเวอร์ชันที่ต่อ ?v= แทน
   สร้างใหม่ทุกครั้งที่ bump จึงไม่มีทางลืมไฟล์ใหม่ */
function walk(dir) {
  return readdirSync(dir).flatMap(f => {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) return walk(full);
    return f.endsWith('.js') && !f.endsWith('.test.mjs') ? [full] : [];
  });
}

/* ไฟล์ที่มีเฉพาะในเครื่องผู้ใช้ ไม่ได้อยู่ในรีโป (คีย์ไม่ควรขึ้น GitHub)
   ต้องใส่ในแผนที่ด้วยเสมอ ไม่งั้นเครื่องที่มีไฟล์จริงจะฟ้องว่าแผนที่ขาด
   และไฟล์นั้นก็จะไม่ถูกล้างแคชตอนเปลี่ยนเลขรุ่น */
const LOCAL_ONLY = ['./js/firebase-config.js'];

const found = walk('js').map(f => './' + f.replace(/\\/g, '/'));
const mods = [...new Set([...found, ...LOCAL_ONLY])].sort();
const map = { imports: Object.fromEntries(mods.map(m => [m, `${m}?v=${NEW}`])) };

let html = readFileSync('index.html', 'utf8');
html = html.replace(/<script type="importmap" id="modmap">[\s\S]*?<\/script>/,
  `<script type="importmap" id="modmap">${JSON.stringify(map)}</script>`);
writeFileSync('index.html', html);
console.log(`  index.html — แผนที่โมดูล ${mods.length} ไฟล์`);

console.log(`\n${OLD}  →  ${NEW}   (${total} จุด + แผนที่โมดูล)`);
