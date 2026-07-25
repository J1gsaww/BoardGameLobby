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

/* ── Action ที่ทำได้ในตานี้ ─────────────────────────────────
   หนึ่งตาทำได้หนึ่งอย่าง ยกเว้นการขึ้นฝั่งจากเรือเล็กที่เป็นของแถม
   ทำอัตโนมัติตอนเปิดตา ไม่กินสิทธิ์ Action */
export const COMMON = ['activate', 'peek', 'force', 'toBoat'];

export function actionsFor(st, uid) {
  if (st.phase !== 'play' || st.turn !== uid || st.vote) return [];
  const spot = st.pos?.[uid];
  if (!spot) return [];

  const place = placeOf(spot);
  const role = roleOf(spot);
  const out = [];

  /* บนเรือเล็กทำอะไรไม่ได้ รอขึ้นฝั่งอย่างเดียว */
  if (BOAT_IDS.includes(place)) return [];

  out.push('activate', 'peek', 'force');
  if (boatsOpen(st, spot).length) out.push('toBoat');

  if (role === 'captain') {
    if (canCallVote(st, place)) out.push('attack');
    if (occupants(st.pos, place).length > 1) out.push('kick');
  }
  if (role === 'mate' && canCallVote(st, place)) out.push('mutiny');
  if (role === 'governor' && canCallVote(st, place)) out.push('islandVote');
  if (canShift(st, uid)) out.push('shiftCargo');

  return out;
}

/* เรือเล็กที่ว่างและไปได้จากตรงนี้ */
export function boatsOpen(st, spot) {
  const place = placeOf(spot);
  const taken = new Set(Object.values(st.pos || {}).map(placeOf));
  const reach = place === 'shipL' ? ['boatL'] : place === 'shipR' ? ['boatR']
              : place === 'island' ? ['boatL', 'boatR'] : [];
  return reach.filter(b => !taken.has(b));
}

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
export const canCallVote = (st, place) =>
  !st.vote && !st.noVotes && occupants(st.pos, place).length >= 1;

/* ── Maroon ────────────────────────────────────────────────
   เด้งลงเกาะ · อยู่บนเกาะกับคนอื่นแล้วโดนซ้ำ ให้ไปต่อท้ายคิว
   อยู่บนเกาะคนเดียวแล้วโดนซ้ำ ไม่มีที่ให้ถอยแล้ว จึงเสียไพ่โหวตถาวรแทน

   คืน hands กลับมาด้วยเพราะการเสียไพ่ถาวรต้องทิ้งไพ่จริงจากมือ
   ไม่ใช่แค่ลดตัวเลขเพดาน ไม่งั้นมือจะเกินเพดานค้างอยู่ */
export function maroon(st, uid, hands = {}, rng = Math.random) {
  const pos = st.pos || {};
  const onIsland = placeOf(pos[uid]) === 'island';
  const alone = onIsland && occupants(pos, 'island').length === 1;

  if (alone) {
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

/* ── การโหวต ───────────────────────────────────────────────
   ผู้ร่วมโหวตคือทุกคนในสถานที่เดียวกับคนสั่ง
   ข้อยกเว้นเดียว: ก่อกบฏ กัปตันโหวตไม่ได้ เพราะเป็นคนที่ถูกโหวตเอง */
export const VOTE_ROW = { attack: 'attack', mutiny: 'mutiny', islandVote: 'brawl' };

export function voters(st, kind, place) {
  const line = occupants(st.pos, place);
  if (kind !== 'mutiny') return line;
  return line.filter(uid => roleAt(st.pos, uid) !== 'captain');
}

export function startVote(st, { kind, place, caller, target = null, side = null }) {
  const list = voters(st, kind, place);
  return {
    ...st,
    vote: {
      kind, place, caller, target, side,
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

export function winningSide(cargo) {
  const s = score(cargo);
  if (s.B > s.F) return 'B';
  if (s.F > s.B) return 'F';
  return 'D';
}

export const winners = (cargo, nations = {}) => {
  const side = winningSide(cargo);
  return Object.entries(nations).filter(([, n]) => n === side).map(([uid]) => uid);
};

/* ── ไพ่ประเทศ ─────────────────────────────────────────────
   คนคู่แบ่งบริติชกับฝรั่งเศสเท่ากัน · คนคี่มีดัตช์หนึ่งคน
   8 กับ 10 คนเลือกได้ว่าจะมีดัตช์กี่คน เพราะเหลือแบ่งได้ลงตัวทั้งสองแบบ
   ถ้าเลือกจนหารไม่ลงตัว ฝั่งที่เกินจะได้ไปหนึ่งคน ไม่ปัดทิ้ง */
export const DUTCH_OPTIONS = ['auto', '1', '2', 'random'];

export function dutchCount(n, setting = 'auto', rng = Math.random) {
  if (setting === 'random') return n % 2 === 0 ? (rng() < 0.5 ? 2 : 1) : 1;
  if (setting === '1') return 1;
  if (setting === '2') return 2;
  return n % 2 === 0 ? 0 : 1;                          // auto
}

export function dealNations(seats, setting = 'auto', rng = Math.random) {
  const n = seats.length;
  const d = Math.min(dutchCount(n, setting, rng), Math.max(0, n - 2));
  const rest = n - d;
  const b = Math.ceil(rest / 2);
  const bag = shuffle([
    ...Array(b).fill('B'), ...Array(rest - b).fill('F'), ...Array(d).fill('D')
  ], rng);
  return Object.fromEntries(seats.map((uid, i) => [uid, bag[i]]));
}

/* ── บันทึกเหตุการณ์ ───────────────────────────────────────
   เก็บเป็นคีย์ภาษากับพารามิเตอร์ ไม่เก็บเป็นข้อความสำเร็จรูป
   คนละเครื่องตั้งภาษาไม่เหมือนกัน แปลตอนวาดจึงถูกต้องทั้งสองฝั่ง */
export const LOG_MAX = 8;

export const pushLog = (st, key, args = {}) => ({
  ...st,
  log: [...(st.log || []), { key, args, at: (st.logSeq || 0) + 1 }].slice(-LOG_MAX),
  logSeq: (st.logSeq || 0) + 1
});
