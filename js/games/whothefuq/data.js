/* data.js — ข้อมูลนิ่งของ Who the fuq are you
   ─────────────────────────────────────────────────────────────
   ที่นี่เก็บสามอย่าง: จุดเด่น 9 ข้อ · ลามะ 10 ตัว · การ์ด Event 40 ใบ
   ทั้งหมดมาตรง ๆ จาก Guide Book ฉบับเต็ม เป็นของที่ไม่ค่อยเปลี่ยน
   จึงเก็บเป็นข้อมูลล้วน ไม่ปนตรรกะเกม (ตรรกะอยู่ rules.js)

   ข้อความสองภาษาเก็บเป็น {th,en} ในไฟล์นี้เลย ไม่ผ่านคีย์ i18n
   เพราะมี 59 ชิ้น การประกาศคีย์คู่ th/en ให้ครบจะพลาดง่าย
   ส่วน chrome ของหน้าจอ (ปุ่ม ชื่อเฟส) ใช้ i18n ตามปกติ */

/* ── จุดเด่น 9 ข้อ (pool) ──────────────────────────────────── */
export const TRAITS = [
  { id: 't1', th: 'เคยขึ้นเวที',        en: 'Performed on stage' },
  { id: 't2', th: 'โน้มน้าวผู้คนเก่ง',   en: 'Persuasive' },
  { id: 't3', th: 'ชอบทำงานคนเดียว',    en: 'Works alone' },
  { id: 't4', th: 'เคยเดินทางไกล',      en: 'Travelled far' },
  { id: 't5', th: 'มีความอดทนสูง',      en: 'Very patient' },
  { id: 't6', th: 'ชอบสังเกตรายละเอียด', en: 'Observant' },
  { id: 't7', th: 'เคยเป็นผู้นำ',        en: 'Has led others' },
  { id: 't8', th: 'คิดนอกกรอบ',         en: 'Thinks outside the box' },
  { id: 't9', th: 'เคยช่วยเหลือผู้อื่น',  en: 'Has helped others' }
];

export const TRAIT_IDS = TRAITS.map(t => t.id);
export const traitById = (id) => TRAITS.find(t => t.id === id) || null;

/* ── ลามะ 10 ตัว ───────────────────────────────────────────
   vec = เวกเตอร์ 9 หลัก ต่อกับ TRAIT_IDS ตามลำดับ (1 = มีจุดเด่นนั้น)
   art = ภาพที่ผู้ใช้เตรียมไว้แล้วใน assets/game/whothefuq/cards/<n>.jpg
   ⚠️ เวกเตอร์ชุดนี้มาจากตารางที่ผู้ใช้เคยส่ง ต้องยืนยันอีกครั้งว่าตรงกับ
      ตาราง "ข้อมูลลามะ" ใน Guide Book เพราะถ้าผิดแม้บิตเดียว การสืบจะเพี้ยน */
export const LLAMAS = [
  { id: 'inventor',  n: 1,  vec: '110111110', th: 'ลามะนักประดิษฐ์',    en: 'Inventor Llama' },
  { id: 'detective', n: 2,  vec: '011101111', th: 'ลามะนักสืบ',         en: 'Detective Llama' },
  { id: 'singer',    n: 3,  vec: '111011100', th: 'ลามะนักร้อง',        en: 'Singer Llama' },
  { id: 'police',    n: 4,  vec: '100110111', th: 'ลามะตำรวจ',          en: 'Police Llama' },
  { id: 'doctor',    n: 5,  vec: '111000111', th: 'คุณหมอลามะ',         en: 'Doctor Llama' },
  { id: 'magician',  n: 6,  vec: '011111010', th: 'ลามะนักมายากล',      en: 'Magician Llama' },
  { id: 'writer',    n: 7,  vec: '001110111', th: 'ลามะนักเขียน',       en: 'Writer Llama' },
  { id: 'reporter',  n: 8,  vec: '110011101', th: 'ลามะนักข่าว',        en: 'Reporter Llama' },
  { id: 'scientist', n: 9,  vec: '101001111', th: 'ลามะนักวิทยาศาสตร์', en: 'Scientist Llama' },
  { id: 'actor',     n: 10, vec: '111110010', th: 'ลามะนักแสดง',        en: 'Actor Llama' }
];

