/* rules.js — กติกาบริสุทธิ์ของ Wreckers
   ─────────────────────────────────────────────────────────────
   ไฟล์นี้ไม่แตะ DOM ไม่แตะ Firestore ไม่มีเวลา ไม่มีการสุ่มที่ห้ามส่ง rng เข้ามา
   ทุกฟังก์ชันรับสถานะเข้า คืนสถานะใหม่ออก ของเดิมไม่ถูกแก้
   เขียนแบบนี้เพราะกติกาเกมนี้ซับซ้อนกว่าที่หน้าตาบอก และการยิงเทส
   เข้าไปที่กฎตรง ๆ ทีละข้อ ง่ายกว่าเปิดสี่แท็บแล้วไล่คลิกทุกครั้งมาก

   game.js มีหน้าที่แค่ต่อสาย — รับคำขอจากผู้เล่น เรียกฟังก์ชันในนี้ แล้วส่งกลับ

   ── ของสำคัญที่ต้องเข้าใจก่อนอ่านต่อ ──────────────────────────
   1) คิวเป็นของจริง ไม่ใช่แค่ตำแหน่ง
      ทุกสถานที่ต้องมีคนยืนชิดหัวแถวเสมอ ห้ามมีช่องว่างคั่นกลาง
      คนออกไปเมื่อไหร่ ทุกคนข้างหลังเลื่อนขึ้นทันที
      บทบาทดูจากช่องที่ยืน ต้นหนจึงขึ้นเป็นกัปตันเองโดยไม่ต้องเขียนโค้ดเลื่อนตำแหน่ง

   2) กองไพ่โหวตไม่ได้เก็บไว้ที่ไหน
      สำรับมี 33 ใบตายตัว มือทุกคนเก็บในข้อมูลลับ กองที่เหลือจึงเท่ากับ
      สำรับ ลบ มือทุกคน ลบ ไพ่ในหม้อ — คำนวณเอาได้ตลอด
      ถ้าเก็บกองไว้ในสถานะสาธารณะ ใครเปิดดูก็เดามือคนอื่นได้หมด

   3) ไพ่หนึ่งใบมีสามหน้าพร้อมกัน ตอนนับดูเฉพาะแถวที่เกี่ยวกับการโหวตครั้งนั้น
   ───────────────────────────────────────────────────────────── */

import { SHIP_SLOTS, ISLAND_SLOTS, roleOf } from './board.js';
import { DECK, cardById } from './vote.js';

/* ── สถานที่กับคิว ─────────────────────────────────────────── */

export const SHIP_IDS = ['shipL', 'shipR'];
export const BOAT_IDS = ['boatL', 'boatR'];
export const PLACES = [...SHIP_IDS, 'island', ...BOAT_IDS];

/* ลำดับช่องในแต่ละสถานที่ = ลำดับคิว ช่องแรกคือหัวแถว */
export const QUEUE = {
  shipL: SHIP_SLOTS.map(s => s.id),
  shipR: SHIP_SLOTS.map(s => s.id),
  island: ISLAND_SLOTS.map(s => s.id),
  boatL: ['x'],
  boatR: ['x']
};

export const capacityOf = (place) => (QUEUE[place] || []).length;
export const placeOf = (spot) => (spot ? String(spot).split(':')[0] : null);
export const slotOf = (spot) => (spot ? String(spot).split(':')[1] : null);

/* เรือเล็กแต่ละลำเชื่อมสองฝั่ง ขึ้นจากฝั่งไหนก็ไปโผล่อีกฝั่ง */
export const BOAT_LINK = { boatL: ['shipL', 'island'], boatR: ['shipR', 'island'] };

/* คนในสถานที่หนึ่ง เรียงตามคิวจากหัวแถวไปท้ายแถว */
export function occupants(pos, place) {
  const order = QUEUE[place] || [];
  const at = {};
  for (const [uid, spot] of Object.entries(pos || {})) {
    if (placeOf(spot) === place) at[slotOf(spot)] = uid;
  }
  return order.map(s => at[s]).filter(Boolean);
}

/* บีบคิวให้ชิดหัวแถวทุกสถานที่ — เรียกทุกครั้งหลังมีคนออกจากสถานที่
   นี่คือหัวใจของกฎ "คนข้างหน้าย้ายออก คิวเขยิบขึ้นตามลำดับ"
   และเป็นเหตุผลที่ต้นหนขึ้นเป็นกัปตันเองเมื่อกัปตันโดนก่อกบฏ */
export function compact(pos) {
  const out = {};
  for (const place of PLACES) {
    occupants(pos, place).forEach((uid, i) => { out[uid] = `${place}:${QUEUE[place][i]}`; });
  }
  return out;
}

/* ต่อท้ายคิวของสถานที่หนึ่ง — เต็มแล้วคืน null ไม่ยัดเข้าไป

   ต้องบีบคิวก่อนหาช่องว่าง ไม่ใช่นับหัวคนแล้วเดาช่องเอา
   ถ้าคิวเดิมมีช่องโหว่อยู่ เช่นคนเดียวยืนอยู่ช่องที่สอง การนับหัวจะได้เลข 1
   แล้วชี้ไปช่องที่สองซึ่งมีคนอยู่แล้ว คนเดิมจะถูกทับหายไปทั้งคน */
export function joinPlace(pos, uid, place) {
  const without = { ...pos };
  delete without[uid];
  const packed = compact(without);
  const line = occupants(packed, place);
  if (line.length >= capacityOf(place)) return null;
  return compact({ ...packed, [uid]: `${place}:${QUEUE[place][line.length]}` });
}

export const roleAt = (pos, uid) => roleOf(pos?.[uid]);

/* ── ลำดับตา ───────────────────────────────────────────────── */

export const isPlaying = (st, uid) => st.seats.includes(uid) && !(st.out || []).includes(uid);

/* คนถัดไปที่ยังเล่นอยู่ ข้ามคนที่ออกจากเกมไปแล้ว
   วนครบรอบแล้วยังไม่เจอใครก็คืนคนเดิม แปลว่าเหลือคนเดียวจริง ๆ */
export function nextSeat(st, from = st.turn) {
  const n = st.seats.length;
  const here = st.seats.indexOf(from);
  for (let i = 1; i <= n; i++) {
    const uid = st.seats[(here + i + n) % n];
    if (isPlaying(st, uid)) return uid;
  }
  return from;
}

