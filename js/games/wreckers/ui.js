/* ui.js — กระดาน Wreckers
   ─────────────────────────────────────────────────────────────
   ทุกอย่างวางด้วยเปอร์เซ็นต์บนเวทีที่ล็อกอัตราส่วนไว้
   ย่อขยายหน้าต่างแล้วทุกชิ้นขยับตามกันหมด ไม่มีอะไรหลุดตำแหน่ง

   สำคัญ: สร้าง element ของชิ้นส่วนครั้งเดียวแล้วเก็บไว้ตลอด
   ห้องอัปเดตทุก 5 วินาทีจากสัญญาณชีพ ถ้าเขียนทับทั้งก้อนทุกครั้ง
   แอนิเมชันโคลงเรือจะเริ่มนับหนึ่งใหม่ตลอดจนดูเหมือนเรือดีดกลับ
   และรูปประจำตัวก็จะกะพริบเพราะถูกโหลดใหม่

   ทุกรอบจึงอัปเดตแค่สามอย่าง — หมากในช่อง กล่องสมบัติ และข้อความ
   ───────────────────────────────────────────────────────────── */

import { t } from '../../i18n.js';
import { face as avatarFace } from '../../avatar.js';
import { mountSea, stopSea } from './sea.js';
import { cardById as voteById, voteCard, iconSrc } from './vote.js';
import { dieSvg, rollPose, HERO, ROLL_MS } from './die.js';
import { actionsFor, occupants, placeOf, BOAT_IDS, canVoteNow, anytimeCards } from './rules.js';
import { targetsOf, canUseCard, askKey } from './effects.js';
import { BASE_CARDS, cardArt, cardArtAlt, CARD_BACK, CARD_BACK_ALT,
         tokenArt, tokenAlt } from './events.js';
import { paintScene, stopScene, setPlanView, setPlanWire, VOTE_BACK,
         sceneAtAim, sceneHolding, scenePos, setSceneClose } from './scene.js';
import { EXTRA_CARDS } from './cards.js';
import { lang } from '../../i18n.js';
import {
  ART, PIECES, STAGE_RATIO, SHIP_SLOTS, ISLAND_SLOTS, BOAT_SLOT, roleOf, EVENT_SLOTS,
  COMMON_ACTIONS, ROLE_ACTIONS, canShiftCargo, boatsFrom, boatFree, canTouchCargo,
  SHIP_SLOT_SIZE, ISLAND_SLOT_SIZE,
  SHIP_CARGO, SHIP_CARGO_SIZE, ISLAND_CARGO, ISLAND_CARGO_SIZE,
  SHIP_FLAGS, ISLAND_FLAGS, FLAG_SIZE,
  MERCHANT_CARGO, MERCHANT_CARGO_SIZE
} from './board.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* ความแรงกับจังหวะการโคลง — เรือเล็กโคลงแรงกว่าเพราะตัวเล็ก
   หน่วงเวลาต่างกันทีละลำ ไม่งั้นจะโคลงพร้อมกันทั้งกระดานเหมือนของเล่นไขลาน */
const BOB = { ship: [1, 4], merchant: [1.3, 3.5], boat: [2.6, 2.6], island: [0, 0] };

/* สถานะเฉพาะหน้าจอ ไม่ต้องขึ้นเซิร์ฟเวอร์เพราะเป็นการเลือกที่ยังไม่ยืนยัน */
let menu = null;        // { kind, uid, spot, place, x, y }
let picks = [];         // การ์ดเหตุการณ์ที่เลือกไว้ สูงสุด 2 ใบ
let forcing = null;     // uid ของคนที่กำลังจะบังคับให้เปิดการ์ด
let plan = null;        // ตัวเลือกที่ยังไม่ยืนยัน เช่นจะยิงลำไหน เก็บฝั่งไหน

/* เครื่องมือทดสอบเปิดด้วย ?dev=cards ท้าย URL เท่านั้น
   ไม่มีสวิตช์ในหน้าจอ จะได้ไม่มีทางเผลอเปิดตอนเล่นจริง */
const DEV_CARDS = new URLSearchParams(location.search).get('dev')
  ?.split(',').map(v => v.trim()).includes('cards') || false;

const closeMenu = () => { menu = null; };

const slotsOf = (kind) =>
  kind === 'ship'   ? SHIP_SLOTS.map(s => ({ ...s, size: SHIP_SLOT_SIZE })) :
  kind === 'island' ? ISLAND_SLOTS.map(s => ({ ...s, size: ISLAND_SLOT_SIZE })) :
  kind === 'boat'   ? [{ id: 'x', ...BOAT_SLOT }] : [];

/* ── สร้างโครงครั้งเดียว ───────────────────────────────────── */

function shell(el, ctx) {
  if (el.querySelector('.wr-stage')) return;

  el.innerHTML = `
    <div class="wr">
      <div class="wr-bar">
        <span class="wr-title">${esc(t('wreck.board'))}</span>
        <span class="wr-hint"></span>
      </div>

      <div class="wr-grid">
        <aside class="wr-side wr-hand">
          <div class="wr-nation"></div>
          <h4>${esc(t('wreck.yourHand'))}</h4>
          <div class="wr-hand-cards"></div>
        </aside>

        <div class="wr-stage" style="aspect-ratio:${STAGE_RATIO}">
          <div class="wr-pieces">${PIECES.map(pieceShell).join('')}</div>
          <div class="wr-score-bar"></div>
          <div class="wr-menu" hidden></div>
          <div class="wr-dice" hidden></div>
          <div class="wr-scene" hidden></div>
          <div class="wr-loading" hidden></div>
        </div>

        <aside class="wr-side wr-roster">
          <h4>${esc(t('wreck.players'))}</h4>
          <ul class="wr-list"></ul>
        </aside>
      </div>

      <div class="wr-bottom">
        <div class="wr-events">
          <h4>${esc(t('wreck.events'))}</h4>
          <div class="wr-event-row">
            ${Array.from({ length: EVENT_SLOTS }, (_, i) =>
              `<div class="wr-event-slot" data-event="${i + 1}">
                 <button class="wr-card wr-event"></button>
                 <div class="wr-event-acts">
                   <button class="wr-mini" data-ev="activate">${esc(t('wreck.act.activate'))}</button>
                   <button class="wr-mini" data-ev="peek">${esc(t('wreck.act.peek'))}</button>
                 <button class="wr-mini wr-mini-dev" data-ev="pick" hidden>\u26a0 ${esc(t('wreck.dev.pick'))}</button>
                 </div>
               </div>`).join('')}
          </div>
          <div class="wr-event-open" hidden></div>
          <p class="wr-event-note" hidden></p>
          <div class="wr-devbar-top" hidden></div>
          <div class="wr-decks"></div>
        </div>

        <div class="wr-actions">
          <h4>${esc(t('wreck.actions'))}</h4>
          <div class="wr-act-group" data-group="common"></div>
          <div class="wr-act-group" data-group="role"></div>
          <div class="wr-plan" hidden></div>
          <div class="wr-vote-panel" hidden></div>
        </div>
      </div>

      <ul class="wr-log" hidden></ul>

      <div class="wr-devpop" hidden></div>
      <div class="wr-reveal" hidden></div>
      <div class="wr-legend"></div>
    </div>`;

  mountSea(el.querySelector('.wr-stage'), ART);

  // ผูกปุ่มครั้งเดียวด้วยการดักที่ตัวแม่ ปุ่มข้างในจึงไม่ต้องผูกใหม่ทุกรอบ
  el.querySelector('.wr-pieces').addEventListener('click', e => {
    const box = e.target.closest('[data-cargo]');
    if (box) {
      /* คลิกกล่อง = เลือกกล่องนั้นเป็นกล่องที่จะย้าย แล้วรอยืนยัน
         เก็บฝั่งของกล่องไว้ใน plan.from เลย จะได้ไม่ต้องเลือกทิศซ้ำอีกรอบ */
      const [, side] = String(box.dataset.cargo).split(':');
      plan = { act: 'shiftCargo', from: side === 'f' ? 'F' : 'B',
               box: box.dataset.cargo, via: 'menu' };
      openMenu(el, box, { kind: 'cargo', cargo: box.dataset.cargo });
      paint(el);
      return;
    }

    const b = e.target.closest('[data-spot]');
    if (!b) { if (!plan) closeMenu(); paint(el); return; }

    if (b.dataset.who) {
      /* กำลังเลือกเป้าของการ์ดอยู่ = คลิกใครก็คือเลือกคนนั้น ไม่ใช่เปิดเมนูปกติ */
      const now = live?.state;
      const meUid = live?.me?.uid;
      const pn = now?.pending?.by === meUid ? now.pending : null;
      if (pn?.needs === 'player'
          && targetsOf(now, meUid, pn.card, pn.needs, pn.picks || {}).includes(b.dataset.who)) {
        plan = { act: 'useCard', target: b.dataset.who, via: 'menu' };
        openMenu(el, b, { kind: 'aim' });
        paint(el);
        return;
      }
      openMenu(el, b, { kind: 'pawn', uid: b.dataset.who, spot: b.dataset.spot });
      return;
    }
    /* คลิกที่นั่งว่างของเรือเล็ก = ขอลงเรือลำนั้น ถ้ากติกาอนุญาต
       ที่นั่งอื่นบนกระดานยังย้ายเองไม่ได้ ต้องผ่านเรือเล็กหรือโดนไล่เท่านั้น */
    /* ใช้สถานะล่าสุดจาก live เพราะตัวจัดการนี้ผูกครั้งเดียวตอนสร้างโครง
       ค่า st กับ ctx ตอนนั้นจะเก่าค้างอยู่ตลอด ต้องอ่านสด ๆ ทุกครั้งที่คลิก */
    const now = live?.state;
    const meUid = live?.me?.uid;
    const boat = String(b.dataset.spot || '').split(':')[0];
    if (now && meUid && BOAT_IDS.includes(boat)
        && actionsFor(now, meUid).includes('toBoat')
        && boatsFrom(now.pos?.[meUid]).includes(boat)) {
      plan = { act: 'toBoat', boat, via: 'menu' };
      openMenu(el, b, { kind: 'aim' });
      paint(el);
      return;
    }
    if (!plan) closeMenu();
    paint(el);
  });

  el.querySelector('.wr-stage').addEventListener('click', e => {
    if (plan) return;                          /* กำลังรอยืนยันอยู่ อย่าเพิ่งปิดเมนู */
    if (!e.target.closest('.wr-menu') && !e.target.closest('[data-spot]')
        && !e.target.closest('[data-cargo]')) { closeMenu(); paint(el); }
  });
  el.querySelector('.wr-legend').addEventListener('click', e => {
    if (e.target.closest('[data-act="leave"]')) ctx.leave();
  });

  el.querySelector('.wr-event-row').addEventListener('click', e => {
    const mini = e.target.closest('[data-ev]');
    if (mini && !mini.disabled) {
      /* ปุ่มอยู่ในช่องของมันเอง จึงอ่านเลขช่องจากตรงนั้นตรง ๆ
         แม่นกว่าอ้อมผ่านรายการที่เลือกไว้ และไม่มีทางส่งผิดใบ */
      const i = Number(mini.closest('.wr-event-slot').dataset.event) - 1;
      if (mini.dataset.ev === 'pick') { devOpen = true; devFind = ''; picks = [String(i + 1)]; paint(el); return; }
      ctx.send(mini.dataset.ev, { slot: i });
      picks = []; forcing = null; paint(el);
      return;
    }

    const slot = e.target.closest('.wr-event-slot');
    if (!slot) return;
    const n = slot.dataset.event;
    picks = picks.includes(n) ? picks.filter(x => x !== n)
          : picks.length >= 2 ? [picks[1], n] : [...picks, n];
    paint(el);
  });
}

