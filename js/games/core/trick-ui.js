/* trick-ui.js — หน้าจอของเกมไพ่ตระกูลสลาฟ
   ─────────────────────────────────────────────────────────────
   วาดอย่างเดียว ห้ามตัดสินอะไรทั้งสิ้น เพราะไฟล์นี้รันบนเครื่องผู้เล่นทุกคน
   ส่วนกติกาตัดสินที่ game.js ซึ่งรันบนเครื่องเจ้าของห้องคนเดียว
   ───────────────────────────────────────────────────────────── */

import { t } from '../../i18n.js';
import { cardFace, cardBack, cardRow } from './face.js';
import { readCombo, beats, sortForHand } from './cards.js';
import { makeSound } from './trick-sound.js';
import { resolve } from './trick-game.js';

export function makeUI(baseRules, effects) {
const Sound = makeSound(effects);

let picked = [];          // ไพ่ที่เลือกอยู่ ต้องอยู่นอกฟังก์ชันวาด ไม่งั้นหายทุกครั้งที่รีเฟรช
let pickedFor = '';       // ปุ่มสถานะที่ picked ผูกอยู่ ใช้ล้างเมื่อเปลี่ยนตา
let showBoard = false;

const CARD_W = 68;
const HAND_MAX = 860;      // ความกว้างที่ยอมให้มือกางได้บนจอคอม

/* ระยะเลื่อนต่อใบ — ยิ่งไพ่เยอะยิ่งซ้อนกันมากขึ้นเอง แต่ไม่แคบกว่ามุมไพ่ */
function handStep(n) {
  if (n <= 1) return CARD_W;
  return Math.round(Math.max(26, Math.min(CARD_W * 0.62, (HAND_MAX - CARD_W) / (n - 1))));
}
const handStyle = (n) => `--cw:${CARD_W}px; --step:${handStep(n)}px`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

const nameOf = (st, uid) => st.names?.[uid] || '?';
const rulesOf = (ctx) => resolve(baseRules, ctx.settings);
const myHand = (ctx) => sortForHand((ctx.secret && ctx.secret.hand) || [], !!ctx.state?.revolution);

function render(el, ctx) {
  const st = ctx.state;
  if (!st || !st.phase) { el.innerHTML = ''; Sound.reset(); return; }
  Sound.react(st);

  const key = `${st.phase}:${st.roundNo}:${st.turn}:${st.seq || ''}`;
  if (key !== pickedFor) { picked = []; pickedFor = key; }

  el.innerHTML = `
    <div class="slave">
      ${header(st)}
      ${body(st, ctx)}
    </div>
    ${showBoard ? board(st) : ''}
  `;
  bind(el, ctx);
}

/* ── หัวโต๊ะ ───────────────────────────────────────────────── */

function header(st) {
  const bits = [
    t('trick.round', { n: st.roundNo }),
    t(`game.${baseRules.id}.mode.${st.mode}`)
  ];
  return `<div class="slave-head">
    <span class="slave-round">${esc(bits.join(' · '))}</span>
    ${st.revolution ? `<span class="rev-badge">${esc(t('trick.revolution'))}</span>` : ''}
    ${st.mode === 'endless'
      ? `<button class="btn btn-slim" data-act="board">${esc(t(showBoard ? 'slave.hideBoard' : 'slave.showBoard'))}</button>`
      : ''}
  </div>`;
}

/* ── ตัวเนื้อตามช่วงของเกม ─────────────────────────────────── */

function body(st, ctx) {
  if (st.phase === 'exchange') return exchange(st, ctx);
  if (st.phase === 'roundEnd' || st.phase === 'gameOver') return result(st, ctx);
  return table(st, ctx);
}

/* ── โต๊ะระหว่างเล่น ───────────────────────────────────────── */

function table(st, ctx) {
  const me = ctx.me.uid;
  const mine = myHand(ctx);
  const myTurn = st.turn === me;
  const out = (st.finished || []).includes(me) || st.toppled === me;

  const rev = !!st.revolution;
  const rules = rulesOf(ctx);
  const combo = picked.length ? readCombo(picked, rules) : null;
  const canPlay = myTurn && combo && beats(picked, st.pile, rules, rev)
    && (!st.mustInclude || picked.includes(st.mustInclude));
  const canPass = myTurn && !!st.pile;

  return `
    ${seatStrip(st, ctx)}
    <div class="slave-centre">
      ${st.pile
        ? cardRow(st.pile.cards, 58) + `<p class="slave-by">${esc(t('trick.playedBy', { name: nameOf(st, st.pile.by) }))}</p>`
        : `<p class="slave-empty">${esc(t('trick.emptyPile'))}</p>`}
      <p class="slave-status">${esc(statusLine(st, ctx))}</p>
      ${st.notice ? `<p class="slave-notice">${esc(noticeLine(st))}</p>` : ''}
    </div>

    ${out ? `<p class="slave-done">${esc(t('trick.youAreOut'))}</p>` : `
      <div class="slave-hand" id="slaveHand" style="${handStyle(mine.length)}">
        ${mine.map(c => `<button class="hand-card${picked.includes(c) ? ' on' : ''}" data-card="${c}">${cardFace(c, CARD_W)}</button>`).join('')}
      </div>
      <div class="slave-actions">
        <button class="btn btn-primary" data-act="play" ${canPlay ? '' : 'disabled'}>${esc(t('trick.play'))}</button>
        <button class="btn" data-act="pass" ${canPass ? '' : 'disabled'}>${esc(t('trick.pass'))}</button>
      </div>
    `}
  `;
}

/* แถบผู้เล่นรอบโต๊ะ — จำนวนไพ่ในมือคือข้อมูลสำคัญของเกมนี้ ต้องเห็นเสมอ */
function seatStrip(st, ctx) {
  const order = st.seats || [];
  return `<div class="slave-seats">${order.map(uid => {
    const n = st.counts?.[uid] ?? 0;
    const isTurn = st.turn === uid;
    const done = (st.finished || []).indexOf(uid);
    const gone = st.toppled === uid;
    const tags = [];
    if (uid === st.king) tags.push(t('trick.title.king'));
    if (done >= 0) tags.push(t('trick.place', { n: done + 1 }));
    if (gone) tags.push(t('trick.toppled'));
    if ((st.passed || []).includes(uid)) tags.push(t('trick.passed'));

    return `<div class="seat-chip${isTurn ? ' turn' : ''}${gone || done >= 0 ? ' finished' : ''}">
      <span class="seat-chip-name">${esc(nameOf(st, uid))}${uid === ctx.me.uid ? ' ·' : ''}</span>
      <span class="seat-chip-cards">${n ? cardBack(15).repeat(Math.min(n, 8)) : ''}</span>
      <span class="seat-chip-n">${n}</span>
      ${tags.length ? `<span class="seat-chip-tag">${esc(tags.join(' · '))}</span>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function statusLine(st, ctx) {
  if (st.turn === ctx.me.uid) {
    return st.mustInclude ? t('trick.yourTurnOpening') : t('trick.yourTurn');
  }
  return t('trick.waitingFor', { name: nameOf(st, st.turn) });
}

function noticeLine(st) {
  const n = st.notice;
  if (n.t === 'topple') return t('trick.noticeTopple', { by: nameOf(st, n.by), king: nameOf(st, n.king) });
  if (n.t === 'timeout') return t('trick.noticeTimeout', { name: nameOf(st, n.uid) });
  if (n.t === 'tooFew') return t('trick.noticeTooFew');
  return '';
}

/* ── ช่วงแลกไพ่ ────────────────────────────────────────────── */

function exchange(st, ctx) {
  const me = ctx.me.uid;
  const pair = (st.exchange?.pairs || []).find(p => p.upper === me);
  const already = !!st.exchange?.given?.[me];
  const lower = (st.exchange?.pairs || []).find(p => p.lower === me);

  if (lower) {
    return `<div class="slave-centre">
      <p class="slave-status">${esc(t('trick.youGiveBest', { n: lower.count }))}</p>
      <p class="slave-empty">${esc(t('trick.waitExchange'))}</p>
    </div>`;
  }
  if (!pair || already) {
    return `<div class="slave-centre">
      <p class="slave-status">${esc(t('trick.waitExchange'))}</p>
    </div>`;
  }

  const mine = myHand(ctx);
  return `
    <div class="slave-centre">
      <p class="slave-status">${esc(t('trick.pickGive', { n: pair.count, name: nameOf(st, pair.lower) }))}</p>
    </div>
    <div class="slave-hand" style="${handStyle(mine.length)}">
      ${mine.map(c => `<button class="hand-card${picked.includes(c) ? ' on' : ''}" data-card="${c}">${cardFace(c, CARD_W)}</button>`).join('')}
    </div>
    <div class="slave-actions">
      <button class="btn btn-primary" data-act="give" ${picked.length === pair.count ? '' : 'disabled'}>
        ${esc(t('trick.confirmGive'))}
      </button>
    </div>`;
}

/* ── จบรอบ / จบเกม ─────────────────────────────────────────── */

function result(st, ctx) {
  const over = st.phase === 'gameOver';
  const rows = (st.titles || []).map(x => `
    <li class="rank-row">
      <span class="rank-place">${x.place}</span>
      <span class="rank-title">${esc(t('trick.title.' + x.title))}</span>
      <span class="rank-name">${esc(nameOf(st, x.uid))}</span>
      ${st.mode === 'endless'
        ? `<span class="rank-pts">${st.gained?.[x.uid] >= 0 ? '+' : ''}${st.gained?.[x.uid] ?? 0}</span>`
        : ''}
    </li>`).join('');

  const voted = st.votes || {};
  const iVoted = voted[ctx.me.uid] !== undefined;
  const inGame = (st.seats || []).includes(ctx.me.uid);

  let controls = '';
  if (over) {
    controls = ctx.isHost
      ? `<button class="btn btn-primary" data-act="leave">${esc(t('trick.backToRoom'))}</button>`
      : `<p class="slave-empty">${esc(t('trick.waitHostRoom'))}</p>`;
  } else if (st.mode === 'endless') {
    controls = inGame && !iVoted
      ? `<button class="btn btn-primary" data-act="voteYes">${esc(t('trick.voteYes'))}</button>
         <button class="btn" data-act="voteNo">${esc(t('trick.voteNo'))}</button>`
      : `<p class="slave-empty">${esc(t('trick.waitVotes', {
            n: (st.seats || []).filter(u => voted[u] === undefined).length }))}</p>`;
  } else {
    controls = ctx.isHost
      ? `<button class="btn btn-primary" data-act="next">${esc(t('trick.nextRound'))}</button>`
      : `<p class="slave-empty">${esc(t('trick.waitHostNext'))}</p>`;
  }

  return `
    <div class="slave-centre">
      <p class="slave-status">${esc(over ? t('trick.gameOver') : t('trick.roundOver', { n: st.roundNo }))}</p>
      ${st.notice ? `<p class="slave-notice">${esc(noticeLine(st))}</p>` : ''}
    </div>
    <ol class="ranks">${rows}</ol>
    ${over && st.mode === 'endless' ? board(st) : ''}
    <div class="slave-actions">${controls}</div>`;
}

/* ── ตารางคะแนน ───────────────────────────────────────────── */

function board(st) {
  const rows = Object.entries(st.scores || {})
    .sort((a, b) => b[1] - a[1])
    .map(([uid, pts], i) => `
      <li class="rank-row">
        <span class="rank-place">${i + 1}</span>
        <span class="rank-name">${esc(nameOf(st, uid))}</span>
        <span class="rank-pts">${pts}</span>
      </li>`).join('');
  return `<div class="scoreboard">
    <h3>${esc(t('trick.scoreboard'))}</h3>
    <ol class="ranks">${rows}</ol>
  </div>`;
}

/* ── ผูกปุ่ม ───────────────────────────────────────────────── */

function bind(el, ctx) {
  el.querySelectorAll('[data-card]').forEach(b => {
    b.onclick = () => {
      const c = b.dataset.card;
      picked = picked.includes(c) ? picked.filter(x => x !== c) : [...picked, c];
      render(el, ctx);
    };
  });

  el.querySelectorAll('[data-act]').forEach(b => {
    b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'board') { showBoard = !showBoard; render(el, ctx); return; }
      if (a === 'play')  { ctx.send('play', { cards: picked }); picked = []; return; }
      if (a === 'pass')  { ctx.send('pass'); return; }
      if (a === 'give')  { ctx.send('give', { cards: picked }); picked = []; return; }
      if (a === 'next')  { ctx.send('next'); return; }
      if (a === 'voteYes') { ctx.send('vote', { yes: true }); return; }
      if (a === 'voteNo')  { ctx.send('vote', { yes: false }); return; }
      if (a === 'leave') { ctx.leave(); return; }
    };
  });
}

  return { render, reset: Sound.reset };
}
