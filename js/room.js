/* room.js — วงจรชีวิตของห้อง
   ─────────────────────────────────────────────────────────────
   หลักที่ยึดไว้ตั้งแต่แรก: ไม่มีอะไรที่ใช้ตัดสินอยู่ในหน่วยความจำ
   ของเครื่องไหนเลย ทุกอย่างอยู่บน Firestore เพราะเจ้าของห้อง
   ก็เป็นผู้เล่นคนหนึ่ง ปิดแท็บเมื่อไหร่ก็ได้ แล้วคนอื่นต้องรับช่วงต่อ
   ได้ทันทีโดยไม่ต้องรู้อะไรเพิ่ม

   rooms/{code}
     hostUid · status ('lobby' | 'playing') · gameId · gameSettings
     seq · createdAt · touchedAt
   rooms/{code}/members/{uid}
     name · role ('player' | 'spectator') · seat · ready · lastSeen · joinedAt
   rooms/{code}/actions/{id}
     uid · type · payload · at        ผู้เล่นยื่นคำขอ เจ้าของห้องอ่านแล้วลบ
   rooms/{code}/secrets/{uid}
     ข้อมูลลับรายคน                    เจ้าของห้องเขียน เจ้าตัวกับเจ้าของห้องอ่าน
   rooms/{code}/chat/{id}
     uid · name · text · at            ทุกคนในห้องอ่านได้ · เขียนได้ในนามตัวเอง
   rooms/{code}/avatars/{uid}
     img                               รูปประจำตัว แยกออกมาเพราะเอกสารสมาชิก
                                       ถูกเขียนทับทุก 5 วินาที ถ้าเก็บรวมกันจะส่งรูปซ้ำทั้งวง

   หน้าที่ที่เป็นของเจ้าของห้องอย่างเดียว: แจกเลขที่นั่ง, เปลี่ยน status,
   ล้างสถานะพร้อมตอนกลับเข้าห้อง  — คนอื่นเขียนได้แค่เอกสารของตัวเอง
   ───────────────────────────────────────────────────────────── */

import { db, fb, me } from './net.js';
import { AppError } from './i18n.js';
import * as Games from './games.js';
import * as Avatar from './avatar.js';

const ALPHA = 'ACDEFGHJKLMNPQRTUVWXY34679';   // ตัดตัวที่อ่านสับสนออก
const HEARTBEAT = 5000;
const OFFLINE   = 20000;   // เงียบเกินนี้ = ถือว่าหลุด
const HOST_GONE = 25000;   // เจ้าของห้องเงียบเกินนี้ = ยึดตำแหน่งได้
const CHAT_KEEP = 60;      // เก็บข้อความล่าสุดเท่านี้ ที่เกินเจ้าของห้องลบทิ้ง
const STALE_MS  = 12 * 3600 * 1000;   // ห้องที่ไม่มีใครแตะเกินนี้ = ห้องร้าง

export const room = {
  code: null,
  doc: null,
  members: [],
  closed: false,
  secret: null,      // ข้อมูลลับของเราคนเดียว
  secrets: {},       // ของทุกคน — มีครบเฉพาะตอนเราเป็นเจ้าของห้อง
  chat: [],          // ข้อความล่าสุดในห้อง
  avatars: {},       // รูปประจำตัวของทุกคนในห้อง
  avatarError: null, // อัปรูปไม่สำเร็จ เก็บรหัสไว้บอกผู้ใช้
  kicked: false,     // โดนเจ้าของห้องเตะออก
  get isHost() { return !!room.doc && room.doc.hostUid === me.uid; },
  get mine()   { return room.members.find(m => m.uid === me.uid) || null; }
};

let watchers = [];
let unsubs = [];
let beat = null;
let profileName = 'ผู้เล่น';
let skew = 0;            // ต่างระหว่างนาฬิกาเครื่องนี้กับของเซิร์ฟเวอร์
let lastBeatAt = 0;
let claiming = false;
let seating = false;

