/* games.js — ทะเบียนเกม
   ─────────────────────────────────────────────────────────────
   เพิ่มเกมใหม่ = สร้างโฟลเดอร์ใน js/games/ แล้วเติมหนึ่งบรรทัด
   ใน js/games/index.js — ไม่ต้องแตะโค้ดแกนเลยสักไฟล์

   เกมพกของตัวเองมาทั้งหมด: ชื่อ คำอธิบาย รูปปก ภาพโต๊ะ จำนวนคน
   ตัวเลือกในหน้าตั้งค่า และคำแปลของตัวเอง
   หน้าเลือกเกมวาดจากข้อมูลพวกนี้ล้วน ๆ ไม่รู้จักเกมไหนเป็นการเฉพาะ

   คีย์คำแปลใช้แบบตั้งชื่อตามระเบียบ ไม่ต้องประกาศซ้ำ
     game.<id>.name              ชื่อเกม
     game.<id>.desc              คำอธิบายสั้น
     game.<id>.<setting>         ชื่อตัวเลือก
     game.<id>.<setting>.<value> ชื่อค่าของตัวเลือก
   ───────────────────────────────────────────────────────────── */

import { extend } from './i18n.js';

/* หมวดของเกม — 'all' เป็นตัวกรองเท่านั้น ไม่ใช่หมวดที่เกมประกาศได้ */
export const CATEGORIES = ['all', 'card', 'board'];

const registry = new Map();

export function register(game) {
  if (!game || !game.id) throw new Error('เกมต้องมี id');
  if (game.i18n) extend(game.i18n);

  registry.set(game.id, {
    minPlayers: 2,
    maxPlayers: 15,
    settings: [],
    category: 'card',
    cover: null,
    table: null,
    ...game,
    nameKey: `game.${game.id}.name`,
    descKey: `game.${game.id}.desc`
  });
}

export const all = () => [...registry.values()];
export const get = (id) => registry.get(id) || null;

/* ค่าตั้งต้นของตัวเลือกทั้งหมดในเกมหนึ่ง */
export function defaultSettings(game) {
  const out = {};
  (game.settings || []).forEach(s => { out[s.key] = s.default; });
  return out;
}

export const settingKey = (gameId, key) => `game.${gameId}.${key}`;
export const optionKey  = (gameId, key, value) => `game.${gameId}.${key}.${value}`;

/* เกมนี้เล่นด้วยจำนวนคนเท่านี้ได้ไหม */
export const fits = (game, count) =>
  !!game && count >= game.minPlayers && count <= game.maxPlayers;