/* หาคนถัดไปที่ได้เล่นจริง — คนที่ยังติดหนี้ข้ามเทิร์นจะถูกหักหนี้แล้วข้ามไป
   คืนสถานะใหม่มาด้วยเพราะการหักหนี้เป็นการเปลี่ยนสถานะ ไม่ใช่แค่การอ่าน */
export function advance(st, from = st.turn) {
  let cur = st;
  let uid = nextSeat(cur, from);
  /* เก็บรายชื่อคนที่โดนข้ามไว้ด้วย เพื่อประกาศให้ทั้งวงรู้ว่าใครหยุดอยู่
     ถ้าไม่บอก คนเล่นจะเห็นแค่ตากระโดดข้ามหัวไปเฉย ๆ แล้วงงว่าทำไม */
  const skipped = [];
  for (let guard = 0; guard < cur.seats.length + 1; guard++) {
    if (!owesSkip(cur, uid)) return { state: cur, uid, skipped };
    skipped.push(uid);
    cur = burnSkip(cur, uid);
    uid = nextSeat(cur, uid);
  }
  return { state: cur, uid, skipped };
}

/* ── Action ที่ทำได้ในตานี้ ─────────────────────────────────
   หนึ่งตาทำได้หนึ่งอย่าง ยกเว้นการขึ้นฝั่งจากเรือเล็กที่เป็นของแถม
   ทำอัตโนมัติตอนเปิดตา ไม่กินสิทธิ์ Action */
export const COMMON = ['activate', 'peek', 'force', 'toBoat'];

/* การ์ดในมือที่ใช้ได้ในตาของใครก็ได้ — แยกออกมาเพราะไม่ผ่านด่านตรวจตา */
export function anytimeCards(st, uid, held = []) {
  /* เช็กแค่สองอย่างพอ — เกมกำลังเล่นอยู่ไหม และเรายังอยู่ในเกมไหม

     ของเดิมพี่ใส่เงื่อนไขซ้อนไว้อีกสี่อย่าง (มีโหวตอยู่ไหม มีคนค้างตอบไหม
     มีการ์ดค้างเลือกเป้าไหม มีการ์ดจองไว้ไหม) ซึ่งพอมีตัวใดตัวหนึ่งค้างอยู่
     ปุ่มจะหายไปเงียบ ๆ โดยไม่มีอะไรบอก และไล่หาสาเหตุแทบไม่ได้เลย

     ตัวที่ควรตัดสินว่าทำได้ไหมจริง ๆ คือฝั่งเซิร์ฟเวอร์ ซึ่งตรวจซ้ำอยู่แล้ว
     หน้าจอมีหน้าที่แค่ทำให้ปุ่มมีอยู่ ไม่ใช่เดาแทนกติกา */
  if (st.phase !== 'play') return [];
  if (!isPlaying(st, uid)) return [];
  return held.filter(c => ANYTIME.has(c));
}

/* รายชื่อการ์ดที่ใช้ได้ตลอด — rules.js ห้ามพึ่ง effects.js เพราะ effects พึ่ง rules อยู่แล้ว
   ถ้าอ้างกันไปมาจะเกิดวงกลม จึงประกาศไว้ที่นี่แล้วให้ทั้งสองฝั่งอ่านตัวเดียวกัน */
export const ANYTIME = new Set(['atlantis']);

export function actionsFor(st, uid) {
  if (st.phase !== 'play') return [];

  /* ค้างรอคำตอบว่าจะใช้การ์ดกัน Maroon ไหม
     ต้องเช็กก่อนด่านตรวจว่าถึงตาหรือยัง เพราะคนที่ถูกถามมักไม่ใช่คนที่ถึงตา
     เช่นโดนคนอื่นยิงด้วยปืนพก หรือโดนนกถล่มพร้อมทั้งลำ */
  if (st.saveAsk) return st.saveAsk.who === uid ? ['useSave'] : [];

  if (st.turn !== uid || st.vote) return [];
  const spot = st.pos?.[uid];
  if (!spot) return [];

  /* แอบดูค้างอยู่กลางคัน — ยังไม่จบตา แต่ทำอย่างอื่นไม่ได้จนกว่าจะดูครบ
     กติกาคือแอบดูสองใบ ดูใบแรกแล้วยังเหลือสิทธิ์ดูใบที่สอง */
  if (st.peek?.uid === uid) return ['peek'];

  /* โหวตยิงผ่านแล้ว เหลือให้กัปตันเลือกเป้ากับฝั่งที่จะเก็บกล่อง
     เลือกทีหลังเพราะจะได้ไม่ต้องตัดสินใจตั้งแต่ยังไม่รู้ว่าจะยิงติดไหม */
  /* การ์ดที่ค้างรอให้คนเปิดเลือกเป้า — ระหว่างนั้นทำอย่างอื่นไม่ได้เลย
     จังหวะเดียวกับตอนกัปตันเลือกเรือหลังยิงติด */
  if (st.pending?.by === uid) return ['useCard'];

  if (st.aim?.by === uid) {
    /* สามจังหวะ — เลือกลำที่จะยิง · เลือกฝั่งที่จะขโมย (เฉพาะยิงเรือ) · เลือกฝั่งที่จะเก็บ */
    if (!st.aim.target) return ['aimAt'];
    if (st.aim.target !== 'merchant' && !st.aim.from) return ['takeFrom'];
    return ['storeAt'];
  }

  const place = placeOf(spot);
  const role = roleOf(spot);
  const out = [];

  /* บนเรือเล็กทำอะไรไม่ได้ รอขึ้นฝั่งอย่างเดียว */
  if (BOAT_IDS.includes(place)) return [];

  out.push('activate', 'peek', 'force');
  if (boatsOpen(st, spot).length) out.push('toBoat');

  /* ถือธงดำอยู่ = สั่งโหวตได้โดยไม่ต้องมีตำแหน่ง ตามชนิดที่ธงให้มา */
  if (st.flag?.by === uid && canCallVote(st, place) && !isCalm(st)) out.push(st.flag.kind);

  /* ลมสงบ — ห้ามสั่งโหวตทุกชนิด ไม่ว่าอยู่ที่ไหนหรือมีตำแหน่งอะไร */
  if (isCalm(st)) {
    if ((st.held?.[uid] || 0) > 0) out.push('playHeld');
    return out;
  }

  if (role === 'captain') {
    if (canAttack(st, place)) out.push('attack');
    if (occupants(st.pos, place).length > 1) out.push('kick');
  }
  if (role === 'mate' && canCallVote(st, place)) out.push('mutiny');
  if (role === 'governor' && canCallVote(st, place)) out.push('islandVote');
  if (canShift(st, uid)) out.push('shiftCargo');

  /* การ์ดในมือไว้ท้ายสุดเสมอ — เป็น Action ของการ์ด ไม่ใช่ของตำแหน่ง
     วางปนกับ Action ปกติแล้วคนจะแยกไม่ออกว่าอันไหนมาจากไหน */
  if ((st.held?.[uid] || 0) > 0) out.push('playHeld');

  return out;
}

