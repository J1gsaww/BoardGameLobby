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
  SHIP_CARGO_CAP, TOTAL_BOXES, pushLog, LOG_MAX
} from './rules.js';
import { onAction, init, tick, finish, passTurn, openTurn } from './game.js';
import { DECK } from './vote.js';

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
ok('ใบเปล่าไม่นับอะไรเลย', tallyRow(['v25'], 'attack'), {});
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
ok('คนคู่ได้ดัตช์สองคน', dutchCount(6, 'auto'), 2);
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
ok('ตั้งค่าค้างไว้แล้วคนเปลี่ยน ให้ตกกลับเป็นอัตโนมัติ', dutchCount(6, '1'), 2);
{
  const n = dealNations(['a', 'b', 'c', 'd', 'e', 'f'], 'auto', fakeRng([0.2, 0.8, 0.4, 0.6, 0.1]));
  ok('หกคน ดัตช์สอง ที่เหลือแบ่งสองสอง', nationTally(n), [['B', 2], ['D', 2], ['F', 2]]);
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

function ctxOf(state, hands = {}, nations = {}, picks = {}) {
  return {
    state,
    members,
    settings: { turnSeconds: 60 },
    secrets: Object.fromEntries(P.map(u => [u, {
      vote: hands[u] || ['v01', 'v02', 'v03'],
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
  ok('ทุกคนได้ไพ่ประเทศ', Object.values(out.secrets).every(s => 'BFD'.includes(s.nation)), true);
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
  const st = { ...filled(), turnSeconds: 0, deadline: null };
  const done = (await onAction(ctxOf(st), { uid: 'a', type: 'peek' })).state;
  ok('ไม่จับเวลา ส่งตาต่อแล้วก็ยังไม่มีเส้นตาย', done.deadline, null);
}

group('ต่อสาย · หนึ่งตาหนึ่ง Action');
{
  const st = filled();
  const r = await onAction(ctxOf(st), { uid: 'a', type: 'peek' });
  ok('ทำแล้วส่งตาต่อทันที', r.state.turn, 'b');
  const bad = await onAction(ctxOf(r.state), { uid: 'a', type: 'peek' });
  ok('คนเดิมทำซ้ำในตาของคนอื่นไม่ได้', bad, null);
  const notMine = await onAction(ctxOf(st), { uid: 'c', type: 'peek' });
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
  let s = r.state;
  for (const uid of ['b', 'c', 'd', 'e', 'f']) {
    s = (await onAction(ctxOf(s), { uid, type: 'peek' })).state;
  }
  ok('ครบรอบแล้วกลับมาถึงตาเขา และขึ้นฝั่งให้อัตโนมัติ', s.pos.a, 'island:3');
  ok('ขึ้นฝั่งแล้วยังเป็นตาของเขาอยู่ ไม่เสีย Action', s.turn, 'a');
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
  const called = await onAction(ctx, { uid: 'a', type: 'attack', payload: { target: 'merchant', side: 'F' } });
  ok('เปิดโหวตแล้วยังไม่ผ่านตา', called.state.turn, 'a');
  ok('ผู้ร่วมโหวตคือทุกคนบนเรือ', called.state.vote.voters, ['a', 'b', 'c']);

  ctx = ctxOf(called.state, hands);
  const one = await onAction(ctx, { uid: 'a', type: 'voteCard', payload: { card: 'v03' } });
  ok('ส่งไพ่แล้วขึ้นชื่อว่าส่งแล้ว', one.state.vote.done, ['a']);
  ok('คนอื่นเห็นแค่จำนวนใบที่ลดลง ไม่เห็นว่าใบไหน', one.state.votes.a, 2);
  ok('ไพ่ที่เลือกเก็บในข้อมูลลับของเจ้าตัว', one.secrets.a.pick, 'v03');

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
  const st = startVote(filled(), { kind: 'attack', place: 'shipL', caller: 'a', target: 'merchant', side: 'F' });
  st.vote.from = 'B';
  st.vote.done = ['a', 'b'];
  const ctx = ctxOf({ ...st, votes: { ...st.votes, a: 0, b: 0 } },
                    { a: [], b: [], c: ['v25'] }, {}, { a: 'v03', b: 'v07' });
  const done = await onAction(ctx, { uid: 'c', type: 'voteCard', payload: { card: 'v25' } });

  ok('เปิดหม้อแล้วโหวตถูกปิด', done.state.vote, null);
  ok('ผลถูกเก็บไว้ให้หน้าจอโชว์', done.state.lastVote.kind, 'attack');
  ok('หม้อมีไพ่ที่ส่งบวกใบจากกองกลาง', done.state.lastVote.pot.length, 4);
  ok('เปิดผลแล้วผ่านตาไปคนถัดไป', done.state.turn, 'b');
  ok('ทุกคนได้มือใหม่ครบตามเพดาน', Object.values(done.state.votes), [3, 3, 3, 3, 3, 3]);
  ok('สับใหม่แล้วกองเหลือเท่าเดิม', done.state.voteDeck, DECK.length - 18);
}
{
  /* หม้อไม่มีปืนใหญ่เลย โจมตีต้องไม่สำเร็จ กล่องต้องอยู่ที่เดิม */
  const st = startVote(filled(), { kind: 'attack', place: 'shipL', caller: 'a', target: 'merchant', side: 'F' });
  st.vote.from = 'B';
  st.vote.done = ['a', 'b'];
  const ctx = ctxOf(st, { a: [], b: [], c: ['v01'] }, {}, { a: 'v01', b: 'v05' });
  const done = await onAction(ctx, { uid: 'c', type: 'voteCard', payload: { card: 'v01' } });
  const n = done.state.lastVote.counts;
  if (!attackPasses(n)) {
    ok('โจมตีไม่สำเร็จ กล่องอยู่ที่เดิม', done.state.cargo.merchant, 4);
  } else {
    ok('โจมตีสำเร็จ กล่องย้ายขึ้นเรือ', done.state.cargo.shipL.F, 1);
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
