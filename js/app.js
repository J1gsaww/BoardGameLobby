/* app.js — หน้าจอ
   ข้อความที่ผู้ใช้เห็นไม่มีอยู่ในไฟล์นี้เลย มีแต่คีย์ที่ส่งให้ t() */

import { connect, me } from './net.js';
import * as Room from './room.js';
import * as Games from './games.js';
import './games/index.js';      // ต้องมาหลัง games.js เสมอ
import { t, apply, setLang, onLangChange, lang, LANGS, messageOf } from './i18n.js';
import * as Music from './music.js';

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

/* ── หน้าเลือกเกม ─────────────────────────────────── */
/* วาดจากสิ่งที่เกมประกาศไว้ล้วน ๆ ไม่รู้จักเกมไหนเป็นการเฉพาะ
   เพิ่มเกมที่สองแล้วหน้านี้ขึ้นให้เองโดยไม่ต้องแก้อะไรตรงนี้ */
let lastChosenGame;
function paintGames(room) {
  const host = $('games');
  const chosen = room.doc.gameId;
  const count = room.members.filter(m => m.role === 'player').length;

  host.innerHTML = '';
  Games.all().forEach(g => {
    const card = document.createElement('button');
    card.className = 'game-card' + (g.id === chosen ? ' on' : '');
    card.disabled = !room.isHost;

    const art = document.createElement('div');
    art.className = 'game-art';
    if (g.cover) {
      const img = document.createElement('img');
      img.src = g.cover;
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = () => { art.classList.add('noimg'); img.remove(); };
      art.appendChild(img);
    } else {
      art.classList.add('noimg');
    }

    const meta = document.createElement('div');
    meta.className = 'game-meta';
    meta.innerHTML =
      `<span class="game-name">${esc(t(g.nameKey))}</span>` +
      `<span class="game-seats">${esc(t('lobby.players', { min: g.minPlayers, max: g.maxPlayers }))}</span>` +
      `<span class="game-desc">${esc(t(g.descKey))}</span>`;

    card.append(art, meta);
    card.onclick = () => Room.pickGame(g.id);
    host.appendChild(card);
  });

  // เลื่อนเข้าจอเฉพาะตอนเกมเปลี่ยนจริง ไม่ใช่ทุกครั้งที่ห้องอัปเดต
  // ไม่งั้นจะกระตุกใส่คนที่กำลังเลื่อนดูเกมอื่นอยู่
  if (chosen && chosen !== lastChosenGame) {
    host.querySelector('.game-card.on')?.scrollIntoView({ block: 'nearest' });
  }
  lastChosenGame = chosen;

  paintGameSettings(room, Games.get(chosen), count);
}

/* ตัวเลือกของเกมที่เลือกไว้ — เกมประกาศมาเป็นข้อมูล หน้านี้แค่วาดตาม */
function paintGameSettings(room, game, count) {
  const host = $('gameSettings');
  host.innerHTML = '';
  if (!game || !game.settings.length) return;

  game.settings.forEach(setting => {
    const current = room.doc.gameSettings?.[setting.key] ?? setting.default;

    const row = document.createElement('div');
    row.className = 'field';
    row.innerHTML = `<span class="field-label">${esc(t(Games.settingKey(game.id, setting.key)))}</span>`;

    const seg = document.createElement('div');
    seg.className = 'segmented';
    setting.options.forEach(value => {
      const b = document.createElement('button');
      b.className = 'seg' + (value === current ? ' on' : '');
      b.textContent = t(Games.optionKey(game.id, setting.key, value));
      b.disabled = !room.isHost;
      b.onclick = () => Room.setGameSetting(setting.key, value);
      seg.appendChild(b);
    });

    row.appendChild(seg);
    host.appendChild(row);
  });
}

