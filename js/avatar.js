/* avatar.js — รูปประจำตัว
   ─────────────────────────────────────────────────────────────
   เก็บไว้ในเครื่องตัวเอง แล้วอัปขึ้นตอนเข้าห้องเพื่อให้คนอื่นเห็น
   ห้องถูกปิดเมื่อไหร่ รูปหายจากหลังบ้านทันที ไม่มีอะไรค้าง
   แต่ของในเครื่องยังอยู่ เข้าห้องใหม่ก็ได้รูปเดิมกลับมาเอง

   ย่อให้เล็กก่อนเสมอ — จอแสดงจริงแค่ 26–44px รูปกล้องมือถือ 4 MB
   จึงเปลืองเปล่า ๆ ย่อเหลือ 128px แล้วบีบเป็น WebP จะเหลือราว 4–8 KB
   ───────────────────────────────────────────────────────────── */

const KEY = 'lobby.avatar';
const SIZE = 128;
const MAX_CHARS = 60000;      // เพดานความยาวข้อความรูป กันเอกสารบวม

export const load = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const save = (url) => { try { url ? localStorage.setItem(KEY, url) : localStorage.removeItem(KEY); } catch {} };
export const clear = () => save('');

/* เปิดไฟล์ที่ผู้ใช้เลือก คืนภาพดิบไว้ให้หน้าจอเอาไปให้ครอบเอง */
export async function openImage(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('notAnImage');
  return await createImageBitmap(file);
}

/* ครอบตามกรอบที่ผู้ใช้เลื่อนเอง แล้วย่อกับบีบให้เล็กพอ
   sx, sy, side อยู่ในหน่วยพิกเซลของภาพต้นฉบับ */
export async function cropToDataUrl(bitmap, sx, sy, side) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;

  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);

  // ไล่บีบลงเรื่อย ๆ จนกว่าจะเล็กพอ ถ้ายังไม่พอค่อยย่อขนาดลงอีกขั้น
  for (const [type, q] of [['image/webp', .75], ['image/webp', .55], ['image/webp', .38], ['image/jpeg', .5]]) {
    const url = canvas.toDataURL(type, q);
    if (url && url.length <= MAX_CHARS && url.startsWith('data:image')) return url;
  }

  const small = document.createElement('canvas');
  small.width = small.height = 72;
  small.getContext('2d').drawImage(canvas, 0, 0, 72, 72);
  const url = small.toDataURL('image/webp', .5);
  if (url.length > MAX_CHARS) throw new Error('tooBig');
  return url;
}

/* ── วาดรูปประจำตัว ─────────────────────────────────────────
   ไม่มีรูปก็ขึ้นวงกลมตัวอักษรแรกของชื่อ สีคิดจาก uid จึงคงที่ตลอด */

const TINTS = ['#f4a949', '#6ee3b4', '#f2647e', '#7ab4ff', '#c79bff', '#ffd66b', '#5fd8d8', '#ff9b6b'];
const tint = (uid) => TINTS[Math.abs([...String(uid)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % TINTS.length];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

export function face(uid, name, url, size = 30) {
  const style = `width:${size}px;height:${size}px`;
  if (url) {
    return `<span class="avatar" style="${style}"><img src="${esc(url)}" alt="" ` +
           `onerror="this.parentNode.classList.add('broken');this.remove()"></span>`;
  }
  const letter = esc((name || '?').trim().slice(0, 1).toUpperCase());
  return `<span class="avatar letter" style="${style};background:${tint(uid)};font-size:${Math.round(size * 0.46)}px">${letter}</span>`;
}
