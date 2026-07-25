/* scene.js — ฉากกลางจอตอนโหวต
   ─────────────────────────────────────────────────────────────
   แยกออกมาจาก ui.js เพราะเป็นคนละเรื่องกัน — ui.js วาดสถานะปัจจุบัน
   ส่วนไฟล์นี้เล่า "ลำดับเวลา" ซึ่งต้องมีนาฬิกาของตัวเองและจำได้ว่าเล่าถึงไหนแล้ว

   ลำดับที่เล่า
     1  เส้นสองเส้นวิ่งจากซ้ายกับขวามาบรรจบกลางจอ แล้วชื่อการโหวตโผล่มา
     2  ชื่อย่อลงแล้วเลื่อนขึ้น เปิดที่ว่างให้ของข้างล่าง
     3  ไพ่คว่ำโผล่ทีละใบตามคนที่ส่งไพ่แล้ว พร้อมชื่อคนส่ง และรายชื่อคนที่ยังไม่ส่ง
     4  ครบทุกคนแล้วเติมใบจากกองกลางอีกหนึ่ง
     5  ไพ่ทั้งหมดวิ่งมาซ้อนกันเป็นกองเดียว แล้วย่อหายไป
     6  ผลนับขึ้นทีละสัญลักษณ์ — ปืนใหญ่ให้ครบ แล้วไฟ แล้วน้ำ
     7  สรุปว่ายิงติดหรือไม่ติด แล้วฉากปิด

   หลักการเดียวที่ยึด: **สถานะเป็นคนบอกว่าอยู่ช่วงไหน เวลาเป็นคนบอกว่าเล่าถึงไหน**
   ถ้าใครเข้ามากลางคันหรือรีเฟรช จะเห็นช่วงที่ถูกต้องเสมอ แค่ไม่ได้ดูตั้งแต่ต้น
   ───────────────────────────────────────────────────────────── */

import { t } from '../../i18n.js';
import { occupants } from './rules.js';
import { VOTE_ART } from './vote.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const VOTE_BACK = `${VOTE_ART}back.png`;

/* จังหวะของแต่ละช่วง หน่วยเป็นมิลลิวินาที รวมกันแล้วราวหกวินาทีครึ่ง */
const T = {
  lines: 620,      // เส้นวิ่งมาบรรจบ
  pop: 340,        // ชื่อโผล่
  hold: 480,       // ค้างให้อ่าน
  shrink: 460,     // ย่อแล้วเลื่อนขึ้น
  deckCard: 460,   // ใบจากกองกลางไหลเข้า
  merge: 620,      // ไพ่วิ่งมาซ้อนกัน
  vanish: 420,     // กองย่อหายไป
  tick: 190,       // ระยะห่างของสัญลักษณ์แต่ละตัวตอนนับ
  verdict: 900,    // ค้างที่คำตัดสิน
  done: 1100       // ค้างก่อนปิดฉาก
};

/* สัญลักษณ์ในแถวโจมตี เรียงตามลำดับที่จะนับขึ้นมา */
const ATTACK_ORDER = [
  { ch: 'C', file: 'cannon', key: 'wreck.sym.C' },
  { ch: 'F', file: 'torch',  key: 'wreck.sym.F' },
  { ch: 'W', file: 'water',  key: 'wreck.sym.W' }
];

/* ── สถานะของตัวเล่าเรื่อง ────────────────────────────────
   จำไว้ว่ากำลังเล่าฉากไหนอยู่ และเริ่มเล่าตอนกี่โมง
   ฉากเปลี่ยนเมื่อไหร่ก็เริ่มนับเวลาใหม่ */
let scene = null;      // { key, at, raf }
let host = null;       // element ที่ฉากอยู่

const now = () => performance.now();
const since = () => (scene ? now() - scene.at : 0);

/* กุญแจของฉาก — เปลี่ยนเมื่อไหร่แปลว่าเป็นฉากใหม่ ต้องเริ่มเล่าใหม่ */
function sceneKey(st, me) {
  if (st.vote) return `call:${st.vote.kind}:${st.vote.caller}:${st.vote.place}`;
  if (st.aim) return `aim:${st.aim.by}:${st.aim.target || ''}`;
  if (st.lastVote) return `show:${st.lastVote.at}`;
  return '';
}

