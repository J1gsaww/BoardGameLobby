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

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const VOTE_BACK = `${VOTE_ART}back${ICON_EXT}`;

const T = {
  intro: 1480,     // เส้นวิ่ง + ชื่อโผล่ + ค้างให้อ่าน
  deckCard: 1500,  // ใบจากกองกลางสไลด์เข้ามาแล้วค้างให้ทันดู
  merge: 700,      // วิ่งมาซ้อนกัน
  vanish: 480,     // หุบหาย
  tick: 430,       // ระยะห่างของไอคอนแต่ละตัว — ช้าพอให้ลุ้นทีละอัน
  verdict: 700,
  linger: 3200     // ค้างผลไว้ให้อ่านก่อนปิดฉากเอง
};

const ATTACK_ORDER = [
  { ch: 'C', file: 'cannon', key: 'wreck.sym.C' },
  { ch: 'F', file: 'torch',  key: 'wreck.sym.F' },
  { ch: 'W', file: 'water',  key: 'wreck.sym.W' }
];

let key = '';        // ฉาก (หนึ่งการโหวตทั้งกระบวน)
let at = 0;          // เริ่มฉากตอนกี่โมง
let phase = '';      // ช่วงย่อยที่ไปถึงแล้ว
let stageAt = 0;     // ช่วงย่อยเริ่มตอนกี่โมง
let aimView = '';    // มุมมองย่อยของช่วงกัปตันเลือก
let restAt = 0;      // เวลาที่ผลขึ้นครบ ใช้นับถอยหลังก่อนปิดฉาก
let closing = false; // สั่งปิดฉากในเฟรมนี้
let raf = 0;

/* ฉากที่เล่าจบและปิดไปแล้ว จะไม่เปิดขึ้นมาอีก
   จำเป็นเพราะ lastVote ค้างอยู่ในสถานะจนกว่าจะมีการโหวตครั้งถัดไป
   ถ้าไม่จำไว้ ฉากจะกลับมาเปิดทุกครั้งที่วาดใหม่ แล้วผู้เล่นทำอะไรต่อไม่ได้เลย */
const dismissed = new Set();
let seen = new Set();
let sendFn = null;

const now = () => performance.now();

/* หนึ่งฉาก = หนึ่งการโหวตทั้งกระบวน ตั้งแต่สั่งจนกัปตันเลือกเสร็จ
   ผูกกับคนสั่งกับสถานที่ ไม่ผูกกับช่วง จึงไม่ถูกตัดใหม่กลางทาง */
function sceneKey(st) {
  if (st.vote) return `ep:${st.vote.caller}:${st.vote.place}`;
  if (st.aim) return `ep:${st.aim.by}:${st.aim.place}`;
  if (st.lastVote && !dismissed.has(st.lastVote.at))
    return `ep:${st.lastVote.caller}:${st.lastVote.place}`;
  return '';
}

export function stopScene() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0; key = ''; phase = ''; aimView = ''; seen = new Set();
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

  const want = sceneKey(st);
  if (!want) {
    if (key) { box.hidden = true; box.innerHTML = ''; stopScene(); }
    return;
  }
  closing = false;

  if (key !== want) {
    key = want; at = now(); phase = ''; aimView = ''; restAt = 0; closing = false; seen = new Set();
    box.hidden = false;
    box.innerHTML = `
      <div class="wr-scene-title">
        <span class="wr-scene-lines"><i></i><i></i></span>
        <span class="wr-scene-who"></span>
        <strong class="wr-scene-big"></strong>
      </div>
      <div class="wr-scene-body" hidden></div>`;
  }

  const ms = now() - at;
  const title = box.querySelector('.wr-scene-title');
  const body = box.querySelector('.wr-scene-body');

  /* ชื่อเปลี่ยนข้อความได้โดยไม่ต้องสร้างใหม่ แอนิเมชันจึงไม่เริ่มใหม่ */
  const head = titleOf(st);
  const who = box.querySelector('.wr-scene-who');
  const big = box.querySelector('.wr-scene-big');
  if (who.textContent !== head.who) who.textContent = head.who;
  if (big.textContent !== head.big) big.textContent = head.big;

  box.classList.toggle('clear', !!(st.aim && st.aim.by === ctx.me.uid && !st.aim.target));
  title.classList.toggle('up', ms > T.intro);
  body.hidden = ms < T.intro;

  let busy = ms < T.intro;
  if (!body.hidden) busy = step(body, st, ctx) || busy;

  /* ปิดฉากแล้วต้องซ่อนเดี๋ยวนี้เลย
     ของเดิมแค่จำว่าปิดแล้วแต่ไม่ขอเฟรมต่อ กล่องเลยค้างอยู่บนจอตลอดกาล
     เพราะไม่มีใครกลับมาเช็กว่า sceneKey กลายเป็นว่างไปแล้ว */
  if (closing) { box.hidden = true; box.innerHTML = ''; stopScene(); return; }

  /* ขอเฟรมถัดไปเฉพาะตอนที่ยังมีอะไรขยับจริง ๆ */
  if (busy) raf = requestAnimationFrame(() => paintScene(el, st, ctx));
}

