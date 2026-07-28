/* scene.js — ฉากบนกระดานตอนโหวต
   ─────────────────────────────────────────────────────────────
   กฎเหล็กสองข้อที่เคยพลาดมาแล้วทั้งคู่

   1) ห้ามเขียน innerHTML ใหม่ทุกเฟรม — แอนิเมชันจะเริ่มนับหนึ่งใหม่
      (เห็นเป็นลูปไม่หยุด) และ <img> จะโหลดใหม่จนไม่มีวันเสร็จ
   2) ต้องมีลูป rAF ตัวเดียวในระบบ — ของเดิม render() เรียก paintScene
      แล้ว paintScene ก็ขอเฟรมถัดไปเอง พอห้องอัปเดตทุก 5 วินาที
      ก็เกิดลูปใหม่ซ้อนขึ้นเรื่อย ๆ จนหลายสิบตัวแย่งกันเขียน DOM
      ตอนนี้ยกเลิกตัวเก่าทุกครั้งที่เข้าฟังก์ชัน จึงเหลือตัวเดียวเสมอ

   ทั้งการโหวตนับเป็น "หนึ่งฉาก" ยาว ๆ ไม่ตัดใหม่ตอนเปลี่ยนช่วง
   ไพ่ที่วางอยู่แล้วจึงอยู่ต่อ ใบจากกองกลางสไลด์มาต่อท้าย แล้วค่อยรวมกันหุบหาย
   ───────────────────────────────────────────────────────────── */

import { t } from '../../i18n.js';
import { VOTE_ART, ICON_EXT } from './vote.js';
import { takeSides, keepSides, SHIP_CARGO_CAP, occupants, placeOf, SHIP_IDS } from './rules.js';
import { askKey, pickCountOf, isChoice, targetsOf } from './effects.js';
import { grabFrom, grabTo } from './duel.js';
import { voteCard, cardById as voteById } from './vote.js';
import { BASE_CARDS, cardArt, eventArt, eventAlt, CARD_ART, CARD_EXT, CARD_ALT } from './events.js';

/* หลังไพ่ประเทศ ใช้ในฉากสับไพ่ของบ้าเรือ */
const BRAWL_BACK = 'assets/game/wreckers/cards/brawl_back' + CARD_EXT;

/* ภาพเอฟเฟกต์เฉพาะใบ — ตอนนี้มีแค่สายฟ้าของทะเลบ้า
   เก็บเป็นตารางไว้ตั้งแต่ต้น เผื่อใบอื่นอยากมีของประกอบฉากบ้าง
   จะได้เพิ่มชื่อใบเดียวไม่ต้องไปแก้ตัววาด */
const FX = 'assets/game/wreckers/effect/';
const CARD_FX = { stormyseas: ['lightning_left', 'lightning_right'] };
const BRAWL_BACK_ALT = 'assets/game/wreckers/cards/brawl_back' + CARD_ALT;
import { EXTRA_CARDS } from './cards.js';
import { lang } from '../../i18n.js';

const ALL_CARDS = [...BASE_CARDS, ...EXTRA_CARDS];
const cardById = (id) => ALL_CARDS.find(c => c.id === id) || null;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const VOTE_BACK = `${VOTE_ART}back${ICON_EXT}`;

const T = {
  intro: 1480,     // เส้นวิ่ง + ชื่อโผล่ + ค้างให้อ่าน
  deckWait: 900,   // รอหลังไพ่คนสุดท้ายลง ก่อนใบจากกองจะเด้งเข้ามา
  deckCard: 1500,  // ใบจากกองกลางสไลด์เข้ามาแล้วค้างให้ทันดู
  merge: 700,      // วิ่งมาซ้อนกัน
  vanish: 480,     // หุบหาย
  tick: 430,       // ระยะห่างของไอคอนแต่ละตัว — ช้าพอให้ลุ้นทีละอัน
  lead: 500,       // เว้นก่อนไอคอนแรกโผล่ ให้สายตาตั้งหลักก่อน
  verdict: 900,    // เว้นก่อนขึ้นคำตัดสิน
  afterIcons: 1400, // ค้างหลังไอคอนครบ ก่อนไปช่วงถัดไป
  strike: 2000,    // ฉากเหตุการณ์แบบนกถล่ม — สั้นกว่าผลโหวตเพราะไม่มีอะไรให้นับ
  after: 700,      // ค้างหลังการ์ดที่ผลเกิดทันที ก่อนปล่อยให้กระดานขยับ
  linger: 2400     // ค้างผลไว้ให้อ่านก่อนปิดฉากเอง
};

/* สัญลักษณ์ที่นับ ขึ้นกับชนิดการโหวต — โหวตกบฏกับโหวตแบ่งกล่องก็ต้องได้ไอคอนไหลเหมือนกัน
   ของเดิมนับแต่แถวโจมตี ทำให้อีกสองชนิดขึ้นผลว่างเปล่าแล้วสรุปด้วยข้อความของการยิง */
const ROWS = {
  attack: [
    { ch: 'C', file: 'cannon' },
    { ch: 'F', file: 'torch' },
    { ch: 'W', file: 'water' }
  ],
  mutiny: [
    { ch: 'A', file: 'agree' },
    { ch: 'D', file: 'disagree' }
  ],
  islandVote: [
    { ch: 'B', file: 'british' },
    { ch: 'R', file: 'france' }
  ]
};
const rowsOf = (kind) => ROWS[kind] || ROWS.attack;

let key = '';        // ฉาก (หนึ่งการโหวตทั้งกระบวน)
let at = 0;          // เริ่มฉากตอนกี่โมง
let phase = '';      // ช่วงย่อยที่ไปถึงแล้ว
let stageAt = 0;     // ช่วงย่อยเริ่มตอนกี่โมง
let aimView = '';    // มุมมองย่อยของช่วงกัปตันเลือก
let restAt = 0;      // เวลาที่ผลขึ้นครบ ใช้นับถอยหลังก่อนปิดฉาก
let closing = false; // สั่งปิดฉากในเฟรมนี้
const told = new Set();   // ผลของการโหวตที่เล่าจบไปแล้ว
let raf = 0;

/* ฉากที่เล่าจบและปิดไปแล้ว จะไม่เปิดขึ้นมาอีก
   จำเป็นเพราะ lastVote ค้างอยู่ในสถานะจนกว่าจะมีการโหวตครั้งถัดไป
   ถ้าไม่จำไว้ ฉากจะกลับมาเปิดทุกครั้งที่วาดใหม่ แล้วผู้เล่นทำอะไรต่อไม่ได้เลย */
const dismissed = new Set();
let seen = {};       // จำนวนไพ่ที่วางไปแล้วของแต่ละคน — ไม่ใช่แค่ว่าวางหรือยัง
let voterList = [];  // รายชื่อผู้ร่วมโหวตล่าสุด ใช้เติมไพ่ที่ตกหล่น
let sendFn = null;
let sceneCtx = null;   /* เก็บไว้ให้ส่วนย่อยที่ต้องรู้ว่าใครกำลังดูอยู่ */

const now = () => performance.now();

/* หนึ่งฉาก = หนึ่งการโหวตทั้งกระบวน ตั้งแต่สั่งจนกัปตันเลือกเสร็จ
   ผูกกับคนสั่งกับสถานที่ ไม่ผูกกับช่วง จึงไม่ถูกตัดใหม่กลางทาง */
function sceneKey(st) {
  if (st.vote) return `ep:${st.vote.caller}:${st.vote.place}`;
  /* ประกาศการแอบดูเป็นฉากสั้น ๆ ของตัวเอง ไม่ปนกับฉากโหวต */
  if (st.lastPeek && !dismissed.has('peek:' + st.lastPeek.at)) return `peek:${st.lastPeek.at}`;
  /* การ์ดมาก่อนประกาศผลเสมอ — ต้องรู้ว่าเปิดเจออะไรก่อนถึงจะเข้าใจว่าทำไมถึงเกิดผลนั้น
     ถ้าสลับลำดับ จะเห็นผลลอย ๆ ก่อนแล้วค่อยรู้ว่ามาจากการ์ดใบไหน */
  if (st.cardUp && !dismissed.has('card:' + st.cardUp.at)) return `card:${st.cardUp.at}`;

  /* วงยิงแข่งสองลำ — ต้องมา **หลัง** ฉากเปิดการ์ดเสมอ
     ไม่งั้นวงยิงจะขึ้นทับก่อนที่คนดูจะรู้ว่าเปิดเจอการ์ดอะไร
     ซึ่งเป็นกฎเดียวกับที่ใช้กับประกาศผลทุกชนิด — รู้เหตุก่อนเห็นผล */
  if (st.duel) return `duel:${st.duel.at}`;
  if (st.lastDuel && !told.has('duel:' + st.lastDuel.at)) return `duelend:${st.lastDuel.at}`;
  /* ค้างถามลูกเรือว่าลำไหนคืนกล่องฝั่งไหน — ถามสองคนพร้อมกันได้ */
  if (st.spoils) return `spoils:${st.spoils.at}`;
  if (st.grab) return `grab:${st.grab.at}.${st.grab.left}.${st.grab.step}`;
  /* ค้างรอคำตอบว่าจะใช้การ์ดกันไหม ต้องมาก่อนประกาศผลเสมอ
     เพราะตอนนี้ผลยังไม่เกิด คนที่ถูกถามอาจรอดก็ได้ */
  if (st.saveAsk) return `save:${st.saveAsk.at}`;
  if (st.shout && !dismissed.has('shout:' + st.shout.at)) return `shout:${st.shout.at}`;
  /* ช่วงรอให้คนเปิดเลือกเป้า — ค้างไว้จนกว่าจะเลือกเสร็จ ไม่มีนับถอยหลัง
     ทุกคนต้องรู้ว่ากำลังอยู่ในช่วงนี้ ไม่ใช่แค่คนที่ต้องเลือก */
  /* มีขั้นถามค้างอยู่แต่ไม่มีการ์ดเปิดอยู่ = เป็น Action ไม่ใช่การ์ด (เช่นการบังคับให้เปิด)
     ต้องแยกฉาก ไม่งั้นฉากเปิดการ์ดจะไปอ่านข้อมูลการ์ดที่ไม่มีอยู่แล้วพัง */
  if (st.pending && !st.cardUp) return `ask:${st.pending.at}`;
  if (st.pending) return `card:${st.pending.at}`;
  /* มีคนถูกบังคับให้เปิดแล้วยังไม่เปิด — ค้างบอกทั้งวงไว้ว่ารออะไรอยู่ */
  if (st.forced) return `forced:${st.forced.at}`;
  if (st.aim) return `ep:${st.aim.by}:${st.aim.place}`;
  if (st.lastVote && !dismissed.has(st.lastVote.at))
    return `ep:${st.lastVote.caller}:${st.lastVote.place}`;
  return '';
}

