/* sound.js — เสียงประกอบของการ์ด
   ─────────────────────────────────────────────────────────────
   **ทุกคนในเกมต้องได้ยิน ไม่ใช่แค่คนที่กด**

   จึงผูกเสียงไว้กับ **สถานะ** ไม่ใช่กับการกดปุ่ม
   ทุกเครื่องเห็นสถานะเดียวกัน เสียงจึงดังพร้อมกันเองโดยไม่ต้องส่งอะไรเพิ่ม
   ถ้าผูกกับการกด จะได้ยินแค่คนกดคนเดียว

   กันเสียงซ้ำด้วยเลขลำดับของเหตุการณ์ — สถานะเดียวกันถูกวาดหลายรอบได้
   แต่เลขลำดับไม่ซ้ำ จึงเล่นครั้งเดียวต่อเหตุการณ์จริง ๆ

   เสียงลงหลอด Effects ตามที่ตกลงไว้ (sfx.js ใช้หลอดนั้นอยู่แล้ว) */

import * as Sfx from '../../sfx.js';
import { MAP_CARDS } from './effects.js';

const DIR = 'assets/effect/pirate/';
const at = (name) => DIR + name + '.mp3';

/* เสียงตอนเปิดการ์ด — คีย์คือ id ของการ์ด ค่าคือชื่อไฟล์
   ชื่อไฟล์ตรงกับ id หมด ยกเว้น **crowsnest ใช้ไฟล์ crownest**
   ซึ่งเป็นชื่อที่อัปโหลดไว้จริงแล้ว อย่าไป "แก้ให้ถูก" เพราะเสียงจะเงียบไปเฉย ๆ */
const ON_REVEAL = {
  pistol: 'reload',
  blackspot: 'blackspot',
  albatross: 'albatross',
  marque: 'marque',
  armada: 'armada',
  facade: 'facade',
  eightbell: 'eightbell',
  crowsnest: 'crownest',
  blackpowder: 'blackpowder',
  piratecode: 'piratecode',
  scurvy: 'scurvy',
  cabinfever: 'cabinfever',
  stormyseas: 'stormyseas',

  /* แผนที่ทุกใบใช้เสียงเดียวกัน — อ่านรายชื่อจากตัวกติกา ไม่ได้พิมพ์ซ้ำที่นี่
     ใบแผนที่ใหม่ในอนาคตจะได้เสียงนี้เองโดยไม่ต้องมาเติม */
  ...Object.fromEntries(MAP_CARDS.map(id => [id, 'map']))
};

/* เสียงตอนผลของการ์ดเกิดขึ้นจริง — คีย์คือชนิดของประกาศ */
const ON_SHOUT = {
  shot: 'pistol',
  birds: 'albatross_strike',
  powder: 'cannon'
};

/* กรองซ้ำก่อน — แผนที่ห้าใบชี้ไฟล์เดียวกัน ถ้าไม่กรองจะโหลดไฟล์เดิมห้ารอบ */
export const FILES = [...new Set([
  ...Object.values(ON_REVEAL),
  ...Object.values(ON_SHOUT)
])].map(at);

export const preload = () => Sfx.preload(FILES);

/* จำเลขลำดับที่เล่นไปแล้ว กันเล่นซ้ำตอนหน้าจอวาดใหม่ */
let lastCard = 0;
let lastShout = 0;

export function reset() { lastCard = 0; lastShout = 0; }

export function cardSounds(st) {
  if (!st) return;

  const up = st.cardUp;
  if (up && up.at !== lastCard) {
    lastCard = up.at;
    const name = ON_REVEAL[up.id];
    if (name) Sfx.play(at(name));
  }

  const sh = st.shout;
  if (sh && sh.at !== lastShout) {
    lastShout = sh.at;
    const name = ON_SHOUT[sh.kind];
    if (name) Sfx.play(at(name));
  }
}
