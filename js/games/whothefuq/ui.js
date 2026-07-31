/* ui.js — หน้าจอของ Who the fuq are you
   ─────────────────────────────────────────────────────────────
   ซ้าย  = ลามะลับ + ข้อมูลที่เรารู้คนเดียว + การ์ดในมือ
   กลาง = เฟสที่เล่นอยู่ / หน้าต่าง pending (เลือกเป้า เปิดจุดเด่น โหวต ทาย)
   ขวา  = รายชื่อ + กระดานเปิดสาธารณะ + เช็คลิสส่วนตัว + ตารางข้อมูลลามะ

   เช็คลิสเป็นเครื่องมือจดของแต่ละคนเอง (ไม่ sync) ติ๊กวน ว่าง→✓→✗
   ?dev=card (เฉพาะ host) เปิดแผงเสกการ์ดมารันผลทันทีเพื่อเทส */

import { t, lang } from '../../i18n.js';
import { PHASE } from './rules.js';
import {
  TRAITS, TRAIT_IDS, LLAMAS, traitsOf, llamaById, llamaArt,
  cardById, traitById, EVENT_CARDS, CARD_CATS
} from './data.js';
import * as Sound from './sound.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const L = (o) => (o ? (o[lang] ?? o.th) : '');
const DEV = (() => { try { return new URLSearchParams(location.search).get('dev') === 'card'; } catch { return false; } })();

const ACTIVE_HELD = ['expose', 'peek', 'scan', 'silence', 'awaken'];

function mapArgs(a = {}) {
  const o = { ...a };
  if (o.trait) o.trait = L(traitById(o.trait)) || o.trait;
  if (o.llama) o.llama = L(llamaById(o.llama)) || o.llama;
  if (o.card) o.card = L(cardById(o.card)) || o.card;
  if (o.traits) o.traits = String(o.traits).split(',').map(x => L(traitById(x)) || x).join(', ');
  return o;
}

const COLORS = [
  ['red', '#e0446b'], ['orange', '#e8842b'], ['yellow', '#e8c72b'], ['green', '#4caf50'], ['mint', '#26c6a0'],
  ['blue', '#42a5f5'], ['purple', '#8b5cf6'], ['pink', '#ec6efb'], ['brown', '#8d6e63'], ['gray', '#9e9e9e']
];
let ckMode = 'player';
let ckTicks = {};
let ckNames = {};

export function render(el, ctx) {
  const st = ctx.state;
  if (!st || !st.phase) { el.innerHTML = ''; return; }
  ensureStyle();
  Sound.preload(); Sound.play(st);

  const me = ctx.me.uid;
  const mine = ctx.secret?.llama || null;

  el.innerHTML = `
    <div class="wtf-wrap">
      <aside class="wtf-me">${meCard(mine, me, st)}${seenFeed(ctx)}${heldCards(st, ctx, me)}</aside>
      <main class="wtf-mid">${header(st)}${center(st, ctx, me)}${logBox(st)}</main>
      <aside class="wtf-side">${players(st, me)}${knownBoard(st)}${checklist(st)}${infoTable()}</aside>
    </div>
    ${DEV && ctx.isHost ? devPanel() : ''}`;

  wire(el, ctx, st, me);
}

function header(st) {
  const label = { announce: 'wtf.phase.announce', event: 'wtf.phase.event', talk: 'wtf.phase.talk', challenge: 'wtf.phase.challenge', over: 'wtf.phase.over' }[st.phase];
  const timer = st.deadline ? `<span class="wtf-timer" data-deadline="${st.deadline}">–</span>` : '';
  return `<div class="wtf-head"><span class="wtf-phase">${esc(t(label))}</span>
      <span class="wtf-round">${esc(t('wtf.roundN', { n: st.round }))}</span>${timer}</div>`;
}