/* ตัวเดินเรื่อง — ตัดสินว่าตอนนี้ควรอยู่ช่วงไหน แล้วเดินไปข้างหน้าเท่านั้น
   คืนค่า true เมื่อยังมีอะไรขยับ เพื่อขอเฟรมถัดไป */
function step(body, st, ctx) {
  if (st.vote) { goto('collect'); return collect(body, st); }

  /* เข้ามาตอนกัปตันกำลังเลือกอยู่แล้ว ก็ข้ามการเล่าย้อนหลังไปเลย */
  if (!phase && st.aim) { goto('aim'); return aim(body, st, ctx); }

  if (st.lastVote && rank(phase) < rank('tally')) {
    if (pot(body, st.lastVote)) return true;
    goto('tally');
  }

  if (phase === 'tally') {
    if (tally(body, st.lastVote)) return true;

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
    if (now() - restAt < T.linger) return true;
    if (st.lastVote) dismissed.add(st.lastVote.at);
    closing = true;
    return false;
  }
  return false;
}

function titleOf(st) {
  const v = st.vote || st.lastVote;
  const who = st.aim ? st.aim.by : v?.caller;
  const role = st.aim ? 'captain'
    : v?.kind === 'mutiny' ? 'mate'
    : v?.kind === 'islandVote' ? 'governor' : 'captain';
  const line = st.aim ? 'wreck.scene.aim'
    : v?.kind === 'mutiny' ? 'wreck.scene.mutiny'
    : v?.kind === 'islandVote' ? 'wreck.scene.brawl' : 'wreck.scene.shoot';
  return { who: `${t('wreck.role.' + role)} \u00b7 ${st.names?.[who] || '?'}`, big: t(line) };
}

