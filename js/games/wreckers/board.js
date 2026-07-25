/* board.js — ผังกระดาน Wreckers
   ─────────────────────────────────────────────────────────────
   พิกัดทุกตัวเป็นเปอร์เซ็นต์ ไม่ใช่พิกเซล กระดานจึงย่อขยายได้ทุกขนาด

   ตัวเลขของช่องยืนไม่ได้กะด้วยตา แต่วัดจากไฟล์ภาพจริง —
   ตรวจหาวงกลมสีเทาในรูปแล้วอ่านจุดศูนย์กลางออกมา
   ถ้าวันหลังวาดรูปใหม่แล้ววงขยับ ต้องวัดใหม่แล้วแก้ที่ไฟล์นี้ที่เดียว
   ───────────────────────────────────────────────────────────── */

import { countOf } from './cards.js';

export const ART = 'assets/game/wreckers/board/';

/* สัดส่วนของไฟล์ภาพ ใช้คำนวณความสูงของชิ้นส่วนบนกระดาน */
export const RATIO = { Carrack: 1024 / 1536, Island: 1, Rowboat: 1, Cargo_ship: 1, Cargo: 1536 / 1024 };

/* ช่องยืนบนเรือใหญ่ — วัดจาก Carrack.png (1024×1536)
   ทุกวงอยู่แกนกลาง x 49.22% วงโตเท่ากันหมด 11.23% ของความกว้างรูป */
export const SHIP_SLOTS = [
  { id: 'C', x: 49.22, y: 27.80 },
  { id: 'F', x: 49.22, y: 41.15 },
  { id: '3', x: 49.22, y: 53.78 },
  { id: '4', x: 49.22, y: 66.34 },
  { id: '5', x: 49.22, y: 78.97 }
];
export const SHIP_SLOT_SIZE = 11.23;

/* ช่องยืนบนเกาะ — วัดจาก Island.png (1254×1254) */
export const ISLAND_SLOTS = [
  { id: 'G',  x: 38.28, y: 23.68 },
  { id: '2',  x: 50.00, y: 23.76 },
  { id: '3',  x: 61.64, y: 29.27 },
  { id: '4',  x: 70.81, y: 38.04 },
  { id: '5',  x: 58.53, y: 43.62 },
  { id: '6',  x: 46.17, y: 46.81 },
  { id: '7',  x: 34.93, y: 54.94 },
  { id: '8',  x: 38.68, y: 66.19 },
  { id: '9',  x: 51.83, y: 63.56 },
  { id: '10', x: 64.11, y: 69.22 }
];
export const ISLAND_SLOT_SIZE = 9.17;

/* ที่วางกล่องสมบัติ — ฝั่งซ้ายของทุกลำคือ British ฝั่งขวาคือ France
   วัดช่องเก็บของจากรูปจริงที่เจ็ดระดับความสูง ได้ค่าตรงกันทุกครั้ง
     ช่องซ้าย  x 27.6 – 41.4%  กึ่งกลาง 34.5%
     ช่องขวา   x 57.2 – 70.6%  กึ่งกลาง 63.9%
   สองค่านี้สมมาตรรอบแกนกลางเรือที่ 49.22% พอดี ยืนยันว่าวัดถูก
   ช่องกว้าง 13.8% กล่องจึงกว้างได้ไม่เกิน 13%
   r คือองศาที่หมุนเพิ่มจากองศาของชิ้นส่วน กล่องบนเรือใหญ่วางแนบดาดฟ้าจึงไม่หมุนเพิ่ม
   เลื่อนลงจาก 37.5 เป็น 41 เพราะใบบนสุดยังกินขอบบนของกรอบอยู่ */
/* หมุนกล่อง 90 องศาให้ด้านยาวตั้งขึ้นตามช่องเก็บของ ซึ่งเป็นช่องแคบยาว
   วางนอนแล้วกินความกว้างจนต้องเว้นห่างกันมาก พอตั้งขึ้นก็วางชิดกันได้
   ระยะห่างแนวตั้งจึงลดจาก 12.5 เหลือ 9.5 */
export const SHIP_CARGO = {
  B: [{ x: 34.5, y: 44, r: 90 }, { x: 34.5, y: 53.5, r: 90 }, { x: 34.5, y: 63, r: 90 }],
  F: [{ x: 63.9, y: 44, r: 90 }, { x: 63.9, y: 53.5, r: 90 }, { x: 63.9, y: 63, r: 90 }]
};
export const SHIP_CARGO_SIZE = 13;

