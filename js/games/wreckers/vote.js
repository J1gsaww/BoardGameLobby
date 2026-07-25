/* vote.js — สำรับไพ่โหวต
   ─────────────────────────────────────────────────────────────
   ไพ่หนึ่งใบมีสามหน้าอยู่บนใบเดียวกัน ตอนโหวตค่อยดูเฉพาะแถวที่เกี่ยวข้อง
     Attack  ปืนใหญ่ / คบเพลิง / น้ำ      ใช้ตอนกัปตันสั่งยิง
     Brawl   ธงบริติช / ธงฝรั่งเศส        ใช้ตอนผู้ว่าฯ สั่งย้ายกล่องบนเกาะ
     Mutiny  เห็นด้วย / ไม่เห็นด้วย        ใช้ตอนต้นหนสั่งก่อกบฏ

   สำรับมี 32 ใบ — ต้นฉบับมีใบเปล่าอยู่ใบหนึ่ง แต่ผู้ใช้ตัดออกจากเกมนี้แล้ว
   เพราะลงไปก็ไม่นับให้ฝ่ายไหน และบนจอดูเหมือนภาพที่โหลดไม่ขึ้น
   ใบสุดท้าย (ปืนใหญ่/บริติช/ไม่เห็นด้วย) คือใบที่หายไปจากกล่องจริงแล้วเติมกลับ
   ───────────────────────────────────────────────────────────── */

/* ไอคอนเป็นไฟล์ภาพที่เจนไว้ วาดชุดเดียวกับภาพการ์ดทั้งสำรับ
   ไฟล์ต้นฉบับมีขอบว่างรอบตัวของพอสมควร ถ้าวางตรง ๆ ไอคอนบนไพ่จะห่างกันเกินไป
   จึงขยายด้วย transform ใน CSS แทนการเพิ่มความกว้าง — ขยายแล้วไม่ดันตัวข้าง ๆ
   เพราะ transform ไม่กินพื้นที่ใน layout */
export const VOTE_ART = 'assets/game/wreckers/cards/vote/';

const ICON_FILE = {
  C: 'cannon', F: 'torch', W: 'water',
  B: 'british', R: 'france',
  A: 'agree', D: 'disagree'
};

export const ICON_EXT = '.webp';
export const iconSrc = (ch) => (ICON_FILE[ch] ? `${VOTE_ART}${ICON_FILE[ch]}${ICON_EXT}` : '');

export const ICON = Object.fromEntries(Object.keys(ICON_FILE).map(ch =>
  [ch, `<img class="vc-icon" src="${iconSrc(ch)}" alt="" draggable="false" loading="lazy">`]
));

export const SYMBOL = {
  C: { row: 'attack', th: 'ปืนใหญ่',      en: 'Cannon' },
  F: { row: 'attack', th: 'คบเพลิง',      en: 'Fire' },
  W: { row: 'attack', th: 'น้ำ',          en: 'Water' },
  B: { row: 'brawl',  th: 'บริติช',       en: 'British' },
  R: { row: 'brawl',  th: 'ฝรั่งเศส',      en: 'France' },
  A: { row: 'mutiny', th: 'เห็นด้วย — ล้มกัปตัน',    en: 'Agree \u2014 down with the Captain' },
  D: { row: 'mutiny', th: 'ไม่เห็นด้วย — กัปตันอยู่ต่อ', en: 'Disagree \u2014 the Captain stays' }
};

/* [Attack, Brawl, Mutiny] · ตัวอักษรซ้ำ = สัญลักษณ์นั้นสองอัน
   ใช้ R แทนฝรั่งเศสเพราะ F ถูกคบเพลิงใช้ไปแล้ว */
