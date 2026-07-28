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
         BOAT_IDS, isWrecked, addVoteBan, addSkip, moveBox, addVoter } from './rules.js';

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

  /* ลักปิดลักเปิด — ทุกคนที่อยู่ในสถานที่เดียวกับคนเปิด โดนข้ามตาคนละหนึ่งรอบ
     รวมคนเปิดเองด้วย แต่ตาที่กำลังเปิดอยู่ไม่นับ เพราะหนี้ถูกหักตอนถึงตาครั้งถัดไป
     ซึ่งเป็นพฤติกรรมที่กลไกหนี้ข้ามตาทำให้เองอยู่แล้ว ไม่ต้องเขียนกรณีพิเศษ */
  scurvy: {
    run: (st, uid, _picks, hands) => {
      const here = occupants(st.pos, placeOf(st.pos[uid]));
      let cur = st;
      for (const u of here) cur = addSkip(cur, u, 1);
      return {
        state: cur, hands,
        shout: { kind: 'scurvy', by: uid, who: here, card: 'scurvy' }
      };
    }
  },

  /* ผลัดเวร — สลับที่กับคนที่ยืนอยู่ข้างหลังเราโดยตรงในที่เดียวกัน
     ใช้ถอยลงจากตำแหน่งที่กำลังตกเป็นเป้า ถ้าไม่มีใครอยู่ข้างหลังก็ไม่เกิดอะไร */
  relief: {
    run: (st, uid, _picks, hands) => {
      const line = occupants(st.pos, placeOf(st.pos[uid]));
      const behind = line[line.indexOf(uid) + 1];
      const pos = behind ? swapSpots(st.pos, uid, behind) : null;
      if (!pos) return { state: st, hands };
      return {
        state: { ...st, pos, glow: { uids: [uid, behind], at: (st.logSeq || 0) + 1 } },
        hands
      };
    }
  },

  /* เรือล่ม — บนเรือ ทุกคนบนลำนั้นตกลงเกาะ
     บนเกาะ ทุกคนที่นั่นเสียไพ่โหวตถาวรคนละใบแทน เพราะตกลงเกาะซ้ำไม่ได้ */
  shipwreck: {
    run: (st, uid, _picks, hands) => {
      const place = placeOf(st.pos[uid]);
      const here = occupants(st.pos, place);
      let cur = st, h = hands;

      for (const u of here) {
        const out = maroon(cur, u, h, Math.random, place === 'island');
        cur = out.state; h = out.hands;
        if (out.kind === 'ask') break;   /* มีการ์ดกัน — รอเขาตอบก่อน */
      }
      return {
        state: cur, hands: h,
        shout: { kind: 'wreck', by: uid, place, who: here, card: 'shipwreck' }
      };
    }
  },

  /* ลมสงบ — ตลอดรอบนี้ห้ามใครสั่งโหวตชนิดใดก็ตาม ไม่ว่าอยู่ที่ไหน
     นับเป็นหนึ่งรอบเต็ม คือจนกว่าตาจะวนกลับมาถึงคนเปิดอีกครั้ง */
  doldrums: {
    run: (st, uid, _picks, hands) => ({
      state: { ...st, calm: { until: uid, at: (st.logSeq || 0) + 1 } },
      hands,
      shout: { kind: 'calm', by: uid, card: 'doldrums' }
    })
  },

  /* เกยตื้น — แบ่งกล่องบนเรือสินค้าลงเรือใหญ่สองลำเท่า ๆ กัน เศษคงไว้ที่เดิม
     ถ้าเรือสินค้าว่างอยู่แล้ว ย้ายจากเรือใหญ่ไปเกาะประเทศละหนึ่งกล่องแทน */
  aground: {
    run: (st, uid, _picks, hands) => {
      const c = st.cargo;
      const boxes = c.merchant || 0;

      if (boxes > 0) {
        const each = Math.floor(boxes / 2);
        if (!each) return { state: st, hands };
        const cargo = {
          ...c,
          merchant: boxes - each * 2,
          shipL: { ...c.shipL, B: c.shipL.B + each },
          shipR: { ...c.shipR, B: c.shipR.B + each }
        };
        return { state: { ...st, cargo }, hands,
                 shout: { kind: 'aground', by: uid, n: each, card: 'aground' } };
      }

      /* เรือสินค้าว่าง — ดึงจากเรือใหญ่ไปเกาะ ประเทศละหนึ่งกล่อง */
      let cargo = c;
      for (const side of ['B', 'F']) {
        const from = SHIP_IDS.find(s => (cargo[s]?.[side] || 0) > 0);
        if (!from) continue;
        const next = moveBox(cargo, from, side, 'island', side);
        if (next) cargo = next;
      }
      return { state: { ...st, cargo }, hands,
               shout: { kind: 'agroundIsle', by: uid, card: 'aground' } };
    }
  },

  /* มังสวิรัส — เก็บนกทุกตัวที่ติดตัวผู้เล่นอยู่ออกให้หมด
     ตัวการ์ดบอกให้เอาใบอัลบาทรอสกลับเข้ากองแล้วสับใหม่ด้วย ซึ่งทำที่ชั้นสำรับ
     ตรงนี้จึงรับผิดชอบแค่ส่วนที่อยู่บนกระดาน คือนกที่เกาะตัวคนอยู่ */
  vegan: {
    run: (st, uid, _picks, hands) => {
      const marks = { ...(st.marks || {}) };
      const freed = [];
      for (const [u, m] of Object.entries(marks)) {
        if (!m?.bird) continue;
        freed.push(u);
        const rest = { ...m };
        delete rest.bird;
        marks[u] = rest;
      }
      if (!freed.length) return { state: st, hands };
      return {
        state: { ...st, marks },
        hands,
        shout: { kind: 'vegan', by: uid, who: freed, card: 'vegan' }
      };
    }
  },

  /* ธงดำ — สั่งโหวตได้ทันทีโดยไม่ต้องมีตำแหน่ง
     บนเรือได้โหวตโจมตี บนเกาะได้โหวตแบ่งกล่อง
     ให้สิทธิ์ไว้แล้วเปิดโหวตเลยในจังหวะเดียว ไม่ต้องให้กดซ้ำอีกรอบ */
  blackflag: {
    run: (st, uid, _picks, hands) => {
      const place = placeOf(st.pos[uid]);
      const kind = place === 'island' ? 'islandVote' : 'attack';
      return {
        state: { ...st, flag: { by: uid, kind, place, at: (st.logSeq || 0) + 1 } },
        hands,
        shout: { kind: 'flag', by: uid, place, card: 'blackflag' }
      };
    }
  },

  /* Anthemoessa — ดึงใครก็ได้จากทั้งกระดานเข้ามาร่วมโหวตรอบนี้
     ใช้ได้เฉพาะตอนมีโหวตเปิดอยู่ และคนนั้นต้องยังไม่ได้อยู่ในวง */
  anthemoessa: {
    steps: ['player'],
    ask: { player: 'siren.player' },
    targets: (st, uid, step) => step === 'player'
      ? (st.seats || []).filter(u => st.pos?.[u] && !(st.vote?.voters || []).includes(u))
      : [],
    run: (st, uid, picks, hands) => ({
      state: addVoter(st, picks.player),
      hands,
      shout: { kind: 'siren', by: uid, who: picks.player, card: 'anthemoessa' }
    })
  },

  /* บ้าเรือ — เอาไพ่ประเทศของคนเปิดกับเป้ามาสับรวมกันแล้วแจกคืนคนละใบ
     ทั้งคู่มีสิทธิ์ได้ใบเดิมกลับมา ซึ่งเป็นส่วนสำคัญของกลไก
     เพราะถ้ารู้แน่ว่าสลับกันแน่นอน ข้อมูลจะรั่วทันทีว่าอีกฝ่ายอยู่ประเทศอะไร

     ไพ่ประเทศอยู่ในข้อมูลลับของแต่ละคน ซึ่งผลการ์ดแตะเองไม่ได้
     จึงบอกเป็นคำสั่งกลับไป แล้วให้ตัวจัดการคำสั่งเป็นคนสับให้ */
  cabinfever: {
    steps: ['player'],
    ask: { player: 'fever.player' },
    targets: (st, uid, step) => step === 'player'
      ? (st.seats || []).filter(u => u !== uid && st.pos?.[u])
      : [],
    run: (st, uid, picks, hands) => ({
      state: st,
      hands,
      mixNations: [uid, picks.player],
      shout: { kind: 'fever', by: uid, who: picks.player, card: 'cabinfever' }
    })
  },

  /* ทะเลบ้า — เปิดบนเรือ กล่องทั้งลำถูกซัดไปเรือสินค้าหมด
     เปิดบนเกาะ กล่องบนเกาะถูกแบ่งเท่ากันสองฝั่ง

     เกาะมีได้ทั้ง 2 และ 4 กล่อง (จาก "เกยตื้น") จึงแบ่งครึ่งตามจำนวนจริง
     ไม่ใช่ตั้งเป็น 1-1 ตายตัว ไม่งั้นกล่องจะหายไปจากเกม */
  stormyseas: {
    run: (st, uid, _picks, hands) => {
      const place = placeOf(st.pos[uid]);
      const c = st.cargo;

      if (place === 'island') {
        const total = (c.island?.B || 0) + (c.island?.F || 0);
        const cargo = { ...c, island: { B: Math.ceil(total / 2), F: Math.floor(total / 2) } };
        return { state: { ...st, cargo }, hands,
                 shout: { kind: 'storm', by: uid, place, card: 'stormyseas' } };
      }

      const gone = (c[place]?.B || 0) + (c[place]?.F || 0);
      if (!gone) return { state: st, hands,
                          shout: { kind: 'storm', by: uid, place, n: 0, card: 'stormyseas' } };

      const cargo = { ...c, [place]: { B: 0, F: 0 }, merchant: (c.merchant || 0) + gone };
      return { state: { ...st, cargo }, hands,
               shout: { kind: 'storm', by: uid, place, n: gone, card: 'stormyseas' } };
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

/* บังคับให้คนอื่นเปิด — ไม่ใช่การ์ด แต่เป็น Action ที่ถามสองขั้นเหมือนกัน
   จึงยืมกลไกเดียวกันมาใช้ ไม่ต้องเขียนทางแยกใหม่ทั้งชุด
   ไม่มี run เพราะผลไม่ได้เกิดตรงนี้ — เกิดตอนคนที่ถูกบังคับกดเปิดเอง */
EFFECTS.force = {
  steps: ['player', 'slots'],
  ask: { player: 'force.player', slots: 'force.slots' },
  pickCount: { slots: 2 },
  targets: (st, uid, step) => step === 'player'
    ? (st.seats || []).filter(u => u !== uid && st.pos?.[u])
    : []
};

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
