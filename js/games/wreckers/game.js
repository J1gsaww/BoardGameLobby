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
  SHIP_SLOTS, EVENT_SLOTS, MAX_VOTE, graceMs, rollStarter, OFFLINE_WAIT, PICK_MS, pickMs
} from './board.js';
import { deal } from './vote.js';
import { BASE_CARDS, ENDER, ENDER_ZONE } from './events.js';
import { startDuel, duelSubmit, duelReady, resolveDuel, canDuelNow, marchOrder,
         roomOn, grabBoxes, spoilAsks, dumpShip,
         grabFrom, grabTo, moveOne, canGrab } from './duel.js';
import { effectOf, targetsOf, nextStep, keepsInHand, canUseCard,
         isDeferred, isGift, giftTargets, canPlayNow, pickCountOf, crowPool,
         pickUpToOf, isHandStep, duelOf } from './effects.js';
import { EXTRA_CARDS } from './cards.js';
import {
  SHIP_IDS, BOAT_IDS, BOAT_LINK, VOTE_ROW,
  placeOf, occupants, joinPlace, isPlaying,
  actionsFor, boatsOpen, maroon, pileOf, shuffle, redeal, advance, burnVoteBans, clearVoteWeights,
  buildEventDeck, refillSlots, emptyDeck,
  startVote, voteReady, tallyRow, attackPasses, mutinyPasses, brawlSplit,
  moveBox, score, winningSide, winners, dealNations, pushLog, refill, birdStrike, SAVE_CARDS, nextSeat,
  voteWeight, setVoteWeight, addVoteBan, markCount, addMark, swapSpots, clearMark,
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
  /* มีคนค้างตอบว่าจะใช้การ์ดกัน Maroon ไหม = ยังไม่จบตา
     เช็กที่นี่จุดเดียวแทนที่จะไล่ใส่ทุกที่ที่เรียกผ่านตา ซึ่งมีสิบกว่าที่ */
  if (st.saveAsk) return st;

  /* มีคนถูกบังคับให้เปิดแล้วยังไม่เปิด = Action ของคนสั่งยังไม่จบ
     การเปิดเป็นส่วนหนึ่งของ Action นั้น ไม่ใช่ตาใหม่ของใคร */
  if (st.forced) return st;

  /* ยังมีคนค้างตอบว่าคืนกล่องฝั่งไหน หรือกำลังเลือกกล่องที่จะชิง = ยังไม่จบ */
  if (st.spoils || st.grab) return st;

  const { state, uid, skipped = [] } = advance(st);        /* คนที่ติดหนี้ข้ามเทิร์นถูกหักหนี้แล้วข้ามไปในนี้ */
  /* มีคนโดนข้ามตา = ประกาศให้ทั้งวงรู้ว่าใครหยุดอยู่
     ไม่งั้นจะเห็นแค่ตากระโดดข้ามหัวไปเฉย ๆ แล้วงงว่าเกิดอะไรขึ้น */
  const said = skipped.length
    ? pushLog({ ...state,
                shout: { kind: 'skip', who: skipped, at: (state.logSeq || 0) + 1 } },
              'wreck.log.skipped', { who: skipped.map(u => st.names?.[u] || '?').join(', ') })
    : state;

  /* ตาวนกลับมาถึงคนที่เปิดลมสงบแล้ว = ครบหนึ่งรอบ ลมกลับมาพัด */
  const calmDone = said.calm && uid === said.calm.until;

  return openTurn({
    ...said,
    ...(calmDone ? { calm: null } : {}),
    turn: uid,
    deadline: turnDeadline(said, now),
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
  /* ส่งไพ่เข้าวงยิงแข่ง — ทุกคนบนเรือส่งพร้อมกัน จึงทำได้นอกตาตัวเอง */
  if (type === 'duelCard') return submitDuel(ctx, uid, payload.card);
  /* เลือกว่าลำนี้คืนกล่องฝั่งไหน — ถามได้พร้อมกันสองคน จึงทำนอกตาตัวเอง */
  if (type === 'spoilPick') return spoilPick(ctx, uid, payload.side);
  /* กัปตันของลำที่ชนะเลือกกล่องที่จะชิง ทีละใบ */
  if (type === 'grabPick') return grabPick(ctx, uid, payload.side);
  if (type === 'useDorado') return useDorado(ctx, uid, payload);
  if (type === 'endGame') return finish(ctx);

  /* ตอบว่าจะใช้การ์ดกัน Maroon ไหม ทำได้นอกตาตัวเอง
     เพราะคนที่ถูกถามมักไม่ใช่คนที่ถึงตา เช่นโดนคนอื่นยิงหรือโดนนกถล่มทั้งลำ */
  if (type === 'useSave') return settle(ctx, useSave(ctx, uid, payload));

  /* ถูกบังคับให้เปิด — ทำได้นอกตาตัวเอง เพราะไม่ใช่ตาของเราตั้งแต่ต้น
     การเปิดนี้เป็นส่วนหนึ่งของ Action ของคนที่สั่ง ไม่ใช่ตาใหม่ */
  if (type === 'activate' && st.forced?.who === uid) {
    return settle(ctx, activate(ctx, uid, payload));
  }

  /* ตอบเป้าของการ์ดที่ค้างอยู่ — คนตอบอาจเป็นคนที่ถูกบังคับ ซึ่งไม่ใช่เจ้าของตา
     เช่นโดนบังคับให้เปิดปืนพก แล้วต้องเป็นคนเลือกเองว่าจะยิงใคร */
  if (type === 'useCard' && st.pending?.by === uid && st.turn !== uid) {
    return settle(ctx, useCard(ctx, uid, payload));
  }

  /* การ์ดในมือมีด่านของตัวเอง เพราะบางใบใช้ได้ในตาของใครก็ได้
     ตัดสินด้วยฟังก์ชันเดียวกับที่หน้าจอใช้ จึงไม่มีทางคิดไม่ตรงกัน */
  if (type === 'playHeld') return settle(ctx, playHeld(ctx, uid, payload));

  if (st.turn !== uid || st.vote) return null;
  if (!isPlaying(st, uid)) return null;
  if (!actionsFor(st, uid).includes(type)) return null;

  return settle(ctx, await route(ctx, uid, type, payload));
}

/* ── กวาดผลข้างเคียงหลังทุกคำสั่ง ──────────────────────────
   บางกฎถูกจุดชนวนได้จากหลายทางเกินกว่าจะไล่ใส่ทีละที่
   เช่นนกครบสองตัวบนเรือลำเดียว เกิดได้ทั้งจากได้นกมาใหม่และจากคนย้ายที่
   ซึ่งการย้ายที่มีจุดเกิดสิบกว่าที่ ถ้าไล่ใส่เองจะลืมแน่

   ตรวจรวมทีเดียวที่นี่จึงพลาดไม่ได้ ไม่ว่าคำสั่งไหนจะเป็นตัวจุดชนวน */
function settle(ctx, out) {
  if (!out?.state) return out;

  /* การ์ดที่จองไว้ให้ทำหลังจบตา — ทำตอนที่ตาเพิ่งผ่านไปจริง ๆ
     เทียบว่าใครถึงตาก่อนกับหลัง ถ้าเปลี่ยนแปลว่าตาจบแล้ว
     ทำที่นี่จุดเดียวเพราะตาจบได้จากหลายทาง ทั้งลงมือเอง หมดเวลา และโดนข้าม */
  if (out.state.queued && out.state.turn !== ctx.state.turn) {
    out = runQueued(ctx, out);
  }

  const hands = out.secrets
    ? Object.fromEntries(Object.entries(out.secrets)
        .filter(([u]) => !u.startsWith('_'))
        .map(([u, s]) => [u, s.vote || []]))
    : handsOf(ctx);

  const hit = birdStrike(out.state, hands);
  if (!hit) return out;

  /* ผังที่ควรเห็นตอนประกาศคือ **หลังคนย้ายที่แล้ว แต่ก่อนโดน Maroon**
     เพราะการย้ายที่เป็นเหตุ ส่วน Maroon เป็นผล ถ้าโชว์ผังก่อนย้ายด้วย
     คนดูจะไม่เข้าใจว่าทำไมนกถึงครบสองตัว เพราะหมากยังอยู่ที่เดิม */
  const said = pushLog({ ...hit.state,
                         shout: { kind: 'birds', place: hit.place, who: hit.who,
                                  beforePos: out.state.pos,
                                  at: (hit.state.logSeq || 0) + 1 } },
                       'wreck.log.birds', { n: hit.who.length });

  return {
    ...out,
    state: said,
    secrets: { ...(out.secrets || {}), ...secretsFrom(ctx, hit.hands) }
  };
}

/* ทำการ์ดที่จองไว้ ตอนนี้ตาผ่านไปแล้ว ผลจึงไม่ไปแทรกกลางคันของใคร */
function runQueued(ctx, out) {
  const st = out.state;
  const q = st.queued;
  const e = effectOf(q.card);
  if (!e?.run) return { ...out, state: { ...st, queued: null } };

  const hands = out.secrets
    ? Object.fromEntries(Object.entries(out.secrets)
        .filter(([u]) => !u.startsWith('_'))
        .map(([u, s]) => [u, s.vote || []]))
    : handsOf(ctx);

  const res = e.run({ ...st, queued: null }, q.by, { target: q.target }, hands);
  const said = pushLog({ ...res.state,
                         ...(res.shout ? { shout: { ...res.shout, beforePos: st.pos,
                                                    at: (res.state.logSeq || 0) + 1 } } : {}) },
                       'wreck.log.card.' + q.card, { name: st.names?.[q.by] });

  return {
    ...out,
    state: said,
    secrets: { ...(out.secrets || {}), ...(res.hands === hands ? {} : secretsFrom(ctx, res.hands)) }
  };
}

async function route(ctx, uid, type, payload) {
  const st = ctx.state;
  switch (type) {
    case 'toBoat':     return toBoat(ctx, uid, payload.boat);
    case 'kick':       return kick(ctx, uid, payload.uid);
    case 'shiftCargo': return shiftCargo(ctx, uid, payload.from);
    case 'useCard':    return useCard(ctx, uid, payload);
    case 'playHeld':   return playHeld(ctx, uid, payload);
    case 'useSave':    return useSave(ctx, uid, payload);
    case 'useDorado':  return useDorado(ctx, uid, payload);
    case 'attack':     return callVote(ctx, uid, 'attack', payload);
    case 'aimAt':      return aimAt(ctx, uid, payload);
    case 'takeFrom':   return takeFrom(ctx, uid, payload);
    case 'storeAt':    return storeAt(ctx, uid, payload);
    case 'mutiny':     return callVote(ctx, uid, 'mutiny', payload);
    case 'islandVote': return callVote(ctx, uid, 'islandVote', payload);

    case 'activate': return activate(ctx, uid, payload);
    case 'peek':     return peek(ctx, uid, payload);

    /* บังคับให้คนอื่นเปิด — ถามสองขั้น เลือกคน แล้วเลือกการ์ดสองใบให้เขาเลือกเอง
       ถ้ากดมาจากเมนูข้างตัวคนนั้น เป้าติดมาแล้ว ข้ามขั้นแรกไปเลย
       ไม่งั้นจะกลายเป็นถามซ้ำสิ่งที่เพิ่งเลือกไป ซึ่งชวนงงมาก */
    case 'force': {
      const pre = payload.target;
      const okTarget = pre && targetsOf(st, uid, 'force', 'player', {}).includes(pre);
      return {
        state: { ...st,
          /* การ์ดที่เปิดไปเมื่อตาก่อนจบเรื่องแล้ว ล้างทิ้งตอนเริ่ม Action ใหม่
             ไม่งั้นมันจะค้างไปเรื่อย ๆ แล้วไปโผล่ในฉากที่ไม่เกี่ยวกับมัน */
          cardUp: null,
          pending: { card: 'force', by: uid, mode: 'force',
                     picks: okTarget ? { player: pre } : {},
                     needs: okTarget ? 'slots' : 'player',
                     at: (st.logSeq || 0) + 1 },
          deadline: Date.now() + PICK_MS }
      };
    }

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

  /* ถูกบังคับอยู่ = เปิดได้เฉพาะสองใบที่เขาชี้ไว้เท่านั้น */
  if (st.forced && !(st.forced.slots || []).includes(i)) return null;

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

  /* เปิดแล้วสถานะบังคับจบหน้าที่ ไม่ว่าจะเปิดใบไหนในสองใบนั้น
     ล้างที่นี่จุดเดียว ทุกทางที่การเปิดจบลงจึงได้ผลเหมือนกัน */
  const shown2 = st.forced ? { ...shown, forced: null } : shown;

  /* ประกาศชื่อการ์ดให้ทุกคนเห็นทันทีที่เปิด */
  const said = pushLog({ ...shown2, cardUp: { id, by: uid, at: (st.logSeq || 0) + 1 } },
                       'wreck.log.activate', { name: st.names?.[uid] });

  /* การ์ดที่ต้องถามก่อน จะยังไม่ผ่านตา เกมค้างรอคนเปิดเลือกเป้าก่อน
     จังหวะเดียวกับการโหวต ผลจึงไม่โผล่ก่อนที่ฉากจะเล่าถึง */
  /* กองเรือสเปน — จบเกมทันทีตรงนี้เลย ไม่ผ่านฉากเปิดการ์ด
     เพราะเกมจบแล้ว ฉากเล่าเรื่องการ์ดจะกลายเป็นการหน่วงผลที่ทุกคนรออยู่ */
  if (id === ENDER) {
    const done = finish(ctx);
    return {
      state: pushLog({ ...done.state, cardUp: null },
                     'wreck.log.card.armada', { name: st.names?.[uid] }),
      secrets: { _deck: next, ...cleared }
    };
  }

  const eff = effectOf(id);
  const needs = nextStep(id, {});

  /* ต้องเลือกเป้า แต่ไม่มีอะไรให้เลือกเลย = การ์ดใบนั้นเป็นโมฆะ
     เช่นหนูท้องเรือตอนที่ทั้งสองฝั่งไม่มีกล่องสักใบ
     ถ้าปล่อยให้ค้างรอ เกมจะแข็งจนกว่าจะหมดเวลา ทั้งที่ไม่มีอะไรให้ทำ */
  const noTarget = needs && !isHandStep(id) && !pickUpToOf(id, needs)
    && !targetsOf(said, uid, id, needs, {}).length;
  if (noTarget) {
    return {
      state: passTurn(pushLog({ ...said, shout: { kind: 'fizzle', by: uid, card: id,
                                                  at: (said.logSeq || 0) + 1 } },
                              'wreck.log.fizzle', { name: st.names?.[uid] })),
      secrets: { _deck: next, ...cleared }
    };
  }

  /* การ์ดแผนที่ — เปิดแล้วต้องยกให้คนอื่น เก็บเองไม่ได้ ตรวจก่อนทุกกรณี
     ผลของแผนที่จะเกิดก็ต่อเมื่อคนที่ได้รับหยิบมาใช้ทีหลัง ไม่ใช่ตอนเปิด */
  if (isGift(id)) {
    return {
      state: { ...said,
        pending: { card: id, by: uid, mode: 'gift', picks: {}, needs: 'player',
                   at: (st.logSeq || 0) + 1 },
        deadline: Date.now() + pickMs(id) },
      secrets: { _deck: next, ...cleared }
    };
  }

  /* การ์ดที่เก็บเข้ามือ — ไม่เกิดผลตอนเปิด ผู้เล่นเอาไปใช้ทีหลังในตาตัวเอง
     จำนวนใบเป็นข้อมูลสาธารณะ ส่วนใบไหนเป็นความลับของเจ้าตัว */
  if (keepsInHand(id)) {
    const mine = ctx.secrets?.[uid] || {};
    const bag = [...(mine.held || []), id];
    return {
      state: passTurn({ ...said, held: { ...said.held, [uid]: bag.length } }),
      secrets: { _deck: next, ...cleared, [uid]: { ...mine, held: bag } }
    };
  }

  /* การ์ดที่เปิดวงยิงแข่งสองลำ — ไม่ผ่านตา รอทั้งสองฝั่งส่งไพ่ครบก่อน
     ผลจริงเกิดตอนวงยิงจบ ไม่ใช่ตอนเปิดการ์ด */
  if (duelOf(id)) {
    return {
      state: pushLog(startDuel(said, { card: id, by: uid }),
                     'wreck.log.duel', { name: st.names?.[uid] }),
      secrets: { _deck: next, ...cleared }
    };
  }

  /* การ์ดที่ไม่ต้องถามอะไร ผลเกิดทันทีตอนเปิด แล้วผ่านตาไปเลย
     ฉากจะเล่าสองช่วงต่อกันเอง — โชว์การ์ดก่อน แล้วค่อยประกาศผล */
  if (!needs && eff?.run) {
    /* ต้องเติมผังก่อนเกิดผล **ก่อน** เรียกใช้ผลการ์ด
       ถ้าเติมทีหลัง สถานะที่ผลการ์ดส่งกลับมาจะเป็นสำเนาที่ถ่ายไว้ก่อนเติม
       ค่าที่เติมจึงไม่ติดไปด้วย หน้าจอเลยไม่มีอะไรบอกให้ค้างกระดาน */
    const before = { ...said, cardUp: { ...said.cardUp, beforePos: st.pos } };
    const hands = handsOf(ctx);
    const out = eff.run(before, uid, {}, hands, ctx.rng || Math.random);
    /* การ์ดที่ไม่คืน shout มา แปลว่าไม่ต้องประกาศผล อย่าสร้างประกาศเปล่าขึ้นมา
       ไม่งั้นฉากจะขึ้นกล่องว่าง ๆ ให้รออ่านโดยไม่มีอะไรอยู่ข้างใน */
    const done = pushLog(out.shout
      ? { ...out.state, shout: { ...out.shout, at: (out.state.logSeq || 0) + 1 } }
      : out.state,
      'wreck.log.card.' + id, { name: st.names?.[uid] });
    return {
      state: passTurn(done),
      secrets: { _deck: next, ...cleared,
                 ...(out.hands === hands ? {} : secretsFrom(ctx, out.hands)) }
    };
  }

  return {
    state: needs
      ? { ...said,
          pending: { card: id, by: uid, needs, at: (st.logSeq || 0) + 1 },
          /* คนเลือกหลุดไปแล้วเกมจะค้างตลอดกาล ต้องมีเพดานเวลาเสมอ
             หมดเวลาแล้วผลการ์ดหายไปเลย ไม่สุ่มให้ เพราะการ์ดใบอื่นบางใบ
             สุ่มแล้วจะเสียหายหนักกว่าปล่อยผ่าน

             บางใบได้เวลาเพิ่มเพราะต้องคิดนานกว่าจริง ๆ เช่นรังกา
             ที่ต้องดูไพ่ทั้งกองแล้วเลือกสามใบให้คนอื่น */
          deadline: Date.now() + pickMs(id) }
      : passTurn(said),
    secrets: { _deck: next, ...cleared }
  };
}

/* ── กัปตันลำที่ชนะเลือกกล่องที่จะชิง ──────────────────────
   ถามทีละใบ สองขั้นต่อใบ — เอาจากฝั่งไหน แล้วเก็บไว้ฝั่งไหน
   กติกาเดียวกับการยิงปกติทุกประการ */
function grabPick(ctx, uid, side) {
  const st = ctx.state;
  const g = st.grab;
  if (!g || g.who !== uid) return null;
  if (!['B', 'F'].includes(side)) return null;

  /* ขั้นเลือกต้นทาง — เก็บไว้ก่อนแล้วไปถามปลายทาง */
  if (g.step === 'from') {
    if (!grabFrom(st.cargo, g.from).includes(side)) return null;
    return { state: { ...st, grab: { ...g, step: 'to', pick: { from: side } } } };
  }

  /* ขั้นเลือกปลายทาง — ย้ายกล่องจริงตรงนี้ */
  if (!grabTo(st.cargo, g.ship).includes(side)) return null;
  const cargo = moveOne(st.cargo, g.ship, g.from, g.pick.from || null, side);
  if (!cargo) return null;

  const left = g.left - 1;
  const more = left > 0 && canGrab(cargo, g.ship, g.from);

  if (more) {
    return { state: { ...st, cargo,
      grab: { ...g, left, pick: {},
              step: grabFrom(cargo, g.from).length ? 'from' : 'to' } } };
  }

  return {
    state: passTurn(pushLog({ ...st, cargo, grab: null,
      shout: { kind: 'grabbed', place: g.ship, n: 2 - left, at: (st.logSeq || 0) + 1 } },
      'wreck.log.grabbed', { place: '' }))
  };
}

/* ── ตอบว่าลำนี้คืนกล่องฝั่งไหน ────────────────────────────
   ถามพร้อมกันได้สองคน ลำละคน ซึ่งเป็นจังหวะที่ยังไม่เคยมีในเกม
   จึงเก็บคำตอบไว้ก่อนแล้วลงมือเมื่อครบทุกคนที่ถูกถาม */
function spoilPick(ctx, uid, side) {
  const st = ctx.state;
  const sp = st.spoils;
  if (!sp) return null;
  if (!['B', 'F'].includes(side)) return null;

  const ship = SHIP_IDS.find(s => sp.asks[s] === uid && sp.need.includes(s));
  if (!ship || sp.picked[ship]) return null;

  const picked = { ...sp.picked, [ship]: side };
  const left = sp.need.filter(s => !picked[s]);

  if (left.length) return { state: { ...st, spoils: { ...sp, picked } } };

  /* ครบแล้ว — คืนกล่องของทุกลำกลับเรือสินค้า */
  let cargo = st.cargo;
  for (const s of SHIP_IDS) cargo = dumpShip(cargo, s, picked[s] || null);

  return {
    state: passTurn(pushLog({ ...st, cargo, spoils: null,
      shout: { kind: 'spoils', picked, at: (st.logSeq || 0) + 1 } },
      'wreck.log.spoils', {}))
  };
}

/* ── ส่งไพ่เข้าวงยิงแข่งสองลำ ──────────────────────────────
   ทั้งสองลำส่งพร้อมกัน ผลเปิดพร้อมกันเมื่อครบทุกคน
   ระบบนี้แยกจากการโหวตปกติทั้งชุด ไม่ได้ใช้ st.vote เลย */
function submitDuel(ctx, uid, cardId) {
  const st = ctx.state;
  if (!canDuelNow(st, uid)) return null;

  const hands = handsOf(ctx);
  if (!(hands[uid] || []).includes(cardId)) return null;

  const ship = placeOf(st.pos[uid]);
  const duel = duelSubmit(st.duel, uid, ship, cardId);
  const left = { ...hands, [uid]: hands[uid].filter(c => c !== cardId) };

  /* ยังไม่ครบ — บันทึกไว้เฉย ๆ ไพ่ที่ส่งไปเก็บในข้อมูลลับของเจ้าตัว */
  if (!duelReady(duel)) {
    return {
      state: { ...st, duel, votes: countHands(left) },
      secrets: secretsFrom(ctx, left)
    };
  }

  /* ครบทั้งสองฝั่งแล้ว — เปิดผลพร้อมกัน */
  const res = resolveDuel({ ...st, duel }, left, ctx.rng || Math.random);
  return finishDuel(ctx, { ...st, duel }, res, left);
}

/* ── ปิดวงยิงแข่ง แล้วทำผลของการ์ดที่เปิดวงนี้ ────────────── */
function finishDuel(ctx, st, res, hands) {
  const d = st.duel;
  let next = { ...st, duel: null,
    lastDuel: { card: d.card, by: d.by, sides: res.sides, won: res.won,
                at: (st.logSeq || 0) + 1 } };
  let out = hands;

  if (d.card === 'wreckers') {
    /* ลำที่ยิงติดฝ่ายเดียวชิงกล่อง 2 ใบ — แต่ต้องมีที่ว่างรับด้วย
       รับไม่ไหว = นับเป็นแพ้ทันที แล้วตกไปใช้กติกาเสมอ */
    const win = res.won !== 'tie' && roomOn(next.cargo, res.won) > 0 ? res.won : null;

    if (win) {
      /* กัปตันของลำที่ชนะเลือกเองทีละใบ ว่าเอากล่องฝั่งไหนมาใส่ฝั่งไหน
         กติกาเดียวกับการยิงปกติ ไม่ใช่คำนวณให้เอง
         ยังไม่ผ่านตา เพราะการชิงกล่องยังไม่จบ */
      const lose = win === 'shipL' ? 'shipR' : 'shipL';
      const crew = occupants(next.pos, win);
      const boss = crew[0] || null;
      const backH = refill(next.seats, out, next.maxVote).hands;

      next = { ...next, votes: countHands(backH),
               lastDuel: { ...next.lastDuel, won: win } };

      if (!boss || !canGrab(next.cargo, win, lose)) {
        return {
          state: passTurn(pushLog(next, 'wreck.log.duelDone', {})),
          secrets: secretsFrom(ctx, backH)
        };
      }

      return {
        state: pushLog({ ...next,
          grab: { ship: win, from: lose, who: boss, left: 2,
                  step: grabFrom(next.cargo, lose).length ? 'from' : 'to',
                  pick: {}, at: (next.logSeq || 0) + 1 } },
          'wreck.log.duelDone', {}),
        secrets: secretsFrom(ctx, backH)
      };
    }

    /* เสมอ (หรือผู้ชนะรับไม่ไหว) — กล่องของทั้งสองลำกลับเรือสินค้า
       ต้องถามคนท้ายสุดของแต่ละลำก่อนว่าจะคืนฝั่งไหน จึงยังไม่ผ่านตา */
    const asks = spoilAsks(next.pos);
    const need = SHIP_IDS.filter(s =>
      asks[s] && ((next.cargo[s]?.B || 0) + (next.cargo[s]?.F || 0)) > 0);

    next = { ...next, lastDuel: { ...next.lastDuel, won: 'tie', dumped: true } };

    if (!need.length) {
      /* ไม่มีใครให้ถามหรือไม่มีกล่องให้คืน — จัดการเองเลย */
      let cargo = next.cargo;
      for (const s of SHIP_IDS) cargo = dumpShip(cargo, s);
      next = { ...next, cargo };
      return {
        state: passTurn(pushLog(next, 'wreck.log.duelDone', {})),
        secrets: secretsFrom(ctx, refill(next.seats, out, next.maxVote).hands)
      };
    }

    const backHands = refill(next.seats, out, next.maxVote).hands;
    return {
      state: pushLog({ ...next, votes: countHands(backHands),
        spoils: { asks, need, picked: {}, at: (next.logSeq || 0) + 1 } },
        'wreck.log.duelDone', {}),
      secrets: secretsFrom(ctx, backHands)
    };
  }

  if (d.card === 'vegan') {
    /* ลำที่ยิงติดฝ่ายเดียวรอด นอกนั้นลงเกาะหมด ลำดับสุ่มทั้งหมด */
    const safe = res.won === 'tie' ? [] : occupants(next.pos, res.won);
    const doomed = SHIP_IDS.flatMap(s => (s === res.won ? [] : occupants(next.pos, s)));
    const order = marchOrder(doomed, ctx.rng || Math.random);

    /* คนที่อยู่บนเกาะอยู่แล้วเสียไพ่โหวตถาวรคนละใบ */
    const ashore = occupants(next.pos, 'island');
    for (const u of ashore) {
      next = { ...next, maxVote: { ...next.maxVote,
        [u]: Math.max(0, (next.maxVote?.[u] ?? 0) - 1) } };
    }

    /* ส่งลงเกาะตามลำดับที่สุ่มได้ */
    for (const u of order) next = { ...next, pos: joinPlace(next.pos, u, 'island') };

    /* แล้วค่อยเก็บนกคืนทั้งกระดาน */
    next = clearMark(next, 'bird');

    next = { ...next, lastDuel: { ...next.lastDuel, safe, order, ashore } };
  }

  /* คืนไพ่ให้ทุกคนจนเต็มเพดานของตัวเอง เหมือนหลังโหวตปกติทุกประการ
     ไพ่ที่ลงไปในวงยิงจึงกลับเข้ากองเองเพราะไม่อยู่ในมือใครแล้ว

     ลืมข้อนี้ไปตอนแรก ผลคือคนที่ส่งไพ่เข้าวงยิงเหลือไพ่น้อยลงถาวร
     ทั้งที่เพดานไม่ได้ลด — คนละเรื่องกับโทษเสียไพ่ถาวรของคนบนเกาะ */
  const back = refill(next.seats, out, next.maxVote, ctx.rng || Math.random);
  next = { ...next, votes: countHands(back.hands) };

  return {
    state: passTurn(pushLog(next, 'wreck.log.duelDone', {})),
    secrets: secretsFrom(ctx, back.hands)
  };
}

/* ── ตอบว่าจะใช้เอลโดราโดไหม ──────────────────────────────
   ถามทุกครั้งที่เจ้าของการ์ดอยู่ในวงโหวต ไม่ต้องหยิบมาเล่นเอง
   ตอบใช่ = ส่งไพ่ได้สองใบรอบนี้ แล้วรอบหน้าห้ามโหวตหนึ่งครั้ง
   ตอบไม่ = ส่งใบเดียวตามปกติ การ์ดยังอยู่ในมือ */
function useDorado(ctx, uid, { yes }) {
  const st = ctx.state;
  const v = st.vote;
  if (!v || !v.voters.includes(uid)) return null;
  if (v.done.includes(uid)) return null;
  if ((v.asked || []).includes(uid)) return null;

  const mine = ctx.secrets?.[uid] || {};
  if (!(mine.held || []).includes('eldorado')) return null;

  const asked = { ...v, asked: [...(v.asked || []), uid] };

  if (!yes) return { state: { ...st, vote: asked } };

  /* ใช้แล้วการ์ดหายจากมือทันที กันกดซ้ำและกันเก็บไว้ใช้รอบหน้า */
  const bag = (mine.held || []).filter((c, i, a) => i !== a.indexOf('eldorado'));
  const next = setVoteWeight({ ...st, vote: asked, held: { ...st.held, [uid]: bag.length } },
                             uid, 2);

  return {
    state: pushLog(next, 'wreck.log.dorado', { name: st.names?.[uid] }),
    secrets: { [uid]: { ...mine, held: bag } }
  };
}

/* ── ตอบว่าจะใช้การ์ดกัน Maroon ไหม ───────────────────────
   ตอบใช่  = ไม่โดน Maroon การ์ดถูกทิ้ง ประกาศให้ทั้งวงรู้
   ตอบไม่  = โดนตามปกติ การ์ดยังอยู่ในมือ เก็บไว้ใช้ครั้งหน้าได้ */
function useSave(ctx, uid, { yes }) {
  const st = ctx.state;
  const ask = st.saveAsk;
  if (ask?.who !== uid) return null;

  const clear = { ...st, saveAsk: null };
  const hands = handsOf(ctx);

  if (!yes) {
    /* บังคับให้ Maroon จริง ไม่ต้องถามซ้ำ ไม่งั้นจะวนถามไม่จบ */
    const out = maroon(clear, uid, hands, Math.random, true);
    return {
      state: passTurn(pushLog(out.state, 'wreck.log.saveNo', { name: st.names?.[uid] })),
      secrets: out.hands === hands ? undefined : secretsFrom(ctx, out.hands)
    };
  }

  const mine = ctx.secrets?.[uid] || {};
  const bag = (mine.held || []).filter((c, i, a) => i !== a.indexOf(ask.card));
  const saves = { ...clear.saves };
  delete saves[uid];

  const done = pushLog({ ...clear, saves,
                         held: { ...clear.held, [uid]: bag.length },
                         shout: { kind: 'saved', by: uid, card: ask.card,
                                  at: (clear.logSeq || 0) + 1 } },
                       'wreck.log.saveYes', { name: st.names?.[uid] });

  return {
    state: passTurn(done),
    secrets: { [uid]: { ...mine, held: bag } }
  };
}

/* ทะเบียนการ์ดกัน Maroon — ใครถืออยู่บ้าง เก็บเท่าที่จำเป็นเท่านั้น */
function giftSaves(cur = {}, uid, bag, gift, theirBag) {
  const out = { ...cur };
  const pick = (list) => list.find(c => SAVE_CARDS.includes(c)) || null;

  const mineSave = pick(bag);
  if (mineSave) out[uid] = mineSave; else delete out[uid];

  if (gift) {
    const theirSave = pick(theirBag);
    if (theirSave) out[gift.to] = theirSave; else delete out[gift.to];
  }
  return out;
}

/* ยกแผนที่ให้คนอื่น — เข้ามือเขา ไม่เกิดผลอะไรกับกระดานตอนนี้ */
function giveMap(ctx, uid, p, target) {
  const st = ctx.state;
  if (!giftTargets(st, uid).includes(target)) return null;

  const theirs = ctx.secrets?.[target] || {};
  const bag = [...(theirs.held || []), p.card];

  const saves = { ...st.saves };
  if (SAVE_CARDS.includes(p.card)) saves[target] = p.card;

  const done = pushLog({ ...st, pending: null, cardUp: null, saves,
                         held: { ...st.held, [target]: bag.length },
                         shout: { kind: 'gaveMap', by: uid, who: target, card: p.card,
                                  at: (st.logSeq || 0) + 1 } },
                       'wreck.log.gaveMap',
                       { name: st.names?.[uid], who: st.names?.[target] });

  return {
    state: passTurn(done),
    secrets: { [target]: { ...theirs, held: bag } }
  };
}

/* ตัดฟิลด์ที่เป็น undefined ออก — Firestore ปฏิเสธทั้งชุดคำสั่งถ้าเจอแม้ตัวเดียว
   ผลคือกดปุ่มแล้วเงียบสนิทโดยไม่มีอะไรบอกว่าเกิดอะไรขึ้น */
const noBlank = (o) => {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (v !== undefined) out[k] = v;
  return out;
};

/* ── หยิบการ์ดจากมือมาใช้ ──────────────────────────────────
   ใช้ได้ในตาตัวเองเท่านั้น และนับเป็น Action ของตานั้น
   ยังไม่ผ่านตาทันที เพราะต้องถามก่อนว่าจะใช้กับใครที่ไหน */
function playHeld(ctx, uid, { card }) {
  const st = ctx.state;
  const mine = ctx.secrets?.[uid] || {};
  if (!(mine.held || []).includes(card)) return null;
  if (!canPlayNow(st, uid, card).ok) return null;

  const first = nextStep(card, {});
  const at = (st.logSeq || 0) + 1;

  /* การ์ดที่ผลต้องรอจบตา — จองไว้เฉย ๆ ยังไม่เกิดอะไรและไม่ขึ้นฉาก
     คนอื่นเห็นแค่จำนวนไพ่ในมือเขาลดลง ไม่รู้ว่าจองอะไรไว้
     ตัวกวาดหลังคำสั่งจะหยิบไปทำตอนตาผ่านไปแล้ว */
  if (isDeferred(card)) {
    const mine = ctx.secrets?.[uid] || {};
    const bag = (mine.held || []).filter((c, i, a) => i !== a.indexOf(card));
    return {
      state: pushLog({ ...st,
        /* ล็อกเป้าไว้ตั้งแต่ตอนกด ไม่ใช่ตอนผลเกิด
           เพราะผลเกิดหลังตาผ่านไปแล้ว คนถัดไปจะกลายเป็นอีกคน
           เจตนาของคนใช้คือแทรกหลังคนที่กำลังจะเล่นตอนที่เขากด */
        queued: { card, by: uid, at, target: nextSeat(st) },
        held: { ...st.held, [uid]: bag.length }
      }, 'wreck.log.queued', { name: st.names?.[uid] }),
      secrets: { [uid]: { ...mine, held: bag } }
    };
  }

  return {
    state: pushLog({ ...st,
      cardUp: { id: card, by: uid, at },
      pending: { card, by: uid, from: 'hand', picks: {}, needs: first, at },
      deadline: Date.now() + pickMs(card)
    }, 'wreck.log.playHeld', { name: st.names?.[uid] })
  };
}

/* ── ใช้ผลของการ์ดที่ค้างรออยู่ ────────────────────────────
   ตรวจเป้าด้วยรายชื่อชุดเดียวกับที่หน้าจอใช้ไฮไลท์
   จะได้ไม่มีทางที่สองที่ตัดสินไม่ตรงกัน */
function useCard(ctx, uid, { target, cards }) {
  const st = ctx.state;
  const p = st.pending;
  if (p?.by !== uid) return null;

  /* กำลังถามว่าจะยกแผนที่ให้ใคร — คนละเรื่องกับการถามเป้าของผลการ์ด */
  if (p.mode === 'gift') return giveMap(ctx, uid, p, target);

  const picks = p.picks || {};
  const step = p.needs || nextStep(p.card, picks);
  if (!step) return null;

  const upTo = pickUpToOf(p.card, step);
  const want = pickCountOf(p.card, step);
  let answer;

  if (upTo) {
    /* เลือกได้ไม่เกิน N ใบ และไม่เลือกเลยก็ได้ — ต่างจากขั้นที่ต้องครบพอดี
       ตรวจกับมือจริงของเจ้าตัว ไม่ใช่รายการที่หน้าจอส่งมา */
    const mine0 = handsOf(ctx)[uid] || [];
    const list = Array.isArray(cards) ? cards : [];
    if (list.length > upTo) return null;
    if (new Set(list).size !== list.length) return null;
    if (!list.every(c => mine0.includes(c))) return null;
    answer = list;
  } else if (want > 1 && step === 'slots') {
    /* เลือกช่องการ์ดบนกระดาน — ตรวจว่าเป็นเลขช่องจริงและช่องนั้นมีไพ่คว่ำอยู่
       ไม่ใช้กองลับเหมือนรังกา เพราะช่องการ์ดเป็นของสาธารณะอยู่แล้ว */
    const deck = deckOf(ctx);
    const list = Array.isArray(cards) ? cards.map(Number) : [];
    if (list.length !== want) return null;
    if (new Set(list).size !== list.length) return null;
    if (!list.every(i => Number.isInteger(i) && deck.slots?.[i])) return null;
    answer = list;
  } else if (want > 1) {
    /* ขั้นที่เลือกหลายใบพร้อมกัน — ส่งมาเป็นชุดเดียว ต้องครบพอดีและห้ามซ้ำ
       ตรวจกับกองที่เก็บไว้ในข้อมูลลับของคนเปิด ไม่ใช่กองที่หน้าจอส่งมาเอง */
    const pool = ctx.secrets?.[uid]?.pool || [];
    const list = Array.isArray(cards) ? cards : [];
    if (list.length !== want) return null;
    if (new Set(list).size !== list.length) return null;
    if (!list.every(c => pool.includes(c))) return null;
    answer = list;
  } else {
    if (!targetsOf(st, uid, p.card, step, picks).includes(target)) return null;
    answer = target;
  }

  /* เก็บคำตอบของขั้นนี้ แล้วดูว่ายังมีขั้นถัดไปอีกไหม
     การ์ดที่ถามหลายขั้น (เช่นจดหมาย — เลือกคน แล้วเลือกเรือ)
     จะวนกลับมาที่ฟังก์ชันนี้จนกว่าจะครบ ไม่ต้องมีทางแยกแยกต่างหาก */
  const got = { ...picks, [step]: answer };
  const more = nextStep(p.card, got);
  if (more) {
    /* ขั้นถัดไปเป็นการเลือกไพ่จากกอง ต้องส่งกองให้คนเปิดเห็นก่อน
       กองคำนวณจากมือทุกคนซึ่งมีแต่เจ้าของห้องรู้ จึงส่งผ่านข้อมูลลับของเขา */
      if (pickCountOf(p.card, more) > 1) {
      const mine0 = ctx.secrets?.[uid] || {};
      return {
        state: { ...st, pending: { ...p, picks: got, needs: more } },
        secrets: { [uid]: { ...mine0, pool: crowPool(handsOf(ctx), got.player) } }
      };
    }
    return { state: { ...st, pending: { ...p, picks: got, needs: more } } };
  }

  /* บังคับให้คนอื่นเปิด — ไม่มีผลเกิดตรงนี้ แค่ตั้งสถานะรอให้เขากดเปิดเอง
     ตายังไม่ผ่าน เพราะการเปิดเป็นส่วนหนึ่งของ Action นี้ */
  if (p.mode === 'force') {
    const done = pushLog({ ...st, pending: null,
                           forced: { by: uid, who: got.player, slots: got.slots,
                                     at: (st.logSeq || 0) + 1 },
                           deadline: Date.now() + PICK_MS },
                         'wreck.log.force',
                         { name: st.names?.[uid], who: st.names?.[got.player] });
    return { state: done };
  }

  const e = effectOf(p.card);
  const hands = handsOf(ctx);
  let out = e.run(st, uid, got, hands);

  /* การ์ดที่สั่งเปิดโหวตทันที — เปิดวงตรงนี้เลย ไม่ผ่านตา
     ต้องทำที่นี่เพราะการเปิดวงต้องรู้ว่าใครอยู่ในวงและถือไพ่อะไรบ้าง
     ซึ่งเป็นข้อมูลที่ผลการ์ดเห็นไม่ได้ */
  if (out.openVote) {
    const ov = out.openVote;
    const opened = startVote({ ...out.state,
      /* กบฏใต้ท้องเรือ — ถ้าผ่าน คนที่สั่งขึ้นเป็นกัปตันเอง ไม่ใช่ต้นหน */
      flag: ov.claim ? { by: uid, kind: ov.kind, place: ov.place, claim: true,
                         at: (out.state.logSeq || 0) + 1 } : null
    }, { kind: ov.kind, place: ov.place, caller: ov.caller });

    return {
      state: pushLog({ ...opened, pending: null, cardUp: null },
                     'wreck.log.card.' + p.card, { name: st.names?.[uid] }),
      secrets: undefined
    };
  }

  /* การ์ดที่สั่งให้จั่วทดแทน — เติมมือทุกคนกลับจนเต็มเพดานของตัวเอง
     ใช้ตัวเดียวกับที่ใช้หลังโหวต ไพ่ที่ทิ้งไปจึงกลับเข้ากองเองโดยไม่ต้องเก็บกอง */
  if (out.refill) {
    const back = refill(out.state.seats, out.hands, out.state.maxVote);
    out = { ...out,
      state: { ...out.state, votes: countHands(back.hands) },
      hands: back.hands };
  }

  /* การ์ดที่ใช้จากมือ ต้องถูกทิ้งออกจากมือหลังใช้ */
  const mine = ctx.secrets?.[uid] || {};
  const bag = p.from === 'hand'
    ? (mine.held || []).filter((c, i, a) => i !== a.indexOf(p.card))
    : (mine.held || []);

  /* สับไพ่ประเทศของสองคนแล้วแจกคืน — แตะข้อมูลลับของทั้งคู่
     ทำที่นี่เพราะผลการ์ดเห็นแต่สถานะสาธารณะ ไม่มีสิทธิ์อ่านไพ่ประเทศใคร */
  const mix = out.mixNations || null;
  let mixed = {};
  if (mix) {
    const [x, y] = mix;
    const two = [ctx.secrets?.[x]?.nation, ctx.secrets?.[y]?.nation];
    const drawn = Math.random() < 0.5 ? two : [two[1], two[0]];
    mixed = {
      [x]: { ...(ctx.secrets?.[x] || {}), nation: drawn[0] },
      [y]: { ...(ctx.secrets?.[y] || {}), nation: drawn[1] }
    };
  }

  /* การ์ดที่ยกให้คนอื่น — เข้ามือของเขา ไม่ใช่ของคนเปิด */
  const gift = out.give || null;
  const theirs = gift ? (ctx.secrets?.[gift.to]?.held || []) : [];
  const theirBag = gift ? [...theirs, gift.card] : theirs;

  /* ล้าง cardUp ด้วย ไม่งั้นพอฉากประกาศผลจบ ฉากเปิดการ์ดจะเด้งกลับมาเล่าซ้ำ */
  /* ผลถูกพักไว้เพราะเป้ามีการ์ดกันอยู่ในมือ — ยังไม่ประกาศอะไรทั้งนั้น
     ประกาศตอนนี้จะกลายเป็นบอกผลที่ยังไม่เกิด แล้วคนอาจรอดก็ได้ */
  const pausing = !!out.state.saveAsk;

  const next = pushLog({ ...out.state, pending: null, cardUp: null,
                         held: { ...out.state.held, [uid]: bag.length,
                                 ...(gift ? { [gift.to]: theirBag.length } : {}) },
                         /* การ์ดกัน Maroon ต้องรู้กันทั้งวง เพราะการยกแผนที่ประกาศอยู่แล้ว */
                         saves: giftSaves(out.state.saves, uid, bag, gift, theirBag),
                         ...(pausing || !out.shout ? {} : {
                           shout: noBlank({ ...out.shout, beforePos: st.pos,
                                            at: (out.state.logSeq || 0) + 1 }) }) },
                       'wreck.log.card.' + p.card,
                       { name: st.names?.[uid],
                         who: st.names?.[got.player] || st.names?.[target] });

  /* ใช้เสร็จแล้วเก็บกองที่ส่งไปให้ดูทิ้ง ไม่ต้องค้างไว้ในข้อมูลลับ */
  const secrets = {
    ...(out.hands === hands ? {} : secretsFrom(ctx, out.hands)),
    [uid]: { ...mine, ...(out.hands === hands ? {} : { vote: out.hands[uid] }),
             held: bag, pool: null },
    ...(gift ? { [gift.to]: { ...(ctx.secrets?.[gift.to] || {}), held: theirBag } } : {}),
    ...mixed
  };

  return { state: passTurn(next), secrets };
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
  /* ใช้สิทธิ์จากธงดำแล้วธงหมดผลทันที ใช้ได้ครั้งเดียว */
  const st2 = st.flag?.by === uid ? { ...st, flag: null } : st;
  const opened = startVote(st2, { kind, place, caller: uid });

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
  /* หนึ่งคนส่งได้หลายใบ (เอลโดราโดให้ส่งสองใบ) เก็บเป็นรายการเสมอ
     ใบเดียวก็เป็นรายการที่มีสมาชิกเดียว จะได้ไม่ต้องมีสองทางในโค้ด */
  const prev = picks[uid];
  const mineNow = [...(Array.isArray(prev) ? prev : (prev ? [prev] : [])), cardId];
  picks[uid] = mineNow;

  const left = { ...hands, [uid]: hands[uid].filter(c => c !== cardId) };

  /* ส่งครบตามสิทธิ์ของตัวเองแล้วถึงนับว่าเสร็จ */
  const need = voteWeight(st, uid);
  const done = mineNow.length >= need ? [...st.vote.done, uid] : st.vote.done;

  const next = {
    ...st,
    votes: countHands(left),
    vote: { ...st.vote, done, sent: { ...(st.vote.sent || {}), [uid]: mineNow.length } }
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
  const submitted = v.voters.flatMap(u => {
    const p = picks[u];
    return Array.isArray(p) ? p : (p ? [p] : []);
  });
  /* กระซิบ — คนที่ติดป้ายอยู่และได้ร่วมโหวตรอบนี้ ทำให้กองกลางเติมเพิ่มคนละใบ
     ติดซ้อนกันได้ นับเพิ่มใบละหนึ่ง แล้วป้ายถูกเก็บคืนทั้งหมดหลังใช้
     ทำที่นี่เพราะเป็นจุดเดียวที่รู้ว่ามีใครร่วมโหวตจริงบ้าง */
  const heard = v.voters.reduce((n, u) => n + markCount(st, u, 'whisper'), 0);
  const bonus = shuffle(pileOf(hands, submitted), rng).slice(0, (v.extra || 1) + heard);
  const pot = shuffle([...submitted, ...bonus], rng);

  const counts = tallyRow(pot, VOTE_ROW[v.kind]);
  let next = { ...st, vote: { ...v, pot, counts } };
  let handsOut = hands;

  if (v.kind === 'attack') next = resolveAttack(next, counts);
  else if (v.kind === 'mutiny') {
    const done = resolveMutiny(next, counts, handsOut);
    next = done.state; handsOut = done.hands;

    /* กบฏใต้ท้องเรือ — คนที่สั่งขึ้นเป็นกัปตันเอง ไม่ใช่ต้นหนตามปกติ
       ทำหลังกบฏสำเร็จแล้ว จึงย้ายเขาไปหัวแถวทับตำแหน่งที่ต้นหนเพิ่งเลื่อนขึ้นไป */
    if (st.flag?.claim && st.flag.by === v.caller && mutinyPasses(counts)) {
      const line = occupants(next.pos, v.place);
      const head = line[0];
      if (head && head !== v.caller) {
        next = { ...next, pos: swapSpots(next.pos, v.caller, head) || next.pos };
      }
    }
  } else if (v.kind === 'islandVote') next = resolveBrawl(next, counts);

  /* ตัวนับห้ามโหวตหักตรงนี้ ไม่ใช่ตอนสั่งโหวต — คนที่ถูกกันจึงเสียสิทธิ์ครบตามจำนวนครั้งจริง
     ส่วนน้ำหนักเสียงพิเศษใช้ได้ครั้งเดียว จบหม้อนี้ก็ล้างทิ้ง */
  /* หักโทษเก่าก่อน แล้วค่อยบวกโทษใหม่
     ถ้าบวกก่อน โทษที่เพิ่งได้จากเอลโดราโดจะโดนหักทิ้งในรอบเดียวกัน กลายเป็นไม่มีโทษเลย

     หักให้ **ทุกคนที่อยู่ในสถานที่นั้น** ไม่ใช่เฉพาะคนที่ได้ร่วมโหวต
     เพราะคนที่ติดโทษถูกตัดออกจากรายชื่อผู้ร่วมไปแล้วตั้งแต่ต้น
     ถ้าหักเฉพาะผู้ร่วม โทษของเขาจะไม่มีวันถูกหัก กลายเป็นห้ามโหวตตลอดกาล */
  /* ป้ายกระซิบของคนที่ได้ร่วมรอบนี้ถูกใช้ไปแล้ว เก็บคืนให้หมด */
  for (const u of v.voters) {
    const n = markCount(next, u, 'whisper');
    if (n) next = addMark(next, u, 'whisper', -n);
  }

  next = burnVoteBans(next, occupants(next.pos, next.vote.place));

  for (const u of Object.keys(next.voteWeight || {})) {
    if (voteWeight(next, u) > 1) next = addVoteBan(next, u, 1);
  }
  next = clearVoteWeights(next);

  /* จั่วทดแทนเฉพาะใบที่ลงไป มือที่เหลืออยู่กับที่
     ไพ่ที่ส่งเข้าหม้อถูกตัดออกจากมือไปแล้วตอนส่ง จึงกลับเข้ากองเองโดยอัตโนมัติ */
  const fresh = refill(next.seats, hands, next.maxVote, rng);
  next = {
    ...next,
    /* รวมกับของเดิม เพราะ refill ข้ามคนที่ไม่รู้มือไป ถ้าเขียนทับหมดชื่อเขาจะหาย */
    votes: { ...next.votes, ...countHands(fresh.hands) },
    voteDeck: fresh.pile.length,
    /* เก็บผลไว้ให้หน้าจอโชว์ต่อ เพราะ passTurn จะล้าง vote ทิ้ง */
    lastVote: { kind: v.kind, place: v.place, caller: v.caller,
                /* ไพ่ที่เกินมาจากกระซิบกี่ใบ — หน้าจอต้องรู้เพื่อใส่ชื่อให้ถูก */
                heard,
                /* ใครส่งไปกี่ใบ — หน้าจอต้องรู้เพื่อวาดไพ่ให้ครบพร้อมชื่อ
                   ไพ่ใบสุดท้ายปิดหม้อทันทีในการเขียนครั้งเดียว
                   คนอื่นจึงไม่เคยเห็นสถานะระหว่างทาง ต้องสร้างย้อนหลังจากตรงนี้ */
                sent: v.voters.reduce((m, u) => {
                  const p = picks[u];
                  const n = Array.isArray(p) ? p.length : (p ? 1 : 0);
                  if (n) m[u] = n;
                  return m;
                }, {}),
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

  /* คนถูกบังคับไม่ยอมเปิด — เปิดให้เองใบแรกที่เขาชี้ไว้ แล้วไปต่อ
     ทิ้งไปเฉย ๆ ไม่ได้ เพราะ Action ของคนสั่งจะสูญไปโดยไม่มีอะไรเกิดขึ้น */
  if (st.forced) {
    if (!due) return null;
    const pick = (st.forced.slots || [])[0];
    const out = await activate({ ...ctx, state: { ...st } }, st.forced.who, { slot: pick });
    return out || { state: passTurn({ ...st, forced: null }) };
  }

  /* คนเปิดการ์ดค้างไม่เลือกเป้า — ทิ้งผลการ์ดแล้วผ่านตาไป */
  if (st.pending) {
    if (!due) return null;
    return { state: passTurn(pushLog({ ...st, pending: null, cardUp: null },
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
        /* ส่งไพ่ประเทศทุกคนไปด้วย — เกมจบแล้ว ความลับหมดหน้าที่
           และหน้าสรุปต้องบอกได้ว่าใครอยู่ฝ่ายไหนตอนจบ */
        side: winningSide(st.cargo, nations),
        winners: winners(st.cargo, nations),
        nations
      }
    }
  };
}
