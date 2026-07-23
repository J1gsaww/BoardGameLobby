/* engine.test.mjs — ชุดทดสอบเครื่องเกมสลาฟหนึ่งรอบ
   รันด้วย  node js/games/slave/engine.test.mjs */

import {
  createRound, apply, ranking, titles, timeoutAction,
  activeSeats, handCounts, whyNotPlay, whyNotPass,
  exchangePairs, applyExchange, PHASE
} from './engine.js';
import { bestCards } from './cards.js';

let pass = 0, fail = 0;
const ok = (label, got, want = true) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) pass++;
  else { fail++; console.log(`  ไม่ผ่าน: ${label}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`); }
};
const group = (n) => console.log('\n' + n);

/* เดินหลายท่าติดกัน ล้มทันทีถ้าท่าไหนถูกปฏิเสธ */
function run(state, moves) {
  let s = state;
  for (const m of moves) {
    const r = apply(s, m);
    if (r.error) throw new Error(`ท่า ${JSON.stringify(m)} ถูกปฏิเสธ: ${r.error}`);
    s = r.state;
  }
  return s;
}

const SEATS = ['A', 'B', 'C', 'D'];

/* ── รอบแรก ─────────────────────────────────────── */
group('รอบแรก เริ่มที่ดอกจิก 3');
{
  const hands = {
    A: ['5H', '9C'],
    B: ['3C', '7D'],          // B ถือดอกจิก 3
    C: ['6S', 'KD'],
    D: ['4H', '2S']
  };
  const s = createRound({ seats: SEATS, hands });
  ok('B เป็นคนเริ่ม', s.turn, 'B');
  ok('ทิศตั้งต้นตามเข็ม', s.dir, 1);
  ok('บังคับลงดอกจิก 3', s.mustInclude, '3C');
  ok('ลงใบอื่นก่อนไม่ได้', whyNotPlay(s, 'B', ['7D']), 'mustIncludeOpening');
  ok('คนเริ่มกองผ่านไม่ได้', whyNotPass(s, 'B'), 'mustLead');
  ok('ไม่ใช่ตาตัวเองลงไม่ได้', whyNotPlay(s, 'A', ['5H']), 'notYourTurn');
  ok('ไพ่ไม่ได้อยู่ในมือ ลงไม่ได้', whyNotPlay(s, 'B', ['2S']), 'notInHand');

  const s2 = run(s, [{ type: 'play', uid: 'B', cards: ['3C'] }]);
  ok('ลงแล้วเลิกบังคับ', s2.mustInclude, null);
  ok('ตาต่อไปคือ C (ตามเข็ม)', s2.turn, 'C');
  ok('กองมีไพ่ของ B', s2.pile.by, 'B');
}

/* ── กองปกติ ────────────────────────────────────── */
group('กองปกติ ทุกคนผ่าน คนลงล่าสุดชนะกอง');
{
  const hands = { A: ['5H', '9C'], B: ['3C', '7D'], C: ['6S', 'KD'], D: ['4H', '2S'] };
  const s = run(createRound({ seats: SEATS, hands }), [
    { type: 'play', uid: 'B', cards: ['3C'] },
    { type: 'play', uid: 'C', cards: ['6S'] },
    { type: 'pass', uid: 'D' },
    { type: 'pass', uid: 'A' },
    { type: 'pass', uid: 'B' }
  ]);
  ok('C ชนะกองและได้เริ่มกองใหม่', s.turn, 'C');
  ok('กองถูกเคลียร์', s.pile, null);
  ok('ล้างรายชื่อคนผ่าน', s.passed, []);
  ok('ทิศไม่เปลี่ยน', s.dir, 1);
}