function meCard(llamaId, me, st) {
  if (st.out.includes(me)) return `<div class="wtf-card wtf-dim">${esc(t('wtf.youOut'))}</div>`;
  if (!llamaId) return `<div class="wtf-card wtf-dim">${esc(t('wtf.watching'))}</div>`;
  const l = llamaById(llamaId);
  const traits = traitsOf(llamaId).map(id => `<li>${esc(L(traitById(id)))}</li>`).join('');
  return `<div class="wtf-card">
      <div class="wtf-hint">${esc(t('wtf.secretHint'))}</div>
      <div class="wtf-llama"><img src="${esc(llamaArt(llamaId))}" alt="" onerror="this.style.display='none'">
        <div class="wtf-lname">${esc(L(l))}</div></div>
      <div class="wtf-tt">${esc(t('wtf.yourTraits'))}</div>
      <ul class="wtf-traits">${traits}</ul></div>`;
}

function seenFeed(ctx) {
  const seen = ctx.secret?.seen || [];
  if (!seen.length) return '';
  const lines = seen.slice(-8).reverse().map(e => {
    if (e.key === 'wtf.seen.has') return `<li>${esc(t(e.args.yn ? 'wtf.seen.hasYes' : 'wtf.seen.hasNo', mapArgs(e.args)))}</li>`;
    return `<li>${esc(t(e.key, mapArgs(e.args)))}</li>`;
  }).join('');
  return `<div class="wtf-card wtf-seen"><div class="wtf-tt">${esc(t('wtf.seen.title'))}</div><ul>${lines}</ul></div>`;
}

function heldCards(st, ctx, me) {
  const hand = ctx.secret?.hand || [];
  if (!hand.length || st.out.includes(me)) return '';
  const canPlay = (st.phase === PHASE.TALK || st.phase === PHASE.CHALLENGE) && !st.pending;
  const items = hand.map(id => {
    const c = cardById(id);
    const active = ACTIVE_HELD.includes(id);
    const btn = active && canPlay
      ? `<button class="wtf-btn wtf-sm" data-act="playHeld" data-card="${esc(id)}">${esc(t('wtf.held.play'))}</button>`
      : `<span class="wtf-note">${esc(t('wtf.held.passive'))}</span>`;
    return `<div class="wtf-held wtf-pol-${c?.pol || 'neu'}"><div class="wtf-cname">${esc(L(c))}</div>
        <div class="wtf-cdesc">${esc(c ? L({ th: c.th.desc, en: c.en.desc }) : '')}</div>${btn}</div>`;
  }).join('');
  return `<div class="wtf-card"><div class="wtf-tt">${esc(t('wtf.held.title'))}</div><div class="wtf-hand">${items}</div></div>`;
}

function center(st, ctx, me) {
  if (st.pending) return `<section class="wtf-center">${pendingBox(st, ctx, me)}${hostBar(st, ctx)}</section>`;
  if (st.phase === PHASE.OVER) return `<section class="wtf-center">${overBody(st, ctx, me)}</section>`;
  let body = '';
  if (st.phase === PHASE.ANNOUNCE) body = announceBody(st, me);
  else if (st.phase === PHASE.EVENT) body = eventBody(st, me);
  else if (st.phase === PHASE.TALK) body = `<div class="wtf-block"><h3>${esc(t('wtf.phase.talk'))}</h3><p class="wtf-note">${esc(t('wtf.talkHelp'))}</p></div>`;
  else if (st.phase === PHASE.CHALLENGE) body = challengeBody(st, ctx, me);
  return `<section class="wtf-center">${body}${hostBar(st, ctx)}</section>`;
}

function hostBar(st, ctx) {
  if (!ctx.isHost || st.pending) return '';
  return `<div class="wtf-hostbar"><button class="wtf-btn" data-act="advance">${esc(t('wtf.advance'))}</button>
      <span class="wtf-note">${esc(t('wtf.hostNote'))}</span></div>`;
}