function pieceShell(p, i) {
  const [amp, dur] = BOB[p.kind] || BOB.ship;
  const bob = amp
    ? `--bob:${amp}; animation-duration:${dur}s; animation-delay:-${(i * 1.3).toFixed(1)}s`
    : '';

  const slots = slotsOf(p.kind).map(s => `
    <button class="wr-slot" data-spot="${p.id}:${s.id}"
      style="left:${s.x}%; top:${s.y}%; width:${s.size}%" disabled></button>`).join('');

  return `<div class="wr-piece wr-${p.kind}" data-piece="${p.id}"
      style="left:${p.x}%; top:${p.y}%; width:${p.w}%; --rot:${p.rot || 0}deg; ${bob}">
    <img class="wr-art" src="${ART}${p.art}.png" alt="" draggable="false">
    <div class="wr-cargo"></div>
    ${slots}
  </div>`;
}

/* ── อัปเดตเฉพาะสิ่งที่เปลี่ยน ─────────────────────────────── */

let live = null;                  // ctx ล่าสุด ใช้ตอนวาดซ้ำจากการกดปุ่มในเมนู
const paint = (el) => { if (live) render(el, live); };

/* ── โหลดภาพให้ครบก่อนเริ่มเล่น ────────────────────────────
   หลายอาการที่ดูเหมือนบั๊ก (ผลวาบเดียว ไพ่ไม่ขึ้น ของวางผิดที่)
   จริง ๆ คือภาพยังโหลดไม่เสร็จตอนที่แอนิเมชันเริ่มไปแล้ว
   เบราว์เซอร์คำนวณขนาดจากภาพที่ยังไม่มา จึงได้ผังผิดชั่วขณะ

   โหลดครบก่อนค่อยปล่อยให้เห็นกระดาน ตัดปัญหาทั้งกลุ่มทีเดียว
   ถ้าโหลดไม่ขึ้นก็ปล่อยผ่านหลังจากรอถึงเพดาน ไม่ปล่อยให้ค้างตลอดกาล */
const WAIT_CAP = 8000;
let assetsReady = false;
let assetJob = null;
let assetDone = 0;
let assetTotal = 0;

function assetList() {
  const board = ['Carrack', 'Island', 'Cargo_ship', 'Rowboat', 'Cargo'].map(n => `${ART}${n}.png`);
  /* ธงบนกระดานใช้ไฟล์เดียวกับไอคอนโหวต จึงถูกนับอยู่ในชุดไอคอนแล้ว */
  const icons = ['C', 'F', 'W', 'B', 'R', 'A', 'D'].map(iconSrc).filter(Boolean);
  return [...board, ...icons, VOTE_BACK, CARD_BACK];
}

function preload(el) {
  if (assetJob) return;
  const urls = [...new Set(assetList())];
  assetTotal = urls.length;
  assetDone = 0;

  /* ดาวน์โหลดเสร็จยังไม่พอ ต้องถอดรหัสภาพเสร็จด้วยถึงจะวาดได้ทันทีโดยไม่กระตุก
     decode() รอจนถึงจุดนั้นจริง ๆ ส่วน onload บอกแค่ว่าไฟล์มาถึงแล้ว
     นี่คือเหตุผลที่แถบโหลดเต็มแล้วภาพยังทยอยโผล่ */
  const one = (u) => new Promise(res => {
    const im = new Image();
    const done = () => { assetDone++; paint(el); res(); };
    im.onerror = done;
    im.onload = () => (im.decode ? im.decode().then(done, done) : done());
    im.src = u;
  });

  assetJob = Promise.race([
    Promise.all(urls.map(one)),
    new Promise(res => setTimeout(res, WAIT_CAP))
  ]).then(() => { assetsReady = true; paint(el); });
}

/* ภาพกระดานที่ค้างไว้ระหว่างฉากเล่าผล
   เก็บสำเนาไว้ทุกครั้งที่ยังไม่มีฉากผล พอฉากเริ่มเล่าก็เอาสำเนานั้นมาวาดแทน
   ปล่อยกลับเป็นสถานะจริงเมื่อฉากเล่าจบ */
let frozen = null;

function boardView(st) {
  /* ตัวเหตุการณ์บอกมาเองว่าควรวาดผังไหน ใช้อันนั้นก่อนเสมอ */
  const told = scenePos(st);
  if (told) return { ...st, pos: told, cargo: frozen?.cargo ?? st.cargo };

  if (sceneHolding(st) && frozen) return { ...st, pos: frozen.pos, cargo: frozen.cargo };
  frozen = { pos: st.pos, cargo: st.cargo };
  return st;
}

function paintLoading(el) {
  const box = el.querySelector('.wr-loading');
  if (!box) return;
  box.hidden = assetsReady;
  if (assetsReady) return;
  const pct = assetTotal ? Math.round(assetDone * 100 / assetTotal) : 0;
  const html = `<div class="wr-loading-box">
      <span class="wr-loading-label">${esc(t('wreck.loading'))}</span>
      <span class="wr-loading-bar"><i style="width:${pct}%"></i></span>
      <span class="wr-loading-n">${assetDone} / ${assetTotal}</span>
    </div>`;
  if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
}

