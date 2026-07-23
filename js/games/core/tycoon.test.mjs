/* tycoon.test.mjs — ทดสอบเฉพาะห้าข้อที่ Tycoon ต่างจากสลาฟ
   รันด้วย  node js/games/core/tycoon.test.mjs */

import { beats, readCombo, makeDeck, forcedLead, sortHand, sortForHand, cardValue } from './cards.js';
import { createRound, apply, PHASE } from './engine.js';
import { makeGame } from './trick-game.js';
import { TYCOON as T } from '../tycoon/rules.js';
import { SLAVE as S } from '../slave/rules.js';

let pass = 0, fail = 0;
const ok = (label, got, want = true) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) pass++;
  else { fail++; console.log(`  ไม่ผ่าน: ${label}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`); }
};
const group = (n) => console.log('\n' + n);

/* ── สำรับ ──────────────────────────────────────── */
group('สำรับมีโจ๊กเกอร์');
ok('Tycoon มี 54 ใบ', makeDeck(T).length, 54);
ok('สลาฟยังมี 52 ใบเหมือนเดิม', makeDeck(S).length, 52);
ok('มีโจ๊กเกอร์สองใบ', makeDeck(T).filter(c => c[0] === 'X'), ['X1', 'X2']);
ok('4 คนได้ 14 14 13 13',
   (() => { const g = createRound({ seats: ['A','B','C','D'], rules: T });
            return Object.values(g.hands).map(h => h.length); })(), [14, 14, 13, 13]);

/* ── โจ๊กเกอร์เดี่ยว ────────────────────────────── */
group('โจ๊กเกอร์เดี่ยวกับโพดำ 3');
ok('โจ๊กเกอร์ชนะ 2 โพดำ', beats(['X1'], ['2S'], T));
ok('โจ๊กเกอร์ชนะไพ่ใหญ่ใบอื่น', beats(['X1'], ['AS'], T));
ok('โพดำ 3 ล้มโจ๊กเกอร์ได้', beats(['3S'], ['X1'], T));
ok('โพแดง 3 ล้มโจ๊กเกอร์ไม่ได้', beats(['3H'], ['X1'], T), false);
ok('2 โพดำ ล้มโจ๊กเกอร์ไม่ได้', beats(['2S'], ['X1'], T), false);
ok('ล้มโจ๊กเกอร์ด้วยโพดำ 3 แล้ว ใบอื่นทับต่อได้ตามปกติ', beats(['4C'], ['3S'], T));
ok('สลาฟไม่มีโจ๊กเกอร์ ลงไม่ได้', beats(['X1'], null, S), false);

/* ── โจ๊กเกอร์เป็นไพ่แทน ────────────────────────── */
group('โจ๊กเกอร์เติมชุด');
ok('คู่ 4 เติมโจ๊กเกอร์กลายเป็นตอง', readCombo(['4C', '4D', 'X1'], T).size, 3);
ok('ตองที่มีโจ๊กเกอร์ยังเป็นแต้ม 4', readCombo(['4C', '4D', 'X1'], T).rank, readCombo(['4C','4D','4H'], T).rank);
ok('ตองสี่ที่มีโจ๊กเกอร์ ชนะตองสามจริง',
   beats(['4C', '4D', 'X1'], ['3C', '3D', '3H'], T));
ok('เติมโจ๊กเกอร์เข้าตองกลายเป็นโฟร์', readCombo(['5C', '5D', '5H', 'X1'], T).size, 4);
ok('โจ๊กเกอร์เติมไพ่คนละแต้มไม่ได้', readCombo(['4C', '5D', 'X1'], T), null);
ok('โจ๊กเกอร์สองใบเดี่ยว ๆ นับเป็นคู่แต้มสูงสุด', readCombo(['X1', 'X2'], T).size, 2);

/* ── ลงเลข 8 จบกอง ──────────────────────────────── */
group('ลง 8 แล้วจบกอง');
{
  // ใช้รอบสองเพื่อเลี่ยงเงื่อนไขบังคับลงดอกจิก 3 ของกองแรก
  const seats = ['A', 'B', 'C', 'D'];
  const hands = { A: ['8C', '5D'], B: ['9C', 'KD'], C: ['TC', 'QD'], D: ['JC', 'AD'] };
  const prev = ['B', 'C', 'D', 'A'];              // A เป็นสลาฟ จึงเป็นคนเริ่ม
  const opts = { seats, hands, roundNo: 2, prevRanking: prev };

  const s0 = createRound({ ...opts, rules: T });
  ok('สลาฟของรอบก่อนเป็นคนเริ่ม', s0.turn, 'A');

  const s = apply(s0, { type: 'play', uid: 'A', cards: ['8C'] }, T);
  ok('ลง 8 แล้วกองถูกเคลียร์ทันที', s.state.pile, null);
  ok('คนลง 8 ได้เริ่มกองใหม่เอง', s.state.turn, 'A');
  ok('ล้างรายชื่อคนผ่าน', s.state.passed, []);

  const s2 = apply(createRound({ ...opts, rules: S }), { type: 'play', uid: 'A', cards: ['8C'] }, S);
  ok('สลาฟไม่มีกฎนี้ กองยังอยู่', s2.state.pile.cards, ['8C']);
  ok('สลาฟส่งตาให้คนถัดไปตามปกติ', s2.state.turn !== 'A');
}