function overBody(st, ctx, me) {
  const win = st.result?.winner === me;
  return `<div class="wtf-over">${esc(win ? t('wtf.youWin') : t('wtf.winnerIs', { name: st.result?.name || '?' }))}</div>
    ${ctx.isHost ? `<div class="wtf-hostbar"><button class="wtf-btn" data-room="again">${esc(t('wtf.again'))}</button>
      <button class="wtf-btn wtf-ghost" data-room="lobby">${esc(t('wtf.lobby'))}</button></div>` : ''}`;
}

function announceBody(st, me) {
  const canSay = !st.out.includes(me) && !st.announced.includes(me);
  const list = st.seats.map(u => `<li class="${st.announced.includes(u) ? 'on' : ''}">${esc(st.names[u] || '?')}</li>`).join('');
  const form = canSay
    ? `<div class="wtf-row"><input class="wtf-in" id="wtf-say" maxlength="200" placeholder="${esc(t('wtf.sayPh'))}">
         <button class="wtf-btn" data-act="announce">${esc(t('wtf.say'))}</button></div>`
    : `<div class="wtf-note">${esc(t('wtf.saidAlready'))}</div>`;
  return `<div class="wtf-block"><h3>${esc(t('wtf.phase.announce'))}</h3>
      <p class="wtf-note">${esc(t('wtf.announceHelp'))}</p>${form}
      <div class="wtf-sub">${esc(t('wtf.announcedN', { n: st.announced.length, of: st.seats.length }))}</div>
      <ul class="wtf-chips">${list}</ul></div>`;
}

function eventBody(st, me) {
  const slots = st.slots.map((s, i) => {
    if (!s) return `<div class="wtf-slot empty">—</div>`;
    const who = esc(st.names[s.by] || '?');
    if (!s.done) {
      const canFlip = s.by === me;
      return `<div class="wtf-slot back"><div class="wtf-by">${who}</div>
          ${canFlip ? `<button class="wtf-btn" data-act="flip" data-slot="${i}">${esc(t('wtf.flip'))}</button>`
                    : `<div class="wtf-note">${esc(t('wtf.waitFlip'))}</div>`}</div>`;
    }
    const c = cardById(s.card);
    return `<div class="wtf-slot face wtf-pol-${c?.pol || 'neu'}"><div class="wtf-by">${who}</div>
        <div class="wtf-cname">${esc(L(c))}</div>
        <div class="wtf-cdesc">${esc(c ? L({ th: c.th.desc, en: c.en.desc }) : '')}</div>
        <div class="wtf-timing">${esc(c?.timing || '')}</div></div>`;
  }).join('');
  return `<div class="wtf-block"><h3>${esc(t('wtf.phase.event'))}</h3><div class="wtf-slots">${slots}</div></div>`;
}

function challengeBody(st, ctx, me) {
  const turnName = st.chTurn ? esc(st.names[st.chTurn] || '?') : '—';
  const canAct = st.chTurn === me && !(st.mute || []).includes(me);
  if (!canAct) {
    return `<div class="wtf-block"><h3>${esc(t('wtf.phase.challenge'))}</h3>
        <div class="wtf-note">${st.chTurn ? esc(t('wtf.waitTurn', { name: turnName })) : esc(t('wtf.challengeDone'))}</div></div>`;
  }
  return `<div class="wtf-block"><h3>${esc(t('wtf.yourChallenge'))}</h3>
      ${targetSelect(st, me, 'wtf-target')}${guessSelect('wtf-guess')}
      <div class="wtf-row"><button class="wtf-btn wtf-go" data-act="challenge">${esc(t('wtf.doChallenge'))}</button>
        <button class="wtf-btn wtf-ghost" data-act="skip">${esc(t('wtf.skip'))}</button></div></div>`;
}

