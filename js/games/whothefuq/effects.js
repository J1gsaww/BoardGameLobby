/* effects.js — ผลของการ์ด Event ทั้ง 40 ใบ
   ─────────────────────────────────────────────────────────────
   แต่ละใบประกาศ flip() (ตอนเปิด/เล่นจากมือ) และบางใบมี resolve() (ตอบกลับ)
   ผลเขียนแบบแก้ร่าง g (clone มาจาก game.js) ผ่าน api แล้ว game.js เก็บ secrets ไปเขียน

   ระบบ pending: การ์ดที่ต้องเลือกอะไรจะตั้ง g.pending ค้างไว้ เฟสจะหยุดรอ
     { card, by, kind, waiting:[uid], data:{} }
     - kind บอกหน้าจอว่าจะถามอะไร (เลือกจุดเด่นตัวเอง/เลือกเป้า/เลือกสองจุด/โหวต/ทาย)
     - waiting = ใครยังต้องตอบ (การ์ดที่ทั้งวงต้องตอบ)

   ⚠️ นี่เป็น "ร่างแรกทั้ง 40 ใบ" — กลไกครบเดินได้ แต่หลายจุดยังทำแบบง่าย
      (เช่น การ์ดที่ให้ "อีกฝ่ายเลือกโชว์" ร่างนี้สุ่มจุดเด่นจริงมาให้ก่อน)
      ใช้ ?dev=card เสกการ์ดมาไล่เทสแล้วบอกพี่รินว่าจะปรับใบไหนยังไงได้เลย

   คำที่ทั้งวง "ต้องรู้ร่วมกัน" → g.known (สาธารณะ)  ·  คำที่ "รู้คนเดียว" → secrets[uid].seen */

import { markKnown, neighborsOf, nextSeat, isOut, activeSeats } from './rules.js';
import { traitsOf, TRAIT_IDS, cardById } from './data.js';

const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const llamaOf = (ctx, uid) => ctx.secrets?.[uid]?.llama || null;
const trueTraits = (ctx, uid) => traitsOf(llamaOf(ctx, uid));

/* api ผูกกับ g หนึ่งชุด เก็บ secret patch ไว้ให้ game.js */
export function makeApi(g, ctx) {
  const patch = {};                 /* uid → secret doc ที่จะเขียนทับ */
  const baseSec = (uid) => patch[uid] || ctx.secrets?.[uid] || {};
  return {
    patch,
    log(key, args = {}) {
      g.logSeq = (g.logSeq || 0) + 1;
      g.log = [...(g.log || []), { key, at: g.logSeq, args }].slice(-60);
    },
    reveal(uid, trait, val) { g.known = markKnown(g.known, uid, trait, val); },   /* สาธารณะ */
    see(uid, key, args = {}) {                                                     /* ส่วนตัว */
      const cur = baseSec(uid);
      const seen = [...(cur.seen || []), { key, args, at: (g.logSeq || 0) }].slice(-30);
      patch[uid] = { ...cur, seen };
    },
    setHand(uid, hand) { patch[uid] = { ...baseSec(uid), hand }; g.holdCount = { ...g.holdCount, [uid]: hand.length }; },
    getHand(uid) { return [...(baseSec(uid).hand || [])]; },
    pending(obj) { g.pending = obj; },
    clear() { g.pending = null; }
  };
}

/* เปิดจุดเด่นตัวเองจริง 1 ข้อ ให้ทั้งวง */
function revealOwn(api, ctx, uid, trait) {
  if (trueTraits(ctx, uid).includes(trait)) { api.reveal(uid, trait, 'yes'); return true; }
  return false;
}

