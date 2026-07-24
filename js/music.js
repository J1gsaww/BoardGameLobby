/* music.js — เพลงพื้นหลัง
   ─────────────────────────────────────────────────────────────
   ท่าที่ใช้: เริ่มเล่นแบบปิดเสียงตั้งแต่โหลด แล้วค่อยเปิดเสียงตอน
   ผู้ใช้แตะครั้งแรก

   ทำไมได้ผล — เบราว์เซอร์ห้ามเล่น "เสียง" เอง แต่ไม่เคยห้ามเล่นสื่อ
   ที่ปิดเสียงไว้ เพลงจึงเดินตั้งแต่วินาทีแรกจริง ๆ แค่ยังไม่ได้ยิน
   พอผู้ใช้คลิกอะไรสักอย่าง เราแค่เปิดเสียง ไม่ได้เริ่มเล่นใหม่

   ระดับเสียงมาจาก mixer.js ไม่ได้เก็บเอง จะได้ใช้หลอดร่วมกับเสียงประกอบ
   ───────────────────────────────────────────────────────────── */

import { mixer, musicLevel, onChange as onMix } from './mixer.js';

const FADE_MS = 1200;
const GESTURES = ['pointerdown', 'keydown', 'touchstart'];

let el = null;
let currentSrc = null;
let armed = false;
let fadeTimer = null;
const listeners = [];

export const music = {
  playing: false,
  pending: false,    // เพลงเดินอยู่แล้วแต่ยังปิดเสียง รอผู้ใช้แตะ
  missing: false
};

const emit = () => listeners.forEach(f => { try { f(music); } catch (e) { console.error(e); } });
export const onChange = (fn) => listeners.push(fn);

/* ── เริ่มต้น ──────────────────────────────────────── */

export function init() {
  el = new Audio();
  currentSrc = window.MUSIC_SRC;
  el.src = currentSrc;
  console.info('[music] กำลังหาไฟล์ที่', new URL(window.MUSIC_SRC, location.href).href);
  el.loop = true;
  el.preload = 'auto';
  el.volume = musicLevel();

  el.addEventListener('error', () => {
    music.missing = true; music.playing = false; music.pending = false;
    console.warn('[music] เปิดไฟล์ไม่ได้:', currentSrc);
    emit();
  });
  el.addEventListener('playing', () => { music.playing = true; emit(); });
  el.addEventListener('pause',   () => { music.playing = false; emit(); });

  onMix(applyLevel);

  if (musicLevel() <= 0) { emit(); return; }   // ปิดเสียงไว้แต่แรก ไม่ต้องโหลดมาหมุนทิ้ง

  const policy = typeof navigator.getAutoplayPolicy === 'function'
    ? navigator.getAutoplayPolicy('mediaelement')
    : null;

  if (policy === 'allowed') {
    el.muted = false;
    music.pending = false;
    el.play().catch(startSilent);
    emit();
    return;
  }
  startSilent();
}

/* เริ่มเดินแบบปิดเสียง แล้วรอการแตะครั้งแรก */
function startSilent() {
  el.muted = true;
  music.pending = true;
  el.play().then(() => { arm(); emit(); }).catch(() => { arm(); emit(); });
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
  if (!el || music.missing) { music.pending = false; emit(); return; }
  music.pending = false;
  if (musicLevel() <= 0) { emit(); return; }
  el.muted = false;
  if (el.paused) el.play().catch(() => {});
  fadeTo(musicLevel(), 0);
  emit();
}

/* ── ระดับเสียงเปลี่ยน ─────────────────────────────── */

function applyLevel() {
  if (!el) return;
  const level = musicLevel();
  clearInterval(fadeTimer);

  if (level <= 0) { el.muted = true; el.pause(); emit(); return; }

  el.volume = level;
  el.muted = music.pending;              // ยังไม่ได้แตะจอ ก็เล่นแบบเงียบต่อไป
  if (el.paused && !music.missing) el.play().catch(() => { music.pending = true; arm(); });
  emit();
}

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

/* ── สลับเพลง ──────────────────────────────────────────────
   เกมประกาศเพลงของตัวเองมาได้ เข้าเกมแล้วเปลี่ยน ออกจากเกมแล้วกลับเพลงเดิม */
export function setTrack(src) {
  if (!el || !src || src === currentSrc) return;
  currentSrc = src;
  music.missing = false;

  const swap = () => {
    el.src = src;
    el.load();
    if (musicLevel() <= 0) { el.pause(); emit(); return; }
    el.muted = music.pending;
    el.play()
      .then(() => { if (!music.pending) fadeTo(musicLevel(), 0); })
      .catch(() => { music.pending = true; arm(); emit(); });
    emit();
  };

  if (el.paused || musicLevel() <= 0) swap();
  else { fadeTo(0); setTimeout(swap, 520); }
}

export const defaultTrack = () => window.MUSIC_SRC;
