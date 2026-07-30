/* rules.test.mjs — Yahhh
   ─────────────────────────────────────────────────────────────
   เกมนี้ตัดสินกันด้วยตัวเลขล้วน เทสจึงต้องคุมทุกช่องให้ตรงกับที่ตกลงไว้
   ถ้าช่องไหนคิดคะแนนเพี้ยน จะไม่มีใครสังเกตจนกว่าจะเล่นจบแล้วรู้สึกว่าแปลก */

import {
  fullDeck, ROWS, HAND, REROLLS, SUIT_ROW_MAX,
  scoreFor, isFull, isStraight, isYahhh, openHand, reroll,
  openRows, sheetTotal, sheetDone
} from './rules.js';
import { init, onAction, actionsFor } from './game.js';

let pass = 0, fail = 0;
function ok(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail++;
  console.log(`  ไม่ผ่าน: ${name}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`);
}
const group = (name) => console.log('\n' + name);

group('สำรับ');
ok('มี 30 ใบ', fullDeck().length, 30);
ok('ไม่มีใบซ้ำ', new Set(fullDeck()).size, 30);
ok('แต้มหนึ่งมีห้าใบ', fullDeck().filter(c => c[0] === '4').length, 5);
ok('ดอกหนึ่งมีหกใบ', fullDeck().filter(c => c[1] === 'X').length, 6);
ok('กระดานมี 13 ช่อง', ROWS.length, 13);
ok('ไม่มีช่องเหมือนกันทั้งห้าใบแล้ว', ROWS.includes('yahhh'), false);

group('ช่องบน — รวมแต้มของใบที่เป็นเลขนั้น');
ok('สาม 4 ได้ 12', scoreFor('r4', ['4C', '4D', '4H', '1S', '2X']), 12);
ok('ไม่มีเลขนั้นได้ศูนย์', scoreFor('r6', ['4C', '4D', '4H', '1S', '2X']), 0);
ok('A ห้าใบได้ 5', scoreFor('r1', ['1C', '1D', '1H', '1S', '1X']), 5);

group('ชุดแต้มเหมือนกัน');
ok('คู่ 6 ได้ 12', scoreFor('pair', ['6C', '6D', '3H', '2S', '1X']), 12);
ok('มีสองคู่ ช่องคู่เอาคู่ที่ใหญ่กว่า',
   scoreFor('pair', ['6C', '6D', '3H', '3S', '1X']), 12);
ok('สองคู่ได้ผลรวมของทั้งสองคู่',
   scoreFor('twoPair', ['6C', '6D', '3H', '3S', '1X']), 18);
ok('มีคู่เดียว ช่องสองคู่ได้ศูนย์',
   scoreFor('twoPair', ['6C', '6D', '3H', '2S', '1X']), 0);
ok('ตอง 5 ได้ 15', scoreFor('three', ['5C', '5D', '5H', '2S', '1X']), 15);
ok('โฟร์ 6 ได้ 24', scoreFor('four', ['6C', '6D', '6H', '6S', '1X']), 24);
ok('มีแค่ตอง ช่องโฟร์ได้ศูนย์',
   scoreFor('four', ['6C', '6D', '6H', '2S', '1X']), 0);

group('ดอกเหมือนกัน — นับได้ไม่เกินสี่ใบ');
ok('เพดานคือสี่ใบ', SUIT_ROW_MAX, 4);
ok('ดอกเดียวห้าใบ นับแค่สี่ใบที่แต้มสูงสุด',
   scoreFor('suit', ['6C', '5C', '4C', '3C', '2C']), 18);
ok('ดอกเดียวสามใบ นับครบทั้งสาม',
   scoreFor('suit', ['6C', '5C', '4C', '3H', '2S']), 15);
ok('เลือกดอกที่ให้แต้มมากที่สุด',
   scoreFor('suit', ['1C', '2C', '6H', '5H', '4S']), 11);

group('ช่องคะแนนตายตัว');
ok('ฟูลเฮาส์ได้ 25', scoreFor('full', ['5C', '5D', '5H', '2S', '2X']), 25);
ok('ตองเปล่าไม่ใช่ฟูลเฮาส์', isFull(['5C', '5D', '5H', '2S', '1X']), false);
ok('โฟร์ไม่ใช่ฟูลเฮาส์', isFull(['5C', '5D', '5H', '5S', '2X']), false);

ok('เรียง A ถึง 5 ได้ 35', scoreFor('straight', ['1C', '2D', '3H', '4S', '5X']), 35);
ok('เรียง 2 ถึง 6 ได้ 35', scoreFor('straight', ['2C', '3D', '4H', '5S', '6X']), 35);
ok('เรียงสี่ใบไม่นับ', isStraight(['1C', '2D', '3H', '4S', '6X']), false);
ok('มีใบซ้ำก็ไม่นับ', isStraight(['1C', '2D', '3H', '4S', '4X']), false);

/* ช่องนี้ถูกถอดออกแล้ว — ตัวช่วยยังอยู่เผื่ออยากเอากลับมา แต่ลงคะแนนไม่ได้ */
ok('ตัวช่วยยังบอกได้ว่าเหมือนกันห้าใบไหม', isYahhh(['4C', '4D', '4H', '4S', '4X']), true);
ok('แต่ลงช่องนี้ไม่ได้แล้ว', scoreFor('yahhh', ['4C', '4D', '4H', '4S', '4X']), 0);

