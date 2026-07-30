/* sound.js — เสียงประกอบของ Yahhh
   ─────────────────────────────────────────────────────────────
   **ผูกกับสถานะ ไม่ใช่การกดปุ่ม** ทั้งสองคนจึงได้ยินพร้อมกัน
   ถ้าผูกกับการกด จะได้ยินแค่คนที่กดคนเดียว ส่วนอีกฝ่ายเห็นไพ่เปลี่ยนแบบเงียบ ๆ

   กันดังซ้ำด้วยตัวนับของเหตุการณ์นั้น เพราะหน้าจอวาดใหม่หลายรอบต่อหนึ่งเหตุการณ์ */

import * as Sfx from '../../sfx.js';

const DIR = 'assets/effect/';
const CARD = DIR + 'Card.mp3';      /* สุ่มไพ่ใหม่ */
const MAGIC = DIR + 'Magic.mp3';    /* ลงคะแนนในช่อง */

export const FILES = [CARD, MAGIC];
export const preload = () => Sfx.preload(FILES);

let lastHand = '';      /* มือล่าสุดที่เห็น — เปลี่ยนเมื่อมีการสุ่มใหม่ */
let lastLeft = -1;      /* รอบที่เหลือ — ลดลงคือสุ่มจริง ไม่ใช่ขึ้นตาใหม่ */
let lastScore = 0;      /* ลำดับของการลงคะแนนครั้งล่าสุด */

export function reset() { lastHand = ''; lastLeft = -1; lastScore = 0; }

export function play(st) {
  if (!st || !st.phase) return;

  /* ลงคะแนน — เช็กก่อนเรื่องมือ เพราะการลงคะแนนแจกมือใหม่ไปด้วย
     ถ้าเช็กทีหลังจะดังสองเสียงซ้อนกันทุกครั้งที่ลงช่อง */
  const at = st.last?.at || 0;
  if (at && at !== lastScore) {
    lastScore = at;
    lastHand = st.hand.join(',');
    lastLeft = st.left;
    Sfx.play(MAGIC);
    return;
  }

  /* สุ่มไพ่ใหม่ — ดูจากจำนวนรอบที่ลดลง ไม่ใช่แค่มือเปลี่ยน
     เพราะมือเปลี่ยนตอนขึ้นตาใหม่ด้วย ซึ่งไม่ใช่การสุ่ม */
  const hand = st.hand.join(',');
  const fell = lastLeft >= 0 && st.left < lastLeft;
  if (fell && hand !== lastHand) Sfx.play(CARD);

  lastHand = hand;
  lastLeft = st.left;
}