export const watch = (fn) => watchers.push(fn);
const emit = () => watchers.forEach(f => { try { f(room); } catch (e) { console.error(e); } });

const roomRef   = (code = room.code) => fb.doc(db, 'rooms', code);
const secretRef = (uid, code = room.code) => fb.doc(db, 'rooms', code, 'secrets', uid);
const secretsOf = (code = room.code) => fb.collection(db, 'rooms', code, 'secrets');
const actionsOf = (code = room.code) => fb.collection(db, 'rooms', code, 'actions');
const chatOf    = (code = room.code) => fb.collection(db, 'rooms', code, 'chat');
const facesOf   = (code = room.code) => fb.collection(db, 'rooms', code, 'avatars');
const faceRef   = (uid, code = room.code) => fb.doc(db, 'rooms', code, 'avatars', uid);
const memberRef = (uid, code = room.code) => fb.doc(db, 'rooms', code, 'members', uid);
const membersOf = (code = room.code) => fb.collection(db, 'rooms', code, 'members');

const now = () => Date.now() + skew;
const ms  = (t) => (t && typeof t.toMillis === 'function') ? t.toMillis() : 0;

/* ── สร้าง / เข้า / ออก ───────────────────────────── */

const randomCode = () =>
  Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

/* ปิดห้องแล้วลบของข้างในให้หมด รูปประจำตัวและแชทต้องไม่ค้างอยู่หลังบ้าน */
const SUBS = ['members', 'secrets', 'actions', 'chat', 'avatars'];

async function wipeRoom(code) {
  for (const sub of SUBS) {
    const snap = await fb.getDocs(fb.collection(db, 'rooms', code, sub)).catch(() => null);
    if (snap) await Promise.all(snap.docs.map(d => fb.deleteDoc(d.ref).catch(() => {})));
  }
  await fb.deleteDoc(roomRef(code)).catch(() => {});
}

/* กวาดห้องร้างทิ้งตอนสร้างห้องใหม่ — ห้องที่ไม่มีใครแตะเกิน 12 ชั่วโมง
   ทำตอนนี้เพราะเป็นจังหวะเดียวที่มีคนกำลังใช้งานอยู่แน่ ๆ และไม่รบกวนใคร */
async function sweepStaleRooms() {
  try {
    const cutoff = new Date(Date.now() - STALE_MS);
    const q = fb.query(fb.collection(db, 'rooms'), fb.where('touchedAt', '<', cutoff), fb.limit(5));
    const stale = await fb.getDocs(q);
    for (const d of stale.docs) await wipeRoom(d.id);
    if (stale.size) console.info('[room] ล้างห้องร้าง', stale.size, 'ห้อง');
  } catch (e) {
    console.warn('[room] ล้างห้องร้างไม่สำเร็จ (ข้ามไป)', e.code || e);
  }
}

/* ลิงก์เชิญที่ฝังรหัสห้องไว้ เพื่อนกดแล้วเข้าได้เลยไม่ต้องพิมพ์รหัส */
export const inviteLink = (code = room.code) =>
  code ? `${location.origin}${location.pathname}?room=${code}` : '';

export async function createRoom(name) {
  profileName = name;
  sweepStaleRooms();                       // ไม่ต้องรอ ปล่อยให้ทำเบื้องหลัง
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    if ((await fb.getDoc(roomRef(code))).exists()) continue;
    await fb.setDoc(roomRef(code), {
      hostUid: me.uid,
      status: 'lobby',
      gameId: null,
      gameSettings: {},
      seq: 0,
      createdAt: fb.serverTimestamp(),
      touchedAt: fb.serverTimestamp()
    });
    await fb.setDoc(memberRef(me.uid, code), {
      name, role: 'player', seat: 0, ready: false, left: false, kicked: false,
      lastSeen: fb.serverTimestamp(), joinedAt: fb.serverTimestamp()
    });
    attach(code);
    return code;
  }
  throw new AppError('err.codeGenFail');
}