/* เรือเล็กที่ว่างและไปได้จากตรงนี้ */
export function boatsOpen(st, spot) {
  const place = placeOf(spot);
  const taken = new Set(Object.values(st.pos || {}).map(placeOf));
  const reach = place === 'shipL' ? ['boatL'] : place === 'shipR' ? ['boatR']
              : place === 'island' ? ['boatL', 'boatR'] : [];
  /* ลำที่โดนระเบิดไปแล้วใช้ไม่ได้อีกตลอดเกม */
  return reach.filter(b => !taken.has(b) && !isWrecked(st, b));
}

/* เรือเล็กที่ไปถึงได้จากตรงนี้ — รวมลำที่พังแล้วด้วย
   หน้าจอต้องรู้ว่ามีลำนั้นอยู่ เพื่อจะได้โชว์ปุ่มแบบทึบ ไม่ใช่ซ่อนหายไปเฉย ๆ */
export const boatsFromAll = (spot) => {
  const place = placeOf(spot);
  return place === 'shipL' ? ['boatL'] : place === 'shipR' ? ['boatR']
       : place === 'island' ? ['boatL', 'boatR'] : [];
};

/* เรือเล็กลำนี้พังไปแล้วหรือยัง */
export const isWrecked = (st, boat) => (st.wrecked || []).includes(boat);

/* ลูกเรือย้ายกล่องได้ — สามช่องท้ายเรือ หรือคนท้ายสุดถ้าบนเรือมีไม่ถึงสามคน
   ผู้ว่าฯ ไม่ได้ใช้ Action นี้ เพราะบนเกาะย้ายกล่องต้องผ่านการโหวตเท่านั้น */
export function canShift(st, uid) {
  const spot = st.pos?.[uid];
  const place = placeOf(spot);
  if (!SHIP_IDS.includes(place)) return false;
  const line = occupants(st.pos, place);
  if (['3', '4', '5'].includes(slotOf(spot))) return true;
  return line.length < 3 && line[line.length - 1] === uid;
}

/* ลมสงบสั่งห้ามโหวตทั้งกระดานตลอดรอบ · และห้ามซ้อนโหวตสองอันพร้อมกัน */
/* ลมสงบยังมีผลอยู่ไหม — ห้ามสั่งโหวตทุกชนิดจนกว่าตาจะวนกลับถึงคนเปิด
   เก็บเป็นชื่อคนแทนจำนวนรอบ เพราะจำนวนคนที่ยังเล่นอยู่เปลี่ยนได้ระหว่างรอบ */
export const isCalm = (st) => !!st.calm;

export const canCallVote = (st, place) =>
  !st.vote && !st.noVotes && occupants(st.pos, place).length >= 1;

/* ── Maroon ────────────────────────────────────────────────
   เด้งลงเกาะ · อยู่บนเกาะกับคนอื่นแล้วโดนซ้ำ ให้ไปต่อท้ายคิว
   อยู่บนเกาะคนเดียวแล้วโดนซ้ำ ไม่มีที่ให้ถอยแล้ว จึงเสียไพ่โหวตถาวรแทน

   คืน hands กลับมาด้วยเพราะการเสียไพ่ถาวรต้องทิ้งไพ่จริงจากมือ
   ไม่ใช่แค่ลดตัวเลขเพดาน ไม่งั้นมือจะเกินเพดานค้างอยู่ */
/* การ์ดในมือที่กัน Maroon ได้ แต่ต้องถามเจ้าตัวก่อนว่าจะใช้ไหม
   ต่างจากโล่ตรงที่โล่กันเองอัตโนมัติ ส่วนอันนี้เป็นการตัดสินใจ */
export const SAVE_CARDS = ['fountain'];

/* เก็บเฉพาะการ์ดที่กัน Maroon ได้ไว้ในสถานะสาธารณะ ไม่ใช่การ์ดในมือทั้งหมด
   ทำได้เพราะแผนที่ถูกยกให้กันโดยประกาศให้ทุกคนรู้อยู่แล้ว จึงไม่ได้เปิดเผยอะไรใหม่
   ส่วนการ์ดอย่างจดหมายยังเป็นความลับตามเดิม เห็นแค่จำนวนใบ */
export const saveInHand = (st, uid) => st.saves?.[uid] || null;

