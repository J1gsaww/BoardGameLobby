/* journal.js — สมุดการ์ด
   ─────────────────────────────────────────────────────────────
   รวมการ์ดทุกใบในเกมไว้ที่เดียว พร้อมภาพ คำอธิบาย และจำนวนใบ
   บอก **ทั้งสำรับ** ไม่ใช่ว่ากองที่เหลือมีอะไร — เป็นหนังสือกติกา ไม่ใช่ที่นับไพ่

   คำอธิบายแสดงเป็นคอลัมน์ข้างภาพเลย ไม่ต้องเอาเมาส์ไปชี้
   เพราะจุดประสงค์คืออ่านเทียบกันหลายใบพร้อมกัน ไม่ใช่ดูทีละใบ */

import { BASE_CARDS, cardArt, cardArtAlt } from './events.js';
import { EXTRA_CARDS } from './cards.js';
import { t, lang } from '../../i18n.js';

const esc = (s) => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* หกหมวดตามที่ตกลงกันไว้ — ชุดมาตรฐานสามระดับ แล้วชุดพิเศษอีกสามระดับ */
export const SECTIONS = [
  { id: 'common',  set: 'base',  rarity: 'common' },
  { id: 'map',     set: 'base',  rarity: 'map' },
  { id: 'rare',    set: 'base',  rarity: 'rare' },
  { id: 'xcommon', set: 'extra', rarity: 'common' },
  { id: 'xmap',    set: 'extra', rarity: 'map' },
  { id: 'xrare',   set: 'extra', rarity: 'rare' }
];

const cardsOf = (sec) =>
  (sec.set === 'base' ? BASE_CARDS : EXTRA_CARDS).filter(c => c.rarity === sec.rarity);

/* จำนวนใบรวมของหมวดนั้น — ชนิดหนึ่งอาจมีหลายใบ */
export const countOf = (sec) => cardsOf(sec).reduce((n, c) => n + (c.count || 1), 0);

function cell(card) {
  const info = card[lang] || card.th;
  const n = card.count || 1;
  return `<div class="jr-card">
      <img class="jr-img" src="${esc(cardArt(card.id))}" alt=""
        draggable="false" data-alt="${esc(cardArtAlt(card.id))}"
        onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt='';}
                 else{this.replaceWith(Object.assign(document.createElement('div'),
                   {className:'jr-img jr-img-none'}));}">
      ${n > 1 ? `<span class="jr-n">\u00d7${n}</span>` : ''}
    </div>
    <div class="jr-text">
      <p class="jr-name">${esc(info.name)}</p>
      <p class="jr-desc">${esc(info.desc)}</p>
    </div>`;
}

/* วาดเนื้อหาตามหมวดที่เลือกไว้ */
export function journalBody(picked) {
  const parts = SECTIONS.filter(s => picked.has(s.id)).map(sec => {
    const list = cardsOf(sec);
    if (!list.length) return '';
    return `<section class="jr-sec">
        <h4 class="jr-sec-head">
          <span>${esc(t('journal.sec.' + sec.id))}</span>
          <span class="jr-sec-n">${esc(t('journal.cards', { n: countOf(sec) }))}</span>
        </h4>
        <div class="jr-grid">${list.map(cell).join('')}</div>
      </section>`;
  }).join('');

  return parts || `<p class="jr-empty">${esc(t('journal.none'))}</p>`;
}

export function journalTabs(picked) {
  const all = SECTIONS.every(s => picked.has(s.id));
  return `<button class="jr-tab jr-tab-all${all ? ' on' : ''}" data-tab="*">
      ${esc(t('journal.all'))}</button>` +
    SECTIONS.map(s => `<button class="jr-tab${picked.has(s.id) ? ' on' : ''}" data-tab="${s.id}">
      ${esc(t('journal.sec.' + s.id))}
      <span class="jr-tab-n">${countOf(s)}</span>
    </button>`).join('');
}
