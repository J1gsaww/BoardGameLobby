/* game.js — Wreckers ฝั่งกติกา
   ─────────────────────────────────────────────────────────────
   ไฟล์นี้ทำหน้าที่ต่อสายอย่างเดียว — รับคำขอจากผู้เล่น ตรวจสิทธิ์
   เรียกกฎใน rules.js แล้วส่งสถานะใหม่กลับ ไม่มีกติกาเขียนซ้ำในนี้

   มือไพ่โหวตกับไพ่ประเทศเก็บใน secrets ของแต่ละคน เจ้าของห้องเห็นครบ
   คนอื่นเห็นแต่ของตัวเอง สถานะสาธารณะเก็บแค่จำนวนใบ ไม่เก็บว่าใบไหน

   ยังไม่ได้ทำในไฟล์นี้ — ผลของการ์ด Event ทั้ง 49 ใบ
   ปุ่ม activate / peek / force จึงกินสิทธิ์ Action ไปเฉย ๆ ก่อน
   ไว้ทำชั้นการ์ดแล้วค่อยมาต่อผลของแต่ละใบ */

import {
  SHIP_SLOTS, EVENT_SLOTS, MAX_VOTE, graceMs, rollStarter, OFFLINE_WAIT
} from './board.js';
import { deal } from './vote.js';
import { BASE_CARDS, ENDER, ENDER_ZONE } from './events.js';
import { EXTRA_CARDS } from './cards.js';
import {
  SHIP_IDS, BOAT_IDS, BOAT_LINK, VOTE_ROW,
  placeOf, occupants, joinPlace, isPlaying,
  actionsFor, boatsOpen, maroon, pileOf, shuffle, redeal, advance, burnVoteBans, clearVoteWeights,
  buildEventDeck, refillSlots, emptyDeck,
  startVote, voteReady, tallyRow, attackPasses, mutinyPasses, brawlSplit,
  moveBox, score, winningSide, winners, dealNations, pushLog
} from './rules.js';

/* เวลาค้างหน้าไพ่ประเทศก่อนเริ่มทอยลูกเต๋า */
export const REVEAL_MS = 3000;

const seated = (members) =>
  members.filter(m => m.role === 'player' && !m.left && m.seat !== null)
         .sort((a, b) => a.seat - b.seat);

/* ── เปิดเกม ───────────────────────────────────────────────── */

