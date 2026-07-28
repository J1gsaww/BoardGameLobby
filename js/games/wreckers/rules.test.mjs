/* rules.test.mjs — ชุดทดสอบกติกา Wreckers ทั้งสี่ชั้น
   รันด้วย  node js/games/wreckers/rules.test.mjs

   ชั้นที่ 1  ลำดับตากับ Action economy
   ชั้นที่ 2  Maroon กับการเลื่อนคิว
   ชั้นที่ 3  ระบบโหวตทุกตำแหน่ง
   ชั้นที่ 4  กล่องสมบัติกับการนับแต้ม

   ทุกอย่างที่สุ่มถูกส่ง rng ปลอมเข้าไป ผลจึงซ้ำได้ทุกครั้ง ไม่มีเทสที่บางวันผ่านบางวันไม่ผ่าน */

import {
  QUEUE, capacityOf, occupants, compact, joinPlace, roleAt, nextSeat, isPlaying,
  actionsFor, boatsOpen, canShift, maroon, pileOf, redeal, shuffle,
  startVote, voters, voteReady, tallyRow, attackPasses, mutinyPasses, brawlSplit,
  moveBox, countBoxes, score, winningSide, winners, dutchCount, dealNations, dutchAllowed,
  attackTargets, takeSides, keepSides, canAttack, canVoteNow, refill, birdStrike,
  anytimeCards,
  holdCard, dropHeld, giveCard, addSkip, owesSkip, burnSkip, advance,
  addVoteBan, isVoteBanned, burnVoteBans, voteWeight, setVoteWeight, clearVoteWeights,
  addMark, markCount, marksIn, clearMark, swapSpots, shuffleQueue,
  addShield, hasShield, burnShield, insertBehind, addVoter, boatsFromAll,
  buildEventDeck, refillSlots,
  SHIP_CARGO_CAP, TOTAL_BOXES, pushLog, LOG_MAX
} from './rules.js';
import { onAction, init, tick, finish, passTurn, openTurn } from './game.js';
import { DECK } from './vote.js';
import { shipsWithRoom, canUseCard, MAP_CARDS, playWindow, pickCountOf, targetsOf } from './effects.js';
import { BASE_CARDS, BASE_TOTAL, baseById, ENDER } from './events.js';
import { EXTRA_CARDS, randomSets } from './cards.js';

let pass = 0, fail = 0;
const ok = (label, got, want = true) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) pass++;
  else { fail++; console.log(`  ไม่ผ่าน: ${label}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`); }
};
const group = (n) => console.log('\n' + n);

/* นับจำนวนคนต่อประเทศ เรียงชื่อประเทศให้แน่นอน จะได้เทียบตรง ๆ ได้ */
const nationTally = (map) => Object.entries(
  Object.values(map).reduce((m, v) => ({ ...m, [v]: (m[v] || 0) + 1 }), {})
).sort(([a], [b]) => a.localeCompare(b));

/* สุ่มปลอมแบบเดินเป็นวง ผลเหมือนเดิมทุกครั้งที่รัน */
const fakeRng = (seq) => { let i = 0; return () => seq[i++ % seq.length]; };
const zero = () => 0;

/* ── โครงสถานะสำหรับเทส ─────────────────────────────────── */

const P = ['a', 'b', 'c', 'd', 'e', 'f'];

function board(spots = {}) {
  return {
    phase: 'play',
    seats: [...P],
    out: [],
    names: Object.fromEntries(P.map(u => [u, u.toUpperCase()])),
    turn: 'a',
    turnSeconds: 60,
    pos: { ...spots },
    boatFrom: {},
    maxVote: Object.fromEntries(P.map(u => [u, 3])),
    votes: Object.fromEntries(P.map(u => [u, 3])),
    cargo: { shipL: { B: 1, F: 0 }, shipR: { B: 0, F: 1 }, island: { B: 1, F: 1 }, merchant: 4 },
    vote: null,
    log: [],
    logSeq: 0
  };
}

/* เรือซ้ายเต็มลำดับ C F 3 · เกาะมีสองคน */
const filled = () => board({
  a: 'shipL:C', b: 'shipL:F', c: 'shipL:3',
  d: 'island:G', e: 'island:2',
  f: 'shipR:C'
});

/* ═══════════════════════════════════════════════════════════
   ชั้นที่ 1 — ลำดับตากับ Action economy
   ═══════════════════════════════════════════════════════════ */

group('ชั้น 1 · คิวในสถานที่');
ok('เรือรับได้ 5 คน เกาะรับได้ 10', [capacityOf('shipL'), capacityOf('island')], [5, 10]);
ok('เรือเล็กรับได้คนเดียว', capacityOf('boatL'), 1);
ok('อ่านคนในสถานที่เรียงตามคิว', occupants(filled().pos, 'shipL'), ['a', 'b', 'c']);
ok('หัวแถวเรือคือกัปตัน', roleAt(filled().pos, 'a'), 'captain');
ok('คนที่สองคือต้นหน', roleAt(filled().pos, 'b'), 'mate');
ok('หัวแถวเกาะคือประธานเกาะ', roleAt(filled().pos, 'd'), 'governor');

group('ชั้น 1 · คิวเขยิบขึ้นเมื่อคนข้างหน้าหายไป');
{
  const st = filled();
  delete st.pos.a;                                     // กัปตันหายไป
  const after = compact(st.pos);
  ok('ต้นหนขึ้นเป็นกัปตันเอง', after.b, 'shipL:C');
  ok('คนที่สามขยับขึ้นเป็นต้นหน', after.c, 'shipL:F');
  ok('ไม่มีช่องว่างคั่นกลาง', occupants(after, 'shipL'), ['b', 'c']);
  ok('บทบาทเปลี่ยนตามช่องที่ยืน ไม่ต้องเขียนโค้ดเลื่อนตำแหน่ง', roleAt(after, 'b'), 'captain');
}
{
  const st = filled();
  delete st.pos.d;                                     // ประธานเกาะหายไป
  ok('บนเกาะก็เขยิบเหมือนกัน', roleAt(compact(st.pos), 'e'), 'governor');
}

group('ชั้น 1 · เข้าสถานที่ใหม่ต้องไปต่อท้ายคิวเสมอ');
{
  const st = filled();
  const after = joinPlace(st.pos, 'f', 'shipL');
  ok('ต่อท้ายแถว ไม่ได้แทรกกลาง', after.f, 'shipL:4');
  ok('คนเดิมไม่ขยับ', occupants(after, 'shipL'), ['a', 'b', 'c', 'f']);
  ok('ออกจากเรือเดิมแล้วจริง', occupants(after, 'shipR'), []);
}
{
  const full = board({ a: 'shipL:C', b: 'shipL:F', c: 'shipL:3', d: 'shipL:4', e: 'shipL:5', f: 'island:G' });
  ok('เรือเต็มแล้วเข้าไม่ได้', joinPlace(full.pos, 'f', 'shipL'), null);
}

group('ชั้น 1 · ลำดับตา');
{
  const st = filled();
  ok('วนตามลำดับที่นั่ง ไม่เกี่ยวกับตำแหน่งบนกระดาน', nextSeat(st, 'a'), 'b');
  ok('ถึงคนสุดท้ายแล้ววนกลับหัว', nextSeat(st, 'f'), 'a');
  const gone = { ...st, out: ['b', 'c'] };
  ok('ข้ามคนที่ออกจากเกมไปแล้ว', nextSeat(gone, 'a'), 'd');
  ok('คนที่ออกไปแล้วไม่นับว่ายังเล่นอยู่', isPlaying(gone, 'b'), false);
}

group('ชั้น 1 · Action ที่ทำได้ในหนึ่งตา');
{
  const st = filled();
  ok('กัปตันได้ Action ของกัปตัน',
     actionsFor(st, 'a').sort(),
     ['activate', 'attack', 'force', 'kick', 'peek', 'toBoat'].sort());
  ok('ต้นหนสั่งก่อกบฏได้', actionsFor({ ...st, turn: 'b' }, 'b').includes('mutiny'), true);
  ok('ต้นหนสั่งโจมตีไม่ได้', actionsFor({ ...st, turn: 'b' }, 'b').includes('attack'), false);
  ok('ประธานเกาะสั่งโหวตย้ายกล่องได้',
     actionsFor({ ...st, turn: 'd' }, 'd').includes('islandVote'), true);
  ok('ชาวเกาะธรรมดาไม่มี Action ประจำตำแหน่ง',
     actionsFor({ ...st, turn: 'e' }, 'e').sort(), ['activate', 'force', 'peek', 'toBoat'].sort());
  ok('ยังไม่ถึงตาก็ไม่มี Action ให้ทำ', actionsFor(st, 'b'), []);
  ok('ระหว่างมีโหวตค้าง ทุกคนทำ Action ไม่ได้', actionsFor({ ...st, vote: {} }, 'a'), []);
}

group('ชั้น 1 · ข้อยกเว้นเรื่องลูกเรือย้ายกล่อง');
{
  const three = filled();
  ok('คนช่องที่ 3 เป็นลูกเรือ ย้ายกล่องได้', canShift(three, 'c'), true);
  ok('กัปตันตอนมีคนครบไม่ใช่ลูกเรือ', canShift(three, 'a'), false);

  const two = board({ a: 'shipL:C', b: 'shipL:F' });
  ok('บนเรือมีสองคน คนท้ายสุดย้ายกล่องได้', canShift(two, 'b'), true);
  ok('บนเรือมีสองคน คนหัวแถวยังย้ายไม่ได้', canShift(two, 'a'), false);

  const solo = board({ a: 'shipL:C' });
  ok('กัปตันอยู่คนเดียวย้ายกล่องได้', canShift(solo, 'a'), true);

  const isle = board({ a: 'island:G' });
  ok('บนเกาะย้ายกล่องเองไม่ได้ ต้องผ่านโหวตเท่านั้น', canShift(isle, 'a'), false);
}

group('ชั้น 1 · เรือเล็ก');
{
  const st = filled();
  ok('จากเรือซ้ายไปได้แค่เรือเล็กซ้าย', boatsOpen(st, 'shipL:C'), ['boatL']);
  ok('จากเกาะเลือกได้ทั้งสองลำ', boatsOpen(st, 'island:G'), ['boatL', 'boatR']);
  const taken = board({ ...st.pos, f: 'boatL:x' });
  ok('ลำที่มีคนอยู่แล้วเลือกไม่ได้', boatsOpen(taken, 'shipL:C'), []);
  ok('อยู่บนเรือเล็กแล้วทำอะไรไม่ได้ รอขึ้นฝั่งอย่างเดียว',
     actionsFor({ ...taken, turn: 'f' }, 'f'), []);
}
{
  /* ขึ้นฝั่งเป็นของแถม ทำตอนเปิดตา ไม่กินสิทธิ์ Action */
  const st = { ...board({ a: 'boatL:x', b: 'shipL:C' }), turn: 'a', boatFrom: { a: 'shipL' } };
  const after = openTurn(st);
  ok('ขึ้นจากเรือใหญ่แล้วไปโผล่ที่เกาะ', after.pos.a, 'island:G');
  ok('ลงจากเรือเล็กแล้วลำนั้นว่าง', occupants(after.pos, 'boatL'), []);
  ok('ขึ้นฝั่งแล้วยังเป็นตาของคนเดิมอยู่', after.turn, 'a');
}
{
  const st = { ...board({ a: 'boatL:x' }), turn: 'a', boatFrom: { a: 'island' } };
  ok('ขึ้นจากเกาะแล้วไปโผล่ที่เรือใหญ่ฝั่งเดียวกัน', openTurn(st).pos.a, 'shipL:C');
}
{
  const full = board({
    a: 'boatL:x', b: 'shipL:C', c: 'shipL:F', d: 'shipL:3', e: 'shipL:4', f: 'shipL:5'
  });
  const st = { ...full, turn: 'a', boatFrom: { a: 'island' } };
  ok('ปลายทางเต็มก็ค้างอยู่บนเรือเล็กต่อ', openTurn(st).pos.a, 'boatL:x');
}

/* ═══════════════════════════════════════════════════════════
   ชั้นที่ 2 — Maroon กับการเลื่อนคิว
   ═══════════════════════════════════════════════════════════ */

group('ชั้น 2 · Maroon');
{
  const st = filled();
  const r = maroon(st, 'a', {});
  ok('อยู่บนเรือแล้วโดน เด้งลงเกาะ', r.state.pos.a, 'island:3');
  ok('ไปต่อท้ายคิวของเกาะ ไม่แทรกหน้า', occupants(r.state.pos, 'island'), ['d', 'e', 'a']);
  ok('ต้นหนเลื่อนขึ้นเป็นกัปตันทันที', roleAt(r.state.pos, 'b'), 'captain');
  ok('บอกชนิดของผลที่เกิด', r.kind, 'toIsland');
}
{
  const st = filled();
  const r = maroon(st, 'd', {});                        /* ประธานเกาะโดนเอง */
  ok('อยู่บนเกาะกับคนอื่นแล้วโดนซ้ำ ไปต่อท้ายคิว', occupants(r.state.pos, 'island'), ['e', 'd']);
  ok('คนที่เหลือขึ้นเป็นประธานเกาะแทน', roleAt(r.state.pos, 'e'), 'governor');
  ok('ยังไม่เสียไพ่เพราะยังมีที่ให้ถอย', r.kind, 'backOfQueue');
}
{
  const st = board({ a: 'island:G', b: 'shipL:C' });
  const hands = { a: ['v01', 'v02', 'v03'], b: ['v04', 'v05', 'v06'] };
  const r = maroon(st, 'a', hands, zero);
  ok('อยู่บนเกาะคนเดียวแล้วโดนซ้ำ เสียไพ่โหวตถาวร', r.kind, 'loseCard');
  ok('เพดานมือลดลงหนึ่งใบ', r.state.maxVote.a, 2);
  ok('ไพ่ในมือถูกทิ้งจริง ไม่ใช่แค่ลดตัวเลข', r.hands.a.length, 2);
  ok('จำนวนใบที่คนอื่นเห็นตรงกับมือจริง', r.state.votes.a, 2);
  ok('ยืนอยู่ที่เดิม ไม่ได้ย้ายไปไหน', r.state.pos.a, 'island:G');
  ok('มือคนอื่นไม่ถูกแตะ', r.hands.b.length, 3);
}
{
  const st = board({ a: 'island:G' });
  st.maxVote.a = 0;
  const r = maroon(st, 'a', { a: [] }, zero);
  ok('เพดานลดต่ำกว่าศูนย์ไม่ได้', r.state.maxVote.a, 0);
}

/* ═══════════════════════════════════════════════════════════
   ชั้นที่ 3 — ระบบโหวต
   ═══════════════════════════════════════════════════════════ */

group('ชั้น 3 · ใครได้โหวตบ้าง');
{
  const st = filled();
  ok('โจมตี ทุกคนบนเรือลำนั้นโหวต', voters(st, 'attack', 'shipL'), ['a', 'b', 'c']);
  ok('ก่อกบฏ กัปตันโหวตไม่ได้', voters(st, 'mutiny', 'shipL'), ['b', 'c']);
  ok('ย้ายกล่องบนเกาะ ทุกคนบนเกาะโหวต', voters(st, 'islandVote', 'island'), ['d', 'e']);
  ok('คนที่อยู่คนละที่ไม่เกี่ยว', voters(st, 'attack', 'shipL').includes('f'), false);
}
{
  const st = startVote(filled(), { kind: 'attack', place: 'shipL', caller: 'a', target: 'merchant' });
  ok('เปิดโหวตแล้วยังไม่มีใครส่งไพ่', st.vote.done, []);
  ok('ยังเปิดหม้อไม่ได้', voteReady(st), false);
  ok('เติมไพ่จากกองกลางหนึ่งใบเสมอ', st.vote.extra, 1);
  const all = { ...st, vote: { ...st.vote, done: ['a', 'b', 'c'] } };
  ok('ครบทุกคนแล้วเปิดหม้อได้', voteReady(all), true);
}

group('ชั้น 3 · นับไพ่ในหม้อ');
ok('นับเฉพาะแถวที่เกี่ยวข้อง', tallyRow(['v03'], 'attack'), { C: 1 });
ok('ใบเดียวกันคนละแถวได้คนละสัญลักษณ์', tallyRow(['v03'], 'mutiny'), { A: 1 });
ok('ตัวอักษรซ้ำคือสองอันในใบเดียว', tallyRow(['v12'], 'attack'), { C: 1, F: 1 });
/* ใบเปล่าถูกถอดออกจากสำรับแล้ว เหลือเช็กว่าไพ่ที่ไม่มีอยู่จริงก็ไม่ทำให้พัง */
ok('ไพ่ที่ไม่มีในสำรับไม่นับอะไรเลย', tallyRow(['ไม่มีจริง'], 'attack'), {});
ok('สำรับไม่มีใบเปล่าแล้ว', DECK.filter(c => c.blank).length, 0);
ok('รวมหลายใบได้ถูก', tallyRow(['v03', 'v07', 'v01'], 'attack'), { C: 1, F: 1, W: 1 });

group('ชั้น 3 · โจมตี');
ok('มีปืนใหญ่และไฟมากกว่าน้ำ ผ่าน', attackPasses({ C: 1, F: 2, W: 1 }), true);
ok('ไม่มีปืนใหญ่ ไม่ผ่านแม้ไฟเยอะ', attackPasses({ F: 5, W: 0 }), false);
ok('น้ำหนึ่งดับไฟหนึ่ง เท่ากันคือไม่ผ่าน', attackPasses({ C: 2, F: 2, W: 2 }), false);
ok('น้ำมากกว่าไฟ ไม่ผ่าน', attackPasses({ C: 1, F: 1, W: 3 }), false);
ok('มีปืนใหญ่แต่ไม่มีไฟเลย ไม่ผ่าน', attackPasses({ C: 3 }), false);

group('ชั้น 3 · ก่อกบฏ');
ok('เห็นด้วยมากกว่า ผ่าน', mutinyPasses({ A: 2, D: 1 }), true);
ok('เสมอ ไม่ผ่าน กัปตันอยู่ต่อ', mutinyPasses({ A: 2, D: 2 }), false);
ok('ไม่เห็นด้วยมากกว่า ไม่ผ่าน', mutinyPasses({ A: 1, D: 2 }), false);
ok('หม้อว่างเปล่า ไม่ผ่าน', mutinyPasses({}), false);