export function stopScene() {
  if (scene?.raf) cancelAnimationFrame(scene.raf);
  scene = null;
}

/* ── วาด ───────────────────────────────────────────────────
   เรียกทุกครั้งที่สถานะเปลี่ยน และเรียกตัวเองซ้ำด้วย rAF ระหว่างที่ยังเล่าไม่จบ */
export function paintScene(el, st, ctx) {
  const box = el.querySelector('.wr-scene');
  if (!box) return;
  host = el;

  const me = ctx.me.uid;
  const key = sceneKey(st, me);

  if (!key) {
    box.hidden = true;
    if (box.dataset.sig) { box.dataset.sig = ''; box.innerHTML = ''; }
    stopScene();
    return;
  }

  if (!scene || scene.key !== key) {
    stopScene();
    scene = { key, at: now(), raf: 0 };
  }

  /* กัปตันต้องคลิกเรือบนกระดาน ฉากจึงต้องไม่บังกระดานของเขา */
  const aiming = st.aim && st.aim.by === me && !st.aim.target;
  box.classList.toggle('clear', !!aiming);

  const html = render(st, ctx);
  box.hidden = false;
  if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; wire(box, ctx); }

  /* ยังเล่าไม่จบก็ขอเฟรมถัดไป จบแล้วก็หยุด ไม่กินซีพียูทิ้งไว้ */
  if (!finished(st, ctx)) {
    scene.raf = requestAnimationFrame(() => paintScene(el, st, ctx));
  }
}

const finished = (st, ctx) =>
  !st.vote && !st.aim && since() > total(st);

function total(st) {
  const n = (st.lastVote?.pot || []).length;
  return T.deckCard + T.merge + T.vanish + n * T.tick + T.verdict + T.done + 2000;
}

/* ── ชิ้นส่วน ───────────────────────────────────────────── */

function titleOf(st, ctx) {
  const v = st.vote || st.lastVote;
  const who = st.aim ? st.aim.by : v?.caller;
  const role = st.aim ? 'captain'
    : v?.kind === 'mutiny' ? 'mate'
    : v?.kind === 'islandVote' ? 'governor' : 'captain';
  const line = st.aim ? 'wreck.scene.aim'
    : v?.kind === 'mutiny' ? 'wreck.scene.mutiny'
    : v?.kind === 'islandVote' ? 'wreck.scene.brawl' : 'wreck.scene.shoot';
  return {
    who: `${t('wreck.role.' + role)} \u00b7 ${st.names?.[who] || '?'}`,
    big: t(line)
  };
}

function render(st, ctx) {
  const ms = since();
  const { who, big } = titleOf(st, ctx);

  /* ชื่อย่อขึ้นไปข้างบนหลังจากค้างให้อ่านแล้ว */
  const up = ms > T.lines + T.pop + T.hold;
  const head = `<div class="wr-scene-title${up ? ' up' : ''}">
      <span class="wr-scene-lines"><i></i><i></i></span>
      <span class="wr-scene-who">${esc(who)}</span>
      <strong class="wr-scene-big">${esc(big)}</strong>
    </div>`;

  if (ms < T.lines + T.pop + T.hold) return head;

  return head + `<div class="wr-scene-body">${
      st.vote ? collect(st, ctx)
    : st.aim ? aim(st, ctx)
    : reveal(st, ctx)
  }</div>`;
}

/* ช่วงรอไพ่ — ไพ่คว่ำโผล่ทีละใบตามคนที่ส่งแล้ว */
function collect(st, ctx) {
  const v = st.vote;
  const left = v.voters.filter(u => !v.done.includes(u));
  const cards = v.done.map((uid, i) => `
    <span class="wr-vb" style="animation-delay:${i * 60}ms">
      <img src="${esc(VOTE_BACK)}" alt="" draggable="false">
      <span class="wr-vb-name">${esc(st.names?.[uid] || '?')}</span>
    </span>`).join('');

  const wait = left.length
    ? t('wreck.scene.waiting', { who: left.map(u => st.names?.[u] || '?').join(', ') })
    : t('wreck.scene.allIn');

  return `<div class="wr-vb-row wiggle">${cards}</div>
    <p class="wr-scene-note">${esc(wait)}</p>`;
}