export function init(ctx) {
  const seats = shuffle(seated(ctx.members).map(p => p.uid));

  /* แจกตำแหน่งสลับลำไปทีละคนตามลำดับศักดิ์
     กัปตันซ้าย · กัปตันขวา · ต้นหนซ้าย · ต้นหนขวา · ลูกเรือซ้าย · ลูกเรือขวา ... */
  const pos = {};
  seats.forEach((uid, i) => {
    const ship = i % 2 === 0 ? 'shipL' : 'shipR';
    const slot = SHIP_SLOTS[Math.floor(i / 2)];
    if (slot) pos[uid] = `${ship}:${slot.id}`;
  });

  const die = rollStarter(seats.length);
  /* 0 = ไม่จับเวลา จึงเช็กว่าเป็นตัวเลขจริงไหม ไม่ใช้ || เพราะศูนย์จะโดนมองว่าไม่มีค่า */
  const raw = Number(ctx.settings?.turnSeconds);
  const turnSeconds = Number.isFinite(raw) ? raw : 60;
  const { hands, pile } = deal(seats, MAX_VOTE);
  const nations = dealNations(seats, String(ctx.settings?.dutch || 'auto'));

  /* สำรับเหตุการณ์ = ชุดมาตรฐาน บวกชุดพิเศษเฉพาะชนิดที่เลือกไว้ในหน้าตั้งค่า */
  const picked = new Set(ctx.settings?.extraCards || []);
  const catalogue = [...BASE_CARDS, ...EXTRA_CARDS.filter(c => picked.has(c.id))];
  const order = buildEventDeck(catalogue, ENDER, ENDER_ZONE);
  const deck = refillSlots({ ...emptyDeck(), draw: order }, EVENT_SLOTS);

  return {
    state: {
      /* เปิดมาโชว์ไพ่ประเทศก่อน ค้างไว้สามวินาที แล้วค่อยทอยลูกเต๋าหาคนเริ่ม
         ต้องเป็นช่วงของตัวเองในสถานะ ไม่ใช่แค่หน่วงในหน้าจอ
         ไม่งั้นคนเข้าช้าหรือรีเฟรชกลางคันจะไม่เห็น หรือเห็นไม่พร้อมกัน */
      phase: 'reveal',
      revealMs: REVEAL_MS,
      roundNo: 1,
      seats,
      names: Object.fromEntries(ctx.members.map(m => [m.uid, m.name || ''])),
      out: [],
      turn: seats[die.face - 1] || seats[0] || null,
      turnSeconds,
      deadline: Date.now() + REVEAL_MS,
      graced: false,
      die,
      pos,
      boatFrom: {},
      events: deck.slots.filter(Boolean).length,
      extraCards: [...(ctx.settings?.extraCards || [])],
      eventDeck: deck.draw.length,
      voteDeck: pile.length,
      votes: Object.fromEntries(seats.map(u => [u, hands[u].length])),
      maxVote: Object.fromEntries(seats.map(u => [u, MAX_VOTE])),
      held: Object.fromEntries(seats.map(u => [u, 0])),
      cargo: {
        shipL: { B: 1, F: 0 },
        shipR: { B: 0, F: 1 },
        island: { B: 1, F: 1 },
        merchant: 4
      },
      vote: null,
      noVotes: false,
      log: [],
      logSeq: 0,
      result: null
    },
    secrets: {
      ...Object.fromEntries(seats.map(u => [u, { vote: hands[u], nation: nations[u], pick: null }])),
      _deck: deck                            /* ไม่มีผู้เล่นคนไหน uid ชื่อนี้ เจ้าของห้องจึงอ่านได้คนเดียว */
    }
  };
}

/* ── ตัวช่วยที่ต้องอ่าน secrets ─────────────────────────────
   เจ้าของห้องเท่านั้นที่เรียกฟังก์ชันพวกนี้ เพราะมีแต่เขาที่เห็นมือครบทุกคน */
/* ช่องที่ขึ้นต้นด้วยขีดล่างไม่ใช่ของผู้เล่น เป็นที่เก็บของกลางที่เจ้าของห้องอ่านได้คนเดียว
   ต้องกรองออกทุกครั้ง ไม่งั้นจะไปเขียนทับสำรับด้วยข้อมูลมือไพ่ */
const playerSecrets = (ctx) =>
  Object.entries(ctx.secrets || {}).filter(([u]) => !u.startsWith('_'));

const handsOf = (ctx) =>
  Object.fromEntries(playerSecrets(ctx).map(([u, s]) => [u, s?.vote || []]));

const nationsOf = (ctx) =>
  Object.fromEntries(playerSecrets(ctx).map(([u, s]) => [u, s?.nation || null]));

const deckOf = (ctx) => ctx.secrets?._deck || emptyDeck();

const secretsFrom = (ctx, hands, picks = {}) =>
  Object.fromEntries(playerSecrets(ctx).map(([u, s]) => [
    u, { ...s, vote: hands[u] ?? s?.vote ?? [], pick: picks[u] ?? null }
  ]));

const countHands = (hands) =>
  Object.fromEntries(Object.entries(hands).map(([u, h]) => [u, h.length]));

const pickMap = (ctx) =>
  Object.fromEntries(playerSecrets(ctx)
    .filter(([, s]) => s?.pick).map(([u, s]) => [u, s.pick]));

/* ── เปิดตาถัดไป ───────────────────────────────────────────
   ขึ้นฝั่งจากเรือเล็กเป็นของแถม ทำให้ตอนเปิดตาเลย ไม่กินสิทธิ์ Action
   ถ้าปลายทางเต็มก็ค้างอยู่บนเรือเล็กต่อ รอบหน้าค่อยลองใหม่ */
