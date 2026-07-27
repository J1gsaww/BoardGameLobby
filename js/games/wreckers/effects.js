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

import { maroon, occupants, placeOf, addMark, joinPlace, capacityOf, SHIP_IDS } from './rules.js';

/* การ์ดหนึ่งใบประกาศได้สี่อย่าง ใส่เท่าที่ต้องใช้

     keep    เปิดแล้วเข้ามือแทนที่จะเกิดผลทันที (ใช้ทีหลังในตาตัวเอง)
     steps   ลำดับสิ่งที่ต้องถามก่อนใช้ เช่น ['player', 'ship']
     targets เป้าที่เลือกได้ในขั้นนั้น — หน้าจอกับกติกาใช้ตัวเดียวกัน
     run     ทำอะไรกับสถานะเมื่อถามครบแล้ว

   ไม่มี steps เลย = ผลเกิดทันทีตอนเปิด (เช่นจุดดำ นกอัลบาทรอส)  */
export const EFFECTS = {
  /* นกอัลบาทรอส — ติดนกไว้กับคนเปิด ไม่มีผลอะไรทันที
     อันตรายอยู่ที่เรือลำเดียวกันมีนกครบสองตัว ซึ่งตรวจรวมหลังทุกคำสั่ง
     ไม่ได้ตรวจแค่ตอนเปิดการ์ด เพราะคนย้ายที่ก็ทำให้ครบได้ */
  albatross: {
    run: (st, uid, _picks, hands) => ({ state: addMark(st, uid, 'bird'), hands })
  },

  /* จุดดำ — คนที่เปิดโดน Maroon เอง ไม่ต้องเลือกอะไร ผลเกิดทันที */
  blackspot: {
    run: (st, uid, _picks, hands) => {
      const out = maroon(st, uid, hands);
      return { state: out.state, hands: out.hands };
    }
  },

  /* ปืนพก — Maroon ใครก็ได้ยกเว้นตัวเอง ข้ามเรือข้ามเกาะได้ */
  pistol: {
    steps: ['player'],
    /* ข้อความของขั้นถามแต่ละขั้น — ทุกใบต้องประกาศเอง
       ถ้ายืมของใบอื่นมาใช้ จะได้ข้อความที่ผิดเรื่องอย่างสิ้นเชิง
       เช่นจดหมายที่เชิญคนขึ้นเรือ แต่ขึ้นว่า "เลือกคนที่จะยิง" */
    ask: { player: 'pistol.player' },
    targets: (st, uid, step) =>
      (st.seats || []).filter(u => u !== uid && st.pos?.[u]),
    run: (st, uid, picks, hands) => {
      const out = maroon(st, picks.player, hands);
      return {
        state: out.state,
        hands: out.hands,
        shout: { kind: 'shot', by: uid, who: picks.player, card: 'pistol' }
      };
    }
  },

  /* หนังสือตราตั้ง — เปิดแล้วเก็บเข้ามือ ใช้ทีหลังในตาตัวเอง แทนการทำ Action
     ส่งใครก็ได้ (รวมตัวเอง) ไปต่อท้ายแถวเรือใหญ่ลำไหนก็ได้ที่ยังมีที่ว่าง */
  marque: {
    keep: true,
    steps: ['player', 'ship'],
    ask: { player: 'marque.player', ship: 'marque.ship' },
    targets: (st, uid, step) => step === 'player'
      ? (st.seats || []).filter(u => st.pos?.[u])
      : shipsWithRoom(st),
    run: (st, uid, picks, hands) => ({
      state: { ...st, pos: joinPlace(st.pos, picks.player, picks.ship) },
      hands,
      shout: { kind: 'marque', by: uid, who: picks.player, place: picks.ship, card: 'marque' }
    })
  }
};

/* เรือใหญ่ที่ยังรับคนเพิ่มได้ — ใช้ทั้งฝั่งหน้าจอ (ไฮไลท์) และฝั่งกติกา (ตรวจ)
   คนที่อยู่บนลำนั้นอยู่แล้วไม่นับว่าเต็ม เพราะย้ายมาลำเดิมก็แค่ไปต่อท้ายแถว */
export const shipsWithRoom = (st, who) =>
  SHIP_IDS.filter(s => {
    const line = occupants(st.pos, s);
    return line.includes(who) || line.length < capacityOf(s);
  });

/* การ์ดแผนที่ทุกใบใช้กติกาเดียวกัน — เปิดแล้วต้องยกให้คนอื่น ให้ตัวเองไม่ได้
   ผลของแต่ละใบต่างกันตอนถูกใช้ ไม่ใช่ตอนได้มา จึงประกาศรวมกันตรงนี้ได้ */
export const MAP_CARDS = ['fountain', 'atlantis', 'eldorado', 'lyonesse', 'anthemoessa'];

for (const id of MAP_CARDS) {
  EFFECTS[id] = {
    steps: ['player'],
    ask: { player: 'map.player' },
    targets: (st, uid) => (st.seats || []).filter(u => u !== uid && st.pos?.[u]),
    /* ผลคือยกการ์ดให้คนที่เลือก ไม่ได้ทำอะไรกับกระดาน
       ตัวจัดการคำสั่งเป็นคนเอาไปใส่มือให้ เพราะต้องแตะข้อมูลลับของคนอื่น */
    give: true,
    run: (st, uid, picks, hands) => ({
      state: st,
      hands,
      give: { to: picks.player, card: id },
      shout: { kind: 'gaveMap', by: uid, who: picks.player, card: id }
    })
  };
}

export const effectOf = (id) => EFFECTS[id] || null;

/* การ์ดใบนี้เปิดแล้วเข้ามือไหม */
export const keepsInHand = (id) => !!effectOf(id)?.keep;

/* ขั้นตอนถัดไปที่ต้องถาม — คืน null ถ้าถามครบแล้ว */
export function nextStep(id, picks = {}) {
  const steps = effectOf(id)?.steps || [];
  return steps.find(k => !picks[k]) || null;
}

/* เป้าที่เลือกได้ในขั้นนั้น เขียนที่เดียวจะได้ไม่มีทางที่สองที่ตัดสินไม่ตรงกัน */
export function targetsOf(st, uid, id, step, picks = {}) {
  const e = effectOf(id);
  if (!e?.targets || !step) return [];
  return e.targets(st, uid, step, picks);
}

/* ใช้การ์ดใบนี้ตอนนี้ได้ไหม — ต้องมีอย่างน้อยหนึ่งเป้าในขั้นแรก
   เรือเต็มทั้งสองลำก็ใช้จดหมายไม่ได้ เพราะไม่มีที่ให้ส่งใครไป */
/* คีย์ข้อความของขั้นถาม — ใบไหนไม่ประกาศก็ตกไปใช้ของกลาง
   ใช้เป็นสองที่: บรรทัดสั่งกลางกระดาน กับหัวข้อในกล่องยืนยัน */
export const askKey = (id, step) => {
  const k = effectOf(id)?.ask?.[step];
  return k ? `wreck.ask.${k}` : `wreck.ask.any.${step}`;
};

export function canUseCard(st, uid, id) {
  const first = nextStep(id, {});
  if (!first) return true;
  return targetsOf(st, uid, id, first).length > 0;
}

export { occupants, placeOf };