/* ── ผ่านแล้วกลับมาลงไม่ได้ ─────────────────────── */
group('ผ่านแล้วออกจากกองนั้นเลย');
{
  const hands = { A: ['5H', '9C'], B: ['3C', '7D'], C: ['6S', 'KD'], D: ['4H', '2S'] };
  const s = run(createRound({ seats: SEATS, hands }), [
    { type: 'play', uid: 'B', cards: ['3C'] },
    { type: 'pass', uid: 'C' },
    { type: 'play', uid: 'D', cards: ['4H'] }
  ]);
  ok('ข้าม C ที่ผ่านไปแล้ว ไปที่ A', s.turn, 'A');
  ok('C จะลงอีกไม่ได้แม้ไพ่จะใหญ่กว่า', whyNotPlay(s, 'C', ['KD']), 'notYourTurn');
}

/* ── ข้อ 6 : หมดมือแต่คนอื่นยังลงต่อได้ ─────────── */
group('ข้อ 6 — คนหมดมือ แต่คนอื่นยังลงทับได้ ทิศไม่เปลี่ยน');
{
  const hands = { A: ['5H'], B: ['3C'], C: ['KD'], D: ['4H'] };
  let s = run(createRound({ seats: SEATS, hands }), [
    { type: 'play', uid: 'B', cards: ['3C'] }   // B หมดมือทันที
  ]);
  ok('B เข้าเส้นชัยเป็นคนแรก', s.finished, ['B']);
  ok('ตาไปที่ C ตามเข็มเหมือนเดิม', s.turn, 'C');
  s = run(s, [{ type: 'play', uid: 'C', cards: ['KD'] }]);   // C ลงทับได้ กองยังไม่จบ
  ok('C หมดมือเป็นคนที่สอง', s.finished, ['B', 'C']);
  ok('ทิศยังตามเข็ม', s.dir, 1);
}

/* ── ข้อ 7 : หมดมือแล้วทุกคนผ่าน ทิศกลับ ────────── */
group('ข้อ 7 — คนชนะกองไม่มีไพ่แล้ว ทิศกลับ');
{
  // ทดสอบในรอบแรกเพื่อไม่ให้ไปพัวพันกับกฎล้มคิง
  const hands = { A: ['5H', '9C'], B: ['3C'], C: ['6S', 'KD'], D: ['4H', '2S'] };
  const s0 = createRound({ seats: SEATS, hands });
  ok('B เริ่มเพราะถือดอกจิก 3', s0.turn, 'B');

  const s = run(s0, [
    { type: 'play', uid: 'B', cards: ['3C'] },   // B หมดมือทันที
    { type: 'pass', uid: 'C' },                  // ทุกคนเลือกผ่านทั้งที่ลงทับได้
    { type: 'pass', uid: 'D' },
    { type: 'pass', uid: 'A' }
  ]);
  ok('B ชนะกองทั้งที่ไม่มีไพ่แล้ว', s.finished, ['B']);
  ok('ทิศกลับด้าน', s.dir, -1);
  ok('คนเริ่มกองใหม่คือคนถัดไปในทิศใหม่', s.turn, 'A');
  ok('กองถูกเคลียร์', s.pile, null);
}

/* ── ทิศหนีคิงตอนเริ่มรอบ ───────────────────────── */
group('ทิศหนีคิงในรอบสอง');
{
  const seats = ['P0', 'P1', 'P2', 'P3', 'P4'];
  const hands = Object.fromEntries(seats.map((u, i) => [u, ['3C', '4D', '5H'].slice(i % 2)]));
  // สลาฟนั่งที่ 0 คิงนั่งที่ 2 → ตามเข็ม 2 ก้าว ทวนเข็ม 3 ก้าว จึงหนีด้วยทวนเข็ม
  const s = createRound({
    seats, roundNo: 2, hands,
    prevRanking: ['P2', 'P1', 'P3', 'P4', 'P0']
  });
  ok('สลาฟ P0 เริ่ม', s.turn, 'P0');
  ok('วนทวนเข็มเพื่อหนีคิง', s.dir, -1);
  ok('จำไว้ว่าใครเป็นคิง', s.king, 'P2');
}