export function openTurn(st) {
  const uid = st.turn;
  const place = placeOf(st.pos?.[uid]);
  if (!BOAT_IDS.includes(place)) return st;

  const came = st.boatFrom?.[uid];
  const to = (BOAT_LINK[place] || []).find(p => p !== came) || 'island';
  const moved = joinPlace(st.pos, uid, to);
  if (!moved) return pushLog(st, 'wreck.log.boatStuck', { name: st.names?.[uid], place: to });

  const boatFrom = { ...(st.boatFrom || {}) };
  delete boatFrom[uid];
  return pushLog({ ...st, pos: moved, boatFrom }, 'wreck.log.ashore',
                 { name: st.names?.[uid], place: to });
}

/* ไม่จับเวลา = ไม่มีเส้นตาย ไม่ใช่เส้นตายยาว ๆ
   เส้นตายจะถูกตั้งเฉพาะตอนคนที่ถึงตาหลุดไปเท่านั้น */
export const turnDeadline = (st, now = Date.now()) =>
  st.turnSeconds ? now + st.turnSeconds * 1000 : null;

export function passTurn(st, now = Date.now()) {
  const { state, uid } = advance(st);        /* คนที่ติดหนี้ข้ามเทิร์นถูกหักหนี้แล้วข้ามไปในนี้ */
  return openTurn({
    ...state,
    turn: uid,
    deadline: turnDeadline(state, now),
    graced: false,
    vote: null,
    peek: null            /* แอบดูค้างอยู่แล้วหมดเวลา ก็ทิ้งไปพร้อมตา */
  });
}

/* ── คำขอจากผู้เล่น ────────────────────────────────────────── */

export async function onAction(ctx, action) {
  const st = ctx.state;
  const { uid, type, payload = {} } = action;
  if (!st || st.phase === 'over') return null;

  /* เครื่องมือทดสอบสั่งได้ตั้งแต่ช่วงเปิดไพ่ประเทศ จะได้จัดสำรับก่อนเริ่มเล่นจริง */
  if (type === 'devCard') return devCard(ctx, uid, payload);
  if (st.phase !== 'play') return null;

  /* ส่งไพ่โหวตทำได้นอกตาตัวเอง เป็นทางเดียวที่ไม่ต้องรอถึงตา */
  if (type === 'voteCard') return submitVote(ctx, uid, payload.card);
  if (type === 'endGame') return finish(ctx);

  if (st.turn !== uid || st.vote) return null;
  if (!isPlaying(st, uid)) return null;
  if (!actionsFor(st, uid).includes(type)) return null;

  switch (type) {
    case 'toBoat':     return toBoat(ctx, uid, payload.boat);
    case 'kick':       return kick(ctx, uid, payload.uid);
    case 'shiftCargo': return shiftCargo(ctx, uid, payload.from);
    case 'attack':     return callVote(ctx, uid, 'attack', payload);
    case 'mutiny':     return callVote(ctx, uid, 'mutiny', payload);
    case 'islandVote': return callVote(ctx, uid, 'islandVote', payload);

    case 'activate': return activate(ctx, uid, payload);
    case 'peek':     return peek(ctx, uid, payload);

    /* บังคับให้คนอื่นเปิด ยังไม่ได้ทำ กินสิทธิ์ Action ไปก่อน */
    case 'force':
      return { state: passTurn(pushLog(st, 'wreck.log.force', { name: st.names?.[uid] })) };

    default: return null;
  }
}

/* ── เครื่องมือทดสอบ: วางการ์ดที่ต้องการลงในช่อง ──────────
   ใบเดิมในช่องถูกดันกลับลงกองล่างสุด แล้วเอาใบที่เลือกมาวางแทน
   จำนวนใบทั้งสำรับจึงไม่เปลี่ยน เทสแล้วเล่นต่อได้เลยไม่ต้องเปิดเกมใหม่

   เจ้าของห้องเท่านั้นที่สั่งได้ — เขาคุมสถานะทั้งเกมอยู่แล้ว จึงไม่เปิดช่องโหว่ใหม่ */
