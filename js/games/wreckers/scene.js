/* scene.js — ฉากกลางบนกระดานตอนโหวต
   ─────────────────────────────────────────────────────────────
   บทเรียนจากรุ่นก่อน: ห้ามเขียน innerHTML ใหม่ทุกเฟรมเด็ดขาด
   ทุกครั้งที่เขียนทับ แอนิเมชัน CSS จะเริ่มนับหนึ่งใหม่ (กลายเป็นลูปไม่หยุด)
   และ <img> จะเริ่มโหลดใหม่ตั้งแต่ต้น จึงไม่มีวันโหลดเสร็จ ภาพเลยไม่เคยขึ้น

   รุ่นนี้จึง **สร้าง DOM ครั้งเดียวต่อหนึ่งช่วง** แล้วหลังจากนั้นแตะเฉพาะ
   คลาสกับข้อความ ของที่มีอยู่แล้วไม่ถูกสร้างใหม่อีกเลย
   ───────────────────────────────────────────────────────────── */

import { t } from '../../i18n.js';
import { VOTE_ART } from './vote.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const VOTE_BACK = `${VOTE_ART}back.png`;

const T = {
  lines: 620, pop: 340, hold: 520, deckCard: 520,
  merge: 640, vanish: 440, tick: 200, verdict: 300
};

const ATTACK_ORDER = [
  { ch: 'C', file: 'cannon', key: 'wreck.sym.C' },
  { ch: 'F', file: 'torch',  key: 'wreck.sym.F' },
  { ch: 'W', file: 'water',  key: 'wreck.sym.W' }
];

let key = '';
let at = 0;
let raf = 0;
let stage = '';
let seen = new Set();
let planView = null;
let onPlanWire = null;
let sendFn = null;

export const setPlanView = (html) => { planView = html || null; };
export const setPlanWire = (fn) => { onPlanWire = fn; };

const now = () => performance.now();

function sceneKey(st) {
  if (st.vote) return `call:${st.vote.kind}:${st.vote.caller}:${st.vote.place}`;
  if (st.aim) return `aim:${st.aim.by}`;
  if (st.lastVote) return `show:${st.lastVote.at}`;
  return '';
}

export function stopScene() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0; key = ''; stage = ''; seen = new Set();
}

export function paintScene(el, st, ctx) {
  const box = el.querySelector('.wr-scene');
  if (!box) return;
  sendFn = ctx.send;

  const want = sceneKey(st);
  if (!want) {
    if (key) { box.hidden = true; box.innerHTML = ''; stopScene(); }
    return;
  }

  /* ฉากใหม่ — สร้างหัวครั้งเดียว ต่อจากนี้ไม่แตะ innerHTML ของหัวอีกเลย
     หัวจึงเล่นแอนิเมชันรอบเดียวแล้วค้าง ไม่วนซ้ำ */
  if (key !== want) {
    if (raf) cancelAnimationFrame(raf);
    key = want; at = now(); stage = ''; seen = new Set();
    box.hidden = false;
    box.innerHTML = `
      <div class="wr-scene-title">
        <span class="wr-scene-lines"><i></i><i></i></span>
        <span class="wr-scene-who"></span>
        <strong class="wr-scene-big"></strong>
      </div>
      <div class="wr-scene-body" hidden></div>`;
    const head = titleOf(st);
    box.querySelector('.wr-scene-who').textContent = head.who;
    box.querySelector('.wr-scene-big').textContent = head.big;
  }

  const ms = now() - at;
  const title = box.querySelector('.wr-scene-title');
  const body = box.querySelector('.wr-scene-body');

  box.classList.toggle('clear', !!(st.aim && st.aim.by === ctx.me.uid && !st.aim.target));
  title.classList.toggle('up', ms > T.lines + T.pop + T.hold);
  body.hidden = ms < T.lines + T.pop + T.hold;

  if (!body.hidden) {
    if (st.vote) collect(body, st);
    else if (st.aim) aim(body, st, ctx);
    else reveal(body, st, ms);
  }

  raf = requestAnimationFrame(() => paintScene(el, st, ctx));
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

/* ไพ่ที่วางแล้วอยู่ต่อไปเรื่อย ๆ ใบใหม่แค่ append เข้าไป ไม่วาดใหม่ทั้งแถว */
function collect(body, st) {
  if (stage !== 'collect') {
    stage = 'collect';
    body.innerHTML = `<div class="wr-vb-row wiggle"></div><p class="wr-scene-note"></p>`;
  }
  const row = body.querySelector('.wr-vb-row');

  for (const uid of st.vote.done) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    const card = document.createElement('span');
    card.className = 'wr-vb';
    card.innerHTML = `<img src="${esc(VOTE_BACK)}" alt="" draggable="false">
      <span class="wr-vb-name">${esc(st.names?.[uid] || '?')}</span>`;
    row.appendChild(card);
  }

  const left = st.vote.voters.filter(u => !st.vote.done.includes(u));
  const note = body.querySelector('.wr-scene-note');
  const text = left.length
    ? t('wreck.scene.waiting', { who: left.map(u => st.names?.[u] || '?').join(', ') })
    : t('wreck.scene.allIn');
  if (note.textContent !== text) note.textContent = text;
}

