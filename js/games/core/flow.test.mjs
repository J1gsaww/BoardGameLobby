/* flow.test.mjs — ทดสอบการต่อสายทั้งเส้นแบบไม่มีเบราว์เซอร์
   จำลองผู้เล่นหลายคนยิงคำขอเข้ามา แล้วให้ game.js ตัดสินเหมือนตอนรันจริง
   จับบั๊กการต่อท่อ (init / onAction / tick / สถานะที่ส่งกลับ) ก่อนขึ้นเว็บ

   รันด้วย  node js/games/slave/flow.test.mjs */

import { makeGame } from './trick-game.js';
import { SLAVE } from '../slave/rules.js';
import { TYCOON } from '../tycoon/rules.js';

const { init, onAction, tick } = makeGame(SLAVE);

let pass = 0, fail = 0;
const ok = (label, got, want = true) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) pass++;
  else { fail++; console.log(`  ไม่ผ่าน: ${label}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`); }
};
const group = (n) => console.log('\n' + n);

/* ── โต๊ะจำลอง ─────────────────────────────────────── */
function makeTable(n, settings) {
  const members = Array.from({ length: n }, (_, i) => ({
    uid: 'P' + i, name: 'ผู้เล่น' + i, role: 'player', seat: i, online: true, ready: true
  }));
  const hostUid = members[0].uid;
  let state = null, secrets = {};

  const ctx = () => ({
    me: { uid: hostUid }, members, isHost: true, hostUid,
    state, settings, secret: secrets[hostUid], secrets,
    send() {}, leave() {}
  });

  const merge = (out) => {
    if (!out) return false;
    if (out.state) state = out.state;
    for (const [uid, v] of Object.entries(out.secrets || {})) secrets[uid] = v;
    return true;
  };

  const boot = () => { merge(init(ctx())); };
  const act = async (a) => merge(await onAction(ctx(), a));
  const clock = async () => merge(await tick(ctx()));

  return {
    members, hostUid,
    boot, act, clock,
    get state() { return state; },
    hand: (uid) => (secrets[uid] || {}).hand || [],
    secret: (uid) => secrets[uid] || {}
  };
}

/* เดินเกมไปข้างหน้าหนึ่งก้าวตามช่วงที่อยู่ */
async function step(tb) {
  const st = tb.state;

  if (st.phase === 'play') {
    // กองเพิ่งจบ ระบบค้างไว้ให้คนดูทัน — ในเทสให้เดินเวลาข้ามไปเลย
    if (st.holdUntil && Date.now() < st.holdUntil) { st.holdUntil = 0; return true; }

    const uid = st.turn;
    const hand = tb.hand(uid);
    for (const c of hand) {                       // ลองลงทีละใบจากเล็กไปใหญ่
      if (await tb.act({ uid, type: 'play', payload: { cards: [c] } })) return true;
    }
    if (await tb.act({ uid, type: 'pass', payload: {} })) return true;
    // ลงเดี่ยวไม่ได้และผ่านก็ไม่ได้ = ต้องเป็นคนเริ่มกองที่ถือแต่ชุดใหญ่ ให้นาฬิกาบังคับลง
    return await tb.clock();
  }

  if (st.phase === 'exchange') {
    const pair = st.exchange.pairs.find(p => !st.exchange.given[p.upper]);
    if (!pair) return false;
    const give = tb.hand(pair.upper).slice(0, pair.count);
    return await tb.act({ uid: pair.upper, type: 'give', payload: { cards: give } });
  }

  if (st.phase === 'roundEnd') {
    if (st.mode === 'endless') {
      const uid = st.seats.find(u => st.votes[u] === undefined);
      return await tb.act({ uid, type: 'vote', payload: { yes: true } });
    }
    return await tb.act({ uid: tb.hostUid, type: 'next', payload: {} });
  }
  return false;
}