export function maroon(st, uid, hands = {}, rng = Math.random, force = false) {
  /* โล่กันได้ทุกกรณี รวมถึงกรณีที่ปกติจะกลายเป็นเสียไพ่ถาวร */
  if (hasShield(st, uid)) return { state: burnShield(st, uid), hands, kind: 'shielded' };

  /* มีการ์ดกันอยู่ในมือ = หยุดไว้ก่อน ไปถามเจ้าตัวว่าจะใช้ไหม
     ยังไม่แตะตำแหน่งอะไรทั้งนั้น รอคำตอบแล้วค่อยว่ากัน
     ทำตรงนี้จุดเดียวเพราะ maroon ถูกเรียกจากสิบกว่าที่ ถ้าไล่ใส่จะลืมแน่ */
  const save = force ? null : saveInHand(st, uid);
  if (save) {
    return {
      state: { ...st, saveAsk: { who: uid, card: save, at: (st.logSeq || 0) + 1 } },
      hands,
      kind: 'ask'
    };
  }

  const pos = st.pos || {};
  const onIsland = placeOf(pos[uid]) === 'island';
  const line = onIsland ? occupants(pos, 'island') : [];

  /* ถอยไปต่อท้ายแถวไม่ได้แล้ว = เสียไพ่โหวตถาวรแทน

     เกิดได้สองแบบ และผลเหมือนกันเพราะเหตุผลเดียวกัน
       อยู่บนเกาะคนเดียว     — ไม่มีแถวให้ถอย
       อยู่ท้ายแถวอยู่แล้ว   — ถอยไปก็อยู่ที่เดิม โทษจะกลายเป็นศูนย์

     ถ้าไม่คิดกรณีท้ายแถว การยิงคนท้ายแถวจะไม่มีผลอะไรเลย
     ซึ่งทำให้ตำแหน่งท้ายสุดกลายเป็นที่ปลอดภัยที่สุดบนกระดาน */
  const last = onIsland && line[line.length - 1] === uid;

  if (onIsland && last) {
    const cap = Math.max(0, (st.maxVote?.[uid] ?? 0) - 1);
    const hand = [...(hands[uid] || [])];
    if (hand.length > cap) hand.splice(Math.floor(rng() * hand.length), 1);
    return {
      state: { ...st, maxVote: { ...st.maxVote, [uid]: cap },
               votes: { ...st.votes, [uid]: hand.length } },
      hands: { ...hands, [uid]: hand },
      kind: 'loseCard'
    };
  }

  const moved = joinPlace(pos, uid, 'island');
  return {
    state: { ...st, pos: moved || pos },
    hands,
    kind: onIsland ? 'backOfQueue' : 'toIsland'
  };
}

/* ── กองไพ่โหวต ────────────────────────────────────────────
   กองที่เหลือ = สำรับทั้งใบ ลบมือทุกคน ลบไพ่ที่อยู่ในหม้อ
   ไม่ต้องเก็บกองไว้ที่ไหน และเดามือคนอื่นจากสถานะสาธารณะไม่ได้ */
export function pileOf(hands = {}, pot = []) {
  const gone = new Set([...Object.values(hands).flat(), ...pot]);
  return DECK.map(c => c.id).filter(id => !gone.has(id));
}

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* แจกคืนทุกคนตามเพดานของแต่ละคน — ทำหลังจบการโหวตทุกครั้ง
   คนที่เพดานถูกลดจาก Maroon จะได้น้อยลงถาวรตรงนี้เอง */
export function redeal(seats, maxVote, rng = Math.random) {
  const bag = shuffle(DECK.map(c => c.id), rng);
  const hands = {};
  for (const uid of seats) hands[uid] = bag.splice(0, Math.max(0, maxVote?.[uid] ?? 0));
  return { hands, pile: bag };
}

/* จั่วทดแทนเฉพาะใบที่ลงไป — มือที่เหลือไม่ถูกแตะเลย

   ต่างจาก redeal ตรงที่ไม่ได้สับใหม่ทั้งวง ใบที่ถืออยู่จึงอยู่กับที่ข้ามการโหวต
   ผลคือการจำว่าใครน่าจะถืออะไรมีความหมายจริง และการเลือกว่าจะทิ้งใบไหน
   กลายเป็นการตัดสินใจระยะยาว ไม่ใช่แค่รอบนี้

   กองที่เหลือ = สำรับทั้งใบ ลบมือทุกคน ไพ่ที่เพิ่งลงไปในหม้อจึงกลับเข้ากองเอง
   เพราะมันไม่อยู่ในมือใครแล้ว ไม่ต้องเก็บกองทิ้งไว้ที่ไหน */
export function refill(seats, hands, maxVote, rng = Math.random) {
  const held = new Set(Object.values(hands).flat());
  const bag = shuffle(DECK.map(c => c.id).filter(id => !held.has(id)), rng);

  const out = {};
  for (const uid of seats) {
    /* ไม่รู้ว่าคนนี้ถืออะไรอยู่ = ห้ามแจกให้เด็ดขาด
       เพราะไพ่ของเขาไม่ได้ถูกกันออกจากกอง ถ้าแจกจะได้ใบซ้ำกับที่เขาถืออยู่
       ปล่อยมือเขาไว้เฉย ๆ ปลอดภัยกว่าเดาแล้วทำให้ไพ่งอกในระบบ */
    if (!(uid in hands)) continue;

    const want = Math.max(0, maxVote?.[uid] ?? 0);
    const mine = [...(hands[uid] || [])].slice(0, want);
    while (mine.length < want && bag.length) mine.push(bag.shift());
    out[uid] = mine;
  }
  return { hands: out, pile: bag };
}

/* ── การโหวต ───────────────────────────────────────────────
   ผู้ร่วมโหวตคือทุกคนในสถานที่เดียวกับคนสั่ง
   ข้อยกเว้นเดียว: ก่อกบฏ กัปตันโหวตไม่ได้ เพราะเป็นคนที่ถูกโหวตเอง */
export const VOTE_ROW = { attack: 'attack', mutiny: 'mutiny', islandVote: 'brawl' };

export function voters(st, kind, place) {
  const line = occupants(st.pos, place)
    .filter(uid => !isVoteBanned(st, uid))           /* โดนสั่งห้ามโหวตอยู่ ไม่นับเป็นผู้ร่วม */
    /* เพดานไพ่เหลือศูนย์ = ไม่มีไพ่ให้ส่งอีกแล้ว ไม่นับเป็นผู้ร่วมโหวตตั้งแต่ต้น
       ถ้ายังนับอยู่ การโหวตจะค้างรอคนที่ส่งอะไรไม่ได้ตลอดกาล */
    .filter(uid => (st.maxVote?.[uid] ?? 0) > 0);
  if (kind !== 'mutiny') return line;
  return line.filter(uid => roleAt(st.pos, uid) !== 'captain');
}

/* ร่วมโหวตครั้งนี้ได้ไหม — หน้าจอใช้ตัดสินว่าจะไฮไลท์มือไพ่และให้กดไพ่ได้หรือเปล่า
   ใช้รายชื่อชุดเดียวกับฝั่งเซิร์ฟเวอร์ จะได้ไม่มีทางที่หน้าจอชวนให้กดสิ่งที่กดไม่ได้ */