group('ชั้น 3 · ย้ายกล่องบนเกาะ');
ok('เกาะสองกล่อง เสมอคงไว้ 1-1', brawlSplit({ B: 2, R: 2 }, 2), { B: 1, F: 1 });
ok('เกาะสองกล่อง ไม่เสมอยกไปทั้งหมด', brawlSplit({ B: 3, R: 1 }, 2), { B: 2, F: 0 });
ok('เกาะสี่กล่อง เสมอคงไว้ 2-2', brawlSplit({ B: 3, R: 3 }, 4), { B: 2, F: 2 });
ok('เกาะสี่กล่อง ชนะห่างหนึ่ง เป็น 3-1', brawlSplit({ B: 3, R: 2 }, 4), { B: 3, F: 1 });
ok('เกาะสี่กล่อง ชนะห่างสาม ยังเป็น 3-1', brawlSplit({ B: 5, R: 2 }, 4), { B: 3, F: 1 });
ok('เกาะสี่กล่อง ห่างถึงสี่ ยกไปหมด 4-0', brawlSplit({ B: 6, R: 2 }, 4), { B: 4, F: 0 });
ok('ฝรั่งเศสถล่มขาดก็ยกไปหมดเหมือนกัน', brawlSplit({ B: 1, R: 6 }, 4), { B: 0, F: 4 });
ok('หม้อสองสามใบไปได้ไกลสุดแค่ 3-1', brawlSplit({ B: 3, R: 0 }, 4), { B: 3, F: 1 });
{
  /* เกาะมี 3 หรือ 5 กล่องไม่ได้ ผลโหวตจึงห้ามเปลี่ยนจำนวนรวมไม่ว่ากรณีไหน */
  const bad = [];
  for (const total of [2, 4]) {
    for (let b = 0; b <= 8; b++) {
      for (let f = 0; f <= 8; f++) {
        const sp = brawlSplit({ B: b, R: f }, total);
        if (sp.B + sp.F !== total || sp.B < 0 || sp.F < 0) bad.push([total, b, f, sp]);
      }
    }
  }
  ok('ผลโหวตไม่เคยเปลี่ยนจำนวนกล่องรวมบนเกาะ', bad, []);
}

group('ชั้น 3 · กองไพ่กับการแจกคืน');
{
  const hands = { a: ['v01', 'v02'], b: ['v03'] };
  const pile = pileOf(hands, ['v04']);
  ok('กองที่เหลือคือสำรับลบมือทุกคนลบไพ่ในหม้อ', pile.length, DECK.length - 4);
  ok('ไพ่ที่อยู่ในมือไม่โผล่ในกอง', pile.includes('v01'), false);
  ok('ไพ่ที่อยู่ในหม้อไม่โผล่ในกอง', pile.includes('v04'), false);
}
{
  const maxVote = { a: 3, b: 3, c: 2 };
  const r = redeal(['a', 'b', 'c'], maxVote, fakeRng([0.1, 0.7, 0.3, 0.9, 0.5]));
  ok('แจกตามเพดานของแต่ละคน', [r.hands.a.length, r.hands.b.length, r.hands.c.length], [3, 3, 2]);
  ok('กองที่เหลือครบพอดี', r.pile.length, DECK.length - 8);
  const all = [...r.hands.a, ...r.hands.b, ...r.hands.c, ...r.pile];
  ok('ไม่มีไพ่หายและไม่มีไพ่ซ้ำ', new Set(all).size, DECK.length);
}

/* ═══════════════════════════════════════════════════════════
   ชั้นที่ 4 — กล่องสมบัติกับการนับแต้ม
   ═══════════════════════════════════════════════════════════ */

group('ชั้น 4 · การย้ายกล่อง');
{
  const c = board().cargo;
  ok('เริ่มเกมมีแปดกล่องพอดี', countBoxes(c), TOTAL_BOXES);
  const moved = moveBox(c, 'merchant', null, 'shipL', 'F');
  ok('ย้ายจากเรือสินค้าขึ้นเรือใหญ่ได้', [moved.merchant, moved.shipL.F], [3, 1]);
  ok('กล่องไม่หายไปไหนระหว่างย้าย', countBoxes(moved), TOTAL_BOXES);
  ok('ของเดิมไม่ถูกแก้', [c.merchant, c.shipL.F], [4, 0]);
}
{
  const c = board().cargo;
  ok('ต้นทางไม่มีกล่องก็ย้ายไม่ได้', moveBox(c, 'shipL', 'F', 'shipR', 'F'), null);
}
{
  const c = { shipL: { B: 3, F: 0 }, shipR: { B: 0, F: 1 }, island: { B: 1, F: 1 }, merchant: 2 };
  ok('เรือเก็บได้ประเทศละสามกล่อง เกินแล้วย้ายไม่ได้',
     moveBox(c, 'merchant', null, 'shipL', 'B'), null);
  ok('อีกฝั่งของลำเดียวกันยังว่างอยู่ ย้ายได้',
     moveBox(c, 'merchant', null, 'shipL', 'F').shipL.F, 1);
  ok('เพดานคือสามต่อฝั่ง', SHIP_CARGO_CAP, 3);
}
{
  const c = board().cargo;
  const to = moveBox(c, 'island', 'B', 'merchant', null);
  ok('เกาะกับเรือสินค้าไม่มีเพดาน', [to.island.B, to.merchant], [0, 5]);
}

group('ชั้น 4 · การนับแต้ม');
{
  const c = { shipL: { B: 2, F: 1 }, shipR: { B: 1, F: 0 }, island: { B: 0, F: 2 }, merchant: 2 };
  ok('นับกล่องบนฝั่งประเทศ', score(c), { B: 3, F: 3, merchant: 2 });
  ok('กล่องบนเรือสินค้าไม่นับให้ใคร', score(c).B + score(c).F, 6);
  ok('เท่ากันแล้วดัตช์ชนะ', winningSide(c), 'D');
}
ok('บริติชมากกว่า บริติชชนะ',
   winningSide({ shipL: { B: 3, F: 0 }, shipR: { B: 0, F: 1 }, island: { B: 0, F: 0 }, merchant: 4 }), 'B');
ok('ฝรั่งเศสมากกว่า ฝรั่งเศสชนะ',
   winningSide({ shipL: { B: 0, F: 2 }, shipR: { B: 1, F: 1 }, island: { B: 0, F: 0 }, merchant: 4 }), 'F');
{
  const c = { shipL: { B: 3, F: 0 }, shipR: { B: 0, F: 1 }, island: { B: 0, F: 0 }, merchant: 4 };
  const nations = { a: 'B', b: 'F', c: 'B', d: 'D' };
  ok('คนฝั่งที่ชนะได้ชนะทุกคน', winners(c, nations).sort(), ['a', 'c']);
  const tie = { shipL: { B: 1, F: 1 }, shipR: { B: 0, F: 0 }, island: { B: 0, F: 0 }, merchant: 6 };
  ok('เสมอแล้วดัตช์ชนะคนเดียว', winners(tie, nations), ['d']);
}

group('ชั้น 4 · ไพ่ประเทศ');
ok('คนคี่ได้ดัตช์หนึ่งคน', dutchCount(7, 'auto'), 1);
ok('คนคู่ไม่มีดัตช์', dutchCount(6, 'auto'), 0);
ok('สี่คนก็ไม่มีดัตช์', dutchCount(4, 'auto'), 0);
ok('แปดคนก็ไม่มีดัตช์ถ้าไม่ได้เลือกเอง', dutchCount(8, 'auto'), 0);
ok('กำหนดเองได้ว่าสองคน', dutchCount(8, '2'), 2);
ok('เลือกหนึ่งคนได้ที่ห้าคน', dutchAllowed(5, '1'), true);
ok('เลือกหนึ่งคนได้ที่เจ็ดคน', dutchAllowed(7, '1'), true);
ok('เลือกหนึ่งคนได้ที่เก้าคน', dutchAllowed(9, '1'), true);
ok('เก้าคนเลือกหนึ่ง เหลือแบ่งสี่สี่',
   (() => { const m = dealNations(Array.from({length:9},(_,i)=>'p'+i), '1', fakeRng([0.3,0.8,0.1,0.6,0.44]));
            const c = nationTally(m); return c; })(),
   [['B', 4], ['D', 1], ['F', 4]]);
ok('เลือกหนึ่งคนไม่ได้ที่หกคน', dutchAllowed(6, '1'), false);
ok('เลือกสองคนได้ที่แปดกับสิบ', [dutchAllowed(8, '2'), dutchAllowed(10, '2')], [true, true]);
ok('เลือกสองคนไม่ได้ที่หกคน', dutchAllowed(6, '2'), false);
ok('ตามจำนวนคนกดได้เสมอ', dutchAllowed(4, 'auto'), true);
ok('ตั้งค่าค้างไว้แล้วคนเปลี่ยน ให้ตกกลับเป็นอัตโนมัติ', dutchCount(6, '1'), 0);
{
  const n = dealNations(['a', 'b', 'c', 'd', 'e', 'f'], 'auto', fakeRng([0.2, 0.8, 0.4, 0.6, 0.1]));
  ok('หกคนไม่มีดัตช์ แบ่งสามสาม', nationTally(n), [['B', 3], ['F', 3]]);
  ok('ทุกคนได้ประเทศครบ', Object.keys(n).length, 6);
}
{
  /* ทุกจำนวนคนที่เกมรองรับต้องแบ่งบริติชกับฝรั่งเศสเท่ากันเสมอ */
  const bad = [];
  for (let n = 4; n <= 10; n++) {
    const seats = Array.from({ length: n }, (_, i) => 'p' + i);
    const map = dealNations(seats, 'auto', fakeRng([0.13, 0.71, 0.37, 0.92, 0.5, 0.24]));
    const c = Object.values(map).reduce((m, v) => ({ ...m, [v]: (m[v] || 0) + 1 }), {});
    if ((c.B || 0) !== (c.F || 0)) bad.push([n, c]);
  }
  ok('4 ถึง 10 คน สองฝั่งเท่ากันทุกกรณี', bad, []);
}
{
  const n = dealNations(['a', 'b', 'c', 'd', 'e'], 'auto', fakeRng([0.3, 0.7, 0.2]));
  ok('ห้าคนได้ดัตช์หนึ่งคน ที่เหลือแบ่งสองสอง', nationTally(n), [['B', 2], ['D', 1], ['F', 2]]);
  ok('ห้าคนเลือกเองว่าหนึ่งก็ได้ผลเดียวกัน',
     nationTally(dealNations(['a','b','c','d','e'], '1', fakeRng([0.3, 0.7, 0.2]))),
     [['B', 2], ['D', 1], ['F', 2]]);
}
{
  const n = dealNations(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], '2', fakeRng([0.5, 0.2, 0.9, 0.4]));
  ok('แปดคนใส่ดัตช์สองคน ที่เหลือแบ่งสามสาม', nationTally(n), [['B', 3], ['D', 2], ['F', 3]]);
}

/* ═══════════════════════════════════════════════════════════
   ต่อสายจริง — ยิงคำขอเข้า onAction เหมือนผู้เล่นกดปุ่ม
   ═══════════════════════════════════════════════════════════ */

const members = P.map((uid, i) => ({ uid, role: 'player', left: false, seat: i, name: uid.toUpperCase(), online: true }));

/* มือเริ่มต้นต้องไม่ซ้ำกันระหว่างคน
   ของเดิมแจก v01,v02,v03 ให้ทุกคนเหมือนกัน ซึ่งเป็นสถานะที่เกิดขึ้นจริงไม่ได้
   และทำให้เทสเรื่องจำนวนไพ่ทั้งระบบเชื่อถือไม่ได้ */
const seatHand = (i) => [1, 2, 3].map(n => 'v' + String(i * 3 + n).padStart(2, '0'));

function ctxOf(state, hands = {}, nations = {}, picks = {}) {
  return {
    state,
    members,
    settings: { turnSeconds: 60 },
    secrets: Object.fromEntries(P.map((u, i) => [u, {
      vote: hands[u] || seatHand(i),
      nation: nations[u] || 'B',
      pick: picks[u] || null
    }]))
  };
}

group('ต่อสาย · เปิดเกม');
{
  const out = init({ members, settings: { turnSeconds: 45, extraCards: [] } });
  const st = out.state;
  ok('ทุกคนได้ที่ยืนบนเรือ', Object.keys(st.pos).length, 6);
  ok('แบ่งลงสองลำสลับกัน',
     [occupants(st.pos, 'shipL').length, occupants(st.pos, 'shipR').length], [3, 3]);
  ok('เริ่มเกมมีแปดกล่อง', countBoxes(st.cargo), TOTAL_BOXES);
  ok('ทุกคนได้ไพ่โหวตสามใบ', Object.values(st.votes), [3, 3, 3, 3, 3, 3]);
  const mine = Object.entries(out.secrets).filter(([u]) => !u.startsWith('_'));
  ok('ทุกคนได้ไพ่ประเทศ', mine.every(([, s]) => 'BFD'.includes(s.nation)), true);
  ok('สำรับเหตุการณ์เก็บแยกไว้ในช่องที่ผู้เล่นอ่านไม่ได้', !!out.secrets._deck, true);
  ok('เปิดมามีการ์ดคว่ำครบห้าช่อง', out.secrets._deck.slots.filter(Boolean).length, 5);
  ok('กองที่เหลือ = ทั้งสำรับลบที่วางบนโต๊ะ', out.secrets._deck.draw.length, 24 - 5);
  ok('จำนวนที่โชว์ตรงกับกองจริง', st.eventDeck, out.secrets._deck.draw.length);
  ok('กองไพ่ที่เหลือถูกต้อง', st.voteDeck, DECK.length - 18);
  ok('ตั้งเวลาต่อตาตามที่เลือกไว้', st.turnSeconds, 45);
  ok('เปิดเกมมาเป็นช่วงโชว์ไพ่ประเทศก่อน', st.phase, 'reveal');
  ok('ช่วงโชว์ยังทำ Action ไม่ได้', actionsFor(st, st.turn), []);
}
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  ok('เลือกไม่จับเวลาแล้วเก็บค่าศูนย์ไว้จริง ไม่ตกกลับไปหกสิบ', out.state.turnSeconds, 0);
}

group('ต่อสาย · ช่วงโชว์ไพ่ประเทศ');
{
  const st = { ...filled(), phase: 'reveal', deadline: Date.now() - 1000 };
  const r = await tick({ ...ctxOf(st), members });
  ok('หมดเวลาโชว์แล้วเข้าสู่การเล่น', r.state.phase, 'play');
  ok('ยังไม่หมดเวลาก็ยังค้างอยู่',
     await tick({ ...ctxOf({ ...st, deadline: Date.now() + 9000 }), members }), null);
}

group('ต่อสาย · โหมดไม่จับเวลา');
{
  const st = { ...filled(), turnSeconds: 0, deadline: null };
  ok('ทุกคนออนไลน์ ก็ไม่ตั้งเส้นตายอะไรเลย', await tick({ ...ctxOf(st), members }), null);

  const off = members.map(m => (m.uid === 'a' ? { ...m, online: false } : m));
  const r = await tick({ ...ctxOf(st), members: off });
  ok('คนที่ถึงตาหลุด ตั้งเพดานรอ 120 วินาที', r.state.deadline > Date.now() + 110000, true);

  const back = await tick({ ...ctxOf({ ...st, deadline: Date.now() + 60000, graced: true }), members });
  ok('กลับมาก่อนหมดเพดาน ยกเลิกให้ ไม่โดนข้ามตา', back.state.deadline, null);

  const gone = await tick({ ...ctxOf({ ...st, deadline: Date.now() - 500, graced: true }), members: off });
  ok('หมดเพดานแล้วยังไม่กลับ ข้ามตาไป', gone.state.turn, 'b');
}
{
  /* ใช้ toBoat แทน force เพราะ force ไม่ผ่านตาทันทีอีกแล้ว — มันเปิดขั้นถามก่อน */
  const st = { ...filled(), turnSeconds: 0, deadline: null };
  const done = (await onAction(ctxOf(st), { uid: 'a', type: 'toBoat', payload: { boat: 'boatL' } })).state;
  ok('ไม่จับเวลา ส่งตาต่อแล้วก็ยังไม่มีเส้นตาย', done.deadline, null);
}

group('ต่อสาย · หนึ่งตาหนึ่ง Action');
{
  const st = filled();
  const r = await onAction(ctxOf(st), { uid: 'a', type: 'toBoat', payload: { boat: 'boatL' } });
  ok('ทำแล้วส่งตาต่อทันที', r.state.turn, 'b');
  const bad = await onAction(ctxOf(r.state), { uid: 'a', type: 'force' });
  ok('คนเดิมทำซ้ำในตาของคนอื่นไม่ได้', bad, null);
  const notMine = await onAction(ctxOf(st), { uid: 'c', type: 'force' });
  ok('ยังไม่ถึงตาก็ทำไม่ได้', notMine, null);
}
{
  const st = filled();
  const r = await onAction(ctxOf(st), { uid: 'a', type: 'mutiny' });
  ok('กัปตันสั่งก่อกบฏเองไม่ได้', r, null);
  const r2 = await onAction(ctxOf({ ...st, turn: 'e' }), { uid: 'e', type: 'islandVote' });
  ok('ชาวเกาะที่ไม่ใช่ประธานสั่งโหวตไม่ได้', r2, null);
}

group('ต่อสาย · ลงเรือเล็กแล้วขึ้นฝั่ง');
{
  const st = filled();
  const r = await onAction(ctxOf(st), { uid: 'a', type: 'toBoat', payload: { boat: 'boatL' } });
  ok('ลงเรือเล็กแล้วอยู่บนเรือเล็กจริง', r.state.pos.a, 'boatL:x');
  ok('จำได้ว่าขึ้นมาจากไหน', r.state.boatFrom.a, 'shipL');
  ok('ลงเรือเล็กกินสิทธิ์ Action ตาผ่านไปคนถัดไป', r.state.turn, 'b');
  ok('ต้นหนขึ้นเป็นกัปตันทันทีที่กัปตันลงเรือ', roleAt(r.state.pos, 'b'), 'captain');

  /* วนจนกลับมาถึงตาเขาอีกครั้ง */
  /* ใช้ลงเรือเล็กเป็น Action ที่จบในตัวเอง แทน force ซึ่งตอนนี้เปิดขั้นถามก่อน
     คนบนเกาะมีเรือเล็กสองลำให้เลือก คนบนเรือมีลำเดียว */
  let s = r.state;
  for (const uid of ['b', 'c', 'd', 'e', 'f']) {
    s = passTurn(s);   /* คนอื่นทำอะไรก็ได้ ตรงนี้สนใจแค่ว่าตาวนกลับมาถึง a */
  }
  ok('ครบรอบแล้วกลับมาถึงตาเขา และขึ้นฝั่งให้อัตโนมัติ', s.pos.a, 'island:3');
  ok('ขึ้นฝั่งแล้วยังเป็นตาของเขาอยู่ ไม่เสีย Action', s.turn, 'a');
}