/* ── โหมดปกติ สองรอบจบ ─────────────────────────────── */
group('โหมดปกติ เล่นสองรอบจนจบเกม');
{
  const tb = makeTable(5, { mode: 'normal', turnSeconds: 0 });
  tb.boot();

  ok('เริ่มที่ช่วงเล่น', tb.state.phase, 'play');
  ok('รอบที่ 1', tb.state.roundNo, 1);
  ok('มีที่นั่ง 5 คน', tb.state.seats.length, 5);
  ok('บังคับลงดอกจิก 3 ในกองแรก', tb.state.mustInclude, '3C');
  ok('คนเริ่มถือดอกจิก 3', tb.hand(tb.state.turn).includes('3C'));
  ok('ทุกคนเห็นจำนวนไพ่ของกันและกัน',
     Object.values(tb.state.counts).reduce((a, b) => a + b, 0), 52);
  ok('ไม่มีไพ่ในมือรั่วออกมาในสถานะสาธารณะ', tb.state.hands === undefined);
  ok('สถานะสาธารณะไม่มีคำว่า hand เลย',
     JSON.stringify(tb.state).includes('"hand"'), false);

  let guard = 0, sawRoundEnd = false, sawRound2 = false;
  while (tb.state.phase !== 'gameOver' && guard++ < 3000) {
    if (tb.state.phase === 'roundEnd') sawRoundEnd = true;
    if (tb.state.roundNo === 2) sawRound2 = true;
    if (!await step(tb)) throw new Error('ตันที่ช่วง ' + tb.state.phase);
  }
  ok('เดินจนจบเกมได้', tb.state.phase, 'gameOver');
  ok('ผ่านช่วงจบรอบ', sawRoundEnd);
  ok('เล่นถึงรอบสอง', sawRound2);
  ok('จบที่รอบ 2', tb.state.roundNo, 2);
  ok('มีอันดับครบ 5 คน', tb.state.ranking.length, 5);
  ok('มีชื่อตำแหน่งครบ', tb.state.titles.map(x => x.title),
     ['king', 'queen', 'people', 'viceSlave', 'slave']);
  ok('ไม่ตั้งนาฬิกาเมื่อปิดจับเวลา', tb.state.deadline, null);
}

/* ── ช่วงแลกไพ่ ────────────────────────────────────── */
group('รอบสองต้องผ่านช่วงแลกไพ่');
{
  const tb = makeTable(4, { mode: 'normal', turnSeconds: 0 });
  tb.boot();
  let guard = 0;
  while (tb.state.phase !== 'roundEnd' && guard++ < 3000) await step(tb);

  const rank = [...tb.state.ranking];
  await tb.act({ uid: tb.hostUid, type: 'next', payload: {} });

  ok('เข้าสู่ช่วงแลกไพ่', tb.state.phase, 'exchange');
  ok('มีคู่แลกสองคู่', tb.state.exchange.pairs.length, 2);
  ok('คิงแลกกับสลาฟ 2 ใบ',
     tb.state.exchange.pairs[0], { upper: rank[0], lower: rank[3], count: 2 });
  ok('ควีนแลกกับรองสลาฟ 1 ใบ',
     tb.state.exchange.pairs[1], { upper: rank[1], lower: rank[2], count: 1 });

  const king = rank[0], slave = rank[3];
  const before = { king: tb.hand(king).length, slave: tb.hand(slave).length };
  const slaveBest = [...tb.hand(slave)].slice(-2);

  while (tb.state.phase === 'exchange') await step(tb);

  ok('แลกครบแล้วเข้าสู่ช่วงเล่น', tb.state.phase, 'play');
  ok('จำนวนไพ่ของคิงเท่าเดิม', tb.hand(king).length, before.king);
  ok('จำนวนไพ่ของสลาฟเท่าเดิม', tb.hand(slave).length, before.slave);
  ok('ไพ่ดีที่สุดของสลาฟย้ายไปอยู่กับคิง',
     slaveBest.every(c => tb.hand(king).includes(c)));
  ok('สลาฟไม่มีไพ่สองใบนั้นแล้ว',
     slaveBest.some(c => tb.hand(slave).includes(c)), false);
  ok('สลาฟเป็นคนเริ่มรอบสอง', tb.state.turn, rank[3]);
}

