/* check-build.mjs — เลขรุ่นทุกจุดต้องตรงกัน
   รันด้วย  node check-build.mjs

   จับกรณีที่แก้เลขรุ่นไม่ครบ ซึ่งไม่ทำให้โค้ดพัง แต่ทำให้
   แถบแดง "หน้าเว็บค้าง" ขึ้นตลอดกาล หรือเบราว์เซอร์หยิบไฟล์เก่ามาใช้เงียบ ๆ
   ทั้งสองอย่างหาสาเหตุยากมากเพราะไม่มี error อะไรออกมาเลย */

import { readFileSync } from 'node:fs';

const found = [];
const add = (where, val) => found.push({ where, val });

add('version.json', JSON.parse(readFileSync('version.json', 'utf8')).build);

const html = readFileSync('index.html', 'utf8');
const db = html.match(/data-build="([^"]+)"/);
add('index.html data-build', db ? db[1] : '(ไม่มี)');
for (const m of html.matchAll(/(?:src|href)="([^"]+)\?v=([^"]+)"/g)) {
  add(`index.html ${m[1]}`, m[2]);
}

const env = readFileSync('js/env.js', 'utf8').match(/window\.BUILD\s*=\s*'([^']+)'/);
add('js/env.js window.BUILD', env ? env[1] : '(ไม่มี)');

const set = new Set(found.map(f => f.val));
found.forEach(f => console.log(`  ${f.val}   ${f.where}`));

if (set.size === 1) {
  console.log(`\nเลขรุ่นตรงกันทุกจุด — ${[...set][0]}`);
} else {
  console.log('\nเลขรุ่นไม่ตรงกัน — รัน  node bump.mjs  แทนการแก้มือ');
  process.exit(1);
}
