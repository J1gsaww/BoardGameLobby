/* check-art.mjs — เช็กว่าไฟล์ภาพการ์ดมีครบไหม
   โค้ดชี้ไปหาไฟล์ไหนบ้าง เทียบกับไฟล์ที่มีอยู่จริงในโฟลเดอร์
   มีไว้เพื่อไม่ให้เกิดเรื่องเดิมอีก — โค้ดชี้ไปหาไฟล์ที่ไม่มี แล้วรู้ตัวตอนเปิดหน้าเว็บ */
import { existsSync, readdirSync } from 'node:fs';
import { BASE_CARDS, cardArt, CARD_BACK } from './js/games/wreckers/events.js';
import { EXTRA_CARDS } from './js/games/wreckers/cards.js';
import { iconSrc } from './js/games/wreckers/vote.js';

const all = [...BASE_CARDS, ...EXTRA_CARDS];
const missing = [];
const found = [];

for (const c of all) {
  const p = cardArt(c.id);
  (existsSync(p) ? found : missing).push(c.id);
}

const backOk = existsSync(CARD_BACK);
console.log(`หลังการ์ด ${backOk ? 'มีแล้ว' : 'ยังไม่มี — ไพ่คว่ำจะขึ้นเป็นพื้นหลัง CSS แทน'}`);

const icons = ['C', 'F', 'W', 'B', 'R', 'A', 'D'];
const iconMissing = icons.filter(ch => !existsSync(iconSrc(ch)));

console.log(`ภาพการ์ด  มีแล้ว ${found.length} / ${all.length} ชนิด`);
if (missing.length) console.log('  ยังไม่มี:', missing.join(' · '));
console.log(`ไอคอนโหวต มีแล้ว ${icons.length - iconMissing.length} / ${icons.length}`);
if (iconMissing.length) console.log('  ยังไม่มี:', iconMissing.join(' · '));

/* ไฟล์ที่วางไว้แต่ไม่มีการ์ดชนิดนั้น = ตั้งชื่อผิด จับให้ด้วย */
for (const dir of ['standard', 'special']) {
  const at = `assets/game/wreckers/cards/events/${dir}`;
  if (!existsSync(at)) continue;
  const stray = readdirSync(at)
    .filter(f => f.endsWith('.png'))
    .map(f => f.replace('.png', ''))
    .filter(id => !all.some(c => c.id === id));
  if (stray.length) console.log(`ไฟล์ที่ไม่ตรงกับ id ใน ${dir}/:`, stray.join(' · '));
}
console.log(missing.length || iconMissing.length ? '\nใบที่ยังไม่มีภาพจะขึ้นเป็นไพ่คว่ำพร้อมชื่อ ไม่พัง' : '\nครบทุกไฟล์');