export function render(el, ctx) {
  const st = ctx.state;
  if (!st || !st.phase) { el.innerHTML = ''; stopSea(); stopScene(); closeMenu(); return; }

  live = ctx;
  shell(el, ctx);
  preload(el);
  paintLoading(el);

  /* ระหว่างที่ฉากกำลังเล่าผล กระดานต้องค้างอยู่ที่ภาพก่อนผลออก
     เกมคำนวณผลแล้วเขียนลงสถานะทันทีที่ไพ่ครบ กัปตันจึงย้ายที่ไปแล้วตั้งแต่ก่อนฉากเริ่มเล่า
     เราจึงเก็บภาพกระดานไว้ตอนที่ยังไม่มีฉากผล แล้วเอามาวาดแทนจนกว่าจะเล่าจบ */
  const view = boardView(st);

  /* ทุกอย่างที่เป็น "ภาพบนกระดาน" ต้องอ่านจาก view ไม่ใช่ st
     ที่ผ่านมาแก้ครบทุกที่ยกเว้นวงวางหมาก ซึ่งเป็นที่ที่เห็นการเปลี่ยนแปลงชัดที่สุด
     กัปตันโดนปลดแล้วย้ายที่ทันทีตั้งแต่ก่อนฉากเริ่มเล่า */
  /* เป้าที่การ์ดใบที่ค้างอยู่เลือกได้ ใช้รายชื่อชุดเดียวกับฝั่งเซิร์ฟเวอร์
     หน้าจอกับกติกาจึงตัดสินตรงกันเสมอ ไม่มีทางไฮไลท์คนที่กดแล้วโดนปฏิเสธ */
  /* เป้าของขั้นที่กำลังถามอยู่ — อาจเป็นคนหรือเรือ แล้วแต่การ์ด
     จดหมายถามสองขั้น เลือกคนก่อนแล้วค่อยเลือกเรือ ใช้ตัวเดียวกันทั้งสองขั้น */
  const pend = st.pending?.by === ctx.me.uid ? st.pending : null;
  const pickStep = pend?.needs || null;
  const pickable = pend
    ? targetsOf(st, ctx.me.uid, pend.card, pickStep, pend.picks || {}) : [];
  const cardTargets = pickStep === 'player' ? pickable : [];
  const shipTargets = pickStep === 'ship' ? pickable : [];

  const who = Object.fromEntries(Object.entries(view.pos || {}).map(([uid, spot]) => [spot, uid]));
  const mine = view.pos?.[ctx.me.uid] || null;
  const canMove = (st.seats || []).includes(ctx.me.uid);

  const hint = el.querySelector('.wr-hint');
  hint.textContent = !canMove ? t('wreck.watchingOnly')
    : st.phase === 'over' ? t('wreck.over.done')
    : st.vote ? t('wreck.vote.open')
    : st.turn === ctx.me.uid ? t('wreck.yourTurn')
    : t('wreck.waitFor', { name: st.names?.[st.turn] || '?' });
  hint.classList.toggle('mine', st.turn === ctx.me.uid && !st.vote);

  el.querySelectorAll('.wr-slot').forEach(b => {
    const spot = b.dataset.spot;
    const uid = who[spot];
    const free = !uid;

    b.disabled = !uid && !(free && canMove);
    b.classList.toggle('free', free);
    b.classList.toggle('taken', !free);
    b.classList.toggle('me', spot === mine);
    /* วงไฟรอบคนที่ถึงตา เห็นเหมือนกันทุกเครื่อง
       ของเดิมดูได้จากรายชื่อฝั่งขวาอย่างเดียว ซึ่งไกลจากจุดที่สายตาจับอยู่ */
    b.classList.toggle('turn', !!uid && uid === view.turn && view.phase === 'play');
    /* การ์ดกำลังรอให้เราเลือกเป้า — ทุกคนที่เลือกได้จะเรืองส้ม ชี้แล้วเป็นแดง */
    b.classList.toggle('pick-target', !!uid && cardTargets.includes(uid));

    // เขียนทับเฉพาะตอนคนในช่องเปลี่ยนจริง ไม่งั้นรูปประจำตัวจะโหลดใหม่ทุกรอบ
    if (uid) b.dataset.who = uid; else b.removeAttribute('data-who');
    if (b.dataset.paint !== (uid || '')) {
      b.dataset.paint = uid || '';
      b.innerHTML = uid
        ? `<span class="wr-pawn">${avatarFace(uid, st.names?.[uid] || '', (ctx.avatars || {})[uid], null)}</span>`
        : '';
    }

    /* ป้ายของติดตัว วางมุมล่างซ้ายของหมาก แยกจากการวาดรูปประจำตัว
       เพราะรูปวาดใหม่เฉพาะตอนคนในช่องเปลี่ยน ส่วนป้ายเปลี่ยนได้ตลอดเวลา */
    const birds = uid ? (view.marks?.[uid]?.bird || 0) : 0;
    let tok = b.querySelector('.wr-token');
    if (birds && !tok) {
      tok = document.createElement('img');
      tok.className = 'wr-token';
      tok.draggable = false;
      tok.src = tokenArt('albatross_icon');
      tok.dataset.alt = tokenAlt('albatross_icon');
      tok.title = t('wreck.token.bird');
      tok.onerror = () => {
        if (tok.dataset.alt) { tok.src = tok.dataset.alt; tok.dataset.alt = ''; }
        else tok.remove();
      };
      b.appendChild(tok);
    } else if (!birds && tok) tok.remove();
  });

  /* ช่วงกัปตันเล็งเป้า — เรือที่ยิงได้เรืองแสง ชี้แล้วโตขึ้นและเป็นสีแดง คลิกคือเลือก
     ทำบนกระดานจริงไม่ใช่ในฉาก เพราะต้องเห็นว่ากล่องอยู่ลำไหนก่อนตัดสินใจ */
  /* ไฮไลท์เรือได้ก็ต่อเมื่อฉากเล่าถึงช่วงเลือกแล้วจริง ๆ
     ไม่ใช่ทันทีที่สถานะมี aim ซึ่งเกิดพร้อมกับตอนผลเพิ่งเริ่มขึ้น */
  const aimMine = st.aim && st.aim.by === ctx.me.uid && !st.aim.target && sceneAtAim();
  /* กล่องที่กำลังจะย้าย เรืองเหลืองไว้ให้เห็นว่าเลือกใบไหนอยู่ */
  el.querySelectorAll('[data-cargo]').forEach(b => {
    b.classList.toggle('picked', plan?.act === 'shiftCargo' && plan.box === b.dataset.cargo);
  });


  el.querySelectorAll('[data-piece]').forEach(node => {
    /* เรือที่เลือกได้ มาจากสองทาง — กัปตันเล็งเป้าหลังยิงติด กับการ์ดที่ให้เลือกเรือ
       ใช้หน้าตาเดียวกันเพราะเป็นการกระทำแบบเดียวกันในสายตาคนเล่น */
    const hot = (aimMine && st.aim.options.includes(node.dataset.piece))
             || shipTargets.includes(node.dataset.piece);
    node.classList.toggle('aim-hot', !!hot);
    /* ใช้ onclick ทับตัวเดิมทุกครั้ง จะได้ไม่ผูกซ้อนกันหลายชั้นตอนวาดใหม่
       และตั้งเป็น null เมื่อไม่ใช่ช่วงเล็ง จะได้ไม่ค้างไว้กดได้ตอนอื่น */
    node.onclick = hot
      ? (e) => {
          e.stopPropagation();
          /* เปิดเมนูยืนยันติดกับเรือลำที่คลิก จะได้เห็นชัดว่ากำลังเล็งลำไหน */
          plan = shipTargets.includes(node.dataset.piece)
            ? { act: 'useCard', target: node.dataset.piece, via: 'menu' }
            : { act: 'aimAt', target: node.dataset.piece, via: 'menu' };
          openMenu(el, node, { kind: 'aim' });
          paint(el);
        }
      : null;
  });

  el.querySelectorAll('[data-piece]').forEach(node => {
    const p = PIECES.find(x => x.id === node.dataset.piece);
    const box = node.querySelector('.wr-cargo');
    const html = cargoOf(p, view, ctx.me.uid);
    if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
  });

  paintNation(el, ctx);
  paintReveal(el, st, ctx);
  /* แผนที่เกิดจากการคลิกเรือ ต้องไปโผล่ในฉากกลางจอ ไม่ใช่คอลัมน์ล่าง */
  setPlanView(null);
  setPlanWire(box => wirePlan(box, el, ctx));
  /* ฉากปิดเมื่อไหร่ วาดกระดานใหม่ทันที ไม่ต้องรอสถานะเปลี่ยนรอบถัดไป */
  setSceneClose(() => paint(el));   /* วาดกระดานใหม่ และเปิดฉากถัดไปถ้ามีรออยู่ */
  paintScene(el, st, ctx);
  paintHand(el, st, ctx);
  paintRoster(el, view, ctx);
  paintActions(el, view, ctx);
  paintVote(el, st, ctx);
  paintLog(el, st);
  paintDecks(el, st);
  paintEvents(el, st, ctx);

  const scoreHtml = legend(view);
  const sb = el.querySelector('.wr-score-bar');
  if (sb.dataset.sig !== scoreHtml) { sb.dataset.sig = scoreHtml; sb.innerHTML = scoreHtml; }

  paintMenu(el, view, ctx);
  paintTurn(el, view, ctx);
  paintDice(el, st);

  const legendHtml =
    (ctx.isHost ? `<button class="btn btn-slim" data-act="leave">${esc(t('wreck.back'))}</button>` : '');
  const bar = el.querySelector('.wr-legend');
  if (bar.dataset.sig !== legendHtml) { bar.dataset.sig = legendHtml; bar.innerHTML = legendHtml; }
}

/* ── ไพ่ประเทศ ─────────────────────────────────────────────
   ค้างอยู่เหนือไพ่บนมือทั้งเกม เพราะเป็นข้อมูลที่ต้องเห็นตลอดเวลาเล่น
   อ่านจากข้อมูลลับของตัวเอง คนอื่นไม่มีทางเห็นแม้จะเปิดหน้าจอดู */
function paintNation(el, ctx) {
  const box = el.querySelector('.wr-nation');
  if (!box) return;
  const n = ctx.secret?.nation;
  const html = !n ? '' : `
    <span class="wr-nation-label">${esc(t('wreck.nation.head'))}</span>
    <span class="wr-nation-tag n-${esc(n)}">${esc(t('wreck.nation.' + n + '.tag'))}</span>
    <span class="wr-nation-goal">${esc(t('wreck.nation.' + n + '.goal'))}</span>`;
  box.hidden = !html;
  if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
}

/* ── หน้าเปิดไพ่ประเทศตอนเริ่มเกม ──────────────────────────
   บังทั้งจอไว้สามวินาทีก่อนทอยลูกเต๋า จะได้ไม่มีใครพลาดของตัวเอง
   เวลานับจากสถานะกลาง ทุกคนจึงเห็นพร้อมกันและปิดพร้อมกัน */
function paintReveal(el, st, ctx) {
  const box = el.querySelector('.wr-reveal');
  if (!box) return;

  if (st.phase !== 'reveal') {
    box.hidden = true;
    if (box.dataset.sig) { box.dataset.sig = ''; box.innerHTML = ''; }
    return;
  }

  const n = ctx.secret?.nation;
  const html = `<div class="wr-reveal-card n-${esc(n || 'D')}">
      <span class="wr-reveal-small">${esc(t('wreck.nation.hide'))}</span>
      <strong class="wr-reveal-big">${esc(n ? t('wreck.nation.' + n + '.tag') : '\u2014')}</strong>
      <span class="wr-reveal-goal">${esc(n ? t('wreck.nation.' + n + '.goal') : '')}</span>
    </div>`;

  box.hidden = false;
  if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
}

