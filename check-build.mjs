/* check-build.mjs — เลขรุ่นทุกจุดต้องตรงกัน
   รันด้วย  node check-build.mjs

   จับกรณีที่แก้เลขรุ่นไม่ครบ ซึ่งไม่ทำให้โค้ดพัง แต่ทำให้
   แถบแดง "หน้าเว็บค้าง" ขึ้นตลอดกาล หรือเบราว์เซอร์หยิบไฟล์เก่ามาใช้เงียบ ๆ
   ทั้งสองอย่างหาสาเหตุยากมากเพราะไม่มี error อะไรออกมาเลย */

import { readFileSync, readdirSync, statSync } from 'node:fs';

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

/* แผนที่โมดูลต้องครอบคลุมทุกไฟล์ที่มีอยู่จริง และต้องเป็นเลขรุ่นเดียวกันหมด
   ตกไฟล์เดียวก็พอที่จะทำให้เบราว์เซอร์ผสมของเก่ากับของใหม่ในหน้าเดียวกัน */
const mapTag = html.match(/id="modmap">([\s\S]*?)<\/script>/);
if (!mapTag) {
  add('index.html importmap', '(ไม่มีแผนที่โมดูล)');
} else {
  const imports = JSON.parse(mapTag[1]).imports || {};
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const full = `${dir}/${f}`;
      if (statSync(full).isDirectory()) walk(full);
      else if (f.endsWith('.js') && !f.endsWith('.test.mjs')) files.push('./' + full);
    }
  };
  walk('js');

  const missing = files.filter(f => !imports[f]);
  if (missing.length) add(`index.html importmap (ขาด ${missing.length} ไฟล์)`, '(ไม่ครบ)');
  else {
    const vals = new Set(Object.values(imports).map(v => v.split('?v=')[1]));
    add(`index.html importmap (${files.length} ไฟล์)`, vals.size === 1 ? [...vals][0] : '(ปนกัน)');
  }
}

const set = new Set(found.map(f => f.val));
found.forEach(f => console.log(`  ${f.val}   ${f.where}`));

if (set.size === 1) {
  console.log(`\nเลขรุ่นตรงกันทุกจุด — ${[...set][0]}`);
} else {
  console.log('\nเลขรุ่นไม่ตรงกัน — รัน  node bump.mjs  แทนการแก้มือ');
  process.exit(1);
}
