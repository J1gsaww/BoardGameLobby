/* ui.js — หน้าจอของ Yahhh
   ─────────────────────────────────────────────────────────────
   ซ้าย = กระดานคะแนนของสองคนวางเทียบกัน · ขวา = มือกับปุ่ม

   กระดานวางคู่กันตั้งแต่ต้นเพราะเกมนี้ตัดสินกันที่การเทียบช่อง
   ต้องเห็นตลอดว่าอีกฝ่ายเหลือช่องอะไร ไม่งั้นเลือกลงช่องไม่ถูก

   ไพ่ที่ล็อกไว้ยกขึ้นและมีกรอบไฟ ใบที่ยังไม่ล็อกอยู่ระดับปกติ
   สถานะนี้อยู่ในเครื่องของคนเล่นเท่านั้น ยังไม่ส่งจนกว่าจะกดสุ่ม */

import { cardFace } from '../core/face.js';
import { t } from '../../i18n.js';
import { ROWS, scoreFor, sheetTotal, openRows } from './rules.js';
import * as Sound from './sound.js';

const esc = (s) => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ใบที่ล็อกไว้ — เก็บในเครื่อง ยังไม่ส่งจนกว่าจะกดสุ่มใหม่ */
let lock = [];
let lockFor = '';

export function render(el, ctx) {
  const st = ctx.state;
  if (!st || !st.phase) { el.innerHTML = ''; lock = []; Sound.reset(); return; }

  /* เสียงผูกกับสถานะ ทั้งสองคนจึงได้ยินพร้อมกัน ไม่ใช่แค่คนที่กด */
  Sound.preload();
  Sound.play(st);

  const me = ctx.me.uid;
  const mine = st.turn === me && st.phase === 'play';

  /* มือเปลี่ยน = ล้างการล็อกเก่า ไม่งั้นจะล็อกใบที่ไม่มีอยู่แล้ว */
  const key = st.hand.join(',') + '|' + st.turn;
  if (lockFor !== key) { lockFor = key; lock = lock.filter(c => st.hand.includes(c)); }

  el.innerHTML = `
    <div class="yh-wrap">
      ${sheetSide(st, ctx)}
      <div class="yh-play">
        ${head(st, ctx)}
        ${handRow(st, mine)}
        ${controls(st, mine)}
      </div>
    </div>`;

  bind(el, ctx, mine);
}

function head(st, ctx) {
  if (st.phase === 'over') {
    const r = st.result;
    const line = r.draw
      ? t('yahhh.over.draw')
      : t('yahhh.over.win', { name: st.names?.[r.winners[0]] || '?' });
    return `<div class="yh-head"><p class="yh-big">${esc(line)}</p></div>`;
  }
  const who = st.turn === ctx.me.uid
    ? t('yahhh.yourTurn')
    : t('yahhh.theirTurn', { name: st.names?.[st.turn] || '?' });
  return `<div class="yh-head">
      <span class="yh-round">${esc(t('yahhh.round', { n: st.round, of: ROWS.length }))}</span>
      <p class="yh-big">${esc(who)}</p>
      <span class="yh-left">${esc(t('yahhh.rerollsLeft', { n: st.left }))}</span>
    </div>`;
}

function handRow(st, mine) {
  const cards = st.hand.map(c => {
    const on = lock.includes(c);
    return `<button class="yh-card${on ? ' on' : ''}" data-card="${esc(c)}"
      ${mine && st.left > 0 ? '' : 'disabled'}>${cardFace(c, 76)}</button>`;
  }).join('');
  return `<div class="yh-hand">${cards}</div>
    <p class="yh-hint">${esc(mine && st.left > 0 ? t('yahhh.tapToLock') : '')}</p>`;
}

function controls(st, mine) {
  if (st.phase === 'over') return '';
  const can = mine && st.left > 0 && lock.length < st.hand.length;
  return `<div class="yh-acts">
      <button class="btn" data-do="reroll"${can ? '' : ' disabled'}>${
        esc(t('yahhh.reroll', { n: st.left }))}</button>
    </div>`;
}

/* กระดานคะแนนของทั้งสองคน วางเทียบกันคอลัมน์ต่อคอลัมน์ */
function sheetSide(st, ctx) {
  const me = ctx.me.uid;
  const mine = st.turn === me && st.phase === 'play';

  const rows = ROWS.map(row => {
    const cells = st.seats.map(u => {
      const v = st.sheets[u]?.[row];
      const own = u === me;
      /* ช่องที่ยังว่างของเราเอง กดลงได้ตอนถึงตา — โชว์คะแนนที่จะได้ล่วงหน้า */
      if (v == null && own && mine) {
        const got = scoreFor(row, st.hand);
        return `<td class="yh-cell open"><button class="yh-pick" data-row="${esc(row)}"
          >${got || 0}</button></td>`;
      }
      return `<td class="yh-cell${v == null ? '' : ' done'}">${v == null ? '' : v}</td>`;
    }).join('');
    return `<tr><th>${esc(t('yahhh.row.' + row))}</th>${cells}</tr>`;
  }).join('');

  const totals = st.seats.map(u =>
    `<td class="yh-cell total">${sheetTotal(st.sheets[u])}</td>`).join('');

  return `<div class="yh-sheet">
      <table>
        <thead><tr><th></th>${
          st.seats.map(u => `<th class="yh-who${u === st.turn ? ' now' : ''}">${
            esc(st.names?.[u] || '?')}</th>`).join('')
        }</tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><th>${esc(t('yahhh.total'))}</th>${totals}</tr></tfoot>
      </table>
    </div>`;
}

function bind(el, ctx, mine) {
  el.querySelectorAll('[data-card]').forEach(b => {
    b.onclick = () => {
      const c = b.dataset.card;
      lock = lock.includes(c) ? lock.filter(x => x !== c) : [...lock, c];
      render(el, ctx);
    };
  });

  const go = el.querySelector('[data-do="reroll"]');
  if (go) go.onclick = () => { if (!go.disabled) ctx.send('reroll', { keep: [...lock] }); };

  el.querySelectorAll('[data-row]').forEach(b => {
    b.onclick = () => { lock = []; ctx.send('score', { row: b.dataset.row }); };
  });
}