/* ── ปฏิวัติ ────────────────────────────────────── */
group('ปฏิวัติ ลงโฟร์แล้วลำดับกลับหัว');
{
  const hands = {
    A: ['7C', '7D', '7H', '7S', '3C'],
    B: ['9C', 'KD'], C: ['TC', 'QD'], D: ['JC', 'AD']
  };
  let s = createRound({ seats: ['A','B','C','D'], hands, rules: T });
  ok('ยังไม่ปฏิวัติ', s.revolution, false);
  ok('ปกติ 4 ใหญ่กว่า 3', beats(['4C'], ['3S'], T, false));

  s = apply(s, { type: 'play', uid: 'A', cards: ['3C'] }, T).state;
  s = apply(s, { type: 'pass', uid: s.turn }, T).state;
  s = apply(s, { type: 'pass', uid: s.turn }, T).state;
  s = apply(s, { type: 'pass', uid: s.turn }, T).state;
  ok('A ชนะกองและได้เริ่มใหม่', s.turn, 'A');

  s = apply(s, { type: 'play', uid: 'A', cards: ['7C', '7D', '7H', '7S'] }, T).state;
  ok('ลงโฟร์แล้วปฏิวัติ', s.revolution, true);
  ok('ตอนปฏิวัติ 3 ใหญ่กว่า 4', beats(['3C'], ['4S'], T, true));
  ok('ตอนปฏิวัติ 4 ทับ 3 ไม่ได้', beats(['4S'], ['3C'], T, true), false);
  ok('ชุดใหญ่ยังชนะชุดเล็กเหมือนเดิม', beats(['9C','9D','9H'], ['2S'], T, true));
  ok('ปฏิวัติซ้อนกลับไปได้', !!apply(
       { ...s, pile: null, passed: [], turn: 'B', hands: { ...s.hands, B: ['9C','9D','9H','9S'] } },
       { type: 'play', uid: 'B', cards: ['9C','9D','9H','9S'] }, T).state.revolution, false);
}

/* ── ดอกต้องกลับตอนปฏิวัติด้วย ──────────────────── */
group('ปฏิวัติแล้วดอกกลับด้วย');
ok('ปกติ โพดำ 7 ชนะ โพแดง 7', beats(['7S'], ['7H'], T, false));
ok('ปฏิวัติแล้ว โพแดง 7 ชนะ โพดำ 7', beats(['7H'], ['7S'], T, true));
ok('ปฏิวัติแล้ว โพดำ 7 ทับ โพแดง 7 ไม่ได้', beats(['7S'], ['7H'], T, true), false);
ok('ปฏิวัติแล้ว ดอกจิกกลายเป็นดอกใหญ่สุด', beats(['7C'], ['7D'], T, true));
ok('ปฏิวัติแล้ว คู่ที่มีดอกจิกชนะคู่ที่มีโพดำ',
   beats(['7C', '7D'], ['7S', '7H'], T, true));
ok('ปฏิวัติแล้ว โจ๊กเกอร์ยังแข็งเหมือนเดิม ทับ 3 ดอกจิกที่ใหญ่สุดได้',
   beats(['X1'], ['3C'], T, true));
ok('ปฏิวัติแล้ว โพดำ 2 กลายเป็นตัวล้มโจ๊กเกอร์', beats(['2S'], ['X1'], T, true));
ok('ปฏิวัติแล้ว โพดำ 3 ล้มโจ๊กเกอร์ไม่ได้แล้ว', beats(['3S'], ['X1'], T, true), false);
ok('ปฏิวัติแล้ว 3 ดอกจิกที่ใหญ่สุดก็ล้มโจ๊กเกอร์ไม่ได้', beats(['3C'], ['X1'], T, true), false);
ok('ปฏิวัติแล้ว ใบธรรมดาล้มโจ๊กเกอร์ไม่ได้', beats(['4C'], ['X1'], T, true), false);
ok('ตัวล้มกับโจ๊กเกอร์ทับกันได้ทั้งสองทาง วนเป็นวงกลม',
   [beats(['2S'], ['X1'], T, true), beats(['X1'], ['2S'], T, true)], [true, true]);
ok('ปกติ โพดำ 2 ล้มโจ๊กเกอร์ไม่ได้', beats(['2S'], ['X1'], T, false), false);

