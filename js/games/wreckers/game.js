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
  SHIP_SLOTS, EVENT_SLOTS, MAX_VOTE, graceMs, rollStarter, OFFLINE_WAIT, PICK_MS
} from './board.js';
import { deal } from './vote.js';
import { BASE_CARDS, ENDER, ENDER_ZONE } from './events.js';
import { effectOf, needsOf, targetsOf } from './effects.js';
import { EXTRA_CARDS } from './cards.js';
import {
  SHIP_IDS, BOAT_IDS, BOAT_LINK, VOTE_ROW,
  placeOf, occupants, joinPlace, isPlaying,
  actionsFor, boatsOpen, maroon, pileOf, shuffle, redeal, advance, burnVoteBans, clearVoteWeights,
  buildEventDeck, refillSlots, emptyDeck,
  startVote, voteReady, tallyRow, attackPasses, mutinyPasses, brawlSplit,
  moveBox, score, winningSide, winners, dealNations, pushLog,
  attackTargets, takeSides, keepSides, canAttack
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
    peek: null,           /* แอบดูค้างอยู่แล้วหมดเวลา ก็ทิ้งไปพร้อมตา */
    aim: null,
    pending: null
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
    case 'useCard':    return useCard(ctx, uid, payload);
    case 'attack':     return callVote(ctx, uid, 'attack', payload);
    case 'aimAt':      return aimAt(ctx, uid, payload);
    case 'takeFrom':   return takeFrom(ctx, uid, payload);
    case 'storeAt':    return storeAt(ctx, uid, payload);
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

  /* ช่องนี้ได้ใบใหม่แล้ว ความรู้เดิมของทุกคนเกี่ยวกับช่องนี้ต้องหายไปด้วย
     ไม่งั้นจะเห็นหน้าไพ่เก่าค้างอยู่ทั้งที่ของจริงเปลี่ยนไปแล้ว */
  const cleared = {};
  for (const [u, sec] of playerSecrets(ctx)) {
    if (!sec?.peek?.seen?.some(x => x.slot === i)) continue;
    cleared[u] = { ...sec, peek: { ...sec.peek, seen: sec.peek.seen.filter(x => x.slot !== i) } };
  }

  /* ประกาศชื่อการ์ดให้ทุกคนเห็นทันทีที่เปิด */
  const said = pushLog({ ...shown, cardUp: { id, by: uid, at: (st.logSeq || 0) + 1 } },
                       'wreck.log.activate', { name: st.names?.[uid] });

  /* การ์ดที่ต้องถามก่อน จะยังไม่ผ่านตา เกมค้างรอคนเปิดเลือกเป้าก่อน
     จังหวะเดียวกับการโหวต ผลจึงไม่โผล่ก่อนที่ฉากจะเล่าถึง */
  const needs = needsOf(id);

  return {
    state: needs
      ? { ...said,
          pending: { card: id, by: uid, needs, at: (st.logSeq || 0) + 1 },
          /* คนเลือกหลุดไปแล้วเกมจะค้างตลอดกาล ต้องมีเพดานเวลาเสมอ
             หมดเวลาแล้วผลการ์ดหายไปเลย ไม่สุ่มให้ เพราะการ์ดใบอื่นบางใบ
             สุ่มแล้วจะเสียหายหนักกว่าปล่อยผ่าน */
          deadline: Date.now() + PICK_MS }
      : passTurn(said),
    secrets: { _deck: next, ...cleared }
  };
}

/* ── ใช้ผลของการ์ดที่ค้างรออยู่ ────────────────────────────
   ตรวจเป้าด้วยรายชื่อชุดเดียวกับที่หน้าจอใช้ไฮไลท์
   จะได้ไม่มีทางที่สองที่ตัดสินไม่ตรงกัน */