export async function joinRoom(code, name, watchOnly = false) {
  profileName = name;
  code = String(code || '').trim().toUpperCase();
  if (code.length !== 4) throw new AppError('err.codeLength');

  const snap = await fb.getDoc(roomRef(code));
  if (!snap.exists()) throw new AppError('err.roomNotFound', { code });

  const members = await fb.getDocs(membersOf(code));
  const already = members.docs.some(d => d.id === me.uid);
  if (!already && members.size >= (window.MAX_IN_ROOM || 15)) throw new AppError('err.roomFull');

  // เข้าตอนเกมเริ่มไปแล้ว = เป็นคนดู · เจ้าของห้องจะแจกที่นั่งให้เองถ้ายังอยู่ในห้อง
  // เข้าตอนเกมเริ่มไปแล้ว หรือเลือกเองว่าจะนั่งดู = เป็นคนดู
  const playing = snap.data().status === 'playing';
  await fb.setDoc(memberRef(me.uid, code), {
    name,
    role: (watchOnly || (playing && !already)) ? 'spectator' : 'player',
    seat: null,
    ready: false,
    left: false,
    kicked: false,
    lastSeen: fb.serverTimestamp(),
    joinedAt: fb.serverTimestamp()
  }, { merge: already });

  attach(code);
  return code;
}

function attach(code) {
  room.code = code;
  room.closed = false;

  unsubs.push(fb.onSnapshot(roomRef(code), s => {
    if (!s.exists()) {                              // เจ้าของห้องปิดห้องไปแล้ว
      detach();
      room.closed = true;
      emit();
      return;
    }
    room.doc = { ...s.data() };
    syncHostDuties();
    emit();
  }, err => console.error('[room]', err)));

  unsubs.push(fb.onSnapshot(membersOf(code), s => {
    const raw = s.docs.map(d => ({ uid: d.id, ...d.data() }));

    const mine = raw.find(m => m.uid === me.uid);
    if (mine && ms(mine.lastSeen) && lastBeatAt) {
      const guess = ms(mine.lastSeen) - lastBeatAt;
      if (Math.abs(guess) < 300000) skew = guess;
    }

    const mineRaw = raw.find(m => m.uid === me.uid);
    if (mineRaw && mineRaw.kicked) { room.kicked = true; leaveRoom(); return; }

    room.members = raw
      .map(m => ({
        ...m,
        online: m.uid === me.uid ? true : (now() - ms(m.lastSeen) < OFFLINE)
      }))
      .sort((a, b) => {
        if (a.seat === null && b.seat === null) return ms(a.joinedAt) - ms(b.joinedAt);
        if (a.seat === null) return 1;
        if (b.seat === null) return -1;
        return a.seat - b.seat;
      });

    maybeClaimHost();
    if (room.isHost) assignSeats();
    emit();
  }, err => console.error('[members]', err)));

  unsubs.push(fb.onSnapshot(facesOf(code), s => {
    room.avatars = Object.fromEntries(s.docs.map(d => [d.id, d.data().img]));
    emit();
  }, err => console.error('[avatars]', err)));

  pushAvatar(code);

  unsubs.push(fb.onSnapshot(fb.query(chatOf(code), fb.orderBy('at')), s => {
    room.chat = s.docs.map(d => ({ id: d.id, ...d.data() })).slice(-CHAT_KEEP);
    emit();
  }, err => console.error('[chat]', err)));

  unsubs.push(fb.onSnapshot(secretRef(me.uid, code), snap => {
    room.secret = snap.exists() ? snap.data() : null;
    emit();
  }, err => console.error('[secret]', err)));

  lastBeatAt = Date.now();
  beat = setInterval(() => {
    lastBeatAt = Date.now();
    fb.updateDoc(memberRef(me.uid), { lastSeen: fb.serverTimestamp() }).catch(() => {});
  }, HEARTBEAT);

  window.addEventListener('beforeunload', bail);
}

/* อัปรูปของตัวเองขึ้นห้อง — เรียกตอนเข้าห้อง และตอนเปลี่ยนรูประหว่างอยู่ในห้อง
   ถ้าไม่เรียกซ้ำตอนเปลี่ยนรูป คนที่ตั้งรูปหลังเข้าห้องแล้วจะไม่มีใครเห็นเลยจนกว่าจะออกแล้วเข้าใหม่ */
