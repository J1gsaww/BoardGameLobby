/* mixer.js — ระดับเสียงสามหลอด
   ─────────────────────────────────────────────────────────────
   รวม · เพลง · เสียงประกอบ

   หลอดรวมคูณทับอีกสองหลอด จึงหรี่ทั้งหมดพร้อมกันได้โดยไม่เสียสัดส่วน
   ที่ตั้งไว้ เช่นอยากให้เสียงประกอบดังกว่าเพลงเป็นสองเท่า พอหรี่หลอดรวมลง
   ก็ยังดังกว่าสองเท่าอยู่

   เก็บในเครื่องเหมือนภาษาและรูปประจำตัว ไม่ขึ้น Firestore
   เพราะเป็นเรื่องของหูแต่ละคน ไม่ใช่ของห้อง
   ───────────────────────────────────────────────────────────── */

const KEY = 'lobby.mixer';
const OLD_VOL = 'lobby.volume';     // ของรุ่นก่อนที่มีหลอดเดียว
const OLD_MUTE = 'lobby.muted';

export const CHANNELS = ['master', 'music', 'sfx'];

export const mixer = { master: 0.8, music: 0.35, sfx: 0.7, muted: false };

const listeners = [];
export const onChange = (fn) => listeners.push(fn);
const emit = () => listeners.forEach(f => { try { f(mixer); } catch (e) { console.error(e); } });

const clamp = (v) => Math.min(1, Math.max(0, Number(v) || 0));

/* ระดับที่เอาไปใช้จริง — หลอดรวมคูณทับเสมอ */
export const musicLevel = () => (mixer.muted ? 0 : mixer.master * mixer.music);
export const sfxLevel   = () => (mixer.muted ? 0 : mixer.master * mixer.sfx);

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      CHANNELS.forEach(c => { if (saved[c] !== undefined) mixer[c] = clamp(saved[c]); });
      mixer.muted = !!saved.muted;
      return;
    }
    // ย้ายค่าจากรุ่นที่มีหลอดเดียวมาให้ ไม่ต้องมาตั้งใหม่
    const old = parseFloat(localStorage.getItem(OLD_VOL));
    if (!Number.isNaN(old)) mixer.music = clamp(old);
    mixer.muted = localStorage.getItem(OLD_MUTE) === '1';
  } catch { /* เปิดแบบไม่มีที่เก็บก็ใช้ค่าตั้งต้น */ }
}

const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify(mixer)); } catch {}
};

export function set(channel, value) {
  if (!CHANNELS.includes(channel)) return;
  mixer[channel] = clamp(value);
  if (mixer[channel] > 0 && mixer.muted && channel === 'master') mixer.muted = false;
  persist();
  emit();
}

export function toggleMute() {
  mixer.muted = !mixer.muted;
  if (!mixer.muted && mixer.master === 0) mixer.master = 0.6;   // เปิดเสียงแล้วต้องได้ยินจริง
  persist();
  emit();
}

load();