function devCard(ctx, uid, { slot, id }) {
  if (uid !== ctx.hostUid) return null;
  const st = ctx.state;
  const i = Number(slot);
  if (!Number.isInteger(i) || i < 0 || i >= EVENT_SLOTS) return null;

  const deck = deckOf(ctx);
  const slots = [...deck.slots];
  const draw = [...deck.draw];

  const at = draw.indexOf(id);
  if (at >= 0) draw.splice(at, 1);            /* ดึงใบที่ขอมาจากกอง ถ้ายังอยู่ในกอง */
  if (slots[i]) draw.push(slots[i]);          /* ใบเดิมลงไปนอนใต้กอง */
  slots[i] = id;

  return {
    state: pushLog({ ...st, eventDeck: draw.length }, 'wreck.log.devCard', { slot: i + 1 }),
    secrets: { _deck: { ...deck, slots, draw } }
  };
}

/* ── เปิดการ์ดเหตุการณ์ ────────────────────────────────────
   เปิดแล้วใบนั้นออกจากโต๊ะไปกองทิ้ง แล้วจั่วใบใหม่มาเติมช่องทันที
   ผลของการ์ดยังไม่ได้ทำ ตอนนี้แค่เปิดให้เห็นว่าเป็นใบอะไรและสำรับเดินจริง */
function activate(ctx, uid, { slot }) {
  const st = ctx.state;
  const i = Number(slot);
  const deck = deckOf(ctx);
  const id = deck.slots?.[i];
  if (!Number.isInteger(i) || !id) return null;

  const slots = [...deck.slots];
  slots[i] = null;
  const next = refillSlots({ ...deck, slots, discard: [...(deck.discard || []), id] }, EVENT_SLOTS);

  const shown = {
    ...st,
    events: next.slots.filter(Boolean).length,
    eventDeck: next.draw.length,
    /* เปิดแล้วทุกคนต้องเห็นว่าเป็นใบอะไร เก็บไว้ในสถานะสาธารณะ */
    lastEvent: { id, by: uid, slot: i, at: (st.logSeq || 0) + 1 }
  };

  return {
    state: passTurn(pushLog(shown, 'wreck.log.activate', { name: st.names?.[uid] })),
    secrets: { _deck: next }
  };
}

/* ── แอบดู ─────────────────────────────────────────────────
   กติกาคือดูสองใบแล้ววางกลับที่เดิม สำรับไม่ขยับเลยสักใบ

   ดูทีละใบ ใบแรกยังไม่จบตา — เก็บไว้ใน st.peek ว่าค้างอยู่กี่ใบ
   ระหว่างนั้นเจ้าตัวทำอย่างอื่นไม่ได้เลยนอกจากดูใบที่สอง
   บนโต๊ะเหลือใบเดียวก็ดูได้ใบเดียวแล้วจบ ไม่ค้างรอของที่ไม่มี

   สิ่งที่เห็นเก็บในข้อมูลลับของคนดูคนเดียว
   ส่วนช่องที่เปิดดูเป็นข้อมูลสาธารณะ เพราะบนโต๊ะจริงทุกคนก็เห็นว่าหยิบใบไหนขึ้นมาดู */
function peek(ctx, uid, { slot }) {
  const st = ctx.state;
  const i = Number(slot);
  if (!Number.isInteger(i) || i < 0 || i >= EVENT_SLOTS) return null;

  const deck = deckOf(ctx);
  const id = deck.slots?.[i];
  if (!id) return null;

  const cur = st.peek?.uid === uid ? st.peek : null;
  if (cur?.slots.includes(i)) return null;          /* ใบเดิมดูซ้ำไม่ได้ */

  const need = Math.min(2, deck.slots.filter(Boolean).length);
  const slots = [...(cur?.slots || []), i];
  const mine = ctx.secrets?.[uid] || {};

  /* เริ่มดูรอบใหม่ = ล้างของเก่าทิ้ง · ดูใบที่สองต่อ = ต่อท้ายของรอบนี้ */
  const seen = [...(cur ? (mine.peek?.seen || []) : []), { slot: i, id }];
  const secrets = { [uid]: { ...mine, peek: { seen, at: (st.logSeq || 0) + 1 } } };

  if (slots.length < need) {
    return {
      state: pushLog({ ...st, peek: { uid, slots, left: need - slots.length } },
                     'wreck.log.peekOne', { name: st.names?.[uid], n: need - slots.length }),
      secrets
    };
  }

  const done = pushLog({ ...st, peek: null }, 'wreck.log.peek',
                       { name: st.names?.[uid], n: slots.length });
  return { state: passTurn(done), secrets };
}

