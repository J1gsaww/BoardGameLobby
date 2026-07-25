/* check-shell.mjs — ตรวจว่า element ที่โค้ดไปหาด้วย querySelector มีอยู่ในโครงจริง
   รันด้วย  node check-shell.mjs

   จับบั๊กที่เพิ่งเจอ: แทนที่ข้อความในโครงไม่ตรง กล่องเลยไม่ถูกสร้าง
   แต่โค้ดยังเรียกใช้อยู่ พอ querySelector คืน null แล้วไปตั้งค่าต่อ
   จะโยน TypeError ที่ล้มทั้งหน้า ทั้งที่ไวยากรณ์ถูกทุกบรรทัด */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

/* รวบคลาสที่ "ถูกสร้าง" จากทั้งโปรเจกต์ก่อน แล้วค่อยไล่ตรวจทีละไฟล์
   เพราะโมดูลหนึ่งสร้างโครงแล้วอีกโมดูลมาวาดข้างในเป็นเรื่องปกติ
   เช่น ui.js สร้าง .wr-scene แล้ว scene.js เป็นคนวาดข้างใน
   ถ้าตรวจแยกไฟล์จะฟ้องผิดทุกครั้งที่แยกโมดูล */
const files = globSync('js/**/*.js');
const built = new Set();
const add = (txt) => String(txt).split(/\s+/).forEach(c => c && built.add(c));

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/class="([^"$]*)"/g)) add(m[1]);
  for (const m of src.matchAll(/className\s*=\s*['"`]([^'"`$]*)/g)) add(m[1]);
  for (const m of src.matchAll(/classList\.(?:add|toggle)\(\s*['"`]([\w-]+)/g)) add(m[1]);
}
/* โครงหน้าเว็บก็นับด้วย บางกล่องเขียนไว้ใน HTML ตรง ๆ ไม่ได้สร้างจาก JS */
for (const m of readFileSync('index.html', 'utf8').matchAll(/class="([^"$]*)"/g)) add(m[1]);

let bad = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const looked = new Set();
  for (const m of src.matchAll(/querySelector(?:All)?\(\s*[`'"]\.([\w-]+)/g)) looked.add(m[1]);

  for (const cls of looked) {
    if (!built.has(cls)) {
      console.log(`  ${f} → มองหา .${cls} แต่ไม่มีที่ไหนสร้างไว้เลย`);
      bad++;
    }
  }
}
console.log(bad ? `\nพบ ${bad} จุดที่อาจคืน null` : 'ทุกตัวที่ค้นหามีอยู่ในโครงจริง');
process.exit(0);   // เตือนอย่างเดียว ไม่ล้มการ build เพราะบางไฟล์ค้นข้ามไฟล์กันได้