/* ── ตารางผลการ์ด ─────────────────────────────────────────── */
export const EFFECTS = {

  /* ===== REVEAL ===== */
  broadcast: {   /* P3 คนเปิดเลือก 1 จุดเด่น ใครมีต้องประกาศ */
    flip(g, by, ctx, api) { api.pending({ card: 'broadcast', by, kind: 'pickAnyTrait', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      const tr = p.trait; if (!TRAIT_IDS.includes(tr)) return;
      g.seats.filter(u => !isOut(g, u)).forEach(u => { if (traitsOf(llamaOf(ctx, u)).includes(tr)) api.reveal(u, tr, 'yes'); });
      api.log('wtf.fx.broadcast', { trait: tr });
      api.clear();
    }
  },
  missing: {     /* P1 คนเปิดแอบดูลามะที่ถูกถอด 1 ตัว */
    flip(g, by, ctx, api) {
      const removed = ctx.secrets?._deck?.removed || [];
      if (!removed.length) { api.log('wtf.fx.missingNone', {}); return; }
      api.see(by, 'wtf.seen.missing', { llama: rnd(removed) });
      api.log('wtf.fx.missing', {});
    }
  },
  spotlight: {   /* P1 เปิดจุดเด่นตัวเอง 1 ข้อ (เลือกเอง) */
    flip(g, by, ctx, api) { api.pending({ card: 'spotlight', by, kind: 'pickOwnTrait', waiting: [by] }); },
    resolve(g, by, p, ctx, api) { if (revealOwn(api, ctx, by, p.trait)) api.log('wtf.fx.spotlight', {}); api.clear(); }
  },
  trade: {       /* P1 เปิดจุดเด่นตัวเอง 1 ข้อ แลกดูของคนที่เลือก 1 ข้อ */
    flip(g, by, ctx, api) { api.pending({ card: 'trade', by, kind: 'pickTargetOwnTrait', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      if (!revealOwn(api, ctx, by, p.trait)) { api.clear(); return; }
      const t = p.target;
      if (t && !isOut(g, t)) { const tt = trueTraits(ctx, t); if (tt.length) api.see(by, 'wtf.seen.trait', { name: g.names[t] || '?', trait: rnd(tt) }); }
      api.log('wtf.fx.trade', {}); api.clear();
    }
  },
  expose: {      /* P2 เก็บไว้ · บังคับ 1 คนเปิดจุดเด่น 1 ข้อต่อหน้าวง */
    play(g, by, ctx, api) { api.pending({ card: 'expose', by, kind: 'pickTarget', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      const t = p.target;
      if (t && !isOut(g, t)) api.pending({ card: 'expose', by: t, kind: 'pickOwnTrait', waiting: [t], data: { forcedBy: by } });
      else api.clear();
    },
    resolve2(g, uid, p, ctx, api) { if (revealOwn(api, ctx, uid, p.trait)) api.log('wtf.fx.expose', { name: g.names[uid] || '?' }); api.clear(); }
  },
  crack: {       /* P3 ทุกคนเปิดจุดเด่นตัวเอง 1 ข้อ พร้อมกัน */
    flip(g, by, ctx, api) { api.pending({ card: 'crack', by, kind: 'pickOwnTrait', waiting: activeSeats(g) }); },
    resolve(g, uid, p, ctx, api) {
      revealOwn(api, ctx, uid, p.trait);
      g.pending.waiting = g.pending.waiting.filter(u => u !== uid);
      if (!g.pending.waiting.length) { api.log('wtf.fx.crack', {}); api.clear(); }
    }
  },
  combo: {       /* P1 เลือก 2 จุดเด่น ใครมีครบทั้งคู่ประกาศ (ยกเว้นคนเปิด) */
    flip(g, by, ctx, api) { api.pending({ card: 'combo', by, kind: 'pickTwoTraits', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      const [a, b] = p.traits || [];
      if (!a || !b) { api.clear(); return; }
      g.seats.filter(u => !isOut(g, u) && u !== by).forEach(u => {
        const tt = traitsOf(llamaOf(ctx, u));
        if (tt.includes(a) && tt.includes(b)) { api.reveal(u, a, 'yes'); api.reveal(u, b, 'yes'); }
      });
      api.log('wtf.fx.combo', {}); api.clear();
    }
  },
  exclude: {     /* P3 เลือก 1 จุดเด่น ใครไม่มียกมือ (รวมคนเปิด) */
    flip(g, by, ctx, api) { api.pending({ card: 'exclude', by, kind: 'pickAnyTrait', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      const tr = p.trait; if (!TRAIT_IDS.includes(tr)) { api.clear(); return; }
      g.seats.filter(u => !isOut(g, u)).forEach(u => { if (!traitsOf(llamaOf(ctx, u)).includes(tr)) api.reveal(u, tr, 'no'); });
      api.log('wtf.fx.exclude', { trait: tr }); api.clear();
    }
  },
  interview: {   /* P1 ถาม yes/no จุดเด่น 1 ข้อ ทุกคนตอบจริง (คนเปิดไม่ต้องตอบ) */
    flip(g, by, ctx, api) { api.pending({ card: 'interview', by, kind: 'pickAnyTrait', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      const tr = p.trait; if (!TRAIT_IDS.includes(tr)) { api.clear(); return; }
      g.seats.filter(u => !isOut(g, u) && u !== by).forEach(u =>
        api.reveal(u, tr, traitsOf(llamaOf(ctx, u)).includes(tr) ? 'yes' : 'no'));
      api.log('wtf.fx.interview', { trait: tr }); api.clear();
    }
  },

  /* ===== PROBE ===== */
  peek: {        /* P2 ถาม 1 คนว่ามีจุดเด่นไหม ตอบจริง รู้คนเดียว */
    play(g, by, ctx, api) { api.pending({ card: 'peek', by, kind: 'pickTargetAnyTrait', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      const t = p.target, tr = p.trait;
      if (t && tr) api.see(by, 'wtf.seen.has', { name: g.names[t] || '?', trait: tr, yn: traitsOf(llamaOf(ctx, t)).includes(tr) ? 1 : 0 });
      api.log('wtf.fx.peek', {}); api.clear();
    }
  },
  callout: {     /* P1 ถามจุดเด่นของ 1 คนกลางโต๊ะ ตอบจริง รู้ทั้งวง */
    flip(g, by, ctx, api) { api.pending({ card: 'callout', by, kind: 'pickTargetAnyTrait', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      const t = p.target, tr = p.trait;
      if (t && tr) api.reveal(t, tr, traitsOf(llamaOf(ctx, t)).includes(tr) ? 'yes' : 'no');
      api.log('wtf.fx.callout', { name: g.names[t] || '?', trait: tr }); api.clear();
    }
  },
  scan: {        /* P2 เลือก 1 คน ดูจุดเด่น 2 ข้อ (ร่างนี้สุ่มจริงมาให้) รู้คนเดียว */
    play(g, by, ctx, api) { api.pending({ card: 'scan', by, kind: 'pickTarget', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      const t = p.target;
      if (t && !isOut(g, t)) {
        const tt = [...trueTraits(ctx, t)].sort(() => Math.random() - 0.5).slice(0, 2);
        api.see(by, 'wtf.seen.scan', { name: g.names[t] || '?', traits: tt.join(',') });
      }
      api.log('wtf.fx.scan', {}); api.clear();
    }
  },
  nosey: {       /* P2 ติดตัว: เมื่อมี challenge แอบรู้ว่าคนทายเป็นลามะอะไร (ผูกใน game.js) */
    play(g, by, ctx, api) { api.log('wtf.fx.noseyHold', {}); }   /* ทำงานเองตอน challenge ไม่ต้องเล่น */
  },

  /* ===== NEIGHBOR ===== */
  peep: {        /* P1 ดูจุดเด่น 1 ข้อของคนข้างๆ (ร่างนี้สุ่มจริง) รู้คนเดียว */
    flip(g, by, ctx, api) { api.pending({ card: 'peep', by, kind: 'pickNeighbor', waiting: [by], data: { opts: neighborsOf(g, by) } }); },
    resolve(g, by, p, ctx, api) {
      const t = p.target;
      if (t) { const tt = trueTraits(ctx, t); if (tt.length) api.see(by, 'wtf.seen.trait', { name: g.names[t] || '?', trait: rnd(tt) }); }
      api.log('wtf.fx.peep', {}); api.clear();
    }
  },
  goodneighbor: { /* P1 คนเปิดกับคนข้างๆ เปิดจุดเด่นให้กันคนละ 1 (ร่างนี้สุ่มจริง) รู้กัน 2 คน */
    flip(g, by, ctx, api) { api.pending({ card: 'goodneighbor', by, kind: 'pickNeighbor', waiting: [by], data: { opts: neighborsOf(g, by) } }); },
    resolve(g, by, p, ctx, api) {
      const t = p.target;
      if (t) {
        const mine = trueTraits(ctx, by), theirs = trueTraits(ctx, t);
        if (theirs.length) api.see(by, 'wtf.seen.trait', { name: g.names[t] || '?', trait: rnd(theirs) });
        if (mine.length) api.see(t, 'wtf.seen.trait', { name: g.names[by] || '?', trait: rnd(mine) });
      }
      api.log('wtf.fx.goodneighbor', {}); api.clear();
    }
  },
  gossip: {      /* P1 คนข้างๆ บอกสิ่งที่รู้ให้คนเปิด — เป็นการคุยด้วยปาก ไม่มีผลอัตโนมัติ */
    flip(g, by, ctx, api) { api.log('wtf.fx.verbal', {}); }
  },
  bestie: {      /* P1 บอกจุดเด่นตัวเอง 1 ข้อให้คนข้างๆ จริงหรือโกหกก็ได้ */
    flip(g, by, ctx, api) { api.pending({ card: 'bestie', by, kind: 'bestie', waiting: [by], data: { opts: neighborsOf(g, by) } }); },
    resolve(g, by, p, ctx, api) {
      const t = p.target, tr = p.trait;
      if (t && tr) api.see(t, 'wtf.seen.claim', { name: g.names[by] || '?', trait: tr });
      api.log('wtf.fx.bestie', {}); api.clear();
    }
  },
  truefriend: {  /* P1 เลือก 1 คน · ห้ามทายกัน 2 รอบ */
    flip(g, by, ctx, api) { api.pending({ card: 'truefriend', by, kind: 'pickTarget', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      const t = p.target;
      if (t) { g.pairs = [...(g.pairs || []), { a: by, b: t, until: g.round + 2 }]; api.log('wtf.fx.truefriend', { name: g.names[t] || '?' }); }
      api.clear();
    }
  },

  /* ===== SHIELD (ส่วนใหญ่ตั้งธง ผูกตอน challenge) ===== */
  vanish: {      /* P2 ติดตัว: ยกเลิก challenge ที่มาหาตัวเอง 1 ครั้ง (ทำงานเองใน game.js) */
    play(g, by, ctx, api) { api.log('wtf.fx.hold', {}); }
  },
  silence: {     /* P2 เลือก 1 คน ห้ามพูด/ทายตลอดเฟส challenge ตานี้ */
    play(g, by, ctx, api) { api.pending({ card: 'silence', by, kind: 'pickTarget', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      const t = p.target;
      if (t) { g.mute = [...(g.mute || []), t]; api.log('wtf.fx.silence', { name: g.names[t] || '?' }); }
      api.clear();
    }
  },
  heavens: {     /* P1 รอบนี้ห้ามใครทายคนเปิด */
    flip(g, by, ctx, api) { g.protect = [...(g.protect || []), by]; api.log('wtf.fx.heavens', {}); }
  },
  noshow: {      /* P2 ติดตัว: เมื่อมีประกาศ "ใครมีจุดเด่น..." เลือกไม่ประกาศได้ 1 ครั้ง (ทำงานเองตอน reveal) */
    play(g, by, ctx, api) { api.log('wtf.fx.hold', {}); }
  },
  truce: {       /* P3 รอบนี้ห้ามทายทั้งวง */
    flip(g, by, ctx, api) { g.noChallenge = g.round; api.log('wtf.fx.truce', {}); }
  },

  /* ===== STRIKE ===== */
  whoareyou: {   /* P1 ทายฟรีทันที 1 ครั้ง ผิดไม่เสียโทษ */
    flip(g, by, ctx, api) { api.pending({ card: 'whoareyou', by, kind: 'freeGuess', waiting: [by], data: { free: true } }); }
    /* การเฉลยทำใน game.js (doResolveGuess) เพราะต้องแตะ out/known */
  },
  manlyroad: {   /* P3 รอบนี้ทายได้ไม่จำกัด โทษผิด = เปิด 2 จุด */
    flip(g, by, ctx, api) { g.roundMod = { ...(g.roundMod || {}), unlimited: true, penalty2: true }; api.log('wtf.fx.manlyroad', {}); }
  },
  awaken: {      /* P2 ให้คนที่ออกไปแล้ว เปิดจุดเด่นลามะนั้น 2 ข้อให้ทุกคน */
    play(g, by, ctx, api) {
      const outs = g.out || [];
      if (!outs.length) { api.log('wtf.fx.awakenNone', {}); return; }
      api.pending({ card: 'awaken', by, kind: 'pickOut', waiting: [by], data: { opts: outs } });
    },
    resolve(g, by, p, ctx, api) {
      const t = p.target;
      if (t) { const tt = [...traitsOf(llamaOf(ctx, t))].sort(() => Math.random() - 0.5).slice(0, 2); tt.forEach(x => api.reveal(t, x, 'yes')); api.log('wtf.fx.awaken', { name: g.names[t] || '?' }); }
      api.clear();
    }
  },
  arena: {       /* P1 เลือก 1 คนมาดวล ต่างทายกันพร้อมกัน (เฉลยใน game.js) */
    flip(g, by, ctx, api) { api.pending({ card: 'arena', by, kind: 'pickTarget', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      const t = p.target;
      if (t && !isOut(g, t)) api.pending({ card: 'arena', by, kind: 'duelGuess', waiting: [by, t], data: { a: by, b: t, guesses: {} } });
      else api.clear();
    }
  },
  mafia: {       /* P1 บังคับ 1 คนให้ทายในตานี้ (คนโดนบังคับเลือกเป้าเอง) */
    flip(g, by, ctx, api) { api.pending({ card: 'mafia', by, kind: 'pickTarget', waiting: [by] }); },
    resolve(g, by, p, ctx, api) {
      const t = p.target;
      if (t && !isOut(g, t)) api.pending({ card: 'mafia', by: t, kind: 'freeGuess', waiting: [t], data: { forced: true } });
      else api.clear();
    }
  },
  lastduel: {    /* P2 ติดตัว: โดนทายถูกแล้วทายกลับได้ 1 ครั้ง (ทำงานเองใน game.js) */
    play(g, by, ctx, api) { api.log('wtf.fx.hold', {}); }
  },

  /* ===== CHAOS ===== */
  ratio: {       /* P3 โหวต 1 รอบ คนโดนโหวตมากสุดเปิดจุดเด่น 1 ข้อ */
    flip(g, by, ctx, api) { api.pending({ card: 'ratio', by, kind: 'vote', waiting: activeSeats(g), data: { votes: {} } }); },
    resolve(g, uid, p, ctx, api) {
      g.pending.data.votes[uid] = p.target;
      g.pending.waiting = g.pending.waiting.filter(u => u !== uid);
      if (g.pending.waiting.length) return;
      const tally = {};
      Object.values(g.pending.data.votes).forEach(t => { if (t) tally[t] = (tally[t] || 0) + 1; });
      const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
      if (top) { const loser = top[0]; api.pending({ card: 'ratio', by: loser, kind: 'pickOwnTrait', waiting: [loser], data: { fromVote: true } }); }
      else api.clear();
    },
    resolve2(g, uid, p, ctx, api) { if (revealOwn(api, ctx, uid, p.trait)) api.log('wtf.fx.ratio', { name: g.names[uid] || '?' }); api.clear(); }
  },
  chairs: {      /* P3 ทุกคนส่งการ์ดในมือให้คนถัดไปตามเข็ม */
    flip(g, by, ctx, api) {
      const active = activeSeats(g);
      const hands = Object.fromEntries(active.map(u => [u, api.getHand(u)]));
      active.forEach(u => { const to = nextSeat(g, u); api.setHand(to, hands[u]); });
      /* ตั้ง holdCount ใหม่ให้ครบ (คนที่ไม่ได้รับก็อัปเดตเป็นของที่ส่งต่อมา) */
      api.log('wtf.fx.chairs', {});
    }
  }
};

/* การ์ดใบนี้ตอนเปิด/เล่น เข้า flip() หรือ play() ตัวไหน */
export function startCard(g, cardId, by, ctx, api, fromHand) {
  const e = EFFECTS[cardId]; if (!e) return;
  const fn = fromHand ? (e.play || e.flip) : (e.flip || e.play);
  if (fn) fn(g, by, ctx, api);
}

/* ตอบ pending — บางใบมีสองสเต็ป (resolve → resolve2) */
export function resolveCard(g, cardId, uid, payload, ctx, api) {
  const e = EFFECTS[cardId]; if (!e) return;
  const pend = g.pending;
  /* สเต็ปสอง: expose (เป้าเปิดจุดเด่น) / ratio (คนแพ้โหวตเปิดจุดเด่น) */
  if (pend?.data?.forcedBy && e.resolve2) return e.resolve2(g, uid, payload, ctx, api);
  if (pend?.data?.fromVote && e.resolve2) return e.resolve2(g, uid, payload, ctx, api);
  if (e.resolve) e.resolve(g, uid, payload, ctx, api);
}

export const cardName = (id) => cardById(id);