/* ลงเรือเล็ก — จองที่ไว้ กันคนที่เล่นต่อจากเราใช้ลำนั้น */
function toBoat(ctx, uid, boat) {
  const st = ctx.state;
  if (!boatsOpen(st, st.pos[uid]).includes(boat)) return null;

  const came = placeOf(st.pos[uid]);
  const moved = joinPlace(st.pos, uid, boat);
  if (!moved) return null;

  const next = pushLog({
    ...st, pos: moved,
    boatFrom: { ...(st.boatFrom || {}), [uid]: came }
  }, 'wreck.log.toBoat', { name: st.names?.[uid] });

  return { state: passTurn(next) };
}

/* กัปตันไล่คนลงจากเรือ — เด้งลงเกาะเลย ไม่ผ่านเรือเล็ก และไล่ตัวเองไม่ได้ */
function kick(ctx, uid, targetUid) {
  const st = ctx.state;
  const place = placeOf(st.pos[uid]);
  if (!targetUid || targetUid === uid) return null;
  if (placeOf(st.pos[targetUid]) !== place) return null;

  const hands = handsOf(ctx);
  const done = maroon(st, targetUid, hands);
  const next = pushLog(done.state, 'wreck.log.kick',
                       { name: st.names?.[uid], who: st.names?.[targetUid] });

  return { state: passTurn(next), secrets: secretsFrom(ctx, done.hands) };
}

/* ลูกเรือย้ายกล่องบนเรือตัวเอง ข้ามฝั่งประเทศไปอีกฝั่งหนึ่งกล่อง */
function shiftCargo(ctx, uid, from) {
  const st = ctx.state;
  const ship = placeOf(st.pos[uid]);
  const side = from === 'F' ? 'F' : 'B';
  const cargo = moveBox(st.cargo, ship, side, ship, side === 'B' ? 'F' : 'B');
  if (!cargo) return null;

  return {
    state: passTurn(pushLog({ ...st, cargo }, 'wreck.log.shift',
                            { name: st.names?.[uid], side }))
  };
}

/* ── สั่งโหวต ──────────────────────────────────────────────
   สั่งแล้วเกมค้างรอทุกคนในสถานที่นั้นส่งไพ่ ไม่ผ่านตาไปจนกว่าจะเปิดผล */
function callVote(ctx, uid, kind, payload) {
  const st = ctx.state;
  const place = placeOf(st.pos[uid]);

  if (kind === 'attack') {
    const others = ['merchant', ...SHIP_IDS.filter(s => s !== place)];
    if (!others.includes(payload.target)) return null;
  }

  const opened = startVote(st, {
    kind, place, caller: uid,
    target: payload.target || null,
    side: payload.side === 'F' ? 'F' : 'B'
  });
  opened.vote.from = payload.from === 'F' ? 'F' : 'B';

  return {
    state: pushLog({ ...opened, deadline: turnDeadline(st) },
                   'wreck.log.call.' + kind, { name: st.names?.[uid] }),
    secrets: secretsFrom(ctx, handsOf(ctx))       /* ล้างไพ่ที่เลือกค้างจากโหวตครั้งก่อน */
  };
}

/* ส่งไพ่เข้าหม้อ — เก็บไว้ในข้อมูลลับของเจ้าตัว คนอื่นเห็นแค่ว่าส่งแล้ว */
function submitVote(ctx, uid, cardId) {
  const st = ctx.state;
  if (!st.vote || !st.vote.voters.includes(uid)) return null;
  if (st.vote.done.includes(uid)) return null;

  const hands = handsOf(ctx);
  if (!(hands[uid] || []).includes(cardId)) return null;

  const picks = pickMap(ctx);
  picks[uid] = cardId;
  const left = { ...hands, [uid]: hands[uid].filter(c => c !== cardId) };

  const next = {
    ...st,
    votes: countHands(left),
    vote: { ...st.vote, done: [...st.vote.done, uid] }
  };

  if (!voteReady(next)) return { state: next, secrets: secretsFrom(ctx, left, picks) };
  return reveal(ctx, next, left, picks);
}