export const LLAMA_IDS = LLAMAS.map(l => l.id);
export const llamaById = (id) => LLAMAS.find(l => l.id === id) || null;
export const llamaArt = (id) => {
  const l = llamaById(id);
  return l ? `assets/game/whothefuq/cards/${l.n}.jpg` : null;
};

/* จุดเด่นของลามะตัวหนึ่ง → คืนเป็นรายการ trait id */
export function traitsOf(llamaId) {
  const l = llamaById(llamaId);
  if (!l) return [];
  return TRAIT_IDS.filter((_, i) => l.vec[i] === '1');
}

/* ลามะมีจุดเด่นนี้ไหม — ใช้ตอนเฉลยผลการ์ด/challenge */
export const llamaHasTrait = (llamaId, traitId) => {
  const l = llamaById(llamaId);
  const i = TRAIT_IDS.indexOf(traitId);
  return !!l && i >= 0 && l.vec[i] === '1';
};

/* ── การ์ด Event 40 ใบ ─────────────────────────────────────
   timing : P1 = ทำทันที ไม่กระทบคนเปิด
            P2 = เก็บขึ้นมือ ใช้ทีหลัง (ถือได้สูงสุด 2 ใบ)
            P3 = ทั้งวงทำพร้อมกัน รวมคนเปิด
   pol    : good = ดีต่อคนเปิด · risk = เสี่ยง/เปิดตัวเอง · neu = กลาง
   cat    : reveal · probe · neighbor · shield · strike · chaos
   count  : จำนวนใบในสำรับ
   ⚠️ effect ของแต่ละใบ "ยังไม่ต่อกติกา" — ตอนนี้เปิดแล้วแค่โชว์ชื่อ+คำอธิบาย
      ตั้งใจทำทีละใบเหมือน Wreckers เพราะหลายใบต้องออกแบบหน้าต่างเอง */
