/* effects.js — ผลของการ์ดเหตุการณ์
   ─────────────────────────────────────────────────────────────
   แยกจาก game.js เพราะการ์ดจะมี 32 ชนิด ถ้าเขียนรวมกันไฟล์เดียวจะอ่านไม่ไหว
   และเพราะกติกาของการ์ดเปลี่ยนบ่อยกว่ากลไกแกนของเกมมาก

   การ์ดหนึ่งใบประกาศสองอย่าง
     needs  ต้องถามอะไรจากคนเปิดก่อนถึงจะทำงานได้ (null = ทำงานทันที)
     run    ทำอะไรกับสถานะ คืนสถานะใหม่ออกไป

   ตัวที่ต้องถามก่อนจะไม่ผ่านตาทันทีที่เปิด เกมค้างรอคนเปิดเลือกก่อน
   แล้วค่อยผ่านตาตอนที่ผลถูกใช้จริง จังหวะจึงเหมือนกับการโหวตที่ทำไว้แล้ว
   ───────────────────────────────────────────────────────────── */

import { maroon, occupants, placeOf } from './rules.js';

/* needs ที่รองรับตอนนี้
   'player'  เลือกผู้เล่นหนึ่งคน (ยกเว้นตัวเอง)  */
export const EFFECTS = {
  /* จุดดำ — คนที่เปิดโดน Maroon เอง ไม่ต้องเลือกอะไร ผลเกิดทันที
     เป็นการ์ดใบแรกที่ไม่มี needs จึงเป็นแม่แบบของกลุ่ม "เปิดแล้วเกิดเลย" */
  blackspot: {
    needs: null,
    run: (st, uid, _target, hands) => {
      const out = maroon(st, uid, hands);
      return {
        state: out.state,
        hands: out.hands,
        shout: { kind: 'spot', by: uid, who: uid, card: 'blackspot' }
      };
    }
  },

  /* ปืนพก — Maroon ใครก็ได้ยกเว้นตัวเอง ข้ามเรือข้ามเกาะได้ */
  pistol: {
    needs: 'player',
    targets: (st, uid) => (st.seats || []).filter(u => u !== uid && st.pos?.[u]),
    run: (st, uid, target, hands) => {
      const out = maroon(st, target, hands);
      return {
        state: out.state,
        hands: out.hands,
        shout: { kind: 'shot', by: uid, who: target, card: 'pistol' }
      };
    }
  }
};

export const effectOf = (id) => EFFECTS[id] || null;

/* การ์ดใบนี้ต้องถามอะไรก่อนไหม */
export const needsOf = (id) => effectOf(id)?.needs || null;

/* รายชื่อเป้าที่เลือกได้จริง — หน้าจอใช้ตัวนี้ตัดสินว่าจะไฮไลท์ใคร
   และฝั่งเซิร์ฟเวอร์ใช้ตัวเดียวกันตรวจว่าเป้าที่ส่งมาถูกต้องไหม
   เขียนที่เดียวจะได้ไม่มีทางที่สองที่ตัดสินไม่เหมือนกัน */
export function targetsOf(st, uid, id) {
  const e = effectOf(id);
  if (!e?.targets) return [];
  return e.targets(st, uid);
}

/* เผื่อการ์ดใบอื่นที่ต้องใช้ตัวช่วยเดียวกัน */
export { occupants, placeOf };