/* ── เปิดหม้อ ──────────────────────────────────────────────
   ไพ่ในหม้อ = ไพ่ที่ทุกคนส่ง บวกไพ่จากกองกลางอีกหนึ่งใบเสมอ
   ใบจากกองกลางคือเหตุผลที่กัปตันสั่งโจมตีคนเดียวได้ ผลจึงไม่แน่นอนทุกครั้ง

   เปิดผลแล้วไพ่ทั้งหมดกลับเข้ากอง สับใหม่ทั้งสำรับ
   แล้วแจกคืนทุกคนตามเพดานของแต่ละคน */
export function reveal(ctx, st, hands, picks, rng = Math.random) {
  const v = st.vote;
  const submitted = v.voters.map(u => picks[u]).filter(Boolean);
  const bonus = shuffle(pileOf(hands, submitted), rng).slice(0, v.extra || 1);
  const pot = shuffle([...submitted, ...bonus], rng);

  const counts = tallyRow(pot, VOTE_ROW[v.kind]);
  let next = { ...st, vote: { ...v, pot, counts } };
  let handsOut = hands;

  if (v.kind === 'attack') next = resolveAttack(next, counts);
  else if (v.kind === 'mutiny') {
    const done = resolveMutiny(next, counts, handsOut);
    next = done.state; handsOut = done.hands;
  } else if (v.kind === 'islandVote') next = resolveBrawl(next, counts);

  /* ตัวนับห้ามโหวตหักตรงนี้ ไม่ใช่ตอนสั่งโหวต — คนที่ถูกกันจึงเสียสิทธิ์ครบตามจำนวนครั้งจริง
     ส่วนน้ำหนักเสียงพิเศษใช้ได้ครั้งเดียว จบหม้อนี้ก็ล้างทิ้ง */
  next = clearVoteWeights(burnVoteBans(next, Object.keys(next.voteBan || {})));

  /* สับใหม่ทั้งสำรับแล้วแจกคืน — ทุกคนได้มือใหม่หมดหลังโหวตทุกครั้ง */
  const fresh = redeal(next.seats, next.maxVote, rng);
  next = {
    ...next,
    votes: countHands(fresh.hands),
    voteDeck: fresh.pile.length,
    /* เก็บผลไว้ให้หน้าจอโชว์ต่อ เพราะ passTurn จะล้าง vote ทิ้ง */
    lastVote: { kind: v.kind, place: v.place, caller: v.caller, target: v.target,
                pot, counts, at: (next.logSeq || 0) }
  };

  return { state: passTurn(next), secrets: secretsFrom(ctx, fresh.hands) };
}

export function resolveAttack(st, n) {
  const v = st.vote;
  if (!attackPasses(n)) return pushLog(st, 'wreck.log.attackFail', {});

  const cargo = moveBox(st.cargo, v.target, v.from || 'B', v.place, v.side || 'B');
  if (!cargo) return pushLog(st, 'wreck.log.attackNoRoom', {});

  return pushLog({ ...st, cargo }, 'wreck.log.attackWin',
                 { target: v.target, side: v.side || 'B' });
}

export function resolveMutiny(st, n, hands) {
  if (!mutinyPasses(n)) return { state: pushLog(st, 'wreck.log.mutinyFail', {}), hands };

  const cap = occupants(st.pos, st.vote.place)[0];        /* หัวแถวคือกัปตันเสมอ */
  if (!cap) return { state: pushLog(st, 'wreck.log.mutinyFail', {}), hands };

  const done = maroon(st, cap, hands);
  return {
    state: pushLog(done.state, 'wreck.log.mutinyWin', { who: st.names?.[cap] }),
    hands: done.hands
  };
}