export const canVoteNow = (st, uid) =>
  !!st.vote && st.vote.voters.includes(uid) && !st.vote.done.includes(uid);

/* เรือที่ยิงได้จริง — ต้องมีกล่องให้ชิงด้วย ยิงลำที่ว่างเปล่าไปก็ไม่ได้อะไร
   ยิงลำตัวเองไม่ได้อยู่แล้ว */
export function attackTargets(place, cargo) {
  const all = ['merchant', ...SHIP_IDS.filter(s => s !== place)];
  if (!cargo) return all;
  return all.filter(t => (t === 'merchant' ? cargo.merchant > 0
    : (cargo[t]?.B || 0) + (cargo[t]?.F || 0) > 0));
}

/* ฝั่งประเทศที่ขโมยจากเป้าได้ — ต้องมีกล่องอยู่จริง
   เรือสินค้าไม่มีฝั่ง จึงไม่ต้องเลือก */
export const takeSides = (cargo, target) =>
  target === 'merchant' ? [] : ['B', 'F'].filter(s => (cargo?.[target]?.[s] || 0) > 0);

/* ฝั่งที่เก็บกล่องไว้ได้บนเรือตัวเอง — ฝั่งที่เต็มเพดานแล้วใส่เพิ่มไม่ได้ */
export const keepSides = (cargo, place) =>
  ['B', 'F'].filter(s => (cargo?.[place]?.[s] || 0) < SHIP_CARGO_CAP);

/* สั่งโหวตยิงได้ไหม — ต้องมีที่ให้ชิง และมีที่ให้เก็บ
   เรือตัวเองเต็มหกกล่องแล้วยิงไปก็วางไม่ได้ จึงไม่ให้สั่งตั้งแต่แรก */
export const canAttack = (st, place) =>
  canCallVote(st, place)
  && attackTargets(place, st.cargo).length > 0
  && keepSides(st.cargo, place).length > 0;

export function startVote(st, { kind, place, caller }) {
  const list = voters(st, kind, place);
  return {
    ...st,
    vote: {
      kind, place, caller,
      voters: list,
      done: [],                       // ใครส่งไพ่แล้วบ้าง เห็นได้ทุกคน แต่ไม่เห็นว่าส่งใบไหน
      extra: 1,                       // ไพ่จากกองกลางที่จะเติมเข้าหม้อ ปกติหนึ่งใบเสมอ
      pot: null,                      // เปิดแล้วค่อยมีค่า
      result: null
    }
  };
}

export const voteReady = (st) =>
  !!st.vote && st.vote.voters.every(uid => st.vote.done.includes(uid));

/* นับสัญลักษณ์เฉพาะแถวที่เกี่ยวข้อง ไพ่ใบเปล่านับเป็นไม่มีอะไร
   ตัวอักษรซ้ำในหน้าเดียว = สัญลักษณ์นั้นสองอัน เช่น 'CF' คือปืนใหญ่กับไฟอย่างละหนึ่ง */
export function tallyRow(ids, row) {
  const n = {};
  for (const id of ids) {
    const card = cardById(id);
    if (!card || card.blank) continue;
    for (const ch of card[row] || '') n[ch] = (n[ch] || 0) + 1;
  }
  return n;
}

/* โจมตี — ต้องมีปืนใหญ่อย่างน้อยหนึ่ง และไฟมากกว่าน้ำ (น้ำหนึ่งดับไฟหนึ่ง) */
export function attackPasses(n) {
  return (n.C || 0) >= 1 && (n.F || 0) > (n.W || 0);
}

/* ก่อกบฏ — เห็นด้วยมากกว่าไม่เห็นด้วยเท่านั้นถึงผ่าน เสมอคือไม่ผ่าน */
export const mutinyPasses = (n) => (n.A || 0) > (n.D || 0);

/* ย้ายกล่องบนเกาะ — ดูผลต่างของธงสองฝั่ง แล้วแปลงเป็นการแบ่งกล่อง
   เกาะมีได้แค่ 2 หรือ 4 กล่อง เลขคี่เกิดไม่ได้ตามกติกา

   4 กล่อง: ผลต่าง 0 คงไว้ 2-2 · 1 ถึง 3 เป็น 3-1 · ตั้งแต่ 4 ขึ้นไปยกไปหมด 4-0
   2 กล่อง: เสมอคงไว้ 1-1 · ไม่เสมอยกไปหมด 2-0
   หม้อที่มีไพ่แค่สองสามใบจึงไปได้ไกลสุดแค่ 3-1 ซึ่งตรงกับที่ตั้งใจไว้ */
export function brawlSplit(n, total) {
  const b = n.B || 0, f = n.R || 0;
  const diff = Math.abs(b - f);
  const even = Math.floor(total / 2);
  if (diff === 0 || b === f) return { B: even, F: total - even };

  const win = b > f ? 'B' : 'F';
  let toWin;
  if (total <= 2) toWin = total;                       // 2 กล่อง ไม่เสมอก็ยกไปทั้งหมด
  else if (diff >= 4) toWin = total;                   // ถล่มขาด ยกไปทั้งหมด
  else toWin = even + 1;                               // ชนะแบบปกติ ขยับมาหนึ่งกล่อง

  return win === 'B' ? { B: toWin, F: total - toWin } : { B: total - toWin, F: toWin };
}

/* ── กล่องสมบัติ ───────────────────────────────────────────
   เรือใหญ่เก็บได้ประเทศละ 3 กล่อง · เกาะกับเรือสินค้าไม่จำกัด
   ทุกการย้ายต้องผ่านฟังก์ชันนี้ จะได้ไม่มีทางทำกล่องหายหรือเกิดกล่องใหม่ */
export const SHIP_CARGO_CAP = 3;
export const TOTAL_BOXES = 8;

const boxesAt = (cargo, place, side) =>
  place === 'merchant' ? (cargo.merchant || 0) : (cargo[place]?.[side] || 0);

export function moveBox(cargo, from, fromSide, to, toSide) {
  if (boxesAt(cargo, from, fromSide) < 1) return null;
  if (to !== 'merchant' && SHIP_IDS.includes(to)
      && boxesAt(cargo, to, toSide) >= SHIP_CARGO_CAP) return null;

  const next = {
    shipL: { ...cargo.shipL }, shipR: { ...cargo.shipR },
    island: { ...cargo.island }, merchant: cargo.merchant
  };
  if (from === 'merchant') next.merchant -= 1; else next[from][fromSide] -= 1;
  if (to === 'merchant') next.merchant += 1; else next[to][toSide] += 1;
  return next;
}

