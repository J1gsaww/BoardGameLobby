/* trick-ui.js — หน้าจอของเกมไพ่ตระกูลสลาฟ
   ─────────────────────────────────────────────────────────────
   วาดอย่างเดียว ห้ามตัดสินอะไรทั้งสิ้น เพราะไฟล์นี้รันบนเครื่องผู้เล่นทุกคน
   ส่วนกติกาตัดสินที่ trick-game.js ซึ่งรันบนเครื่องเจ้าของห้องคนเดียว
   ───────────────────────────────────────────────────────────── */

import { t } from '../../i18n.js';
import { cardFace, cardBack, cardRow } from './face.js';
import { readCombo, beats, sortForHand, isJoker, rankIndex } from './cards.js';
import { titles } from './engine.js';
import { makeSound } from './trick-sound.js';
import { face as avatarFace } from '../../avatar.js';
import { resolve } from './trick-game.js';

const CARD_W = 68;
const HAND_MAX = 860;
const GOT_MS = 6000;          // ไฮไลต์ไพ่ที่เพิ่งได้จากการแลกนานเท่านี้

function handStep(n) {
  if (n <= 1) return CARD_W;
  return Math.round(Math.max(26, Math.min(CARD_W * 0.62, (HAND_MAX - CARD_W) / (n - 1))));
}
const handStyle = (n) => `--cw:${CARD_W}px; --step:${handStep(n)}px`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