/* ── ไพ่บนมือ ──────────────────────────────────────────────
   ปกติเป็นไพ่โชว์เฉย ๆ แต่ระหว่างโหวตจะกดได้ กดแล้วคือส่งใบนั้นเข้าหม้อ */
function paintHand(el, st, ctx) {
  const me = ctx.me.uid;
  const mine = ctx.secret?.vote || [];
  const held = st.held?.[me] ?? 0;
  /* ใช้ฟังก์ชันเดียวกับฝั่งกติกา จะได้ไม่มีทางที่หน้าจอชวนให้กดสิ่งที่กติกาไม่รับ */
  const asking = canVoteNow(st, me);

  /* เพดานไพ่เหลือศูนย์ = หมดสิทธิ์ร่วมโหวตถาวร ต้องบอกเหตุผล
     ไม่งั้นจะดูเหมือนหน้าจอค้างหรือลืมไฮไลท์ให้ */
  const spent = (st.maxVote?.[me] ?? 0) === 0;
  const sittingOut = !!st.vote && spent && occupants(st.pos, placeOf(st.pos?.[me])).includes(me);

  const html =
    mine.map(id => (asking
      ? `<button class="wr-pick" data-card="${esc(id)}">${voteCard(voteById(id), lang)}</button>`
      : voteCard(voteById(id), lang))).join('') +
    (ctx.secret?.held || []).map(id => {
      const c = eventById(id);
      const info = c ? (c[lang] || c.th) : null;
      /* ใบที่ใช้ได้ในตาคนอื่นด้วย ต้องกดได้แม้ยังไม่ถึงตาเรา */
      const anytime = anytimeCards(st, me, ctx.secret?.held || []).includes(id);
      const usable = canUseCard(st, me, id)
        && (anytime || actionsFor(st, me).includes('playHeld'));
      return `<button class="wr-card wr-held${usable ? ' ready' : ' off'}"
        data-held="${esc(id)}"${usable ? '' : ' disabled'}
        title="${esc(info ? `${info.name} — ${info.desc}` : id)}">
          ${eventFace(id)}
        </button>`;
    }).join('') +
    (mine.length + held ? '' : `<p class="wr-empty">${esc(t('wreck.noCards'))}</p>`) +
    (spent ? `<p class="wr-spent">${esc(t('wreck.voteSpent'))}</p>` : '') +
    (sittingOut ? `<p class="wr-empty">${esc(t('wreck.sittingOut'))}</p>` : '');

  const box = el.querySelector('.wr-hand-cards');
  box.classList.toggle('asking', asking);
  /* เรืองแสงทั้งกล่อง ไม่ใช่แค่ไพ่ — ตอนโหวตสายตาทุกคนอยู่กลางจอ
     ถ้าไม่ดึงสายตากลับมาที่มือ จะไม่มีใครรู้ว่าต้องส่งไพ่ */
  el.querySelector('.wr-hand')?.classList.toggle('asking', asking);
  if (box.dataset.sig !== html) {
    box.dataset.sig = html;
    box.innerHTML = html;
    box.querySelectorAll('[data-held]').forEach(b => {
    b.onclick = () => {
      if (b.disabled) return;
      plan = { act: 'playHeld', card: b.dataset.held, via: 'menu' };
      openMenu(el, b, { kind: 'aim' });
      paint(el);
    };
  });

  box.querySelectorAll('[data-card]').forEach(b => {
      b.onclick = () => ctx.send('voteCard', { card: b.dataset.card });
    });
  }
}

/* ── การ์ดเหตุการณ์ ────────────────────────────────────────
   ชี้เมาส์แล้วปุ่มโผล่มาจาง ๆ แต่ยังกดไม่ได้
   ต้องเลือกใบก่อนปุ่มถึงจะชัดและกดได้ — เปิดใช้ 1 ใบ แอบดูใช้ 2 ใบ */
const ALL_EVENTS = [...BASE_CARDS, ...EXTRA_CARDS];
const eventById = (id) => ALL_EVENTS.find(c => c.id === id) || null;

/* หน้าการ์ด — ภาพเต็มใบแล้วแปะชื่อทับที่แถบล่าง
   ชื่อวาดด้วยฟอนต์ของเกม ไม่ได้ฝังอยู่ในภาพ สลับภาษาแล้วเปลี่ยนตามทันที
   ภาพหายก็ไม่พัง — onerror ซ่อน img ทิ้ง แล้วพื้นหลัง CSS เดิมโผล่มาแทน */
function eventFace(id) {
  const c = eventById(id);
  if (!c) return '';
  const info = c[lang] || c.th;
  /* ลอง WebP ก่อน ไม่เจอค่อยสลับไป PNG แล้วค่อยยอมแพ้เป็นไพ่คว่ำ
     ทำแบบนี้เพื่อให้ช่วงที่ยังแปลงไฟล์ไม่ครบ ไม่มีใบไหนหายไปเฉย ๆ */
  return `<img class="wr-card-img" src="${esc(cardArt(id))}" alt="" draggable="false"
      data-alt="${esc(cardArtAlt(id))}"
      onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt='';}else{this.remove();}">
    <span class="wr-card-name">${esc(info.name)}</span>`;
}

/* ไพ่คว่ำ — วางตัวหนังสือไว้ก่อนแล้วเอาภาพทับ
   ภาพโหลดขึ้นก็บังตัวหนังสือไปเอง โหลดไม่ขึ้น onerror ลบภาพทิ้งแล้วตัวหนังสือโผล่มาแทน
   ได้ของสำรองโดยไม่ต้องเช็กว่าไฟล์มีอยู่จริงไหมก่อนวาด */
const eventBack = () => `<span class="wr-card-face">${esc(t('wreck.event'))}</span>
  <img class="wr-card-img" src="${esc(CARD_BACK)}" alt="" draggable="false"
    data-alt="${esc(CARD_BACK_ALT)}"
    onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt='';}else{this.remove();}">`;

function paintEvents(el, st, ctx) {
  const me = ctx.me.uid;
  /* ใบที่ตัวเองแอบดูไว้ เห็นคนเดียว คนอื่นยังเห็นเป็นไพ่คว่ำ */
  const seen = {};
  for (const s of ctx.secret?.peek?.seen || []) seen[s.slot] = s.id;

  const mid = st.peek?.uid === me ? st.peek : null;      /* แอบดูค้างอยู่กลางคัน */
  const mine = st.turn === me && st.phase === 'play' && !st.vote;

  el.querySelectorAll('.wr-event-slot').forEach(slot => {
    const n = slot.dataset.event;
    const i = Number(n) - 1;
    const on = picks.includes(n);
    const filled = i < (st.events ?? 0);
    slot.classList.toggle('on', on);

    const card = slot.querySelector('.wr-event');
    const known = seen[i];
    const face = !filled ? '' : (known ? eventFace(known) : eventBack());
    const html = face + `<span class="wr-card-no">${n}</span>`;
    if (card.dataset.face !== html) { card.dataset.face = html; card.innerHTML = html; }

    /* รู้ว่าเป็นใบอะไรแล้วก็ให้ชี้เมาส์อ่านคำอธิบายได้ */
    /* คำอธิบายต้องอยู่ที่ตัวช่อง ไม่ใช่ที่ตัวการ์ด
       เพราะการ์ดตั้ง overflow:hidden ไว้ให้ภาพไม่ล้นขอบ ป๊อปอัพเลยโดนตัดหายไปด้วย */
    const info = known ? (eventById(known)?.[lang] || eventById(known)?.th) : null;
    if (info) slot.dataset.tip = `${info.name} — ${info.desc}`;
    else slot.removeAttribute('data-tip');
    card.removeAttribute('data-tip');

    card.classList.toggle('peeked', !!known);
    card.classList.toggle('gone', !filled);

    /* ระหว่างแอบดูค้าง เหลือให้กดได้แค่ปุ่มแอบดูของใบที่ยังไม่ได้ดู */
    const usedByPeek = mid?.slots.includes(i);
    const acts = slot.querySelector('.wr-event-acts');
    acts.classList.toggle('ready', on && mine && !usedByPeek);
    slot.querySelector('[data-ev="activate"]').disabled = !(on && mine && filled && !mid);
    /* ดูใบที่เคยเปิดไปแล้วซ้ำได้ ห้ามเฉพาะใบที่เพิ่งดูไปในการแอบดูรอบนี้ */
    slot.querySelector('[data-ev="peek"]').disabled = !(on && mine && filled && !usedByPeek);
    /* ปุ่มเลือกการ์ดเองสำหรับเทส โผล่เฉพาะตอนเปิด ?dev=cards และเป็นเจ้าของห้อง */
    const pick = slot.querySelector('[data-ev="pick"]');
    if (pick) { pick.hidden = !(DEV_CARDS && ctx.isHost); pick.disabled = !on; }
    slot.classList.toggle('used', !!usedByPeek);
  });

  const note = el.querySelector('.wr-event-note');
  if (note) {
    note.textContent =
        mid ? t('wreck.peekLeft', { n: mid.left })
      : forcing ? t('wreck.forcing', { name: st.names?.[forcing] || '?' })
      : picks.length === 1 ? t('wreck.pickMore') : '';
    note.hidden = !note.textContent;
  }

  paintDevPick(el, st, ctx);
  paintReveal2(el, st);
}