export const EVENT_CARDS = [
  /* หมวด 1 — REVEAL (ดันข้อมูล) · 13 ใบ */
  { id: 'broadcast', cat: 'reveal', timing: 'P3', pol: 'neu',  count: 2,
    th: { name: 'เสียงตามสาย', desc: 'คนเปิดเลือกประกาศ 1 จุดเด่น แล้วให้ใครก็ตามที่มีจุดเด่นนั้นประกาศตัว' },
    en: { name: 'Broadcast',   desc: 'The flipper names one trait; everyone who has it must declare' } },
  { id: 'missing', cat: 'reveal', timing: 'P1', pol: 'good', count: 1,
    th: { name: 'ตามหาคนหาย', desc: 'คนเปิดได้แอบดูลามะ 1 ตัวที่ถูกถอดออกจากเกม' },
    en: { name: 'Missing Person', desc: 'The flipper secretly sees one llama that was removed from play' } },
  { id: 'spotlight', cat: 'reveal', timing: 'P1', pol: 'risk', count: 2,
    th: { name: 'หิวแสง', desc: 'คนเปิดเปิดจุดเด่นตัวเอง 1 ข้อ (เลือกเอง) ให้ทั้งวงเห็น' },
    en: { name: 'Spotlight', desc: 'The flipper reveals one of their own traits (their choice) to everyone' } },
  { id: 'trade', cat: 'reveal', timing: 'P1', pol: 'neu', count: 2,
    th: { name: 'คนละหมัด', desc: 'คนเปิดเปิดจุดเด่นตัวเอง 1 ข้อ แลกกับดูจุดเด่น 1 ข้อของคนที่เลือก' },
    en: { name: 'Blow for Blow', desc: 'The flipper reveals one own trait to see one trait of a chosen player' } },
  { id: 'expose', cat: 'reveal', timing: 'P2', pol: 'good', count: 1,
    th: { name: 'โหนกะแฉ', desc: 'เก็บไว้ · บังคับ 1 คนให้เปิดจุดเด่น 1 ข้อ (เขาเลือกเอง) ต่อหน้าวง' },
    en: { name: 'Exposé', desc: 'Hold · force one player to reveal one trait of their choice to the table' } },
  { id: 'crack', cat: 'reveal', timing: 'P3', pol: 'neu', count: 2,
    th: { name: 'ความแตก', desc: 'ทุกคนเปิดจุดเด่นตัวเอง 1 ข้อ พร้อมกัน' },
    en: { name: 'The Crack', desc: 'Everyone reveals one of their own traits at the same time' } },
  { id: 'combo', cat: 'reveal', timing: 'P1', pol: 'neu', count: 1,
    th: { name: 'แพ็คคู่', desc: 'คนเปิดเลือก 2 จุดเด่น · ใครมีครบทั้งคู่ต้องประกาศ (ยกเว้นคนเปิด)' },
    en: { name: 'Combo', desc: 'The flipper names two traits; anyone with both must declare (flipper excluded)' } },
  { id: 'exclude', cat: 'reveal', timing: 'P3', pol: 'neu', count: 1,
    th: { name: 'ตัดตัวเลือก', desc: 'คนเปิดเลือก 1 จุดเด่น · ใครไม่มีให้ยกมือ (รวมคนเปิด)' },
    en: { name: 'Rule Out', desc: 'The flipper names one trait; everyone who lacks it raises a hand (flipper included)' } },
  { id: 'interview', cat: 'reveal', timing: 'P1', pol: 'good', count: 1,
    th: { name: 'ขอสัมภาษณ์', desc: 'คนเปิดตั้งคำถาม yes/no เรื่องจุดเด่น 1 ข้อ ทุกคนตอบจริง (คนเปิดไม่ต้องตอบ)' },
    en: { name: 'Interview', desc: 'The flipper asks one yes/no trait question; all answer truthfully (flipper exempt)' } },

  /* หมวด 2 — PROBE (สืบเจาะ) · 5 ใบ */
  { id: 'peek', cat: 'probe', timing: 'P2', pol: 'good', count: 1,
    th: { name: 'แอบส่อง', desc: 'เก็บไว้ · ถาม 1 คนว่ามีจุดเด่นที่ระบุไหม เขาตอบจริง รู้กันสองคน' },
    en: { name: 'Peek', desc: 'Hold · ask one player if they have a named trait; they answer truthfully, privately' } },
  { id: 'callout', cat: 'probe', timing: 'P1', pol: 'neu', count: 1,
    th: { name: 'จับโป๊ะ', desc: 'คนเปิดถามจุดเด่นของ 1 คนกลางโต๊ะ เขาตอบจริง ทั้งวงได้ยิน' },
    en: { name: 'Call Out', desc: 'The flipper asks about one trait of a player aloud; they answer truthfully to all' } },
  { id: 'scan', cat: 'probe', timing: 'P2', pol: 'good', count: 1,
    th: { name: 'สแกนร่าง', desc: 'เก็บไว้ · เลือก 1 คน ดูจุดเด่นของเขา 2 ข้อ (เขาเลือกโชว์) ส่วนตัว' },
    en: { name: 'Body Scan', desc: 'Hold · choose one player and see two of their traits (their pick), privately' } },
  { id: 'nosey', cat: 'probe', timing: 'P2', pol: 'good', count: 2,
    th: { name: 'ป้าข้างบ้าน', desc: 'เก็บไว้ · เมื่อมีการ "แกเป็นใคร" แอบรู้ได้ว่าคนทายเป็นลามะอะไร' },
    en: { name: 'Nosey Neighbor', desc: 'Hold · when a challenge happens, secretly learn what the challenger guessed' } },

  /* หมวด 3 — NEIGHBOR (คนข้างๆ) · 6 ใบ */
  { id: 'peep', cat: 'neighbor', timing: 'P1', pol: 'good', count: 1,
    th: { name: 'ถ้ำมอง', desc: 'คนเปิดขอดูจุดเด่น 1 ข้อของคนข้างๆ (คนข้างๆ เลือกโชว์เอง)' },
    en: { name: 'Peeping', desc: 'The flipper sees one trait of a neighbor (the neighbor chooses which)' } },
  { id: 'goodneighbor', cat: 'neighbor', timing: 'P1', pol: 'neu', count: 2,
    th: { name: 'เพื่อนบ้านแสนดี', desc: 'คนเปิดกับคนข้างๆ 1 คน เปิดจุดเด่นให้กันคนละ 1 ข้อ (รู้กัน 2 คน)' },
    en: { name: 'Good Neighbor', desc: 'The flipper and one neighbor each show one trait to each other' } },
  { id: 'gossip', cat: 'neighbor', timing: 'P1', pol: 'neu', count: 1,
    th: { name: 'เม้าท์ต่อ', desc: 'ให้คนข้างๆ 1 คน บอกสิ่งที่รู้เรื่องจุดเด่น/ลามะ ของคนอื่น 1 อย่างให้คนเปิด' },
    en: { name: 'Gossip', desc: 'A neighbor tells the flipper one thing they know about someone else' } },
  { id: 'bestie', cat: 'neighbor', timing: 'P1', pol: 'neu', count: 1,
    th: { name: 'เพื่อนสนิท', desc: 'คนเปิดบอกจุดเด่นตัวเอง 1 ข้อให้คนข้างๆ · จริงหรือโกหกก็ได้' },
    en: { name: 'Close Friend', desc: 'The flipper tells a neighbor one of their traits — truth or lie allowed' } },
  { id: 'truefriend', cat: 'neighbor', timing: 'P1', pol: 'neu', count: 1,
    th: { name: 'เพื่อนแท้', desc: 'คนเปิดเลือก 1 คน · คนนั้นกับคนเปิดห้าม "แกเป็นใคร" กัน 2 รอบ' },
    en: { name: 'True Friend', desc: 'The flipper picks one player; the two may not challenge each other for 2 rounds' } },

  /* หมวด 4 — SHIELD (ป้องกัน) · 7 ใบ */
  { id: 'vanish', cat: 'shield', timing: 'P2', pol: 'good', count: 1,
    th: { name: 'หายตัว', desc: 'เก็บไว้ · ยกเลิก "แกเป็นใคร" ที่มาหาตัวเอง 1 ครั้ง' },
    en: { name: 'Vanish', desc: 'Hold · cancel one challenge aimed at you' } },
  { id: 'silence', cat: 'shield', timing: 'P2', pol: 'good', count: 1,
    th: { name: 'ไม่ต้องพูด', desc: 'เก็บไว้ · เลือก 1 คน ห้ามพูดตลอดช่วง "แกเป็นใคร" ตานั้น (พูดไม่ได้ = ทายไม่ได้)' },
    en: { name: 'Silence', desc: 'Hold · one player cannot speak this challenge phase (no speaking = no guessing)' } },
  { id: 'heavens', cat: 'shield', timing: 'P1', pol: 'good', count: 2,
    th: { name: 'คุณพระช่วย', desc: 'รอบนี้ห้ามใคร "แกเป็นใคร" ใส่คนเปิด' },
    en: { name: 'Heavens!', desc: 'No one may challenge the flipper this round' } },
  { id: 'noshow', cat: 'shield', timing: 'P2', pol: 'good', count: 2,
    th: { name: 'ไม่รู้ไม่ชี้', desc: 'เก็บไว้ · เมื่อมีประกาศ "ใครมีจุดเด่น..." เลือกไม่ประกาศได้ 1 ครั้ง แม้จะมี' },
    en: { name: 'Playing Dumb', desc: 'Hold · once, decline to declare on a "who has trait X" call even if you have it' } },
  { id: 'truce', cat: 'shield', timing: 'P3', pol: 'neu', count: 1,
    th: { name: 'สงบศึก', desc: 'รอบนี้ห้าม "แกเป็นใคร" ใครทั้งวง' },
    en: { name: 'Truce', desc: 'No challenges at all this round' } },

  /* หมวด 5 — STRIKE (จู่โจม) · 7 ใบ */
  { id: 'whoareyou', cat: 'strike', timing: 'P1', pol: 'good', count: 2,
    th: { name: 'แกเป็นใคร', desc: 'คนเปิดได้ "แกเป็นใคร" ฟรีทันที 1 ครั้ง · ผิดไม่เสียโทษ' },
    en: { name: 'Who Are You', desc: 'The flipper gets one free challenge now — no penalty if wrong' } },
  { id: 'manlyroad', cat: 'strike', timing: 'P3', pol: 'neu', count: 1,
    th: { name: 'เส้นทางลูกผู้ชาย', desc: 'รอบนี้ "แกเป็นใคร" ได้ไม่จำกัด แต่โทษผิด = เปิดจุดเด่น 2 ข้อ' },
    en: { name: "Man's Road", desc: 'Unlimited challenges this round, but a wrong one reveals two of your traits' } },
  { id: 'awaken', cat: 'strike', timing: 'P2', pol: 'good', count: 1,
    th: { name: 'จงตื่น', desc: 'เก็บไว้ · ให้คนที่ออกจากเกมไปแล้ว เปิดจุดเด่นลามะนั้น 2 ข้อให้ทุกคน' },
    en: { name: 'Awaken', desc: 'Hold · an eliminated player reveals two traits of that llama to everyone' } },
  { id: 'arena', cat: 'strike', timing: 'P1', pol: 'risk', count: 1,
    th: { name: 'ขึ้นสังเวียน', desc: 'คนเปิดเลือก 1 คนมาดวล ต่างทายลามะกันพร้อมกัน · ผิดเปิดจุดเด่นคนละ 1 ข้อ' },
    en: { name: 'Into the Arena', desc: 'The flipper duels one player; both guess at once; a wrong guess reveals one trait each' } },
  { id: 'mafia', cat: 'strike', timing: 'P1', pol: 'neu', count: 1,
    th: { name: 'มาเฟีย', desc: 'คนเปิดบังคับให้ 1 คน "แกเป็นใคร" ในตานี้ (คนโดนบังคับเลือกเป้าเอง)' },
    en: { name: 'Mafia', desc: 'The flipper forces one player to challenge this turn (that player picks the target)' } },
  { id: 'lastduel', cat: 'strike', timing: 'P2', pol: 'good', count: 1,
    th: { name: 'ดวลเดือด', desc: 'เก็บไว้ · เมื่อผู้ถือโดนทายถูก ก่อนออกจากเกมทายลามะคืนได้ 1 ครั้ง' },
    en: { name: 'Last Duel', desc: 'Hold · when correctly guessed, guess back once before leaving' } },

  /* หมวด 6 — CHAOS (ปั่นป่วน) · 2 ใบ */
  { id: 'ratio', cat: 'chaos', timing: 'P3', pol: 'risk', count: 1,
    th: { name: 'ทัวร์ลง', desc: 'โหวต 1 รอบ · คนถูกโหวตมากสุดเปิดจุดเด่น 1 ข้อ' },
    en: { name: 'Ratioed', desc: 'One vote; the most-voted player reveals one trait' } },
  { id: 'chairs', cat: 'chaos', timing: 'P3', pol: 'neu', count: 1,
    th: { name: 'เก้าอี้ดนตรี', desc: 'ทุกคนส่งการ์ดในมือ (ถ้ามี) ให้คนถัดไปตามเข็มนาฬิกา' },
    en: { name: 'Musical Chairs', desc: 'Everyone passes their held cards to the next player clockwise' } }
];

export const CARD_IDS = EVENT_CARDS.map(c => c.id);
export const cardById = (id) => EVENT_CARDS.find(c => c.id === id) || null;

/* สรุปจำนวนใบทั้งสำรับ — ควรได้ 40 */
export const DECK_SIZE = EVENT_CARDS.reduce((n, c) => n + c.count, 0);

/* กลุ่มการ์ดตามหมวด สำหรับสมุดการ์ด */
export const CARD_CATS = ['reveal', 'probe', 'neighbor', 'shield', 'strike', 'chaos'];