/* ── โหมดไม่รู้จบและคะแนน ──────────────────────────── */
group('โหมดไม่รู้จบ โหวตเล่นต่อและสะสมคะแนน');
{
  const tb = makeTable(5, { mode: 'endless', turnSeconds: 0 });
  tb.boot();
  ok('ทุกคนเริ่มที่ 0 คะแนน', Object.values(tb.state.scores), [0, 0, 0, 0, 0]);

  let guard = 0;
  while (tb.state.phase !== 'roundEnd' && guard++ < 3000) await step(tb);

  ok('จบรอบแล้วมีคะแนนที่เพิ่งได้', typeof tb.state.gained, 'object');
  ok('คิงได้อย่างน้อย 500 จากอันดับ', tb.state.gained[tb.state.ranking[0]] >= 500);
  ok('ยังไม่มีใครโหวต', Object.keys(tb.state.votes).length, 0);

  const totalBefore = Object.values(tb.state.scores).reduce((a, b) => a + b, 0);
  ok('คะแนนรวมมากกว่า 0 แล้ว', totalBefore > 0);

  // โหวตเล่นต่อทุกคน
  for (const uid of tb.state.seats) {
    if (tb.state.phase !== 'roundEnd') break;
    await tb.act({ uid, type: 'vote', payload: { yes: true } });
  }
  ok('โหวตครบแล้วไปต่อรอบสอง', tb.state.roundNo, 2);
  ok('ไม่อยู่ในช่วงจบรอบแล้ว', tb.state.phase !== 'roundEnd');

  // เล่นรอบสองจนจบ แล้วมีคนโหวตไม่เล่นต่อ
  guard = 0;
  while (tb.state.phase !== 'roundEnd' && guard++ < 3000) await step(tb);
  await tb.act({ uid: tb.state.seats[0], type: 'vote', payload: { yes: false } });
  for (const uid of tb.state.seats.slice(1)) {
    if (tb.state.phase !== 'roundEnd') break;
    await tb.act({ uid, type: 'vote', payload: { yes: true } });
  }
  ok('มีคนไม่เล่นต่อ เกมจบ', tb.state.phase, 'gameOver');
  ok('คะแนนสะสมข้ามรอบจริง',
     Object.values(tb.state.scores).reduce((a, b) => a + b, 0) > totalBefore);
}

/* ── นาฬิกาจับเวลา ─────────────────────────────────── */
group('นาฬิกาหมดตา');
{
  const tb = makeTable(4, { mode: 'normal', turnSeconds: 5 });
  tb.boot();
  ok('ตั้งเวลาหมดตาไว้แล้ว', typeof tb.state.deadline, 'number');
  ok('เวลาหมดอยู่ในอนาคต', tb.state.deadline > Date.now());

  ok('ยังไม่ถึงเวลา นาฬิกาไม่ทำอะไร', await tb.clock(), false);

  const before = tb.state.turn;
  tb.state.deadline = Date.now() - 1000;          // ดันให้หมดเวลา
  ok('หมดเวลาแล้วระบบลงให้', await tb.clock(), true);
  ok('เปลี่ยนตาแล้ว', tb.state.turn !== before);
  ok('มีข้อความบอกว่าหมดเวลา', tb.state.notice.t, 'timeout');
}

/* ── ค้างกองหลังจบ ─────────────────────────────────── */
group('ค้างกองไว้ให้ทันดูว่าใครปิดกอง');
{
  const tb = makeTable(4, { mode: 'normal', turnSeconds: 10 });
  tb.boot();

  // เดินจนกองแรกจบ
  let guard = 0;
  while (!tb.state.holdUntil && tb.state.phase === 'play' && guard++ < 500) {
    const st = tb.state;
    const uid = st.turn;
    let moved = false;
    for (const c of tb.hand(uid)) {
      if (await tb.act({ uid, type: 'play', payload: { cards: [c] } })) { moved = true; break; }
    }
    if (!moved) await tb.act({ uid, type: 'pass', payload: {} });
  }

  ok('กองจบแล้วตั้งเวลาค้างไว้', typeof tb.state.holdUntil, 'number');
  ok('ค้างอยู่ในอนาคต', tb.state.holdUntil > Date.now());
  ok('มีประวัติกองเก็บไว้ให้ดู', tb.state.pileLog.length > 0);
  ok('เก็บประวัติไม่เกิน 4 ครั้ง', tb.state.pileLog.length <= 4);
  ok('นาฬิกาต่อตาเริ่มนับหลังหมดช่วงค้าง', tb.state.deadline >= tb.state.holdUntil);

  const turn = tb.state.turn;
  ok('ระหว่างค้าง ลงไพ่ไม่ได้',
     await tb.act({ uid: turn, type: 'play', payload: { cards: [tb.hand(turn)[0]] } }), false);

  tb.state.holdUntil = 0;                       // เดินเวลาข้ามช่วงค้าง
  let played = false;
  for (const c of tb.hand(tb.state.turn)) {
    if (await tb.act({ uid: tb.state.turn, type: 'play', payload: { cards: [c] } })) { played = true; break; }
  }
  ok('หมดช่วงค้างแล้วลงได้ตามปกติ', played);
  ok('ขึ้นกองใหม่แล้วประวัติเริ่มนับใหม่', tb.state.pileLog.length, 1);
}