/* บนเกาะวางบนพื้นหญ้า เลี่ยงวงยืนและขอบเกาะ เอียงคนละทางให้ดูเป็นของที่ถูกวางทิ้งไว้ */
export const ISLAND_CARGO = {
  B: [{ x: 36, y: 36, r: -45 }, { x: 30, y: 42, r: -30 }],
  F: [{ x: 69, y: 57, r: -45 }, { x: 72, y: 49, r: 30 }]
};
export const ISLAND_CARGO_SIZE = 13;

/* ธงบอกว่าฝั่งไหนเป็นของประเทศไหน วางไว้เหนือกองกล่องของแต่ละฝั่ง
   ไม่งั้นคนเล่นใหม่ต้องจำเอาเองว่าซ้ายคือบริติช ขวาคือฝรั่งเศส */
export const SHIP_FLAGS = [
  { side: 'B', x: 34.5, y: 33 },
  { side: 'F', x: 63.9, y: 33 }
];
/* ธงฝรั่งเศสเดิมไปทับวงยืนหมายเลข 4 ย้ายลงมาอยู่เหนือกองกล่องฝั่งขวาแทน */
export const ISLAND_FLAGS = [
  { side: 'B', x: 27, y: 30 },
  { side: 'F', x: 78, y: 58 }
];
export const FLAG_SIZE = 12;

/* เรือสินค้าวางเรียงแถวเดียวชิดกัน
   เรือหมุน 90 องศา แกน y ของรูปจึงกลายเป็นแนวนอนบนจอ กล่องจึงไล่ตามแกน y
   ไม่หมุนสวนกลับแล้ว กล่องจึงหมุนตามเรือไปด้วยและกลายเป็นวางตั้งเรียงกัน */
/* กล่องหมุนตามเรือ 90 องศา ด้านยาวจึงตั้งขึ้น ความยาวตามแนวแถวเท่ากับ
   ความกว้างหารอัตราส่วนภาพ 1.5 → 17 / 1.5 = 11.3% ระยะห่างจึงต้องเป็น 11 ถึงจะชิดกัน */
export const MERCHANT_CARGO = [
  { x: 50, y: 33.5, r: 0 }, { x: 50, y: 44.5, r: 0 },
  { x: 50, y: 55.5, r: 0 }, { x: 50, y: 66.5, r: 0 }
];
export const MERCHANT_CARGO_SIZE = 17;

/* ตำแหน่งของชิ้นส่วนบนกระดาน — x กับ width คิดจากความกว้างเวที
   ส่วน y คิดจากความสูง เวทีล็อกอัตราส่วน 16:9 ไว้ ทุกอย่างจึงขยับตามกันหมด

   rot คือองศาที่หมุน ทุกภาพต้นฉบับหัวชี้ขึ้น หมุนบวกคือหัวเอียงไปทางขวา
   ช่องยืนกับกล่องสมบัติเป็นลูกของชิ้นส่วน จึงหมุนตามไปเองโดยไม่ต้องคำนวณใหม่
   มีแต่รูปประจำตัวที่หมุนกลับ เพื่อให้หน้าคนตั้งตรงเสมอ

   หมายเหตุเรื่องพื้นที่: เรือใหญ่เอียง 12 องศาแล้วกินพื้นที่กว้างขึ้นจาก 22%
   เป็นราว 28% จึงต้องเผื่อระยะให้เรือลำเล็กกับเกาะด้วย */
export const PIECES = [
  { id: 'shipL',    art: 'Carrack',    x: -2.8,  y: 5,  w: 33.7, rot:    8, kind: 'ship'   },
  { id: 'shipR',    art: 'Carrack',    x: 69.1,  y: 5,  w: 33.7, rot:   -8, kind: 'ship'   },
  { id: 'island',   art: 'Island',     x: 28.2,  y: 10, w: 43.6, rot:    0, kind: 'island' },
  { id: 'merchant', art: 'Cargo_ship', x: 38,    y: 68, w: 21.6, rot:   90, kind: 'merchant' },
  { id: 'boatL',    art: 'Rowboat',    x: 24.1,  y: 53, w: 9,    rot: -135, kind: 'boat'   },
  { id: 'boatR',    art: 'Rowboat',    x: 64.6,  y: 53, w: 9,    rot:  135, kind: 'boat'   }
];