function pendingBox(st, ctx, me) {
  const p = st.pending;
  const waiting = p.waiting || [];
  const c = cardById(p.card);
  if (!waiting.includes(me)) {
    const who = waiting.map(u => st.names[u] || '?').join(', ');
    return `<div class="wtf-block"><h3>${esc(L(c) || t('wtf.pending.wait'))}</h3>
        <div class="wtf-note">${esc(t('wtf.pending.who', { who }))}</div></div>`;
  }
  const title = esc(L(c) || '');
  let body = '', kindAttr = p.kind;

  if (p.kind === 'pickOwnTrait') body = ownTraitSelect(ctx) + prompt('wtf.prompt.pickOwnTrait');
  else if (p.kind === 'pickAnyTrait') body = anyTraitSelect('wtf-trait') + prompt('wtf.prompt.pickAnyTrait');
  else if (p.kind === 'pickTwoTraits') body = anyTraitSelect('wtf-trait') + anyTraitSelect('wtf-trait2') + prompt('wtf.prompt.pickTwo');
  else if (p.kind === 'pickTarget') body = targetSelect(st, p.by, 'wtf-target') + prompt('wtf.prompt.pickTarget');
  else if (p.kind === 'pickTargetOwnTrait') body = targetSelect(st, p.by, 'wtf-target') + ownTraitSelect(ctx) + prompt('wtf.prompt.pickTargetTrait');
  else if (p.kind === 'pickTargetAnyTrait') body = targetSelect(st, p.by, 'wtf-target') + anyTraitSelect('wtf-trait') + prompt('wtf.prompt.pickTargetTrait');
  else if (p.kind === 'pickNeighbor') body = optSelect(p.data?.opts || [], st, 'wtf-target') + prompt('wtf.prompt.pickNeighbor');
  else if (p.kind === 'pickOut') body = optSelect(p.data?.opts || [], st, 'wtf-target') + prompt('wtf.prompt.pickOut');
  else if (p.kind === 'bestie') body = optSelect(p.data?.opts || [], st, 'wtf-target') + anyTraitSelect('wtf-trait') + prompt('wtf.prompt.bestie');
  else if (p.kind === 'vote') body = targetSelect(st, null, 'wtf-target') + prompt('wtf.prompt.vote');
  else if (p.kind === 'freeGuess') body = targetSelect(st, p.by, 'wtf-target') + guessSelect('wtf-guess') + prompt('wtf.prompt.freeGuess');
  else if (p.kind === 'duelGuess') body = guessSelect('wtf-guess') + prompt('wtf.prompt.duel');
  else if (p.kind === 'guessBack') body = guessSelect('wtf-guess') + prompt('wtf.prompt.guessBack');

  return `<div class="wtf-block wtf-pending" data-kind="${esc(kindAttr)}"><h3>${title}</h3>${body}
      <div class="wtf-row"><button class="wtf-btn wtf-go" data-act="resolve" data-kind="${esc(kindAttr)}">${esc(t('wtf.confirm'))}</button></div></div>`;
}

const prompt = (k) => `<p class="wtf-note">${esc(t(k))}</p>`;
function ownTraitSelect(ctx) {
  const own = traitsOf(ctx.secret?.llama);
  const opts = own.map(id => `<option value="${esc(id)}">${esc(L(traitById(id)))}</option>`).join('');
  return `<select class="wtf-sel" id="wtf-trait">${opts}</select>`;
}
function anyTraitSelect(id) {
  const opts = TRAITS.map(tr => `<option value="${esc(tr.id)}">${esc(L(tr))}</option>`).join('');
  return `<select class="wtf-sel" id="${id}">${opts}</select>`;
}
function guessSelect(id) {
  const opts = LLAMAS.map(l => `<option value="${esc(l.id)}">${esc(L(l))}</option>`).join('');
  return `<select class="wtf-sel" id="${id}">${opts}</select>`;
}
function targetSelect(st, exclude, id) {
  const opts = st.seats.filter(u => u !== exclude && !st.out.includes(u))
    .map(u => `<option value="${esc(u)}">${esc(st.names[u] || '?')}</option>`).join('');
  return `<select class="wtf-sel" id="${id}">${opts}</select>`;
}
function optSelect(opts, st, id) {
  const o = opts.map(u => `<option value="${esc(u)}">${esc(st.names[u] || '?')}</option>`).join('');
  return `<select class="wtf-sel" id="${id}">${o}</select>`;
}

