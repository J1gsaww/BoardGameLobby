/* room.js — วงจรชีวิตของห้อง
   ─────────────────────────────────────────────────────────────
   หลักที่ยึดไว้ตั้งแต่แรก: ไม่มีอะไรที่ใช้ตัดสินอยู่ในหน่วยความจำ
   ของเครื่องไหนเลย ทุกอย่างอยู่บน Firestore เพราะเจ้าของห้อง
   ก็เป็นผู้เล่นคนหนึ่ง ปิดแท็บเมื่อไหร่ก็ได้ แล้วคนอื่นต้องรับช่วงต่อ
   ได้ทันทีโดยไม่ต้องรู้อะไรเพิ่ม

   rooms/{code}
     hostUid · status ('lobby' | 'playing') · seq · createdAt · touchedAt
   rooms/{code}/members/{uid}
     name · role ('player' | 'spectator') · seat · ready · lastSeen · joinedAt

   หน้าที่ที่เป็นของเจ้าของห้องอย่างเดียว: แจกเลขที่นั่ง, เปลี่ยน status,
   ล้างสถานะพร้อมตอนกลับเข้าห้อง  — คนอื่นเขียนได้แค่เอกสารของตัวเอง
   ───────────────────────────────────────────────────────────── */

import { db, fb, me } from './net.js';

const ALPHA = 'ACDEFGHJKLMNPQRTUVWXY34679';   // ตัดตัวที่อ่านสับสนออก
const HEARTBEAT = 5000;
const OFFLINE   = 20000;   // เงียบเกินนี้ = ถือว่าหลุด
const HOST_GONE = 25000;   // เจ้าของห้องเงียบเกินนี้ = ยึดตำแหน่งได้

export const room = {
  code: null,
  doc: null,
  members: [],
  closed: false,
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
const memberRef = (uid, code = room.code) => fb.doc(db, 'rooms', code, 'members', uid);
const membersOf = (code = room.code) => fb.collection(db, 'rooms', code, 'members');

const now = () => Date.now() + skew;
const ms  = (t) => (t && typeof t.toMillis === 'function') ? t.toMillis() : 0;

/* ── สร้าง / เข้า / ออก ───────────────────────────── */

const randomCode = () =>
  Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

export async function createRoom(name) {
  profileName = name;
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    if ((await fb.getDoc(roomRef(code))).exists()) continue;
    await fb.setDoc(roomRef(code), {
      hostUid: me.uid,
      status: 'lobby',
      seq: 0,
      createdAt: fb.serverTimestamp(),
      touchedAt: fb.serverTimestamp()
    });
    await fb.setDoc(memberRef(me.uid, code), {
      name, role: 'player', seat: 0, ready: false,
      lastSeen: fb.serverTimestamp(), joinedAt: fb.serverTimestamp()
    });
    attach(code);
    return code;
  }
  throw new Error('สุ่มรหัสห้องไม่ได้ ลองอีกครั้ง');
}

export async function joinRoom(code, name) {
  profileName = name;
  code = String(code || '').trim().toUpperCase();
  if (code.length !== 4) throw new Error('รหัสห้องมี 4 ตัว');

  const snap = await fb.getDoc(roomRef(code));
  if (!snap.exists()) throw new Error(`ไม่พบห้อง ${code}`);

  const members = await fb.getDocs(membersOf(code));
  const already = members.docs.some(d => d.id === me.uid);
  if (!already && members.size >= (window.MAX_IN_ROOM || 15)) throw new Error('ห้องเต็มแล้ว');

  // เข้าตอนเกมเริ่มไปแล้ว = เป็นคนดู · เจ้าของห้องจะแจกที่นั่งให้เองถ้ายังอยู่ในห้อง
  const playing = snap.data().status === 'playing';
  await fb.setDoc(memberRef(me.uid, code), {
    name,
    role: playing && !already ? 'spectator' : 'player',
    seat: null,
    ready: false,
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
    emit();
  }, err => console.error('[room]', err)));

  unsubs.push(fb.onSnapshot(membersOf(code), s => {
    const raw = s.docs.map(d => ({ uid: d.id, ...d.data() }));

    const mine = raw.find(m => m.uid === me.uid);
    if (mine && ms(mine.lastSeen) && lastBeatAt) {
      const guess = ms(mine.lastSeen) - lastBeatAt;
      if (Math.abs(guess) < 300000) skew = guess;
    }

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

  lastBeatAt = Date.now();
  beat = setInterval(() => {
    lastBeatAt = Date.now();
    fb.updateDoc(memberRef(me.uid), { lastSeen: fb.serverTimestamp() }).catch(() => {});
  }, HEARTBEAT);

  window.addEventListener('beforeunload', bail);
}

function detach() {
  window.removeEventListener('beforeunload', bail);
  clearInterval(beat); beat = null;
  unsubs.forEach(u => u()); unsubs = [];
  room.code = null; room.doc = null; room.members = [];
}

function bail() {
  if (room.code) fb.deleteDoc(memberRef(me.uid)).catch(() => {});
}

export async function leaveRoom() {
  if (!room.code) return;
  const code = room.code;
  const lastOne = room.members.filter(m => m.uid !== me.uid).length === 0;
  detach();
  room.closed = false;
  try {
    await fb.deleteDoc(memberRef(me.uid, code));
    if (lastOne) await fb.deleteDoc(roomRef(code)).catch(() => {});
  } catch (e) { console.warn('ออกจากห้องไม่สมบูรณ์', e); }
  emit();
}

/* ── สิ่งที่ผู้เล่นทำเองได้ ────────────────────────── */

export const setReady = (on) =>
  fb.updateDoc(memberRef(me.uid), { ready: !!on });

/* ── สิ่งที่เฉพาะเจ้าของห้องทำได้ ─────────────────── */

export async function start() {
  if (!room.isHost || !canStart()) return;
  await fb.updateDoc(roomRef(), {
    status: 'playing',
    seq: (room.doc.seq || 0) + 1,
    touchedAt: fb.serverTimestamp()
  });
}

export async function backToLobby() {
  if (!room.isHost) return;
  const batch = fb.writeBatch(db);
  batch.update(roomRef(), {
    status: 'lobby',
    seq: (room.doc.seq || 0) + 1,
    touchedAt: fb.serverTimestamp()
  });
  room.members.forEach(m => {
    batch.update(memberRef(m.uid), { ready: false, role: 'player', seat: m.role === 'player' ? m.seat : null });
  });
  await batch.commit();
}

export function canStart() {
  const players = room.members.filter(m => m.role === 'player');
  return players.length >= 2 &&
         players.every(m => m.ready && m.online) &&
         room.doc?.status === 'lobby';
}

/* ── งานบ้านของเจ้าของห้อง ───────────────────────── */

/* แจกเลขที่นั่งให้คนที่ยังไม่มี — ทำที่เดียวจึงไม่มีทางชนกัน */
async function assignSeats() {
  if (seating) return;
  const need = room.members.filter(m => m.role === 'player' && m.seat === null && m.online);
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
