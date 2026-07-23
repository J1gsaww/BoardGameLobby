/* sfx.js — เสียงประกอบสั้น ๆ
   ─────────────────────────────────────────────────────────────
   ต่างจากเพลงพื้นหลังตรงที่ต้องเล่นซ้อนกันได้ ลงไพ่รัว ๆ ก็ต้องได้ยินครบ
   จึงเก็บต้นฉบับไว้หนึ่งชุดแล้วโคลนออกมาเล่นทีละครั้ง

   ระดับเสียงผูกกับแถบเดียวกับเพลง — กดปิดเสียงแล้วเงียบหมดทั้งเพลงและเอฟเฟกต์
   แต่ตั้งฐานให้ดังกว่าเพลงเล็กน้อย เพราะเสียงสั้น ๆ ต้องแทรกเพลงพื้นหลังขึ้นมาได้
   ───────────────────────────────────────────────────────────── */

import { music } from './music.js';

const SFX_GAIN = 1.5;
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
  if (!src || music.muted || music.volume <= 0) return;
  const fire = () => {
    try {
      const a = source(src).cloneNode();
      a.volume = Math.min(1, music.volume * SFX_GAIN * gain);
      a.play().catch(() => {});
    } catch (e) { console.warn('[sfx] เล่นไม่สำเร็จ', src, e); }
  };
  delay ? setTimeout(fire, delay) : fire();
}