function players(st, me) {
  const rows = st.seats.map((u, i) => {
    const out = st.out.includes(u);
    const turn = st.phase === PHASE.CHALLENGE && st.chTurn === u;
    const flip = st.phase === PHASE.EVENT && st.flippers.includes(u);
    const hold = st.holdCount?.[u] || 0;
    const mute = (st.mute || []).includes(u);
    const tags = [
      turn ? `<span class="wtf-tag turn">${esc(t('wtf.tag.turn'))}</span>` : '',
      flip ? `<span class="wtf-tag flip">${esc(t('wtf.tag.flip'))}</span>` : '',
      mute ? `<span class="wtf-tag mute">${esc(t('wtf.tag.mute'))}</span>` : '',
      hold ? `<span class="wtf-tag hold">${hold}</span>` : ''
    ].join('');
    return `<li class="${out ? 'out' : ''} ${u === me ? 'meRow' : ''}"><span class="wtf-seat">${i + 1}</span>
        <span class="wtf-pname">${esc(st.names[u] || '?')}</span>
        ${out ? `<span class="wtf-tag gone">${esc(t('wtf.tag.out'))}</span>` : tags}</li>`;
  }).join('');
  return `<div class="wtf-panel"><div class="wtf-tt">${esc(t('wtf.players'))}</div><ul class="wtf-players">${rows}</ul></div>`;
}

function knownBoard(st) {
  const rows = st.seats.filter(u => st.known?.[u] && Object.keys(st.known[u]).length).map(u => {
    const cells = Object.entries(st.known[u]).map(([tr, v]) =>
      `<span class="wtf-kv ${v}">${v === 'yes' ? '✓' : '✗'} ${esc(L(traitById(tr)))}</span>`).join('');
    return `<li><b>${esc(st.names[u] || '?')}</b> ${cells}</li>`;
  }).join('');
  if (!rows) return '';
  return `<div class="wtf-panel"><div class="wtf-tt">${esc(t('wtf.known.title'))}</div><ul class="wtf-known">${rows}</ul></div>`;
}

function checklist(st) {
  const rowsSrc = ckMode === 'player'
    ? st.seats.map(u => ({ key: u, label: st.names[u] || '?', dot: '', ph: '' }))
    : COLORS.map(([c, hex]) => ({ key: c, label: ckNames[c] || '', dot: hex, ph: t('wtf.color.' + c) }));
  const head = TRAITS.map(tr => `<th><span>${esc(L(tr))}</span></th>`).join('');
  const body = rowsSrc.map(r => {
    const cells = TRAIT_IDS.map(tid => {
      const v = ckTicks[r.key + '|' + tid] || 0;
      const sym = v === 1 ? '✓' : v === 2 ? '✗' : '';
      return `<td class="wtf-ck ${v === 1 ? 'y' : v === 2 ? 'n' : ''}" data-row="${esc(r.key)}" data-trait="${esc(tid)}">${sym}</td>`;
    }).join('');
    const name = ckMode === 'player'
      ? `<th class="wtf-lh">${esc(r.label)}</th>`
      : `<th class="wtf-lh"><span class="wtf-dot" style="background:${r.dot}"></span><input class="wtf-cin" data-color="${esc(r.key)}" value="${esc(r.label)}" placeholder="${esc(r.ph)}"></th>`;
    return `<tr>${name}${cells}</tr>`;
  }).join('');
  return `<details class="wtf-panel" open><summary class="wtf-tt">${esc(t('wtf.check.title'))}</summary>
      <div class="wtf-row wtf-modes">
        <button class="wtf-btn wtf-sm ${ckMode === 'player' ? '' : 'wtf-ghost'}" data-ckmode="player">${esc(t('wtf.check.mode.player'))}</button>
        <button class="wtf-btn wtf-sm ${ckMode === 'color' ? '' : 'wtf-ghost'}" data-ckmode="color">${esc(t('wtf.check.mode.color'))}</button>
      </div>
      <p class="wtf-note">${esc(t('wtf.check.hint'))}</p>
      <div class="wtf-tablewrap"><table class="wtf-info wtf-checktbl"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>
    </details>`;
}