function useCard(ctx, uid, { target }) {
  const st = ctx.state;
  const p = st.pending;
  if (p?.by !== uid) return null;
  if (!targetsOf(st, uid, p.card).includes(target)) return null;

  const e = effectOf(p.card);
  const hands = handsOf(ctx);
  const out = e.run(st, uid, target, hands);

  const next = pushLog({ ...out.state, pending: null,
                         shout: { ...out.shout, at: (out.state.logSeq || 0) + 1 } },
                       'wreck.log.card.' + p.card,
                       { name: st.names?.[uid], who: st.names?.[target] });

  return {
    state: passTurn(next),
    secrets: out.hands === hands ? undefined : secretsFrom(ctx, out.hands)
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
  const openSlots = slots.map(n => n + 1).join(', ');
  const mine = ctx.secrets?.[uid] || {};

  /* ความรู้เก่าไม่หายเมื่อแอบดูรอบใหม่ — รู้แล้วรู้เลยจนกว่าใบนั้นจะถูกเปิดไป
     เก็บทีละช่อง ช่องเดิมที่ดูซ้ำก็แค่ทับข้อมูลเดิม */
  const keep = (mine.peek?.seen || []).filter(x => x.slot !== i);
  const seen = [...keep, { slot: i, id }];
  const secrets = { [uid]: { ...mine, peek: { seen, at: (st.logSeq || 0) + 1 } } };

  if (slots.length < need) {
    return {
      /* ยังไม่ประกาศตอนดูใบแรก รอให้ครบสองใบก่อน ไม่งั้นประกาศสองรอบติดกัน */
      state: pushLog({ ...st, peek: { uid, slots, left: need - slots.length } },
                     'wreck.log.peekOne', { name: st.names?.[uid], n: need - slots.length }),
      secrets
    };
  }

  const done = pushLog({ ...st, peek: null,
                         lastPeek: { by: uid, slots, at: (st.logSeq || 0) + 1 } },
                       'wreck.log.peek', { name: st.names?.[uid], at: openSlots });
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
  }, 'wreck.log.toBoat', {
    name: st.names?.[uid],
    which: boat === 'boatL' ? ' \u2190' : ' \u2192'
  });

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

  /* ประกาศกลางจอให้ทุกคนเห็นพร้อมกัน ไม่ใช่แค่บรรทัดในบันทึกที่คนมองข้าม */
  const shout = { kind: 'kick', by: uid, who: targetUid, at: (next.logSeq || 0) };

  return { state: passTurn({ ...next, shout }), secrets: secretsFrom(ctx, done.hands) };
}

/* ลูกเรือย้ายกล่องบนเรือตัวเอง ข้ามฝั่งประเทศไปอีกฝั่งหนึ่งกล่อง */
function shiftCargo(ctx, uid, from) {
  const st = ctx.state;
  const ship = placeOf(st.pos[uid]);
  const side = from === 'F' ? 'F' : 'B';
  const cargo = moveBox(st.cargo, ship, side, ship, side === 'B' ? 'F' : 'B');
  if (!cargo) return null;

  const next = pushLog({ ...st, cargo }, 'wreck.log.shift', { name: st.names?.[uid], side });
  /* ประกาศกลางจอ เพราะกล่องขยับทีเดียวเงียบ ๆ คนอื่นมักไม่ทันสังเกต */
  const shout = { kind: 'shift', by: uid, from: side, to: side === 'B' ? 'F' : 'B',
                  at: (next.logSeq || 0) };
  return { state: passTurn({ ...next, shout }) };
}

/* ── สั่งโหวต ──────────────────────────────────────────────
   สั่งแล้วเกมค้างรอทุกคนในสถานที่นั้นส่งไพ่ ไม่ผ่านตาไปจนกว่าจะเปิดผล */
function callVote(ctx, uid, kind) {
  const st = ctx.state;
  const place = placeOf(st.pos[uid]);
  const opened = startVote(st, { kind, place, caller: uid });

  /* ไม่มีใครส่งไพ่ได้เลยสักคน (ทุกคนเพดานเหลือศูนย์หรือโดนห้ามโหวต)
     ต้องเปิดหม้อทันที ไม่งั้นเกมจะค้างรอคนที่ไม่มีวันส่ง
     หม้อจะมีแต่ใบจากกองกลาง ซึ่งยังตัดสินผลได้ตามปกติ */
  if (!opened.vote.voters.length) {
    return reveal(ctx, opened, handsOf(ctx), {});
  }

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
    lastVote: { kind: v.kind, place: v.place, caller: v.caller,
                pot, counts, won: passed(v.kind, counts),
                split: next.lastSplit || null, at: (next.logSeq || 0) }
  };

  /* ยิงติดแล้วยังไม่ผ่านตา ค้างไว้ให้กัปตันเลือกเป้ากับฝั่งก่อน
     ต้องตั้งเส้นตายใหม่ด้วย ไม่งั้นกัปตันหายไปแล้วทั้งวงค้างรอตลอดกาล */
  const closed = next.aim
    ? { ...next, vote: null, deadline: turnDeadline(next) || Date.now() + OFFLINE_WAIT }
    : passTurn(next);

  return { state: closed, secrets: secretsFrom(ctx, fresh.hands) };
}

/* โหวตผ่านแล้วยังไม่ย้ายกล่องทันที — เปิดช่วงให้กัปตันเลือกเป้าและฝั่งก่อน
   ลำดับนี้สำคัญ กัปตันจะได้ไม่ต้องเดิมพันตั้งแต่ยังไม่รู้ว่าจะยิงติดหรือเปล่า */
/* ผลผ่านหรือไม่ผ่าน คิดที่เดียวแล้วส่งให้หน้าจอใช้ ไม่ให้หน้าจอคิดเองซ้ำ */
const passed = (kind, n) =>
  kind === 'attack' ? attackPasses(n)
  : kind === 'mutiny' ? mutinyPasses(n)
  : (n.B || 0) !== (n.R || 0);