export function pushAvatar(code = room.code) {
  if (!code) return;
  const mine = Avatar.load();
  room.avatarError = null;

  if (!mine) { fb.deleteDoc(faceRef(me.uid, code)).catch(() => {}); return; }

  fb.setDoc(faceRef(me.uid, code), { img: mine, at: Date.now() })
    .catch(e => {
      room.avatarError = e.code || String(e);
      console.warn('[avatar] อัปไม่สำเร็จ', room.avatarError);
      emit();
    });
}

function detach() {
  window.removeEventListener('beforeunload', bail);
  clearInterval(beat); beat = null;
  unsubs.forEach(u => u()); unsubs = [];
  stopHostDuties();
  room.code = null; room.doc = null; room.members = [];
  room.secret = null; room.secrets = {}; room.chat = []; room.avatars = {};
  room.avatarError = null;
}

function bail() {
  if (!room.code) return;
  if (room.doc?.status === 'playing') fb.updateDoc(memberRef(me.uid), { left: true }).catch(() => {});
  else fb.deleteDoc(memberRef(me.uid)).catch(() => {});
}

export async function leaveRoom() {
  if (!room.code) return;
  const code = room.code;
  const lastOne = room.members.filter(m => m.uid !== me.uid).length === 0;
  // ออกกลางเกม ให้ทิ้งชื่อไว้ในห้อง จะได้ยังเห็นในรายชื่อและตารางคะแนน
  const midGame = room.doc?.status === 'playing' && !lastOne;
  detach();
  room.closed = false;
  try {
    if (midGame) {
      await fb.updateDoc(memberRef(me.uid, code), { left: true, ready: false });
    } else {
      await fb.deleteDoc(memberRef(me.uid, code));
      await fb.deleteDoc(faceRef(me.uid, code)).catch(() => {});   // ออกแล้วรูปไม่ต้องค้าง
    }
    if (lastOne) await wipeRoom(code);
  } catch (e) { console.warn('ออกจากห้องไม่สมบูรณ์', e); }
  emit();
}

/* ── สิ่งที่ผู้เล่นทำเองได้ ────────────────────────── */

export const setReady = (on) =>
  fb.updateDoc(memberRef(me.uid), { ready: !!on });

/* ── สิ่งที่เฉพาะเจ้าของห้องทำได้ ─────────────────── */

export async function pickGame(gameId) {
  if (!room.isHost) return;
  const game = Games.get(gameId);
  if (game && game.comingSoon) return;      // ยังไม่เปิดให้เล่น
  await fb.updateDoc(roomRef(), {
    gameId,
    gameSettings: game ? Games.defaultSettings(game) : {},
    touchedAt: fb.serverTimestamp()
  });
}

export async function setGameSetting(key, value) {
  if (!room.isHost) return;
  await fb.updateDoc(roomRef(), {
    [`gameSettings.${key}`]: value,
    touchedAt: fb.serverTimestamp()
  });
}


export async function start() {
  if (!room.isHost || !canStart()) return;
  const game = currentGame();
  const out = (await game.init(context())) || {};

  const batch = fb.writeBatch(db);
  batch.update(roomRef(), {
    status: 'playing',
    state: out.state || {},
    seq: (room.doc.seq || 0) + 1,
    touchedAt: fb.serverTimestamp()
  });
  for (const [uid, val] of Object.entries(out.secrets || {})) batch.set(secretRef(uid), val);
  await batch.commit();
}

