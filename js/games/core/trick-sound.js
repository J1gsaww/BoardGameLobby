/* trick-sound.js — เสียงประกอบของเกมไพ่ตระกูลสลาฟ
   ─────────────────────────────────────────────────────────────
   เสียงต้องดังที่เครื่องทุกคน ไม่ใช่เฉพาะคนที่กด จึงไม่ผูกกับปุ่ม
   แต่ดูจาก "สถานะเปลี่ยนไปยังไง" แทน — วิธีนี้คนที่รีเฟรชกลับเข้ามา
   ก็ได้ยินเสียงตรงกับคนอื่นโดยไม่ต้องส่งสัญญาณอะไรเพิ่ม
   ───────────────────────────────────────────────────────────── */

import * as sfx from '../../sfx.js';

export const DEFAULT_EFFECT = {
  card:  'assets/effect/Card.mp3',
  magic: 'assets/effect/Magic.mp3',
  fairy: 'assets/effect/Fairy.mp3'
};

export function makeSound(effects = DEFAULT_EFFECT) {
const EFFECT = { ...DEFAULT_EFFECT, ...effects };
let seen = null;

/* ล้างความจำเมื่อออกจากเกม ไม่งั้นเข้าเกมรอบหน้าจะเล่นเสียงย้อนหลัง */
const reset = () => { seen = null; };

function react(st) {
  if (!st || !st.phase) return;

  const now = {
    pile: st.pile ? st.pile.cards.join(',') + '|' + st.pile.by : '',
    size: st.pile ? st.pile.cards.length : 0,
    dir: st.dir,
    rev: !!st.revolution,
    round: st.roundNo
  };

  // ครั้งแรกที่เห็นสถานะ แค่จำไว้เฉย ๆ ไม่งั้นคนที่เพิ่งเปิดจอจะโดนเสียงรัวใส่
  if (!seen) { seen = now; sfx.preload(Object.values(EFFECT)); return; }

  if (now.pile && now.pile !== seen.pile) {
    sfx.play(EFFECT.card);
    // ตองกับโฟร์ได้เสียงเวทมนตร์ซ้อนขึ้นมา หน่วงนิดหน่อยให้เป็นสองจังหวะ
    if (now.size >= 3) sfx.play(EFFECT.magic, 0.9, 110);
  }

  // ทิศเปลี่ยนกลางรอบ = เข้าเงื่อนไขข้อ 7 · ข้ามตอนขึ้นรอบใหม่ที่ทิศถูกตั้งใหม่อยู่แล้ว
  if (now.round === seen.round && now.dir !== seen.dir) sfx.play(EFFECT.fairy);

  // ปฏิวัติก็ใช้เสียงเดียวกับการเปลี่ยนทิศ เพราะเป็นการพลิกทิศทางเหมือนกัน
  if (now.round === seen.round && now.rev !== seen.rev) sfx.play(EFFECT.fairy, 1, 60);

  seen = now;
}

  return { react, reset };
}