/* ── ล้มคิง ─────────────────────────────────────── */
group('ล้มคิง');
{
  // รอบก่อน A เป็นคิง B เป็นสลาฟ · B เริ่มแล้วหมดมือทันที จึงล้ม A
  const hands = { A: ['9C', 'KS'], B: ['3C'], C: ['KD', '7H'], D: ['5S', '6H'] };
  const s0 = createRound({ seats: SEATS, hands, roundNo: 2, prevRanking: ['A', 'C', 'D', 'B'] });
  ok('คิงคือ A', s0.king, 'A');
  ok('สลาฟ B เริ่ม', s0.turn, 'B');

  const s = run(s0, [{ type: 'play', uid: 'B', cards: ['3C'] }]);
  ok('B หมดมือเป็นคนแรก', s.finished, ['B']);
  ok('A โดนล้มทันที', s.toppled, 'A');
  ok('ไพ่ในมือ A ถูกทิ้ง', s.hands.A.length, 0);
  ok('A ไม่อยู่ในวงแล้ว', activeSeats(s).includes('A'), false);
  ok('เหลือ C กับ D เล่นต่อ', activeSeats(s), ['C', 'D']);
  ok('B เป็นคิงใหม่', ranking(s)[0], 'B');
  ok('A ถูกดันไปท้ายสุด', ranking(s).slice(-1), ['A']);
}

/* ── คิงจบก่อน ไม่มีการล้ม ──────────────────────── */
group('คิงจบเองเป็นคนแรก ไม่มีการล้ม');
{
  // คิง A นั่งที่ 0 สลาฟ B นั่งที่ 1 → หนีคิงได้ทิศตามเข็ม ลำดับ B C D A
  const hands = { A: ['2S'], B: ['3C', '4D'], C: ['5H', '6S'], D: ['7H', '8S'] };
  const s0 = createRound({ seats: SEATS, hands, roundNo: 2, prevRanking: ['A', 'C', 'D', 'B'] });
  ok('วนตามเข็มเพื่อหนีคิงที่นั่งติดกัน', s0.dir, 1);

  const s = run(s0, [
    { type: 'play', uid: 'B', cards: ['3C'] },
    { type: 'play', uid: 'C', cards: ['5H'] },
    { type: 'play', uid: 'D', cards: ['7H'] },
    { type: 'play', uid: 'A', cards: ['2S'] }    // คิงหมดมือเป็นคนแรก
  ]);
  ok('A หมดมือเป็นคนแรก', s.finished, ['A']);
  ok('ไม่มีใครโดนล้ม', s.toppled, null);
  ok('A เป็นคิงต่อ', ranking(s)[0], 'A');
}

/* ── อันดับตอนจบรอบ ─────────────────────────────── */
group('อันดับและชื่อตำแหน่ง');
{
  const hands = { A: ['3C'], B: ['4D'], C: ['5H'], D: ['6S'] };
  let s = createRound({ seats: SEATS, hands });
  while (s.phase === PHASE.PLAY) {
    const act = s.pile
      ? { type: 'pass', uid: s.turn }
      : { type: 'play', uid: s.turn, cards: [s.hands[s.turn][0]] };
    s = apply(s, act).state;
  }
  ok('รอบจบแล้ว', s.phase, PHASE.DONE);
  ok('มีอันดับครบ 4 คน', ranking(s).length, 4);
  ok('ชื่อตำแหน่ง 4 คน',
     titles(ranking(s)).map(x => x.title), ['king', 'queen', 'viceSlave', 'slave']);
  ok('ชื่อตำแหน่ง 6 คน',
     titles(['a', 'b', 'c', 'd', 'e', 'f']).map(x => x.title),
     ['king', 'queen', 'people', 'people', 'viceSlave', 'slave']);
}