group('การจั่วในหนึ่งตา');
{
  const roll = openHand();
  ok('จั่วห้าใบ', roll.hand.length, HAND);
  ok('สุ่มใหม่ได้อีกสี่รอบ', roll.left, REROLLS);
  ok('กองที่เหลือคือ 25 ใบ', roll.deck.length, 25);
  ok('ใบในมือไม่ซ้ำกัน', new Set(roll.hand).size, HAND);

  const keep = roll.hand.slice(0, 2);
  const next = reroll(roll, keep);
  ok('ใบที่ล็อกยังอยู่ครบ', keep.every(c => next.hand.includes(c)), true);
  ok('มือยังมีห้าใบ', next.hand.length, HAND);
  ok('รอบที่เหลือลดลงหนึ่ง', next.left, REROLLS - 1);
  ok('มือใหม่ไม่มีใบซ้ำ', new Set(next.hand).size, HAND);

  ok('ล็อกครบห้าใบแล้วไม่มีอะไรให้สุ่ม', reroll(roll, roll.hand), null);
  ok('ล็อกใบที่ไม่ได้ถือไม่ได้', reroll(roll, ['9X']), null);
  ok('หมดรอบแล้วสุ่มไม่ได้', reroll({ ...roll, left: 0 }, keep), null);
}

group('กระดานคะแนน');
{
  const empty = Object.fromEntries(ROWS.map(r => [r, null]));
  ok('เริ่มมาว่างทั้ง 13 ช่อง', openRows(empty).length, 13);
  ok('ยังไม่จบ', sheetDone(empty), false);

  const some = { ...empty, r1: 3, full: 25, straight: 0 };
  ok('รวมคะแนนเฉพาะช่องที่ลงแล้ว', sheetTotal(some), 28);
  ok('ช่องที่ลงศูนย์ถือว่าใช้ไปแล้ว', openRows(some).length, 10);

  const done = Object.fromEntries(ROWS.map(r => [r, 0]));
  ok('ลงครบแล้วถือว่าจบ', sheetDone(done), true);
}

group('สายพานของเกม');
{
  const members = [{ uid: 'a', role: 'player', left: false, name: 'A' },
                   { uid: 'b', role: 'player', left: false, name: 'B' }];
  const out = init({ members, settings: {} });
  const st = out.state;

  ok('เล่นสองคน', st.seats.length, 2);
  ok('เริ่มด้วยห้าใบ', st.hand.length, HAND);
  ok('กระดานของทั้งสองคนว่าง',
     st.seats.map(u => openRows(st.sheets[u]).length), [13, 13]);
  ok('คนที่ถึงตาลงคะแนนได้', actionsFor(st, st.turn).includes('score'), true);
  ok('อีกคนทำอะไรไม่ได้',
     actionsFor(st, st.seats.find(u => u !== st.turn)), []);

  /* ลงช่องเดิมซ้ำไม่ได้ */
  const ctx = { state: st, secrets: out.secrets };
  const one = await onAction(ctx, { uid: st.turn, type: 'score', payload: { row: 'r1' } });
  ok('ลงแล้วส่งตาให้อีกคน', one.state.turn !== st.turn, true);
  ok('ช่องที่ลงไปถูกบันทึก', one.state.sheets[st.turn].r1 != null, true);
  ok('มือใหม่ถูกแจกให้คนถัดไป', one.state.hand.length, HAND);
  ok('รอบสุ่มใหม่ถูกรีเซ็ต', one.state.left, REROLLS);

  const again = await onAction({ state: one.state, secrets: one.secrets },
                               { uid: one.state.turn, type: 'score', payload: { row: 'r1' } });
  ok('อีกคนลงช่องเดียวกันได้ เพราะเป็นกระดานของตัวเอง', !!again, true);

  ok('ลงช่องที่ไม่มีอยู่ไม่ได้',
     await onAction(ctx, { uid: st.turn, type: 'score', payload: { row: 'ไม่มีช่องนี้' } }), null);
  ok('คนที่ไม่ถึงตาลงไม่ได้',
     await onAction(ctx, { uid: st.seats.find(u => u !== st.turn),
                           type: 'score', payload: { row: 'r2' } }), null);
}

group('เล่นจนจบเกม');
{
  const members = [{ uid: 'a', role: 'player', left: false, name: 'A' },
                   { uid: 'b', role: 'player', left: false, name: 'B' }];
  let { state, secrets } = init({ members, settings: {} });
  let turns = 0;

  while (state.phase === 'play' && turns < 200) {
    const open = openRows(state.sheets[state.turn]);
    const row = open.reduce((x, y) => (scoreFor(y, state.hand) > scoreFor(x, state.hand) ? y : x));
    const r = await onAction({ state, secrets }, { uid: state.turn, type: 'score', payload: { row } });
    state = r.state;
    if (r.secrets) secrets = r.secrets;
    turns++;
  }

  ok('ใช้ 26 ตาพอดี', turns, 26);
  ok('เล่นคนละ 13 รอบ', state.round, 13);
  ok('จบเกมแล้ว', state.phase, 'over');
  ok('กระดานเต็มทั้งสองคน',
     state.seats.every(u => sheetDone(state.sheets[u])), true);
  ok('คะแนนรวมตรงกับกระดาน',
     state.seats.map(u => state.result.totals[u] === sheetTotal(state.sheets[u])), [true, true]);
  ok('มีผู้ชนะหรือเสมอเสมอ', state.result.winners.length >= 1, true);
}

console.log('');
console.log('\u2500'.repeat(46));
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
