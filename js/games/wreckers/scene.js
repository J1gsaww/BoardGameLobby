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
import { takeSides, keepSides, SHIP_CARGO_CAP, occupants } from './rules.js';
import { askKey } from './effects.js';
import { BASE_CARDS, cardArt, eventArt, eventAlt } from './events.js';
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
  /* ค้างรอคำตอบว่าจะใช้การ์ดกันไหม ต้องมาก่อนประกาศผลเสมอ
     เพราะตอนนี้ผลยังไม่เกิด คนที่ถูกถามอาจรอดก็ได้ */
  if (st.saveAsk) return `save:${st.saveAsk.at}`;
  if (st.shout && !dismissed.has('shout:' + st.shout.at)) return `shout:${st.shout.at}`;
  /* ช่วงรอให้คนเปิดเลือกเป้า — ค้างไว้จนกว่าจะเลือกเสร็จ ไม่มีนับถอยหลัง
     ทุกคนต้องรู้ว่ากำลังอยู่ในช่วงนี้ ไม่ใช่แค่คนที่ต้องเลือก */
  if (st.pending) return `card:${st.pending.at}`;
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
      <p class="wr-scene-line" hidden></p>`;
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
  if (key.startsWith('peek:')) return peekNote(body, st);
  if (key.startsWith('shout:')) return shoutNote(body, st);
  if (key.startsWith('card:')) return cardNote(body, st, ctx);
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

  if (goto('collect')) {
    const msg = sh.kind === 'atlantis'
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
      : t('wreck.scene.kicked', {
          name: st.names?.[sh.by] || '?',
          who: st.names?.[sh.who] || '?'
        });
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
    body.innerHTML = `<div class="wr-cardup">
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
  const parked = !!st.pending && ms > CARD_READ;

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
  if (line) {
    const want = !st.pending ? ''
      : st.pending.by === ctx.me.uid
        ? t(askKey(st.pending.card, st.pending.needs))
        : t('wreck.scene.pickTargetThem', { name: st.names?.[st.pending.by] || '?' });
    if (line.textContent !== want) line.textContent = want;
    line.hidden = !want || !parked;
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

function titleOf(st, ph, me) {
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
      gaveMap: 'wreck.card.' + (st.shout.card || 'fountain')
    };
    return {
      who: t(HEAD[st.shout.kind] || 'wreck.event'),
      big: st.names?.[st.shout.by] || '?'
    };
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
    /* เข้ามาไม่ทันเห็นบางใบ ก็เติมให้ครบตามจำนวนไพ่ในหม้อ */
    for (const uid of voterList) {
      if (row.children.length >= cards.length - 1) break;
      const have = seen[uid] || 0;
      if (have) continue;
      seen[uid] = 1;
      row.appendChild(voteBack(nameOf(uid)));
    }
    while (row.children.length < cards.length - 1) row.appendChild(voteBack(''));
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
    const extra = voteBack(t('wreck.scene.fromDeck'));
    extra.classList.add('from-deck');
    row.appendChild(extra);
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