export function stopScene() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0; key = ''; phase = ''; aimView = ''; seen = {};
}

/* ช่วงย่อยเดินหน้าอย่างเดียว ถอยกลับไม่ได้เด็ดขาด
   บั๊กที่เจอมาแล้ว: reveal() สั่งเข้าช่วง pot ทุกเฟรมโดยไม่ดูว่าเลยไปถึง tally แล้ว
   พอถึง tally เฟรมถัดไปก็ดีดกลับมา pot แล้วสร้างไพ่ใหม่ วนไม่มีวันจบ */
const ORDER = ['collect', 'pot', 'tally', 'aim'];
const rank = (p) => ORDER.indexOf(p);

function goto(name) {
  if (rank(name) <= rank(phase)) return false;
  phase = name; stageAt = now();
  return true;
}

export function paintScene(el, st, ctx) {
  /* ยกเลิกลูปเก่าก่อนเสมอ เหลือตัวเดียวในระบบ */
  if (raf) { cancelAnimationFrame(raf); raf = 0; }

  const box = el.querySelector('.wr-scene');
  if (!box) return;
  sendFn = ctx.send;
  sceneCtx = ctx;

  const want = sceneKey(st);
  if (!want) {
    if (key) { box.hidden = true; box.innerHTML = ''; stopScene(); }
    return;
  }
  closing = false;

  if (key !== want) {
    key = want; at = now(); phase = ''; aimView = ''; restAt = 0; closing = false;
  seen = {};
    box.hidden = false;
    box.innerHTML = `
      <div class="wr-scene-title">
        <span class="wr-scene-lines"><i></i><i></i></span>
        <span class="wr-scene-who"></span>
        <strong class="wr-scene-big"></strong>
      </div>
      <div class="wr-scene-body" hidden></div>
      <p class="wr-scene-line" hidden></p>
      <div class="wr-scene-stage" hidden></div>`;
  }

  namesRef = st.names || {};
  const ms = now() - at;
  const title = box.querySelector('.wr-scene-title');
  const body = box.querySelector('.wr-scene-body');

  /* ชื่อเปลี่ยนข้อความได้โดยไม่ต้องสร้างใหม่ แอนิเมชันจึงไม่เริ่มใหม่ */
  const head = titleOf(st, phase, ctx.me.uid);
  const who = box.querySelector('.wr-scene-who');
  const big = box.querySelector('.wr-scene-big');
  if (who.textContent !== head.who) who.textContent = head.who;
  if (big.textContent !== head.big) big.textContent = head.big;

  /* จอเปิดโล่งให้คลิกเรือได้ เฉพาะตอนถึงช่วงเล็งจริง ๆ
     ของเดิมเช็กแค่ว่ามี st.aim ซึ่งเกิดขึ้นตั้งแต่ตอนเปิดผล ผลเลยถูกดันไปอยู่ล่างสุดของกระดาน */
  box.classList.toggle('clear',
    phase === 'aim' && !!st.aim && st.aim.by === ctx.me.uid && !st.aim.target);
  /* ช่วงเลือกเป้าไม่ต้องมีพื้นมืด เพราะต้องมองกระดานแล้วคลิก
     ความมืดจะถูกถอดออกตอนการ์ดย่อไปมุม ดูที่คลาส parked ของตัวเนื้อหา */
  /* ช่วงรอคนถูกบังคับ ไม่ต้องมืด เพราะเขาต้องมองเห็นการ์ดเพื่อกด */
  /* ช่วงเลือกของ Action พวกนี้ จอต้องไม่มืด เพราะต้องมองเห็นกระดานกับการ์ดเพื่อกด */
  if (key.startsWith('forced:') || key.startsWith('ask:')) box.classList.add('bare');
  box.classList.toggle('bare', !!st.pending && key.startsWith('card:')
    && !!box.querySelector('.wr-scene-body.parked'));
  title.classList.toggle('up', ms > T.intro);
  body.hidden = ms < T.intro;

  let busy = ms < T.intro;
  if (!body.hidden) busy = step(body, st, ctx) || busy;

  /* ปิดฉากแล้วต้องซ่อนเดี๋ยวนี้เลย
     ของเดิมแค่จำว่าปิดแล้วแต่ไม่ขอเฟรมต่อ กล่องเลยค้างอยู่บนจอตลอดกาล
     เพราะไม่มีใครกลับมาเช็กว่า sceneKey กลายเป็นว่างไปแล้ว */
  if (closing) {
    box.hidden = true; box.innerHTML = ''; stopScene();
    if (onClose) requestAnimationFrame(onClose);
    return;
  }

  /* ขอเฟรมถัดไปเฉพาะตอนที่ยังมีอะไรขยับจริง ๆ */
  if (busy) raf = requestAnimationFrame(() => paintScene(el, st, ctx));
}

/* ตัวเดินเรื่อง — ตัดสินว่าตอนนี้ควรอยู่ช่วงไหน แล้วเดินไปข้างหน้าเท่านั้น
   คืนค่า true เมื่อยังมีอะไรขยับ เพื่อขอเฟรมถัดไป */
function step(body, st, ctx) {
  if (key.startsWith('spoils:')) return spoilNote(body, st, ctx);
  if (key.startsWith('grab:')) return grabNote(body, st, ctx);
  if (key.startsWith('duelend:')) return duelResult(body, st, ctx);
  if (key.startsWith('duel:')) return duelCollect(body, st, ctx);
  if (key.startsWith('peek:')) return peekNote(body, st);
  if (key.startsWith('shout:')) return shoutNote(body, st);
  if (key.startsWith('card:')) return cardNote(body, st, ctx);
  if (key.startsWith('ask:')) return askNote(body, st, ctx);
  if (key.startsWith('forced:')) return forcedNote(body, st, ctx);
  if (key.startsWith('save:')) return saveNote(body, st, ctx);
  if (st.vote) { goto('collect'); return collect(body, st); }

  /* เข้ามาตอนกัปตันกำลังเลือกอยู่แล้ว ก็ข้ามการเล่าย้อนหลังไปเลย */
  if (!phase && st.aim) { goto('aim'); return aim(body, st, ctx); }

  if (st.lastVote && rank(phase) < rank('tally')) {
    if (pot(body, st.lastVote)) return true;
    goto('tally');
  }

  if (phase === 'tally') {
    if (tally(body, st.lastVote)) return true;
    /* เล่าจบแล้ว ปล่อยให้กระดานตามสถานะจริงได้ */
    if (st.lastVote) told.add(st.lastVote.at);

    /* ผลต้องขึ้นให้ครบก่อน ถึงจะเปิดให้กัปตันเลือกเรือ
       ถ้าปล่อยพร้อมกัน กัปตันจะรู้ผลก่อนคนอื่นและคลิกได้ทั้งที่ผลยังไม่ขึ้น */
    if (st.aim) goto('aim');
    else {
      /* ยิงไม่ติด — ค้างผลไว้ให้อ่านแล้วปิดฉากเอง
         ตาผ่านไปตั้งแต่ตอนเปิดผลแล้ว ถ้าฉากไม่ปิดคนเล่นจะทำอะไรต่อไม่ได้ */
      if (!restAt) restAt = now();
      if (now() - restAt < T.linger) return true;
      dismissed.add(st.lastVote.at);
      closing = true;
      return false;
    }
  }

  if (phase === 'aim') {
    if (st.aim) return aim(body, st, ctx);

    /* กัปตันเลือกเสร็จแล้ว st.aim หายไป — ทุกคนต้องปิดฉากพร้อมกัน
       ของเดิมปิดเฉพาะเครื่องกัปตัน คนอื่นค้างอยู่ที่หน้า "รอกัปตันเลือก" ตลอดกาล
       เพราะ lastVote ยังอยู่ในสถานะ ฉากจึงไม่มีเหตุผลให้ปิดเอง */
    if (!restAt) restAt = now();
    /* ประกาศผลการชิงกล่องก่อนปิด ทุกคนเห็นพร้อมกัน */
    if (st.lastTake && !body.querySelector('.wr-scene-took')) {
      const p = document.createElement('p');
      p.className = 'wr-scene-took';
      p.textContent = t('wreck.scene.took', {
        name: st.names?.[st.lastTake.by] || '?',
        from: t('wreck.place.' + st.lastTake.target),
        side: t('wreck.nation.' + st.lastTake.side)
      });
      body.appendChild(p);
    }
    if (now() - restAt < T.linger) return true;
    if (st.lastVote) dismissed.add(st.lastVote.at);
    closing = true;
    return false;
  }
  return false;
}

/* ชื่อฉากเดินหน้าอย่างเดียวเหมือนช่วงย่อย
   พอถึงช่วงเล็งแล้ว st.aim หายไปตอนกัปตันเลือกเสร็จ ถ้าคำนวณใหม่จาก st เฉย ๆ
   ชื่อจะเด้งกลับไปเป็น Call to Shoot ให้เห็นแวบหนึ่งก่อนฉากปิด */
/* ฉากประกาศการแอบดู — ขึ้นสั้น ๆ แล้วปิดเอง ไม่ค้าง */
function peekNote(body, st) {
  if (goto('collect')) {
    body.innerHTML = `<p class="wr-scene-note">${esc(t('wreck.scene.peeked', {
      name: st.names?.[st.lastPeek.by] || '?',
      slots: st.lastPeek.slots.map(n => n + 1).join(', ')
    }))}</p>`;
  }
  if (now() - stageAt < T.linger) return true;
  dismissed.add('peek:' + st.lastPeek.at);
  closing = true;
  return false;
}