const RAW = [
  ['W','R','A'], ['W','B','A'], ['C','R','A'], ['F','R','D'], ['W','R','D'],
  ['W','B','D'], ['F','B','A'], ['F','B','D'], ['F','B','D'], ['C','B','A'],
  ['C','R','D'], ['CF','RR','DD'], ['F','B','D'], ['W','R','A'], ['C','R','A'],
  ['C','B','D'], ['W','B','A'], ['F','R','A'], ['F','R','A'], ['F','R','D'],
  ['C','B','D'], ['F','B','A'], ['F','B','A'], ['W','B','D'],
  ['C','B','A'], ['C','R','D'], ['W','R','D'], ['F','R','D'], ['W','R','A'],
  ['WW','BB','AA'], ['F','R','A'], ['C','B','D']
];

export const DECK = RAW.map((faces, i) => ({
  id: 'v' + String(i + 1).padStart(2, '0'),
  attack: faces[0],
  brawl: faces[1],
  mutiny: faces[2],
  blank: !faces[0] && !faces[1] && !faces[2]
}));

export const cardById = (id) => DECK.find(c => c.id === id) || null;

/* นับสัญลักษณ์ทั้งสำรับ ใช้ตรวจว่าสำรับยังสมดุลอยู่ */
export function tally() {
  const n = {};
  for (const c of DECK)
    for (const face of [c.attack, c.brawl, c.mutiny])
      for (const ch of face) n[ch] = (n[ch] || 0) + 1;
  return n;
}

/* แจกไพ่ — คืนมือของแต่ละคนกับกองที่เหลือ */
export function deal(seats, perHand, rng = Math.random) {
  const bag = DECK.map(c => c.id);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  const hands = {};
  for (const uid of seats) hands[uid] = bag.splice(0, perHand);
  return { hands, pile: bag };
}

/* ── วาดไพ่ ─────────────────────────────────────────────────
   สีประจำแถวอยู่ที่พื้นหลังแถว ส่วนไอคอนมีสีจริงของตัวเองอยู่แล้ว */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

function row(face, kind, lang) {
  const icons = [...face].map(ch => {
    const s = SYMBOL[ch];
    const label = s ? (s[lang] || s.th) : ch;
    return `<span class="vc-slot" title="${esc(label)}">${ICON[ch] || ''}</span>`;
  }).join('');
  return `<span class="vc-row vc-${kind}">${icons || '<span class="vc-none">\u2014</span>'}</span>`;
}

/* ป้ายของใบเปล่า เก็บไว้ในไฟล์นี้เลย ไม่ผ่านระบบคีย์ภาษา
   เพราะ i18n แตะ localStorage ตอนโหลดโมดูล ซึ่งทำให้ชุดทดสอบฝั่ง Node ล้มทั้งไฟล์ */
const BLANK = {
  th: { name: 'ใบเปล่า',
        tip: 'ไพ่ใบเปล่าของสำรับ ไม่มีสัญลักษณ์ในทุกแถว ลงไปก็ไม่นับให้ฝ่ายไหน' },
  en: { name: 'blank',
        tip: 'The deck\u2019s blank card \u2014 no symbol on any row, so it counts for nobody' }
};

export function voteCard(card, lang = 'th') {
  if (!card) return '';
  /* ใบเปล่าเป็นไพ่จริงใบหนึ่งในสำรับ (ใบที่ 25 ไม่มีสัญลักษณ์เลยสักแถว)
     ติดป้ายไว้ให้ชัด ไม่งั้นดูเหมือนภาพที่โหลดไม่ขึ้น */
  if (card.blank) {
    const b = BLANK[lang] || BLANK.th;
    return `<span class="vote-card blank" data-blank="${esc(b.name)}" title="${esc(b.tip)}">
      <span class="vc-none">\u2014</span></span>`;
  }
  return `<span class="vote-card">
    ${row(card.attack, 'attack', lang)}
    ${row(card.brawl, 'brawl', lang)}
    ${row(card.mutiny, 'mutiny', lang)}
  </span>`;
}

export const voteBack = () => `<span class="vote-card back"></span>`;