/* ── วาดหน้าห้อง ──────────────────────────────────── */
function paintRoom() {
  const room = lastRoom;
  if (!room || !room.code || !room.doc) return;

  $('outCode').textContent = room.code;

  if (room.doc.status === 'playing') {
    show('view-play');
    const game = Room.currentGame();
    $('view-play').style.backgroundImage = game?.table ? `url("${game.table}")` : '';
    $('playCode').textContent = room.code;
    Music.setTrack(game?.music || Music.defaultTrack());
    $('btnBack').hidden = !room.isHost;
    $('btnBack').textContent = t('play.leaveGame');

    // เกมวาดหน้าจอตัวเอง แพลตฟอร์มไม่รู้ว่าข้างในเป็นอะไร
    if (game && typeof game.render === 'function') {
      try { game.render($('gameStage'), Room.context()); }
      catch (e) { console.error('เกมวาดหน้าจอไม่สำเร็จ', e); }
    }
    return;
  }

  Music.setTrack(Music.defaultTrack());
  show('view-lobby');
  listInto($('players'), room.members, room.doc.hostUid);
  $('outCount').textContent = `${room.members.length}/${window.MAX_IN_ROOM}`;
  paintGames(room);

  const mine = room.mine;
  const spectator = mine?.role === 'spectator';
  $('btnReady').hidden = spectator;
  $('btnReady').classList.toggle('on', !!mine?.ready);
  $('btnReady').textContent = t(mine?.ready ? 'lobby.unready' : 'lobby.ready');

  $('btnStart').hidden = !room.isHost;
  $('btnStart').textContent = t('lobby.start');
  $('btnStart').disabled = !Room.canStart();

  const game = Room.currentGame();
  const players = room.members.filter(m => m.role === 'player');
  let note = '';
  if (!room.isHost) note = t(game ? 'lobby.waitHost' : 'lobby.hostPicks');
  else if (!game) note = t('lobby.noGame');
  else if (!Games.fits(game, players.length))
    note = t('lobby.wrongCount', { min: game.minPlayers, max: game.maxPlayers, n: players.length });
  else if (!players.every(m => m.online)) note = t('lobby.someoneOffline');
  else if (!players.every(m => m.ready))
    note = t('lobby.waitReady', { n: players.filter(m => !m.ready).length });

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

/* ── แถบเสียงเพลง ─────────────────────────────────── */
/* วาดจากฟังก์ชันเดียว แต่ลงได้หลายที่ — หน้าห้องและหน้าตั้งค่า
   หน้าตั้งค่าสำคัญกว่า เพราะเพลงเริ่มตั้งแต่เปิดเว็บ ก่อนจะเข้าห้องเสียอีก */
/* แถบเสียงโผล่ทุกที่ที่เพลงกำลังเล่นอยู่ — หน้าแรก หน้าห้อง และหน้าตั้งค่า
   วาดจากฟังก์ชันเดียว เลื่อนที่ไหนอีกสองที่ก็ขยับตาม */
const AUDIO_HOSTS = ['audioHome', 'audioLobby', 'audioSetting'];

function buildAudio(host) {
  host.dataset.built = '1';
  host.innerHTML =
    '<div class="audio-bar">' +
      '<button class="audio-btn" aria-label="volume"></button>' +
      '<input type="range" class="vol" min="0" max="100" step="1">' +
      '<span class="audio-pct"></span>' +
    '</div>' +
    '<p class="audio-note" hidden></p>';
  host.querySelector('.audio-btn').onclick = () => Music.toggleMute();
  host.querySelector('.vol').addEventListener('input', e => Music.setVolume(e.target.value / 100));
}

function paintAudio() {
  const m = Music.music;
  const pct = Math.round((m.muted ? 0 : m.volume) * 100);
  const note = m.missing      ? t('audio.missing', { src: decodeURI(window.MUSIC_SRC) })
             : (m.pending && !m.muted) ? t('audio.blocked')
             : '';

  AUDIO_HOSTS.forEach(id => {
    const host = $(id);
    if (!host) return;
    if (!host.dataset.built) buildAudio(host);

    host.querySelector('.vol').value = pct;
    host.querySelector('.audio-pct').textContent = pct + '%';

    const b = host.querySelector('.audio-btn');
    b.textContent = m.muted ? '\u{1F507}' : '\u{1F50A}';
    b.title = t(m.muted ? 'audio.unmute' : 'audio.mute');
    b.classList.toggle('off', m.muted);

    const n = host.querySelector('.audio-note');
    n.textContent = note;
    n.hidden = !note;
    n.classList.toggle('bad', m.missing);
  });
}

Music.onChange(paintAudio);

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
  paintAudio();
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

$('btnSetting').onclick = () => { cameFrom = current; paintLangPick(); paintAudio(); show('view-setting'); };
$('btnSettingBack').onclick = () => { show(cameFrom === 'view-setting' ? 'view-home' : cameFrom); if (lastRoom) paintRoom(); };

$('btnReady').onclick = () => Room.setReady(!Room.room.mine?.ready);
$('btnStart').onclick = () => Room.start();
$('btnBack').onclick  = () => Room.backToLobby();
$('btnLeave').onclick = async () => {
  await Room.leaveRoom();
  lastRoom = null;
  Music.setTrack(Music.defaultTrack());
  show('view-home');
  err(null);
};

$('codeChip').onclick = async () => {
  try {
    await navigator.clipboard.writeText(Room.room.code);
    const el = $('outCode'), old = el.textContent;
    el.textContent = t('lobby.copied');
    setTimeout(() => { el.textContent = old; }, 1000);
  } catch { /* บางเบราว์เซอร์ไม่อนุญาต */ }
};

/* index.html กับ js/env.js ต้องเป็นรุ่นเดียวกัน ถ้าไม่ตรงแปลว่ามีไฟล์ค้างแคช
   เป็นอาการที่เสียเวลาหาสาเหตุนานมากถ้าไม่มีอะไรบอก */
function checkBuild() {
  const html = document.body.dataset.build || '(ไม่มี)';
  const js = window.BUILD || '(ไม่มี)';
  if (html === js) { console.info('[build]', js); return; }
  console.warn(
    `[build] ไฟล์ไม่ตรงรุ่นกัน — index.html = ${html} · js = ${js}\n` +
    'แปลว่ามีไฟล์ค้างแคชอยู่ กด Ctrl+Shift+R หรือรอ GitHub Pages อัปเดตสัก 10 นาที'
  );
  const bar = document.createElement('div');
  bar.className = 'build-warn';
  bar.textContent = `ไฟล์ไม่ตรงรุ่น · html ${html} · js ${js} — กด Ctrl+Shift+R`;
  document.body.appendChild(bar);
}

/* ── บูต ──────────────────────────────────────────── */
(async () => {
  apply();
  $('bootText').textContent = t('boot.connecting');
  $('inName').value = name;
  paintLangPick();
  Music.init();
  paintAudio();
  try {
    await connect();
    $('boot').hidden = true;
    show('view-home');
    checkBuild();
    console.info('[env]', window.__envInfo(), 'uid', me.uid);
  } catch (e) {
    boot(messageOf(e), true);
  }
})();
