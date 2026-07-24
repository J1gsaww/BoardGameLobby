/* ambience.js — เสียงบรรยากาศแบบวนต่อเนื่อง
   ─────────────────────────────────────────────────────────────
   ต่างจาก sfx.js ตรงที่อันนั้นเป็นเสียงสั้นยิงทีละครั้ง
   อันนี้เป็นเสียงพื้นหลังที่วนไปเรื่อย ๆ เหมือนเพลง แต่แยกหลอดกัน
   จะได้หรี่คลื่นทะเลลงโดยไม่ต้องหรี่เพลงตาม

   แต่ละแทร็กมีตัวคูณของตัวเอง เสียงนกกับเสียงคลื่นจึงตั้งให้ดังไม่เท่ากันได้
   ───────────────────────────────────────────────────────────── */

import { ambienceLevel, onChange as onMix } from './mixer.js';

let tracks = [];      // { el, gain }
let hooked = false;

const apply = () => {
  const level = ambienceLevel();
  tracks.forEach(t => {
    t.el.volume = Math.min(1, level * t.gain);
    if (level <= 0) t.el.pause();
    else if (t.el.paused) t.el.play().catch(() => {});
  });
};

/* list = [{ src, gain }] · เรียกซ้ำด้วยชุดเดิมจะไม่เริ่มเล่นใหม่ */
export function startAmbience(list) {
  const want = (list || []).map(t => t.src).join('|');
  const have = tracks.map(t => t.el.dataset.src).join('|');
  if (want && want === have) { apply(); return; }

  stopAmbience();
  if (!want) return;

  tracks = list.map(({ src, gain = 1 }) => {
    const el = new Audio(src);
    el.loop = true;
    el.preload = 'auto';
    el.dataset.src = src;
    el.volume = 0;
    el.addEventListener('error', () => console.warn('[ambience] เปิดไฟล์ไม่ได้:', src), { once: true });
    return { el, gain };
  });

  if (!hooked) { onMix(apply); hooked = true; }
  apply();
}

export function stopAmbience() {
  tracks.forEach(t => { t.el.pause(); t.el.src = ''; });
  tracks = [];
}