/* ── เลข 8 จบกองทุกขนาดชุด ──────────────────────── */
group('เลข 8 จบกองไม่ว่าลงกี่ใบ');
{
  const seats = ['A', 'B', 'C', 'D'];
  const prev = ['B', 'C', 'D', 'A'];
  const cases = [
    ['เดี่ยว', ['8C']],
    ['คู่',    ['8C', '8D']],
    ['ตอง',   ['8C', '8D', '8H']],
    ['โฟร์',  ['8C', '8D', '8H', '8S']],
    ['ตองที่มีโจ๊กเกอร์', ['8C', '8D', 'X1']]
  ];
  for (const [label, cards] of cases) {
    const hands = { A: [...cards, '5D'], B: ['9C'], C: ['TC'], D: ['JC'] };
    const s = apply(createRound({ seats, hands, roundNo: 2, prevRanking: prev, rules: T }),
                    { type: 'play', uid: 'A', cards }, T);
    ok('ลง 8 แบบ' + label + ' จบกอง', s.state.pile, null);
    ok('ลง 8 แบบ' + label + ' ได้เริ่มกองใหม่เอง', s.state.turn, 'A');
  }
}

/* ── โจ๊กเกอร์อยู่ขวาสุดบนมือ ────────────────────── */
group('เรียงไพ่บนมือ โจ๊กเกอร์อยู่ขวาสุด');
{
  const hand = ['X1', '9C', '3D', 'X2', 'KS'];
  ok('ปกติ โจ๊กเกอร์ท้ายสุด', sortForHand(hand, false), ['3D', '9C', 'KS', 'X1', 'X2']);
  ok('ปฏิวัติแล้วก็ยังท้ายสุด', sortForHand(hand, true), ['KS', '9C', '3D', 'X1', 'X2']);
  ok('ต่างจากลำดับที่ใช้ตัดสิน ซึ่งโจ๊กเกอร์เด้งไปซ้ายตอนปฏิวัติ',
     sortHand(hand, true)[0].startsWith('X'));
}

/* ── จำนวนโจ๊กเกอร์ปรับได้ ──────────────────────── */
group('ตัวเลือกจำนวนโจ๊กเกอร์');
ok('ค่าตั้งต้น 2 ใบ เท่าเกมต้นฉบับ', T.jokers, 2);
ok('เลือก 3 ใบ ได้สำรับ 55', makeDeck(T.fromSettings({ jokers: 3 })).length, 55);
ok('เลือก 4 ใบ ได้สำรับ 56', makeDeck(T.fromSettings({ jokers: 4 })).length, 56);
ok('ไม่ตั้งค่าอะไรเลย ได้ 2 ใบ', makeDeck(T.fromSettings({})).length, 54);
ok('ใส่ค่าเกินขอบเขต ถูกบีบกลับเข้าช่วง',
   [T.fromSettings({ jokers: 9 }).jokers, T.fromSettings({ jokers: 0 }).jokers], [4, 2]);
ok('4 โจ๊กเกอร์ลงพร้อมกันเป็นโฟร์ได้',
   readCombo(['X1', 'X2', 'X3', 'X4'], T.fromSettings({ jokers: 4 })).size, 4);

/* ── บังคับลงตอนหมดเวลา ตอนปฏิวัติ ──────────────── */
group('บังคับลงเมื่อหมดเวลา');
ok('ปกติหยิบแต้มน้อยสุด', forcedLead(['9C', '3D', '3H', 'KS'], T, false), ['3D', '3H']);
ok('ตอนปฏิวัติหยิบแต้มมากสุดแทน', forcedLead(['9C', '3D', '3H', 'KS'], T, true), ['KS']);

/* ── จำนวนคน ────────────────────────────────────── */
group('จำนวนผู้เล่น');
ok('Tycoon เล่นได้ 4 คนเป๊ะ', [T.minPlayers, T.maxPlayers], [4, 4]);
ok('สลาฟยังเล่นได้ 4 ถึง 10', [S.minPlayers, S.maxPlayers], [4, 10]);

/* ── เล่นจนจบรอบด้วยกติกา Tycoon ────────────────── */
group('เล่นจนจบรอบไม่ตัน');
{
  let seed = 7;
  const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let s = createRound({ seats: ['P0','P1','P2','P3'], rng, rules: T });
  let guard = 0, revs = 0, wasRev = false;
  while (s.phase === PHASE.PLAY && guard++ < 5000) {
    const uid = s.turn, hand = s.hands[uid];
    let moved = false;
    for (const c of hand) {
      const r = apply(s, { type: 'play', uid, cards: [c] }, T);
      if (!r.error) { s = r.state; moved = true; break; }
    }
    if (!moved) {
      const r = apply(s, { type: 'pass', uid }, T);
      if (r.error) throw new Error('ตัน: ' + r.error);
      s = r.state;
    }
    if (s.revolution !== wasRev) { revs++; wasRev = s.revolution; }
  }
  ok('เล่นจนจบได้ไม่ตัน', s.phase, PHASE.DONE);
  ok('ไม่วนไม่รู้จบ', guard < 5000);
  ok('ไพ่ทั้ง 54 ใบถูกใช้หมดหรืออยู่ในมือคนสุดท้าย',
     Object.values(s.hands).reduce((a, h) => a + h.length, 0) < 54);
}

console.log(`\n${'─'.repeat(46)}\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);
process.exit(fail ? 1 : 0);