/* ── เครื่องมือทดสอบ: หยิบไพ่จากสำรับมาวางแทนใบที่เลือก ────
   โผล่เฉพาะตอนเปิด ?dev=cards และเป็นเจ้าของห้อง และเลือกช่องไว้แล้ว
   เป็นป๊อปอัพที่พิมพ์ค้นชื่อได้ เพราะการ์ดมี 32 ชนิด ไล่หาด้วยตาช้าเกินไป */
let devOpen = false;
let devFind = '';

function paintDevPick(el, st, ctx) {
  const bar = el.querySelector('.wr-devbar-top');
  const pop = el.querySelector('.wr-devpop');
  if (!bar || !pop) return;

  const can = DEV_CARDS && ctx.isHost && !!ctx.secrets?._deck;
  bar.hidden = !(can && picks.length === 1);
  if (!can) { pop.hidden = true; devOpen = false; return; }

  const slot = picks.length === 1 ? Number(picks[0]) - 1 : null;
  const label = t('wreck.dev.swap', { n: picks[0] || '' });
  if (bar.dataset.sig !== label) {
    bar.dataset.sig = label;
    bar.innerHTML = `<button class="btn btn-slim wr-dev-open">\u26a0 ${esc(label)}</button>`;
    bar.querySelector('.wr-dev-open').onclick = () => { devOpen = true; devFind = ''; paint(el); };
  }

  pop.hidden = !(devOpen && slot !== null);
  if (pop.hidden) { pop.dataset.sig = ''; return; }

  const q = devFind.trim().toLowerCase();
  const hit = ALL_EVENTS.filter(c => {
    if (!q) return true;
    const i = c[lang] || c.th;
    return c.id.includes(q) || i.name.toLowerCase().includes(q)
        || (c.th.name || '').toLowerCase().includes(q);
  });

  const html = `<div class="wr-devpop-box">
      <div class="wr-devpop-head">${esc(t('wreck.dev.swap', { n: picks[0] }))}</div>
      <input class="wr-devpop-find" type="search" autocomplete="off"
        placeholder="${esc(t('wreck.dev.find'))}" value="${esc(devFind)}">
      <div class="wr-devpop-list">${
        hit.map(c => `<button class="wr-devpop-item rar-${esc(c.rarity)}" data-id="${esc(c.id)}">
          <span>${esc((c[lang] || c.th).name)}</span>
          <span class="wr-devpop-id">${esc(c.id)}</span></button>`).join('')
        || `<p class="wr-empty">${esc(t('wreck.dev.none'))}</p>`
      }</div>
      <button class="btn btn-slim wr-devpop-close">${esc(t('wreck.cancel'))}</button>
    </div>`;

  if (pop.dataset.sig !== html) {
    pop.dataset.sig = html;
    pop.innerHTML = html;
    const find = pop.querySelector('.wr-devpop-find');
    find.oninput = () => { devFind = find.value; paint(el); find.focus(); };
    pop.querySelector('.wr-devpop-close').onclick = () => { devOpen = false; paint(el); };
    pop.querySelectorAll('[data-id]').forEach(b => {
      b.onclick = () => {
        ctx.send('devCard', { slot, id: b.dataset.id });
        devOpen = false; picks = []; paint(el);
      };
    });
    if (devFind) { find.focus(); find.setSelectionRange(find.value.length, find.value.length); }
  }
}

/* ใบที่เพิ่งถูกเปิด — ทุกคนเห็นเหมือนกัน วางไว้ข้างแถวการ์ด */
function paintReveal2(el, st) {
  const box = el.querySelector('.wr-event-open');
  if (!box) return;
  const ev = st.lastEvent;
  const html = !ev ? '' : `<span class="wr-open-label">${esc(t('wreck.opened', {
    name: st.names?.[ev.by] || '?' }))}</span>
    <span class="wr-card wr-open-card">${eventFace(ev.id)}</span>`;
  box.hidden = !html;
  if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
}

/* ── แผงทดสอบ ──────────────────────────────────────────────
   โผล่เฉพาะตอนเปิดโหมดทดสอบของห้อง ใช้ดูภาพลูกเต๋าโดยไม่ต้องเริ่มเกมใหม่
   ทอยตรงนี้เป็นภาพล้วน ไม่แตะสถานะเกมและไม่ส่งให้ใคร */
/* ── ป้ายบอกตากับนาฬิกา ────────────────────────────────────
   นับถอยหลังเดินเองในเครื่องทุกครึ่งวินาที ไม่ต้องรอสถานะใหม่จากเซิร์ฟเวอร์ */
let clockTimer = null;

function paintTurn(el, st, ctx) {
  clearInterval(clockTimer);
  const bar = el.querySelector('.wr-hint');
  if (!bar || !st.turn) return;

  const mine = st.turn === ctx.me.uid;
  const who = st.names?.[st.turn] || '?';
  const off = ctx.members?.find(m => m.uid === st.turn && !m.online);

  const paintClock = () => {
    const left = Math.max(0, Math.ceil(((st.deadline || 0) - Date.now()) / 1000));
    const head = off ? t('wreck.offline', { name: who })
               : mine ? t('wreck.yourTurn') : t('wreck.waitFor', { name: who });
    bar.textContent = st.deadline ? `${head} \u00b7 ${t('wreck.left', { n: left })}` : head;
    bar.classList.toggle('urgent', !off && left <= 5);
    bar.classList.toggle('mine', mine);
  };
  paintClock();
  clockTimer = setInterval(paintClock, 500);

  // ช่องยืนกดได้เฉพาะตอนถึงตาตัวเอง
  el.querySelectorAll('.wr-slot').forEach(b => {
    if (!b.dataset.who && !mine) b.disabled = true;
  });
}

/* ── ลูกเต๋าหาคนเริ่ม ──────────────────────────────────────
   เจ้าของห้องทอยให้ตอนเริ่มเกม ทุกเครื่องจึงเห็นหน้าเดียวกัน
   หน้าจอแค่เล่นภาพให้ดูสมจริง ไม่ได้สุ่มเอง

   ระหว่างกลิ้งจะไม่โชว์เลขอะไรเลย เห็นแค่ตัวลูกเต๋าหมุน
   เลขโผล่ตอนนิ่งแล้วเท่านั้น เหมือนทอยลูกเต๋าจริงที่อ่านค่าไม่ได้ตอนกำลังกลิ้ง */
let dieShown = '';