export function resolveAttack(st, n) {
  const v = st.vote;
  if (!attackPasses(n)) return pushLog(st, 'wreck.log.attackFail', {});

  return pushLog({
    ...st,
    aim: {
      by: v.caller, place: v.place,
      options: attackTargets(v.place, st.cargo),
      target: null, from: null
    }
  }, 'wreck.log.attackWin', {});
}

/* กัปตันเลือกลำที่จะยิง */
function aimAt(ctx, uid, { target }) {
  const st = ctx.state;
  if (st.aim?.by !== uid) return null;
  if (!st.aim.options.includes(target)) return null;
  return { state: { ...st, aim: { ...st.aim, target, from: null } } };
}

/* ยิงเรืออีกลำต้องเลือกด้วยว่าจะขโมยกล่องจากฝั่งประเทศไหน
   ฝั่งที่ไม่มีกล่องเลยเลือกไม่ได้ ไม่งั้นจะยิงแล้วไม่ได้อะไร */
function takeFrom(ctx, uid, { side }) {
  const st = ctx.state;
  if (st.aim?.by !== uid || !st.aim.target) return null;
  if (!takeSides(st.cargo, st.aim.target).includes(side)) return null;
  return { state: { ...st, aim: { ...st.aim, from: side } } };
}

/* แล้วเลือกว่าจะเก็บกล่องไว้ฝั่งประเทศไหน — ถึงตรงนี้ค่อยย้ายกล่องจริงและจบตา
   ต้นทางไม่ให้เลือก หยิบจากฝั่งที่มีมากกว่าเอง จะได้ไม่ต้องตัดสินใจซ้อนอีกชั้น */
function storeAt(ctx, uid, { side }) {
  const st = ctx.state;
  const aim = st.aim;
  if (!aim?.target) return null;

  /* ฝั่งที่เต็มเพดานแล้วเก็บเพิ่มไม่ได้ */
  if (!keepSides(st.cargo, aim.place).includes(side)) return null;
  const keep = side;
  const from = aim.target === 'merchant' ? null : aim.from;
  if (aim.target !== 'merchant' && !from) return null;

  const cargo = moveBox(st.cargo, aim.target, from, aim.place, keep);
  const next = cargo
    ? pushLog({ ...st, cargo }, 'wreck.log.attackTook', { target: aim.target, side: keep })
    : pushLog(st, 'wreck.log.attackNoRoom', {});

  /* เก็บผลไว้ให้หน้าจอประกาศ ว่าใครชิงกล่องจากไหนไปให้ประเทศอะไร
     ต้องอยู่ในสถานะสาธารณะ เพราะทุกคนต้องเห็นประกาศเดียวกันพร้อมกัน */
  const took = cargo
    ? { by: uid, target: aim.target, side: keep, at: (next.logSeq || 0) }
    : null;

  return { state: passTurn({ ...next, aim: null, lastTake: took }) };
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
  /* เก็บผลการแบ่งไว้ในสถานะ เพราะหน้าจอต้องประกาศตัวเลขนี้ตอนสรุป */
  return pushLog({ ...st, cargo: { ...st.cargo, island: split }, lastSplit: split },
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
    /* ประทับเวลาที่เริ่มทอยไว้ในสถานะกลาง ทุกคนจึงเห็นลูกเต๋าพร้อมกัน
       ของเดิมให้แต่ละเครื่องตัดสินเองว่าเคยโชว์ไปหรือยัง ใครเปิดหน้าไม่ทันก็อด */
    return { state: openTurn({ ...st, phase: 'play', dieAt: now, deadline: turnDeadline(st, now) }) };
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

  /* คนเปิดการ์ดค้างไม่เลือกเป้า — ทิ้งผลการ์ดแล้วผ่านตาไป */
  if (st.pending) {
    if (!due) return null;
    return { state: passTurn(pushLog({ ...st, pending: null },
                                     'wreck.log.cardLost',
                                     { name: st.names?.[st.pending.by] })) };
  }

  /* กัปตันค้างไม่เลือกเป้า — เลือกให้เองแล้วไปต่อ ไม่งั้นทั้งวงรอคนเดียว */
  if (st.aim) {
    const aim = st.aim;
    const target = aim.target || aim.options[0];
    const from = target === 'merchant' ? null : (aim.from || takeSides(st.cargo, target)[0] || 'B');
    const keep = keepSides(st.cargo, aim.place)[0] || 'B';
    const cargo = moveBox(st.cargo, target, from, aim.place, keep);
    const done = cargo
      ? pushLog({ ...st, cargo }, 'wreck.log.attackTook', { target, side: keep })
      : pushLog(st, 'wreck.log.attackNoRoom', {});
    const took = cargo ? { by: aim.by, target, side: keep, at: (done.logSeq || 0) } : null;
    return { state: passTurn({ ...done, aim: null, lastTake: took }) };
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
