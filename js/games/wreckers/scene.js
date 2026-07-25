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
  deckCard: 900,   // ใบจากกองกลางสไลด์เข้ามาแล้วค้างให้ทัน
  merge: 700,      // วิ่งมาซ้อนกัน
  vanish: 480,     // หุบหาย
  tick: 200,       // ระยะห่างของไอคอนแต่ละตัว
  verdict: 320
};

const ATTACK_ORDER = [
  { ch: 'C', file: 'cannon', key: 'wreck.sym.C' },
  { ch: 'F', file: 'torch',  key: 'wreck.sym.F' },
  { ch: 'W', file: 'water',  key: 'wreck.sym.W' }
];

let key = '';        // ฉาก (หนึ่งการโหวตทั้งกระบวน)
let at = 0;          // เริ่มฉากตอนกี่โมง
let stage = '';      // ช่วงย่อยที่สร้าง DOM ไปแล้ว
let stageAt = 0;     // ช่วงย่อยเริ่มตอนกี่โมง
let raf = 0;
let seen = new Set();
let sendFn = null;

const now = () => performance.now();

/* หนึ่งฉาก = หนึ่งการโหวตทั้งกระบวน ตั้งแต่สั่งจนกัปตันเลือกเสร็จ
   ผูกกับคนสั่งกับสถานที่ ไม่ผูกกับช่วง จึงไม่ถูกตัดใหม่กลางทาง */
function sceneKey(st) {
  if (st.vote) return `ep:${st.vote.caller}:${st.vote.place}`;
  if (st.aim) return `ep:${st.aim.by}:${st.aim.place}`;
  if (st.lastVote) return `ep:${st.lastVote.caller}:${st.lastVote.place}`;
  return '';
}

export function stopScene() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0; key = ''; stage = ''; seen = new Set();
}

function setStage(name) {
  if (stage === name) return false;
  stage = name; stageAt = now();
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

  if (key !== want) {
    key = want; at = now(); stage = ''; seen = new Set();
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
  if (!body.hidden) {
    if (st.vote) busy = collect(body, st) || busy;
    else if (st.lastVote && !doneShowing(st)) busy = reveal(body, st) || busy;
    else if (st.aim) aim(body, st, ctx);
    else busy = reveal(body, st) || busy;
  }

  /* ขอเฟรมถัดไปเฉพาะตอนที่ยังมีอะไรขยับจริง ๆ */
  if (busy) raf = requestAnimationFrame(() => paintScene(el, st, ctx));
}

/* เล่าจบแล้วหรือยัง — จบแล้วก็หยุดขอเฟรม ปล่อยให้ค้างไว้เฉย ๆ */
function doneShowing(st) {
  return stage === 'tally' && !!st.aim;
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
  if (setStage('collect')) {
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
function reveal(body, st) {
  const v = st.lastVote;
  if (!v) return false;
  const pot = v.pot || [];

  if (setStage('pot')) {
    let row = body.querySelector('.wr-vb-row');
    if (!row) {
      /* เข้ามากลางคัน ไม่ทันเห็นช่วงรอไพ่ ก็สร้างไพ่ทั้งกองขึ้นมาเลย */
      body.innerHTML = `<div class="wr-vb-row"></div><p class="wr-scene-note"></p>`;
      row = body.querySelector('.wr-vb-row');
      pot.slice(0, -1).forEach(() => row.appendChild(voteBack('')));
    }
    row.classList.remove('wiggle');
    const extra = voteBack('');
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
  if (ms < T.deckCard + T.merge + T.vanish) return true;

  return tally(body, v);
}

function tally(body, v) {
  if (setStage('tally')) {
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
        ).join('')}</span><span class="wr-tally-n">0</span>`;
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
    const num = row.querySelector('.wr-tally-n');
    if (num.textContent !== String(vis)) num.textContent = String(vis);
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
  if (!setStage('aim:' + want)) return;

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
}

/* ยังต้องมีให้ ui.js เรียกได้ แม้ตอนนี้จะไม่ได้ใช้แผนในฉากแล้ว */
export const setPlanView = () => {};
export const setPlanWire = () => {};