/* อัตราส่วนเวที — ขยายชิ้นส่วน 30% แล้วเรือสูงเกิน 16:9 จึงต้องเพิ่มความสูงเวที
   ขนาดจริงของภาพเทียบกับไฟล์ (วัดมาแล้ว ไฟล์มีขอบโปร่งใสเยอะ)
     Carrack กว้างจริง 57.7% ของไฟล์ · Island 91.1% · Cargo_ship 40.7%
   ตัวเลขพวกนี้คือเหตุผลที่เรือดูเล็กทั้งที่ตัวเลขความกว้างเยอะ */
export const STAGE_RATIO = '16 / 10';

/* เรือลำเล็กมีที่นั่งเดียว วางกลางลำ */
export const BOAT_SLOT = { x: 50, y: 50, size: 34 };

export const slotsOf = (kind) =>
  kind === 'ship' ? SHIP_SLOTS : kind === 'island' ? ISLAND_SLOTS : [BOAT_SLOT_ONLY];

const BOAT_SLOT_ONLY = { id: 'x', ...BOAT_SLOT };

/* ทุกช่องบนกระดาน เขียนเป็นรหัสเดียว เช่น shipL:C หรือ island:7 */
export function allSpots() {
  const out = [];
  for (const p of PIECES) {
    if (p.kind === 'ship') SHIP_SLOTS.forEach(s => out.push(`${p.id}:${s.id}`));
    else if (p.kind === 'island') ISLAND_SLOTS.forEach(s => out.push(`${p.id}:${s.id}`));
    else if (p.kind === 'boat') out.push(`${p.id}:x`);
  }
  return out;
}

/* ── ตำแหน่งบนกระดานบอกบทบาท ─────────────────────────────────
   กติกาผูกอำนาจไว้กับที่ยืน ไม่ใช่ตัวผู้เล่น ย้ายที่เมื่อไหร่บทบาทเปลี่ยนทันที */
export function roleOf(spot) {
  if (!spot) return null;
  const [place, slot] = spot.split(':');
  if (place === 'boatL' || place === 'boatR') return 'rowboat';
  if (place === 'island') return slot === 'G' ? 'governor' : 'people';
  if (slot === 'C') return 'captain';
  if (slot === 'F') return 'mate';
  return 'cabin';
}

/* จำนวนการ์ด Event ที่เปิดวางคว่ำไว้กลางโต๊ะ และไพ่โหวตที่ถือได้สูงสุด */
export const EVENT_SLOTS = 5;
export const MAX_VOTE = 3;

/* จำนวนไพ่ทั้งสำรับ ใช้คำนวณว่าเหลือในกองเท่าไร
   Event 24 ใบ (Common 12 · Map 3 · Rare 9) · Vote 33 ใบ */
export const EVENT_TOTAL = 24;
export const VOTE_TOTAL = 33;

/* การ์ดพิเศษเลือกใส่ทีละใบได้ในหน้าตั้งค่าห้อง จำนวนจึงคิดจากชุดที่เลือกจริง */
export const eventTotal = (settings) => EVENT_TOTAL + countOf(settings?.extraCards);

/* ── Action ที่ทำได้ในหนึ่งตา ────────────────────────────────
   ชุดบนทุกคนมีเหมือนกัน ชุดล่างขึ้นกับตำแหน่งที่ยืนอยู่ตอนนั้น */
export const COMMON_ACTIONS = ['activate', 'peek', 'force'];

export const ROLE_ACTIONS = {
  captain:  ['attack', 'kick'],
  mate:     ['mutiny'],
  cabin:    ['shiftCargo'],
  governor: ['islandVote'],
  people:   [],
  rowboat:  []
};

/* ── ใครใช้ Action ลูกเรือได้บ้าง ─────────────────────────────
   ปกติคือคนที่ยืนช่อง 3, 4, 5 ซึ่งเป็นสามช่องท้ายของเรือ

   แต่กติกามีข้อยกเว้น: ถ้าบนเรือมีน้อยกว่า 3 คน คนท้ายสุดใช้ได้ด้วย
   กัปตันอยู่คนเดียวก็ย้ายกล่องได้ · มีกัปตันกับต้นหนก็เป็นต้นหน
   ถ้าดูแค่ชื่อตำแหน่งจะพลาดข้อนี้ ต้องนับคนบนเรือลำนั้นด้วย */
