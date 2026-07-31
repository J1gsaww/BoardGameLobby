/* rules.test.mjs — เทสกติกาบริสุทธิ์ของ Who the fuq are you */
import assert from 'node:assert/strict';
import {
  PHASE, buildDeck, dealLlamas, createGame,
  eventFlippers, firstChallenger, nextChallenger,
  resolveChallenge, winner, activeSeats
} from './rules.js';
import { DECK_SIZE, LLAMAS, TRAIT_IDS, LLAMA_IDS } from './data.js';

let n = 0; const ok = (name, fn) => { fn(); n++; };

/* สำรับต้องมี 40 ใบพอดี */
ok('deck is 40', () => {
  assert.equal(DECK_SIZE, 40);
  assert.equal(buildDeck(() => 0.5).length, 40);
});

/* จำนวนจุดเด่นของลามะ: 7,7,6,6,6,6,6,6,6,6 และ pool มี 9 */
ok('trait counts', () => {
  assert.equal(TRAIT_IDS.length, 9);
  const counts = LLAMAS.map(l => [...l.vec].filter(b => b === '1').length);
  assert.deepEqual(counts, [7, 7, 6, 6, 6, 6, 6, 6, 6, 6]);
  assert.equal(LLAMAS.length, 10);
  /* ทุกเวกเตอร์ยาว 9 และมีแต่ 0/1 */
  LLAMAS.forEach(l => assert.match(l.vec, /^[01]{9}$/));
});

/* ไม่มีจุดเด่นไหนที่ลามะตัวเดียวถือ (ดีไซน์: เดาปุ๊บออกไม่ได้) */
ok('no trait held by a single llama', () => {
  for (let i = 0; i < 9; i++) {
    const owners = LLAMAS.filter(l => l.vec[i] === '1').length;
    assert.ok(owners >= 2, `trait ${i} held by only ${owners}`);
  }
});

/* แจกลามะ: n คน = n ตัว · ถอด 10−n ตัว · ไม่ซ้ำ */
ok('deal + remove', () => {
  const seats = ['a', 'b', 'c', 'd', 'e', 'f'];
  const { assign, removed } = dealLlamas(seats, mulberry(1));
  assert.equal(Object.keys(assign).length, 6);
  assert.equal(removed.length, 4);
  const all = [...Object.values(assign), ...removed];
  assert.equal(new Set(all).size, 10);
  all.forEach(id => assert.ok(LLAMA_IDS.includes(id)));
});

ok('10 players removes none', () => {
  const seats = Array.from({ length: 10 }, (_, i) => 'p' + i);
  const { removed } = dealLlamas(seats, mulberry(2));
  assert.equal(removed.length, 0);
});

/* createGame เริ่มที่เฟสประกาศตัว */
ok('createGame starts at announce', () => {
  const s = createGame({ seats: ['a', 'b', 'c', 'd'] });
  assert.equal(s.phase, PHASE.ANNOUNCE);
  assert.equal(s.round, 1);
  assert.equal(activeSeats(s).length, 4);
});

/* คนเปิดการ์ด = 2 คนถัดไปจาก cursor */
ok('event flippers', () => {
  const s = createGame({ seats: ['a', 'b', 'c', 'd'] });
  s.flipCursor = 0;
  assert.deepEqual(eventFlippers(s), ['a', 'b']);
  s.flipCursor = 2;
  assert.deepEqual(eventFlippers(s), ['c', 'd']);
});

/* เฉลย challenge ถูก/ผิด */
ok('resolveChallenge', () => {
  const assign = { a: 'inventor', b: 'detective' };
  assert.equal(resolveChallenge(assign, 'b', 'detective').correct, true);
  assert.equal(resolveChallenge(assign, 'b', 'singer').correct, false);
  assert.equal(resolveChallenge(assign, 'b', 'nope').ok, false);
});

/* เหลือคนเดียว = ชนะ */
ok('winner when one left', () => {
  const s = createGame({ seats: ['a', 'b', 'c'] });
  s.out = ['b', 'c'];
  assert.equal(winner(s), 'a');
  s.out = ['c'];
  assert.equal(winner(s), null);
});

/* ลำดับ challenge: เริ่มที่คนเปิดคนแรกถ้าไม่มี chStart */
ok('challenge order', () => {
  const s = createGame({ seats: ['a', 'b', 'c', 'd'] });
  s.flippers = ['a', 'b'];
  s.chTurn = firstChallenger(s);
  assert.equal(s.chTurn, 'a');
  s.chDone = ['a'];
  assert.equal(nextChallenger(s), 'b');
  s.chDone = ['a', 'b', 'c', 'd'];
  assert.equal(nextChallenger(s), null);
});

/* rng แบบส่งเมล็ดได้ ให้เทสซ้ำได้ */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

console.log(`whothefuq rules: ${n} เคสผ่าน`);
