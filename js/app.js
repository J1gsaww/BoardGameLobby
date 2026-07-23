/* app.js — หน้าจอ */

import { connect, me } from './net.js';
import * as Room from './room.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['view-home', 'view-lobby', 'view-play'];
const show = (id) => VIEWS.forEach(v => { $(v).hidden = v !== id; });

const NAME_KEY = 'lobby.name';
let name = localStorage.getItem(NAME_KEY) || '';

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const err = (m) => { $('homeErr').textContent = m || ''; $('homeErr').hidden = !m; };

function boot(msg, bad) {
  $('bootText').textContent = msg;
  $('boot').classList.toggle('bad', !!bad);
  $('boot').hidden = false;
}

/* ── รายชื่อผู้เล่น ────────────────────────────────── */
function listInto(ul, members, hostUid) {
  ul.innerHTML = '';
  members.forEach(m => {
    const li = document.createElement('li');
    if (!m.online) li.className = 'offline';

    const badges = [];
    if (m.uid === hostUid) badges.push('<span class="badge host">Host</span>');
    if (m.role === 'spectator') badges.push('<span class="badge">คนดู</span>');
    else if (m.ready) badges.push('<span class="badge ready">Ready</span>');
    if (!m.online) badges.push('<span class="badge">หลุด</span>');

    li.innerHTML =
      `<span class="pName">${esc(m.name || 'ผู้เล่น')}</span>` +
      (m.uid === me.uid ? '<span class="pMe">คุณ</span>' : '') +
      (badges.length ? badges.join('') : '<span class="badge"></span>');
    ul.appendChild(li);
  });
}

/* ── วาดใหม่ทุกครั้งที่ข้อมูลห้องเปลี่ยน ──────────── */
Room.watch((room) => {
  if (room.closed) {                     // ห้องหายไประหว่างที่เราอยู่
    room.closed = false;
    show('view-home');
    err('ห้องถูกปิดแล้ว');
    return;
  }
  if (!room.code || !room.doc) return;

  $('outCode').textContent = room.code;
  const playing = room.doc.status === 'playing';

  if (playing) {
    show('view-play');
    listInto($('playersPlay'), room.members, room.doc.hostUid);
    $('btnBack').hidden = !room.isHost;
    $('playNote').textContent = room.isHost
      ? 'คุณเป็นเจ้าของห้อง — กดกลับไปที่ห้องได้'
      : 'รอเจ้าของห้องพากลับไปที่ห้อง';
    return;
  }

  show('view-lobby');
  listInto($('players'), room.members, room.doc.hostUid);
  $('outCount').textContent = `${room.members.length}/${window.MAX_IN_ROOM}`;

  const mine = room.mine;
  const spectator = mine?.role === 'spectator';
  $('btnReady').hidden = spectator;
  $('btnReady').classList.toggle('on', !!mine?.ready);
  $('btnReady').textContent = mine?.ready ? 'Unready' : 'Ready';

  $('btnStart').hidden = !room.isHost;
  const ok = Room.canStart();
  $('btnStart').disabled = !ok;

  const players = room.members.filter(m => m.role === 'player');
  let note = '';
  if (!room.isHost) note = 'รอเจ้าของห้องกด Start';
  else if (players.length < 2) note = 'ต้องมีผู้เล่นอย่างน้อย 2 คน';
  else if (!players.every(m => m.online)) note = 'มีคนหลุดอยู่ รอสักครู่';
  else if (!players.every(m => m.ready)) {
    const left = players.filter(m => !m.ready).length;
    note = `รออีก ${left} คนกด Ready`;
  }
  $('lobbyNote').textContent = note;
});

/* ── ปุ่ม ─────────────────────────────────────────── */
$('inName').addEventListener('input', e => {
  name = e.target.value.trim().slice(0, 16);
  localStorage.setItem(NAME_KEY, name);
});
$('inCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
$('inCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });

function needName() {
  if (name) return true;
  err('ใส่ชื่อก่อนนะ');
  $('inName').focus();
  return false;
}

$('btnHost').onclick = async () => {
  err(''); if (!needName()) return;
  $('btnHost').disabled = true;
  try { await Room.createRoom(name); }
  catch (e) { err(e.message); }
  finally { $('btnHost').disabled = false; }
};

$('btnJoin').onclick = async () => {
  err(''); if (!needName()) return;
  $('btnJoin').disabled = true;
  try { await Room.joinRoom($('inCode').value, name); $('inCode').value = ''; }
  catch (e) { err(e.message); }
  finally { $('btnJoin').disabled = false; }
};

$('btnReady').onclick = () => Room.setReady(!Room.room.mine?.ready);
$('btnStart').onclick = () => Room.start();
$('btnBack').onclick  = () => Room.backToLobby();
$('btnLeave').onclick = async () => { await Room.leaveRoom(); show('view-home'); err(''); };

$('codeChip').onclick = async () => {
  try {
    await navigator.clipboard.writeText(Room.room.code);
    const el = $('outCode'), old = el.textContent;
    el.textContent = 'คัดลอกแล้ว';
    setTimeout(() => { el.textContent = old; }, 1000);
  } catch { /* บางเบราว์เซอร์ไม่อนุญาต */ }
};

/* ── บูต ──────────────────────────────────────────── */
(async () => {
  $('inName').value = name;
  try {
    await connect();
    $('boot').hidden = true;
    show('view-home');
    console.info('[env]', window.__envInfo(), 'uid', me.uid);
  } catch (e) {
    boot(e.message, true);
  }
})();
