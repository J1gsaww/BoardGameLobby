/* to-webp.mjs — แปลงภาพ PNG ในโฟลเดอร์ assets เป็น WebP แล้วย่อให้พอดีกับที่ใช้จริง
   ─────────────────────────────────────────────────────────────
   ใช้ครั้งเดียวตอนได้ภาพใหม่มา ไม่ต้องรันทุกครั้ง

     npm install sharp --no-save     ครั้งเดียวพอ
     node to-webp.mjs --dry          ดูก่อนว่าจะเกิดอะไรขึ้น ยังไม่แตะไฟล์
     node to-webp.mjs                แปลงจริง

   ทำไมถึงคุ้ม: ภาพวาดที่มีไล่เฉดทุกพิกเซลเป็นสิ่งที่ PNG บีบอัดไม่ได้เลย
   มันเก็บแทบทุกพิกเซลตรง ๆ ส่วน WebP ออกแบบมาสำหรับภาพแบบนี้โดยเฉพาะ
   วัดจากไฟล์จริงในโปรเจกต์นี้แล้วลดได้ราว 84% โดยตาแยกไม่ออก

   ย่อขนาดด้วย เพราะไฟล์ที่เจนมา 1024px แต่แสดงจริงบนกระดานแค่ 158px
   เผื่อไว้เท่าตัวก็พอสำหรับจอความละเอียดสูง ที่เหลือคือน้ำหนักที่เสียเปล่า

   ของเดิมไม่ถูกลบ — ย้ายไปไว้ใน _png-backup/ เผื่ออยากได้คืน */

import { readdirSync, statSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const DRY = process.argv.includes('--dry');

/* ความกว้างสูงสุดของแต่ละกลุ่ม เลือกจากขนาดที่แสดงจริงคูณราวสามเท่า */
const RULES = [
  { match: /cards[\\/]events[\\/]/, width: 600, why: 'การ์ดเหตุการณ์ แสดงจริง ~158px' },
  { match: /cards[\\/]vote[\\/]/,   width: 320, why: 'ไพ่โหวตกับไอคอน แสดงจริง ~30–60px' },
  { match: /board[\\/]/,            width: 1400, why: 'ชิ้นส่วนกระดาน แสดงใหญ่สุดในเกม' },
  { match: /./,                     width: 1200, why: 'อื่น ๆ' }
];

let sharp;
try { sharp = (await import('sharp')).default; }
catch {
  console.log('ยังไม่มี sharp — ลงก่อนด้วย:  npm install sharp --no-save');
  process.exit(1);
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    if (f === '_png-backup') return [];
    return statSync(p).isDirectory() ? walk(p) : (/\.png$/i.test(f) ? [p] : []);
  });
}

const files = walk('assets');
if (!files.length) { console.log('ไม่พบไฟล์ PNG ในโฟลเดอร์ assets'); process.exit(0); }

let before = 0, after = 0, done = 0;
console.log(`${DRY ? 'ลองดูเฉย ๆ' : 'กำลังแปลง'} ${files.length} ไฟล์\n`);

for (const src of files) {
  const rule = RULES.find(r => r.match.test(src));
  const img = sharp(src);
  const meta = await img.metadata();
  const w = Math.min(meta.width || rule.width, rule.width);
  const out = src.replace(/\.png$/i, '.webp');
  const sizeBefore = statSync(src).size;
  before += sizeBefore;

  const buf = await sharp(src)
    .resize({ width: w, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toBuffer();
  after += buf.length;
  done++;

  const cut = 100 - Math.round(buf.length * 100 / sizeBefore);
  console.log(`  ${basename(src).padEnd(20)} ${String(meta.width).padStart(5)}px →${String(w).padStart(5)}px` +
              `  ${String(Math.round(sizeBefore / 1024)).padStart(5)} KB →${String(Math.round(buf.length / 1024)).padStart(5)} KB  ลด ${cut}%`);

  if (DRY) continue;

  const { writeFileSync } = await import('node:fs');
  writeFileSync(out, buf);

  /* เก็บของเดิมไว้ ไม่ลบทิ้ง — เผื่ออยากได้ต้นฉบับคืนหรือแปลงใหม่ด้วยค่าอื่น */
  const keep = join('_png-backup', dirname(src));
  mkdirSync(keep, { recursive: true });
  renameSync(src, join(keep, basename(src)));
}

const cut = before ? 100 - Math.round(after * 100 / before) : 0;
console.log(`\n${done} ไฟล์ · ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB  ลดรวม ${cut}%`);
if (DRY) console.log('(ยังไม่ได้แตะไฟล์จริง เอา --dry ออกเมื่อพร้อม)');
else console.log('ต้นฉบับ PNG ย้ายไปไว้ที่ _png-backup/ แล้ว');