/* ประกาศเหตุการณ์สั้น ๆ อย่างการไล่คนลงจากเรือ */
function shoutNote(body, st) {
  const sh = st.shout;

  /* นกโจมตี — ใช้ภาพเต็มกลางกระดาน เพราะเป็นเหตุการณ์ที่กระทบทุกคนบนเรือลำนั้น
     ประกาศให้เห็นก่อน แล้วกระดานจึงค่อยขยับตามตอนฉากปิด */
  if (sh.kind === 'birds') {
    if (goto('collect')) {
      body.innerHTML = `<div class="wr-strike">
          <img class="wr-strike-img" src="${esc(eventArt('albatross_strike'))}" alt=""
            draggable="false" data-alt="${esc(eventAlt('albatross_strike'))}"
            onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt='';}else{this.remove();}">
          <p class="wr-strike-line">${esc(t('wreck.scene.birds', { n: sh.who.length }))}</p>
        </div>`;
    }
    if (now() - stageAt < T.strike) return true;
    dismissed.add('shout:' + sh.at);
    closing = true;
    return false;
  }

  /* บ้าเรือ — มีแอนิเมชันของตัวเองแล้วค่อยเฉลย ไม่ใช่ข้อความบรรทัดเดียว */
  if (sh.kind === 'fever') return feverNote(body, st, sceneCtx || {});

  if (goto('collect')) {
    const nameOf2 = (u) => st.names?.[u] || '?';
    /* สายนี้เคยหลุดหายไปตอนแก้ข้อความ ทำให้ไหลไปจบที่ข้อความไล่คนลงเรือ
       ซึ่งเป็นอันสุดท้ายของสาย เลยขึ้นผิดเรื่องทั้งหัวข้อและเนื้อความ */
    const msg = sh.kind === 'grabbed'
      ? t('wreck.scene.grabbed', { place: t('wreck.place.' + sh.place), n: sh.n })
      : sh.kind === 'spoils'
      ? t('wreck.scene.spoils')
      : sh.kind === 'hold'
      ? t('wreck.scene.hold', { name: nameOf2(sh.by) })
      : sh.kind === 'toss'
      ? t('wreck.scene.toss', { name: nameOf2(sh.by),
          side: t(sh.side === 'B' ? 'wreck.british' : 'wreck.france'),
          place: t('wreck.place.' + sh.place) })
      : sh.kind === 'deal'
      ? t(sh.n ? 'wreck.scene.deal' : 'wreck.scene.dealNone', { name: nameOf2(sh.by), n: sh.n })
      : sh.kind === 'reliefMiss'
      ? t('wreck.scene.reliefMiss', { name: nameOf2(sh.by) })
      : sh.kind === 'fizzle'
      ? t('wreck.scene.fizzle')
      : sh.kind === 'hookMiss'
      ? t('wreck.scene.hookMiss', { name: st.names?.[sh.by] || '?' })
      : sh.kind === 'rat'
      ? t('wreck.scene.rat', {
          from: t(sh.from === 'B' ? 'wreck.british' : 'wreck.france'),
          to: t(sh.to === 'B' ? 'wreck.british' : 'wreck.france')
        })
      : sh.kind === 'storm'
      ? (sh.place === 'island' ? t('wreck.scene.stormIsle')
        : !sh.n ? t('wreck.scene.stormNone', { place: t('wreck.place.' + sh.place) })
        : t('wreck.scene.storm', { n: sh.n, place: t('wreck.place.' + sh.place) }))
      : sh.kind === 'skip'
      ? t('wreck.scene.skipped', { who: (sh.who || []).map(nameOf2).join(', ') })
      : sh.kind === 'scurvy'
      ? t('wreck.scene.scurvy', { place: t('wreck.place.' + placeOf(st.pos?.[sh.by] || '')) })
      : sh.kind === 'wreck'
      ? t('wreck.scene.wreck', { place: t('wreck.place.' + sh.place) })
      : sh.kind === 'calm' ? t('wreck.scene.calm')
      : sh.kind === 'aground' ? t('wreck.scene.aground', { n: sh.n })
      : sh.kind === 'agroundIsle' ? t('wreck.scene.agroundIsle')
      : sh.kind === 'vegan' ? t('wreck.scene.vegan')
      : sh.kind === 'flag'
        ? t('wreck.scene.flag', { name: nameOf2(sh.by), place: t('wreck.place.' + sh.place) })
      : sh.kind === 'siren'
        ? t('wreck.scene.siren', { name: nameOf2(sh.by), who: nameOf2(sh.who) })
      : sh.kind === 'powder'
      ? t(sh.who ? 'wreck.scene.powderRider' : 'wreck.scene.powder', {
          name: st.names?.[sh.by] || '?',
          place: t('wreck.place.' + sh.place),
          who: st.names?.[sh.who] || '?'
        })
      : sh.kind === 'crow'
      ? t('wreck.scene.crow', {
          name: st.names?.[sh.by] || '?', who: st.names?.[sh.who] || '?' })
      : sh.kind === 'atlantis'
      ? t(sh.spill?.length ? 'wreck.scene.atlantisSpill' : 'wreck.scene.atlantis', {
          name: st.names?.[sh.by] || '?',
          who: st.names?.[sh.who] || '?',
          n: sh.spill?.length || 0
        })
      : sh.kind === 'saved'
      ? t('wreck.scene.savedBy', {
          name: st.names?.[sh.by] || '?', card: t('wreck.card.' + sh.card) })
      : sh.kind === 'gaveMap'
      ? t('wreck.scene.gaveMap', {
          name: st.names?.[sh.by] || '?', who: st.names?.[sh.who] || '?',
          card: t('wreck.card.' + sh.card) })
      : sh.kind === 'marque'
      ? t('wreck.scene.marque', {
          name: st.names?.[sh.by] || '?',
          who: st.names?.[sh.who] || '?',
          place: t('wreck.place.' + sh.place)
        })
      : sh.kind === 'shot'
      ? t('wreck.scene.shot', {
          name: st.names?.[sh.by] || '?',
          who: st.names?.[sh.who] || '?'
        })
      : sh.kind === 'shift'
      ? t('wreck.scene.shifted', {
          name: st.names?.[sh.by] || '?',
          from: t('wreck.' + (sh.from === 'B' ? 'british' : 'france')),
          to: t('wreck.' + (sh.to === 'B' ? 'british' : 'france'))
        })
      : sh.kind === 'kick'
      ? t('wreck.scene.kicked', {
          name: st.names?.[sh.by] || '?',
          who: st.names?.[sh.who] || '?'
        })
      /* ไม่มีสาขาไหนตรงเลย = มีชนิดใหม่ที่ลืมเขียนข้อความ
         ปล่อยให้ไหลไปใช้ข้อความของสาขาสุดท้ายคือต้นตอของบั๊กที่เพิ่งเจอ
         ขึ้นเป็นค่าว่างดีกว่า จะได้เห็นทันทีว่าลืม ไม่ใช่ขึ้นผิดเรื่องแบบเนียน ๆ */
      : '';
    body.innerHTML = `<p class="wr-scene-note">${esc(msg)}</p>`;
  }
  if (now() - stageAt < T.linger) return true;
  dismissed.add('shout:' + st.shout.at);
  closing = true;
  return false;
}

/* ── การ์ดที่เพิ่งเปิด แล้วต่อด้วยช่วงเลือกเป้า ────────────
   เป็นฉากเดียวยาว ๆ ไม่ตัดใหม่ตอนเปลี่ยนช่วง
   ของเดิมแยกเป็นสองฉาก ปิดอันหนึ่งแล้วเปิดอีกอัน จอเลยวูบสว่างคั่นกลาง
   และหัวเรื่องเล่นแอนิเมชันซ้ำสองรอบ

   ช่วงแรก  การ์ดใหญ่กลางจอ พื้นมืด ให้อ่านว่าเป็นใบอะไร
   ช่วงสอง  การ์ดย่อไปเกาะมุมบนขวา พื้นสว่างคืน เหลือข้อความบรรทัดเดียว
            เพราะช่วงนี้ต้องมองกระดานแล้วคลิก จอมืดจะขัดกับสิ่งที่ขอให้ทำ */
const CARD_READ = 2600;   // เวลาอ่านการ์ดก่อนย่อไปมุม

