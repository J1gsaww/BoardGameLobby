/* score.js — ระบบคะแนนของโหมดไม่รู้จบ
   ─────────────────────────────────────────────────────────────
   ฟังก์ชันบริสุทธิ์ทั้งไฟล์ ทดสอบได้โดยไม่ต้องมีเกม

   คะแนนมาจากสามทาง
     1. อันดับตอนจบรอบ
     2. การลงไพ่ระหว่างเล่น (สะสมทันทีที่ลง ไม่ต้องรอจบรอบ)
     3. โบนัสล้มคิง คิดจากอันดับเดิมของคนล้ม
   ───────────────────────────────────────────────────────────── */

export const RANK_POINTS = { king: 300, queen: 200, viceSlave: 60, slave: 0 };
export const PEOPLE_TOP = 100;      // ประชาชนคนแรกได้เท่านี้
export const PEOPLE_STEP = 10;      // แล้วลดลงคนละเท่านี้
export const PEOPLE_FLOOR = 60;     // แต่ไม่ต่ำกว่านี้
/* คิงที่โดนล้มติดลบเท่านี้ — ตั้งไว้ราว 40% ของคะแนนคิง
   ให้เจ็บพอที่จะต้องระวัง แต่ไม่ถึงขั้นล้างคะแนนทั้งรอบทิ้ง */
export const TOPPLED_KING = -120;

/* รอบที่มีการล้มคิง คิงคนใหม่ได้น้อยลง เพราะได้โบนัสล้มไปแล้ว
   สลาฟที่ล้มคิงสำเร็จจึงได้สูงสุด 200 + 250 = 450 */
export const KING_AFTER_TOPPLE = 200;

export const TOPPLE_BONUS = { queen: 50, people: 100, viceSlave: 150, slave: 250 };

/* แต้มกำลังใจของคนที่เล่นไม่จบ — ไพ่ที่เหลือในมือหารสองปัดลง แล้วคูณเท่านี้ */
export const LEFTOVER_PER = 5;
export const leftoverPoints = (cardsLeft) => Math.floor((cardsLeft || 0) / 2) * LEFTOVER_PER;

/* คะแนนตามอันดับ
   titled = ผลจาก engine.titles() เรียงจากคิงลงมาถึงสลาฟ
   toppled = uid ของคิงที่โดนล้ม (ถ้ามี) */
export function rankPoints(titled, toppled = null) {
  const out = {};
  let peopleSeen = 0;

  for (const { uid, title } of titled) {
    if (title === 'people') {
      out[uid] = Math.max(PEOPLE_FLOOR, PEOPLE_TOP - PEOPLE_STEP * peopleSeen);
      peopleSeen++;
    } else if (title === 'king') {
      out[uid] = toppled ? KING_AFTER_TOPPLE : RANK_POINTS.king;
    } else {
      out[uid] = RANK_POINTS[title];
    }
  }
  if (toppled && out[toppled] !== undefined) out[toppled] += TOPPLED_KING;
  return out;
}

/* คะแนนของการลงไพ่หนึ่งครั้ง
   size  = จำนวนใบที่ลง
   chain = ครั้งที่เท่าไรของตอง/โฟร์ในกองนี้ (นับ 1 เป็นครั้งแรก) */
export function playPoints(size, chain = 1) {
  if (size === 1) return 5;
  if (size === 2) return 10;
  if (size === 3) return chainValue(50, 200, chain);
  if (size === 4) return chainValue(150, 300, chain);
  return 0;
}

/* ครั้งแรกได้ base · ครั้งถัดไปคิดจาก "คะแนนที่ครั้งก่อนได้จริง" บวก 50
   ครั้งที่ 4, 6, 8 บวกโบนัสเพิ่ม และโบนัสนั้นถูกนับรวมเป็นฐานของครั้งถัดไปด้วย */
function chainValue(base, bonus, n) {
  let value = base;
  for (let i = 2; i <= n; i++) {
    value += 50;
    if (i >= 4 && i % 2 === 0) value += bonus;
  }
  return value;
}

/* โบนัสของคนที่ล้มคิง คิดจากตำแหน่งของเขาในรอบก่อน */
export const toppleBonus = (prevTitle) => TOPPLE_BONUS[prevTitle] || 0;

/* รวมคะแนนเข้ากระเป๋าเดิม */
export function addScores(scores, delta) {
  const out = { ...scores };
  for (const [uid, n] of Object.entries(delta)) out[uid] = (out[uid] || 0) + n;
  return out;
}

/* เรียงตารางคะแนนจากมากไปน้อย */
export const leaderboard = (scores) =>
  Object.entries(scores)
    .map(([uid, points]) => ({ uid, points }))
    .sort((a, b) => b.points - a.points);