const CREW_SLOTS = ['3', '4', '5'];

export function shipOccupants(pos, shipId) {
  const taken = new Set(Object.values(pos || {}));
  return SHIP_SLOTS.map(s => `${shipId}:${s.id}`).filter(spot => taken.has(spot));
}

export function canShiftCargo(spot, pos) {
  if (!spot) return false;
  const [place, slot] = spot.split(':');
  if (place !== 'shipL' && place !== 'shipR') return false;
  if (CREW_SLOTS.includes(slot)) return true;

  const crowd = shipOccupants(pos, place);
  return crowd.length < 3 && crowd[crowd.length - 1] === spot;
}

/* ── เรือเล็กที่ไปได้จากตรงไหน ────────────────────────────────
   เรือใหญ่ผูกกับเรือเล็กฝั่งตัวเองเท่านั้น ข้ามฝั่งไม่ได้
   ส่วนคนบนเกาะเลือกได้ทั้งสองลำ */
export function boatsFrom(spot) {
  if (!spot) return [];
  const place = spot.split(':')[0];
  if (place === 'shipL') return ['boatL'];
  if (place === 'shipR') return ['boatR'];
  if (place === 'island') return ['boatL', 'boatR'];
  return [];                      // อยู่บนเรือเล็กอยู่แล้ว
}

export const boatFree = (pos, boat) => !Object.values(pos || {}).includes(boat + ':x');

/* กล่องสมบัติที่ผู้เล่นแตะได้ — ต้องอยู่ในสถานที่เดียวกันและมีสิทธิ์ย้ายกล่อง */
/* แตะกล่องได้ไหม — นอกจากต้องอยู่ที่นั่นและมีสิทธิ์แล้ว
   ฝั่งปลายทางต้องยังไม่เต็มด้วย ไม่งั้นกดไปก็ย้ายไม่ได้อยู่ดี
   ปิดตั้งแต่ตรงนี้ดีกว่าปล่อยให้กดแล้วค่อยถูกปฏิเสธเงียบ ๆ */
export function canTouchCargo(spot, pos, place, cargo, side) {
  if (!spot) return false;
  const mine = spot.split(':')[0];
  if (mine !== place) return false;
  if (place === 'island') return spot.split(':')[1] === 'G';
  if (!canShiftCargo(spot, pos)) return false;

  if (cargo && side) {
    const to = side === 'B' ? 'F' : 'B';
    if ((cargo[place]?.[to] || 0) >= SHIP_SIDE_CAP) return false;
  }
  return true;
}

/* เพดานกล่องต่อฝั่งบนเรือใหญ่ ต้องตรงกับ SHIP_CARGO_CAP ใน rules.js */
export const SHIP_SIDE_CAP = 3;

/* ── เวลาต่อตา ───────────────────────────────────────────────
   คนหลุดกลางตาจะได้เวลาผ่อนผันเท่ากับเวลาปกติคูณ 2.5 แต่ไม่เกิน 120 วินาที
   หมดแล้วยังไม่กลับมาก็ข้ามตาไปเลย ไม่งั้นทั้งวงต้องรออยู่คนเดียว */
export const TURN_OPTIONS = [0, 30, 45, 60, 90, 120];   /* 0 = ไม่จับเวลา */

/* ไม่จับเวลาไม่ได้แปลว่ารอตลอดกาล — ถ้าคนที่ถึงตาหลุดไป ยังต้องมีเพดานให้ทั้งวงไปต่อ */
export const OFFLINE_WAIT = 120000;
export const GRACE_MULT = 2.5;
export const GRACE_CAP = 120;
export const graceMs = (sec) => Math.min(GRACE_CAP, sec * GRACE_MULT) * 1000;

/* ลูกเต๋าที่ใช้สุ่มคนเริ่ม เลือกหน้าตามจำนวนผู้เล่น */
export const dieFor = (n) => (n <= 4 ? 4 : n <= 6 ? 6 : 12);

/* ทอยจนได้เลขที่ไม่เกินจำนวนผู้เล่น เหมือนทอยลูกเต๋าจริงแล้วทอยใหม่ถ้าเกิน */
export function rollStarter(n, rng = Math.random) {
  const sides = dieFor(n);
  let face = 0, guard = 0;
  do { face = 1 + Math.floor(rng() * sides); } while (face > n && guard++ < 200);
  return { sides, face: Math.min(face, n) };
}