export const countBoxes = (cargo) =>
  cargo.shipL.B + cargo.shipL.F + cargo.shipR.B + cargo.shipR.F
  + cargo.island.B + cargo.island.F + cargo.merchant;

/* ── คะแนน ─────────────────────────────────────────────────
   นับเฉพาะกล่องที่อยู่บนฝั่งประเทศ กล่องบนเรือสินค้าไม่ใช่ของใคร
   บริติชชนะถ้ามีมากกว่า · ฝรั่งเศสเช่นกัน · เท่ากันเมื่อไหร่ดัตช์ชนะ */
export function score(cargo) {
  return {
    B: cargo.shipL.B + cargo.shipR.B + cargo.island.B,
    F: cargo.shipL.F + cargo.shipR.F + cargo.island.F,
    merchant: cargo.merchant
  };
}

/* ฝ่ายที่ชนะ — เสมอกันแล้วดัตช์ชนะ **ก็ต่อเมื่อมีดัตช์อยู่ในเกมจริง**
   ถ้าไม่มีใครเป็นดัตช์เลย การเสมอคือเสมอ ไม่มีใครชนะ
   ของเดิมคืน 'D' ทุกครั้งที่เสมอ ทำให้เกมที่ไม่มีดัตช์ประกาศผู้ชนะที่ไม่มีตัวตน */
export function winningSide(cargo, nations = null) {
  const s = score(cargo);
  if (s.B > s.F) return 'B';
  if (s.F > s.B) return 'F';
  if (!nations) return 'D';
  return Object.values(nations).includes('D') ? 'D' : 'tie';
}

export const winners = (cargo, nations = {}) => {
  const side = winningSide(cargo, nations);
  return Object.entries(nations).filter(([, n]) => n === side).map(([uid]) => uid);
};

/* ── ไพ่ประเทศ ─────────────────────────────────────────────
   ตามจำนวนคน: **คนคี่มีดัตช์ 1 คน · คนคู่ไม่มีดัตช์เลย**
   เพราะคนคู่แบ่งบริติชกับฝรั่งเศสลงตัวอยู่แล้ว ไม่ต้องมีคนกลาง
   ส่วนคนคี่แบ่งไม่ลงตัว จึงต้องมีดัตช์หนึ่งคนมารับเศษ

   กำหนดเองได้เฉพาะจำนวนคนที่ยังแบ่งลงตัว — ดัตช์ 1 คนได้ที่ 5, 7, 9 คน
   ดัตช์ 2 คนได้ที่ 8 กับ 10 คน นอกนั้นปุ่มจะกดไม่ได้ */
export const DUTCH_OPTIONS = ['auto', '1', '2'];
export const DUTCH_NEEDS = { '1': [5, 7, 9], '2': [8, 10] };

export const dutchAllowed = (n, setting) =>
  setting === 'auto' || (DUTCH_NEEDS[setting] || []).includes(Number(n));

export function dutchCount(n, setting = 'auto') {
  if (!dutchAllowed(n, setting)) setting = 'auto';     /* ตั้งค่าค้างไว้แล้วคนเปลี่ยน ให้ตกกลับเป็นอัตโนมัติ */
  if (setting === '1') return 1;
  if (setting === '2') return 2;
  return n % 2 === 0 ? 0 : 1;                          // auto
}

export function dealNations(seats, setting = 'auto', rng = Math.random) {
  const n = seats.length;
  const d = Math.min(dutchCount(n, setting), Math.max(0, n - 2));
  const rest = n - d;
  const b = Math.ceil(rest / 2);
  const bag = shuffle([
    ...Array(b).fill('B'), ...Array(rest - b).fill('F'), ...Array(d).fill('D')
  ], rng);
  return Object.fromEntries(seats.map((uid, i) => [uid, bag[i]]));
}

/* ═══════════════════════════════════════════════════════════
   ของกลางสิบอย่างที่การ์ดเรียกใช้
   ─────────────────────────────────────────────────────────
   การ์ด 49 ใบไม่ได้แปลว่าโค้ด 49 ชิ้น ส่วนใหญ่คือการหยิบของข้างล่างนี้
   มาผสมกัน เขียนไว้ตรงนี้ที่เดียวแล้วทุกใบเรียกใช้ร่วมกัน
   ผลข้างเคียงจึงเหมือนกันเสมอ ไม่ว่าจะมาจากการ์ดใบไหน
   ═══════════════════════════════════════════════════════════ */

/* ── 1. ถือการ์ดไว้ใช้ทีหลัง ────────────────────────────────
   จำนวนใบเป็นข้อมูลสาธารณะ แต่ถือใบไหนอยู่เป็นความลับของเจ้าตัว
   ตัว id จึงเก็บใน secrets ส่วนที่นี่เก็บแค่ตัวเลข */
export function holdCard(st, uid, held = {}, cardId) {
  const mine = [...(held[uid] || []), cardId];
  return {
    state: { ...st, held: { ...st.held, [uid]: mine.length } },
    held: { ...held, [uid]: mine }
  };
}

export function dropHeld(st, uid, held = {}, cardId) {
  const mine = (held[uid] || []).filter(c => c !== cardId);
  return {
    state: { ...st, held: { ...st.held, [uid]: mine.length } },
    held: { ...held, [uid]: mine }
  };
}

/* ── 2. ยกการ์ดให้คนอื่น ───────────────────────────────────
   การ์ด Map บังคับให้ยก เก็บเองไม่ได้ ยกให้ตัวเองก็ไม่ได้ */
export function giveCard(st, from, to, held = {}, cardId) {
  if (from === to) return null;
  if (!(held[from] || []).includes(cardId)) return null;
  const out = dropHeld(st, from, held, cardId);
  return holdCard(out.state, to, out.held, cardId);
}

/* ── 3. ข้ามเทิร์น ─────────────────────────────────────────
   เก็บเป็นจำนวนครั้งที่ค้างอยู่ ไม่ใช่ธงเปิดปิด เพราะการ์ดซ้อนกันได้
   ตัวนับถูกหักตอนถึงตาเขาจริง ๆ เท่านั้น */
