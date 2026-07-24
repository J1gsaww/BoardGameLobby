/* check-exports.mjs — ตรวจว่าทุกชื่อที่ import มีอยู่จริงในไฟล์ต้นทาง
   รันก่อน push ทุกครั้ง  →  node check-exports.mjs

   จับบั๊กที่เจ็บที่สุดแบบหนึ่ง: import ชื่อที่ไม่มีอยู่จริง
   เบราว์เซอร์จะล้มทั้งโมดูลกราฟ จอว่างเปล่าทันที และ node --check ก็จับไม่ได้
   เพราะไวยากรณ์ถูกต้องทุกบรรทัด */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { globSync } from 'node:fs';

const files = globSync('js/**/*.js');
let bad = 0;

const exportsOf = (src) => {
  const out = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g))
    m[1].split(',').forEach(part => {
      const name = part.split(/\s+as\s+/).pop().trim();
      if (name) out.add(name);
    });
  return out;
};

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
    const target = normalize(join(dirname(f), m[2]));
    if (!existsSync(target)) { console.log(`  ${f} → ไม่พบไฟล์ ${m[2]}`); bad++; continue; }
    const have = exportsOf(readFileSync(target, 'utf8'));
    for (const raw of m[1].split(',')) {
      const name = raw.split(/\s+as\s+/)[0].trim();
      if (name && !have.has(name)) { console.log(`  ${f} → ${m[2]} ไม่มี export ชื่อ '${name}'`); bad++; }
    }
  }
}
console.log(bad ? `\nพบปัญหา ${bad} จุด — push ขึ้นไปแล้วจอจะว่างเปล่า` : `ตรวจ ${files.length} ไฟล์ ทุก import มีปลายทางครบ`);
process.exit(bad ? 1 : 0);
