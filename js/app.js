/* app.js — หน้าจอ
   ข้อความที่ผู้ใช้เห็นไม่มีอยู่ในไฟล์นี้เลย มีแต่คีย์ที่ส่งให้ t() */

import { connect, me } from './net.js';
import * as Room from './room.js';
import * as Games from './games.js';
import './games/index.js';      // ต้องมาหลัง games.js เสมอ
import { t, apply, setLang, onLangChange, lang, LANGS, messageOf } from './i18n.js';
import * as Music from './music.js';
import * as Avatar from './avatar.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['view-home', 'view-setting', 'view-rules', 'view-lobby', 'view-play'];

let current = '';               // ยังไม่ได้เปิดหน้าไหนเลยตอนเริ่ม
let lastRoom = null;
let cameFrom = 'view-home';

/* หน้าที่เปิดคร่อมอยู่ชั่วคราว — ห้องอัปเดตแล้วต้องไม่ลากผู้ใช้ออกจากหน้านี้
   ไม่งั้นทุกครั้งที่มีสัญญาณชีพเข้ามา (ทุก 5 วินาที) จะโดนเด้งกลับกลางคัน */
const OVERLAYS = ['view-rules', 'view-setting'];
const onOverlay = () => OVERLAYS.includes(current);

function show(id) {
  // เช็กจาก DOM จริง ไม่ใช่เชื่อตัวแปรอย่างเดียว
  // เคยพลาดมาแล้ว: ตัวแปรบอกว่าอยู่หน้านี้ แต่หน้ายังซ่อนอยู่ เลยไม่มีอะไรโผล่เลย
  const same = current === id && !$(id).hidden;
  current = id;
  if (same) return;
  VIEWS.forEach(v => { $(v).hidden = v !== id; });
  window.scrollTo(0, 0);              // เปลี่ยนหน้าแล้วเริ่มอ่านจากบนสุดเสมอ
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
function listInto(ul, members, hostUid, opts = {}) {
  ul.innerHTML = '';
  members.forEach(m => {
    const li = document.createElement('li');
    if (!m.online || m.left) li.className = 'offline';

    const badges = [];
    if (m.uid === hostUid) badges.push(`<span class="badge host">${t('badge.host')}</span>`);
    if (m.left) badges.push(`<span class="badge">${t('badge.left')}</span>`);
    else if (m.role === 'spectator') badges.push(`<span class="badge">${t('badge.spectator')}</span>`);
    else if (m.ready) badges.push(`<span class="badge ready">${t('badge.ready')}</span>`);
    if (!m.online && !m.left) badges.push(`<span class="badge">${t('badge.offline')}</span>`);

    li.innerHTML =
      Avatar.face(m.uid, m.name, (lastRoom?.avatars || {})[m.uid], 30) +
      `<span class="pName">${esc(m.name || '')}</span>` +
      (m.uid === me.uid ? `<span class="pMe">${t('badge.you')}</span>` : '') +
      (badges.length ? badges.join('') : '<span class="badge"></span>');

    // เมนูจัดการ ขึ้นเฉพาะตอนเราเป็นเจ้าของห้องและยังไม่เริ่มเกม
    if (opts.manage && m.uid !== me.uid) {
      const tools = document.createElement('span');
      tools.className = 'row-tools';
      const btn = (act, label, arg) => {
        const b = document.createElement('button');
        b.className = 'tool';
        b.title = t(label);
        b.textContent = { up: '\u2191', down: '\u2193', seat: '\u21C4', kick: '\u2715' }[act];
        b.onclick = () => opts.manage(act, m, arg);
        return b;
      };
      if (m.role === 'player' && !m.left) {
        tools.append(btn('up', 'lobby.up'), btn('down', 'lobby.down'), btn('seat', 'lobby.toWatch'));
      } else if (!m.left) {
        tools.append(btn('seat', 'lobby.toPlay'));
      }
      tools.append(btn('kick', 'lobby.kick'));
      li.appendChild(tools);
    }
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
    card.className = 'game-card' + (g.id === chosen ? ' on' : '') + (g.comingSoon ? ' soon' : '');
    card.disabled = !room.isHost || !!g.comingSoon;

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

    if (g.comingSoon) {
      const tag = document.createElement('span');
      tag.className = 'soon-tag';
      tag.textContent = t('lobby.comingSoon');
      art.appendChild(tag);
    }

    const meta = document.createElement('div');
    meta.className = 'game-meta';
    meta.innerHTML =
      `<span class="game-name">${esc(t(g.nameKey))}</span>` +
      (g.comingSoon ? ''
        : `<span class="game-seats">${esc(t('lobby.players', { min: g.minPlayers, max: g.maxPlayers }))}</span>`) +
      `<span class="game-desc">${esc(t(g.descKey))}</span>`;

    card.append(art, meta);
    if (!g.comingSoon) card.onclick = () => Room.pickGame(g.id);
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
    if (!onOverlay()) show('view-play');
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
  if (!onOverlay()) show('view-lobby');
  listInto($('players'), room.members, room.doc.hostUid, {
    manage: room.isHost ? (act, m) => {
      if (act === 'kick') Room.kick(m.uid);
      else if (act === 'seat') Room.setRole(m.uid, m.role === 'player' ? 'spectator' : 'player');
      else Room.moveSeat(m.uid, act === 'up' ? -1 : 1);
    } : null
  });
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
  const players = room.members.filter(m => m.role === 'player' && !m.left);
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
  if (room.closed || room.kicked) {
    const why = room.kicked ? 'err.kicked' : 'err.roomClosed';
    room.closed = false; room.kicked = false;
    lastRoom = null;
    paintChat(null);
    rulesGame = null;
    show('view-home');            // ห้องหายไปแล้ว กรณีนี้ต้องลากออกมาจริง ๆ
    err(why);
    return;
  }
  lastRoom = room;
  paintChat(room);
  paintRoom();
});

/* ── แถบเสียงเพลง ─────────────────────────────────── */
/* วาดจากฟังก์ชันเดียว แต่ลงได้หลายที่ — หน้าห้องและหน้าตั้งค่า
   หน้าตั้งค่าสำคัญกว่า เพราะเพลงเริ่มตั้งแต่เปิดเว็บ ก่อนจะเข้าห้องเสียอีก */
/* แถบเสียงโผล่ทุกที่ที่เพลงกำลังเล่นอยู่ — หน้าแรก หน้าห้อง และหน้าตั้งค่า
   วาดจากฟังก์ชันเดียว เลื่อนที่ไหนอีกสองที่ก็ขยับตาม */
const AUDIO_HOSTS = ['audioHome', 'audioLobby', 'audioPlay', 'audioSetting'];

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

/* ── เข้าห้องแบบลงเล่นหรือนั่งดู ───────────────────── */
let watchOnly = false;
function paintJoinAs() {
  const host = $('joinAs');
  host.innerHTML = '';
  [['player', false], ['watch', true]].forEach(([key, val]) => {
    const b = document.createElement('button');
    b.className = 'seg' + (watchOnly === val ? ' on' : '');
    b.textContent = t('home.joinAs.' + key);
    b.onclick = () => { watchOnly = val; paintJoinAs(); };
    host.appendChild(b);
  });
}

/* ── แชท ──────────────────────────────────────────
   แผงลอย ใช้ได้ทั้งตอนอยู่ในห้องและตอนเล่นเกม โดยไม่ต้องแตะผังของทั้งสองหน้า */
let chatOpen = false;
let chatSeen = 0;

function paintChat(room) {
  const dock = $('chatDock');
  const inRoom = !!(room && room.code && room.doc);
  dock.hidden = !inRoom;
  if (!inRoom) return;

  $('chatBody').hidden = !chatOpen;
  const msgs = room.chat || [];

  const unread = Math.max(0, msgs.length - chatSeen);
  $('chatUnread').hidden = chatOpen || unread === 0;
  $('chatUnread').textContent = unread > 9 ? '9+' : String(unread);
  if (chatOpen) chatSeen = msgs.length;

  const list = $('chatList');
  list.innerHTML = msgs.length
    ? msgs.map(m => `<li${m.uid === me.uid ? ' class="mine"' : ''}>` +
        Avatar.face(m.uid, m.name, (room.avatars || {})[m.uid], 20) +
        `<span class="chat-who">${esc(m.name || '')}</span>` +
        `<span class="chat-text">${esc(m.text || '')}</span></li>`).join('')
    : `<li class="chat-none">${esc(t('chat.empty'))}</li>`;
  list.scrollTop = list.scrollHeight;

  const allowed = Room.canChat();
  $('chatText').disabled = !allowed;
  $('chatSend').disabled = !allowed;
  $('chatNote').hidden = allowed;
  $('chatNote').textContent = allowed ? '' : t('chat.muted');
}

function submitChat() {
  const box = $('chatText');
  const text = box.value.trim();
  if (!text) return;
  box.value = '';
  Room.sendChat(text).catch(e => {
    console.error('ส่งแชทไม่สำเร็จ', e);
    // ต้องเห็นบนจอ ไม่ใช่ซ่อนใน console — สาเหตุที่พบบ่อยคือยังไม่ได้วาง Security Rules ใหม่
    const note = $('chatNote');
    note.hidden = false;
    note.textContent = t('chat.failed', { why: e.code || e.message || '' });
    box.value = text;
  });
}

/* ── หน้ากติกาเกม ─────────────────────────────────
   สองชั้น — รายชื่อเกม แล้วกดเข้าไปอ่านของเกมนั้น
   เนื้อหามาจากเกมเอง (ช่อง guide ในทะเบียน) หน้านี้แค่จัดรูปแบบให้
   เพิ่มเกมใหม่แล้วขึ้นเองโดยไม่ต้องแก้อะไรตรงนี้ */
let rulesGame = null;

function paintRules() {
  const body = $('rulesBody');
  body.innerHTML = '';

  if (!rulesGame) {
    $('rulesTitle').textContent = t('rules.title');
    $('btnRulesBack').textContent = t('rules.back');

    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = t('rules.pick');
    body.appendChild(note);

    const list = document.createElement('div');
    list.className = 'rule-list';
    Games.all().forEach(g => {
      const b = document.createElement('button');
      b.className = 'rule-pick';
      b.innerHTML =
        (g.cover ? `<img src="${g.cover}" alt="" loading="lazy" onerror="this.remove()">` : '') +
        `<span><span class="rule-pick-name">${esc(t(g.nameKey))}` +
        (g.comingSoon ? ` <span class="soon-inline">${esc(t('lobby.comingSoon'))}</span>` : '') +
        `</span><span class="rule-pick-desc">${esc(t(g.descKey))}</span></span>`;
      b.onclick = () => { rulesGame = g.id; paintRules(); };
      list.appendChild(b);
    });
    body.appendChild(list);
    return;
  }

  const game = Games.get(rulesGame);
  $('rulesTitle').textContent = game ? t(game.nameKey) : t('rules.title');
  $('btnRulesBack').textContent = t('rules.back');

  const sections = game?.guide?.[lang] || game?.guide?.th || [];
  if (!sections.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = t('rules.none');
    body.appendChild(p);
    return;
  }

  sections.forEach(sec => {
    const box = document.createElement('section');
    box.className = 'rule-sec';
    box.innerHTML = `<h3>${esc(sec.h)}</h3><ul>` +
      sec.p.map(line => `<li>${esc(line)}</li>`).join('') + '</ul>';
    body.appendChild(box);
  });
}

/* ── รูปประจำตัว ──────────────────────────────────
   เก็บในเครื่อง อัปขึ้นตอนเข้าห้อง ห้องปิดแล้วหายจากหลังบ้าน */
function paintAvatar() {
  $('avatarPreview').innerHTML = Avatar.face(me.uid || 'me', name, Avatar.load(), 64);
  $('btnAvatarClear').hidden = !Avatar.load();
}

$('btnAvatarPick').onclick = () => $('avatarFile').click();
$('btnAvatarClear').onclick = () => { Avatar.clear(); paintAvatar(); };
$('avatarFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const note = $('avatarNote');
  try {
    const url = await Avatar.fromFile(file);
    Avatar.save(url);
    paintAvatar();
    note.textContent = t('set.avatarNote');
  } catch (err) {
    console.error('ย่อรูปไม่สำเร็จ', err);
    note.textContent = t(err.message === 'notAnImage' ? 'set.avatarNotImage' : 'set.avatarTooBig');
  }
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
  paintJoinAs();
  paintChat(lastRoom);
  if (current === 'view-rules') paintRules();
  paintError();
  paintAudio();
  if (current === 'view-lobby' || current === 'view-play') paintRoom();
});

/* ── ปุ่ม ─────────────────────────────────────────── */
$('inName').addEventListener('input', e => {
  name = e.target.value.trim().slice(0, 16);
  localStorage.setItem(NAME_KEY, name);
  if (current === 'view-setting') paintAvatar();
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
  try { await Room.joinRoom($('inCode').value, name, watchOnly); $('inCode').value = ''; }
  catch (e) { errFrom(e); }
  finally { $('btnJoin').disabled = false; }
};

$('btnSetting').onclick = () => { cameFrom = current; paintLangPick(); paintAudio(); paintAvatar(); show('view-setting'); };

const openRules = () => { cameFrom = current; rulesGame = null; paintRules(); show('view-rules'); };
$('btnRules').onclick = openRules;
$('btnRulesPlay').onclick = openRules;
$('btnRulesHome').onclick = openRules;
$('btnRulesBack').onclick = () => {
  if (rulesGame) { rulesGame = null; paintRules(); return; }   // ชั้นในกลับไปชั้นรายชื่อก่อน
  show(cameFrom === 'view-rules' ? 'view-home' : cameFrom);
  if (lastRoom) paintRoom();
};
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

$('chatToggle').onclick = () => { chatOpen = !chatOpen; paintChat(lastRoom); };
$('chatSend').onclick = submitChat;
$('chatText').addEventListener('keydown', e => { if (e.key === 'Enter') submitChat(); });

$('btnInvite').onclick = async () => {
  try {
    await navigator.clipboard.writeText(Room.inviteLink());
    const b = $('btnInvite'), old = t('lobby.invite');
    b.textContent = t('lobby.invited');
    setTimeout(() => { b.textContent = old; }, 1200);
  } catch { /* บางเบราว์เซอร์ไม่อนุญาต */ }
};

$('codeChip').onclick = async () => {
  try {
    await navigator.clipboard.writeText(Room.room.code);
    const el = $('outCode'), old = el.textContent;
    el.textContent = t('lobby.copied');
    setTimeout(() => { el.textContent = old; }, 1000);
  } catch { /* บางเบราว์เซอร์ไม่อนุญาต */ }
};

/* ตรวจว่า index.html ที่กำลังใช้อยู่เป็นรุ่นล่าสุดหรือยัง
   ─────────────────────────────────────────────────────────────
   ตัวเทียบรุ่นแบบเดิม (data-build เทียบกับ window.BUILD) ใช้ไม่ได้จริง
   เพราะ index.html ตัวเก่าจะเรียก js/env.js?v=<รุ่นเก่า> ซึ่งได้ไฟล์เก่ากลับมา
   สองค่าจึงค้างเก่าพร้อมกันอย่างสอดคล้อง แล้วไม่มีอะไรผิดปกติให้จับ

   ต้องอ่านจากที่ที่ index.html แตะไม่ถึง — version.json ดึงสด ๆ ทุกครั้ง */
async function checkBuild() {
  const html = document.body.dataset.build || '(ไม่มี)';
  console.info('[build]', html);
  try {
    const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    const latest = (await res.json()).build;
    if (!latest || latest === html) return;

    console.warn(`[build] หน้าเว็บค้างอยู่ที่ ${html} · รุ่นล่าสุดคือ ${latest}`);
    const bar = document.createElement('div');
    bar.className = 'build-warn';
    bar.innerHTML = `<span>${esc(t('build.stale', { old: html, now: latest }))}</span>`;
    const btn = document.createElement('button');
    btn.textContent = t('build.reload');
    btn.onclick = hardReload;
    bar.appendChild(btn);
    document.body.appendChild(bar);
  } catch { /* เปิดแบบออฟไลน์หรือไม่มีไฟล์ ก็ไม่เป็นไร */ }
}

/* โหลดใหม่โดยเลี่ยงแคช — เติมพารามิเตอร์ให้ URL ต่างจากเดิม เบราว์เซอร์จะไปเอาของใหม่
   เก็บพารามิเตอร์เดิมไว้ด้วย จะได้ไม่หลุดรหัสห้องจากลิงก์เชิญ */
function hardReload() {
  const u = new URL(location.href);
  u.searchParams.set('_cb', Date.now().toString(36));
  location.replace(u.toString());
}

/* ── บูต ──────────────────────────────────────────── */
(async () => {
  apply();
  $('bootText').textContent = t('boot.connecting');
  $('inName').value = name;
  paintLangPick();
  paintJoinAs();
  Music.init();
  paintAudio();

  // ลิงก์เชิญ — ใส่รหัสให้เลย ถ้ามีชื่ออยู่แล้วก็เข้าห้องให้เลย
  const invited = (new URLSearchParams(location.search).get('room') || '').toUpperCase();

  try {
    await connect();
    $('boot').hidden = true;
    show('view-home');
    if (invited.length === 4) {
      $('inCode').value = invited;
      if (name) { try { await Room.joinRoom(invited, name, watchOnly); } catch (e) { errFrom(e); } }
      else $('inName').focus();
    }
    checkBuild();
    console.info('[env]', window.__envInfo(), 'uid', me.uid);
  } catch (e) {
    boot(messageOf(e), true);
  }
})();