export const addSkip = (st, uid, n = 1) => ({
  ...st, skip: { ...st.skip, [uid]: (st.skip?.[uid] || 0) + n }
});

export const owesSkip = (st, uid) => (st.skip?.[uid] || 0) > 0;

export function burnSkip(st, uid) {
  const left = (st.skip?.[uid] || 0) - 1;
  const skip = { ...st.skip };
  if (left > 0) skip[uid] = left; else delete skip[uid];
  return { ...st, skip };
}

/* ── 4. ห้ามร่วมโหวต ───────────────────────────────────────
   เหมือนข้ามเทิร์นแต่คนละตัวนับ โดนห้ามโหวตยังเดินหมากได้ตามปกติ */
export const addVoteBan = (st, uid, n = 1) => ({
  ...st, voteBan: { ...st.voteBan, [uid]: (st.voteBan?.[uid] || 0) + n }
});

export const isVoteBanned = (st, uid) => (st.voteBan?.[uid] || 0) > 0;

/* หักตัวนับของทุกคนที่ถูกกันออกจากการโหวตครั้งนี้ — เรียกตอนเปิดหม้อ */
export function burnVoteBans(st, list) {
  const ban = { ...st.voteBan };
  for (const uid of list) {
    const left = (ban[uid] || 0) - 1;
    if (left > 0) ban[uid] = left; else delete ban[uid];
  }
  return { ...st, voteBan: ban };
}

/* ── 5. โหวตหลายเสียง ──────────────────────────────────────
   ปกติคนละหนึ่งใบ เอลโดราโดทำให้ส่งได้สองใบในครั้งเดียว */
export const voteWeight = (st, uid) => Math.max(1, st.voteWeight?.[uid] || 1);

export const setVoteWeight = (st, uid, n) => ({
  ...st, voteWeight: { ...st.voteWeight, [uid]: Math.max(1, n) }
});

export function clearVoteWeights(st) {
  const out = { ...st };
  delete out.voteWeight;
  return out;
}

/* ── 6. ของติดตัวถาวร ──────────────────────────────────────
   ตอนนี้มีแค่ไก่จากนกอัลบาทรอส แต่เขียนเป็นระบบไว้เผื่อการ์ดใบอื่น
   ติดกับตัวคน ไม่ใช่ติดกับที่ยืน ย้ายที่แล้วไก่ตามไปด้วย */
export const addMark = (st, uid, kind, n = 1) => ({
  ...st, marks: { ...st.marks, [uid]: { ...(st.marks?.[uid] || {}),
    [kind]: ((st.marks?.[uid] || {})[kind] || 0) + n } }
});

export const markCount = (st, uid, kind) => (st.marks?.[uid] || {})[kind] || 0;

export const marksIn = (st, place, kind) =>
  occupants(st.pos, place).reduce((n, uid) => n + markCount(st, uid, kind), 0);

/* เก็บของชนิดนั้นคืนจากทุกคนบนกระดาน — มังสวิรัสใช้ตัวนี้ */
export function clearMark(st, kind) {
  const marks = {};
  for (const [uid, m] of Object.entries(st.marks || {})) {
    const rest = { ...m };
    delete rest[kind];
    if (Object.keys(rest).length) marks[uid] = rest;
  }
  return { ...st, marks };
}

/* ── 7. สลับและสุ่มตำแหน่งในคิว ────────────────────────────
   สลับสองคนได้แม้อยู่คนละสถานที่ ใช้กับหน้ากากที่สลับข้ามกระดานได้ */
export function swapSpots(pos, a, b) {
  if (!pos?.[a] || !pos?.[b] || a === b) return null;
  return compact({ ...pos, [a]: pos[b], [b]: pos[a] });
}

/* สุ่มลำดับใหม่ของทุกคนในสถานที่หนึ่ง คนเดิมครบเท่าเดิม แค่สลับที่ยืน */
export function shuffleQueue(pos, place, rng = Math.random) {
  const line = occupants(pos, place);
  if (line.length < 2) return pos;
  const mixed = shuffle(line, rng);
  const out = { ...pos };
  mixed.forEach((uid, i) => { out[uid] = `${place}:${QUEUE[place][i]}`; });
  return compact(out);
}

/* ── 8. โล่กัน Maroon ──────────────────────────────────────
   น้ำพุอมตะกันได้หนึ่งครั้งทุกกรณี ใช้แล้วหายไป */
export const addShield = (st, uid, n = 1) => ({
  ...st, shield: { ...st.shield, [uid]: (st.shield?.[uid] || 0) + n }
});

export const hasShield = (st, uid) => (st.shield?.[uid] || 0) > 0;

export function burnShield(st, uid) {
  const left = (st.shield?.[uid] || 0) - 1;
  const shield = { ...st.shield };
  if (left > 0) shield[uid] = left; else delete shield[uid];
  return { ...st, shield };
}

/* ── 9. แทรกคิวข้างหลังคนอื่น ──────────────────────────────
   ดันทุกคนที่อยู่หลังเป้าหมายถอยลงหนึ่งช่อง คนที่ตกท้ายแถวจนล้นโดน Maroon
   คืนรายชื่อคนที่ล้นออกมาด้วย ผู้เรียกจะได้เอาไป Maroon ต่อเอง */
export function insertBehind(pos, uid, target) {
  const place = placeOf(pos?.[target]);
  if (!place || uid === target) return null;

  const without = compact(Object.fromEntries(
    Object.entries(pos).filter(([u]) => u !== uid)));
  const line = occupants(without, place);
  const at = line.indexOf(target);
  if (at < 0) return null;

  const order = [...line.slice(0, at + 1), uid, ...line.slice(at + 1)];
  const cap = capacityOf(place);
  const stay = order.slice(0, cap);
  const spill = order.slice(cap);

  const out = { ...without };
  delete out[uid];
  stay.forEach((u, i) => { out[u] = `${place}:${QUEUE[place][i]}`; });
  for (const u of spill) delete out[u];

  return { pos: compact(out), spill };
}

