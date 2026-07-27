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

import { maroon, occupants, placeOf, addMark, joinPlace, capacityOf, SHIP_IDS,
         insertBehind, nextSeat, swapSpots, shuffleQueue, pileOf,
         BOAT_IDS, isWrecked, addVoteBan } from './rules.js';

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

  /* หน้ากาก — สลับที่ยืนกับคนที่จะเล่นตาถัดไป ผลเกิดทันทีตอนเปิด
     ไม่มีประกาศผลตามหลัง เพราะตัวการ์ดบอกครบแล้วว่าจะเกิดอะไร ไม่มีอะไรให้ลุ้น
     สลับที่ยืนอาจเปลี่ยนบทบาททั้งคู่ — ลูกเรือกลายเป็นกัปตันได้ในทันที */
  facade: {
    run: (st, uid, _picks, hands) => {
      const target = nextSeat(st);
      const pos = swapSpots(st.pos, uid, target);
      if (!pos) return { state: st, hands };
      /* บอกหน้าจอว่าใครเพิ่งสลับ จะได้ไฮไลท์ให้เห็นว่าเกิดอะไรขึ้นกับใคร
         ไม่ใช่ประกาศเป็นฉาก แค่เรืองรอบตัวสองวินาที */
      return { state: { ...st, pos, glow: { uids: [uid, target], at: (st.logSeq || 0) + 1 } }, hands };
    }
  },

  /* ประมวลโจรสลัด — คนเปิดโดนห้ามโหวตสองครั้ง
     ใช้กลไกเดียวกับโทษของเอลโดราโด แค่เปลี่ยนจำนวนครั้ง
     ป้ายข้างชื่อจึงขึ้นเองโดยไม่ต้องเก็บอะไรเพิ่ม เพราะอ่านจากจำนวนครั้งที่เหลือ */
  piratecode: {
    run: (st, uid, _picks, hands) => ({
      state: addVoteBan(st, uid, 2),
      hands
    })
  },

  /* ดินปืน — ระเบิดเรือเล็กทิ้งหนึ่งลำ ใช้ไม่ได้อีกตลอดเกม
     ถ้ามีคนนั่งอยู่บนลำนั้น เขาตกน้ำแล้วขึ้นเกาะ ตามหลักเดียวกับการโดนทิ้งเกาะ
     ลำที่พังไปแล้วเลือกซ้ำไม่ได้ เพราะไม่มีอะไรให้ระเบิดอีก */
  blackpowder: {
    steps: ['boat'],
    ask: { boat: 'powder.boat' },
    targets: (st, uid, step) => step === 'boat'
      ? BOAT_IDS.filter(b => !isWrecked(st, b))
      : [],
    run: (st, uid, picks, hands) => {
      const boat = picks.boat;
      const rider = (st.seats || []).find(u => placeOf(st.pos?.[u]) === boat);
      let cur = { ...st, wrecked: [...(st.wrecked || []), boat] };
      let h = hands;
      if (rider) {
        const out = maroon(cur, rider, h);
        cur = out.state; h = out.hands;
      }
      return {
        state: cur, hands: h,
        shout: { kind: 'powder', by: uid, place: boat, who: rider || null, card: 'blackpowder' }
      };
    }
  },

  /* รังกา — เลือกเป้า แล้วเลือกไพ่โหวตให้เขาใหม่สามใบจากกองที่เหลือ

     ใบนี้ต่างจากใบอื่นตรงที่ขั้นที่สองไม่ใช่การเลือก "หนึ่งเป้า" แต่เป็นการเลือกไพ่หลายใบ
     จึงประกาศ pickCount ไว้ ให้ตัวจัดการรู้ว่าต้องรอครบกี่ใบก่อนถึงจะทำงาน

     กองที่เลือกได้ = สำรับทั้งใบ ลบมือคนอื่น แต่ **รวมมือเดิมของเป้า** ด้วย
     เพราะกติกาบอกว่าไพ่ของเป้าคืนกองก่อน แล้วค่อยหยิบใหม่ ใบเดิมจึงมีสิทธิ์ถูกหยิบกลับ */
  crowsnest: {
    steps: ['player', 'cards'],
    ask: { player: 'crow.player', cards: 'crow.cards' },
    pickCount: { cards: 3 },
    /* เลือกตัวเองได้ด้วย — เป็นการเปลี่ยนไพ่ในมือตัวเอง ซึ่งเป็นการใช้ที่ถูกต้อง
       ต่างจากปืนพกที่ยิงตัวเองไม่ได้ เพราะนั่นเป็นการทำร้าย ส่วนใบนี้เป็นการจัดมือ */
    targets: (st, uid, step) => step === 'player'
      ? (st.seats || []).filter(u => st.pos?.[u])
      : [],
    run: (st, uid, picks, hands) => ({
      state: st,
      hands: { ...hands, [picks.player]: [...picks.cards] },
      shout: { kind: 'crow', by: uid, who: picks.player, card: 'crowsnest' }
    })
  },

  /* ระฆังแปดครั้ง — ทุกคนในสถานที่เดียวกับคนเปิดสุ่มที่ยืนใหม่หมด
     ผลออกมาเป็นลำดับใหม่ ซึ่งหน้าจอเอาไปเล่าทีละคนก่อนกระดานจะขยับจริง */
  eightbell: {
    run: (st, uid, _picks, hands, rng = Math.random) => {
      const place = placeOf(st.pos[uid]);
      const pos = shuffleQueue(st.pos, place, rng);
      const order = occupants(pos, place);
      return {
        state: { ...st, pos },
        hands,
        shout: { kind: 'bells', by: uid, place, order, card: 'eightbell' }
      };
    }
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

/* แอตแลนติส — ผลตอน **ใช้จากมือ** (ตอนเปิดยกให้คนอื่นเหมือนแผนที่ทุกใบ)
   ย้ายตัวเองไปยืนข้างหลังคนที่จะเล่นตาถัดไป คนที่ถูกล่นเกินความจุโดน Maroon

   สองอย่างที่ทำให้ใบนี้ต่างจากใบอื่น
     whenever  ใช้ได้ในตาของใครก็ได้ ไม่ต้องรอตาตัวเอง
     defer     ผลกับฉากรอให้เจ้าของตาทำ Action เสร็จก่อน แล้วค่อยเกิด */
EFFECTS.atlantis = {
  whenever: true,
  defer: true,
  run: (st, uid, picks, hands) => {
    /* เป้าถูกล็อกไว้ตั้งแต่ตอนกดใช้ ไม่คำนวณใหม่ตอนนี้ */
    const target = picks?.target || nextSeat(st);
    const ins = insertBehind(st.pos, uid, target);
    if (!ins) return { state: st, hands };

    let cur = { ...st, pos: ins.pos };
    let h = hands;
    for (const u of ins.spill) {
      const out = maroon(cur, u, h);
      cur = out.state; h = out.hands;
      /* เจอคนมีการ์ดกัน = หยุดไว้ก่อน ตัวกวาดหลังคำสั่งจะทำต่อให้หลังเขาตอบ */
      if (out.kind === 'ask') break;
    }

    return {
      state: cur, hands: h,
      shout: { kind: 'atlantis', by: uid, who: target, spill: ins.spill, card: 'atlantis' }
    };
  }
};

/* ใช้ได้ในตาคนอื่นไหม · ผลต้องรอจบตาก่อนไหม */
export const usableAnytime = (id) => !!effectOf(id)?.whenever;
export const isDeferred = (id) => !!effectOf(id)?.defer;

/* ── การ์ดแผนที่ ────────────────────────────────────────────
   ทุกใบเหมือนกันตรง **ตอนเปิด** — ต้องยกให้คนอื่น เก็บเองไม่ได้
   ส่วน **ตอนใช้** แต่ละใบทำคนละอย่าง ซึ่งประกาศไว้ข้างบนแล้ว

   ต้องผสมเข้ากับของเดิม ไม่ใช่เขียนทับ
   เคยพลาดมาแล้ว: ประกาศกติกาแผนที่ไว้ก่อน แล้วเขียนผลของแอตแลนติสทับทีหลัง
   แผนที่ใบนั้นเลยกลายเป็นการ์ดธรรมดาที่เปิดแล้วทำงานทันที ไม่ต้องยกให้ใคร */
export const MAP_CARDS = ['fountain', 'atlantis', 'eldorado', 'lyonesse', 'anthemoessa'];

for (const id of MAP_CARDS) {
  EFFECTS[id] = { ...(EFFECTS[id] || {}), gift: true };
}

/* เปิดแล้วต้องยกให้คนอื่นไหม */
export const isGift = (id) => !!effectOf(id)?.gift;

/* คนที่รับแผนที่ได้ — ใครก็ได้ยกเว้นตัวเอง */
export const giftTargets = (st, uid) =>
  (st.seats || []).filter(u => u !== uid && st.pos?.[u]);

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
  if (!step) return [];
  /* ตอนถามว่าจะยกแผนที่ให้ใคร ใช้รายชื่อของการยก ไม่ใช่ของผลการ์ด */
  if (!e?.targets) return step === 'player' ? giftTargets(st, uid) : [];
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

/* ── หน้าต่างเวลาที่เล่นการ์ดใบนี้ได้ ────────────────────────
     any    ตาไหนก็ได้ (แอตแลนติส — รวมตาตัวเองด้วย)
     own    เฉพาะตาตัวเอง (จดหมาย)
     never  หยิบมาเล่นเองไม่ได้เลย (น้ำพุ — ทำงานเองตอนโดน Maroon)

   อ่านจากสิ่งที่การ์ดประกาศไว้ ไม่ต้องมีรายชื่อแยกให้ลืมอัปเดต
   ใบที่ไม่มี run แปลว่าไม่มีผลตอนถูกเล่น จึงเล่นเองไม่ได้โดยธรรมชาติ */
export function playWindow(id) {
  const e = effectOf(id);
  if (!e?.run) return 'never';
  return e.whenever ? 'any' : 'own';
}

/* เล่นใบนี้ตอนนี้ได้ไหม พร้อมเหตุผลถ้าไม่ได้

   **ฟังก์ชันเดียวที่ตอบคำถามนี้** ใช้ทั้งฝั่งหน้าจอและฝั่งเซิร์ฟเวอร์
   เคยพลาดมาแล้วสองแบบ — ให้หน้าจอตัดสินเองจนคิดไม่ตรงกับกติกา
   แล้วพอถอดออกหมดก็กลายเป็นกดได้ทุกใบทุกเวลา ซึ่งผิดอีกทาง */
export function canPlayNow(st, uid, id) {
  const w = playWindow(id);
  if (w === 'never') return { ok: false, why: 'passive' };
  if (st.phase !== 'play') return { ok: false, why: 'phase' };
  if (w === 'own' && st.turn !== uid) return { ok: false, why: 'notTurn' };
  if (!canUseCard(st, uid, id)) return { ok: false, why: 'noTarget' };
  return { ok: true, why: '' };
}

/* ขั้นนี้ต้องเลือกกี่ใบ — ไม่ใช่ทุกขั้นที่เลือกทีละหนึ่ง */
export const pickCountOf = (id, step) => effectOf(id)?.pickCount?.[step] || 1;

/* กองไพ่โหวตที่รังกาเลือกได้ — สำรับลบมือคนอื่น รวมมือเดิมของเป้าด้วย
   เพราะไพ่ของเป้าคืนกองก่อนแล้วค่อยหยิบใหม่ ใบเดิมจึงมีสิทธิ์กลับมา */
export function crowPool(hands, target) {
  /* ตัดมือของเป้าออกจากบัญชี = ไพ่ของเขากลับเข้ากองทันที
     pileOf คืนสำรับลบมือที่ส่งไปให้ ไพ่ของเป้าจึงอยู่ในกองอยู่แล้ว
     ห้ามเอามาต่อท้ายซ้ำ ไม่งั้นกองจะมีใบซ้ำ แล้วคนเลือกจะโดนปฏิเสธโดยไม่รู้ว่าทำไม */
  const others = { ...hands };
  delete others[target];
  return pileOf(others, []).sort();
}

export function canUseCard(st, uid, id) {
  const first = nextStep(id, {});
  if (!first) return true;
  return targetsOf(st, uid, id, first).length > 0;
}

export { occupants, placeOf };