export async function backToLobby() {
  if (!room.isHost) return;
  const secrets = await fb.getDocs(secretsOf());
  const actions = await fb.getDocs(actionsOf());

  const batch = fb.writeBatch(db);
  batch.update(roomRef(), {
    status: 'lobby',
    state: {},
    seq: (room.doc.seq || 0) + 1,
    touchedAt: fb.serverTimestamp()
  });
  secrets.docs.forEach(d => batch.delete(d.ref));
  actions.docs.forEach(d => batch.delete(d.ref));
  room.members.forEach(m => {
    if (m.left) batch.delete(memberRef(m.uid));      // ชื่อที่ทิ้งไว้ตอนเล่น เก็บกวาดตอนกลับเข้าห้อง
    else batch.update(memberRef(m.uid), { ready: false, role: 'player' });
  });
  await batch.commit();
}

/* ── แชท ───────────────────────────────────────────
   ทุกคนในห้องอ่านได้ · พิมพ์ได้ในนามตัวเองเท่านั้น
   เกมเป็นคนกำหนดว่าคนดูพิมพ์ได้ไหม (ช่อง allowSpectatorChat ในทะเบียนเกม) */
export async function sendChat(text) {
  const body = String(text || '').trim().slice(0, 300);
  if (!body || !room.code) return;
  await fb.addDoc(chatOf(), {
    uid: me.uid,
    name: room.mine?.name || '',
    text: body,
    at: Date.now()
  });
  if (room.isHost) prune();
}

export function canChat() {
  const game = currentGame();
  const mine = room.mine;
  if (!mine || mine.left) return false;
  if (mine.role !== 'spectator') return true;
  return game ? game.allowSpectatorChat !== false : true;
}

/* เจ้าของห้องเก็บกวาดข้อความเก่าไม่ให้ห้องบวม */
async function prune() {
  if (room.chat.length <= CHAT_KEEP) return;
  const snap = await fb.getDocs(fb.query(chatOf(), fb.orderBy('at')));
  const extra = snap.docs.slice(0, Math.max(0, snap.size - CHAT_KEEP));
  await Promise.all(extra.map(d => fb.deleteDoc(d.ref).catch(() => {})));
}

/* ── สิทธิ์จัดการห้องของเจ้าของห้อง ───────────────── */

export async function kick(uid) {
  if (!room.isHost || uid === me.uid) return;
  await fb.updateDoc(memberRef(uid), { kicked: true });
  await fb.deleteDoc(faceRef(uid)).catch(() => {});
}

/* ย้ายตัวเองเข้าออกที่นั่งได้เอง ไม่ต้องรอเจ้าของห้อง
   Security Rules ยอมให้เขียนเอกสารของตัวเองอยู่แล้ว จึงไม่ต้องแก้กฎ */
export async function setMyRole(role) {
  if (room.doc?.status !== 'lobby') return;
  if (!room.mine || room.mine.role === role) return;
  await fb.updateDoc(memberRef(me.uid), { role, seat: null, ready: false });
}

/* ย้ายคนเข้าหรือออกจากที่นั่ง ทำได้เฉพาะตอนยังไม่เริ่มเกม */
export async function setRole(uid, role) {
  if (!room.isHost || room.doc?.status !== 'lobby') return;
  await fb.updateDoc(memberRef(uid), {
    role,
    seat: role === 'player' ? null : null,   // ปล่อยให้ระบบแจกที่นั่งใหม่
    ready: false
  });
}

/* สลับที่นั่งกับคนข้างเคียง ใช้จัดลำดับการวนเทิร์น */
export async function moveSeat(uid, delta) {
  if (!room.isHost || room.doc?.status !== 'lobby') return;
  const players = room.members.filter(m => m.role === 'player' && m.seat !== null)
                              .sort((a, b) => a.seat - b.seat);
  const i = players.findIndex(m => m.uid === uid);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= players.length) return;

  const batch = fb.writeBatch(db);
  batch.update(memberRef(players[i].uid), { seat: players[j].seat });
  batch.update(memberRef(players[j].uid), { seat: players[i].seat });
  await batch.commit();
}

/* ── คำขอจากผู้เล่น ────────────────────────────────
   ผู้เล่นแก้ state เองไม่ได้ (Security Rules ปิดไว้) จึงยื่นคำขอมาให้
   เจ้าของห้องตัดสินแทน นี่คือหัวใจของ Host Authority */