/* ── 10. ดึงคนนอกสถานที่เข้ามาร่วมโหวต ─────────────────────
   ปกติโหวตจำกัดอยู่แค่คนในสถานที่เดียวกัน ใบ Map บางใบข้ามข้อนี้ได้
   คนที่ถูกดึงเข้ามาร่วมได้ครั้งเดียว จบโหวตแล้วกลับไปเป็นคนนอกเหมือนเดิม */
export function addVoter(st, uid) {
  if (!st.vote || st.vote.voters.includes(uid)) return st;
  return { ...st, vote: { ...st.vote, voters: [...st.vote.voters, uid], guests: [...(st.vote.guests || []), uid] } };
}

/* ── สำรับการ์ดเหตุการณ์ ───────────────────────────────────
   เก็บลำดับกองไว้ที่ข้อมูลลับชื่อ `_deck` ซึ่งไม่มีผู้เล่นคนไหน uid ตรงกับชื่อนี้
   กฎความปลอดภัยเดิมจึงกันให้เองว่าอ่านได้เฉพาะเจ้าของห้อง ไม่ต้องแก้กฎเพิ่ม

   ต่างจากกองไพ่โหวตตรงที่ลำดับของกองนี้มีความหมาย — ใบจบเกมต้องอยู่ห้าใบล่างสุด
   คำนวณย้อนจากมือทุกคนแบบกองโหวตไม่ได้ จึงต้องเก็บลำดับไว้จริง ๆ */
export const emptyDeck = () => ({ slots: [], draw: [], discard: [] });

/* กระจายใบตามจำนวนที่กำหนดในแค็ตตาล็อก แล้วสับ
   ปิดท้ายด้วยการดันใบจบเกมลงไปอยู่ในห้าใบล่างสุด
   สับเฉพาะห้าใบนั้นอีกที ไม่มีใครรู้ว่าจะจบตาไหน รู้แค่ว่าใกล้แล้ว */
export function buildEventDeck(catalogue, ender, zone = 5, rng = Math.random) {
  const all = catalogue.flatMap(c => Array(c.count).fill(c.id));
  const rest = shuffle(all.filter(id => id !== ender), rng);
  const enders = all.filter(id => id === ender);
  if (!enders.length) return rest;

  const tailSize = Math.max(0, zone - enders.length);
  const tail = shuffle([...rest.slice(rest.length - tailSize), ...enders], rng);
  return [...rest.slice(0, rest.length - tailSize), ...tail];
}

/* จั่วขึ้นมาเติมช่องที่ว่างจนครบ — เรียกทุกครั้งหลังมีใบถูกเปิด */
export function refillSlots(deck, count) {
  const slots = [...deck.slots];
  const draw = [...deck.draw];
  for (let i = 0; i < count; i++) {
    if (slots[i]) continue;
    slots[i] = draw.shift() || null;
  }
  return { ...deck, slots: slots.slice(0, count), draw };
}

/* ── นกอัลบาทรอสครบสองตัวบนเรือลำเดียว ────────────────────
   ทั้งลำโดน Maroon ตามลำดับผู้เล่น

   ต้องตรวจหลังทุกอย่างที่ทำให้จำนวนนกในสถานที่เปลี่ยน ซึ่งมีสองทาง
     ได้นกมาใหม่          — เปิดการ์ดอัลบาทรอส
     คนย้ายที่             — ลงเรือเล็ก ขึ้นฝั่ง โดนไล่ โดน Maroon สลับตำแหน่ง

   ทางที่สองมีจุดที่ต้องตรวจเยอะเกินกว่าจะไล่ใส่ทีละที่ จึงตรวจรวมทีเดียว
   หลังทุกคำสั่งแทน ที่ไหนเข้าเงื่อนไขก็จัดการที่นั่น พลาดไม่ได้เลย

   นกไม่หายไปหลังจากนี้ ติดตัวคนไปตลอดจนกว่าจะมีการ์ดมาเก็บคืน
   จึงเป็นไปได้ที่ลำเดิมจะเข้าเงื่อนไขซ้ำเมื่อมีคนใหม่ถือนกย้ายเข้ามา */
export function birdStrike(st, hands = {}, rng = Math.random) {
  for (const ship of SHIP_IDS) {
    if (marksIn(st, ship, 'bird') < 2) continue;

    const crew = occupants(st.pos, ship);
    if (!crew.length) continue;

    let cur = st, h = hands;
    for (const uid of crew) {
      const out = maroon(cur, uid, h, rng);
      cur = out.state; h = out.hands;
      /* เจอคนที่มีการ์ดกัน = หยุดทั้งขบวนไว้ก่อน รอเขาตอบแล้วค่อยทำต่อ
         เงื่อนไขนกยังเป็นจริงอยู่ ตัวกวาดหลังคำสั่งจะเรียกซ้ำให้เอง */
      if (out.kind === 'ask') break;
    }
    return { state: cur, hands: h, place: ship, who: crew };
  }
  return null;
}

/* ── บันทึกเหตุการณ์ ───────────────────────────────────────
   เก็บเป็นคีย์ภาษากับพารามิเตอร์ ไม่เก็บเป็นข้อความสำเร็จรูป
   คนละเครื่องตั้งภาษาไม่เหมือนกัน แปลตอนวาดจึงถูกต้องทั้งสองฝั่ง */
export const LOG_MAX = 8;

/* Firestore ปฏิเสธค่า undefined ทั้งชุดคำสั่ง ไม่ใช่แค่ข้ามฟิลด์นั้น
   คำสั่งทั้งก้อนจึงล้มโดยที่หน้าจอไม่มีอะไรบอก ปุ่มกดแล้วเงียบสนิท

   ตัวที่ทำให้เกิดบ่อยคือช่องว่างในบรรทัดบันทึก เช่นการ์ดที่ไม่มีเป้าเป็นคน
   แล้วโค้ดยังพยายามหาชื่อผู้เล่นของเป้ามาใส่ ตัดทิ้งตรงนี้ทีเดียวจบทุกใบ */
const clean = (o) => {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (v !== undefined) out[k] = v;
  return out;
};

export const pushLog = (st, key, args = {}) => ({
  ...st,
  log: [...(st.log || []), { key, args: clean(args), at: (st.logSeq || 0) + 1 }].slice(-LOG_MAX),
  logSeq: (st.logSeq || 0) + 1
});