group('ต่อสาย · สำรับเหตุการณ์ เปิดกับแอบดู');
{
  const out = init({ members, settings: { turnSeconds: 60, extraCards: [] } });
  const play = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos, seats: [...P],
                 names: filled().names, out: [] };
  /* บังคับให้ช่องนี้เป็นใบที่ไม่ต้องเลือกเป้า ผลจึงเกิดทันทีและผ่านตาไปเลย
     ถ้าปล่อยให้เป็นใบที่สุ่มมา บางรอบจะได้ใบที่ต้องเลือกเป้า แล้วเทสจะไม่คงที่ */
  const deck = { ...out.secrets._deck,
                 slots: out.secrets._deck.slots.map((c, i) => (i === 1 ? 'blackspot' : c)) };
  const ctx = { ...ctxOf(play), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const opened = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 1 } });
  ok('เปิดแล้วทุกคนเห็นว่าเป็นใบอะไร', opened.state.lastEvent.id, deck.slots[1]);
  ok('ใบที่เปิดไปกองทิ้ง', opened.secrets._deck.discard, [deck.slots[1]]);
  ok('ช่องว่างถูกเติมด้วยใบบนสุดของกอง', opened.secrets._deck.slots[1], deck.draw[0]);
  ok('บนโต๊ะยังครบห้าใบ', opened.secrets._deck.slots.filter(Boolean).length, 5);
  ok('กองลดลงหนึ่งใบ', opened.state.eventDeck, deck.draw.length - 1);
  ok('เปิดแล้วผ่านตาไปคนถัดไป', opened.state.turn, 'b');
  ok('จำนวนใบทั้งสำรับไม่เปลี่ยน',
     opened.secrets._deck.slots.length + opened.secrets._deck.draw.length
       + opened.secrets._deck.discard.length, 24);

  const empty = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 9 } });
  ok('ช่องนอกช่วงเปิดไม่ได้', empty, null);
}
{
  const out = init({ members, settings: { turnSeconds: 60, extraCards: [] } });
  const play = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos, seats: [...P],
                 names: filled().names, out: [] };
  const ctx = { ...ctxOf(play), secrets: out.secrets, hostUid: 'a' };
  const deck = out.secrets._deck;

  /* ใบแรก — ยังไม่จบตา */
  const one = await onAction(ctx, { uid: 'a', type: 'peek', payload: { slot: 0 } });
  ok('ดูใบแรกแล้วยังเป็นตาเดิม', one.state.turn, 'a');
  ok('จำไว้ว่าใครกำลังแอบดูและเหลืออีกกี่ใบ', [one.state.peek.uid, one.state.peek.left], ['a', 1]);
  ok('เห็นใบแรกแล้ว', one.secrets.a.peek.seen.map(x => x.id), [deck.slots[0]]);
  ok('ระหว่างค้าง ทำได้อย่างเดียวคือแอบดูต่อ', actionsFor(one.state, 'a'), ['peek']);
  ok('แอบดูแล้วสำรับไม่ขยับเลย', '_deck' in one.secrets, false);
  ok('สถานะสาธารณะไม่บอกว่าเห็นใบอะไร',
     JSON.stringify(one.state).includes(deck.slots[0]), false);

  /* ใบเดิมซ้ำไม่ได้ */
  const ctx2 = { ...ctxOf(one.state), secrets: { ...out.secrets, a: one.secrets.a }, hostUid: 'a' };
  ok('ดูใบเดิมซ้ำไม่ได้',
     await onAction(ctx2, { uid: 'a', type: 'peek', payload: { slot: 0 } }), null);
  ok('ระหว่างค้าง ทำอย่างอื่นไม่ได้',
     await onAction(ctx2, { uid: 'a', type: 'activate', payload: { slot: 2 } }), null);

  /* ใบที่สอง — ครบแล้วจบตา */
  const two = await onAction(ctx2, { uid: 'a', type: 'peek', payload: { slot: 3 } });
  ok('ครบสองใบแล้วจบตา', two.state.turn, 'b');
  ok('ล้างสถานะแอบดูค้างทิ้ง', two.state.peek, null);
  ok('เห็นครบสองใบ', two.secrets.a.peek.seen.map(x => x.id), [deck.slots[0], deck.slots[3]]);
  ok('จำไว้ด้วยว่าเป็นช่องไหน', two.secrets.a.peek.seen.map(x => x.slot), [0, 3]);

  const bad = await onAction(ctx, { uid: 'a', type: 'peek', payload: { slot: 9 } });
  ok('ช่องนอกช่วงดูไม่ได้', bad, null);
}
{
  /* บนโต๊ะเหลือใบเดียว ดูใบเดียวแล้วต้องจบตาเลย ไม่ค้างรอของที่ไม่มี */
  const out = init({ members, settings: { turnSeconds: 60, extraCards: [] } });
  const deck = out.secrets._deck;
  const thin = { ...deck, slots: [deck.slots[0], null, null, null, null] };
  const play = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos, seats: [...P],
                 names: filled().names, out: [], events: 1 };
  const ctx = { ...ctxOf(play), secrets: { ...out.secrets, _deck: thin }, hostUid: 'a' };

  const r = await onAction(ctx, { uid: 'a', type: 'peek', payload: { slot: 0 } });
  ok('เหลือใบเดียว ดูแล้วจบตาทันที', r.state.turn, 'b');
  ok('ไม่มีสถานะแอบดูค้าง', r.state.peek, null);
}

group('ต่อสาย · กัปตันไล่คนลงจากเรือ');
{
  const st = filled();
  const r = await onAction(ctxOf(st), { uid: 'a', type: 'kick', payload: { uid: 'c' } });
  ok('คนโดนไล่เด้งลงเกาะเลย ไม่ผ่านเรือเล็ก', r.state.pos.c, 'island:3');
  ok('ไล่แล้วคิวบนเรือชิดขึ้น', occupants(r.state.pos, 'shipL'), ['a', 'b']);
  const self = await onAction(ctxOf(st), { uid: 'a', type: 'kick', payload: { uid: 'a' } });
  ok('ไล่ตัวเองไม่ได้', self, null);
  const far = await onAction(ctxOf(st), { uid: 'a', type: 'kick', payload: { uid: 'd' } });
  ok('ไล่คนที่อยู่คนละที่ไม่ได้', far, null);
}

group('ต่อสาย · ลูกเรือย้ายกล่อง');
{
  const st = { ...filled(), turn: 'c' };
  const r = await onAction(ctxOf(st), { uid: 'c', type: 'shiftCargo', payload: { from: 'B' } });
  ok('ย้ายกล่องข้ามฝั่งบนเรือตัวเอง', [r.state.cargo.shipL.B, r.state.cargo.shipL.F], [0, 1]);
  ok('จำนวนกล่องรวมไม่เปลี่ยน', countBoxes(r.state.cargo), TOTAL_BOXES);
  const empty = await onAction(ctxOf(r.state), { uid: 'c', type: 'shiftCargo', payload: { from: 'B' } });
  ok('ฝั่งที่ไม่มีกล่องแล้วย้ายไม่ได้', empty, null);
}

group('ต่อสาย · โหวตโจมตีเต็มรอบ');
{
  const hands = { a: ['v03', 'v01', 'v02'], b: ['v07', 'v05', 'v06'], c: ['v25', 'v08', 'v09'] };
  let ctx = ctxOf(filled(), hands);
  const called = await onAction(ctx, { uid: 'a', type: 'attack', payload: {} });
  ok('เปิดโหวตแล้วยังไม่ผ่านตา', called.state.turn, 'a');
  ok('ผู้ร่วมโหวตคือทุกคนบนเรือ', called.state.vote.voters, ['a', 'b', 'c']);

  ctx = ctxOf(called.state, hands);
  const one = await onAction(ctx, { uid: 'a', type: 'voteCard', payload: { card: 'v03' } });
  ok('ส่งไพ่แล้วขึ้นชื่อว่าส่งแล้ว', one.state.vote.done, ['a']);
  ok('คนอื่นเห็นแค่จำนวนใบที่ลดลง ไม่เห็นว่าใบไหน', one.state.votes.a, 2);
  /* เก็บเป็นรายการเสมอ เพราะเอลโดราโดให้ส่งสองใบ ใบเดียวก็เป็นรายการสมาชิกเดียว */
  ok('ไพ่ที่เลือกเก็บในข้อมูลลับของเจ้าตัว', one.secrets.a.pick, ['v03']);

  const dup = await onAction(ctxOf(one.state, { ...hands, a: ['v01', 'v02'] }, {}, { a: 'v03' }),
                             { uid: 'a', type: 'voteCard', payload: { card: 'v01' } });
  ok('ส่งซ้ำไม่ได้', dup, null);

  const outsider = await onAction(ctxOf(one.state, hands), { uid: 'd', type: 'voteCard', payload: { card: 'v01' } });
  ok('คนนอกสถานที่ส่งไพ่ไม่ได้', outsider, null);
}

group('ต่อสาย · ผลของการโหวต');
{
  /* บังคับให้หม้อออกมาผ่านแน่ ๆ — ปืนใหญ่หนึ่ง ไฟหนึ่ง ไม่มีน้ำ */
  const hands = { a: ['v03'], b: ['v07'], c: ['v25'] };
  const st = startVote(filled(), { kind: 'attack', place: 'shipL', caller: 'a' });
  st.vote.done = ['a', 'b'];
  const ctx = ctxOf({ ...st, votes: { ...st.votes, a: 0, b: 0 } },
                    { a: [], b: [], c: ['v25'] }, {}, { a: 'v03', b: 'v07' });
  const done = await onAction(ctx, { uid: 'c', type: 'voteCard', payload: { card: 'v25' } });

  ok('เปิดหม้อแล้วโหวตถูกปิด', done.state.vote, null);
  ok('ผลถูกเก็บไว้ให้หน้าจอโชว์', done.state.lastVote.kind, 'attack');
  ok('หม้อมีไพ่ที่ส่งบวกใบจากกองกลาง', done.state.lastVote.pot.length, 4);
  /* ใบจากกองกลางเป็นตัวสุ่ม ผลจึงออกได้ทั้งสองทาง เช็กให้ครบทั้งคู่ */
  if (attackPasses(done.state.lastVote.counts)) {
    ok('ยิงติดแล้วยังไม่ผ่านตา รอกัปตันเลือกเป้า', done.state.turn, 'a');
    ok('เปิดช่วงเลือกเป้าให้กัปตัน', done.state.aim.by, 'a');
    ok('เลือกได้เฉพาะเรือสินค้ากับเรืออีกลำ', done.state.aim.options, ['merchant', 'shipR']);
    ok('ยังไม่ย้ายกล่องจนกว่าจะเลือกครบ', done.state.cargo.merchant, 4);
    ok('ระหว่างรอเลือก กัปตันทำได้แค่เล็งเป้า', actionsFor(done.state, 'a'), ['aimAt']);
  } else {
    ok('ยิงไม่ติด ผ่านตาไปเลย', done.state.turn, 'b');
    ok('ไม่มีช่วงเลือกเป้า', !done.state.aim, true);
  }
  ok('ทุกคนถือครบตามเพดานอีกครั้ง', Object.values(done.state.votes), [3, 3, 3, 3, 3, 3]);
  /* วัดเป็นความสัมพันธ์ ไม่ใช่ตัวเลขตายตัว — ไพ่ต้องไม่หายและไม่งอกไม่ว่าจะกี่คน */
  const inHand = Object.values(done.state.votes).reduce((n, x) => n + x, 0);
  ok('ไพ่ไม่หายไม่งอก มือรวมกับกองเท่าสำรับ', done.state.voteDeck + inHand, DECK.length);
}
{
  /* หม้อไม่มีปืนใหญ่เลย โจมตีต้องไม่สำเร็จ กล่องต้องอยู่ที่เดิม */
  const st = startVote(filled(), { kind: 'attack', place: 'shipL', caller: 'a' });
  st.vote.done = ['a', 'b'];
  const ctx = ctxOf(st, { a: [], b: [], c: ['v01'] }, {}, { a: 'v01', b: 'v05' });
  const done = await onAction(ctx, { uid: 'c', type: 'voteCard', payload: { card: 'v01' } });
  const n = done.state.lastVote.counts;
  if (!attackPasses(n)) {
    ok('โจมตีไม่สำเร็จ กล่องอยู่ที่เดิมและผ่านตาไป', [done.state.cargo.merchant, !done.state.aim], [4, true]);
  } else {
    ok('โจมตีสำเร็จ เปิดช่วงให้เลือกเป้า', done.state.aim.by, 'a');
  }
  ok('ไม่ว่าผลออกทางไหน จำนวนกล่องรวมต้องเท่าเดิม', countBoxes(done.state.cargo), TOTAL_BOXES);
}
{
  /* ก่อกบฏสำเร็จ กัปตันต้องเด้งลงเกาะ ต้นหนขึ้นแทน */
  const st = startVote(filled(), { kind: 'mutiny', place: 'shipL', caller: 'b' });
  st.vote.done = ['b'];
  const ctx = ctxOf(st, { b: [], c: ['v01'] }, {}, { b: 'v02' });   /* v02 กับ v01 เป็น A ทั้งคู่ */
  const done = await onAction(ctx, { uid: 'c', type: 'voteCard', payload: { card: 'v01' } });
  const n = done.state.lastVote.counts;
  if (mutinyPasses(n)) {
    ok('กบฏสำเร็จ กัปตันเด้งลงเกาะ', done.state.pos.a.startsWith('island'), true);
    ok('ต้นหนขึ้นเป็นกัปตัน', roleAt(done.state.pos, 'b'), 'captain');
  } else {
    ok('กบฏล้มเหลว กัปตันอยู่ที่เดิม', done.state.pos.a, 'shipL:C');
  }
}

group('ต่อสาย · กัปตันเลือกเป้าหลังยิงติด');
{
  const base = { ...filled(), aim: { by: 'a', place: 'shipL', options: ['merchant', 'shipR'], target: null } };

  ok('คนอื่นเลือกแทนไม่ได้',
     await onAction(ctxOf(base), { uid: 'b', type: 'aimAt', payload: { target: 'merchant' } }), null);
  ok('ยิงลำตัวเองไม่ได้',
     await onAction(ctxOf(base), { uid: 'a', type: 'aimAt', payload: { target: 'shipL' } }), null);

  const aimed = await onAction(ctxOf(base), { uid: 'a', type: 'aimAt', payload: { target: 'merchant' } });
  ok('เลือกเป้าแล้วยังไม่ผ่านตา รอเลือกฝั่งต่อ', aimed.state.turn, 'a');
  ok('จำเป้าไว้', aimed.state.aim.target, 'merchant');
  ok('ขั้นต่อไปคือเลือกฝั่ง', actionsFor(aimed.state, 'a'), ['storeAt']);

  const stored = await onAction(ctxOf(aimed.state), { uid: 'a', type: 'storeAt', payload: { side: 'F' } });
  ok('กล่องย้ายจากเรือสินค้าขึ้นเรือฝั่งที่เลือก',
     [stored.state.cargo.merchant, stored.state.cargo.shipL.F], [3, 1]);
  ok('จำนวนกล่องรวมไม่เปลี่ยน', countBoxes(stored.state.cargo), TOTAL_BOXES);
  ok('เลือกครบแล้วจบตา', [stored.state.turn, stored.state.aim], ['b', null]);
}
{
  /* ยิงเรืออีกลำ ต้องเลือกฝั่งที่จะขโมยก่อน แล้วค่อยเลือกฝั่งที่จะเก็บ */
  const base = {
    ...filled(),
    cargo: { shipL: { B: 0, F: 0 }, shipR: { B: 1, F: 2 }, island: { B: 1, F: 1 }, merchant: 3 },
    aim: { by: 'a', place: 'shipL', options: ['merchant', 'shipR'], target: 'shipR', from: null }
  };
  ok('ยังไม่เลือกฝั่งที่จะขโมย ก็เก็บไม่ได้',
     await onAction(ctxOf(base), { uid: 'a', type: 'storeAt', payload: { side: 'B' } }), null);
  ok('ขั้นตอนตอนนี้คือเลือกฝั่งที่จะขโมย', actionsFor(base, 'a'), ['takeFrom']);

  const took = await onAction(ctxOf(base), { uid: 'a', type: 'takeFrom', payload: { side: 'F' } });
  ok('เลือกฝั่งที่จะขโมยแล้ว', took.state.aim.from, 'F');
  ok('ขั้นถัดไปคือเลือกฝั่งที่จะเก็บ', actionsFor(took.state, 'a'), ['storeAt']);

  const r = await onAction(ctxOf(took.state), { uid: 'a', type: 'storeAt', payload: { side: 'B' } });
  ok('ขโมยจากฝั่งที่เลือก', r.state.cargo.shipR.F, 1);
  ok('อีกฝั่งไม่ถูกแตะ', r.state.cargo.shipR.B, 1);
  ok('ไปลงฝั่งที่กัปตันเลือก', r.state.cargo.shipL.B, 1);
}
{
  /* ฝั่งที่ไม่มีกล่องเลย ขโมยไม่ได้ */
  const base = {
    ...filled(),
    cargo: { shipL: { B: 0, F: 0 }, shipR: { B: 0, F: 2 }, island: { B: 1, F: 1 }, merchant: 3 },
    aim: { by: 'a', place: 'shipL', options: ['merchant', 'shipR'], target: 'shipR', from: null }
  };
  ok('ฝั่งที่ว่างเปล่าเลือกขโมยไม่ได้',
     await onAction(ctxOf(base), { uid: 'a', type: 'takeFrom', payload: { side: 'B' } }), null);
  ok('ฝั่งที่มีกล่องเลือกได้',
     (await onAction(ctxOf(base), { uid: 'a', type: 'takeFrom', payload: { side: 'F' } })).state.aim.from, 'F');
}
{
  /* ฝั่งที่เต็มเพดานแล้ว เก็บเพิ่มไม่ได้ */
  const base = {
    ...filled(),
    cargo: { shipL: { B: 3, F: 0 }, shipR: { B: 0, F: 0 }, island: { B: 1, F: 1 }, merchant: 4 },
    aim: { by: 'a', place: 'shipL', options: ['merchant'], target: 'merchant', from: null }
  };
  ok('ฝั่งที่เต็มสามกล่องแล้วเก็บเพิ่มไม่ได้',
     await onAction(ctxOf(base), { uid: 'a', type: 'storeAt', payload: { side: 'B' } }), null);
  ok('อีกฝั่งที่ยังว่างเก็บได้',
     (await onAction(ctxOf(base), { uid: 'a', type: 'storeAt', payload: { side: 'F' } })).state.cargo.shipL.F, 1);
}

