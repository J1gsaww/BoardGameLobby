/* music.js — เพลงพื้นหลัง
   ─────────────────────────────────────────────────────────────
   เรื่องที่ต้องรู้ก่อน: เบราว์เซอร์ทุกตัวสมัยนี้ "ห้ามเล่นเสียงเอง"
   จนกว่าผู้ใช้จะแตะอะไรสักอย่างบนหน้าเว็บก่อน — ไม่ใช่บั๊ก แต่เป็น
   กติกาที่ Chrome/Safari/Firefox บังคับเหมือนกันหมด

   ไฟล์นี้จึงทำสองชั้น
     1. ลองเล่นทันทีที่เปิดเว็บ (ถ้าผู้ใช้เคยแตะหน้านี้มาก่อนจะผ่านเลย)
     2. ถ้าโดนบล็อก ก็ไม่บ่น แค่รอ — พอผู้ใช้คลิกหรือกดปุ่มอะไรก็ตาม
        ครั้งแรก เพลงจะเริ่มเองเงียบ ๆ
   ───────────────────────────────────────────────────────────── */

const VOL_KEY  = 'lobby.volume';
const MUTE_KEY = 'lobby.muted';
const FADE_MS  = 900;

let el = null;
let armed = false;
let fadeTimer = null;
const listeners = [];

export const music = {
  volume: 0.35,      // เพลงพื้นหลัง ดังเท่านี้กำลังดี
  muted: false,
  playing: false,
  blocked: false,    // เบราว์เซอร์ยังไม่ยอมให้เล่น รอผู้ใช้แตะ
  missing: false     // หาไฟล์ไม่เจอ
};

const emit = () => listeners.forEach(f => { try { f(music); } catch (e) { console.error(e); } });
export const onChange = (fn) => listeners.push(fn);

/* ── เริ่มต้น ──────────────────────────────────────── */

export function init() {
  const saved = parseFloat(localStorage.getItem(VOL_KEY));
  if (!Number.isNaN(saved)) music.volume = Math.min(1, Math.max(0, saved));
  music.muted = localStorage.getItem(MUTE_KEY) === '1';

  el = new Audio();
  el.src = window.MUSIC_SRC;
  el.loop = true;
  el.preload = 'auto';
  el.volume = 0;

  el.addEventListener('error', () => {
    music.missing = true;
    music.playing = false;
    console.warn('[music] เปิดไฟล์ไม่ได้:', window.MUSIC_SRC);
    emit();
  });
  el.addEventListener('playing', () => { music.playing = true; music.blocked = false; emit(); });
  el.addEventListener('pause',   () => { music.playing = false; emit(); });

  attempt();
}

/* ── เล่น / หยุด ───────────────────────────────────── */

function attempt() {
  if (!el || music.missing) return;
  if (music.muted) { fadeTo(0); el.pause(); emit(); return; }

  el.play()
    .then(() => { music.blocked = false; fadeTo(music.volume); emit(); })
    .catch(() => { music.blocked = true; arm(); emit(); });
}

/* รอการแตะครั้งแรกของผู้ใช้ แล้วค่อยลองใหม่ */
function arm() {
  if (armed) return;
  armed = true;
  const go = () => {
    ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.removeEventListener(e, go));
    armed = false;
    attempt();
  };
  ['pointerdown', 'keydown', 'touchstart']
    .forEach(e => window.addEventListener(e, go, { passive: true }));
}

/* ค่อย ๆ ไล่ระดับเสียง ไม่ให้ตูมใส่หน้า */
function fadeTo(target) {
  if (!el) return;
  clearInterval(fadeTimer);
  const from = el.volume;
  const steps = 18;
  let i = 0;
  fadeTimer = setInterval(() => {
    i++;
    el.volume = Math.min(1, Math.max(0, from + (target - from) * (i / steps)));
    if (i >= steps) clearInterval(fadeTimer);
  }, FADE_MS / steps);
}

/* ── ปุ่มควบคุม ────────────────────────────────────── */

export function setVolume(v) {
  music.volume = Math.min(1, Math.max(0, v));
  localStorage.setItem(VOL_KEY, String(music.volume));

  if (music.volume === 0) {                  // ลากลงสุด = ปิดเสียงไปเลย
    if (!music.muted) { music.muted = true; localStorage.setItem(MUTE_KEY, '1'); }
  } else if (music.muted) {
    music.muted = false; localStorage.setItem(MUTE_KEY, '0');
  }

  if (el) {
    clearInterval(fadeTimer);
    el.volume = music.muted ? 0 : music.volume;
  }
  if (!music.muted && !music.playing) attempt(); else emit();
}

export function toggleMute() {
  music.muted = !music.muted;
  localStorage.setItem(MUTE_KEY, music.muted ? '1' : '0');

  if (music.muted) {
    fadeTo(0);
    setTimeout(() => { if (music.muted && el) el.pause(); }, FADE_MS);
    emit();
  } else {
    if (music.volume === 0) setVolume(0.35);
    else attempt();
  }
}
