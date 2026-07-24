/* sfx.js — เสียงประกอบสั้น ๆ
   ─────────────────────────────────────────────────────────────
   ต่างจากเพลงพื้นหลังตรงที่ต้องเล่นซ้อนกันได้ ลงไพ่รัว ๆ ก็ต้องได้ยินครบ
   จึงเก็บต้นฉบับไว้หนึ่งชุดแล้วโคลนออกมาเล่นทีละครั้ง

   ระดับเสียงมีหลอดของตัวเองใน mixer.js แยกจากเพลง
   แต่ยังโดนหลอดรวมคูณทับ กดปิดเสียงรวมแล้วเงียบหมดทั้งคู่
   ───────────────────────────────────────────────────────────── */

import { sfxLevel } from './mixer.js';
const cache = new Map();

function source(src) {
  let a = cache.get(src);
  if (!a) {
    a = new Audio(src);
    a.preload = 'auto';
    a.addEventListener('error', () => console.warn('[sfx] เปิดไฟล์ไม่ได้:', src), { once: true });
    cache.set(src, a);
  }
  return a;
}

/* โหลดไว้ล่วงหน้า เสียงจะได้มาทันจังหวะ ไม่ดีเลย์ตอนเล่นครั้งแรก */
export const preload = (list) => (list || []).forEach(source);

export function play(src, gain = 1, delay = 0) {
  const level = sfxLevel();
  if (!src || level <= 0) return;
  const fire = () => {
    try {
      const a = source(src).cloneNode();
      a.volume = Math.min(1, level * gain);
      a.play().catch(() => {});
    } catch (e) { console.warn('[sfx] เล่นไม่สำเร็จ', src, e); }
  };
  delay ? setTimeout(fire, delay) : fire();
}