/* ช่วงเปิดผล — เติมใบกองกลาง ซ้อนกัน ย่อหาย แล้วนับสัญลักษณ์ */
function reveal(st, ctx) {
  const v = st.lastVote;
  if (!v) return '';
  const ms = since();
  const pot = v.pot || [];

  const tMerge = T.deckCard;
  const tVanish = tMerge + T.merge;
  const tCount = tVanish + T.vanish;

  if (ms < tCount) {
    const merged = ms > tMerge;
    const gone = ms > tVanish;
    const cards = pot.map((_, i) => `
      <span class="wr-vb${i === pot.length - 1 ? ' from-deck' : ''}"
        style="--i:${i}; --n:${pot.length}">
        <img src="${esc(VOTE_BACK)}" alt="" draggable="false">
      </span>`).join('');
    return `<div class="wr-vb-row${merged ? ' merge' : ''}${gone ? ' gone' : ''}">${cards}</div>
      <p class="wr-scene-note">${esc(t('wreck.scene.shuffling'))}</p>`;
  }

  /* นับทีละสัญลักษณ์ — ปืนใหญ่ให้ครบก่อน แล้วไฟ แล้วน้ำ */
  const rows = [];
  let shown = 0;
  const step = Math.floor((ms - tCount) / T.tick);

  for (const sym of ATTACK_ORDER) {
    const total = v.counts?.[sym.ch] || 0;
    const vis = Math.max(0, Math.min(total, step - shown));
    shown += total;
    if (!total) continue;
    rows.push(`<div class="wr-tally${vis ? ' on' : ''}">
      <span class="wr-tally-name">${esc(t(sym.key))}</span>
      <span class="wr-tally-pips">${
        Array.from({ length: total }, (_, i) =>
          `<img class="wr-pip${i < vis ? ' in' : ''}" src="${esc(VOTE_ART)}${sym.file}.png"
             alt="" draggable="false" style="animation-delay:${i * 40}ms">`).join('')
      }</span>
      <span class="wr-tally-n">${vis}</span>
    </div>`);
  }

  const all = ATTACK_ORDER.reduce((n, s) => n + (v.counts?.[s.ch] || 0), 0);
  const verdictAt = tCount + all * T.tick + 260;
  const done = ms > verdictAt;
  const win = v.won === true;

  const verdict = !done ? '' : `<p class="wr-scene-verdict ${win ? 'win' : 'fail'}">${
    esc(t(win ? 'wreck.scene.hit' : 'wreck.scene.miss'))}</p>`;

  return `<div class="wr-tallies">${rows.join('')}</div>${verdict}`;
}

/* ช่วงกัปตันเลือก — คนอื่นเห็นแค่ว่ากำลังรอ */
function aim(st, ctx) {
  const mine = st.aim.by === ctx.me.uid;
  if (!mine) {
    return `<p class="wr-scene-note">${esc(t('wreck.scene.waitAim', {
      name: st.names?.[st.aim.by] || '?' }))}</p>`;
  }
  if (!st.aim.target) {
    return `<p class="wr-scene-note">${esc(t('wreck.scene.pickShip'))}</p>`;
  }
  return `<p class="wr-scene-note">${esc(t('wreck.scene.pickSide'))}</p>
    <div class="wr-scene-btns">
      <button class="wr-scene-btn n-B" data-side="B">${esc(t('wreck.british'))}</button>
      <button class="wr-scene-btn n-F" data-side="F">${esc(t('wreck.france'))}</button>
    </div>`;
}

function wire(box, ctx) {
  box.querySelectorAll('[data-side]').forEach(b => {
    b.onclick = () => ctx.send('storeAt', { side: b.dataset.side });
  });
}