export function makeUI(baseRules, effects) {
const Sound = makeSound(effects);

let picked = [];
let pickedFor = '';
let clockTimer = null;
let gotSince = 0;             // เวลาที่เริ่มเห็นไพ่ที่เพิ่งแลกมา
let gotKey = '';

const rulesOf = (ctx) => resolve(baseRules, ctx.settings);
const nameOf = (st, uid) => st.names?.[uid] || '?';
const myHand = (ctx) => sortForHand((ctx.secret && ctx.secret.hand) || [], !!ctx.state?.revolution);

/* ตำแหน่งของทุกคนจากรอบที่แล้ว — ไม่ใช่บอกแค่ว่าใครเป็นคิง */
function titleMap(st) {
  const rank = st.prevRanking;
  if (!rank || !rank.length) return {};
  const out = {};
  titles(rank).forEach(x => { out[x.uid] = x.title; });
  return out;
}

function render(el, ctx) {
  const st = ctx.state;
  if (!st || !st.phase) { el.innerHTML = ''; clearInterval(clockTimer); Sound.reset(); return; }
  Sound.react(st);

  const key = `${st.phase}:${st.roundNo}:${st.turn}`;
  if (key !== pickedFor) { picked = []; pickedFor = key; }

  // ไพ่ที่เพิ่งได้จากการแลก ไฮไลต์ไว้ชั่วครู่แล้วค่อยจาง
  const got = (ctx.secret && ctx.secret.lastGot) || [];
  const nowKey = got.join(',') + ':' + st.roundNo;
  if (got.length && nowKey !== gotKey) { gotKey = nowKey; gotSince = Date.now(); }
  const showGot = got.length && (Date.now() - gotSince < GOT_MS);

  const board = st.mode === 'endless' ? scoreboard(st) : '';

  el.innerHTML = `
    <div class="trick-wrap${board ? ' has-side' : ''}">
      <div class="slave">
        ${header(st)}
        ${body(st, ctx, showGot ? got : [])}
      </div>
      ${board}
    </div>
  `;
  bind(el, ctx);
  runClock(el, st, ctx);

  if (showGot) setTimeout(() => { if (Date.now() - gotSince >= GOT_MS) render(el, ctx); }, GOT_MS + 60);
}

/* ── หัวโต๊ะ ───────────────────────────────────────────────── */

function header(st) {
  const bits = [t('trick.round', { n: st.roundNo }), t(`game.${baseRules.id}.mode.${st.mode}`)];
  return `<div class="slave-head">
    <span class="slave-round">${esc(bits.join(' \u00b7 '))}</span>
    ${st.revolution ? `<span class="rev-badge">${esc(t('trick.revolution'))}</span>` : ''}
  </div>`;
}

function body(st, ctx, got) {
  if (st.phase === 'exchange') return exchange(st, ctx);
  if (st.phase === 'roundEnd' || st.phase === 'gameOver') return result(st, ctx);
  return table(st, ctx, got);
}

/* ── โต๊ะระหว่างเล่น ───────────────────────────────────────── */

function table(st, ctx, got) {
  const me = ctx.me.uid;
  const mine = myHand(ctx);
  const rules = rulesOf(ctx);
  const rev = !!st.revolution;
  const holding = !!st.holdUntil && Date.now() < st.holdUntil;
  const myTurn = st.turn === me && !holding;
  const watching = !(st.seats || []).includes(me);
  const out = (st.finished || []).includes(me) || st.toppled === me;

  const combo = picked.length ? readCombo(picked, rules) : null;
  const canPlay = myTurn && combo && beats(picked, st.pile, rules, rev)
    && (!st.mustInclude || picked.includes(st.mustInclude));
  const canPass = myTurn && !!st.pile;

  // เลือกได้แต้มเดียวเท่านั้น ใบแต้มอื่นจะกดไม่ได้จนกว่าจะเอาใบที่เลือกไว้ออกก่อน
  const lockedRank = pickedRank();
  const playable = holding ? null : playableSet(st, ctx, rules, rev);

  return `
    ${seatStrip(st, ctx)}
    <div class="slave-centre">
      ${pileStack(st)}
      <p class="slave-status">${esc(statusLine(st, ctx, holding))}</p>
      ${st.deadline || holding ? '<p class="trick-clock" id="trickClock"></p>' : ''}
      ${st.notice ? `<p class="slave-notice">${esc(noticeLine(st))}</p>` : ''}
    </div>

    ${watching ? `<p class="slave-done">${esc(t('trick.watching'))}</p>`
      : out ? `<p class="slave-done">${esc(t('trick.youAreOut'))}</p>` : `
      ${got.length ? `<p class="got-note">${esc(t('trick.gotCards', { n: got.length }))}</p>` : ''}
      <div class="slave-hand" style="${handStyle(mine.length)}">
        ${mine.map(c => {
          const on = picked.includes(c);
          const offRank = lockedRank !== null && !isJoker(c) && rankIndex(c) !== lockedRank && !on;
          const unplayable = !!playable && !playable.has(c) && !on;
          const masked = offRank || unplayable;
          return `<button class="hand-card${on ? ' on' : ''}${masked ? ' masked' : ''}` +
                 `${got.includes(c) ? ' fresh' : ''}" data-card="${c}"${masked ? ' disabled' : ''}>` +
                 cardFace(c, CARD_W) + '</button>';
        }).join('')}
      </div>
      <div class="slave-actions">
        <button class="btn btn-primary" data-act="play" ${canPlay ? '' : 'disabled'}>${esc(t('trick.play'))}</button>
        <button class="btn" data-act="pass" ${canPass ? '' : 'disabled'}>${esc(t('trick.pass'))}</button>
      </div>
    `}
  `;
}

/* ใบไหนพอจะลงได้บ้างในกองตอนนี้
   ต้องดูเป็นชุด ไม่ใช่ทีละใบ — 7 เดี่ยวทับคู่ 5 ไม่ได้ แต่คู่ 7 ทับได้
   ถ้าเช็กทีละใบจะทับดำผิดจนคนเล่นสับสน */
function playableSet(st, ctx, rules, rev) {
  const hand = myHand(ctx);
  const set = new Set();
  if (!st.pile) { hand.forEach(c => set.add(c)); return set; }

  const jokers = hand.filter(isJoker);
  const byRank = new Map();
  hand.filter(c => !isJoker(c)).forEach(c => {
    const r = rankIndex(c);
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r).push(c);
  });

  const ok = (cards) => cards.length <= 4
    && beats(cards, st.pile, rules, rev)
    && (!st.mustInclude || cards.includes(st.mustInclude));

  let jokersUseful = false;
  for (const cards of byRank.values()) {
    let good = false, usedJokers = 0;
    for (let n = 1; n <= cards.length && !good; n++) {
      for (let j = 0; n + j <= 4 && j <= jokers.length && !good; j++) {
        if (ok([...cards.slice(0, n), ...jokers.slice(0, j)])) { good = true; usedJokers = j; }
      }
    }
    if (good) { cards.forEach(c => set.add(c)); if (usedJokers) jokersUseful = true; }
  }
  for (let j = 1; j <= jokers.length && !jokersUseful; j++) {
    if (ok(jokers.slice(0, j))) jokersUseful = true;
  }
  if (jokersUseful) jokers.forEach(c => set.add(c));

  return set;
}

/* แต้มที่ล็อกอยู่จากไพ่ที่เลือกไว้ — โจ๊กเกอร์ไม่ล็อกเพราะเป็นไพ่แทน */
function pickedRank() {
  const real = picked.filter(c => !isJoker(c));
  return real.length ? rankIndex(real[0]) : null;
}