function reveal(body, st, ms) {
  const v = st.lastVote;
  if (!v) return;
  const pot = v.pot || [];

  const tMerge = T.deckCard;
  const tVanish = tMerge + T.merge;
  const tCount = tVanish + T.vanish;

  if (ms < tCount) {
    if (stage !== 'pot') {
      stage = 'pot';
      body.innerHTML = `<div class="wr-vb-row"></div>`;
      const row = body.querySelector('.wr-vb-row');
      pot.forEach((_, i) => {
        const c = document.createElement('span');
        c.className = 'wr-vb' + (i === pot.length - 1 ? ' from-deck' : '');
        c.style.setProperty('--i', i);
        c.style.setProperty('--n', pot.length);
        c.innerHTML = `<img src="${esc(VOTE_BACK)}" alt="" draggable="false">`;
        row.appendChild(c);
      });
    }
    const row = body.querySelector('.wr-vb-row');
    row.classList.toggle('merge', ms > tMerge);
    row.classList.toggle('gone', ms > tVanish);
    return;
  }

  if (stage !== 'tally') {
    stage = 'tally';
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
            `<img class="wr-pip" src="${esc(VOTE_ART)}${sym.file}.png" alt="" draggable="false">`
          ).join('')}</span>
        <span class="wr-tally-n">0</span>`;
      wrap.appendChild(row);
    }
  }

  const step = Math.floor((ms - tCount) / T.tick);
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

  /* คำตัดสินเติมครั้งเดียวแล้วค้างอยู่ตรงนั้น */
  if (ms > tCount + total * T.tick + T.verdict && !body.querySelector('.wr-scene-verdict')) {
    const p = document.createElement('p');
    p.className = 'wr-scene-verdict ' + (v.won ? 'win' : 'fail');
    p.textContent = t(v.won ? 'wreck.scene.hit' : 'wreck.scene.miss');
    body.appendChild(p);
  }
}

function aim(body, st, ctx) {
  const mine = st.aim.by === ctx.me.uid;
  const want = mine ? (st.aim.target ? 'side' : (planView ? 'plan' : 'pick')) : 'wait';
  const sig = 'aim:' + want + (want === 'plan' ? ':' + planView.length : '');
  if (stage === sig) return;
  stage = sig;

  if (want === 'wait') {
    body.innerHTML = `<p class="wr-scene-note">${esc(t('wreck.scene.waitAim', {
      name: st.names?.[st.aim.by] || '?' }))}</p>`;
  } else if (want === 'pick') {
    body.innerHTML = `<p class="wr-scene-note">${esc(t('wreck.scene.pickShip'))}</p>`;
  } else if (want === 'plan') {
    body.innerHTML = `<div class="wr-scene-plan">${planView}</div>`;
    if (onPlanWire) onPlanWire(body);
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