/* ── ทุกคนต้องกดพร้อมก่อนไปรอบต่อไป ────────────────── */
group('โหมดปกติต้องรอทุกคนกดพร้อม');
{
  const tb = makeTable(4, { mode: 'normal', turnSeconds: 0 });
  tb.boot();
  let guard = 0;
  while (tb.state.phase !== 'roundEnd' && guard++ < 3000) await step(tb);

  const seats = [...tb.state.seats];
  ok('จบรอบแล้วยังไม่มีใครกดพร้อม', Object.keys(tb.state.votes).length, 0);

  await tb.act({ uid: seats[0], type: 'vote', payload: { yes: true } });
  ok('คนแรกกดแล้วยังอยู่หน้าผล', tb.state.phase, 'roundEnd');
  ok('เห็นว่าใครกดพร้อมแล้ว', tb.state.votes[seats[0]], true);

  for (const uid of seats.slice(1, 3)) await tb.act({ uid, type: 'vote', payload: { yes: true } });
  ok('ยังไม่ครบก็ยังไม่ไปต่อ', tb.state.phase, 'roundEnd');

  await tb.act({ uid: seats[3], type: 'vote', payload: { yes: true } });
  ok('ครบทุกคนแล้วไปรอบสอง', tb.state.roundNo, 2);
}

/* ── การแลกไพ่ต้องบอกว่าเสียอะไรได้อะไร ────────────── */
group('บันทึกผลการแลกไพ่ไว้ให้เห็น');
{
  const tb = makeTable(4, { mode: 'normal', turnSeconds: 0 });
  tb.boot();
  let guard = 0;
  while (tb.state.phase !== 'roundEnd' && guard++ < 3000) await step(tb);
  const rank = [...tb.state.ranking];
  for (const uid of tb.state.seats) {
    if (tb.state.phase !== 'roundEnd') break;
    await tb.act({ uid, type: 'vote', payload: { yes: true } });
  }
  while (tb.state.phase === 'exchange') await step(tb);

  const king = rank[0], slave = rank[3];
  ok('คิงรู้ว่าได้อะไรมา', (tb.secret(king).lastGot || []).length, 2);
  ok('คิงรู้ว่าให้อะไรไป', (tb.secret(king).lastGave || []).length, 2);
  ok('สลาฟรู้ว่าเสียอะไรไป', (tb.secret(slave).lastGave || []).length, 2);
  ok('ของที่คิงได้ คือของที่สลาฟเสีย',
     tb.secret(king).lastGot.slice().sort(), tb.secret(slave).lastGave.slice().sort());
  ok('ไพ่ที่ได้มายังอยู่ในมือจริง',
     tb.secret(king).lastGot.every(c => tb.hand(king).includes(c)));
}

/* ── คำขอที่ผิดกติกาต้องถูกปฏิเสธเงียบ ─────────────── */
group('คำขอที่ผิดกติกา');
{
  const tb = makeTable(4, { mode: 'normal', turnSeconds: 0 });
  tb.boot();
  const turn = tb.state.turn;
  const other = tb.state.seats.find(u => u !== turn);

  ok('คนที่ไม่ใช่ตาตัวเองลงไม่ได้',
     await tb.act({ uid: other, type: 'play', payload: { cards: [tb.hand(other)[0]] } }), false);
  ok('คนเริ่มกองผ่านไม่ได้',
     await tb.act({ uid: turn, type: 'pass', payload: {} }), false);
  ok('ลงไพ่ที่ไม่ได้อยู่ในมือไม่ได้',
     await tb.act({ uid: turn, type: 'play', payload: { cards: [tb.hand(other)[0]] } }), false);
  ok('ลงโดยไม่มีดอกจิก 3 ในกองแรกไม่ได้',
     await tb.act({ uid: turn, type: 'play',
       payload: { cards: [tb.hand(turn).find(c => c !== '3C')] } }), false);
  ok('สถานะไม่ถูกแตะเลย', tb.state.pile, null);
}

console.log(`\n${'─'.repeat(46)}\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);
process.exit(fail ? 1 : 0);