function cardNote(body, st, ctx) {
  const id = st.cardUp?.id || st.pending?.card;
  if (!id) return false;

  if (goto('collect')) {
    const c = cardById(id);
    const info = c ? (c[lang] || c.th) : null;

    /* ของประกอบฉากเฉพาะใบ — วางไว้ริมซ้ายขวา เต็มความสูงของเวที
       อยู่นอกกล่องการ์ด เพราะกล่องนั้นจะย่อไปมุมตอนมีขั้นถัดไป
       ถ้าอยู่ข้างในจะหดตามไปด้วยจนหายไปเลย */
    const fx = CARD_FX[id];
    const sideFx = !fx ? '' : fx.map((name, i) => `<img class="wr-cardfx wr-cardfx-${i ? 'r' : 'l'}"
      src="${esc(FX + name + CARD_EXT)}" alt="" draggable="false"
      data-alt="${esc(FX + name + CARD_ALT)}"
      onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt='';}else{this.remove();}">`).join('');

    body.innerHTML = sideFx + `<div class="wr-cardup">
        <img class="wr-cardup-img" src="${esc(cardArt(id))}" alt=""
          draggable="false" onerror="this.remove()">
        <span class="wr-cardup-name">${esc(info?.name || id)}</span>
        <span class="wr-cardup-desc">${esc(info?.desc || '')}</span>
      </div>`;
  }

  const ms = now() - stageAt;
  /* ย่อไปมุมเฉพาะการ์ดที่ต้องให้เลือกเป้า เพราะต้องเปิดกระดานให้คลิก
     การ์ดที่ผลเกิดทันทีไม่ต้องย่อ ขึ้นกลางจอให้อ่านแล้วปิดไปเลย
     ย่อไปมุมทั้งที่ไม่มีอะไรให้ทำต่อ มีแต่ทำให้ดูเหมือนเกมยังรออะไรอยู่ */
  /* ย้ายไปมุมเมื่อยังมีอะไรให้เล่าต่อ — รอเลือกเป้า หรือมีผลที่ต้องเล่าเป็นลำดับ
     การ์ดที่จบในตัวเองไม่ต้องย้าย ขึ้นกลางจอให้อ่านแล้วปิดไปเลย */
  const seq = st.shout?.kind === 'bells' && !dismissed.has('shout:' + st.shout.at);
  const parked = (!!st.pending || seq) && ms > CARD_READ;

  /* ย่อไปมุม — ต้องเล่นเป็นการเคลื่อนที่จริง ไม่ใช่กระโดด

     ปัญหาคือการเปลี่ยนจากอยู่ในแถวปกติไปเป็นวางลอยมุมจอ
     เป็นการเปลี่ยน position กับ top/right ซึ่งเบราว์เซอร์ทำให้ทันทีเสมอ
     transition ไม่จับ ตาจึงเห็นเป็นการวาร์ป

     วิธีแก้: วัดตำแหน่งก่อนย้าย ย้าย แล้ววัดอีกที
     จากนั้นสั่งให้มันกระโดดกลับไปจุดเดิมด้วย transform โดยไม่มี transition
     พอเฟรมถัดไปค่อยถอด transform ออกพร้อม transition มันจะไหลจากที่เดิมไปที่ใหม่ */
  if (parked && !body.classList.contains('parked')) {
    const a = body.getBoundingClientRect();
    body.classList.add('parked');
    const b = body.getBoundingClientRect();

    const dx = a.left - b.left;
    const dy = a.top - b.top;
    const sc = b.width ? a.width / b.width : 1;

    body.style.transition = 'none';
    body.style.transform = `translate(${dx}px, ${dy}px) scale(${sc})`;
    body.style.transformOrigin = 'top left';

    requestAnimationFrame(() => {
      body.style.transition = '';
      body.style.transform = '';
    });
  }

  /* ข้อความอยู่นอกกล่องการ์ด ไม่งั้นพอการ์ดย่อไปมุม ข้อความจะตามไปด้วย
     ตำแหน่งของมันอิงกับเวทีทั้งผืน จึงค้างอยู่ระหว่างเกาะกับเรือสินค้าได้ */
  const line = body.parentElement.querySelector('.wr-scene-line');
  const stage = body.parentElement.querySelector('.wr-scene-stage');
  const mineNow = st.pending?.by === ctx.me.uid;

  /* ขั้นที่ต้องเลือกไพ่หลายใบจากกอง — คนเปิดได้แผงเลือกไพ่
     คนอื่นได้ข้อความรอเฉย ๆ ไม่เห็นว่ากองมีอะไรบ้าง */
  if (stage) {
    /* หน้าต่างเลือกไพ่ขึ้นเฉพาะตอน **มีกองไพ่ถูกส่งมาให้จริง** (รังกา)
       ของเดิมดูแค่ว่าขั้นนี้เลือกหลายใบไหม ซึ่งจริงกับการเลือกช่องการ์ดด้วย
       หน้าต่างเลือกไพ่จึงโผล่มาว่างเปล่าตอนบังคับให้คนอื่นเปิด ซึ่งชวนงงมาก */
    const hasPool = mineNow && (ctx.secret?.pool || []).length > 0;
    if (hasPool) poolPanel(stage, st, ctx);
    else if (mineNow && isChoice(st.pending.card)) choicePanel(stage, st, ctx);
    else if (!seq) { stage.hidden = true; stage.dataset.pool = ''; }
  }

  if (line) {
    const want = !st.pending ? ''
      : mineNow
        ? ((ctx.secret?.pool || []).length ? '' : t(askKey(st.pending.card, st.pending.needs)))
        : (st.pending.needs === 'slots'
            ? t('wreck.scene.forcing', { name: st.names?.[st.pending.by] || '?',
                                         who: st.names?.[st.pending.picks?.player] || '?' })
          : st.pending.needs === 'cards' ? t('wreck.scene.crowWait')
                : t('wreck.scene.pickTargetThem', { name: st.names?.[st.pending.by] || '?' }));
    if (line.textContent !== want) line.textContent = want;
    line.hidden = !want || !parked;
  }

  /* มีผลที่ต้องเล่าเป็นลำดับ — เล่าต่อจนจบแล้วค่อยปิดทั้งคู่พร้อมกัน */
  if (seq) {
    const stage = body.parentElement.querySelector('.wr-scene-stage');
    const done = bellsStage(stage, st, ms - CARD_READ);
    if (!done) return true;
    dismissed.add('shout:' + st.shout.at);
    dismissed.add('card:' + st.cardUp.at);
    closing = true;
    return false;
  }

  /* ยังต้องเลือกอยู่ = ค้างไว้ ไม่นับถอยหลัง
     ไม่มีอะไรให้เลือกแล้ว = ขึ้นให้อ่านครบเวลาแล้วปิด */
  if (st.pending) return !parked;
  /* การ์ดที่ผลเกิดทันที ตัวการ์ดคือทั้งเรื่องแล้ว ไม่ต้องค้างนานเท่าผลโหวต
     ค้างนานไปกลายเป็นช่วงที่ไม่มีอะไรเกิดขึ้นแล้วรอเฉย ๆ */
  if (ms < CARD_READ + T.after) return true;
  dismissed.add('card:' + st.cardUp.at);
  closing = true;
  return false;
}

/* ── ถามว่าจะใช้การ์ดกัน Maroon ไหม ───────────────────────
   คนที่ถูกถามเห็นการ์ดใหญ่กลางจอพร้อมปุ่มสองปุ่ม
   คนอื่นเห็นแค่ข้อความบอกว่ากำลังรออยู่ ตำแหน่งเดียวกับตอนเลือกเป้า */
function saveNote(body, st, ctx) {
  const mine = st.saveAsk.who === ctx.me.uid;
  const want = 'save:' + (mine ? 'me' : 'them');
  if (aimView === want) return false;
  aimView = want;

  if (!mine) {
    body.innerHTML = `<p class="wr-scene-note">${esc(t('wreck.scene.saveWait', {
      name: st.names?.[st.saveAsk.who] || '?' }))}</p>`;
    return false;
  }

  const id = st.saveAsk.card;
  const c = cardById(id);
  const info = c ? (c[lang] || c.th) : null;
  body.innerHTML = `<div class="wr-cardup">
      <img class="wr-cardup-img" src="${esc(cardArt(id))}" alt=""
        draggable="false" onerror="this.remove()">
      <span class="wr-cardup-name">${esc(info?.name || id)}</span>
      <span class="wr-cardup-desc">${esc(t('wreck.scene.saveAsk'))}</span>
    </div>
    <div class="wr-scene-btns">
      <button class="wr-scene-btn wr-save-yes" data-save="1">${esc(t('wreck.scene.saveYes'))}</button>
      <button class="wr-scene-btn wr-save-no" data-save="0">${esc(t('wreck.scene.saveNo'))}</button>
    </div>`;
  body.querySelectorAll('[data-save]').forEach(b => {
    b.onclick = () => sendFn?.('useSave', { yes: b.dataset.save === '1' });
  });
  return false;
}

/* ── ผลที่เล่าเป็นลำดับ — โปรไฟล์โผล่ทีละคน ────────────────
   ใช้กับระฆังแปดครั้ง ที่ผลคือลำดับใหม่ของทุกคนในที่นั้น
   ต้องเล่าให้จบก่อนกระดานขยับ ไม่งั้นเห็นผลก่อนเรื่อง */
const BELL_LEAD = 500;    // เว้นก่อนคนแรกโผล่
const BELL_STEP = 620;    // ระยะห่างของแต่ละคน
const BELL_HOLD = 1400;   // ค้างหลังคนสุดท้าย

function bellsStage(stage, st, ms) {
  if (!stage) return true;
  const order = st.shout.order || [];

  if (stage.dataset.sig !== st.shout.at + '') {
    stage.dataset.sig = st.shout.at + '';
    stage.hidden = false;
    stage.innerHTML = `<p class="wr-bells-head">${esc(t('wreck.scene.bells'))}</p>
      <div class="wr-bells-row">${
        order.map((uid, i) => `<span class="wr-bell" data-i="${i}">
            <span class="wr-bell-no">${i + 1}</span>
            <span class="wr-bell-face">${esc((st.names?.[uid] || '?').slice(0, 2))}</span>
            <span class="wr-bell-name">${esc(st.names?.[uid] || '?')}</span>
          </span>`).join('')
      }</div>`;
  }

  const shown = Math.floor((ms - BELL_LEAD) / BELL_STEP) + 1;
  stage.querySelectorAll('.wr-bell').forEach((el, i) => el.classList.toggle('in', i < shown));

  return ms > BELL_LEAD + order.length * BELL_STEP + BELL_HOLD;
}

/* ── แผงเลือกไพ่จากกอง (รังกา) ─────────────────────────────
   คลิกเลือก คลิกซ้ำเอาออก ครบตามจำนวนแล้วปุ่มยืนยันถึงจะกดได้
   กองมาจากข้อมูลลับของคนเปิด ซึ่งมีแต่เจ้าของห้องเป็นคนคำนวณให้
   คนอื่นไม่มีทางเห็นว่ากองมีอะไร เพราะข้อมูลไม่เคยถูกส่งไปหาเขา */
let poolPick = [];
let poolKey = '';

function poolPanel(stage, st, ctx) {
  const need = pickCountOf(st.pending.card, st.pending.needs);
  const pool = ctx.secret?.pool || [];
  const key = st.pending.at + ':' + pool.length;
  if (poolKey !== key) { poolKey = key; poolPick = []; }

  const sig = key + '|' + poolPick.join(',');
  if (stage.dataset.pool === sig) return;
  stage.dataset.pool = sig;
  stage.hidden = false;

  /* หน้าต่างลอยเต็มจอ ไม่ใช่กล่องในกระดาน
     กระดานตั้ง overflow:hidden ไว้ ถ้าวางไว้ข้างในแผงจะถูกตัดที่ขอบ
     ปุ่มยืนยันอยู่ใต้เส้นตัดพอดีจนกดไม่ได้ */
  stage.innerHTML = `<div class="wr-pool">
      <div class="wr-pool-box">
        <p class="wr-pool-head">${esc(t('wreck.scene.crowPick', {
          n: need, left: need - poolPick.length }))}</p>
        <div class="wr-pool-grid">${
          pool.map(id => `<button class="wr-pool-card${poolPick.includes(id) ? ' on' : ''}"
            data-pool="${esc(id)}">${voteCard(voteById(id), lang)}</button>`).join('')
        }</div>
        <button class="wr-scene-btn wr-pool-go"${poolPick.length === need ? '' : ' disabled'}>
          ${esc(t('wreck.plan.confirm'))}</button>
      </div>
    </div>`;

  stage.querySelectorAll('[data-pool]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.pool;
      poolPick = poolPick.includes(id)
        ? poolPick.filter(c => c !== id)
        : (poolPick.length < need ? [...poolPick, id] : poolPick);
      poolPanel(stage, st, ctx);
    };
  });
  const go = stage.querySelector('.wr-pool-go');
  if (go) go.onclick = () => { if (!go.disabled) sendFn?.('useCard', { cards: [...poolPick] }); };
}

/* ── ฉากสับไพ่ประเทศ ────────────────────────────────────────
   ไพ่สองใบเลื่อนเข้ามาจากคนละทาง สลับที่กันเร็ว ๆ แล้วเลื่อนออกคนละทาง
   เป็นการหลอกตาล้วน ผลจริงถูกตัดสินไปแล้วตั้งแต่ตอนกดยืนยัน

   คนที่เกี่ยวข้องเห็นประเทศของตัวเองตอนจบ · คนอื่นเห็นแค่ว่าสองคนนี้อาจเปลี่ยนข้างแล้ว */