/* กองไพ่ — ซ้อนของเก่าไว้ข้างหลังแบบมืด ๆ ให้เห็นว่ากองนี้เดินมายังไง */
function pileStack(st) {
  const log = st.pileLog || [];
  if (!log.length) return `<p class="slave-empty">${esc(t('trick.emptyPile'))}</p>`;

  const closed = !st.pile;                 // กองปิดไปแล้ว กำลังค้างให้ดู
  const shown = log.slice(-4);
  const top = shown[shown.length - 1];
  const past = shown.slice(0, -1);

  return `<div class="pile-stack${closed ? ' closed' : ''}">` +
    past.map((p, i) => `<div class="pile-past" style="--depth:${past.length - i}">${cardRow(p.cards, 46)}</div>`).join('') +
    `<div class="pile-top">${cardRow(top.cards, 58)}</div>` +
    `</div><p class="slave-by">${esc(t('trick.playedBy', { name: nameOf(st, top.by) }))}</p>`;
}

/* แถบผู้เล่นรอบโต๊ะ */
function seatStrip(st, ctx) {
  const order = st.seats || [];
  const tmap = titleMap(st);

  return `<div class="slave-seats">${order.map(uid => {
    const n = st.counts?.[uid] ?? 0;
    const isTurn = st.turn === uid;
    const done = (st.finished || []).indexOf(uid);
    const gone = st.toppled === uid;
    const passed = (st.passed || []).includes(uid);

    const tags = [];
    if (tmap[uid]) tags.push(`<span class="chip-title">${esc(t('trick.title.' + tmap[uid]))}</span>`);
    if (done >= 0) tags.push(`<span class="chip-done">${esc(t('trick.place', { n: done + 1 }))}</span>`);
    if (gone) tags.push(`<span class="chip-done">${esc(t('trick.toppled'))}</span>`);
    if (passed) tags.push(`<span class="chip-passed">${esc(t('trick.passed'))}</span>`);

    return `<div class="seat-chip${isTurn ? ' turn' : ''}${gone || done >= 0 ? ' finished' : ''}">
      ${avatarFace(uid, nameOf(st, uid), (ctx.avatars || {})[uid], 34)}
      <span class="seat-chip-name">${esc(nameOf(st, uid))}${uid === ctx.me.uid ? ' \u00b7' : ''}</span>
      <span class="seat-chip-cards">${n ? cardBack(15).repeat(Math.min(n, 8)) : ''}</span>
      <span class="seat-chip-n">${n}</span>
      ${tags.length ? `<span class="seat-chip-tag">${tags.join('')}</span>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function statusLine(st, ctx, holding) {
  if (holding) return t('trick.trickOver', { name: nameOf(st, st.pileLog?.slice(-1)[0]?.by) });
  if (st.turn === ctx.me.uid) return st.mustInclude ? t('trick.yourTurnOpening') : t('trick.yourTurn');
  return t('trick.waitingFor', { name: nameOf(st, st.turn) });
}

function noticeLine(st) {
  const n = st.notice;
  if (n.t === 'topple') return t('trick.noticeTopple', { by: nameOf(st, n.by), king: nameOf(st, n.king) });
  if (n.t === 'timeout') return t('trick.noticeTimeout', { name: nameOf(st, n.uid) });
  if (n.t === 'tooFew') return t('trick.noticeTooFew');
  return '';
}

/* นาฬิกา — ใช้ทั้งนับถอยหลังตาตัวเอง และช่วงหยุดค้างหลังจบกอง */
function runClock(el, st, ctx) {
  clearInterval(clockTimer);
  const slot = el.querySelector('#trickClock');
  if (!slot) return;

  const holding = !!st.holdUntil && Date.now() < st.holdUntil;
  const until = holding ? st.holdUntil : st.deadline;
  if (!until) return;

  const paint = () => {
    const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    slot.textContent = holding ? t('trick.resuming', { n: left }) : t('trick.timeLeft', { n: left });
    slot.classList.toggle('urgent', !holding && left <= 3);
    if (left <= 0) {
      clearInterval(clockTimer);
      if (holding) render(el, ctx);          // หมดช่วงหยุดค้าง วาดใหม่ให้ปุ่มกลับมากดได้
    }
  };
  paint();
  clockTimer = setInterval(paint, 250);
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
    </div>${handOnly(ctx)}`;
  }
  if (!pair || already) {
    return `<div class="slave-centre">
      <p class="slave-status">${esc(t('trick.waitExchange'))}</p>
    </div>${handOnly(ctx)}`;
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

/* โชว์ไพ่ตัวเองเฉย ๆ ระหว่างรอ จะได้เห็นว่าตอนนี้ถืออะไรอยู่ */
function handOnly(ctx) {
  const mine = myHand(ctx);
  if (!mine.length) return '';
  return `<div class="slave-hand" style="${handStyle(mine.length)}">
    ${mine.map(c => `<span class="hand-card still">${cardFace(c, CARD_W)}</span>`).join('')}
  </div>`;
}

/* ── จบรอบ / จบเกม ─────────────────────────────────────────── */

function result(st, ctx) {
  const over = st.phase === 'gameOver';
  const voted = st.votes || {};
  const seats = st.seats || [];

  const rows = (st.titles || []).map(x => `
    <li class="rank-row">
      <span class="rank-place">${x.place}</span>
      <span class="rank-title">${esc(t('trick.title.' + x.title))}</span>
      <span class="rank-name">${avatarFace(x.uid, nameOf(st, x.uid), (ctx.avatars || {})[x.uid], 24)}${esc(nameOf(st, x.uid))}</span>
      ${!over && voted[x.uid] !== undefined
        ? `<span class="rank-${voted[x.uid] ? 'ready' : 'stop'}">${esc(t(voted[x.uid] ? 'trick.isReady' : 'trick.isStopping'))}</span>`
        : ''}
      ${st.mode === 'endless'
        ? `<span class="rank-pts">${st.gained?.[x.uid] >= 0 ? '+' : ''}${st.gained?.[x.uid] ?? 0}</span>`
        : ''}
    </li>`).join('');

  const iVoted = voted[ctx.me.uid] !== undefined;
  const inGame = seats.includes(ctx.me.uid);
  const waiting = seats.filter(u => voted[u] === undefined).length;

  let controls = '';
  if (over) {
    controls = ctx.isHost
      ? `<button class="btn btn-primary" data-act="leave">${esc(t('trick.backToRoom'))}</button>`
      : `<p class="slave-empty">${esc(t('trick.waitHostRoom'))}</p>`;
  } else if (st.mode === 'endless') {
    controls = inGame && !iVoted
      ? `<button class="btn btn-primary" data-act="voteYes">${esc(t('trick.voteYes'))}</button>
         <button class="btn" data-act="voteNo">${esc(t('trick.voteNo'))}</button>`
      : `<p class="slave-empty">${esc(t('trick.waitVotes', { n: waiting }))}</p>`;
  } else {
    controls = inGame && !iVoted
      ? `<button class="btn btn-primary" data-act="voteYes">${esc(t('trick.readyNext'))}</button>`
      : `<p class="slave-empty">${esc(t('trick.waitVotes', { n: waiting }))}</p>`;
  }

  const skip = (!over && ctx.isHost && waiting > 0)
    ? `<button class="btn btn-slim" data-act="next">${esc(t('trick.skipWait'))}</button>` : '';

  return `
    <div class="slave-centre">
      <p class="slave-status">${esc(over ? t('trick.gameOver') : t('trick.roundOver', { n: st.roundNo }))}</p>
      ${st.notice ? `<p class="slave-notice">${esc(noticeLine(st))}</p>` : ''}
    </div>
    <ol class="ranks">${rows}</ol>
    <div class="slave-actions">${controls}${skip}</div>`;
}

/* ── ตารางคะแนน ปักไว้ด้านขวา ─────────────────────────────── */

function scoreboard(st) {
  const tmap = titleMap(st);
  const rows = Object.entries(st.scores || {})
    .sort((a, b) => b[1] - a[1])
    .map(([uid, pts], i) => `
      <li class="rank-row">
        <span class="rank-place">${i + 1}</span>
        <span class="rank-name">${esc(nameOf(st, uid))}${tmap[uid] ? ` <span class="chip-title">${esc(t('trick.title.' + tmap[uid]))}</span>` : ''}</span>
        <span class="rank-pts">${pts}</span>
      </li>`).join('');
  return `<aside class="scoreboard">
    <h3>${esc(t('trick.scoreboard'))}</h3>
    <ol class="ranks">${rows}</ol>
  </aside>`;
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
      if (a === 'play')    { ctx.send('play', { cards: picked }); picked = []; return; }
      if (a === 'pass')    { ctx.send('pass'); return; }
      if (a === 'give')    { ctx.send('give', { cards: picked }); picked = []; return; }
      if (a === 'next')    { ctx.send('next'); return; }
      if (a === 'voteYes') { ctx.send('vote', { yes: true }); return; }
      if (a === 'voteNo')  { ctx.send('vote', { yes: false }); return; }
      if (a === 'leave')   { ctx.leave(); return; }
    };
  });
}

  return { render, reset: Sound.reset };
}
