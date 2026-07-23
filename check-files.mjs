/* check-files.mjs — ไล่กราฟ import จาก index.html ว่าไฟล์ครบไหม
   รันก่อน push ทุกครั้ง  →  node check-files.mjs
   จับกรณีที่ลืม push โฟลเดอร์ใหม่ ซึ่งทำให้จอว่างเปล่าโดยไม่มีอะไรบอก */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize, extname } from 'node:path';

const seen = new Set(), missing = [], queue = [];
const html = readFileSync('index.html', 'utf8');
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (!m[1].startsWith('http')) queue.push(m[1].split('?')[0]);
}
queue.push('version.json');

while (queue.length) {
  const f = normalize(queue.pop());
  if (seen.has(f)) continue;
  seen.add(f);
  if (!existsSync(f)) { missing.push(f); continue; }
  if (extname(f) !== '.js') continue;
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:import|from)\s+['"](\.[^'"]+)['"]/g)) {
    queue.push(join(dirname(f), m[1]));
  }
}

console.log(`ไฟล์ที่หน้าเว็บต้องใช้ ${seen.size} ไฟล์`);
if (missing.length) {
  console.log('\nไฟล์ที่หายไป — push ขึ้นไปแล้วหน้าเว็บจะว่างเปล่า:');
  missing.forEach(f => console.log('  ' + f));
  process.exit(1);
}
console.log('ครบทุกไฟล์');
