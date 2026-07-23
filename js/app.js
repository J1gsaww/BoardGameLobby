/* app.js — หน้าจอ
   ข้อความที่ผู้ใช้เห็นไม่มีอยู่ในไฟล์นี้เลย มีแต่คีย์ที่ส่งให้ t() */

import { connect, me } from './net.js';
import * as Room from './room.js';
import { t, apply, setLang, onLangChange, lang, LANGS, messageOf } from './i18n.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['view-home', 'view-setting', 'view-lobby', 'view-play'];

let current = 'view-home';
let lastRoom = null;
let cameFrom = 'view-home';

function show(id) {
  current = id;
  VIEWS.forEach(v => { $(v).hidden = v !== id; });
}

const NAME_KEY = 'lobby.name';
let name = localStorage.getItem(NAME_KEY) || '';

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

let errState = null;                 // { key, params } หรือ { text }
function err(key, params) { errState = key ? { key, params } : null; paintError(); }
function errFrom(e) {
  errState = (e && e.key) ? { key: e.key, params: e.params } : { text: messageOf(e) };
  paintError();
}
function paintError() {
  const el = $('homeErr');
  el.textContent = !errState ? ''
    : (errState.key ? t(errState.key, errState.params) : errState.text);
  el.hidden = !errState;
}

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
    if (m.uid === hostUid) badges.push(`<span class="badge host">${t('badge.host')}</span>`);
    if (m.role === 'spectator') badges.push(`<span class="badge">${t('badge.spectator')}</span>`);
    else if (m.ready) badges.push(`<span class="badge ready">${t('badge.ready')}</span>`);
    if (!m.online) badges.push(`<span class="badge">${t('badge.offline')}</span>`);

    li.innerHTML =
      `<span class="pName">${esc(m.name || '')}</span>` +
      (m.uid === me.uid ? `<span class="pMe">${t('badge.you')}</span>` : '') +
      (badges.length ? badges.join('') : '<span class="badge"></span>');
    ul.appendChild(li);
  });
}

/* ── วาดหน้าห้อง ──────────────────────────────────── */
function paintRoom() {
  const room = lastRoom;
  if (!room || !room.code || !room.doc) return;

  $('outCode').textContent = room.code;

  if (room.doc.status === 'playing') {
    show('view-play');
    listInto($('playersPlay'), room.members, room.doc.hostUid);
    $('btnBack').hidden = !room.isHost;
    $('playNote').textContent = t(room.isHost ? 'play.hostNote' : 'play.guestNote');
    return;
  }

  show('view-lobby');
  listInto($('players'), room.members, room.doc.hostUid);
  $('outCount').textContent = `${room.members.length}/${window.MAX_IN_ROOM}`;

  const mine = room.mine;
  const spectator = mine?.role === 'spectator';
  $('btnReady').hidden = spectator;
  $('btnReady').classList.toggle('on', !!mine?.ready);
  $('btnReady').textContent = t(mine?.ready ? 'lobby.unready' : 'lobby.ready');

  $('btnStart').hidden = !room.isHost;
  $('btnStart').textContent = t('lobby.start');
  $('btnStart').disabled = !Room.canStart();

  const players = room.members.filter(m => m.role === 'player');
  let note = '';
  if (!room.isHost) note = t('lobby.waitHost');
  else if (players.length < 2) note = t('lobby.needTwo');
  else if (!players.every(m => m.online)) note = t('lobby.someoneOffline');
  else if (!players.every(m => m.ready)) {
    note = t('lobby.waitReady', { n: players.filter(m => !m.ready).length });
  }
  $('lobbyNote').textContent = note;
}

Room.watch((room) => {
  if (room.closed) {
    room.closed = false;
    lastRoom = null;
    show('view-home');
    err('err.roomClosed');
    return;
  }
  lastRoom = room;
  paintRoom();
});

/* ── หน้าตั้งค่า ──────────────────────────────────── */
function paintLangPick() {
  const host = $('langPick');
  host.innerHTML = '';
  Object.entries(LANGS).forEach(([code, label]) => {
    const b = document.createElement('button');
    b.className = 'seg' + (code === lang ? ' on' : '');
    b.textContent = label;
    b.onclick = () => setLang(code);
    host.appendChild(b);
  });
}

/* ภาษาเปลี่ยน = ทาข้อความคงที่ใหม่ แล้ววาดส่วนที่สร้างจาก JS ซ้ำ */
onLangChange(() => {
  paintLangPick();
  paintError();
  if (current === 'view-lobby' || current === 'view-play') paintRoom();
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
  err('home.needName');
  $('inName').focus();
  return false;
}

$('btnHost').onclick = async () => {
  err(null); if (!needName()) return;
  $('btnHost').disabled = true;
  try { await Room.createRoom(name); }
  catch (e) { errFrom(e); }
  finally { $('btnHost').disabled = false; }
};

$('btnJoin').onclick = async () => {
  err(null); if (!needName()) return;
  $('btnJoin').disabled = true;
  try { await Room.joinRoom($('inCode').value, name); $('inCode').value = ''; }
  catch (e) { errFrom(e); }
  finally { $('btnJoin').disabled = false; }
};

$('btnSetting').onclick = () => { cameFrom = current; paintLangPick(); show('view-setting'); };
$('btnSettingBack').onclick = () => { show(cameFrom === 'view-setting' ? 'view-home' : cameFrom); if (lastRoom) paintRoom(); };

$('btnReady').onclick = () => Room.setReady(!Room.room.mine?.ready);
$('btnStart').onclick = () => Room.start();
$('btnBack').onclick  = () => Room.backToLobby();
$('btnLeave').onclick = async () => { await Room.leaveRoom(); lastRoom = null; show('view-home'); err(null); };

$('codeChip').onclick = async () => {
  try {
    await navigator.clipboard.writeText(Room.room.code);
    const el = $('outCode'), old = el.textContent;
    el.textContent = t('lobby.copied');
    setTimeout(() => { el.textContent = old; }, 1000);
  } catch { /* บางเบราว์เซอร์ไม่อนุญาต */ }
};

/* ── บูต ──────────────────────────────────────────── */
(async () => {
  apply();
  $('bootText').textContent = t('boot.connecting');
  $('inName').value = name;
  paintLangPick();
  try {
    await connect();
    $('boot').hidden = true;
    show('view-home');
    console.info('[env]', window.__envInfo(), 'uid', me.uid);
  } catch (e) {
    boot(messageOf(e), true);
  }
})();