export function resolveBrawl(st, n) {
  const total = st.cargo.island.B + st.cargo.island.F;
  const split = brawlSplit(n, total);
  return pushLog({ ...st, cargo: { ...st.cargo, island: split } },
                 'wreck.log.brawl', { B: split.B, F: split.F });
}

/* ── นาฬิกา ───────────────────────────────────────────────
   สามเรื่องคนละกรณีกัน
     1) ช่วงโชว์ไพ่ประเทศหมดเวลา — เข้าสู่การทอยลูกเต๋าแล้วเริ่มเล่น
     2) โหวตค้าง — ส่งไพ่แทนคนที่ยังไม่ส่ง แล้วเปิดผลเลย
     3) ตาปกติหมดเวลา — ผ่อนผันให้คนหลุดก่อนหนึ่งครั้ง แล้วค่อยข้าม

   โหมดไม่จับเวลาไม่มีเส้นตายเลย จนกว่าจะมีคนหลุด ถึงจะตั้งเพดาน 120 วินาที
   กลับมาก่อนหมดเพดานก็ยกเลิกให้ ไม่โดนข้ามตา */
export async function tick(ctx) {
  const st = ctx.state;
  if (!st || st.phase === 'over') return null;

  const now = Date.now();
  const due = !!st.deadline && now >= st.deadline - 250;
  const offline = (uid) => {
    const m = ctx.members.find(x => x.uid === uid);
    return !!m && !m.online;
  };

  if (st.phase === 'reveal') {
    if (!due) return null;
    return { state: openTurn({ ...st, phase: 'play', deadline: turnDeadline(st, now) }) };
  }

  if (st.vote) {
    if (!due) {
      if (st.deadline) return null;
      const stuck = st.vote.voters.some(u => !st.vote.done.includes(u) && offline(u));
      return stuck ? { state: { ...st, deadline: now + OFFLINE_WAIT } } : null;
    }

    const hands = handsOf(ctx);
    const picks = pickMap(ctx);
    let left = hands;
    let next = st;

    for (const uid of st.vote.voters) {
      if (next.vote.done.includes(uid)) continue;
      const hand = left[uid] || [];
      const card = hand[Math.floor(Math.random() * hand.length)];
      if (card) {
        picks[uid] = card;
        left = { ...left, [uid]: hand.filter(c => c !== card) };
      }
      next = { ...next, vote: { ...next.vote, done: [...next.vote.done, uid] } };
    }
    return reveal(ctx, { ...next, votes: countHands(left) }, left, picks);
  }

  if (!due) {
    if (!st.deadline) {
      /* ไม่จับเวลาและยังไม่มีเพดาน — ตั้งให้เฉพาะตอนคนที่ถึงตาหลุดไป */
      return offline(st.turn) ? { state: { ...st, deadline: now + OFFLINE_WAIT, graced: true } } : null;
    }
    /* กลับมาแล้วก่อนหมดเพดาน ยกเลิกให้ เล่นต่อได้ตามสบาย */
    if (!st.turnSeconds && !offline(st.turn)) return { state: { ...st, deadline: null, graced: false } };
    return null;
  }

  if (st.turnSeconds && offline(st.turn) && !st.graced) {
    return { state: { ...st, graced: true, deadline: now + graceMs(st.turnSeconds) } };
  }
  return { state: passTurn(pushLog(st, 'wreck.log.timeout', { name: st.names?.[st.turn] }), now) };
}

/* ── จบเกม ────────────────────────────────────────────────
   ตอนนี้ยังไม่มีการ์ด Spanish Armada จึงเปิดให้เรียกตรง ๆ ไว้ทดสอบก่อน
   พอทำชั้นการ์ดแล้ว ใบนั้นจะมาเรียกฟังก์ชันนี้แทน */
export function finish(ctx) {
  const st = ctx.state;
  const nations = nationsOf(ctx);
  return {
    state: {
      ...st,
      phase: 'over',
      vote: null,
      deadline: null,
      result: {
        score: score(st.cargo),
        side: winningSide(st.cargo),
        winners: winners(st.cargo, nations),
        nations
      }
    }
  };
}