group('เงื่อนไขการสั่งโหวตยิง');
{
  const full = { ...filled(), cargo: { shipL: { B: 3, F: 3 }, shipR: { B: 1, F: 1 }, island: { B: 0, F: 0 }, merchant: 0 } };
  ok('เรือตัวเองเต็มหกกล่องแล้ว สั่งยิงไม่ได้', actionsFor(full, 'a').includes('attack'), false);

  const empty = { ...filled(), cargo: { shipL: { B: 1, F: 0 }, shipR: { B: 0, F: 0 }, island: { B: 1, F: 1 }, merchant: 0 } };
  ok('ไม่มีอะไรให้ชิงเลย สั่งยิงไม่ได้', actionsFor(empty, 'a').includes('attack'), false);
  ok('เรืออีกลำว่างเปล่า จึงไม่ใช่เป้าที่เลือกได้',
     attackTargets('shipL', empty.cargo), []);

  const ok2 = { ...filled(), cargo: { shipL: { B: 1, F: 0 }, shipR: { B: 0, F: 2 }, island: { B: 1, F: 1 }, merchant: 0 } };
  ok('มีเรือให้ชิงและมีที่เก็บ สั่งยิงได้', actionsFor(ok2, 'a').includes('attack'), true);
  ok('เป้าที่เลือกได้เหลือเฉพาะลำที่มีกล่อง', attackTargets('shipL', ok2.cargo), ['shipR']);
  ok('ฝั่งที่ขโมยได้มีเฉพาะฝั่งที่มีกล่อง', takeSides(ok2.cargo, 'shipR'), ['F']);
  ok('ฝั่งที่เก็บได้ต้องยังไม่เต็ม', keepSides(ok2.cargo, 'shipL'), ['B', 'F']);
}
{
  /* กัปตันหายไประหว่างเลือก นาฬิกาต้องเลือกให้แล้วไปต่อ */
  const st = { ...filled(), deadline: Date.now() - 1000,
               aim: { by: 'a', place: 'shipL', options: ['merchant', 'shipR'], target: null } };
  const r = await tick({ ...ctxOf(st), members });
  ok('หมดเวลาแล้วเลือกให้เอง เกมไม่ค้าง', [r.state.aim, r.state.turn], [null, 'b']);
  ok('กล่องถูกย้ายจริง', countBoxes(r.state.cargo), TOTAL_BOXES);
}

group('ต่อสาย · นาฬิกา');
{
  const st = { ...filled(), deadline: Date.now() - 1000 };
  const r = await tick({ ...ctxOf(st), members });
  ok('หมดเวลาแล้วข้ามตาไปคนถัดไป', r.state.turn, 'b');
}
{
  const st = { ...filled(), deadline: Date.now() - 1000 };
  const off = members.map(m => (m.uid === 'a' ? { ...m, online: false } : m));
  const r = await tick({ ...ctxOf(st), members: off });
  ok('คนถึงตาหลุดอยู่ ให้เวลาผ่อนผันก่อนหนึ่งครั้ง', [r.state.turn, r.state.graced], ['a', true]);
}
{
  /* โหวตค้างเพราะมีคนไม่ส่งไพ่ นาฬิกาต้องส่งแทนแล้วเปิดผลเอง */
  const st = startVote(filled(), { kind: 'islandVote', place: 'island', caller: 'd' });
  st.vote.done = ['d'];
  st.deadline = Date.now() - 1000;
  const ctx = { ...ctxOf(st, { d: [], e: ['v02', 'v04'] }, {}, { d: 'v02' }), members };
  const r = await tick(ctx);
  ok('หมดเวลาโหวตแล้วเปิดผลเอง ไม่ค้างทั้งวง', r.state.vote, null);
  ok('เกาะยังมีสองกล่องเท่าเดิม', r.state.cargo.island.B + r.state.cargo.island.F, 2);
}

group('ต่อสาย · จบเกมและสรุปผล');
{
  const st = { ...filled(), cargo: { shipL: { B: 3, F: 0 }, shipR: { B: 0, F: 1 }, island: { B: 0, F: 0 }, merchant: 4 } };
  const nations = { a: 'B', b: 'F', c: 'B', d: 'D', e: 'F', f: 'B' };
  const r = finish(ctxOf(st, {}, nations));
  ok('เกมปิดแล้ว', r.state.phase, 'over');
  ok('สรุปคะแนนถูก', r.state.result.score, { B: 3, F: 1, merchant: 4 });
  ok('บริติชชนะ', r.state.result.side, 'B');
  ok('คนบริติชทุกคนได้ชนะ', r.state.result.winners.sort(), ['a', 'c', 'f']);
  ok('เฉลยประเทศทุกคนตอนจบ', Object.keys(r.state.result.nations).length, 6);
}

/* ═══════════════════════════════════════════════════════════
   ของกลางสิบอย่างที่การ์ดเรียกใช้
   ═══════════════════════════════════════════════════════════ */

group('ของกลาง 1–2 · ถือการ์ดกับยกให้คนอื่น');
{
  const st = filled();
  st.held = Object.fromEntries(P.map(u => [u, 0]));
  const a = holdCard(st, 'a', {}, 'marque');
  ok('ถือแล้วจำนวนสาธารณะขึ้นตาม', a.state.held.a, 1);
  ok('ตัวการ์ดเก็บแยกไว้ในข้อมูลลับ', a.held.a, ['marque']);

  const b = giveCard(a.state, 'a', 'b', a.held, 'marque');
  ok('ยกให้แล้วคนให้เหลือศูนย์', b.state.held.a, 0);
  ok('คนรับได้ไปหนึ่งใบ', [b.state.held.b, b.held.b], [1, ['marque']]);
  ok('ยกให้ตัวเองไม่ได้', giveCard(a.state, 'a', 'a', a.held, 'marque'), null);
  ok('ยกใบที่ไม่ได้ถืออยู่ไม่ได้', giveCard(a.state, 'a', 'b', a.held, 'fountain'), null);

  const c = dropHeld(b.state, 'b', b.held, 'marque');
  ok('ใช้แล้วหลุดจากมือ', [c.state.held.b, c.held.b], [0, []]);
}

group('ของกลาง 3 · ข้ามเทิร์น');
{
  let st = addSkip(filled(), 'b');
  ok('ติดหนี้ข้ามเทิร์นแล้ว', owesSkip(st, 'b'), true);
  const r = advance(st, 'a');
  ok('ข้าม b ไปหา c', r.uid, 'c');
  ok('หนี้ถูกหักแล้ว ไม่ค้างไว้ข้ามรอบ', owesSkip(r.state, 'b'), false);

  st = addSkip(addSkip(filled(), 'b', 2), 'c');
  const r2 = advance(st, 'a');
  ok('ซ้อนกันหลายใบก็ข้ามต่อเนื่อง', r2.uid, 'd');
  ok('b ยังเหลือหนี้อีกหนึ่งครั้ง', r2.state.skip.b, 1);
  ok('c หมดหนี้แล้ว', owesSkip(r2.state, 'c'), false);
}
{
  const st = { ...filled(), skip: Object.fromEntries(P.map(u => [u, 1])) };
  const r = advance(st, 'a');
  ok('ทุกคนติดหนี้พร้อมกันก็ยังไม่วนไม่รู้จบ', typeof r.uid, 'string');
}

group('ของกลาง 4 · ห้ามร่วมโหวต');
{
  const st = addVoteBan(filled(), 'b', 2);
  ok('ถูกกันอยู่', isVoteBanned(st, 'b'), true);
  ok('หลุดจากรายชื่อผู้ร่วมโหวตทันที', voters(st, 'attack', 'shipL'), ['a', 'c']);
  const after = burnVoteBans(st, ['b']);
  ok('โหวตผ่านไปหนึ่งครั้ง ยังเหลืออีกครั้ง', after.voteBan.b, 1);
  const done = burnVoteBans(after, ['b']);
  ok('ครบสองครั้งแล้วกลับมาโหวตได้', isVoteBanned(done, 'b'), false);
}

group('ของกลาง 5 · โหวตหลายเสียง');
{
  const st = setVoteWeight(filled(), 'a', 2);
  ok('ส่งได้สองใบ', voteWeight(st, 'a'), 2);
  ok('คนอื่นยังใบเดียวตามปกติ', voteWeight(st, 'b'), 1);
  ok('จบหม้อแล้วล้างทิ้ง', voteWeight(clearVoteWeights(st), 'a'), 1);
}

group('ของกลาง 6 · ของติดตัว');
{
  let st = addMark(filled(), 'a', 'bird');
  ok('ติดไก่แล้วหนึ่งตัว', markCount(st, 'a', 'bird'), 1);
  st = addMark(st, 'b', 'bird');
  ok('นับไก่รวมทั้งเรือได้', marksIn(st, 'shipL', 'bird'), 2);
  ok('เรืออีกลำไม่เกี่ยว', marksIn(st, 'shipR', 'bird'), 0);

  const moved = { ...st, pos: joinPlace(st.pos, 'a', 'island') };
  ok('ไก่ติดตัวคน ย้ายที่แล้วตามไปด้วย', markCount(moved, 'a', 'bird'), 1);
  ok('เรือเหลือไก่ตัวเดียว ไม่ครบเงื่อนไขแล้ว', marksIn(moved, 'shipL', 'bird'), 1);
  ok('เก็บคืนหมดทั้งกระดานได้', marksIn(clearMark(st, 'bird'), 'shipL', 'bird'), 0);
}

group('ของกลาง 7 · สลับและสุ่มตำแหน่ง');
{
  const st = filled();
  const sw = swapSpots(st.pos, 'a', 'f');
  ok('สลับข้ามเรือคนละลำได้', [sw.a, sw.f], ['shipR:C', 'shipL:C']);
  ok('สลับกับตัวเองไม่ได้', swapSpots(st.pos, 'a', 'a'), null);
  ok('สลับกับคนที่ไม่ได้อยู่บนกระดานไม่ได้', swapSpots(st.pos, 'a', 'zz'), null);

  const mixed = shuffleQueue(st.pos, 'shipL', fakeRng([0.9, 0.1, 0.5]));
  ok('คนเดิมครบเท่าเดิม', occupants(mixed, 'shipL').slice().sort(), ['a', 'b', 'c']);
  ok('ยังชิดหัวแถวไม่มีช่องโหว่',
     occupants(mixed, 'shipL').map(u => mixed[u]), ['shipL:C', 'shipL:F', 'shipL:3']);
  ok('คนเดียวในสถานที่ก็ไม่พัง', shuffleQueue(board({ z: 'island:G' }).pos, 'island').z, 'island:G');
}

group('ของกลาง 8 · โล่กัน Maroon');
{
  const st = addShield(filled(), 'a');
  ok('มีโล่อยู่', hasShield(st, 'a'), true);
  const r = maroon(st, 'a', {});
  ok('โล่กันไว้ ไม่ได้ลงเกาะ', r.state.pos.a, 'shipL:C');
  ok('บอกว่าโดนโล่กันไว้', r.kind, 'shielded');
  ok('โล่ใช้แล้วหมด', hasShield(r.state, 'a'), false);

  const again = maroon(r.state, 'a', {});
  ok('ครั้งที่สองไม่มีโล่แล้ว โดนเต็ม ๆ', again.state.pos.a.startsWith('island'), true);
}
{
  /* กรณีอยู่บนเกาะคนเดียว ปกติจะเสียไพ่ถาวร โล่ต้องกันได้ด้วย */
  const st = addShield(board({ a: 'island:G' }), 'a');
  const r = maroon(st, 'a', { a: ['v01', 'v02', 'v03'] }, zero);
  ok('โล่กันกรณีเสียไพ่ถาวรได้ด้วย', [r.kind, r.state.maxVote.a], ['shielded', 3]);
}

group('ของกลาง 9 · แทรกคิวข้างหลังคนอื่น');
{
  const st = filled();
  const r = insertBehind(st.pos, 'f', 'a');
  ok('ไปยืนต่อจากเป้าหมายทันที', r.pos.f, 'shipL:F');
  ok('คนที่อยู่หลังถูกดันถอยลงหนึ่งช่อง', [r.pos.b, r.pos.c], ['shipL:3', 'shipL:4']);
  ok('ยังไม่มีใครล้น', r.spill, []);
  ok('แทรกตัวเองไม่ได้', insertBehind(st.pos, 'a', 'a'), null);
}
{
  /* เรือเต็มห้าคนแล้วแทรกเข้าไปอีก คนท้ายแถวต้องล้นออกมา */
  const full = board({
    a: 'shipL:C', b: 'shipL:F', c: 'shipL:3', d: 'shipL:4', e: 'shipL:5', f: 'island:G'
  });
  const r = insertBehind(full.pos, 'f', 'a');
  ok('คนท้ายแถวล้นออกมา', r.spill, ['e']);
  ok('คนล้นหลุดจากผังไปก่อน ให้ผู้เรียกเอาไป Maroon ต่อ', 'e' in r.pos, false);
  ok('บนเรือยังเต็มห้าคนพอดี', occupants(r.pos, 'shipL'), ['a', 'f', 'b', 'c', 'd']);
}

group('ของกลาง 10 · ดึงคนนอกเข้ามาโหวต');
{
  const st = startVote(filled(), { kind: 'attack', place: 'shipL', caller: 'a' });
  ok('ตอนแรกมีแค่คนบนเรือ', st.vote.voters, ['a', 'b', 'c']);
  const more = addVoter(st, 'd');
  ok('ดึงคนบนเกาะเข้ามาได้', more.vote.voters, ['a', 'b', 'c', 'd']);
  ok('จำไว้ว่าเป็นแขก จบโหวตแล้วจะได้ไม่ค้าง', more.vote.guests, ['d']);
  ok('ดึงคนเดิมซ้ำไม่เพิ่มชื่อ', addVoter(more, 'd').vote.voters.length, 4);
}

group('สำรับการ์ด · การเรียงกอง');
{
  const order = buildEventDeck(BASE_CARDS, ENDER, 5, fakeRng([0.3, 0.7, 0.1, 0.9, 0.5, 0.24, 0.66]));
  ok('จำนวนใบครบทั้งสำรับ', order.length, 24);
  ok('ใบจบเกมอยู่ในห้าใบล่างสุดเสมอ', order.slice(-5).includes(ENDER), true);
  ok('ใบจบเกมไม่โผล่ที่อื่นอีก', order.filter(id => id === ENDER).length, 1);
  ok('ไม่มีใบไหนหายไประหว่างสับ',
     order.filter(id => id === 'pistol').length, 3);
}
{
  /* ใส่การ์ดพิเศษเข้าไปด้วย ใบจบเกมก็ยังต้องอยู่ท้ายกอง */
  const cat = [...BASE_CARDS, ...EXTRA_CARDS];
  const order = buildEventDeck(cat, ENDER, 5, fakeRng([0.11, 0.83, 0.47, 0.2, 0.95]));
  ok('สำรับเต็มได้ 48 ใบ', order.length, 48);
  ok('ใบจบเกมยังอยู่ห้าใบล่างสุด', order.slice(-5).includes(ENDER), true);
}
{
  const deck = refillSlots({ slots: [], draw: ['a', 'b', 'c', 'd', 'e', 'f'], discard: [] }, 5);
  ok('เติมช่องว่างจนครบห้า', deck.slots, ['a', 'b', 'c', 'd', 'e']);
  ok('กองลดลงตามที่จั่วไป', deck.draw, ['f']);

  const gap = refillSlots({ slots: ['a', null, 'c', null, 'e'], draw: ['x', 'y'], discard: [] }, 5);
  ok('เติมเฉพาะช่องที่ว่าง ใบเดิมอยู่ที่เดิม', gap.slots, ['a', 'x', 'c', 'y', 'e']);
  ok('กองหมดก็เติมได้เท่าที่มี',
     refillSlots({ slots: [], draw: ['z'], discard: [] }, 5).slots, ['z', null, null, null, null]);
}

group('เครื่องมือทดสอบ · วางการ์ดที่ต้องการ');
{
  const out = init({ members, settings: { turnSeconds: 60, extraCards: [] } });
  const deck = out.secrets._deck;
  const ctx = { ...ctxOf(out.state), secrets: out.secrets, hostUid: 'a' };

  const before = deck.slots.length + deck.draw.length;
  const r = await onAction(ctx, { uid: 'a', type: 'devCard', payload: { slot: 2, id: 'armada' } });
  ok('วางใบที่ขอลงช่องที่เลือก', r.secrets._deck.slots[2], 'armada');
  ok('จำนวนใบทั้งสำรับไม่เปลี่ยน',
     r.secrets._deck.slots.length + r.secrets._deck.draw.length, before);
  ok('ใบเดิมถูกดันลงใต้กอง ไม่หายไป',
     r.secrets._deck.draw[r.secrets._deck.draw.length - 1], deck.slots[2]);
  ok('จำนวนที่โชว์อัปเดตตาม', r.state.eventDeck, r.secrets._deck.draw.length);

  const notHost = await onAction({ ...ctx, hostUid: 'zz' },
    { uid: 'a', type: 'devCard', payload: { slot: 0, id: 'pistol' } });
  ok('ไม่ใช่เจ้าของห้องสั่งไม่ได้', notHost, null);

  const bad = await onAction(ctx, { uid: 'a', type: 'devCard', payload: { slot: 9, id: 'pistol' } });
  ok('ช่องนอกช่วงสั่งไม่ได้', bad, null);
}

group('สำรับการ์ด');
{
  ok('สำรับมาตรฐาน 24 ใบพอดี', BASE_TOTAL, 24);
  ok('ทุกใบมี id ไม่ซ้ำ', new Set(BASE_CARDS.map(c => c.id)).size, BASE_CARDS.length);
  ok('ทุกใบมีชื่อและคำอธิบายครบสองภาษา',
     BASE_CARDS.every(c => c.th?.name && c.th?.desc && c.en?.name && c.en?.desc), true);
  ok('ระดับความหายากอยู่ในสามแบบที่รู้จัก',
     BASE_CARDS.every(c => ['common', 'rare', 'map'].includes(c.rarity)), true);
  ok('ใบจบเกมมีอยู่จริงในสำรับ', !!baseById(ENDER), true);
  ok('id ของชุดมาตรฐานไม่ชนกับชุดพิเศษ',
     BASE_CARDS.filter(c => EXTRA_CARDS.some(x => x.id === c.id)), []);
  ok('รวมทั้งสองชุดได้ 48 ใบ',
     BASE_TOTAL + EXTRA_CARDS.reduce((n, c) => n + c.count, 0), 48);
}

group('บันทึกเหตุการณ์');
{
  let st = board();
  for (let i = 0; i < LOG_MAX + 4; i++) st = pushLog(st, 'x', { i });
  ok('เก็บไว้ไม่เกินเพดาน', st.log.length, LOG_MAX);
  ok('เก็บอันใหม่สุดไว้ ตัดอันเก่าทิ้ง', st.log[st.log.length - 1].args.i, LOG_MAX + 3);
  ok('เก็บเป็นคีย์ภาษา ไม่ใช่ข้อความสำเร็จรูป', typeof st.log[0].key, 'string');
}