/* ── รอไพ่ ─────────────────────────────────────────────── */
function collect(body, st) {
  if (goto('collect') || !body.querySelector('.wr-vb-row')) {
    body.innerHTML = `<div class="wr-vb-row wiggle"></div><p class="wr-scene-note"></p>`;
  }
  const row = body.querySelector('.wr-vb-row');

  for (const uid of st.vote.done) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    row.appendChild(voteBack(st.names?.[uid] || '?'));
  }

  const left = st.vote.voters.filter(u => !st.vote.done.includes(u));
  const note = body.querySelector('.wr-scene-note');
  const text = left.length
    ? t('wreck.scene.waiting', { who: left.map(u => st.names?.[u] || '?').join(', ') })
    : t('wreck.scene.allIn');
  if (note.textContent !== text) note.textContent = text;
  return false;    // รอคนกด ไม่ต้องขอเฟรมถี่ ๆ
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
    row.classList.remove('wiggle');
    /* ติดป้ายให้เห็นว่าใบนี้มาจากกองกลาง ไม่ใช่ของใครสักคน
       จำนวนสัญลักษณ์ที่ออกมาไม่เท่ากับจำนวนไพ่ (ใบเปล่าไม่มีสัญลักษณ์เลยสักแถว)
       ถ้าไม่ติดป้ายจะแยกไม่ออกว่าใบจากกองมาจริงหรือเปล่า */
    const extra = voteBack(t('wreck.scene.fromDeck'));
    extra.classList.add('from-deck');
    row.appendChild(extra);
    [...row.children].forEach((c, i) => {
      c.style.setProperty('--i', i);
      c.style.setProperty('--n', row.children.length);
    });
    const note = body.querySelector('.wr-scene-note');
    if (note) note.textContent = t('wreck.scene.shuffling');
  }

  /* วัดระยะห่างจริงระหว่างใบจากตัว DOM แล้วส่งให้ CSS ใช้
     ฝังเลขไว้ในซีเอสเอสแล้วพอขนาดไพ่เปลี่ยน การรวมกองจะเพี้ยนทันที */
  const rowEl = body.querySelector('.wr-vb-row');
  if (rowEl && rowEl.children.length > 1 && !rowEl.dataset.step) {
    const a = rowEl.children[0].getBoundingClientRect();
    const b = rowEl.children[1].getBoundingClientRect();
    const step = Math.round(b.left - a.left) || 72;
    rowEl.dataset.step = String(step);
    rowEl.style.setProperty('--step', step + 'px');
  }

  const ms = now() - stageAt;
  const row = body.querySelector('.wr-vb-row');
  if (row) {
    row.classList.toggle('merge', ms > T.deckCard);
    row.classList.toggle('gone', ms > T.deckCard + T.merge);
  }
  return ms < T.deckCard + T.merge + T.vanish;
}

function tally(body, v) {
  if (!v) return false;
  if (goto('tally') || !body.querySelector('.wr-tallies')) {
    stageAt = stageAt || now();
    body.innerHTML = `<div class="wr-tallies"></div>`;
    const wrap = body.querySelector('.wr-tallies');
    for (const sym of ATTACK_ORDER) {
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
  const step = Math.floor(ms / T.tick);
  let before = 0, total = 0;

  for (const sym of ATTACK_ORDER) {
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

  const endAt = total * T.tick + T.verdict;
  if (ms > endAt && !body.querySelector('.wr-scene-verdict')) {
    const p = document.createElement('p');
    p.className = 'wr-scene-verdict ' + (v.won ? 'win' : 'fail');
    p.textContent = t(v.won ? 'wreck.scene.hit' : 'wreck.scene.miss');
    body.appendChild(p);
  }
  return ms <= endAt;      // นับครบแล้วหยุดขอเฟรม ค้างไว้เฉย ๆ
}

/* ── กัปตันเลือก ───────────────────────────────────────── */
function aim(body, st, ctx) {
  const mine = st.aim.by === ctx.me.uid;
  const want = mine ? (st.aim.target ? 'side' : 'pick') : 'wait';
  if (aimView === want) return false;
  aimView = want;

  if (want === 'wait') {
    body.innerHTML = `<p class="wr-scene-note">${esc(t('wreck.scene.waitAim', {
      name: st.names?.[st.aim.by] || '?' }))}</p>`;
  } else if (want === 'pick') {
    body.innerHTML = `<p class="wr-scene-note">${esc(t('wreck.scene.pickShip'))}</p>`;
  } else {
    body.innerHTML = `<p class="wr-scene-note">${esc(t('wreck.scene.pickSide'))}</p>
      <div class="wr-scene-btns">
        <button class="wr-scene-btn n-B" data-side="B">${esc(t('wreck.british'))}</button>
        <button class="wr-scene-btn n-F" data-side="F">${esc(t('wreck.france'))}</button>
      </div>`;
    body.querySelectorAll('[data-side]').forEach(b => {
      b.onclick = () => sendFn?.('storeAt', { side: b.dataset.side });
    });
  }
  return false;
}

/* ยังต้องมีให้ ui.js เรียกได้ แม้ตอนนี้จะไม่ได้ใช้แผนในฉากแล้ว */
export const setPlanView = () => {};
export const setPlanWire = () => {};
