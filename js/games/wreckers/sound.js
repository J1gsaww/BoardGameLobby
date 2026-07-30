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
  powder: 'cannon',
  kick: 'maroonbycaptain'
};

/* เสียงตอนเปิดวงโหวต — คีย์คือชนิดของโหวต */
const ON_VOTE = {
  attack: 'shipbell',
  mutiny: 'mutiny',
  islandVote: 'letsmove'
};

/* เสียงตอนรู้ผลโหวต — **รอให้ฉากเล่าจบก่อนค่อยดัง**
   ถ้าดังทันทีที่สถานะเปลี่ยน เสียงจะทับตอนที่ฉากยังนับไพ่อยู่
   ซึ่งเป็นช่วงที่คนดูกำลังลุ้น เสียงเฉลยก่อนจะทำลายจังหวะทั้งหมด */
const ON_RESULT = {
  attack: { yes: 'letfire', no: 'stillsit' },
  mutiny: { yes: 'mecaptain', no: 'stillcaptain' }
};

/* กรองซ้ำก่อน — แผนที่ห้าใบชี้ไฟล์เดียวกัน ถ้าไม่กรองจะโหลดไฟล์เดิมห้ารอบ */
export const FILES = [...new Set([
  ...Object.values(ON_REVEAL),
  ...Object.values(ON_SHOUT),
  ...Object.values(ON_VOTE),
  ...Object.values(ON_RESULT).flatMap(o => Object.values(o)),
  'cannon',                      /* กัปตันเลือกที่วางกล่องหลังยิงติด */
  'force'                        /* สั่งบังคับให้คนอื่นเปิดการ์ด */
])].map(at);

export const preload = () => Sfx.preload(FILES);

/* จำเลขลำดับที่เล่นไปแล้ว กันเล่นซ้ำตอนหน้าจอวาดใหม่ */
let lastCard = 0;
let lastShout = 0;
let lastVote = 0;
let lastResult = 0;
let lastAim = 0;

/* เสียงที่รอฉากเล่าจบก่อนถึงจะดัง — เก็บไว้ก่อน แล้วปล่อยตอนฉากปิด */
let waiting = null;

export function reset() {
  lastCard = 0; lastShout = 0; lastVote = 0; lastResult = 0; lastAim = 0;
  lastForce = 0;
  waiting = null;
}

/* เสียงของ Action ที่ไม่ใช่การ์ดและไม่ใช่โหวต */
let lastForce = 0;

export function actionSounds(st) {
  if (!st) return;
  /* เริ่มบังคับให้คนอื่นเปิดการ์ด — ดังตอนสั่ง ไม่ใช่ตอนเขาเปิด */
  const p = st.pending;
  if (p && p.card === 'force' && p.at !== lastForce) {
    lastForce = p.at;
    Sfx.play(at('force'));
  }
}

/* ฉากเพิ่งเล่าจบ — ถึงคิวเสียงที่รออยู่
   หน้าจอเป็นคนเรียกตัวนี้ตอนฉากปิด ไม่ใช่ตั้งเวลาเดาเอง
   เพราะฉากแต่ละแบบยาวไม่เท่ากันและยืดได้ตามจำนวนคน */
export function sceneClosed() {
  if (!waiting) return;
  const name = waiting;
  waiting = null;
  Sfx.play(at(name));
}

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

  /* เปิดวงโหวต — ดังทันที เพราะเป็นการเรียกให้ทุกคนมาส่งไพ่ */
  const v = st.vote;
  if (v && v.at !== lastVote) {
    lastVote = v.at;
    const name = ON_VOTE[v.kind];
    if (name) Sfx.play(at(name));
  }

  /* รู้ผลโหวตแล้ว — เก็บเสียงไว้ก่อน รอฉากเล่าจบค่อยปล่อย */
  const r = st.lastVote;
  if (r && r.at !== lastResult) {
    lastResult = r.at;
    const pair = ON_RESULT[r.kind];
    if (pair) waiting = r.won ? pair.yes : pair.no;
  }

  /* กัปตันกำลังเลือกว่าจะเก็บกล่องไว้ตรงไหน = ยิงติดแล้ว */
  const aim = st.aim;
  if (aim && aim.at !== lastAim) {
    lastAim = aim.at;
    Sfx.play(at('cannon'));
  }
}