export const send = (type, payload = {}) =>
  fb.addDoc(actionsOf(), { uid: me.uid, type, payload, at: Date.now() })
    .catch(e => { console.error('[room] ส่งคำขอไม่สำเร็จ', type, e); throw e; });

export function canStart() {
  if (room.doc?.status !== 'lobby') return false;
  const game = Games.get(room.doc?.gameId);
  if (!game) return false;
  const players = room.members.filter(m => m.role === 'player' && !m.left);
  return Games.fits(game, players.length) &&
         players.every(m => m.ready && m.online);
}

/* เกมที่ห้องนี้เลือกไว้ · null ถ้ายังไม่ได้เลือก */
export const currentGame = () => Games.get(room.doc?.gameId);

/* ── หน้าที่ที่มีเฉพาะตอนเป็นเจ้าของห้อง ───────────
   เปิดปิดตามสถานะจริง ไม่ใช่ตอนเข้าห้องครั้งเดียว
   เพราะตำแหน่งโอนกลางเกมได้ คนที่รับช่วงต้องเริ่มทำหน้าที่เองทันที */
let hostUnsubs = [];
let queue = [];
let busy = false;
let clock = null;

function syncHostDuties() {
  if (room.isHost && !hostUnsubs.length) startHostDuties();
  if (!room.isHost && hostUnsubs.length) stopHostDuties();
  if (room.isHost) armClock();
}

function startHostDuties() {
  console.info('[room] เริ่มทำหน้าที่เจ้าของห้อง');
  try { attachHostListeners(); }
  catch (e) {
    stopHostDuties();                 // ล้มไม่สุดจะแย่กว่า ล้างทิ้งแล้วให้ลองใหม่รอบหน้า
    console.error('[room] เปิดหน้าที่เจ้าของห้องไม่สำเร็จ', e);
  }
}

function attachHostListeners() {
  hostUnsubs.push(fb.onSnapshot(secretsOf(), s => {
    room.secrets = Object.fromEntries(s.docs.map(d => [d.id, d.data()]));
    emit();
  }, err => console.error('[secrets]', err)));

  hostUnsubs.push(fb.onSnapshot(fb.query(actionsOf(), fb.orderBy('at')), s => {
    s.docChanges().forEach(c => { if (c.type === 'added') queue.push(c.doc); });
    drain();
  }, err => console.error('[actions]', err)));
}

function stopHostDuties() {
  hostUnsubs.forEach(u => u());
  hostUnsubs = [];
  queue = [];
  busy = false;
  clearTimeout(clock);
  clock = null;
}

/* ประมวลผลคำขอทีละใบตามลำดับเวลา
   เขียนสถานะใหม่กับลบคำขอใน batch เดียวกัน — ถ้าเจ้าของห้องดับกลางคัน
   คำขอนั้นจะไม่ถูกทำซ้ำโดยคนที่รับช่วงต่อ */
async function drain() {
  if (busy) return;
  busy = true;
  try {
    while (queue.length) {
      const snap = queue.shift();
      const d = snap.data();
      try {
        const game = currentGame();
        const out = game ? await game.onAction(context(), { uid: d.uid, type: d.type, payload: d.payload }) : null;
        await commit(out, snap.ref);
      } catch (e) {
        console.error('ประมวลผลคำขอล้มเหลว', d, e);
        await fb.deleteDoc(snap.ref).catch(() => {});
      }
    }
  } finally { busy = false; }
}

/* เขียนผลลัพธ์ลง Firestore แล้วลบคำขอทิ้งในชุดคำสั่งเดียว */
async function commit(out, actionRef) {
  const batch = fb.writeBatch(db);
  let touched = false;

  if (out && out.state) {
    batch.update(roomRef(), {
      state: out.state,
      seq: (room.doc.seq || 0) + 1,
      touchedAt: fb.serverTimestamp()
    });
    room.doc = { ...room.doc, state: out.state, seq: (room.doc.seq || 0) + 1 };
    touched = true;
  }
  for (const [uid, val] of Object.entries((out && out.secrets) || {})) {
    batch.set(secretRef(uid), val);
    room.secrets = { ...room.secrets, [uid]: val };
    touched = true;
  }
  if (actionRef) { batch.delete(actionRef); touched = true; }
  if (touched) await batch.commit();
  if (out && out.state) armClock();
}

