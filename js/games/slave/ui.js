/* ui.js — หน้าจอของสลาฟ
   ─────────────────────────────────────────────────────────────
   วาดอย่างเดียว ห้ามตัดสินอะไรทั้งสิ้น เพราะไฟล์นี้รันบนเครื่องผู้เล่นทุกคน
   ส่วนกติกาตัดสินที่ game.js ซึ่งรันบนเครื่องเจ้าของห้องคนเดียว
   ───────────────────────────────────────────────────────────── */

import { t } from '../../i18n.js';
import { cardFace, cardBack, cardRow } from './face.js';
import { readCombo, beats, sortHand } from './cards.js';

let picked = [];          // ไพ่ที่เลือกอยู่ ต้องอยู่นอกฟังก์ชันวาด ไม่งั้นหายทุกครั้งที่รีเฟรช
let pickedFor = '';       // ปุ่มสถานะที่ picked ผูกอยู่ ใช้ล้างเมื่อเปลี่ยนตา
let showBoard = false;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

const nameOf = (st, uid) => st.names?.[uid] || '?';
const myHand = (ctx) => sortHand((ctx.secret && ctx.secret.hand) || []);

export function render(el, ctx) {
  const st = ctx.state;
  if (!st || !st.phase) { el.innerHTML = ''; return; }

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
    t('slave.round', { n: st.roundNo }),
    t(`game.slave.mode.${st.mode}`)
  ];
  return `<div class="slave-head">
    <span class="slave-round">${esc(bits.join(' · '))}</span>
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

  const combo = picked.length ? readCombo(picked) : null;
  const canPlay = myTurn && combo && beats(picked, st.pile)
    && (!st.mustInclude || picked.includes(st.mustInclude));
  const canPass = myTurn && !!st.pile;

  return `
    ${seatStrip(st, ctx)}
    <div class="slave-centre">
      ${st.pile
        ? cardRow(st.pile.cards, 58) + `<p class="slave-by">${esc(t('slave.playedBy', { name: nameOf(st, st.pile.by) }))}</p>`
        : `<p class="slave-empty">${esc(t('slave.emptyPile'))}</p>`}
      <p class="slave-status">${esc(statusLine(st, ctx))}</p>
      ${st.notice ? `<p class="slave-notice">${esc(noticeLine(st))}</p>` : ''}
    </div>

    ${out ? `<p class="slave-done">${esc(t('slave.youAreOut'))}</p>` : `
      <div class="slave-hand" id="slaveHand">
        ${mine.map(c => `<button class="hand-card${picked.includes(c) ? ' on' : ''}" data-card="${c}">${cardFace(c, 68)}</button>`).join('')}
      </div>
      <div class="slave-actions">
        <button class="btn btn-primary" data-act="play" ${canPlay ? '' : 'disabled'}>${esc(t('slave.play'))}</button>
        <button class="btn" data-act="pass" ${canPass ? '' : 'disabled'}>${esc(t('slave.pass'))}</button>
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
    if (uid === st.king) tags.push(t('slave.title.king'));
    if (done >= 0) tags.push(t('slave.place', { n: done + 1 }));
    if (gone) tags.push(t('slave.toppled'));
    if ((st.passed || []).includes(uid)) tags.push(t('slave.passed'));

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
    return st.mustInclude ? t('slave.yourTurnOpening') : t('slave.yourTurn');
  }
  return t('slave.waitingFor', { name: nameOf(st, st.turn) });
}

function noticeLine(st) {
  const n = st.notice;
  if (n.t === 'topple') return t('slave.noticeTopple', { by: nameOf(st, n.by), king: nameOf(st, n.king) });
  if (n.t === 'timeout') return t('slave.noticeTimeout', { name: nameOf(st, n.uid) });
  if (n.t === 'tooFew') return t('slave.noticeTooFew');
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
      <p class="slave-status">${esc(t('slave.youGiveBest', { n: lower.count }))}</p>
      <p class="slave-empty">${esc(t('slave.waitExchange'))}</p>
    </div>`;
  }
  if (!pair || already) {
    return `<div class="slave-centre">
      <p class="slave-status">${esc(t('slave.waitExchange'))}</p>
    </div>`;
  }

  const mine = myHand(ctx);
  return `
    <div class="slave-centre">
      <p class="slave-status">${esc(t('slave.pickGive', { n: pair.count, name: nameOf(st, pair.lower) }))}</p>
    </div>
    <div class="slave-hand">
      ${mine.map(c => `<button class="hand-card${picked.includes(c) ? ' on' : ''}" data-card="${c}">${cardFace(c, 68)}</button>`).join('')}
    </div>
    <div class="slave-actions">
      <button class="btn btn-primary" data-act="give" ${picked.length === pair.count ? '' : 'disabled'}>
        ${esc(t('slave.confirmGive'))}
      </button>
    </div>`;
}

/* ── จบรอบ / จบเกม ─────────────────────────────────────────── */

function result(st, ctx) {
  const over = st.phase === 'gameOver';
  const rows = (st.titles || []).map(x => `
    <li class="rank-row">
      <span class="rank-place">${x.place}</span>
      <span class="rank-title">${esc(t('slave.title.' + x.title))}</span>
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
      ? `<button class="btn btn-primary" data-act="leave">${esc(t('slave.backToRoom'))}</button>`
      : `<p class="slave-empty">${esc(t('slave.waitHostRoom'))}</p>`;
  } else if (st.mode === 'endless') {
    controls = inGame && !iVoted
      ? `<button class="btn btn-primary" data-act="voteYes">${esc(t('slave.voteYes'))}</button>
         <button class="btn" data-act="voteNo">${esc(t('slave.voteNo'))}</button>`
      : `<p class="slave-empty">${esc(t('slave.waitVotes', {
            n: (st.seats || []).filter(u => voted[u] === undefined).length }))}</p>`;
  } else {
    controls = ctx.isHost
      ? `<button class="btn btn-primary" data-act="next">${esc(t('slave.nextRound'))}</button>`
      : `<p class="slave-empty">${esc(t('slave.waitHostNext'))}</p>`;
  }

  return `
    <div class="slave-centre">
      <p class="slave-status">${esc(over ? t('slave.gameOver') : t('slave.roundOver', { n: st.roundNo }))}</p>
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
    <h3>${esc(t('slave.scoreboard'))}</h3>
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
