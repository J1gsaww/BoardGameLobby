/* check-i18n.mjs — จับคีย์ภาษาที่ตั้งชื่อซ้ำกันในวัตถุเดียวกัน
   รันด้วย  node check-i18n.mjs

   JavaScript ไม่บ่นเวลาเจอคีย์ซ้ำ มันเงียบ ๆ เอาตัวล่างทับตัวบน
   ผลคือแก้ข้อความแล้วหน้าจอไม่เปลี่ยน เพราะของเก่าอยู่ล่างกว่าและชนะ */
import { readFileSync, globSync } from 'node:fs';

let bad = 0;
for (const f of [...globSync('js/**/*.js'), 'js/i18n.js']) {
  const src = readFileSync(f, 'utf8');
  // แยกเป็นก้อนภาษา th: { ... } และ en: { ... }
  for (const block of src.matchAll(/\b(th|en)\s*:\s*\{([\s\S]*?)\n\s*\}/g)) {
    const seen = new Map();
    for (const m of block[2].matchAll(/^\s*'([\w.]+)'\s*:/gm))
      seen.set(m[1], (seen.get(m[1]) || 0) + 1);
    for (const [key, n] of seen)
      if (n > 1) { console.log(`  ${f} → ก้อน ${block[1]} มีคีย์ '${key}' ซ้ำ ${n} ครั้ง`); bad++; }
  }
}
console.log(bad ? `\nพบคีย์ซ้ำ ${bad} จุด — ตัวล่างจะทับตัวบนโดยไม่มีคำเตือน` : 'ไม่มีคีย์ภาษาซ้ำกัน');
process.exit(bad ? 1 : 0);