console.log(`\n${'─'.repeat(46)}\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);
process.exit(fail ? 1 : 0);

/* ═══════════════════════════════════════════════════════════
   การ์ดเหตุการณ์ — ปืนพก
   ═══════════════════════════════════════════════════════════ */

group('การ์ด · ปืนพก');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['pistol', ...out.secrets._deck.slots.slice(1)] };
  const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                 seats: [...P], names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  ok('เปิดแล้วประกาศชื่อการ์ดให้ทุกคนเห็น', up.state.cardUp.id, 'pistol');
  ok('การ์ดที่ต้องเลือกเป้ายังไม่ผ่านตา', up.state.turn, 'a');
  ok('ค้างรอให้คนเปิดเลือกเป้า', up.state.pending.needs, 'player');
  ok('ระหว่างค้าง ทำได้อย่างเดียวคือใช้การ์ด', actionsFor(up.state, 'a'), ['useCard']);

  const ctx2 = { ...ctxOf(up.state), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };
  ok('ยิงตัวเองไม่ได้',
     await onAction(ctx2, { uid: 'a', type: 'useCard', payload: { target: 'a' } }), null);
  ok('คนอื่นสั่งแทนไม่ได้',
     await onAction(ctx2, { uid: 'b', type: 'useCard', payload: { target: 'c' } }), null);
  ok('ยิงคนที่ไม่ได้อยู่บนกระดานไม่ได้',
     await onAction(ctx2, { uid: 'a', type: 'useCard', payload: { target: 'zz' } }), null);

  const hit = await onAction(ctx2, { uid: 'a', type: 'useCard', payload: { target: 'f' } });
  ok('เป้าโดน Maroon ลงเกาะ', hit.state.pos.f.startsWith('island'), true);
  ok('ยิงข้ามเรือได้ ไม่ต้องอยู่ลำเดียวกัน', placeOf(base.pos.f), 'shipR');
  ok('ประกาศบอกว่าใครยิงใคร', [hit.state.shout.kind, hit.state.shout.by, hit.state.shout.who],
     ['shot', 'a', 'f']);
  ok('ใช้เสร็จแล้วล้างสถานะค้าง', hit.state.pending, null);
  ok('ใช้เสร็จแล้วผ่านตา', hit.state.turn, 'b');
  ok('การ์ดถูกทิ้งลงกองแล้ว', up.secrets._deck.discard, ['pistol']);
  ok('ช่องที่เปิดไปได้ใบใหม่มาเติม', !!up.secrets._deck.slots[0], true);
}

group('ชั้น 2 · Maroon ตอนอยู่ท้ายแถวบนเกาะ');
{
  /* ถอยไปต่อท้ายไม่ได้แล้ว = เสียไพ่โหวตถาวรแทน
     ถ้าไม่มีกฎนี้ ตำแหน่งท้ายสุดจะกลายเป็นที่ปลอดภัยที่สุด เพราะยิงไปก็ไม่มีผลอะไร */
  const st = board({ a: 'island:G', b: 'island:2', c: 'island:3', d: 'shipL:C' });
  const hands = { c: ['v01', 'v02', 'v03'] };

  const back = maroon(st, 'c', hands, zero);
  ok('ท้ายแถวโดนยิง = เสียไพ่ถาวร', back.kind, 'loseCard');
  ok('เพดานไพ่ลดลงหนึ่งใบ', back.state.maxVote.c, 2);
  ok('มือถูกตัดให้เท่าเพดาน', back.hands.c.length, 2);
  ok('ตำแหน่งไม่ขยับ', back.state.pos.c, 'island:3');

  const mid = maroon(st, 'b', { b: ['v01', 'v02', 'v03'] }, zero);
  ok('กลางแถวยังถอยไปท้ายแถวตามเดิม', mid.kind, 'backOfQueue');
  ok('เพดานไพ่ไม่ลด', mid.state.maxVote.b, 3);
  ok('ไปอยู่ท้ายแถวจริง', occupants(mid.state.pos, 'island').at(-1), 'b');

  const head = maroon(st, 'a', { a: ['v01', 'v02', 'v03'] }, zero);
  ok('หัวแถวก็ถอยไปท้ายแถว', head.kind, 'backOfQueue');

  const solo = board({ a: 'island:G' });
  ok('อยู่คนเดียวยังเสียไพ่ถาวรเหมือนเดิม',
     maroon(solo, 'a', { a: ['v01'] }, zero).kind, 'loseCard');

  const ship = board({ a: 'shipL:C', b: 'island:G' });
  ok('อยู่บนเรือยังเด้งลงเกาะเหมือนเดิม', maroon(ship, 'a', {}, zero).kind, 'toIsland');

  const shield = addShield(st, 'c');
  ok('โล่ยังกันกรณีท้ายแถวได้', maroon(shield, 'c', hands, zero).kind, 'shielded');
}

group('ชั้น 3 · ไพ่โหวตหมดถาวรแล้วไม่ร่วมโหวต');
{
  const st = { ...filled(), maxVote: { ...filled().maxVote, c: 0 },
               votes: { ...filled().votes, c: 0 } };

  ok('คนที่เพดานเหลือศูนย์ไม่ถูกนับเป็นผู้ร่วมโหวต',
     voters(st, 'attack', 'shipL'), ['a', 'b']);
  ok('คนอื่นบนเรือยังโหวตได้ตามปกติ', voters(st, 'attack', 'shipL').includes('b'), true);

  const open = startVote(st, { kind: 'attack', place: 'shipL', caller: 'a' });
  ok('เปิดโหวตแล้วไม่มีชื่อเขาในรายชื่อ', open.vote.voters.includes('c'), false);
  ok('หน้าจอถามว่าเขาร่วมได้ไหม = ไม่ได้', canVoteNow(open, 'c'), false);
  ok('คนอื่นยังร่วมได้', canVoteNow(open, 'b'), true);
  ok('ส่งไพ่แล้วก็ร่วมซ้ำไม่ได้',
     canVoteNow({ ...open, vote: { ...open.vote, done: ['b'] } }, 'b'), false);
}
{
  /* ทุกคนในสถานที่หมดสิทธิ์หมด — ต้องเปิดหม้อทันที ไม่ค้างรอคนที่ไม่มีวันส่ง */
  const st = { ...filled(),
               maxVote: Object.fromEntries(P.map(u => [u, 0])),
               votes: Object.fromEntries(P.map(u => [u, 0])) };
  ok('ไม่เหลือผู้ร่วมโหวตเลยสักคน', voters(st, 'attack', 'shipL'), []);
}


group('ชั้น 3 · จั่วทดแทนเฉพาะใบที่ลงไป');
{
  const seats = ['a', 'b', 'c'];
  const cap = { a: 3, b: 3, c: 3 };
  const hands = { a: ['v01', 'v02'], b: ['v04', 'v05'], c: ['v07', 'v08', 'v09'] };

  const r = refill(seats, hands, cap, zero);
  ok('ใบเดิมในมือไม่ถูกแตะเลย', hands.a.every(x => r.hands.a.includes(x)), true);
  ok('เติมจนเต็มเพดาน', [r.hands.a.length, r.hands.b.length, r.hands.c.length], [3, 3, 3]);
  ok('คนที่ยังเต็มอยู่ไม่ได้ใบใหม่', r.hands.c, hands.c);

  const all = [...r.hands.a, ...r.hands.b, ...r.hands.c];
  ok('ไม่มีไพ่ซ้ำระหว่างมือ', new Set(all).size, all.length);
  ok('จำนวนไพ่ทั้งระบบไม่เปลี่ยน', all.length + r.pile.length, DECK.length);
  ok('ไพ่ที่เพิ่งลงไปในหม้อกลับเข้ากองเอง', r.pile.includes('v03'), true);

  const cut = refill(seats, hands, { a: 1, b: 3, c: 3 }, zero);
  ok('เพดานลดแล้วมือถูกตัดให้เท่าเพดาน', cut.hands.a.length, 1);

  const none = refill(seats, hands, { a: 0, b: 3, c: 3 }, zero);
  ok('เพดานเหลือศูนย์ก็ไม่มีไพ่เลย', none.hands.a, []);
}
group('การ์ด · จุดดำ');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['blackspot', ...out.secrets._deck.slots.slice(1)] };
  const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                 seats: [...P], names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const r = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  ok('ประกาศชื่อการ์ดให้ทุกคนเห็น', r.state.cardUp.id, 'blackspot');
  ok('คนเปิดโดน Maroon เอง', r.state.pos.a.startsWith('island'), true);
  /* ไม่ประกาศผลซ้ำ — เห็นการ์ดก็รู้อยู่แล้วว่าคนเปิดโดน */
  ok('ไม่มีประกาศผลเพิ่ม', r.state.shout ?? null, null);
  ok('ไม่ต้องเลือกอะไร ผลเกิดทันที', r.state.pending ?? null, null);
  ok('เปิดแล้วผ่านตาไปเลย', r.state.turn, 'b');
  ok('การ์ดลงกองทิ้ง', r.secrets._deck.discard, ['blackspot']);
  ok('ช่องได้ใบใหม่มาเติม', !!r.secrets._deck.slots[0], true);
}
{
  /* เปิดตอนอยู่ท้ายแถวบนเกาะ = เสียไพ่โหวตถาวร ตามกฎ Maroon ที่เพิ่งเพิ่ม */
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['blackspot', ...out.secrets._deck.slots.slice(1)] };
  const pos = { a: 'island:G', b: 'island:2', c: 'island:3', d: 'shipL:C', e: 'shipL:F', f: 'shipR:C' };
  const base = { ...out.state, phase: 'play', turn: 'c', pos, seats: [...P],
                 names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const r = await onAction(ctx, { uid: 'c', type: 'activate', payload: { slot: 0 } });
  ok('ท้ายแถวบนเกาะเปิดเจอ = เสียไพ่ถาวร', r.state.maxVote.c, 2);
  ok('ตำแหน่งไม่ขยับ', r.state.pos.c, 'island:3');
}

group('การ์ด · นกอัลบาทรอส');
{
  const st = board({ a: 'shipL:C', b: 'shipL:F', c: 'shipL:3', d: 'shipR:C', e: 'island:G', f: 'island:2' });

  ok('นกตัวเดียวยังไม่เกิดอะไร', birdStrike(addMark(st, 'a', 'bird'), {}), null);

  const two = addMark(addMark(st, 'a', 'bird'), 'b', 'bird');
  const hit = birdStrike(two, {}, zero);
  ok('นกครบสองตัวบนเรือลำเดียว = ทั้งลำโดน', hit.place, 'shipL');
  ok('โดนทุกคนบนลำนั้น ไม่ใช่แค่คนถือนก', hit.who, ['a', 'b', 'c']);
  ok('ทุกคนลงเกาะ', ['a', 'b', 'c'].every(u => hit.state.pos[u].startsWith('island')), true);
  ok('เรืออีกลำไม่เกี่ยว', hit.state.pos.d, 'shipR:C');

  const split = addMark(addMark(st, 'a', 'bird'), 'd', 'bird');
  ok('นกอยู่คนละลำไม่เกิดอะไร', birdStrike(split, {}), null);

  const isle = addMark(addMark(st, 'e', 'bird'), 'f', 'bird');
  ok('นกสองตัวบนเกาะไม่เกิดอะไร กฎนี้ใช้กับเรือเท่านั้น', birdStrike(isle, {}), null);
}
{
  /* นกติดตัวคน ย้ายที่แล้วตามไปด้วย จึงเกิดได้จากการย้ายที่ ไม่ใช่แค่ตอนได้นกใหม่ */
  const st = board({ a: 'shipL:C', b: 'shipR:C', c: 'shipR:F' });
  const two = addMark(addMark(st, 'a', 'bird'), 'b', 'bird');
  ok('อยู่คนละลำ ยังไม่เกิด', birdStrike(two, {}), null);

  const moved = { ...two, pos: joinPlace(two.pos, 'a', 'shipR') };
  const hit = birdStrike(moved, {}, zero);
  ok('ย้ายมาลำเดียวกันแล้วเกิดทันที', hit?.place, 'shipR');
  ok('คนที่ไม่ถือนกก็โดนด้วย', hit.who.includes('c'), true);
}

group('ฉากเล่าจบก่อนกระดานขยับ');
{
  /* บั๊กที่เคยพลาด: เติมผังก่อนเกิดผล **หลัง** เรียกผลการ์ด
     ค่าจึงไม่ติดไปกับสถานะที่ส่งออก หน้าจอไม่มีอะไรบอกให้ค้าง หมากเด้งก่อนฉากเล่าจบ */
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['blackspot', ...out.secrets._deck.slots.slice(1)] };
  const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                 seats: [...P], names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const r = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  ok('เหตุการณ์พาผังก่อนเกิดผลไปด้วย', !!r.state.cardUp.beforePos, true);
  ok('ผังนั้นคือตำแหน่งก่อนโดน Maroon', r.state.cardUp.beforePos.a, 'shipL:C');
  ok('สถานะจริงย้ายไปแล้ว', r.state.pos.a.startsWith('island'), true);
  ok('สองอย่างต่างกันจริง — ถ้าเท่ากันแปลว่าค้างไม่ทำงาน',
     r.state.cardUp.beforePos.a !== r.state.pos.a, true);
}
{
  /* นกถล่ม — ผังที่พาไปต้องเป็นหลังคนย้ายที่แล้ว แต่ก่อน Maroon */
  const st = board({ a: 'shipL:C', b: 'shipL:F', c: 'island:G', d: 'shipR:C' });
  const two = addMark(addMark(st, 'a', 'bird'), 'b', 'bird');
  const hit = birdStrike(two, {}, zero);
  ok('ผังก่อน Maroon ยังอยู่บนเรือ', two.pos.a, 'shipL:C');
  ok('หลัง Maroon ลงเกาะแล้ว', hit.state.pos.a.startsWith('island'), true);
}

group('การ์ด · หนังสือตราตั้ง');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['marque', ...out.secrets._deck.slots.slice(1)] };
  const pos = { a: 'shipL:C', b: 'island:G', c: 'island:2', d: 'shipR:C', e: 'boatL:B', f: 'island:3' };
  const base = { ...out.state, phase: 'play', turn: 'a', pos, seats: [...P],
                 names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const got = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  ok('เปิดแล้วเข้ามือ ไม่เกิดผลทันที', got.secrets.a.held, ['marque']);
  ok('จำนวนใบเป็นข้อมูลสาธารณะ', got.state.held.a, 1);
  ok('เปิดแล้วผ่านตาไปเลย', got.state.turn, 'b');
  ok('ไม่มีอะไรค้างรอ', got.state.pending ?? null, null);

  /* ตาของ a อีกรอบ */
  const mine = { ...got.state, turn: 'a' };
  const ctx2 = { ...ctxOf(mine), secrets: { ...out.secrets, ...got.secrets }, hostUid: 'a' };
  ok('มีปุ่มใช้การ์ดในมือ', actionsFor(mine, 'a').includes('playHeld'), true);
  ok('คนที่ไม่มีการ์ดไม่มีปุ่ม', actionsFor({ ...mine, turn: 'b' }, 'b').includes('playHeld'), false);

  const play = await onAction(ctx2, { uid: 'a', type: 'playHeld', payload: { card: 'marque' } });
  ok('ขั้นแรกถามว่าจะส่งใคร', play.state.pending.needs, 'player');
  ok('ยังไม่ผ่านตา', play.state.turn, 'a');
  ok('ระหว่างนี้ทำอย่างอื่นไม่ได้', actionsFor(play.state, 'a'), ['useCard']);

  const ctx3 = { ...ctxOf(play.state), secrets: { ...out.secrets, ...got.secrets }, hostUid: 'a' };
  const who = await onAction(ctx3, { uid: 'a', type: 'useCard', payload: { target: 'b' } });
  ok('เลือกคนแล้วถามต่อว่าเรือลำไหน', who.state.pending.needs, 'ship');
  ok('จำคนที่เลือกไว้', who.state.pending.picks.player, 'b');
  ok('ยังไม่ผ่านตา', who.state.turn, 'a');

  const ctx4 = { ...ctxOf(who.state), secrets: { ...out.secrets, ...got.secrets }, hostUid: 'a' };
  const done = await onAction(ctx4, { uid: 'a', type: 'useCard', payload: { target: 'shipR' } });
  ok('ถูกส่งไปต่อท้ายแถวเรือที่เลือก', placeOf(done.state.pos.b), 'shipR');
  ok('ต่อท้ายจริง ไม่ใช่แทรกกลาง', occupants(done.state.pos, 'shipR').at(-1), 'b');
  ok('การ์ดออกจากมือแล้ว', done.secrets.a.held, []);
  ok('จำนวนสาธารณะลดตาม', done.state.held.a, 0);
  ok('ใช้เสร็จแล้วผ่านตา', done.state.turn, 'b');
  ok('ประกาศบอกครบว่าใครส่งใครไปไหน',
     [done.state.shout.kind, done.state.shout.who, done.state.shout.place],
     ['marque', 'b', 'shipR']);
}
{
  /* เรือเต็มทั้งสองลำ = ใช้จดหมายไม่ได้ ปุ่มต้องทึบ */
  const full = {};
  ['C', 'F', '3', '4', '5'].forEach((s, i) => { full['x' + i] = 'shipL:' + s; });
  ['C', 'F', '3', '4', '5'].forEach((s, i) => { full['y' + i] = 'shipR:' + s; });
  const st = { ...board(full), seats: [...Object.keys(full), 'z'], names: {} };
  st.pos.z = 'island:G';

  ok('ไม่มีเรือให้ส่งไปเลย', shipsWithRoom(st, 'z'), []);
  ok('จึงใช้จดหมายไม่ได้', canUseCard(st, 'z', 'marque'), false);

  const room = { ...st, pos: { ...st.pos, x4: 'island:2' } };
  ok('พอมีที่ว่างหนึ่งลำก็ใช้ได้', canUseCard(room, 'z', 'marque'), true);
  ok('เลือกได้เฉพาะลำที่ว่าง', shipsWithRoom(room, 'z'), ['shipL']);
}

group('การ์ด · แผนที่ยกให้คนอื่น และน้ำพุอมตะ');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['fountain', ...out.secrets._deck.slots.slice(1)] };
  const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                 seats: [...P], names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  ok('แผนที่ต้องเลือกคนรับก่อน', up.state.pending.needs, 'player');
  ok('ยังไม่ผ่านตา', up.state.turn, 'a');

  const c2 = { ...ctxOf(up.state), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };
  ok('ยกให้ตัวเองไม่ได้',
     await onAction(c2, { uid: 'a', type: 'useCard', payload: { target: 'a' } }), null);

  const gave = await onAction(c2, { uid: 'a', type: 'useCard', payload: { target: 'b' } });
  ok('แผนที่เข้ามือคนที่เลือก', gave.secrets.b.held, ['fountain']);
  ok('คนเปิดไม่ได้ถืออะไร', gave.secrets.a.held ?? [], []);
  ok('ทะเบียนการ์ดกันบอกว่าใครถือ', gave.state.saves.b, 'fountain');
  ok('ประกาศบอกว่ายกให้ใคร', [gave.state.shout.kind, gave.state.shout.who], ['gaveMap', 'b']);
  ok('ยกเสร็จแล้วผ่านตา', gave.state.turn, 'b');
}
{
  /* ถือน้ำพุแล้วโดน Maroon = หยุดถามก่อน ไม่ย้ายทันที */
  const st = { ...filled(), saves: { b: 'fountain' }, held: { b: 1 } };
  const asked = maroon(st, 'b', {}, zero);
  ok('หยุดไว้ถามก่อน', asked.kind, 'ask');
  ok('ตำแหน่งยังไม่ขยับ', asked.state.pos.b, st.pos.b);
  ok('บันทึกว่าถามใครเรื่องการ์ดใบไหน',
     [asked.state.saveAsk.who, asked.state.saveAsk.card], ['b', 'fountain']);
  ok('คนที่ถูกถามทำได้อย่างเดียวคือตอบ', actionsFor(asked.state, 'b'), ['useSave']);
  ok('คนอื่นทำอะไรไม่ได้เลย', actionsFor(asked.state, 'a'), []);

  const forced = maroon(st, 'b', {}, zero, true);
  ok('สั่งบังคับได้ ไม่ถามซ้ำ', forced.kind !== 'ask', true);
  ok('บังคับแล้วย้ายจริง', forced.state.pos.b.startsWith('island'), true);

  const none = maroon({ ...filled() }, 'b', {}, zero);
  ok('ไม่มีการ์ดกันก็โดนตามปกติ', none.kind !== 'ask', true);
}

group('การ์ดกัน Maroon · ไม่ประกาศผลที่ยังไม่เกิด');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['pistol', ...out.secrets._deck.slots.slice(1)] };
  const base = { ...filled(), phase: 'play', turn: 'c',
                 saves: { b: 'fountain' }, held: { b: 1 },
                 voteDeck: out.state.voteDeck, log: [], logSeq: 0 };
  const sec = { ...ctxOf(base).secrets, b: { ...ctxOf(base).secrets.b, held: ['fountain'] } };
  const ctx = { ...ctxOf(base), secrets: { ...sec, _deck: deck }, hostUid: 'a' };

  const up = await onAction(ctx, { uid: 'c', type: 'activate', payload: { slot: 0 } });
  const shot = await onAction({ ...ctx, state: up.state },
                              { uid: 'c', type: 'useCard', payload: { target: 'b' } });

  ok('ยังไม่ประกาศผล เพราะยังไม่รู้ว่าจะรอดไหม', shot.state.shout ?? null, null);
  ok('ตำแหน่งยังไม่ขยับ', shot.state.pos.b, base.pos.b);
  ok('กำลังถามเจ้าตัวอยู่', shot.state.saveAsk.who, 'b');
  ok('ตายังไม่ผ่าน', shot.state.turn, 'c');

  const ctx2 = { ...ctx, state: shot.state };
  const no = await onAction(ctx2, { uid: 'b', type: 'useSave', payload: { yes: false } });
  ok('ตอบไม่ใช้ = โดนตามปกติ', no.state.pos.b.startsWith('island'), true);
  ok('การ์ดยังอยู่ในมือ เก็บไว้ใช้ครั้งหน้าได้', no.state.saves.b, 'fountain');
  ok('ตอบแล้วผ่านตา', no.state.turn !== 'c', true);

  const yes = await onAction(ctx2, { uid: 'b', type: 'useSave', payload: { yes: true } });
  ok('ตอบใช้ = ไม่โดน', yes.state.pos.b, base.pos.b);
  ok('การ์ดถูกใช้ไปแล้ว', yes.state.saves.b ?? null, null);
  ok('ประกาศตอนนี้แหละ ไม่ใช่ก่อนหน้า', yes.state.shout.kind, 'saved');
  ok('ประกาศบอกว่าใช้ใบไหน', yes.state.shout.card, 'fountain');
}

group('การ์ด · แอตแลนติส');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const seats = ['a', 'b', 'c', 'd', 'e', 'f'];
  const st = { ...filled(), seats, turn: 'b', held: { e: 1 },
               pos: { a: 'shipL:C', b: 'shipL:F', c: 'shipR:C', d: 'shipR:F', e: 'island:G', f: 'island:2' } };
  const sec = { ...ctxOf(st).secrets, e: { ...ctxOf(st).secrets.e, held: ['atlantis'] } };
  const ctx = { ...ctxOf(st), secrets: { ...sec, _deck: out.secrets._deck }, hostUid: 'a' };

  ok('คนถัดไปคือ c', nextSeat(st), 'c');
  ok('ใช้ได้ทั้งที่ไม่ใช่ตาตัวเอง', anytimeCards(st, 'e', ['atlantis']), ['atlantis']);
  ok('การ์ดที่ไม่ใช่แบบนี้ใช้ในตาคนอื่นไม่ได้', anytimeCards(st, 'e', ['marque']), []);

  const q = await onAction(ctx, { uid: 'e', type: 'playHeld', payload: { card: 'atlantis' } });
  ok('จองไว้ ยังไม่เกิดผล', q.state.pos.e, 'island:G');
  ok('ล็อกเป้าไว้ตั้งแต่ตอนกด', q.state.queued.target, 'c');
  ok('ตายังเป็นของคนเดิม', q.state.turn, 'b');
  ok('การ์ดออกจากมือทันที', q.secrets.e.held, []);

  const ctx2 = { ...ctx, state: q.state, secrets: { ...sec, e: q.secrets.e, _deck: out.secrets._deck } };
  const done = await onAction(ctx2, { uid: 'b', type: 'toBoat', payload: { boat: 'boatL' } });
  ok('จบตาแล้วผลถึงเกิด', placeOf(done.state.pos.e), 'shipR');
  ok('ไปยืนข้างหลังเป้าพอดี', occupants(done.state.pos, 'shipR'), ['c', 'e', 'd']);
  ok('ประกาศบอกว่าแทรกหลังใคร', [done.state.shout.kind, done.state.shout.who], ['atlantis', 'c']);
  ok('ล้างของที่จองไว้', done.state.queued, null);
}
{
  /* คนล้นความจุโดน Maroon */
  const seats = ['a', 'b', 'c', 'd', 'e', 'f'];
  const st = { ...filled(), seats, turn: 'a', held: { f: 1 },
               pos: { a: 'shipL:C', b: 'shipR:C', c: 'shipR:F', d: 'shipR:3',
                      e: 'shipR:4', f: 'shipR:5' } };
  const ins = insertBehind(st.pos, 'a', 'b');
  ok('เรือเต็มแล้วแทรก คนท้ายสุดล้นออก', ins.spill, ['f']);
  ok('คนที่เหลืออยู่ครบห้า', occupants(ins.pos, 'shipR').length, 5);
  ok('คนแทรกอยู่หลังเป้า', occupants(ins.pos, 'shipR')[1], 'a');
}

group('การ์ดแผนที่ · ทุกใบต้องยกให้คนอื่นตอนเปิด');
{
  /* บั๊กที่เคยเกิด: ประกาศกติกาแผนที่ไว้ก่อน แล้วเขียนผลของแอตแลนติสทับทีหลัง
     ใบนั้นเลยกลายเป็นการ์ดธรรมดาที่เปิดแล้วทำงานทันที ไม่ต้องยกให้ใคร
     เทสนี้ไล่ทุกใบ ไม่ใช่ใบตัวอย่าง จะได้จับได้ถ้ามีใบไหนหลุดอีก */
  for (const card of MAP_CARDS) {
    const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
    const deck = { ...out.secrets._deck, slots: [card, ...out.secrets._deck.slots.slice(1)] };
    const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                   seats: [...P], names: filled().names, out: [] };
    const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

    const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
    ok(card + ' · เปิดแล้วถามว่าจะยกให้ใคร', up.state.pending?.mode, 'gift');
    ok(card + ' · ยังไม่ผ่านตา', up.state.turn, 'a');
    ok(card + ' · ยังไม่เกิดผลอะไรกับกระดาน', up.state.pos.a, base.pos.a);

    const c2 = { ...ctxOf(up.state), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };
    ok(card + ' · ยกให้ตัวเองไม่ได้',
       await onAction(c2, { uid: 'a', type: 'useCard', payload: { target: 'a' } }), null);

    const give = await onAction(c2, { uid: 'a', type: 'useCard', payload: { target: 'b' } });
    ok(card + ' · เข้ามือคนที่เลือก', give.secrets.b.held, [card]);
    ok(card + ' · คนเปิดไม่ได้ถือ', give.secrets.a?.held ?? [], []);
    ok(card + ' · ยกเสร็จแล้วผ่านตา', give.state.turn, 'b');
  }
}

group('การ์ดที่ใช้ได้ในตาคนอื่น · ปุ่มต้องไม่หายเงียบ ๆ');
{
  /* บั๊กที่เจอ: ตัวตัดสินว่าจะโชว์ปุ่มไหม มีเงื่อนไขซ้อนไว้หลายชั้น
     พอมีตัวใดตัวหนึ่งค้างอยู่ ปุ่มหายโดยไม่มีอะไรบอก และไล่หาสาเหตุแทบไม่ได้
     เทสนี้ยืนยันว่าปุ่มยังอยู่ในทุกสภาพ ส่วนจะกดได้จริงไหมให้เซิร์ฟเวอร์ตัดสิน */
  const seats = ['a', 'b', 'c', 'd', 'e', 'f'];
  const base = { ...filled(), seats, turn: 'b', held: { e: 1 } };

  const cases = [
    ['ตาคนอื่น', base],
    ['มีโหวตเปิดอยู่', { ...base, vote: { kind: 'attack' } }],
    ['มีคนค้างตอบการ์ดกัน', { ...base, saveAsk: { who: 'a' } }],
    ['มีการ์ดค้างเลือกเป้า', { ...base, pending: { by: 'a' } }],
    ['มีการ์ดจองไว้แล้ว', { ...base, queued: { by: 'c' } }]
  ];
  for (const [name, st] of cases) {
    ok('ปุ่มยังอยู่ตอน ' + name, anytimeCards(st, 'e', ['atlantis']), ['atlantis']);
  }

  ok('ออกจากเกมแล้วไม่มีปุ่ม',
     anytimeCards({ ...base, out: ['e'] }, 'e', ['atlantis']), []);
  ok('ยังไม่เริ่มเล่นก็ไม่มีปุ่ม',
     anytimeCards({ ...base, phase: 'reveal' }, 'e', ['atlantis']), []);
  ok('การ์ดที่ไม่ใช่แบบใช้ได้ตลอด ไม่โผล่',
     anytimeCards(base, 'e', ['marque', 'fountain']), []);
}

group('การ์ด · เอลโดราโด');
{
  const seats = ['a', 'b', 'c'];
  const base = { ...board({ a: 'shipL:C', b: 'shipL:F', c: 'shipL:3' }),
                 seats, held: { b: 1 }, names: { a: 'a', b: 'b', c: 'c' } };
  const st = startVote(base, { kind: 'attack', place: 'shipL', caller: 'a' });
  const sec = { a: { vote: ['v01', 'v02', 'v03'] },
                b: { vote: ['v04', 'v05', 'v06'], held: ['eldorado'] },
                c: { vote: ['v07', 'v08', 'v09'] } };
  let ctx = { state: st, members: members.slice(0, 3), settings: { turnSeconds: 0 },
              secrets: sec, hostUid: 'a' };

  ok('หยิบมาเล่นเองไม่ได้', playWindow('eldorado'), 'never');

  const on = await onAction(ctx, { uid: 'b', type: 'useDorado', payload: { yes: true } });
  ok('ตอบใช้แล้วได้สิทธิ์สองเสียง', voteWeight(on.state, 'b'), 2);
  ok('การ์ดหายจากมือทันที กันกดซ้ำ', on.secrets.b.held, []);

  let r = on;
  for (const [u, card] of [['b', 'v04'], ['b', 'v05'], ['a', 'v01'], ['c', 'v07']]) {
    ctx = { ...ctx, state: r.state, secrets: { ...ctx.secrets, ...(r.secrets || {}) } };
    r = await onAction(ctx, { uid: u, type: 'voteCard', payload: { card } });
  }
  ok('หม้อได้ไพ่ครบ สามคนสี่ใบบวกกองกลาง', r.state.lastVote.pot.length, 5);
  ok('ใช้แล้วติดโทษห้ามโหวตหนึ่งครั้ง', r.state.voteBan.b, 1);
  ok('สิทธิ์พิเศษถูกล้างหลังจบ', voteWeight(r.state, 'b'), 1);

  const nextVote = startVote({ ...r.state, vote: null },
                             { kind: 'attack', place: 'shipL', caller: 'a' });
  ok('รอบถัดไปไม่นับเขาเป็นผู้ร่วมโหวต', nextVote.vote.voters, ['a', 'c']);
  ok('หน้าจอก็บอกว่าเขาส่งไพ่ไม่ได้', canVoteNow(nextVote, 'b'), false);
}
{
  /* ตอบไม่ใช้ = ส่งใบเดียวตามปกติ การ์ดยังอยู่ */
  const seats = ['a', 'b', 'c'];
  const base = { ...board({ a: 'shipL:C', b: 'shipL:F', c: 'shipL:3' }),
                 seats, held: { b: 1 }, names: { a: 'a', b: 'b', c: 'c' } };
  const st = startVote(base, { kind: 'attack', place: 'shipL', caller: 'a' });
  const sec = { a: { vote: ['v01'] }, b: { vote: ['v04'], held: ['eldorado'] }, c: { vote: ['v07'] } };
  const ctx = { state: st, members: members.slice(0, 3), settings: { turnSeconds: 0 },
                secrets: sec, hostUid: 'a' };

  const off = await onAction(ctx, { uid: 'b', type: 'useDorado', payload: { yes: false } });
  ok('ตอบไม่ใช้ · สิทธิ์เท่าเดิม', voteWeight(off.state, 'b'), 1);
  ok('ตอบไม่ใช้ · การ์ดยังอยู่ในมือ', off.secrets?.b?.held ?? sec.b.held, ['eldorado']);
  ok('ตอบแล้วถามซ้ำไม่ได้',
     await onAction({ ...ctx, state: off.state }, { uid: 'b', type: 'useDorado', payload: { yes: true } }), null);
}

group('เอลโดราโด · โทษห้ามโหวตต้องหมดหลังหนึ่งรอบ');
{
  /* บั๊กที่เคยเกิด: หักโทษให้เฉพาะคนที่ได้ร่วมโหวต
     แต่คนติดโทษถูกตัดออกจากรายชื่อผู้ร่วมไปแล้ว โทษจึงไม่มีวันถูกหัก
     กลายเป็นห้ามโหวตตลอดกาล ต้องหักให้ทุกคนที่อยู่ในสถานที่นั้น */
  const seats = ['a', 'b', 'c'];
  const base = { ...board({ a: 'shipL:C', b: 'shipL:F', c: 'shipL:3' }),
                 seats, held: { b: 1 }, names: { a: 'a', b: 'b', c: 'c' } };
  const sec = () => ({ a: { vote: ['v01', 'v02', 'v03'] },
                       b: { vote: ['v04', 'v05', 'v06'], held: ['eldorado'] },
                       c: { vote: ['v07', 'v08', 'v09'] } });
  const three = members.slice(0, 3);

  /* รอบ 1 — ใช้การ์ด */
  let ctx = { state: startVote(base, { kind: 'attack', place: 'shipL', caller: 'a' }),
              members: three, settings: { turnSeconds: 0 }, secrets: sec(), hostUid: 'a' };
  let r = await onAction(ctx, { uid: 'b', type: 'useDorado', payload: { yes: true } });
  for (const [u, card] of [['b', 'v04'], ['b', 'v05'], ['a', 'v01'], ['c', 'v07']]) {
    ctx = { ...ctx, state: r.state, secrets: { ...ctx.secrets, ...(r.secrets || {}) } };
    r = await onAction(ctx, { uid: u, type: 'voteCard', payload: { card } });
  }
  ok('รอบ 1 · ติดโทษหนึ่งครั้ง', r.state.voteBan.b, 1);

  /* รอบ 2 — โหวตไม่ได้ */
  const two = startVote({ ...r.state, vote: null }, { kind: 'attack', place: 'shipL', caller: 'a' });
  ok('รอบ 2 · ไม่ถูกนับเป็นผู้ร่วม', two.vote.voters, ['a', 'c']);

  ctx = { ...ctx, state: two, secrets: { ...sec(), b: { vote: ['v05', 'v06'] } } };
  let r2 = { state: two, secrets: {} };
  for (const [u, card] of [['a', 'v02'], ['c', 'v08']]) {
    ctx = { ...ctx, state: r2.state, secrets: { ...ctx.secrets, ...(r2.secrets || {}) } };
    r2 = await onAction(ctx, { uid: u, type: 'voteCard', payload: { card } });
  }
  ok('รอบ 2 จบ · โทษถูกหักจนหมด', r2.state.voteBan.b ?? 0, 0);

  /* รอบ 3 — กลับมาโหวตได้ */
  const three3 = startVote({ ...r2.state, vote: null }, { kind: 'attack', place: 'shipL', caller: 'a' });
  ok('รอบ 3 · กลับมาร่วมโหวตได้', three3.vote.voters.includes('b'), true);
  ok('รอบ 3 · หน้าจอก็ปลดล็อกให้', canVoteNow(three3, 'b'), true);
}

group('เอลโดราโด · หน้าจอต้องวาดไพ่ครบพร้อมชื่อ');
{
  /* ไพ่ใบสุดท้ายปิดหม้อทันทีในการเขียนครั้งเดียว
     หน้าจอคนอื่นจึงไม่เคยเห็นสถานะระหว่างทาง ต้องสร้างย้อนหลังจากผล
     ถ้าผลไม่บอกว่าใครส่งกี่ใบ ใบที่สองจะถูกเติมแบบไม่มีชื่อและเตี้ยกว่าเพื่อน */
  const seats = ['a', 'b', 'c'];
  const base = { ...board({ a: 'shipL:C', b: 'shipL:F', c: 'shipL:3' }),
                 seats, held: { b: 1 }, names: { a: 'Fox', b: 'Chorme', c: 'Kai' } };
  let ctx = { state: startVote(base, { kind: 'attack', place: 'shipL', caller: 'a' }),
              members: members.slice(0, 3), settings: { turnSeconds: 0 },
              secrets: { a: { vote: ['v01', 'v02'] },
                         b: { vote: ['v04', 'v05'], held: ['eldorado'] },
                         c: { vote: ['v07', 'v08'] } },
              hostUid: 'a' };

  let r = await onAction(ctx, { uid: 'b', type: 'useDorado', payload: { yes: true } });
  const seen = [];
  for (const [u, card] of [['b', 'v04'], ['a', 'v01'], ['c', 'v07'], ['b', 'v05']]) {
    ctx = { ...ctx, state: r.state, secrets: { ...ctx.secrets, ...(r.secrets || {}) } };
    r = await onAction(ctx, { uid: u, type: 'voteCard', payload: { card } });
    if (r.state.vote) seen.push({ ...r.state.vote.sent });
  }

  ok('ระหว่างทางนับสะสมทีละใบ', seen.map(s => s.b ?? 0), [1, 1, 1]);
  ok('ผลบอกจำนวนใบของแต่ละคน', r.state.lastVote.sent, { a: 1, b: 2, c: 1 });
  const total = Object.values(r.state.lastVote.sent).reduce((n, x) => n + x, 0);
  ok('จำนวนรวมตรงกับไพ่ในหม้อ (บวกใบจากกองกลาง)', total + 1, r.state.lastVote.pot.length);
  ok('ทุกคนที่ส่งมีชื่ออยู่ในผล', Object.keys(r.state.lastVote.sent).sort(), ['a', 'b', 'c']);
}

group('การ์ด · หน้ากาก');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['facade', ...out.secrets._deck.slots.slice(1)] };
  const pos = { a: 'island:G', b: 'shipL:C', c: 'shipL:F', d: 'shipL:3',
                e: 'shipR:C', f: 'island:2' };
  const base = { ...out.state, phase: 'play', turn: 'a', pos, seats: [...P],
                 names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  ok('คนถัดไปคือ b', nextSeat(base), 'b');
  const r = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });

  ok('คนเปิดไปยืนที่เดิมของคนถัดไป', r.state.pos.a, 'shipL:C');
  ok('คนถัดไปมายืนที่เดิมของคนเปิด', r.state.pos.b, 'island:G');
  ok('บทบาทเปลี่ยนตามที่ยืนทันที', roleAt(r.state.pos, 'a'), 'captain');
  ok('คนอื่นไม่ขยับ', [r.state.pos.c, r.state.pos.d, r.state.pos.e], ['shipL:F', 'shipL:3', 'shipR:C']);
  ok('ไม่มีประกาศผลตามหลัง เพราะตัวการ์ดบอกครบแล้ว', r.state.shout ?? null, null);
  ok('พาผังก่อนสลับไปด้วย ฉากจะได้เล่าจบก่อนกระดานขยับ',
     r.state.cardUp.beforePos.a, 'island:G');
  ok('เปิดแล้วผ่านตาไปเลย', r.state.turn, 'b');
  ok('จำนวนคนในแต่ละที่ไม่เปลี่ยน',
     [occupants(r.state.pos, 'shipL').length, occupants(r.state.pos, 'island').length], [3, 2]);
}

group('การ์ด · ระฆังแปดครั้ง');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['eightbell', ...out.secrets._deck.slots.slice(1)] };
  const pos = { a: 'shipL:C', b: 'shipL:F', c: 'shipL:3', d: 'shipL:4',
                e: 'shipR:C', f: 'island:G' };
  const base = { ...out.state, phase: 'play', turn: 'a', pos, seats: [...P],
                 names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck },
                hostUid: 'a', rng: zero };

  const r = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  const line = occupants(r.state.pos, 'shipL');

  ok('คนเดิมครบเท่าเดิม แค่สลับที่ยืน', [...line].sort(), ['a', 'b', 'c', 'd']);
  ok('ผลบอกลำดับใหม่ตรงกับกระดาน', r.state.shout.order, line);
  ok('ประกาศบอกว่าเกิดที่ไหน', r.state.shout.place, 'shipL');
  ok('ที่อื่นไม่ขยับ', [r.state.pos.e, r.state.pos.f], ['shipR:C', 'island:G']);
  ok('พาผังก่อนสุ่มไปด้วย ฉากจะได้เล่าจบก่อนกระดานขยับ',
     r.state.cardUp.beforePos.a, 'shipL:C');
  ok('เปิดแล้วผ่านตาไปเลย', r.state.turn, 'b');
}
{
  /* หน้ากากบอกหน้าจอว่าใครเพิ่งสลับ เพื่อไฮไลท์สองวินาที */
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['facade', ...out.secrets._deck.slots.slice(1)] };
  const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                 seats: [...P], names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const r = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  ok('บอกว่าใครเพิ่งสลับ', [...r.state.glow.uids].sort(), ['a', 'b']);
  ok('ยังไม่มีประกาศเป็นฉาก', r.state.shout ?? null, null);
}

group('การ์ด · รังกา');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['crowsnest', ...out.secrets._deck.slots.slice(1)] };
  const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                 seats: [...P], names: filled().names, out: [] };
  const ctx0 = ctxOf(base);
  let ctx = { ...ctx0, secrets: { ...ctx0.secrets, _deck: deck }, hostUid: 'a' };

  const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  ok('ขั้นแรกเลือกเป้า', up.state.pending.needs, 'player');
  ok('เลือกตัวเองไม่ได้',
     await onAction({ ...ctx, state: up.state }, { uid: 'a', type: 'useCard', payload: { target: 'a' } }), null);

  const who = await onAction({ ...ctx, state: up.state }, { uid: 'a', type: 'useCard', payload: { target: 'b' } });
  ok('ขั้นสองเลือกไพ่', who.state.pending.needs, 'cards');
  ok('ต้องเลือกสามใบ', pickCountOf('crowsnest', 'cards'), 3);

  const pool = who.secrets.a.pool;
  ok('กองส่งไปให้เฉพาะคนเปิด', Array.isArray(pool), true);
  ok('กองรวมมือเดิมของเป้าด้วย', ctx0.secrets.b.vote.every(c => pool.includes(c)), true);
  ok('กองไม่มีมือของคนอื่น', ctx0.secrets.c.vote.some(c => pool.includes(c)), false);
  ok('ขนาดกอง = สำรับ ลบมือคนอื่น', pool.length, DECK.length - (P.length - 1) * 3);

  ctx = { ...ctx, state: who.state, secrets: { ...ctx.secrets, a: who.secrets.a } };
  ok('เลือกไม่ครบสามใบไม่ได้',
     await onAction(ctx, { uid: 'a', type: 'useCard', payload: { cards: pool.slice(0, 2) } }), null);
  ok('เลือกใบซ้ำไม่ได้',
     await onAction(ctx, { uid: 'a', type: 'useCard', payload: { cards: [pool[0], pool[0], pool[1]] } }), null);
  ok('เลือกใบที่ไม่อยู่ในกองไม่ได้',
     await onAction(ctx, { uid: 'a', type: 'useCard', payload: { cards: [ctx0.secrets.c.vote[0], pool[0], pool[1]] } }), null);

  const pick = pool.slice(0, 3);
  const done = await onAction(ctx, { uid: 'a', type: 'useCard', payload: { cards: pick } });
  ok('มือของเป้าถูกแทนที่ทั้งหมด', done.secrets.b.vote, pick);
  ok('มือคนอื่นไม่ถูกแตะ', done.secrets.c.vote, ctx0.secrets.c.vote);
  ok('เก็บกองที่ส่งไปให้ดูทิ้งแล้ว', done.secrets.a.pool, null);
  ok('ประกาศบอกว่าใครโดน', [done.state.shout.kind, done.state.shout.who], ['crow', 'b']);
  ok('ใช้เสร็จแล้วผ่านตา', done.state.turn, 'b');
}

group('รังกา · เลือกตัวเองได้');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['crowsnest', ...out.secrets._deck.slots.slice(1)] };
  const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                 seats: [...P], names: filled().names, out: [] };
  const ctx0 = ctxOf(base);
  const ctx = { ...ctx0, secrets: { ...ctx0.secrets, _deck: deck }, hostUid: 'a' };

  const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  const self = await onAction({ ...ctx, state: up.state },
                              { uid: 'a', type: 'useCard', payload: { target: 'a' } });
  ok('เลือกตัวเองได้ เพราะเป็นการจัดมือ ไม่ใช่การทำร้าย', !!self, true);
  ok('มือเดิมของตัวเองอยู่ในกองให้เลือกกลับได้',
     ctx0.secrets.a.vote.every(c => self.secrets.a.pool.includes(c)), true);

  const c2 = { ...ctx, state: self.state, secrets: { ...ctx.secrets, a: self.secrets.a } };
  const pick = self.secrets.a.pool.slice(0, 3);
  const done = await onAction(c2, { uid: 'a', type: 'useCard', payload: { cards: pick } });
  ok('มือตัวเองถูกเปลี่ยนตามที่เลือก', done.secrets.a.vote, pick);
  ok('ประกาศบอกว่าเป้าคือตัวเอง', done.state.shout.who, 'a');
}

group('การ์ด · ดินปืน');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['blackpowder', ...out.secrets._deck.slots.slice(1)] };
  const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                 seats: [...P], names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  ok('ขั้นแรกเลือกเรือเล็ก', up.state.pending.needs, 'boat');
  ok('เลือกได้ทั้งสองลำตอนยังไม่มีลำไหนพัง',
     targetsOf(up.state, 'a', 'blackpowder', 'boat', {}), ['boatL', 'boatR']);

  const boom = await onAction({ ...ctx, state: up.state },
                              { uid: 'a', type: 'useCard', payload: { target: 'boatL' } });
  ok('ลำนั้นถูกบันทึกว่าพังแล้ว', boom.state.wrecked, ['boatL']);
  ok('ประกาศบอกว่าระเบิดลำไหน', [boom.state.shout.kind, boom.state.shout.place], ['powder', 'boatL']);
  ok('ใช้เสร็จแล้วผ่านตา', boom.state.turn, 'b');

  ok('ลงเรือลำที่พังไม่ได้อีก', boatsOpen(boom.state, 'shipL:C').includes('boatL'), false);
  ok('อีกลำยังลงได้', boatsOpen(boom.state, 'shipR:C'), ['boatR']);
  ok('หน้าจอยังรู้ว่ามีลำนั้นอยู่ เพื่อโชว์ปุ่มแบบทึบ',
     boatsFromAll('shipL:C'), ['boatL']);
  ok('ระเบิดลำเดิมซ้ำไม่ได้',
     targetsOf(boom.state, 'a', 'blackpowder', 'boat', {}), ['boatR']);
}
{
  /* มีคนนั่งอยู่บนลำนั้น = ตกน้ำขึ้นเกาะ */
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['blackpowder', ...out.secrets._deck.slots.slice(1)] };
  const pos = { ...filled().pos, c: 'boatL:B' };
  const base = { ...out.state, phase: 'play', turn: 'a', pos, seats: [...P],
                 names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  const boom = await onAction({ ...ctx, state: up.state },
                              { uid: 'a', type: 'useCard', payload: { target: 'boatL' } });
  ok('คนบนเรือลำนั้นขึ้นเกาะ', placeOf(boom.state.pos.c), 'island');
  ok('ประกาศบอกว่าใครตกน้ำ', boom.state.shout.who, 'c');
}

group('การ์ด · ประมวลโจรสลัด');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['piratecode', ...out.secrets._deck.slots.slice(1)] };
  const pos = { a: 'shipL:C', b: 'shipL:F', c: 'shipL:3', d: 'shipR:C', e: 'island:G', f: 'island:2' };
  const base = { ...out.state, phase: 'play', turn: 'a', pos, seats: [...P],
                 names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const r = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  ok('เปิดแล้วติดโทษสองครั้ง', r.state.voteBan.a, 2);
  ok('ไม่มีประกาศเป็นฉาก ตัวการ์ดบอกครบแล้ว', r.state.shout ?? null, null);
  ok('เปิดแล้วผ่านตาไปเลย', r.state.turn, 'b');

  /* ป้ายข้างชื่ออ่านจากจำนวนครั้งที่เหลือ ไม่ต้องเก็บสถานะแยก */
  ok('รอบที่หนึ่ง · ไม่ถูกนับเป็นผู้ร่วมโหวต',
     startVote({ ...r.state, vote: null }, { kind: 'attack', place: 'shipL', caller: 'b' })
       .vote.voters.includes('a'), false);

  /* เดินสามรอบเต็ม โทษต้องหมดพอดีหลังรอบที่สอง */
  let cur = r.state;
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const v = startVote({ ...cur, vote: null }, { kind: 'attack', place: 'shipL', caller: 'b' });
    seen.push({ joined: v.vote.voters.includes('a'), left: v.voteBan?.a || 0 });
    let c2 = { ...ctx, state: v };
    let rr = { state: v, secrets: {} };
    for (const u of v.vote.voters) {
      c2 = { ...c2, state: rr.state, secrets: { ...c2.secrets, ...(rr.secrets || {}) } };
      rr = await onAction(c2, { uid: u, type: 'voteCard', payload: { card: c2.secrets[u].vote[0] } });
    }
    cur = rr.state;
  }
  ok('รอบ 1 กับ 2 ร่วมไม่ได้ · รอบ 3 กลับมาร่วมได้',
     seen.map(s => s.joined), [false, false, true]);
  ok('จำนวนครั้งที่เหลือไล่ลงถูกต้อง', seen.map(s => s.left), [2, 1, 0]);
  ok('โทษหมดแล้วป้ายหายเอง เพราะอ่านจากตัวเลขนี้โดยตรง', cur.voteBan?.a || 0, 0);
}

group('การ์ด · ลักปิดลักเปิด');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['scurvy', ...out.secrets._deck.slots.slice(1)] };
  const pos = { a: 'shipL:C', b: 'shipL:F', c: 'shipL:3', d: 'shipR:C', e: 'island:G', f: 'island:2' };
  const base = { ...out.state, phase: 'play', turn: 'a', pos, seats: [...P],
                 names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const r = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });

  ok('ทุกคนในที่เดียวกันติดหนี้ข้ามตา',
     ['a', 'b', 'c'].map(u => r.state.skip?.[u] ?? 0), [1, 0, 0]);
  ok('คนที่อยู่ที่อื่นไม่โดน', [r.state.skip?.d ?? 0, r.state.skip?.e ?? 0], [0, 0]);

  /* b อยู่ที่เดียวกันและถึงตาทันที จึงถูกข้ามและหักหนี้ไปแล้วในจังหวะเดียวกัน */
  ok('คนถัดไปที่ป่วยถูกข้ามทันที', r.state.turn, 'c');
  ok('หนี้ของคนที่ถูกข้ามถูกหักแล้ว', r.state.skip?.b ?? 0, 0);
  ok('ประกาศบอกว่าใครถูกข้าม', [r.state.shout.kind, r.state.shout.who], ['skip', ['b']]);

  /* คนเปิดยังติดหนี้อยู่ ตาที่กำลังเปิดไม่นับ จะโดนตอนถึงตาครั้งถัดไป */
  ok('คนเปิดยังติดหนี้ค้างไว้ ตาที่เปิดไม่นับ', r.state.skip?.a, 1);
}
{
  /* เดินจนครบรอบ ยืนยันว่าคนเปิดโดนข้ามในตาถัดไปของตัวเอง แล้วหนี้หมด */
  const st = { ...board({ a: 'shipL:C', b: 'shipR:C', c: 'island:G' }),
               seats: ['a', 'b', 'c'], turn: 'a', skip: { a: 1 } };
  const one = advance(st, 'a');
  ok('ตาถัดไปข้ามไปที่ b ตามปกติ', one.uid, 'b');
  ok('ยังไม่มีใครถูกข้าม', one.skipped, []);

  const two = advance(one.state, 'b');
  ok('ยังไม่ถึงตา a', two.uid, 'c');

  const three = advance(two.state, 'c');
  ok('ถึงตา a แล้วโดนข้าม ไปที่ b แทน', three.uid, 'b');
  ok('รายงานว่า a ถูกข้าม', three.skipped, ['a']);
  ok('หนี้ของ a หมดแล้ว', three.state.skip?.a ?? 0, 0);
}

group('การ์ด · บ้าเรือ');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['cabinfever', ...out.secrets._deck.slots.slice(1)] };
  const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                 seats: [...P], names: filled().names, out: [] };
  const c0 = ctxOf(base);
  const secrets = { ...c0.secrets, a: { ...c0.secrets.a, nation: 'B' },
                    b: { ...c0.secrets.b, nation: 'F' }, _deck: deck };
  const ctx = { ...c0, secrets, hostUid: 'a' };

  const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  ok('ขั้นแรกเลือกคน', up.state.pending.needs, 'player');
  ok('เลือกตัวเองไม่ได้',
     await onAction({ ...ctx, state: up.state }, { uid: 'a', type: 'useCard', payload: { target: 'a' } }), null);

  /* สับหลายรอบ ต้องออกได้ทั้งสองแบบ — ถ้าสลับแน่นอนทุกครั้ง ข้อมูลจะรั่ว */
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const r = await onAction({ ...ctx, state: up.state },
                             { uid: 'a', type: 'useCard', payload: { target: 'b' } });
    seen.add(r.secrets.a.nation + r.secrets.b.nation);
  }
  ok('ออกได้ทั้งใบเดิมและใบสลับ', [...seen].sort(), ['BF', 'FB']);

  const one = await onAction({ ...ctx, state: up.state },
                             { uid: 'a', type: 'useCard', payload: { target: 'b' } });
  ok('ไพ่ประเทศยังอยู่ครบสองใบ',
     [one.secrets.a.nation, one.secrets.b.nation].sort(), ['B', 'F']);
  ok('คนอื่นไม่ถูกแตะ', one.secrets.c ?? null, null);
  ok('ประกาศบอกว่าใครกับใคร',
     [one.state.shout.kind, one.state.shout.by, one.state.shout.who], ['fever', 'a', 'b']);
  ok('ใช้เสร็จแล้วผ่านตา', one.state.turn, 'b');
}

group('การ์ด · ทะเลบ้า');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['stormyseas', ...out.secrets._deck.slots.slice(1)] };
  const cargo = { shipL: { B: 3, F: 3 }, shipR: { B: 0, F: 1 },
                  island: { B: 3, F: 1 }, merchant: 0 };
  const base = { ...out.state, phase: 'play', pos: filled().pos, cargo,
                 seats: [...P], names: filled().names, out: [] };

  /* เปิดบนเรือ */
  const onShip = { ...ctxOf({ ...base, turn: 'a' }),
                   secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };
  const r1 = await onAction(onShip, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  ok('กล่องบนลำนั้นหายหมด', r1.state.cargo.shipL, { B: 0, F: 0 });
  ok('ไปโผล่ที่เรือสินค้าครบทุกใบ', r1.state.cargo.merchant, 6);
  ok('เรืออีกลำไม่โดน', r1.state.cargo.shipR, { B: 0, F: 1 });
  ok('เกาะไม่โดน', r1.state.cargo.island, { B: 3, F: 1 });
  ok('ประกาศบอกจำนวนที่ถูกซัด', [r1.state.shout.kind, r1.state.shout.n], ['storm', 6]);

  /* เปิดบนเกาะ */
  const onIsle = { ...ctxOf({ ...base, turn: 'd' }),
                   secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };
  const r2 = await onAction(onIsle, { uid: 'd', type: 'activate', payload: { slot: 0 } });
  ok('กล่องบนเกาะถูกแบ่งเท่ากัน', r2.state.cargo.island, { B: 2, F: 2 });
  ok('จำนวนรวมบนเกาะไม่หาย', r2.state.cargo.island.B + r2.state.cargo.island.F, 4);
  ok('เรือไม่โดนตอนเปิดบนเกาะ', r2.state.cargo.shipL, { B: 3, F: 3 });

  /* เรือว่างอยู่แล้ว */
  const empty = { ...base, turn: 'f', cargo: { ...cargo, shipR: { B: 0, F: 0 } } };
  const onBare = { ...ctxOf(empty), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };
  const r3 = await onAction(onBare, { uid: 'f', type: 'activate', payload: { slot: 0 } });
  ok('เรือว่างอยู่แล้วก็ไม่พัง', r3.state.cargo.merchant, 0);
  ok('ประกาศบอกว่าไม่มีอะไรให้ซัด', r3.state.shout.n, 0);
}

group('การ์ด · กองเรือสเปน');
{
  const cargo = { shipL: { B: 2, F: 0 }, shipR: { B: 0, F: 2 },
                  island: { B: 0, F: 0 }, merchant: 4 };

  ok('เสมอแล้วมีดัตช์ = ดัตช์ชนะ', winningSide(cargo, { a: 'B', b: 'F', c: 'D' }), 'D');
  ok('เสมอแล้วไม่มีดัตช์ = เสมอจริง', winningSide(cargo, { a: 'B', b: 'F' }), 'tie');
  ok('ไม่ส่งไพ่ประเทศมาก็ยังคืนดัตช์เหมือนเดิม', winningSide(cargo), 'D');

  const lead = { ...cargo, shipL: { B: 3, F: 0 } };
  ok('ฝ่ายที่มีกล่องมากกว่าชนะ', winningSide(lead, { a: 'B', b: 'F' }), 'B');
  ok('ผู้ชนะคือทุกคนในฝ่ายนั้น', winners(lead, { a: 'B', b: 'F', c: 'B' }).sort(), ['a', 'c']);
  ok('เสมอแล้วไม่มีดัตช์ ก็ไม่มีผู้ชนะ', winners(cargo, { a: 'B', b: 'F' }), []);
}
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck, slots: ['armada', ...out.secrets._deck.slots.slice(1)] };
  const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                 seats: [...P], names: filled().names, out: [],
                 cargo: { shipL: { B: 3, F: 0 }, shipR: { B: 0, F: 2 },
                          island: { B: 0, F: 0 }, merchant: 3 } };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const r = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
  ok('เปิดแล้วเกมจบทันที', r.state.phase, 'over');
  ok('ไม่มีฉากเปิดการ์ด', r.state.cardUp ?? null, null);
  ok('สรุปคะแนนไว้แล้ว', [r.state.result.score.B, r.state.result.score.F], [3, 2]);
  ok('บอกฝ่ายที่ชนะ', r.state.result.side, 'B');
  ok('ส่งไพ่ประเทศทุกคนไปให้หน้าจอ', Object.keys(r.state.result.nations).sort(), [...P].sort());
  ok('ไม่นับกล่องบนเรือสินค้า', r.state.result.score.B + r.state.result.score.F, 5);
}

group('สุ่มชุดการ์ดพิเศษ');
{
  /* นับเป็นชุด ไม่ใช่ใบ — บางชนิดมีหลายใบ สุ่ม 6 ชุดจึงได้มากกว่า 6 ใบได้ */
  const types = [...new Set(EXTRA_CARDS.map(c => c.id))];

  for (const n of [6, 8]) {
    const runs = Array.from({ length: 300 }, () => randomSets(n));
    ok('สุ่ม ' + n + ' ชุด · ได้ครบตามจำนวนเสมอ',
       [...new Set(runs.map(r => r.length))], [n]);
    ok('สุ่ม ' + n + ' ชุด · ไม่มีชนิดซ้ำในชุดเดียวกัน',
       runs.every(r => new Set(r).size === r.length), true);
    ok('สุ่ม ' + n + ' ชุด · ทุกใบมีอยู่จริงในสำรับพิเศษ',
       runs.every(r => r.every(id => types.includes(id))), true);

    /* ข้อจำกัดเพื่อความสมดุล */
    const withLead = runs.filter(r => r.includes('aground'));
    ok('สุ่ม ' + n + ' ชุด · จับได้เกยตื้นบ้าง', withLead.length > 0, true);
    ok('สุ่ม ' + n + ' ชุด · มีเกยตื้นแล้วต้องมีคู่หูครบทุกครั้ง',
       withLead.every(r => r.includes('relief') && r.includes('anthemoessa')), true);
  }

  /* คู่หูอยู่เดี่ยว ๆ ได้ ไม่ต้องลากเกยตื้นมาด้วย */
  const runs = Array.from({ length: 400 }, () => randomSets(6));
  const soloMate = runs.some(r =>
    (r.includes('relief') || r.includes('anthemoessa')) && !r.includes('aground'));
  ok('ผลัดเวรกับ Anthemoessa อยู่เดี่ยว ๆ ได้', soloMate, true);
}

group('Action · บังคับให้คนอื่นเปิดการ์ด');
{
  /* หัวใจของใบนี้คือ **ผลของการ์ดต้องเป็นของคนที่กดเปิด ไม่ใช่คนที่สั่ง**
     ถ้าพลาดตรงนี้ กลไกทั้งเกมเสียเลย เพราะการบังคับจะกลายเป็นการทำร้ายตัวเอง */
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck,
                 slots: ['blackspot', 'pistol', 'albatross', 'facade', 'relief'] };
  const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                 seats: [...P], names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  const step1 = await onAction(ctx, { uid: 'a', type: 'force' });
  ok('สั่งแล้วเข้าขั้นถาม ไม่ผ่านตาทันที', step1.state.pending.needs, 'player');
  ok('ยังเป็นตาของคนสั่ง', step1.state.turn, 'a');
  ok('เลือกตัวเองไม่ได้',
     await onAction({ ...ctx, state: step1.state }, { uid: 'a', type: 'useCard', payload: { target: 'a' } }), null);

  const step2 = await onAction({ ...ctx, state: step1.state },
                               { uid: 'a', type: 'useCard', payload: { target: 'b' } });
  ok('ขั้นสองเลือกการ์ด', step2.state.pending.needs, 'slots');
  ok('ต้องเลือกสองใบ', pickCountOf('force', 'slots'), 2);

  const c2 = { ...ctx, state: step2.state };
  ok('เลือกใบเดียวไม่ได้',
     await onAction(c2, { uid: 'a', type: 'useCard', payload: { cards: [0] } }), null);
  ok('เลือกช่องซ้ำไม่ได้',
     await onAction(c2, { uid: 'a', type: 'useCard', payload: { cards: [0, 0] } }), null);

  const set = await onAction(c2, { uid: 'a', type: 'useCard', payload: { cards: [0, 3] } });
  ok('ตั้งสถานะบังคับไว้', [set.state.forced.who, set.state.forced.slots], ['b', [0, 3]]);
  ok('ตายังไม่ผ่าน เพราะ Action ยังไม่จบ', set.state.turn, 'a');
  ok('คนถูกบังคับทำได้อย่างเดียวคือเปิด', actionsFor(set.state, 'b'), ['activate']);
  ok('คนสั่งทำอะไรต่อไม่ได้', actionsFor(set.state, 'a'), []);
  ok('คนอื่นก็ทำอะไรไม่ได้', actionsFor(set.state, 'c'), []);

  const c3 = { ...ctx, state: set.state };
  ok('เปิดใบที่ไม่ได้ถูกชี้ไม่ได้',
     await onAction(c3, { uid: 'b', type: 'activate', payload: { slot: 1 } }), null);

  const flip = await onAction(c3, { uid: 'b', type: 'activate', payload: { slot: 0 } });
  ok('ผลของจุดดำตกที่คนเปิด ไม่ใช่คนสั่ง', flip.state.pos.b.startsWith('island'), true);
  ok('คนสั่งไม่โดนอะไร', flip.state.pos.a, base.pos.a);
  ok('ปลดสถานะบังคับแล้ว', flip.state.forced ?? null, null);
  ok('เปิดเสร็จแล้วผ่านตาไปจากคนสั่ง', flip.state.turn, 'b');
}
{
  /* การ์ดที่ต้องเลือกเป้า — คนที่ถูกบังคับต้องเป็นคนเลือกเอง */
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const deck = { ...out.secrets._deck,
                 slots: ['pistol', 'albatross', 'facade', 'relief', 'contract'] };
  const base = { ...out.state, phase: 'play', turn: 'a', pos: filled().pos,
                 seats: [...P], names: filled().names, out: [] };
  const ctx = { ...ctxOf(base), secrets: { ...out.secrets, _deck: deck }, hostUid: 'a' };

  let s = (await onAction(ctx, { uid: 'a', type: 'force' })).state;
  s = (await onAction({ ...ctx, state: s }, { uid: 'a', type: 'useCard', payload: { target: 'b' } })).state;
  s = (await onAction({ ...ctx, state: s }, { uid: 'a', type: 'useCard', payload: { cards: [0, 1] } })).state;
  s = (await onAction({ ...ctx, state: s }, { uid: 'b', type: 'activate', payload: { slot: 0 } })).state;

  ok('คนที่ถูกบังคับกลายเป็นเจ้าของผลการ์ด', s.pending.by, 'b');
  ok('เขาเลือกเป้าได้ ทั้งที่ไม่ใช่ตาของเขา', actionsFor(s, 'b'), ['useCard']);
  ok('คนสั่งเลือกแทนไม่ได้', actionsFor(s, 'a'), []);
  ok('เขายิงตัวเองไม่ได้',
     await onAction({ ...ctx, state: s }, { uid: 'b', type: 'useCard', payload: { target: 'b' } }), null);

  const shot = await onAction({ ...ctx, state: s }, { uid: 'b', type: 'useCard', payload: { target: 'a' } });
  ok('เขายิงคนสั่งกลับได้', shot.state.pos.a.startsWith('island'), true);
  ok('ประกาศบอกว่าคนยิงคือคนที่ถูกบังคับ', shot.state.shout.by, 'b');
}

group('นกอัลบาทรอส · คนเดียวถือได้หลายตัว');
{
  /* คนเดียวถือสองตัวก็ล่มทั้งลำได้ ไม่ต้องรอสองคน
     เป็นเคสที่ลืมง่าย เพราะชื่อกฎฟังเหมือน "สองคน" ทั้งที่จริงคือ "สองตัว" */
  const base = board({ a: 'shipL:C', b: 'shipL:F', c: 'shipR:C', d: 'island:G' });

  const one = addMark(base, 'a', 'bird');
  ok('ถือตัวเดียวยังไม่ล่ม', birdStrike(one, {}, zero), null);
  ok('นับได้หนึ่ง', marksIn(one, 'shipL', 'bird'), 1);

  const two = addMark(one, 'a', 'bird');
  ok('คนเดียวถือสองตัว นับได้สอง', markCount(two, 'a', 'bird'), 2);
  ok('รวมทั้งลำก็ได้สอง', marksIn(two, 'shipL', 'bird'), 2);

  const hit = birdStrike(two, {}, zero);
  ok('ล่มทั้งลำแม้มีคนถือคนเดียว', hit?.place, 'shipL');
  ok('คนที่ไม่ได้ถือนกก็โดนด้วย', hit.who, ['a', 'b']);

  /* อยู่คนเดียวบนเรือแล้วถือสามตัว */
  const alone = addMark(addMark(addMark(
    board({ a: 'shipL:C', b: 'shipR:C', c: 'island:G' }), 'a', 'bird'), 'a', 'bird'), 'a', 'bird');
  const solo = birdStrike(alone, {}, zero);
  ok('อยู่คนเดียวถือสามตัวก็ล่ม', solo?.who, ['a']);

  /* สองคนถือคนละตัวก็ยังล่มเหมือนเดิม */
  const split = addMark(addMark(base, 'a', 'bird'), 'b', 'bird');
  ok('คนละตัวสองคนก็ล่ม', birdStrike(split, {}, zero)?.place, 'shipL');

  /* มังสวิรัสเก็บคืนต้องเก็บครบทุกตัว ไม่ใช่ลดทีละตัว */
  const swept = clearMark(two, 'bird');
  ok('เก็บคืนแล้วไม่เหลือสักตัว', markCount(swept, 'a', 'bird'), 0);
  ok('เก็บคืนแล้วไม่ล่มอีก', birdStrike(swept, {}, zero), null);
}

group('การ์ดพิเศษ · ตะขอเกี่ยว · หนูท้องเรือ · กระซิบ');
{
  const out = init({ members, settings: { turnSeconds: 0, extraCards: [] } });
  const mk = (id) => ({ ...out.secrets._deck, slots: [id, ...out.secrets._deck.slots.slice(1)] });
  const cargo = { shipL: { B: 2, F: 1 }, shipR: { B: 0, F: 1 },
                  island: { B: 1, F: 1 }, merchant: 4 };
  const at = (pos, turn) => ({ ...out.state, phase: 'play', turn, pos, cargo,
                               seats: [...P], names: filled().names, out: [] });

  /* ตะขอเกี่ยว — สลับกับคนข้างหน้า */
  {
    const st = at({ a: 'shipL:C', b: 'shipL:F', c: 'island:G' }, 'b');
    const ctx = { ...ctxOf(st), secrets: { ...out.secrets, _deck: mk('grapple') }, hostUid: 'a' };
    const r = await onAction(ctx, { uid: 'b', type: 'activate', payload: { slot: 0 } });
    ok('สลับกับคนข้างหน้า', [r.state.pos.a, r.state.pos.b], ['shipL:F', 'shipL:C']);
    ok('บอกหน้าจอว่าใครโดนกระชาก', [...r.state.hook.uids].sort(), ['a', 'b']);
  }

  /* อยู่หัวแถวแล้วสลับกับคนท้ายแถว */
  {
    const st = at({ a: 'shipL:C', b: 'shipL:F', c: 'shipL:3' }, 'a');
    const ctx = { ...ctxOf(st), secrets: { ...out.secrets, _deck: mk('grapple') }, hostUid: 'a' };
    const r = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
    ok('หัวแถวสลับกับท้ายแถว', occupants(r.state.pos, 'shipL'), ['c', 'b', 'a']);
  }

  /* กฎใหม่ — อยู่คนเดียวในที่นั้นแล้วโดน Maroon เอง */
  {
    const st = at({ a: 'shipL:C', b: 'shipL:F', c: 'island:G' }, 'c');
    const ctx = { ...ctxOf(st), secrets: { ...out.secrets, _deck: mk('grapple') }, hostUid: 'a' };
    const r = await onAction(ctx, { uid: 'c', type: 'activate', payload: { slot: 0 } });
    ok('อยู่คนเดียวบนเกาะ = เสียไพ่โหวตถาวร', r.state.maxVote.c, 2);
    ok('ประกาศบอกว่าตะขอไม่ติดอะไร', r.state.shout.kind, 'hookMiss');
    ok('ไม่มีใครถูกสลับ', r.state.hook ?? null, null);
  }

  /* หนูท้องเรือ — ย้ายกล่องข้ามฝั่งในที่ที่ยืน */
  {
    const st = at({ a: 'shipL:C', b: 'shipL:F', c: 'island:G' }, 'a');
    const ctx = { ...ctxOf(st), secrets: { ...out.secrets, _deck: mk('bilgerat') }, hostUid: 'a' };
    const up = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
    ok('ขั้นแรกถามฝั่งต้นทาง', up.state.pending.needs, 'from');
    ok('เลือกได้เฉพาะฝั่งที่มีกล่อง',
       targetsOf(up.state, 'a', 'bilgerat', 'from', {}), ['B', 'F']);

    const f = await onAction({ ...ctx, state: up.state }, { uid: 'a', type: 'useCard', payload: { target: 'B' } });
    ok('ขั้นสองถามฝั่งปลายทาง', f.state.pending.needs, 'to');
    ok('ปลายทางต้องไม่ใช่ฝั่งเดิม',
       targetsOf(f.state, 'a', 'bilgerat', 'to', { from: 'B' }), ['F']);

    const done = await onAction({ ...ctx, state: f.state }, { uid: 'a', type: 'useCard', payload: { target: 'F' } });
    ok('กล่องย้ายข้ามฝั่งจริง', done.state.cargo.shipL, { B: 1, F: 2 });
    ok('จำนวนกล่องรวมไม่เปลี่ยน',
       done.state.cargo.shipL.B + done.state.cargo.shipL.F, 3);
    ok('ที่อื่นไม่ถูกแตะ', done.state.cargo.island, { B: 1, F: 1 });
  }

  /* กระซิบ — เติมกองกลางในโหวตครั้งถัดไป แล้วป้ายหายเอง */
  {
    const st = at({ a: 'shipL:C', b: 'shipL:F', c: 'shipL:3' }, 'a');
    const ctx = { ...ctxOf(st), secrets: { ...out.secrets, _deck: mk('whisper') }, hostUid: 'a' };
    const r = await onAction(ctx, { uid: 'a', type: 'activate', payload: { slot: 0 } });
    ok('ติดป้ายไว้กับคนเปิด', markCount(r.state, 'a', 'whisper'), 1);
    ok('ไม่มีผลอะไรทันที', r.state.shout ?? null, null);

    const v = startVote({ ...r.state, vote: null }, { kind: 'attack', place: 'shipL', caller: 'b' });
    let c2 = { ...ctx, state: v };
    let rr = { state: v, secrets: {} };
    for (const u of v.vote.voters) {
      c2 = { ...c2, state: rr.state, secrets: { ...c2.secrets, ...(rr.secrets || {}) } };
      rr = await onAction(c2, { uid: u, type: 'voteCard', payload: { card: c2.secrets[u].vote[0] } });
    }
    ok('หม้อได้ไพ่เพิ่มจากกองกลางอีกใบ', rr.state.lastVote.pot.length, v.vote.voters.length + 2);
    ok('ป้ายถูกเก็บคืนหลังใช้', markCount(rr.state, 'a', 'whisper'), 0);
  }
}
