/* vote.js — สำรับไพ่โหวต
   ─────────────────────────────────────────────────────────────
   ไพ่หนึ่งใบมีสามหน้าอยู่บนใบเดียวกัน ตอนโหวตค่อยดูเฉพาะแถวที่เกี่ยวข้อง
     Attack  ปืนใหญ่ / คบเพลิง / น้ำ      ใช้ตอนกัปตันสั่งยิง
     Brawl   ธงบริติช / ธงฝรั่งเศส        ใช้ตอนผู้ว่าฯ สั่งย้ายกล่องบนเกาะ
     Mutiny  เห็นด้วย / ไม่เห็นด้วย        ใช้ตอนต้นหนสั่งก่อกบฏ

   สำรับมี 33 ใบ · ใบที่ 25 ว่างเปล่าทั้งสามหน้าตามต้นฉบับ
   ใบสุดท้าย (ปืนใหญ่/บริติช/ไม่เห็นด้วย) คือใบที่หายไปจากกล่องจริงแล้วเติมกลับ
   ───────────────────────────────────────────────────────────── */

/* ไอคอนวาดเป็น SVG ในโค้ด ไม่ใช่ไฟล์ภาพ
   เหตุผล: ไอคอนสำเร็จรูปเป็น PNG สีดำล้วน ต้องกลับสีถึงจะเห็นบนไพ่พื้นเข้ม
   ซึ่งทำให้ธงที่ควรมีหลายสีกลายเป็นขาวล้วนหมด · วาดเองจึงคุมสีได้ตรงตามจริง
   และไม่ต้องต่อเน็ต ไม่มีเรื่องลิขสิทธิ์ ย่อขยายก็คม */
const svg = (inner) => `<svg viewBox="0 0 24 24" class="vc-icon" aria-hidden="true">${inner}</svg>`;

export const ICON = {
  /* ปืนใหญ่ — ลำกล้องเอียงพร้อมล้อและประกายไฟที่ปากกระบอก */
  C: svg(`<rect x="5" y="10.5" width="14" height="5" rx="1.4" fill="#8d97a4"
        transform="rotate(-15 12 13)"/>
      <circle cx="6.5" cy="17.5" r="3.4" fill="#525b66"/>
      <circle cx="6.5" cy="17.5" r="1.2" fill="#8d97a4"/>
      <path d="M19.4 6.4l2.3-1.7M20.5 9.1l2.7-.5M17.4 4.5l.6-2.5"
        stroke="#f4a949" stroke-width="1.7" stroke-linecap="round" fill="none"/>`),

  /* คบเพลิง — เปลวไฟสองชั้น */
  F: svg(`<path d="M12 2c1 4-3 5-3 9a3 3 0 006 0c0-1.6-.7-2.4-.7-3.6 2 1.4 3.7 3.6 3.7 6.1a6 6 0 11-12 0C6 8.5 10 6.5 12 2z" fill="#f4a949"/>
      <path d="M12 12.2c.6 2-1.5 2.6-1.5 4.4a1.6 1.6 0 003.2 0c0-.9-.5-1.4-.5-2.1 1 .8 1.8 1.9 1.8 3.1a3 3 0 11-6 0c0-2.6 2-3.6 3-5.4z" fill="#ffd980"/>`),

  /* น้ำ — หยดน้ำ */
  W: svg(`<path d="M12 2.5s6.5 7.4 6.5 11.4a6.5 6.5 0 11-13 0C5.5 9.9 12 2.5 12 2.5z" fill="#4f9fdc"/>
      <path d="M9.4 14.6a3.6 3.6 0 003.6 3.6" stroke="#d3ecff" stroke-width="1.7"
        fill="none" stroke-linecap="round"/>`),

  /* ธงบริติช — Union Jack แบบย่อ */
  B: svg(`<g transform="translate(1 4)">
        <rect width="22" height="16" fill="#012169"/>
        <path d="M0 0l22 16M22 0L0 16" stroke="#fff" stroke-width="3.6"/>
        <path d="M0 0l22 16M22 0L0 16" stroke="#c8102e" stroke-width="2"/>
        <path d="M11 0v16M0 8h22" stroke="#fff" stroke-width="5.6"/>
        <path d="M11 0v16M0 8h22" stroke="#c8102e" stroke-width="3.2"/>
      </g>`),

  /* ธงฝรั่งเศส — ไตรรงค์ */
  R: svg(`<g transform="translate(1 4)">
        <rect width="7.34" height="16" fill="#002395"/>
        <rect x="7.34" width="7.32" height="16" fill="#f4f4f4"/>
        <rect x="14.66" width="7.34" height="16" fill="#ed2939"/>
      </g>`),

  /* เห็นด้วยกับการก่อกบฏ — หัวกะโหลก สีกระดูกซีด */
  A: svg(`<path d="M12 2.4c4.5 0 7.7 3.2 7.7 7.5 0 2.5-1.1 4.2-2.4 5.3-.5.4-.8.9-.8 1.6v1.1c0 .9-.7 1.6-1.6 1.6H9.1c-.9 0-1.6-.7-1.6-1.6v-1.1c0-.7-.3-1.2-.8-1.6-1.3-1.1-2.4-2.8-2.4-5.3C4.3 5.6 7.5 2.4 12 2.4z" fill="#ece5d3"/>
      <ellipse cx="9" cy="10.4" rx="2.4" ry="2.6" fill="#241d3a"/>
      <ellipse cx="15" cy="10.4" rx="2.4" ry="2.6" fill="#241d3a"/>
      <path d="M12 13.1l-1.2 2.5h2.4z" fill="#241d3a"/>
      <path d="M9.7 17.6v2.2M12 17.6v2.2M14.3 17.6v2.2" stroke="#241d3a"
        stroke-width="1.2" stroke-linecap="round"/>`),

  /* ไม่เห็นด้วย — พวงมาลัยเรือ สื่อว่ากัปตันของฉันยังอยู่ */
  D: svg(`<circle cx="12" cy="12" r="6.6" fill="none" stroke="#b58043" stroke-width="2.3"/>
      <circle cx="12" cy="12" r="2.1" fill="#b58043"/>
      <g stroke="#b58043" stroke-width="1.9" stroke-linecap="round">
        <path d="M12 1.8v3.6M12 18.6v3.6M1.8 12h3.6M18.6 12h3.6"/>
        <path d="M4.8 4.8l2.6 2.6M16.6 16.6l2.6 2.6M19.2 4.8l-2.6 2.6M7.4 16.6l-2.6 2.6"/>
      </g>`)
};

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
  ['C','B','D'], ['F','B','A'], ['F','B','A'], ['W','B','D'], ['','',''],
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

export function voteCard(card, lang = 'th') {
  if (!card) return '';
  if (card.blank) return `<span class="vote-card blank"><span class="vc-none">\u2014</span></span>`;
  return `<span class="vote-card">
    ${row(card.attack, 'attack', lang)}
    ${row(card.brawl, 'brawl', lang)}
    ${row(card.mutiny, 'mutiny', lang)}
  </span>`;
}

export const voteBack = () => `<span class="vote-card back"></span>`;