function infoTable() {
  const head = TRAITS.map(tr => `<th><span>${esc(L(tr))}</span></th>`).join('');
  const rows = LLAMAS.map(l => {
    const cells = TRAIT_IDS.map((_, i) => `<td>${l.vec[i] === '1' ? '✓' : ''}</td>`).join('');
    return `<tr><th class="wtf-lh">${esc(L(l))}</th>${cells}</tr>`;
  }).join('');
  return `<details class="wtf-panel"><summary class="wtf-tt">${esc(t('wtf.infoTable'))}</summary>
      <div class="wtf-tablewrap"><table class="wtf-info"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div></details>`;
}

function logBox(st) {
  const lines = (st.log || []).slice(-8).map(e => `<li>${esc(t(e.key, mapArgs(e.args || {})))}</li>`).reverse().join('');
  if (!lines) return '';
  return `<div class="wtf-log"><ul>${lines}</ul></div>`;
}

function devPanel() {
  const groups = CARD_CATS.map(cat => {
    const cards = EVENT_CARDS.filter(c => c.cat === cat).map(c =>
      `<button class="wtf-devcard" data-dev="${esc(c.id)}" title="${esc(L({ th: c.th.desc, en: c.en.desc }))}">${esc(L(c))} <em>${esc(c.timing)}</em></button>`).join('');
    return `<div class="wtf-devgrp"><b>${esc(cat)}</b>${cards}</div>`;
  }).join('');
  return `<div class="wtf-dev"><div class="wtf-tt">${esc(t('wtf.dev.title'))}</div>
      <p class="wtf-note">${esc(t('wtf.dev.hint'))}</p>${groups}</div>`;
}

function wire(el, ctx, st, me) {
  const val = (id) => el.querySelector('#' + id)?.value;

  el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'advance') return ctx.send('advance');
    if (act === 'announce') return ctx.send('announce', { text: val('wtf-say') || '' });
    if (act === 'flip') return ctx.send('flip', { slot: Number(b.dataset.slot) });
    if (act === 'skip') return ctx.send('skip');
    if (act === 'playHeld') return ctx.send('playHeld', { card: b.dataset.card });
    if (act === 'challenge') { const target = val('wtf-target'), guess = val('wtf-guess'); if (target && guess) ctx.send('challenge', { target, guess }); return; }
    if (act === 'resolve') return sendResolve(ctx, b.dataset.kind, val);
  }));
  el.querySelectorAll('[data-room]').forEach(b => b.addEventListener('click', () =>
    b.dataset.room === 'again' ? ctx.playAgain?.() : ctx.backToLobby?.()));

  el.querySelectorAll('[data-ckmode]').forEach(b => b.addEventListener('click', () => { ckMode = b.dataset.ckmode; render(el, ctx); }));
  el.querySelectorAll('.wtf-ck').forEach(td => td.addEventListener('click', () => {
    const k = td.dataset.row + '|' + td.dataset.trait;
    const v = ((ckTicks[k] || 0) + 1) % 3; ckTicks[k] = v;
    td.textContent = v === 1 ? '✓' : v === 2 ? '✗' : '';
    td.classList.toggle('y', v === 1); td.classList.toggle('n', v === 2);
  }));
  el.querySelectorAll('.wtf-cin').forEach(inp => inp.addEventListener('input', () => { ckNames[inp.dataset.color] = inp.value; }));

  el.querySelectorAll('[data-dev]').forEach(b => b.addEventListener('click', () => ctx.send('devFlip', { card: b.dataset.dev })));

  const tm = el.querySelector('.wtf-timer');
  if (tm) { const dl = Number(tm.dataset.deadline); tm.textContent = t('wtf.secLeft', { n: Math.max(0, Math.round((dl - Date.now()) / 1000)) }); }
  void st; void me;
}