/* นาฬิกาจับเวลาต่อตา — เจ้าของห้องเป็นคนถือคนเดียว
   เก็บเวลาหมดไว้ในสถานะสาธารณะ คนที่รับช่วงต่อจึงตั้งนาฬิกาเองได้ */
function armClock() {
  clearTimeout(clock);
  const at = room.doc?.state?.deadline;
  if (!at || room.doc.status !== 'playing') return;
  clock = setTimeout(runTick, Math.max(0, at - Date.now()) + 60);
}

async function runTick() {
  if (!room.isHost) return;
  const game = currentGame();
  if (!game || typeof game.tick !== 'function') return;
  try {
    await commit(await game.tick(context()), null);
  } catch (e) { console.error('นาฬิกาทำงานผิดพลาด', e); }
}

/* ── ข้อมูลที่ส่งให้เกม ───────────────────────────── */
export function context() {
  return {
    me: { uid: me.uid, ...(room.mine || {}) },
    members: room.members,
    isHost: room.isHost,
    hostUid: room.doc?.hostUid || null,
    state: room.doc?.state || {},
    settings: room.doc?.gameSettings || {},
    avatars: room.avatars,        // รูปประจำตัวของทุกคนในห้อง
    secret: room.secret,          // ของเราคนเดียว
    secrets: room.secrets,        // ครบทุกคน เฉพาะเจ้าของห้อง
    send,
    leave: backToLobby
  };
}

/* ── งานบ้านของเจ้าของห้อง ───────────────────────── */

/* แจกเลขที่นั่งให้คนที่ยังไม่มี — ทำที่เดียวจึงไม่มีทางชนกัน */
async function assignSeats() {
  if (seating) return;
  const need = room.members.filter(m => m.role === 'player' && m.seat === null && m.online && !m.left);
  if (!need.length) return;

  seating = true;
  try {
    const taken = new Set(room.members.filter(m => m.seat !== null).map(m => m.seat));
    const batch = fb.writeBatch(db);
    for (const m of need) {
      let s = 0; while (taken.has(s)) s++;
      taken.add(s);
      batch.update(memberRef(m.uid), { seat: s });
    }
    await batch.commit();
  } catch (e) { console.warn('แจกที่นั่งไม่สำเร็จ', e); }
  finally { seating = false; }
}

/* ยึดตำแหน่งเจ้าของห้องเมื่อคนเดิมเงียบไป
   ทุกเครื่องคำนวณด้วยข้อมูลชุดเดียวกัน จึงได้ผู้ชนะคนเดียวกัน:
   ผู้เล่นที่ยังออนไลน์ ที่เลขที่นั่งน้อยที่สุด (คนดูไม่มีสิทธิ์) */
async function maybeClaimHost() {
  if (!room.doc || room.isHost || claiming) return;

  const host = room.members.find(m => m.uid === room.doc.hostUid);
  const hostGone = !host || (now() - ms(host.lastSeen) > HOST_GONE);
  if (!hostGone) return;

  const heirs = room.members
    .filter(m => m.role === 'player' && m.online && m.seat !== null)
    .sort((a, b) => a.seat - b.seat);
  if (!heirs.length || heirs[0].uid !== me.uid) return;

  claiming = true;
  try {
    await fb.updateDoc(roomRef(), { hostUid: me.uid, touchedAt: fb.serverTimestamp() });
    console.info('[room] รับตำแหน่งเจ้าของห้องแทนคนที่หลุด');
  } catch (e) {
    console.warn('ยึดตำแหน่งไม่สำเร็จ (อาจมีคนอื่นยึดไปก่อน)', e.code || e);
  } finally {
    setTimeout(() => { claiming = false; }, 3000);
  }
}
