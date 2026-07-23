/* music.js — เพลงพื้นหลัง
   ─────────────────────────────────────────────────────────────
   ท่าที่ใช้: เริ่มเล่นแบบปิดเสียงตั้งแต่โหลด แล้วค่อยเปิดเสียงตอน
   ผู้ใช้แตะครั้งแรก

   ทำไมได้ผล — เบราว์เซอร์ห้ามเล่น "เสียง" เอง แต่ไม่เคยห้ามเล่นสื่อ
   ที่ปิดเสียงไว้ เพลงจึงเริ่มเดินตั้งแต่วินาทีแรกจริง ๆ แค่ยังไม่ได้ยิน
   พอผู้ใช้คลิกอะไรสักอย่าง เราแค่เปิดเสียง ไม่ได้เริ่มเล่นใหม่
   เสียงเลยมาทันทีแบบไม่มีสะดุด และไม่ต้องรอโหลด

   getAutoplayPolicy บอกล่วงหน้าได้ว่าเว็บนี้ได้รับอนุญาตแล้วหรือยัง
   ถ้าได้แล้วก็ข้ามขั้นปิดเสียงไปเลย (Chrome/Firefox รุ่นใหม่มี Safari ยังไม่มี)
   ───────────────────────────────────────────────────────────── */

const VOL_KEY  = 'lobby.volume';
const MUTE_KEY = 'lobby.muted';
const FADE_MS  = 1200;
const GESTURES = ['pointerdown', 'keydown', 'touchstart'];

let el = null;
let armed = false;
let fadeTimer = null;
const listeners = [];

export const music = {
  volume: 0.35,
  muted: false,      // ผู้ใช้เลือกปิดเสียงเอง (จำไว้ในเครื่อง)
  playing: false,
  pending: false,    // เพลงเดินอยู่แล้วแต่ยังปิดเสียง รอผู้ใช้แตะ
  missing: false
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
  el.volume = music.volume;

  el.addEventListener('error', () => {
    music.missing = true; music.playing = false; music.pending = false;
    console.warn('[music] เปิดไฟล์ไม่ได้:', window.MUSIC_SRC);
    emit();
  });
  el.addEventListener('playing', () => { music.playing = true; emit(); });
  el.addEventListener('pause',   () => { music.playing = false; emit(); });

  if (music.muted) { emit(); return; }   // ผู้ใช้ปิดเสียงไว้แต่แรก ไม่ต้องเล่น

  // เว็บนี้ได้รับอนุญาตแล้วหรือยัง — ถ้ารู้ล่วงหน้าก็ไม่ต้องผ่านขั้นปิดเสียง
  const policy = typeof navigator.getAutoplayPolicy === 'function'
    ? navigator.getAutoplayPolicy('mediaelement')
    : null;

  if (policy === 'allowed') {
    el.muted = false;
    music.pending = false;
    el.play().catch(startSilent);          // เผื่อพลาด ก็ถอยไปท่าปิดเสียง
    emit();
    return;
  }

  startSilent();
}

/* เริ่มเดินแบบปิดเสียง แล้วรอการแตะครั้งแรก */
function startSilent() {
  el.muted = true;
  music.pending = true;
  el.play()
    .then(() => { arm(); emit(); })
    .catch(() => { arm(); emit(); });     // ถึงจะโดนบล็อกหมด การแตะก็ยังกู้ได้
}

function arm() {
  if (armed) return;
  armed = true;
  const go = () => {
    GESTURES.forEach(e => window.removeEventListener(e, go));
    armed = false;
    reveal();
  };
  GESTURES.forEach(e => window.addEventListener(e, go, { passive: true }));
}

/* เปิดเสียง — ไม่ได้เริ่มเล่นใหม่ แค่เลิกปิดเสียง */
function reveal() {
  if (!el || music.missing || music.muted) { music.pending = false; emit(); return; }
  music.pending = false;
  el.muted = false;
  if (el.paused) el.play().catch(() => {});
  fadeTo(music.volume, 0);
  emit();
}

/* ── ไล่ระดับเสียง ─────────────────────────────────── */

function fadeTo(target, from) {
  if (!el) return;
  clearInterval(fadeTimer);
  const start = (from === undefined) ? el.volume : from;
  el.volume = start;
  const steps = 24;
  let i = 0;
  fadeTimer = setInterval(() => {
    i++;
    el.volume = Math.min(1, Math.max(0, start + (target - start) * (i / steps)));
    if (i >= steps) clearInterval(fadeTimer);
  }, FADE_MS / steps);
}

/* ── ปุ่มควบคุม ────────────────────────────────────── */

export function setVolume(v) {
  music.volume = Math.min(1, Math.max(0, v));
  localStorage.setItem(VOL_KEY, String(music.volume));

  if (music.volume === 0) {
    if (!music.muted) { music.muted = true; localStorage.setItem(MUTE_KEY, '1'); }
  } else if (music.muted) {
    music.muted = false; localStorage.setItem(MUTE_KEY, '0');
  }

  if (el) {
    clearInterval(fadeTimer);
    el.muted = music.muted;
    el.volume = music.volume;
    if (!music.muted && el.paused && !music.missing) el.play().catch(() => {});
  }
  music.pending = false;
  emit();
}

export function toggleMute() {
  music.muted = !music.muted;
  localStorage.setItem(MUTE_KEY, music.muted ? '1' : '0');
  music.pending = false;

  if (!el || music.missing) { emit(); return; }

  if (music.muted) {
    clearInterval(fadeTimer);
    el.muted = true;
    el.pause();
  } else {
    if (music.volume === 0) { setVolume(0.35); return; }
    el.muted = false;
    if (el.paused) el.play().catch(() => {});
    fadeTo(music.volume, 0);
  }
  emit();
}