function sendResolve(ctx, kind, val) {
  const p = {};
  if (kind === 'pickOwnTrait' || kind === 'pickAnyTrait') p.trait = val('wtf-trait');
  else if (kind === 'pickTwoTraits') p.traits = [val('wtf-trait'), val('wtf-trait2')];
  else if (kind === 'pickTarget' || kind === 'pickNeighbor' || kind === 'pickOut' || kind === 'vote') p.target = val('wtf-target');
  else if (kind === 'pickTargetOwnTrait' || kind === 'pickTargetAnyTrait') { p.target = val('wtf-target'); p.trait = val('wtf-trait'); }
  else if (kind === 'bestie') { p.target = val('wtf-target'); p.trait = val('wtf-trait'); }
  else if (kind === 'freeGuess') { p.target = val('wtf-target'); p.guess = val('wtf-guess'); }
  else if (kind === 'duelGuess' || kind === 'guessBack') p.guess = val('wtf-guess');
  ctx.send('resolve', p);
}

function ensureStyle() {
  if (document.getElementById('wtf-style')) return;
  const s = document.createElement('style');
  s.id = 'wtf-style';
  s.textContent = `
  .wtf-wrap{display:grid;grid-template-columns:240px 1fr 280px;gap:14px;padding:12px;color:#eae6f2;font-size:14px}
  @media(max-width:920px){.wtf-wrap{grid-template-columns:1fr}}
  .wtf-card,.wtf-panel,.wtf-block,.wtf-log,.wtf-slot,.wtf-held{background:#241d33;border:1px solid #3a3050;border-radius:12px}
  .wtf-me{display:flex;flex-direction:column;gap:12px}
  .wtf-card{padding:12px}
  .wtf-dim{opacity:.6;text-align:center;padding:20px 12px}
  .wtf-hint{font-size:11px;opacity:.6;margin-bottom:6px}
  .wtf-llama{text-align:center}
  .wtf-llama img{width:100%;max-width:180px;border-radius:10px;display:block;margin:0 auto 6px}
  .wtf-lname{font-weight:700;font-size:16px}
  .wtf-tt{font-size:12px;letter-spacing:.02em;opacity:.7;margin:8px 0 6px}
  .wtf-traits{margin:0;padding-left:18px;line-height:1.7}
  .wtf-seen ul{margin:0;padding-left:16px;font-size:12px;line-height:1.6}
  .wtf-mid{display:flex;flex-direction:column;gap:12px;min-width:0}
  .wtf-head{display:flex;align-items:center;gap:10px}
  .wtf-phase{font-weight:800;font-size:18px}
  .wtf-round{opacity:.7}
  .wtf-timer{margin-left:auto;background:#3a3050;padding:3px 10px;border-radius:20px;font-variant-numeric:tabular-nums}
  .wtf-center{display:flex;flex-direction:column;gap:12px}
  .wtf-block{padding:14px}
  .wtf-block h3{margin:0 0 8px}
  .wtf-pending{border-color:#6c4cf1}
  .wtf-note{opacity:.65;font-size:13px}
  .wtf-sub{margin-top:8px;font-size:12px;opacity:.7}
  .wtf-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
  .wtf-in,.wtf-sel{flex:1;min-width:120px;background:#191322;border:1px solid #3a3050;border-radius:8px;color:#eae6f2;padding:8px}
  .wtf-btn{background:#6c4cf1;border:0;color:#fff;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:600}
  .wtf-btn:hover{filter:brightness(1.1)}
  .wtf-sm{padding:4px 10px;font-size:12px}
  .wtf-ghost{background:#3a3050}
  .wtf-go{background:#e0446b}
  .wtf-chips{list-style:none;display:flex;flex-wrap:wrap;gap:6px;padding:0;margin:8px 0 0}
  .wtf-chips li{background:#191322;border:1px solid #3a3050;border-radius:20px;padding:3px 10px;opacity:.5}
  .wtf-chips li.on{opacity:1;border-color:#6c4cf1}
  .wtf-slots{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .wtf-slot{min-height:120px;padding:10px;display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;text-align:center}
  .wtf-slot.empty{opacity:.4}
  .wtf-by{font-size:12px;opacity:.7}
  .wtf-cname{font-weight:700}
  .wtf-cdesc{font-size:12px;opacity:.85}
  .wtf-timing{font-size:11px;opacity:.55;margin-top:4px}
  .wtf-pol-good{border-color:#4caf7d}.wtf-pol-risk{border-color:#e0446b}.wtf-pol-neu{border-color:#3a3050}
  .wtf-hand{display:flex;gap:8px;flex-wrap:wrap}
  .wtf-held{padding:8px 10px;min-width:130px;max-width:190px}
  .wtf-hostbar{display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap}
  .wtf-over{font-size:22px;font-weight:800;text-align:center;padding:20px}
  .wtf-side{display:flex;flex-direction:column;gap:12px}
  .wtf-panel{padding:10px}
  .wtf-players{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
  .wtf-players li{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:8px;background:#191322}
  .wtf-players li.meRow{outline:1px solid #6c4cf1}
  .wtf-players li.out{opacity:.4;text-decoration:line-through}
  .wtf-seat{width:18px;text-align:center;opacity:.6;font-size:12px}
  .wtf-pname{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .wtf-tag{font-size:11px;padding:1px 7px;border-radius:20px;background:#3a3050}
  .wtf-tag.turn{background:#e0446b}.wtf-tag.flip{background:#6c4cf1}.wtf-tag.hold{background:#4caf7d}.wtf-tag.mute{background:#8d6e63}.wtf-tag.gone{background:#33283f}
  .wtf-known{list-style:none;margin:0;padding:0;font-size:12px;line-height:1.7}
  .wtf-kv{display:inline-block;margin:0 4px 2px 0;padding:0 5px;border-radius:6px;background:#191322}
  .wtf-kv.yes{color:#7fe0a8}.wtf-kv.no{color:#e0889a}
  .wtf-modes{margin:6px 0}
  .wtf-tablewrap{overflow:auto;max-height:320px}
  .wtf-info{border-collapse:collapse;font-size:11px}
  .wtf-info th,.wtf-info td{border:1px solid #3a3050;padding:3px;text-align:center}
  .wtf-info thead th span{writing-mode:vertical-rl;transform:rotate(200deg);white-space:nowrap;display:inline-block}
  .wtf-info .wtf-lh{text-align:left;white-space:nowrap;position:sticky;left:0;background:#241d33}
  .wtf-checktbl .wtf-ck{cursor:pointer;min-width:22px;font-weight:700}
  .wtf-checktbl .wtf-ck.y{background:#20402f;color:#7fe0a8}.wtf-checktbl .wtf-ck.n{background:#40202a;color:#e0889a}
  .wtf-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:middle}
  .wtf-cin{width:80px;background:#191322;border:1px solid #3a3050;border-radius:6px;color:#eae6f2;padding:2px 4px;font-size:11px}
  .wtf-log{padding:8px 12px;font-size:12px;opacity:.85}
  .wtf-log ul{margin:0;padding-left:16px;line-height:1.6}
  .wtf-dev{position:fixed;right:10px;bottom:10px;width:300px;max-height:70vh;overflow:auto;background:#1a1526;border:1px solid #6c4cf1;border-radius:12px;padding:10px;z-index:50}
  .wtf-devgrp{margin-bottom:8px}
  .wtf-devgrp b{display:block;font-size:11px;opacity:.6;margin:6px 0 3px;text-transform:uppercase}
  .wtf-devcard{display:block;width:100%;text-align:left;background:#241d33;border:1px solid #3a3050;color:#eae6f2;border-radius:6px;padding:5px 8px;margin:2px 0;cursor:pointer;font-size:12px}
  .wtf-devcard:hover{border-color:#6c4cf1}
  .wtf-devcard em{opacity:.5;font-style:normal;float:right}`;
  document.head.appendChild(s);
}