export function showDice(el, sides, face, note) {
  const box = el.querySelector('.wr-dice');
  if (!box) return;

  box.hidden = false;
  box.innerHTML = `
    <div class="wr-die rolling">${dieSvg(sides, rollPose(0))}</div>
    <p class="wr-die-note">${esc(t('wreck.rolling'))}</p>`;

  const dieEl = box.querySelector('.wr-die');
  const noteEl = box.querySelector('.wr-die-note');

  const land = () => {
    dieEl.innerHTML = dieSvg(sides, HERO, face);   // เลขโผล่ตอนนิ่งแล้วเท่านั้น
    dieEl.classList.remove('rolling');
    dieEl.classList.add('landed');
    if (note) noteEl.textContent = note;
  };

  /* ปิดแอนิเมชันไว้ก็ยังต้องเห็นผลทอย ข้ามการกลิ้งไปที่ผลเลย */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    land();
  } else {
    const t0 = performance.now();
    const step = (now) => {
      const k = (now - t0) / ROLL_MS;
      if (k >= 1 || !dieEl.isConnected) { if (dieEl.isConnected) land(); return; }
      dieEl.innerHTML = dieSvg(sides, rollPose(k));   // ระหว่างกลิ้งยังไม่ส่งเลขเข้าไป
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  setTimeout(() => { box.hidden = true; box.innerHTML = ''; }, ROLL_MS + 2600);
}

const DIE_WINDOW = 12000;  /* ช่วงที่ยังโชว์ลูกเต๋าอยู่ — เผื่อเวลาโหลดภาพด้วย */

function paintDice(el, st) {
  /* ยังโหลดภาพไม่เสร็จก็อย่าเพิ่งทอย ไม่งั้นลูกเต๋าจะไปซ้อนอยู่ใต้หน้าโหลด
     พอโหลดเสร็จแล้วยังอยู่ในช่วงเวลาทอย ก็จะโผล่ให้เห็นเองตอนนั้น */
  if (!assetsReady) return;
  if (!st.die || st.phase !== 'play' || !st.dieAt) return;
  /* เข้ามาช้ากว่าช่วงโชว์ก็ไม่ต้องโชว์ย้อนหลัง แต่ถ้ายังอยู่ในช่วงก็เห็นเหมือนกันทุกคน */
  if (Date.now() - st.dieAt > DIE_WINDOW) return;

  const key = 'die:' + st.dieAt;
  if (dieShown === key) return;
  dieShown = key;
  showDice(el, st.die.sides, st.die.face,
    t('wreck.starts', { name: st.names?.[st.turn] || '?' }));
}

/* ── เมนูลอยข้างหมาก ───────────────────────────────────────
   วางด้วยพิกัดจริงของปุ่มที่กด ไม่ใช่เปอร์เซ็นต์บนเวที
   เพราะช่องยืนอยู่ในกล่องที่หมุนอยู่ คำนวณเป็นเปอร์เซ็นต์แล้วจะเพี้ยน */
function openMenu(el, node, data) {
  const stage = el.querySelector('.wr-stage');
  const r = node.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  menu = {
    ...data,
    right: r.right - s.left + 10,          // จุดวางเมื่อออกทางขวา
    left: r.left - s.left - 10,            // จุดวางเมื่อต้องพลิกไปทางซ้าย
    y: r.top - s.top + r.height / 2
  };
  paint(el);
}

function paintMenu(el, st, ctx) {
  const box = el.querySelector('.wr-menu');
  if (!box) { console.warn('[wreckers] ไม่พบกล่องเมนูในโครง'); return; }
  if (!menu) { box.hidden = true; box.innerHTML = ''; return; }

  /* มีแผนรอยืนยันอยู่ = เมนูต้องกลายเป็นกล่องยืนยันทันที ไม่ว่าเปิดมาจากอะไร
     ของเดิมเช็กชนิดเมนูก่อน เมนูกล่องสมบัติเลยยังโชว์ปุ่มเดิมค้างอยู่
     ต้องไปกดที่อื่นอีกทีเมนูถึงจะรู้ตัวว่ามีแผนรออยู่ */
  const html = plan?.via === 'menu' ? planBody(st, ctx)
             : menu.kind === 'aim' ? planBody(st, ctx)
             : menu.kind === 'cargo' ? cargoMenu()
             : pawnMenu(st, ctx);
  if (!html) { box.hidden = true; box.innerHTML = ''; menu = null; return; }

  box.hidden = false;
  box.innerHTML = html;
  box.style.left = '0px';
  box.style.top = '0px';

  // ออกทางขวาของหมากก่อน ถ้าชนขอบเวทีค่อยพลิกไปทางซ้าย
  const stage = el.querySelector('.wr-stage');
  const w = box.offsetWidth, h = box.offsetHeight;
  const fitsRight = menu.right + w <= stage.clientWidth - 6;
  const x = fitsRight ? menu.right : Math.max(6, menu.left - w);
  const y = Math.max(6, Math.min(menu.y - h / 2, stage.clientHeight - h - 6));
  box.style.left = x + 'px';
  box.style.top = y + 'px';

  box.querySelectorAll('[data-do]').forEach(b => {
    b.onclick = () => runMenu(el, ctx, b.dataset.do, b.dataset.arg);
  });
  wirePlan(box, el, ctx);
}

/* เมนูของหมาก — ของตัวเองได้ Action ตามตำแหน่ง ของคนอื่นได้บังคับเปิดการ์ดกับไล่ลงเรือ */
function pawnMenu(st, ctx) {
  /* มีแผนที่เริ่มจากเมนูนี้ค้างอยู่ ก็แสดงแผนกับปุ่มยืนยันตรงนี้เลย
     ไม่ต้องให้ผู้เล่นเหลือบไปหาปุ่มยืนยันที่อีกมุมจอ */
  if (plan?.via === 'menu') return planBody(st, ctx);

  const meUid = ctx.me.uid;
  const spot = st.pos?.[menu.uid];
  const mine = menu.uid === meUid;
  const name = st.names?.[menu.uid] || '?';
  const rows = [];

  if (mine) {
    /* ถามกติกาว่าทำอะไรได้จริงตอนนี้ ไม่ใช่ลอกรายการตามบทบาทดิบ ๆ
       ของเดิมกัปตันอยู่คนเดียวก็ยังเห็นปุ่มไล่คนลงเรือ ทั้งที่ไม่มีใครให้ไล่ */
    /* Action ที่ทำผ่านแถวการ์ดด้านล่างอยู่แล้ว ไม่ต้องมาซ้ำในเมนูข้างตัว
       เพราะกดจากตรงนี้ก็ยังต้องไปเลือกช่องการ์ดอยู่ดี ไม่ได้ช่วยอะไร */
    const viaCards = ['activate', 'peek', 'force'];
    const acts = actionsFor(st, meUid)
      .filter(k => !['voteCard', 'toBoat'].includes(k) && !viaCards.includes(k));

    /* การ์ดที่ใช้ได้ในตาคนอื่น ต้องมีปุ่มแม้ยังไม่ถึงตาเรา
       ไม่งั้นจะใช้ไม่ได้เลย เพราะโอกาสใช้คือตอนที่ยังไม่ถึงตาตัวเอง */
    const anyNow = anytimeCards(st, meUid, ctx.secret?.held || []);
    if (anyNow.length && !acts.includes('playHeld')) acts.push('playHeld');

    acts.forEach(k => {
      if (k !== 'playHeld') { rows.push(btnRow(k, t('wreck.act.' + k), true)); return; }
      /* การ์ดในมือแต่ละใบเป็นปุ่มของตัวเอง ทึบเมื่อใช้ตอนนี้ไม่ได้
         เช่นจดหมายที่เรือเต็มทั้งสองลำ กดไปก็ส่งใครไม่ได้ */
      for (const id of (ctx.secret?.held || [])) {
        const c = eventById(id);
        const nm = c ? (c[lang] || c.th).name : id;
        rows.push(`<button class="wr-menu-btn wr-menu-card" data-do="held" data-arg="${esc(id)}"
          ${canUseCard(st, meUid, id) ? '' : 'disabled'}>
            <img class="wr-menu-thumb" src="${esc(cardArt(id))}" alt="" draggable="false"
              data-alt="${esc(cardArtAlt(id))}"
              onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt='';}else{this.remove();}">
            ${esc(t('wreck.act.playHeld', { card: nm }))}
          </button>`);
      }
    });

    const boats = boatsFrom(spot);
    if (boats.length === 1) {
      const free = boatFree(st.pos, boats[0]);
      rows.push(btnRow('move', t('wreck.act.toBoat'), free, boats[0] + ':x',
        free ? '' : t('wreck.boatTaken')));
    } else if (boats.length === 2) {
      rows.push(`<div class="wr-menu-two">` + boats.map(b => {
        const free = boatFree(st.pos, b);
        const label = t(b === 'boatL' ? 'wreck.act.toBoatL' : 'wreck.act.toBoatR');
        return `<button class="wr-menu-btn" data-do="move" data-arg="${b}:x"
          ${free ? '' : 'disabled'} title="${esc(free ? '' : t('wreck.boatTaken'))}">${esc(label)}</button>`;
      }).join('') + `</div>`);
    }
  } else {
    /* กดที่กัปตันของเรือลำเดียวกันตอนเราเป็นต้นหน = ทางลัดสั่งก่อกบฏ
       เป็นที่ที่คนมองหาโดยสัญชาตญาณ เพราะกำลังชี้ไปที่คนที่จะโดนปลด */
    if (actionsFor(st, meUid).includes('mutiny')
        && roleOf(st.pos?.[menu.uid]) === 'captain'
        && placeOf(st.pos?.[menu.uid]) === placeOf(st.pos?.[meUid])) {
      rows.push(btnRow('mutiny', t('wreck.act.mutiny'), true));
    }
    rows.push(btnRow('force', t('wreck.act.forceEvent'), true, menu.uid));

    // กัปตันไล่คนบนเรือลำเดียวกันลงได้
    const myPlace = (st.pos?.[meUid] || '').split(':');
    const theirPlace = (spot || '').split(':');
    if (myPlace[1] === 'C' && myPlace[0] === theirPlace[0])
      rows.push(btnRow('kick', t('wreck.act.kickOff'), true, menu.uid));
  }

  if (!rows.length) return '';
  return `<div class="wr-menu-head">${esc(name)}</div>` + rows.join('');
}

function cargoMenu() {
  /* ส่ง id ของกล่องไปกับปุ่มด้วย ไม่งั้นตอนกดจะไม่รู้ว่าหมายถึงกล่องไหน
     แล้วคำสั่งที่ส่งขึ้นไปจะไม่มีทิศ ทำให้ถูกปฏิเสธเงียบ ๆ */
  return `<div class="wr-menu-head">${esc(t('wreck.act.shiftCargo'))}</div>` +
         btnRow('shiftCargo', t('wreck.shiftHere'), true, menu.cargo);
}

const btnRow = (act, label, on, arg = '', tip = '') =>
  `<button class="wr-menu-btn" data-do="${act}"${arg ? ` data-arg="${esc(arg)}"` : ''}
    ${on ? '' : 'disabled'}${tip ? ` title="${esc(tip)}"` : ''}>${esc(label)}</button>`;

/* เมนูข้างหมากไม่ยิงคำสั่งทันที ตั้งเป็นแผนรอยืนยันแล้วเมนูเปลี่ยนเป็นปุ่ม Confirm/Cancel
   เมนูต้องไม่ปิดตัวเอง ไม่งั้นแผนจะหายไปพร้อมเมนูโดยไม่มีอะไรให้กด */
function runMenu(el, ctx, act, arg) {
  if (act === 'force') { closeMenu(); forcing = arg; picks = []; paint(el); return; }
  if (act === 'move') plan = { act: 'toBoat', boat: String(arg).split(':')[0], via: 'menu' };
  else if (act === 'kick') plan = { act: 'kick', uid: arg, via: 'menu' };
  else if (act === 'held') plan = { act: 'playHeld', card: arg, via: 'menu' };
  else if (act === 'shiftCargo' && arg) {
    const [, side] = String(arg).split(':');
    plan = { act: 'shiftCargo', from: side === 'f' ? 'F' : 'B', box: arg, via: 'menu' };
  }
  else plan = { act, via: 'menu' };
  paint(el);
}

/* ── เครื่องมือทดสอบการ์ด ──────────────────────────────────
   เปิดด้วย ?dev=cards และเห็นเฉพาะเจ้าของห้อง เพราะสำรับเก็บไว้ในข้อมูลลับ
   ที่มีแต่เจ้าของห้องอ่านได้ คนอื่นเปิดพารามิเตอร์นี้ก็ไม่เห็นอะไร

   กดช่องไหนแล้วเลือกใบ ใบเดิมในช่องจะถูกดันกลับลงใต้กอง
   จำนวนใบทั้งสำรับจึงไม่เปลี่ยน เล่นต่อได้เลยไม่ต้องเปิดเกมใหม่ */

/* ── จำนวนไพ่ที่เหลือในกอง ─────────────────────────────────── */
function paintDecks(el, st) {
  const html = `
    <span class="wr-deck">
      <span class="wr-deck-n">${st.eventDeck ?? 0}</span>
      <span class="wr-deck-label">${esc(t('wreck.eventDeck'))}</span>
    </span>
    <span class="wr-deck">
      <span class="wr-deck-n">${st.voteDeck ?? 0}</span>
      <span class="wr-deck-label">${esc(t('wreck.voteDeck'))}</span>
    </span>`;
  const box = el.querySelector('.wr-decks');
  if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
}

/* ── Action ที่กดได้ในตานี้ ────────────────────────────────
   ชุดล่างเปลี่ยนตามตำแหน่งที่ยืน ย้ายที่แล้วปุ่มเปลี่ยนทันที */
function paintActions(el, st, ctx) {
  /* ฉากกำลังเล่าผลอยู่ = ยังไม่ให้กดอะไร เพราะกระดานที่เห็นเป็นภาพก่อนผลออก
     ถ้าปล่อยให้กด คำสั่งจะอิงจากภาพที่ไม่ตรงกับสถานะจริงบนเซิร์ฟเวอร์ */
  const frozenNow = sceneHolding(st);
  const me = ctx.me.uid;
  const spot = st.pos?.[me];
  const role = roleOf(spot);
  const can = actionsFor(st, me);                       /* กฎเป็นคนตัดสิน ไม่ใช่หน้าจอ */

  const btn = (k, on = can.includes(k)) =>
    `<button class="wr-act" data-do="${k}"${on ? '' : ' disabled'}>${esc(t('wreck.act.' + k))}</button>`;

  const boats = boatsFrom(spot);
  const boatBtn = (b) => {
    const free = boatFree(st.pos, b) && can.includes('toBoat');
    const key = boats.length === 1 ? 'wreck.act.toBoat'
              : b === 'boatL' ? 'wreck.act.toBoatL' : 'wreck.act.toBoatR';
    return `<button class="wr-act" data-boat="${b}"${free ? '' : ' disabled'}
      title="${esc(boatFree(st.pos, b) ? '' : t('wreck.boatTaken'))}">${esc(t(key))}</button>`;
  };
  const boatRow = !boats.length ? ''
    : boats.length === 1 ? boatBtn(boats[0])
    : `<div class="wr-act-two">${boats.map(boatBtn).join('')}</div>`;

  const common = ['activate', 'peek', 'force'].map(k => btn(k)).join('') + boatRow;

  const list = ['attack', 'kick', 'mutiny', 'islandVote', 'shiftCargo'].filter(k => can.includes(k));
  const byRole = list.length
    ? `<span class="wr-act-role">${esc(t('wreck.role.' + role))}</span>` + list.map(k => btn(k)).join('')
    : `<p class="wr-empty">${esc(t('wreck.noRoleAction'))}</p>`;

  for (const [key, html] of [['common', common], ['role', byRole]]) {
    const box = el.querySelector(`[data-group="${key}"]`);
    if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
  }

  el.querySelectorAll('[data-boat]').forEach(b => {
    b.onclick = () => { closeMenu(); ctx.send('toBoat', { boat: b.dataset.boat }); };
  });
  el.querySelectorAll('.wr-act[data-do]').forEach(b => {
    b.onclick = () => { if (!b.disabled) startAction(el, st, ctx, b.dataset.do); };
  });

  if (frozenNow) {
    el.querySelectorAll('.wr-act').forEach(b => { b.disabled = true; });
  }
  paintPlan(el, st, ctx);
}

/* ── ตัวเลือกก่อนยืนยัน ───────────────────────────────────
   บาง Action ต้องรู้รายละเอียดก่อนถึงจะส่งได้ เช่นจะยิงลำไหน เก็บกล่องไว้ฝั่งไหน
   จึงเปิดแผงเล็ก ๆ ให้เลือกก่อน แล้วค่อยส่งทีเดียว ไม่ยิงคำขอครึ่ง ๆ กลาง ๆ ขึ้นไป */
function startAction(el, st, ctx, act) {
  if (act === 'attack') {
    /* สั่งยิงไม่ต้องเลือกอะไรล่วงหน้าแล้ว เลือกเป้าทีหลังตอนรู้ผลว่ายิงติด */
    plan = { act };
  } else if (act === 'shiftCargo') {
    plan = { act, from: 'B' };
  } else if (act === 'kick') {
    plan = { act, uid: null };
  } else {
    /* ที่เหลือไม่มีตัวเลือกอะไร แต่ยังต้องยืนยันเหมือนกันทุกอัน
       จะได้ไม่มี Action ไหนที่กดพลาดแล้วเกิดขึ้นทันที */
    plan = { act };
  }
  paint(el);
}

/* แถวตัวเลือกกับปุ่มยืนยัน — ใช้ร่วมกันทั้งคอลัมน์ล่าง เมนูข้างหมาก และฉากกลางจอ
   เขียนที่เดียวจะได้ไม่มีทางที่สองที่ถามไม่เหมือนกัน */
export function planBody(st, ctx) {
  if (!plan) return '';

  const pick = (field, value, label) =>
    `<button class="wr-chip${plan[field] === value ? ' on' : ''}"
       data-set="${field}" data-val="${esc(value)}">${esc(label)}</button>`;

  let rows = '';
  if (plan.act === 'aimAt') {
    rows = `<div class="wr-plan-row"><span>${esc(t('wreck.plan.target'))}</span>
      <span class="wr-chip on">${esc(t('wreck.place.' + plan.target))}</span></div>`;
  } else if (plan.act === 'shiftCargo' && plan.box) {
    /* เลือกกล่องจากกระดานมาแล้ว ไม่ต้องถามทิศซ้ำ บอกแค่ว่าจะย้ายไปไหน */
    const to = plan.from === 'B' ? 'F' : 'B';
    rows = `<div class="wr-plan-row"><span>${esc(t('wreck.plan.move'))}</span>
      <span class="wr-chip on">${esc(t('wreck.' + (plan.from === 'B' ? 'british' : 'france')))}
        \u2192 ${esc(t('wreck.' + (to === 'B' ? 'british' : 'france')))}</span></div>`;
  } else if (plan.act === 'shiftCargo') {
    /* บอกจำนวนกล่องจริงของทั้งสองฝั่ง และปิดทิศที่ทำไม่ได้
       ของเดิมมีแค่ปุ่มสองปุ่มที่ไม่บอกอะไรเลยว่ากำลังย้ายอะไรไปไหน */
    const here = placeOf(st.pos[ctx.me.uid]);
    const box = st.cargo?.[here] || { B: 0, F: 0 };
    const cap = 3;
    const dir = (from, to, label) => {
      const off = !box[from] || box[to] >= cap;
      return `<button class="wr-dir${plan.from === from ? ' on' : ''}${off ? ' off' : ''}"
        data-set="from" data-val="${from}"${off ? ' disabled' : ''}>
          <span class="wr-dir-line">${esc(label)}</span>
          <span class="wr-dir-n">${box[from]} \u2192 ${box[to] + 1}</span>
        </button>`;
    };
    rows = `<div class="wr-plan-row wr-plan-dirs">
      ${dir('B', 'F', t('wreck.plan.bToF'))}${dir('F', 'B', t('wreck.plan.fToB'))}</div>`;
  } else if (plan.act === 'kick') {
    const here = occupants(st.pos, placeOf(st.pos[ctx.me.uid])).filter(u => u !== ctx.me.uid);
    rows = plan.uid
      ? `<div class="wr-plan-row"><span>${esc(t('wreck.plan.who'))}</span>
          <span class="wr-chip on">${esc(st.names?.[plan.uid] || '?')}</span></div>`
      : `<div class="wr-plan-row"><span>${esc(t('wreck.plan.who'))}</span>
          ${here.map(u => pick('uid', u, st.names?.[u] || '?')).join('')}</div>`;
  } else if (plan.act === 'playHeld') {
    const c = eventById(plan.card);
    rows = `<div class="wr-plan-row"><span>${esc(t('wreck.plan.card'))}</span>
      <span class="wr-chip on">${esc(c ? (c[lang] || c.th).name : plan.card)}</span></div>`;
  } else if (plan.act === 'useCard') {
    /* หัวข้อกับป้ายกำกับต้องเป็นของการ์ดใบนั้น ไม่ใช่ข้อความกลาง
       ของเดิมยืมของปืนพกมาใช้ทุกใบ จดหมายเลยขึ้นว่า "ไล่ลงเรือ" ทั้งที่กำลังเชิญขึ้นเรือ */
    const step = st.pending?.needs || 'player';
    const isShip = step === 'ship';
    rows = `<div class="wr-plan-row"><span>${esc(t(askKey(st.pending?.card, step)))}</span>
      <span class="wr-chip on">${esc(isShip
        ? t('wreck.place.' + plan.target)
        : (st.names?.[plan.target] || '?'))}</span></div>`;
  } else if (plan.act === 'toBoat') {
    rows = `<div class="wr-plan-row"><span>${esc(t('wreck.act.toBoat'))}</span>
      <span class="wr-chip on">${esc(t('wreck.place.' + plan.boat))}</span></div>`;
  }

  const blocked = plan.act === 'kick' && !plan.uid;
  const headKey = plan.act === 'useCard' && st.pending?.card
    ? 'wreck.card.' + st.pending.card
    : 'wreck.act.' + plan.act;
  return `<div class="wr-plan-head">${esc(t(headKey))}</div>${rows}
    <div class="wr-plan-go">
      <button class="wr-act" data-plan="go"${blocked ? ' disabled' : ''}>
        ${esc(t('wreck.plan.confirm'))}</button>
      <button class="wr-act ghost" data-plan="off">${esc(t('wreck.cancel'))}</button>
    </div>`;
}

/* ผูกปุ่มของแผน — ใช้ได้กับทุกที่ที่วาดแผนออกมา */
export function wirePlan(box, el, ctx) {
  box.querySelectorAll('[data-set]').forEach(b => {
    b.onclick = () => { plan = { ...plan, [b.dataset.set]: b.dataset.val }; paint(el); };
  });
  const off = box.querySelector('[data-plan="off"]');
  if (off) off.onclick = () => { plan = null; closeMenu(); paint(el); };
  const go = box.querySelector('[data-plan="go"]');
  if (go) go.onclick = () => {
    if (!plan) return;      /* กดซ้ำหรือแผนถูกล้างไปแล้ว อย่าให้ล้มทั้งหน้า */
    const { act, via, ...rest } = plan;
    void via;
    plan = null;
    closeMenu();
    ctx.send(act, rest);
  };
}

/* แผงยืนยันของคอลัมน์ล่าง — แผนที่เริ่มจากที่อื่นจะไปโผล่ที่นั่นแทน */
function paintPlan(el, st, ctx) {
  const box = el.querySelector('.wr-plan');
  if (!box) return;

  if (!plan) {
    box.hidden = true;
    if (box.dataset.sig) { box.dataset.sig = ''; box.innerHTML = ''; }
    return;
  }

  const html = planBody(st, ctx);
  box.hidden = false;
  if (box.dataset.sig === html) return;
  box.dataset.sig = html;
  box.innerHTML = html;
  wirePlan(box, el, ctx);
}

function paintVote(el, st, ctx) {
  const box = el.querySelector('.wr-vote-panel');
  if (!box) return;
  const me = ctx.me.uid;
  let html = '';

  if (st.phase === 'over' && st.result) {
    const r = st.result;
    html = `<div class="wr-vote-head">${esc(t('wreck.over.win.' + r.side))}</div>
      <p class="wr-vote-note">${esc(t('wreck.over.score', { B: r.score.B, F: r.score.F }))}</p>
      <div class="wr-vote-dots">` + (st.seats || []).map(u =>
        `<span class="wr-dot${r.winners.includes(u) ? ' on' : ''}">${
          esc((st.names?.[u] || '?') + ' \u00b7 ' + t('wreck.nation.' + (r.nations?.[u] || 'D')))}</span>`
      ).join('') + `</div>`;
  } else if (st.vote) {
    const v = st.vote;
    const left = v.voters.filter(u => !v.done.includes(u));
    const head = t('wreck.vote.calling.' + v.kind, { name: st.names?.[v.caller] || '?' });
    html = `<div class="wr-vote-head">${esc(head)}</div>`;
    html += v.voters.includes(me)
      ? `<p class="wr-vote-note">${esc(v.done.includes(me)
          ? t('wreck.vote.sent') : t('wreck.vote.pick'))}</p>`
      : `<p class="wr-vote-note">${esc(t('wreck.vote.elsewhere'))}</p>`;
    html += `<p class="wr-vote-note">${esc(t('wreck.vote.waiting', { n: left.length }))}</p>`;
    html += `<div class="wr-vote-dots">` + v.voters.map(u =>
      `<span class="wr-dot${v.done.includes(u) ? ' on' : ''}">${esc(st.names?.[u] || '?')}</span>`
    ).join('') + `</div>`;
  }
  /* ผลการโหวตไปโชว์ในฉากกลางกระดานแล้ว ไม่ต้องมีแผงซ้ำที่มุมล่าง */

  box.hidden = !html;
  if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
}

/* ── บันทึกเหตุการณ์ ──────────────────────────────────────
   เก็บมาเป็นคีย์ภาษา แปลตอนวาด คนละเครื่องตั้งภาษาต่างกันจึงอ่านได้ทั้งคู่ */
function paintLog(el, st) {
  const box = el.querySelector('.wr-log');
  if (!box) return;
  const rows = (st.log || []).slice(-5).reverse();
  const html = rows.map(e => `<li>${esc(t(e.key, e.args || {}))}</li>`).join('');
  box.hidden = !html;
  if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
}

/* ── รายชื่อผู้เล่นพร้อมบทบาท ─────────────────────────────── */
function paintRoster(el, st, ctx) {
  const live_ = live?.state || st;
  const pd = live_.pending?.by === ctx.me.uid ? live_.pending : null;
  const hot = pd?.needs === 'player'
    ? targetsOf(live_, ctx.me.uid, pd.card, pd.needs, pd.picks || {}) : [];

  const html = (st.seats || []).map(uid => {
    const role = roleOf(st.pos?.[uid]);
    const turn = st.turn === uid;
    const pick = hot.includes(uid);
    const birds = st.marks?.[uid]?.bird || 0;
    const tok = birds
      ? `<img class="wr-row-token" src="${esc(tokenArt('albatross_icon'))}" alt=""
           draggable="false" title="${esc(t('wreck.token.bird'))}"
           data-alt="${esc(tokenAlt('albatross_icon'))}"
           onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt='';}else{this.remove();}">`
      : '';
    return `<li class="wr-row${turn ? ' turn' : ''}${pick ? ' pick-target' : ''}"
      ${pick ? `data-pick="${esc(uid)}"` : ''}>${tok}
      ${avatarFace(uid, st.names?.[uid] || '', (ctx.avatars || {})[uid], 26)}
      <span class="wr-row-name">${esc(st.names?.[uid] || '?')}${uid === ctx.me.uid ? ' \u00b7' : ''}</span>
      ${role ? `<span class="wr-tag wr-tag-${role}">${esc(t('wreck.role.' + role))}</span>` : ''}
    </li>`;
  }).join('');

  const box = el.querySelector('.wr-list');
  if (box.dataset.sig !== html) {
    box.dataset.sig = html;
    box.innerHTML = html;
    /* คลิกชื่อในรายชื่อก็เลือกเป้าได้ ต้องมีปุ่มยืนยันเหมือนกดบนกระดาน */
    box.querySelectorAll('[data-pick]').forEach(li => {
      li.onclick = () => {
        plan = { act: 'useCard', target: li.dataset.pick, via: 'menu' };
        openMenu(el, li, { kind: 'aim' });
        paint(el);
      };
    });
  }
}

/* ── กล่องสมบัติ ───────────────────────────────────────────── */

function cargoOf(p, st, meUid) {
  const c = st.cargo || {};
  /* เช็กรายฝั่ง เพราะฝั่งหนึ่งอาจย้ายได้ อีกฝั่งเต็มปลายทางแล้ว */
  const hotSide = (side) => canTouchCargo(st.pos?.[meUid], st.pos, p.id, st.cargo, side);
  /* ธงประจำฝั่ง ใช้ไฟล์เดียวกับไอคอนบนไพ่โหวต จะได้เป็นภาษาเดียวกันทั้งเกม */
  const flag = (f) =>
    `<img class="wr-flag" src="${iconSrc(f.side === 'B' ? 'B' : 'R')}" alt=""
      draggable="false" style="left:${f.x}%; top:${f.y}%; width:${FLAG_SIZE}%">`;

  const box = (s, size, side, i) => {
    const hot = hotSide(side === 'b' ? 'B' : 'F');
    return `<img class="wr-box wr-box-${side}${hot ? ' hot' : ' locked'}"
      src="${ART}Cargo.png" alt=""
      ${hot ? `data-cargo="${p.id}:${side}:${i}"` : ''}
      style="left:${s.x}%; top:${s.y}%; width:${size}%; --boxrot:${s.r || 0}deg">`;
  };

  if (p.kind === 'ship') {
    const d = c[p.id] || { B: 0, F: 0 };
    return [
      ...SHIP_FLAGS.map(flag),
      ...SHIP_CARGO.B.slice(0, d.B).map((s, i) => box(s, SHIP_CARGO_SIZE, 'b', i)),
      ...SHIP_CARGO.F.slice(0, d.F).map((s, i) => box(s, SHIP_CARGO_SIZE, 'f', i))
    ].join('');
  }
  if (p.kind === 'island') {
    const d = c.island || { B: 0, F: 0 };
    return [
      ...ISLAND_FLAGS.map(flag),
      ...ISLAND_CARGO.B.slice(0, d.B).map((s, i) => box(s, ISLAND_CARGO_SIZE, 'b', i)),
      ...ISLAND_CARGO.F.slice(0, d.F).map((s, i) => box(s, ISLAND_CARGO_SIZE, 'f', i))
    ].join('');
  }
  if (p.kind === 'merchant') {
    return MERCHANT_CARGO.slice(0, c.merchant || 0)
      .map((s, i) => box(s, MERCHANT_CARGO_SIZE, 'n', i)).join('');
  }
  return '';
}

/* ── แถบนับกล่อง ───────────────────────────────────────────── */

function legend(st) {
  const c = st.cargo || {};
  const B = (c.shipL?.B || 0) + (c.shipR?.B || 0) + (c.island?.B || 0);
  const F = (c.shipL?.F || 0) + (c.shipR?.F || 0) + (c.island?.F || 0);
  return `
    <span class="wr-score wr-b">${esc(t('wreck.british'))} ${B}</span>
    <span class="wr-score wr-f">${esc(t('wreck.france'))} ${F}</span>
    <span class="wr-score wr-n">${esc(t('wreck.merchant'))} ${c.merchant || 0}</span>`;
}