/* ── ตาที่หมดเวลา ───────────────────────────────── */
group('ตาที่หมดเวลา');
{
  const hands = { A: ['3C', '3D', '7H', 'KS'], B: ['9C'], C: ['KD'], D: ['5S'] };
  const s = createRound({ seats: SEATS, hands });
  ok('คนเริ่มกองหมดเวลา ถูกบังคับลงเลขน้อยสุดทั้งชุด',
     timeoutAction(s), { type: 'play', uid: 'A', cards: ['3C', '3D'] });

  const s2 = apply(s, timeoutAction(s)).state;
  ok('ลงเป็นคู่ กองนี้กลายเป็นสายคู่', s2.pile.cards.length, 2);
  ok('คนที่ไม่ได้เริ่มกองหมดเวลา ให้ผ่าน',
     timeoutAction(s2), { type: 'pass', uid: s2.turn });
}

/* ── จำนวนไพ่ที่ทุกคนเห็น ───────────────────────── */
group('จำนวนไพ่ในมือ ข้อมูลที่ทุกคนต้องเห็น');
{
  const hands = { A: ['3C', '5H'], B: ['9C'], C: ['KD'], D: ['5S'] };
  const s = apply(createRound({ seats: SEATS, hands }), { type: 'play', uid: 'A', cards: ['3C'] }).state;
  ok('นับไพ่ถูกต้องหลังลง', handCounts(s), { A: 1, B: 1, C: 1, D: 1 });
}

/* ── แลกไพ่ ─────────────────────────────────────── */
group('แลกไพ่ก่อนเริ่มรอบ');
{
  const rank = ['K', 'Q', 'P', 'VS', 'S'];
  ok('มีสองคู่แลก คิงกับสลาฟ 2 ใบ ควีนกับรองสลาฟ 1 ใบ',
     exchangePairs(rank), [
       { upper: 'K', lower: 'S', count: 2 },
       { upper: 'Q', lower: 'VS', count: 1 }
     ]);
  ok('เล่น 3 คน มีคู่แลกเดียว', exchangePairs(['K', 'P', 'S']).length, 1);

  const hands = { K: ['3C', '4D'], S: ['AS', '2H', '5C'] };
  const give = bestCards(hands.S, 2);
  ok('สลาฟยกไพ่ดีที่สุดสองใบ', give, ['2H', 'AS']);

  const after = applyExchange(hands, 'K', 'S', ['3C', '4D'], give);
  ok('คิงถือ 2H กับ AS', after.K.includes('2H') && after.K.includes('AS'));
  ok('สลาฟได้ไพ่ที่คิงคืนมา', after.S.includes('3C') && after.S.includes('4D'));
  ok('จำนวนไพ่เท่าเดิมทั้งคู่', [after.K.length, after.S.length], [2, 3]);
}

/* ── เกมเต็มรอบด้วยไพ่จริง ──────────────────────── */
group('เล่นจนจบรอบด้วยไพ่ที่สับจริง');
{
  let seed = 42;
  const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let s = createRound({ seats: ['P0', 'P1', 'P2', 'P3', 'P4'], rng });
  let guard = 0;
  while (s.phase === PHASE.PLAY && guard++ < 4000) {
    const uid = s.turn;
    const hand = s.hands[uid];
    let done = false;
    for (const c of hand) {                       // ลองลงทีละใบจากเล็กไปใหญ่
      const r = apply(s, { type: 'play', uid, cards: [c] });
      if (!r.error) { s = r.state; done = true; break; }
    }
    if (!done) {
      const r = apply(s, { type: 'pass', uid });
      if (r.error) throw new Error('ตัน: ' + r.error);
      s = r.state;
    }
  }
  ok('เล่นจนจบได้ไม่ตัน', s.phase, PHASE.DONE);
  ok('ไม่วนไม่รู้จบ', guard < 4000);
  ok('มีอันดับครบ 5 คน', ranking(s).length, 5);
  ok('อันดับไม่มีชื่อซ้ำ', new Set(ranking(s)).size, 5);
}

console.log(`\n${'─'.repeat(46)}\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);
process.exit(fail ? 1 : 0);