const FV = { in: 700, mix: 1500, rest: 400, out: 600, tell: 2600 };
const FV_TOTAL = FV.in + FV.mix + FV.rest + FV.out;

function feverNote(body, st, ctx) {
  const sh = st.shout;
  const me = ctx.me?.uid;
  const mine = me === sh.by || me === sh.who;

  if (goto('collect')) {
    body.innerHTML = `<div class="wr-fever">
        <div class="wr-fever-cards">
          ${['l', 'r'].map(side => `<img class="wr-fever-card fv-${side}"
            src="${esc(BRAWL_BACK)}" alt="" draggable="false"
            data-alt="${esc(BRAWL_BACK_ALT)}"
            onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt='';}else{this.remove();}">`).join('')}
        </div>
        <p class="wr-fever-line"></p>
      </div>`;
  }

  const ms = now() - stageAt;
  const box = body.querySelector('.wr-fever-cards');
  if (box) {
    box.classList.toggle('in', ms > 40);
    box.classList.toggle('mixing', ms > FV.in && ms < FV.in + FV.mix);
    box.classList.toggle('out', ms > FV.in + FV.mix + FV.rest);
  }

  /* เฉลยหลังไพ่เลื่อนออกไปแล้ว */
  const line = body.querySelector('.wr-fever-line');
  if (line && ms > FV_TOTAL) {
    const want = mine
      ? `${t('wreck.scene.feverMine')} ${t('wreck.nation.' + (ctx.secret?.nation || 'D') + '.tag')}`
      : t('wreck.scene.feverThem', {
          a: st.names?.[sh.by] || '?', b: st.names?.[sh.who] || '?' });
    if (line.textContent !== want) {
      line.textContent = want;
      line.className = 'wr-fever-line show' + (mine ? ' n-' + (ctx.secret?.nation || 'D') : '');
    }
  }

  if (ms < FV_TOTAL + FV.tell) return true;
  dismissed.add('shout:' + sh.at);
  closing = true;
  return false;
}

/* ── รอคนที่ถูกบังคับกดเปิด ────────────────────────────────
   ไม่มีนับถอยหลัง ค้างจนกว่าเขาจะเปิดจริง
   จอไม่มืด เพราะคนที่ถูกบังคับต้องมองเห็นการ์ดของตัวเองเพื่อกด */
function forcedNote(body, st, ctx) {
  const mine = st.forced.who === ctx.me.uid;
  const want = 'forced:' + (mine ? 'me' : 'them');
  if (aimView === want) return false;
  aimView = want;

  body.innerHTML = `<p class="wr-scene-note">${esc(mine
    ? t('wreck.scene.forcedMe')
    : t('wreck.scene.forcedThem', { who: st.names?.[st.forced.who] || '?' }))}</p>`;
  return false;
}

/* ── แผงปุ่มตัวเลือก ───────────────────────────────────────
   ใช้กับขั้นที่คำตอบไม่ใช่ของบนกระดาน เช่นเลือกทิศทางย้ายกล่อง
   ตัวเลือกที่กติกาไม่อนุญาตจะขึ้นแบบทึบ ไม่ใช่หายไป
   เพราะการเห็นว่า "มีทางนี้อยู่แต่ตอนนี้ใช้ไม่ได้" บอกสถานะกระดานให้ด้วย */
function choicePanel(stage, st, ctx) {
  const step = st.pending.needs;
  const okList = targetsOf(st, ctx.me.uid, st.pending.card, step, st.pending.picks || {});
  /* ตัวเลือกทั้งหมดของขั้นนี้ — บางขั้นเป็นสองฝั่งประเทศ บางขั้นเป็นชนิดโหวต
     ใบที่มีตัวเลือกตายตัวสองอันใช้ B/F ส่วนใบอื่นเอารายชื่อจากกติกามาเลย */
  const all = step === 'side' || step === 'dir' ? ['B', 'F'] : okList;
  /* ข้อความบนปุ่มต่างกันตามขั้น — ย้ายกล่องบอกทิศทาง ส่วนโยนของบอกแค่ชื่อประเทศ */
  const label = (k) => t(step === 'side' ? 'wreck.pick.side.' + k : 'wreck.pick.' + k);

  const sig = st.pending.at + '|' + okList.join(',');
  if (stage.dataset.pool === sig) return;
  stage.dataset.pool = sig;
  stage.hidden = false;

  stage.innerHTML = `<div class="wr-choice">
      <p class="wr-choice-head">${esc(t(askKey(st.pending.card, step)))}</p>
      <div class="wr-choice-row">${
        all.map(k => `<button class="wr-choice-btn n-${k}" data-pick="${k}"
          ${okList.includes(k) ? '' : 'disabled title="' + esc(t('wreck.pick.none')) + '"'}>
            ${esc(label(k))}
          </button>`).join('')
      }</div>
    </div>`;

  stage.querySelectorAll('[data-pick]').forEach(b => {
    b.onclick = () => { if (!b.disabled) sendFn?.('useCard', { target: b.dataset.pick }); };
  });
}

/* ── ขั้นถามที่ไม่มีการ์ดประกอบ ────────────────────────────
   ใช้กับ Action ที่ต้องเลือกหลายขั้นอย่างการบังคับให้คนอื่นเปิด
   ไม่มีรูปการ์ดให้โชว์ จึงเหลือแค่บรรทัดสั่งกับแผงเลือก (ถ้ามี)
   จอไม่มืด เพราะคนเลือกต้องมองเห็นกระดานกับการ์ดเพื่อกด */
function askNote(body, st, ctx) {
  const mine = st.pending.by === ctx.me.uid;
  const step = st.pending.needs;
  const stage = body.parentElement.querySelector('.wr-scene-stage');

  if (stage) { stage.hidden = true; stage.dataset.pool = ''; }

  const want = 'ask:' + (mine ? 'me' : 'them') + ':' + step;
  if (aimView === want) return false;
  aimView = want;

  body.innerHTML = `<p class="wr-scene-note">${esc(mine
    ? t(askKey(st.pending.card, step))
    : t('wreck.scene.forcing', { name: st.names?.[st.pending.by] || '?',
                                 who: st.names?.[st.pending.picks?.player] || '?' }))}</p>`;
  return false;
}

/* ── วงยิงแข่งสองลำ ────────────────────────────────────────
   สองคอลัมน์ซ้ายขวา มีเส้นคั่นกลาง ฝั่งละแถวไพ่
   รอครบทั้งสองฝั่งแล้วค่อยเปิดพร้อมกัน แล้วสรุปว่าใครชนะ

   ระบบนี้แยกจากฉากโหวตปกติทั้งชุด ยืมมาแค่ภาพไพ่ */
const DUEL_READ = 3400;

function duelSideBack(ship, side, names) {
  /* หลังไพ่เป็นรูป ไม่ใช่ข้อความ — VOTE_BACK เป็น path ต้องใส่ในแท็กรูปเอง
     ยังไม่ส่งไพ่ = จาง · ส่งแล้ว = ชัด จะได้เห็นว่ารอใครอยู่ */
  const cards = side.crew.map(u => `<span class="wr-vb${side.done.includes(u) ? ' in' : ' wait'}">
      <img src="${esc(VOTE_BACK)}" alt="" draggable="false">
      <span class="wr-vb-name">${esc(names?.[u] || '?')}</span>
    </span>`).join('');

  /* ฝั่งนี้ส่งครบแล้ว = ไพ่จากกองกลางเลื่อนเข้ามาสมทบ
     ซ้ายเลื่อนมาจากซ้าย ขวาเลื่อนมาจากขวา ให้รู้สึกว่ามาจากนอกวง */
  const full = !side.empty && side.done.length === side.crew.length;
  const extra = full ? `<span class="wr-vb wr-vb-deck from-${ship === 'shipL' ? 'l' : 'r'}">
      <img src="${esc(VOTE_BACK)}" alt="" draggable="false">
      <span class="wr-vb-name">${esc(t('wreck.scene.fromDeck'))}</span>
    </span>` : '';

  return `<div class="wr-duel-side">
      <p class="wr-duel-head">${esc(t('wreck.place.' + ship))}</p>
      <div class="wr-duel-cards">${side.empty
        ? `<p class="wr-duel-empty">${esc(t('wreck.duel.empty'))}</p>` : cards + extra}</div>
    </div>`;
}

function duelCollect(body, st, ctx) {
  goto('collect');
  const d = st.duel;
  const sig = 'duel:' + SHIP_IDS.map(x => d.sides[x].done.length).join('.');
  if (body.dataset.duel === sig) return true;
  body.dataset.duel = sig;

  body.innerHTML = `<div class="wr-duel">
      ${duelSideBack('shipL', d.sides.shipL, st.names)}
      <div class="wr-duel-line"></div>
      ${duelSideBack('shipR', d.sides.shipR, st.names)}
    </div>
    <p class="wr-scene-note">${esc(t('wreck.duel.wait'))}</p>`;
  return true;
}

function duelResult(body, st, ctx) {
  const r = st.lastDuel;

  /* ต้องเริ่มจับเวลาใหม่ตรงนี้ ไม่งั้นนาฬิกายังเป็นของฉากก่อนหน้า
     ซึ่งเดินไปไกลแล้ว ฉากผลจะถือว่าอ่านจบทันทีแล้วปิดตัวเองโดยไม่มีใครเห็น */
  goto('collect');
  const ms = now() - stageAt;

  if (body.dataset.duel !== 'end:' + r.at) {
    body.dataset.duel = 'end:' + r.at;
    const side = (ship) => {
      const one = r.sides[ship];
      const cards = one.pot.map(id => `<span class="wr-vb">
          ${voteCard(voteById(id), lang)}
        </span>`).join('');
      return `<div class="wr-duel-side">
          <p class="wr-duel-head ${one.hit ? 'hit' : 'miss'}">${esc(t('wreck.place.' + ship))}</p>
          <div class="wr-duel-cards">${cards}</div>
          <p class="wr-duel-verdict ${one.hit ? 'hit' : 'miss'}">${
            esc(t(one.empty ? 'wreck.duel.none' : one.hit ? 'wreck.duel.hit' : 'wreck.duel.miss'))}</p>
        </div>`;
    };
    body.innerHTML = `<div class="wr-duel">
        ${side('shipL')}<div class="wr-duel-line"></div>${side('shipR')}
      </div>
      <p class="wr-duel-sum">${esc(r.won === 'tie'
        ? t('wreck.duel.tie')
        : t('wreck.duel.won', { place: t('wreck.place.' + r.won) }))}</p>`;
  }

  if (ms < DUEL_READ) return true;

  /* เล่าลำดับที่ถูกส่งลงเกาะทีละคน — ใช้แผงเดียวกับระฆังแปดครั้ง
     เพราะเป็นเรื่องเดียวกันคือ "ลำดับใหม่ที่สุ่มมา" ไม่ต้องเขียนของใหม่ */
  const order = r.order || [];
  if (order.length) {
    const stage = body.parentElement.querySelector('.wr-scene-stage');
    const done = marchStage(stage, st, order, ms - DUEL_READ);
    if (!done) return true;
  }

  told.add('duel:' + r.at);
  closing = true;
  return false;
}

/* แผงไล่โปรไฟล์ทีละคน — ใช้ซ้ำได้ทั้งระฆังแปดครั้งและวงยิงแข่ง
   ต่างกันแค่หัวข้อ ตัวกลไกเหมือนกันทุกอย่าง */
function marchStage(stage, st, order, ms, headKey = 'wreck.duel.march') {
  if (!stage) return true;

  const sig = 'march:' + order.join(',');
  if (stage.dataset.sig !== sig) {
    stage.dataset.sig = sig;
    stage.hidden = false;
    stage.innerHTML = `<p class="wr-bells-head">${esc(t(headKey))}</p>
      <div class="wr-bells-row">${
        order.map((uid, i) => `<span class="wr-bell" data-i="${i}">
            <span class="wr-bell-no">${i + 1}</span>
            <span class="wr-bell-face">${esc((st.names?.[uid] || '?').slice(0, 2))}</span>
            <span class="wr-bell-name">${esc(st.names?.[uid] || '?')}</span>
          </span>`).join('')
      }</div>`;
  }

  const shown = Math.floor((ms - BELL_LEAD) / BELL_STEP) + 1;
  stage.querySelectorAll('.wr-bell').forEach((el, i) => el.classList.toggle('in', i < shown));

  return ms > BELL_LEAD + order.length * BELL_STEP + BELL_HOLD;
}

/* ── ถามลูกเรือว่าลำนี้คืนกล่องฝั่งไหน ─────────────────────
   ถามสองคนพร้อมกันได้ ลำละคน ซึ่งเป็นจังหวะแรกในเกมที่ทำแบบนี้
   คนที่ถูกถามเห็นปุ่มเลือก คนอื่นเห็นว่ารอใครอยู่ */
function spoilNote(body, st, ctx) {
  const sp = st.spoils;
  const me = ctx.me?.uid;
  const mine = SHIP_IDS.find(s => sp.asks[s] === me && sp.need.includes(s) && !sp.picked[s]);

  const sig = 'spoils:' + sp.at + '|' + (mine || '-') + '|' + Object.keys(sp.picked).join(',');
  if (body.dataset.spoil === sig) return true;
  body.dataset.spoil = sig;

  if (!mine) {
    const left = sp.need.filter(s => !sp.picked[s])
      .map(s => st.names?.[sp.asks[s]] || '?').join(', ');
    body.innerHTML = `<p class="wr-scene-note">${esc(
      left ? t('wreck.scene.waiting', { who: left }) : t('wreck.spoil.wait'))}</p>`;
    return true;
  }

  body.innerHTML = `<div class="wr-choice">
      <p class="wr-choice-head">${esc(t('wreck.spoil.ask'))} · ${esc(t('wreck.place.' + mine))}</p>
      <div class="wr-choice-row">${['B', 'F'].map(k =>
        `<button class="wr-choice-btn n-${k}" data-spoil="${k}">${
          esc(t('wreck.pick.side.' + k))}</button>`).join('')}</div>
    </div>`;

  body.querySelectorAll('[data-spoil]').forEach(b => {
    b.onclick = () => sendFn?.('spoilPick', { side: b.dataset.spoil });
  });
  return true;
}

/* ── กัปตันลำที่ชนะเลือกกล่องที่จะชิง ──────────────────────
   ถามทีละใบ สองขั้นต่อใบ — จากฝั่งไหน แล้วไปฝั่งไหน
   ฝั่งที่เลือกไม่ได้ขึ้นทึบ ไม่ใช่หายไป */
function grabNote(body, st, ctx) {
  const g = st.grab;
  const mine = g.who === ctx.me?.uid;

  const sig = 'grab:' + g.at + '.' + g.left + '.' + g.step + (mine ? ':me' : '');
  if (body.dataset.grab === sig) return true;
  body.dataset.grab = sig;

  if (!mine) {
    body.innerHTML = `<p class="wr-scene-note">${esc(t('wreck.grab.wait', {
      name: st.names?.[g.who] || '?', n: g.left }))}</p>`;
    return true;
  }

  const okList = g.step === 'from' ? grabFrom(st.cargo, g.from) : grabTo(st.cargo, g.ship);
  body.innerHTML = `<div class="wr-choice">
      <p class="wr-choice-head">${esc(t('wreck.grab.' + g.step, { n: g.left }))}</p>
      <div class="wr-choice-row">${['B', 'F'].map(k =>
        `<button class="wr-choice-btn n-${k}" data-grab="${k}"
          ${okList.includes(k) ? '' : 'disabled'}>${esc(t('wreck.pick.side.' + k))}</button>`
      ).join('')}</div>
    </div>`;

  body.querySelectorAll('[data-grab]').forEach(b => {
    b.onclick = () => { if (!b.disabled) sendFn?.('grabPick', { side: b.dataset.grab }); };
  });
  return true;
}

function titleOf(st, ph, me) {
  if (st.grab && key.startsWith('grab:')) {
    return { who: t('wreck.card.wreckers'), big: t('wreck.grab.title') };
  }
  if (st.spoils && key.startsWith('spoils:')) {
    return { who: t('wreck.card.wreckers'), big: t('wreck.spoil.title') };
  }
  if (key.startsWith('duel')) {
    return { who: t('wreck.card.' + (st.duel?.card || st.lastDuel?.card || 'vegan')),
             big: t('wreck.duel.title') };
  }
  if (st.pending && key.startsWith('ask:')) {
    return { who: t('wreck.act.force'), big: st.names?.[st.pending.by] || '?' };
  }
  if (st.forced && key.startsWith('forced:')) {
    return { who: t('wreck.act.force'), big: st.names?.[st.forced.who] || '?' };
  }
  if (st.saveAsk && key.startsWith('save:')) {
    return { who: t('wreck.card.' + st.saveAsk.card), big: st.names?.[st.saveAsk.who] || '?' };
  }
  if (key.startsWith('card:')) {
    return { who: t('wreck.scene.cardUp'), big: st.names?.[st.cardUp.by] || '?' };
  }
  if (st.shout && key.startsWith('shout:')) {
    if (st.shout.kind === 'birds') {
      return { who: t('wreck.card.albatross'), big: t('wreck.scene.birdsBig') };
    }
    /* หัวข้อต้องตรงกับเรื่องที่ประกาศ ของเดิมตกไปเป็น "กัปตัน" ทุกกรณีที่ไม่ใช่ย้ายกล่อง
       การใช้การ์ดกันหรือการยกแผนที่จึงขึ้นหัวว่ากัปตัน ซึ่งไม่เกี่ยวอะไรเลย */
    const HEAD = {
      shift:   'wreck.act.shiftCargo',
      kick:    'wreck.role.captain',
      shot:    'wreck.card.pistol',
      marque:  'wreck.card.marque',
      saved:   'wreck.card.' + (st.shout.card || 'fountain'),
      atlantis: 'wreck.card.atlantis',
      powder:   'wreck.card.blackpowder',
      crow:     'wreck.card.crowsnest',
      gaveMap: 'wreck.card.' + (st.shout.card || 'fountain'),
      /* ใบที่เพิ่มทีหลัง — ถ้าลืมใส่ตรงนี้ หัวข้อจะตกไปเป็นคำว่า EVENT ลอย ๆ */
      scurvy:  'wreck.card.scurvy',
      fever:   'wreck.card.cabinfever',
      storm:   'wreck.card.stormyseas',
      hookMiss: 'wreck.card.grapple',
      rat:     'wreck.card.bilgerat',
      fizzle:  'wreck.event',
      toss:    'wreck.card.jettison',
      hold:    'wreck.card.holdmutiny',
      spoils:  'wreck.card.wreckers',
      grabbed: 'wreck.card.wreckers',
      deal:    'wreck.card.contract',
      reliefMiss: 'wreck.card.relief',
      skip:    'wreck.card.scurvy',
      wreck:   'wreck.card.shipwreck',
      calm:    'wreck.card.doldrums',
      aground: 'wreck.card.aground',
      agroundIsle: 'wreck.card.aground',
      vegan:   'wreck.card.vegan',
      flag:    'wreck.card.blackflag',
      siren:   'wreck.card.anthemoessa'
    };
    /* ประกาศบางชนิดไม่มี "คนทำ" เช่นการถูกข้ามตา ซึ่งเป็นผลของการ์ดที่เปิดไปแล้ว
       ถ้าใช้ชื่อคนทำจะได้เครื่องหมายคำถาม ต้องใช้ชื่อคนที่ได้รับผลแทน */
    const sh = st.shout;
    const big = sh.kind === 'skip'
      ? (sh.who || []).map(u => st.names?.[u] || '?').join(', ')
      : (st.names?.[sh.by] || '?');
    return { who: t(HEAD[sh.kind] || 'wreck.event'), big };
  }
  if (st.lastPeek && key.startsWith('peek:'))
    return { who: t('wreck.act.peek'), big: st.names?.[st.lastPeek.by] || '?' };
  const v = st.vote || st.lastVote;
  const aiming = !!st.aim || ph === 'aim';
  const who = st.aim ? st.aim.by : v?.caller;
  const role = aiming ? 'captain'
    : v?.kind === 'mutiny' ? 'mate'
    : v?.kind === 'islandVote' ? 'governor' : 'captain';
  /* เฉพาะคนที่ต้องเลือกเท่านั้นที่เห็นเป็นคำสั่ง คนอื่นเห็นชื่อฉากตามปกติ */
  const choosing = aiming && ph === 'aim' && st.aim && !st.aim.target && st.aim.by === me;
  const line = choosing ? 'wreck.scene.pickShipBig'
    : aiming ? 'wreck.scene.aim'
    : v?.kind === 'mutiny' ? 'wreck.scene.mutiny'
    : v?.kind === 'islandVote' ? 'wreck.scene.brawl' : 'wreck.scene.shoot';
  return { who: `${t('wreck.role.' + role)} \u00b7 ${st.names?.[who] || '?'}`, big: t(line) };
}

/* ── รอไพ่ ─────────────────────────────────────────────── */
/* ถามเจ้าของเอลโดราโดว่าจะใช้ไหม — อยู่ในฉากโหวตเดียวกัน ไม่แยกฉากใหม่
   คนอื่นไม่เห็นว่ามีการถาม เพราะการตัดสินใจนี้เป็นความลับจนกว่าจะส่งไพ่ */
function doradoBox(st, ctx) {
  const v = st.vote;
  const me = ctx.me.uid;
  if (!v || !v.voters.includes(me) || v.done.includes(me)) return '';
  if ((v.asked || []).includes(me)) return '';
  if (!(ctx.secret?.held || []).includes('eldorado')) return '';

  return `<div class="wr-dorado">
      <img class="wr-dorado-img" src="${esc(cardArt('eldorado'))}" alt=""
        draggable="false" onerror="this.remove()">
      <span class="wr-dorado-ask">${esc(t('wreck.scene.doradoAsk'))}</span>
      <div class="wr-scene-btns">
        <button class="wr-scene-btn wr-save-yes" data-dorado="1">${esc(t('wreck.scene.saveYes'))}</button>
        <button class="wr-scene-btn wr-save-no" data-dorado="0">${esc(t('wreck.scene.saveNo'))}</button>
      </div>
    </div>`;
}

/* คนที่ห้ามโหวตรอบนี้เพราะใช้เอลโดราโดไปรอบก่อน — บอกทั้งวงให้รู้ */
function banLine(st) {
  const v = st.vote;
  if (!v) return '';
  const here = occupants(st.pos, v.place)
    .filter(u => (st.voteBan?.[u] || 0) > 0 && !v.voters.includes(u));
  if (!here.length) return '';
  return `<p class="wr-scene-note wr-ban-note">${esc(t('wreck.scene.voteBanned', {
    who: here.map(u => st.names?.[u] || '?').join(', ') }))}</p>`;
}

function collect(body, st) {
  if (goto('collect') || !body.querySelector('.wr-vb-row')) {
    body.innerHTML = `<div class="wr-vb-row wiggle"></div><p class="wr-scene-note"></p>`;
  }
  const row = body.querySelector('.wr-vb-row');
  voterList = st.vote.voters;

  /* วางไพ่ตาม **จำนวนใบที่ส่งไปแล้ว** ไม่ใช่ตามว่าใครส่งเสร็จแล้ว
     เอลโดราโดส่งได้สองใบ ถ้ารอให้ส่งเสร็จค่อยวาง ไพ่จะโผล่พรวดสองใบทีเดียว
     และใบที่สองจะไม่มีชื่อกำกับเพราะโค้ดเดิมวางได้คนละหนึ่งใบเท่านั้น */
  const sent = st.vote.sent || {};
  for (const uid of st.vote.voters) {
    const now = sent[uid] ?? (st.vote.done.includes(uid) ? 1 : 0);
    const have = seen[uid] || 0;
    for (let i = have; i < now; i++) row.appendChild(voteBack(st.names?.[uid] || '?'));
    if (now > have) seen[uid] = now;
  }

  const left = st.vote.voters.filter(u => !st.vote.done.includes(u));
  const note = body.querySelector('.wr-scene-note');
  const text = left.length
    ? t('wreck.scene.waiting', { who: left.map(u => st.names?.[u] || '?').join(', ') })
    : t('wreck.scene.allIn');
  if (note.textContent !== text) note.textContent = text;

  /* กล่องถามเอลโดราโด กับบรรทัดบอกคนที่โดนห้ามโหวต
     ทั้งคู่อยู่ในฉากโหวตเดียวกัน ไม่แยกฉากใหม่ตามที่ตกลงกันไว้ */
  const extraHtml = doradoBox(st, sceneCtx) + banLine(st);
  let extra = body.querySelector('.wr-vote-extra');
  if (!extra) {
    extra = document.createElement('div');
    extra.className = 'wr-vote-extra';
    body.appendChild(extra);
  }
  if (extra.dataset.sig !== extraHtml) {
    extra.dataset.sig = extraHtml;
    extra.innerHTML = extraHtml;
    extra.querySelectorAll('[data-dorado]').forEach(b => {
      b.onclick = () => sendFn?.('useDorado', { yes: b.dataset.dorado === '1' });
    });
  }
  return false;    // รอคนกด ไม่ต้องขอเฟรมถี่ ๆ
}

let namesRef = {};
const nameOf = (uid) => namesRef[uid] || '?';

/* วัดระยะห่างจริงระหว่างใบแล้วบอกให้ CSS ใช้รวมกอง
   ต้องวัดใหม่ทุกครั้งที่จำนวนใบเปลี่ยน ไม่งั้นพอเติมใบจากกองเข้ามา
   ค่าที่ใช้จะเป็นของตอนที่ยังไม่มีใบนั้น กองเลยไปกระจุกผิดที่ ไม่ตรงกลางแถว */
/* คำนวณระยะที่แต่ละใบต้องเลื่อนเพื่อไปกองซ้อนกันกลางแถวพอดี
   ใช้ offsetLeft ไม่ใช่ getBoundingClientRect เพราะอันหลังรวมผลของ transform ด้วย
   ตอนวัดไพ่ยังเล่นแอนิเมชันเข้าอยู่ ค่าที่ได้เลยเพี้ยน กองจึงเบี้ยวไปเบี้ยวมา

   คิดทีละใบจากตำแหน่งจริงของตัวเอง ไม่ใช่คูณระยะห่างเฉลี่ย
   ต่อให้ใบกว้างไม่เท่ากันหรือช่องไฟไม่สม่ำเสมอ ทุกใบก็ยังไปซ้อนกันที่จุดเดียว */
function measure(row) {
  const kids = [...row.children];
  if (kids.length < 2) return;
  const mid = row.offsetWidth / 2;
  kids.forEach(c => {
    const own = c.offsetLeft + c.offsetWidth / 2;
    c.style.setProperty('--dx', Math.round(mid - own) + 'px');
  });
}

function voteBack(name) {
  const c = document.createElement('span');
  c.className = 'wr-vb';
  c.innerHTML = `<img src="${esc(VOTE_BACK)}" alt="" draggable="false">` +
    (name ? `<span class="wr-vb-name">${esc(name)}</span>` : '');
  return c;
}

/* ── เปิดผล ────────────────────────────────────────────
   ไม่ล้างไพ่ที่มีอยู่ — เติมใบจากกองกลางต่อท้าย แล้วค่อยรวมกันหุบหาย */
function pot(body, v) {
  const cards = v.pot || [];

  if (goto('pot')) {
    let row = body.querySelector('.wr-vb-row');
    if (!row) {
      /* เข้ามากลางคัน ไม่ทันเห็นช่วงรอไพ่ ก็สร้างไพ่ทั้งกองขึ้นมาเลย */
      body.innerHTML = `<div class="wr-vb-row"></div><p class="wr-scene-note"></p>`;
      row = body.querySelector('.wr-vb-row');
      cards.slice(0, -1).forEach(() => row.appendChild(voteBack('')));
    }

    /* คนที่ส่งไพ่เป็นคนสุดท้ายไม่เคยโผล่ในช่วงรอไพ่เลย
       เพราะพอเขาส่ง เกมเปิดหม้อทันทีในจังหวะเดียวกัน หน้าจอจึงไม่เคยเห็นรายชื่อที่มีเขา
       ต้องไล่เติมให้ครบตามจำนวนไพ่ในหม้อก่อน เว้นที่ไว้ให้ใบจากกองอีกหนึ่ง */
    /* เติมไพ่ที่ยังไม่ได้วาง ให้ครบตามจำนวนจริงของแต่ละคน พร้อมชื่อ

       ไพ่ใบสุดท้ายปิดหม้อทันทีในการเขียนครั้งเดียว หน้าจอคนอื่นจึงไม่เคยเห็น
       สถานะระหว่างทาง ต้องสร้างย้อนหลังจากจำนวนที่ผลส่งมาให้
       ของเดิมเติมได้คนละหนึ่งใบและไม่ใส่ชื่อ ใบที่สองของเอลโดราโดเลยโล้นและเตี้ยกว่าเพื่อน */
    const sent = v.sent || {};
    for (const uid of Object.keys(sent)) {
      const have = seen[uid] || 0;
      for (let i = have; i < sent[uid]; i++) {
        if (row.children.length >= cards.length - 1 - (v.heard || 0)) break;
        row.appendChild(voteBack(nameOf(uid)));
      }
      seen[uid] = Math.max(have, sent[uid]);
    }
    while (row.children.length < cards.length - 1 - (v.heard || 0)) row.appendChild(voteBack(''));
    row.classList.remove('wiggle');
    measure(row);

    const note = body.querySelector('.wr-scene-note');
    if (note) note.textContent = t('wreck.scene.shuffling');
  }

  const ms = now() - stageAt;
  const row = body.querySelector('.wr-vb-row');
  if (!row) return false;

  /* ใบจากกองเด้งเข้ามาหลังไพ่ของทุกคนลงครบแล้วพักหนึ่ง
     ถ้ามาพร้อมกันจะดูเหมือนไพ่โผล่พรวดเดียวทั้งกอง แยกไม่ออกว่าใบไหนมาจากไหน
     ติดป้ายไว้ด้วย เพราะจำนวนสัญลักษณ์ที่ออกมาไม่เท่ากับจำนวนไพ่ (ใบเปล่าไม่มีสัญลักษณ์) */
  if (ms > T.deckWait && !row.querySelector('.from-deck')) {
    /* ไพ่จากกองกลาง — ใบแรกคือใบมาตรฐาน ที่เกินมาคือของกระซิบ
       ต้องแยกชื่อให้เห็น ไม่งั้นคนดูจะไม่รู้ว่าไพ่เกินมาจากไหน */
    const heard = v.heard || 0;
    const extra = voteBack(t('wreck.scene.fromDeck'));
    extra.classList.add('from-deck');
    row.appendChild(extra);

    /* ใบที่เกินมาจากกระซิบ — ชื่อของตัวเอง จะได้รู้ว่าไพ่เกินมาจากไหน */
    for (let i = 0; i < heard; i++) {
      const w = voteBack(t('wreck.scene.whisper'));
      w.classList.add('from-deck', 'from-whisper');
      row.appendChild(w);
    }
    measure(row);
  }

  row.classList.toggle('merge', ms > T.deckWait + T.deckCard);
  row.classList.toggle('gone', ms > T.deckWait + T.deckCard + T.merge);
  return ms < T.deckWait + T.deckCard + T.merge + T.vanish;
}

function tally(body, v) {
  if (!v) return false;
  if (goto('tally') || !body.querySelector('.wr-tallies')) {
    stageAt = stageAt || now();
    body.innerHTML = `<div class="wr-tallies"></div>`;
    const wrap = body.querySelector('.wr-tallies');
    for (const sym of rowsOf(v.kind)) {
      const n = v.counts?.[sym.ch] || 0;
      if (!n) continue;
      const row = document.createElement('div');
      row.className = 'wr-tally';
      row.dataset.ch = sym.ch;
      row.innerHTML = `<span class="wr-tally-pips">${
        Array.from({ length: n }, () =>
          `<img class="wr-pip" src="${esc(VOTE_ART)}${sym.file}${ICON_EXT}" alt="" draggable="false">`
        ).join('')}</span>`;
      wrap.appendChild(row);
    }
  }

  const ms = now() - stageAt;
  const step = Math.floor((ms - T.lead) / T.tick);
  let before = 0, total = 0;

  for (const sym of rowsOf(v.kind)) {
    const n = v.counts?.[sym.ch] || 0;
    total += n;
    if (!n) continue;
    const row = body.querySelector(`.wr-tally[data-ch="${sym.ch}"]`);
    if (!row) continue;
    const vis = Math.max(0, Math.min(n, step - before));
    before += n;
    row.classList.toggle('on', vis > 0);
    row.querySelectorAll('.wr-pip').forEach((p, i) => p.classList.toggle('in', i < vis));
  }

  const endAt = T.lead + total * T.tick + T.verdict;
  if (ms > endAt && !body.querySelector('.wr-scene-verdict')) {
    const p = document.createElement('p');
    p.className = 'wr-scene-verdict ' + (v.won ? 'win' : 'fail');
    p.textContent = verdictText(v);
    body.appendChild(p);
  }
  /* ค้างต่ออีกพักหลังไอคอนครบ ไม่งั้นไอคอนขึ้นแล้วฉากวิ่งต่อทันทีจนดูไม่ทัน */
  return ms <= endAt + T.afterIcons;
}

/* ── กัปตันเลือก ───────────────────────────────────────── */
/* คำตัดสินต้องพูดเรื่องของการโหวตชนิดนั้น
   ยิงปืนบอกว่าเข้าหรือพลาด · ก่อกบฏบอกว่ากัปตันอยู่หรือไป · แบ่งกล่องบอกว่าแบ่งได้เท่าไหร่ */
function verdictText(v) {
  if (v.kind === 'mutiny') return t(v.won ? 'wreck.scene.mutinyWin' : 'wreck.scene.mutinyFail');
  if (v.kind === 'islandVote') {
    return t('wreck.scene.brawlDone', { B: v.split?.B ?? '-', F: v.split?.F ?? '-' });
  }
  return t(v.won ? 'wreck.scene.hit' : 'wreck.scene.miss');
}

function aim(body, st, ctx) {
  const a = st.aim;
  const mine = a.by === ctx.me.uid;
  const want = !mine ? 'wait'
    : !a.target ? 'pick'
    : (a.target !== 'merchant' && !a.from) ? 'take'
    : 'side';
  const sig = want + ':' + (a.target || '') + ':' + (a.from || '');
  if (aimView === sig) return false;
  aimView = sig;

  if (want === 'wait') {
    body.innerHTML = `<p class="wr-scene-note">${esc(t('wreck.scene.waitAim', {
      name: st.names?.[st.aim.by] || '?' }))}</p>`;
  } else if (want === 'pick') {
    body.innerHTML = `<p class="wr-scene-note">${esc(t('wreck.scene.pickShip'))}</p>`;
  } else if (want === 'take') {
    /* ขั้นขโมย — โทนแดง ชี้ไปที่เรือศัตรู บอกจำนวนกล่องที่มีในแต่ละฝั่ง
       ต้องหน้าตาต่างจากขั้นเก็บให้ชัด เพราะสองขั้นนี้ถามคล้ายกันมาก
       ถ้าเหมือนกันจะกดผิดแน่นอน */
    const can = takeSides(st.cargo, a.target);
    body.innerHTML = sidePick('take', 'wreck.scene.takeFrom',
      t('wreck.place.' + a.target), st.cargo[a.target], can, 'takeFrom',
      arrowTo(a.place, a.target));
    wireSides(body, 'takeFrom');
  } else {
    /* ขั้นเก็บ — โทนเขียว ชี้ไปที่เรือตัวเอง บอกว่าฝั่งไหนเต็มแล้ว */
    const can = keepSides(st.cargo, a.place);
    body.innerHTML = sidePick('keep', 'wreck.scene.keepOn',
      t('wreck.place.' + a.place), st.cargo[a.place], can, 'storeAt',
      arrowTo(a.target, a.place));
    wireSides(body, 'storeAt');
  }
  return false;
}

/* แผงเลือกฝั่งประเทศ ใช้ทั้งขั้นขโมยและขั้นเก็บ แต่แต่งคนละโทน
   ฝั่งที่เลือกไม่ได้เป็นปุ่มทึบกดไม่ลง พร้อมบอกเหตุผลด้วยจำนวนกล่อง */
/* ลูกศรชี้ทิศจริงจากที่หนึ่งไปอีกที่หนึ่ง
   ของเดิมฝังลูกศรค่าเดียวไว้ในซีเอสเอส ยิงจากเรือขวาเลยชี้ผิดทางทุกครั้ง */
const AT = { shipL: -1, shipR: 1, merchant: 0, island: 0 };
function arrowTo(from, to) {
  const d = (AT[to] ?? 0) - (AT[from] ?? 0);
  if (d < 0) return '\u2190';
  if (d > 0) return '\u2192';
  return '\u2193';
}

function sidePick(kind, headKey, where, box, can, action, arrow) {
  const btn = (s) => {
    const n = box?.[s] || 0;
    const off = !can.includes(s);
    const why = kind === 'take' ? (n ? '' : t('wreck.scene.noBox'))
                                : (off ? t('wreck.scene.full') : '');
    return `<button class="wr-side-btn n-${s}${off ? ' off' : ''}"
      data-side="${s}" data-act="${action}"${off ? ' disabled' : ''}>
        <span class="wr-side-name">${esc(t('wreck.' + (s === 'B' ? 'british' : 'france')))}</span>
        <span class="wr-side-n">${n} / ${SHIP_CARGO_CAP}</span>
        ${why ? `<span class="wr-side-why">${esc(why)}</span>` : ''}
      </button>`;
  };
  return `<div class="wr-sidepick wr-sidepick-${kind}">
      <p class="wr-side-head"><span class="wr-side-arrow">${esc(arrow || '')}</span>
        ${esc(t(headKey, { where }))}</p>
      <div class="wr-side-btns">${btn('B')}${btn('F')}</div>
    </div>`;
}

function wireSides(body, action) {
  body.querySelectorAll('[data-side]').forEach(b => {
    if (b.disabled) return;
    b.onclick = () => sendFn?.(action, { side: b.dataset.side });
  });
}

/* ยังต้องมีให้ ui.js เรียกได้ แม้ตอนนี้จะไม่ได้ใช้แผนในฉากแล้ว */
/* ฉากเล่าถึงช่วงให้กัปตันเลือกเรือแล้วหรือยัง — กระดานถามก่อนเปิดไฮไลท์ */
export const sceneAtAim = () => phase === 'aim';

/* กระดานต้องค้างไว้ระหว่างที่ฉากกำลังเล่าผล
   ผลของการโหวตถูกคำนวณและเขียนลงสถานะทันทีที่ไพ่ครบ กัปตันจึงโดนปลดไปแล้ว
   ตั้งแต่ก่อนที่ฉากจะได้เล่าอะไรเลย ถ้าไม่ค้างไว้ ทุกคนจะเห็นผลจากตำแหน่งบนกระดาน
   ก่อนที่เรื่องจะเล่าถึง ซึ่งทำให้ฉากไม่มีความหมาย */
/* ค้างจนกว่าผลของการโหวตครั้งนั้นจะถูกเล่าจบแล้วจริง ๆ

   ต้องตัดสินจาก **สถานะ** ไม่ใช่จากตัวแปรภายในของฉาก
   เพราะกระดานถูกวาดก่อนที่ฉากจะได้ทำงานในเฟรมเดียวกัน
   ถ้าถามตัวแปรภายใน คำตอบจะยังเป็นค่าของเฟรมที่แล้วเสมอ
   กระดานเลยแอบขยับไปหนึ่งเฟรมก่อนฉากจะเริ่มเล่า */
/* ค้างกระดานไว้ระหว่างเล่าผล — ทั้งผลโหวตและเหตุการณ์ที่ทำให้คนย้ายที่
   นกโจมตีก็ต้องค้าง เพราะต้องประกาศก่อนแล้วค่อยเห็นคนถูก Maroon */
export const sceneHolding = (st) =>
  (!!st?.lastVote && !told.has(st.lastVote.at))
  || (!!st?.shout?.beforePos && !dismissed.has('shout:' + st.shout.at))
  || (!!st?.cardUp?.beforePos && !dismissed.has('card:' + st.cardUp.at));

/* ผังที่ควรวาดระหว่างเล่าฉาก — ตัวเหตุการณ์พามาเอง
   แม่นกว่าให้หน้าจอเก็บภาพไว้เอง เพราะบางทีมีสองอย่างเกิดในการเขียนครั้งเดียว
   (เช่นขึ้นฝั่งจากเรือเล็กแล้วนกครบพร้อมกัน) ภาพที่เก็บไว้จะเก่าไปหนึ่งจังหวะ */
export function scenePos(st) {
  if (st?.shout?.beforePos && !dismissed.has('shout:' + st.shout.at)) return st.shout.beforePos;
  if (st?.cardUp?.beforePos && !dismissed.has('card:' + st.cardUp.at)) return st.cardUp.beforePos;
  return null;
}

/* ฉากปิดแล้วต้องบอกให้กระดานวาดใหม่ทันที

   กระดานวาดตอนสถานะเปลี่ยนเท่านั้น แต่สถานะเปลี่ยนไปตั้งแต่ก่อนฉากเริ่มแล้ว
   พอฉากปิดจึงไม่มีอะไรมากระตุ้น หมากค้างอยู่จนกว่าจะมีคำสั่งถัดไป
   หรือสัญญาณชีพรอบถัดไปซึ่งเต้นทุก 20 วินาที
   นั่นคือเวลาที่รู้สึกว่านาน ไม่ใช่ตัวฉากเอง */
let onClose = null;
export const setSceneClose = (fn) => { onClose = fn; };

export const setPlanView = () => {};
export const setPlanWire = () => {};
