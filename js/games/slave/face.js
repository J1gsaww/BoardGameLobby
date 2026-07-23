/* face.js — วาดไพ่ด้วย SVG ในโค้ด ไม่มีไฟล์ภาพให้โหลดสักไบต์
   ─────────────────────────────────────────────────────────────
   อัตราส่วน 5:7 เท่าไพ่ poker จริง · ย่อขยายเท่าไหร่ก็คม
   มุมโค้งใส่ใน SVG เลยเพราะไพ่มีขนาดตายตัวสองแบบเท่านั้น
   ───────────────────────────────────────────────────────────── */

const LABEL = { T: '10' };
const GLYPH = { C: '\u2663', D: '\u2666', H: '\u2665', S: '\u2660' };
const RED = { D: 1, H: 1 };

const face = (card) => LABEL[card[0]] || card[0];

/* ไพ่หนึ่งใบ — w คือความกว้างเป็นพิกเซล สูงคำนวณจาก 5:7 ให้เอง
   มุมบนซ้ายทำใหญ่เป็นพิเศษ เพราะเวลาไพ่ซ้อนกันบนมือ มุมนี้คือทั้งหมดที่เห็น */
export function cardFace(card, w = 72) {
  const h = Math.round(w * 1.4);
  const red = RED[card[1]];
  const ink = red ? '#c8324a' : '#1d1b2e';
  const r = face(card);
  const g = GLYPH[card[1]];

  const cx = Math.round(w * 0.23);            // แกนกลางของมุมบนซ้าย
  const rankSize = Math.round(w * (r.length > 1 ? 0.26 : 0.30));
  const suitSize = Math.round(w * 0.34);
  const pipSize = Math.round(w * 0.36);

  return `<svg class="cardface" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-label="${r}${g}">
    <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${Math.round(w * 0.1)}"
          fill="#f6f2ea" stroke="#2a2340" stroke-width="1.5"/>
    <text x="${cx}" y="${Math.round(w * 0.36)}" fill="${ink}"
          font-size="${rankSize}" font-weight="700" text-anchor="middle"
          font-family="'Chakra Petch', system-ui, sans-serif">${r}</text>
    <text x="${cx}" y="${Math.round(w * 0.36 + suitSize * 0.95)}" fill="${ink}"
          font-size="${suitSize}" text-anchor="middle">${g}</text>
    <text x="${Math.round(w * 0.68)}" y="${Math.round(h * 0.86)}" fill="${ink}"
          font-size="${pipSize}" text-anchor="middle" opacity=".9">${g}</text>
  </svg>`;
}

/* หลังไพ่ ใช้ตอนแสดงไพ่ของคนอื่น */
export function cardBack(w = 42) {
  const h = Math.round(w * 1.4);
  return `<svg class="cardface cardback" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${Math.round(w * 0.1)}"
          fill="#2a2350" stroke="#5a4a92" stroke-width="1.5"/>
    <rect x="${Math.round(w * 0.18)}" y="${Math.round(h * 0.13)}"
          width="${Math.round(w * 0.64)}" height="${Math.round(h * 0.74)}"
          rx="${Math.round(w * 0.06)}" fill="none" stroke="#6f5cb8" stroke-width="1"/>
    <circle cx="${w / 2}" cy="${h / 2}" r="${Math.round(w * 0.14)}" fill="#6f5cb8" opacity=".55"/>
  </svg>`;
}

/* กองไพ่ซ้อนกันแบบพัดสั้น ๆ ใช้แสดงชุดที่อยู่บนกอง */
export function cardRow(cards, w = 62) {
  const overlap = cards.length > 3 ? 0.62 : 0.78;
  return `<div class="card-row" style="--ov:${overlap}">` +
    cards.map(c => `<span class="card-slot">${cardFace(c, w)}</span>`).join('') +
    '</div>';
}
