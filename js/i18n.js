/* i18n.js — ชั้นภาษา
   ─────────────────────────────────────────────────────────────
   กติกาเดียวที่ต้องถือให้มั่น: ไม่มีข้อความที่ผู้ใช้เห็นอยู่ในไฟล์อื่น
   ไฟล์อื่นถืออ้างได้แค่ "คีย์" ส่วนคำจริงอยู่ที่นี่ที่เดียว

   ใช้ 3 ทาง
     1. ใน HTML          <span data-i18n="home.host"></span>
                         <input data-i18n-placeholder="home.namePlaceholder">
                         <button data-i18n-title="lobby.copy">
     2. ใน JS            t('lobby.waitReady', { n: 3 })
     3. ในข้อผิดพลาด     throw new AppError('err.roomFull')
                         แล้วให้ชั้นหน้าจอเป็นคนแปลตอนแสดง

   ภาษาเป็นค่าประจำเครื่อง ไม่ขึ้น Firestore — คนละคนในห้องเดียวกัน
   เลือกคนละภาษาได้ ไม่กระทบกัน
   ───────────────────────────────────────────────────────────── */

export const LANGS = { th: 'ไทย', en: 'English' };
const KEY = 'lobby.lang';
const FALLBACK = 'th';

const DICT = {
  th: {
    'app.title': 'ห้องเกม',

    'home.eyebrow': 'board game lobby',
    'home.title': 'ห้องเกม',
    'home.nameLabel': 'ชื่อของคุณ',
    'home.namePlaceholder': 'ตั้งชื่อที่เพื่อนจะเห็น',
    'home.host': 'สร้างห้อง',
    'home.join': 'เข้าห้อง',
    'home.codePlaceholder': 'รหัส',
    'home.setting': 'ตั้งค่า',
    'home.needName': 'ใส่ชื่อก่อนนะ',

    'set.title': 'ตั้งค่า',
    'set.back': 'กลับ',
    'set.avatar': 'รูปประจำตัว',
    'set.avatarPick': 'เลือกรูป',
    'set.avatarClear': 'เอาออก',
    'set.avatarNote': 'เก็บไว้ในเครื่องนี้ · จะถูกส่งขึ้นตอนเข้าห้องเพื่อให้เพื่อนเห็น และหายจากหลังบ้านทันทีที่ห้องปิด',
    'set.avatarNotImage': 'ไฟล์นี้ไม่ใช่รูปภาพ',
    'crop.title': 'จัดรูปให้พอดีกรอบ',
    'crop.hint': 'ลากรูปเพื่อเลื่อน · เลื่อนแถบหรือหมุนล้อเมาส์เพื่อซูม · ส่วนที่อยู่ในวงกลมคือส่วนที่จะใช้',
    'crop.ok': 'ใช้รูปนี้',
    'crop.cancel': 'ยกเลิก',
    'set.avatarTooBig': 'ย่อรูปไม่สำเร็จ ลองใช้รูปอื่นดูนะ',
    'set.language': 'ภาษา',
    'set.langNote': 'เก็บไว้ในเครื่องนี้เท่านั้น เพื่อนในห้องเดียวกันเลือกคนละภาษาได้',

    'lobby.leave': 'ออกจากห้อง',
    'lobby.codeLabel': 'รหัสห้อง',
    'lobby.copy': 'แตะเพื่อคัดลอก',
    'lobby.copied': 'คัดลอกแล้ว',
    'lobby.title': 'ผู้เล่นในห้อง',
    'lobby.pickGame': 'เลือกเกม',
    'home.joinAs.player': 'ลงเล่น',
    'home.joinAs.watch': 'นั่งดู',
    'lobby.invite': 'คัดลอกลิงก์เชิญ',
    'lobby.invited': 'คัดลอกลิงก์แล้ว',
    'lobby.kick': 'เตะออก',
    'lobby.toWatch': 'ให้ไปนั่งดู',
    'lobby.toPlay': 'ให้ลงเล่น',
    'lobby.up': 'เลื่อนที่นั่งขึ้น',
    'lobby.down': 'เลื่อนที่นั่งลง',
    'lobby.spectators': 'คนดู',
    'lobby.noSpectators': 'ยังไม่มีคนดู',
    'lobby.beSpectator': 'ไปนั่งดู',
    'lobby.bePlayer': 'ขอลงเล่น',
    'lobby.comingSoon': 'เร็ว ๆ นี้',
    'badge.left': 'ออกไปแล้ว',
    'err.kicked': 'เจ้าของห้องเตะคุณออกจากห้อง',
    'err.avatarUpload': 'อัปรูปประจำตัวไม่สำเร็จ ({why}) — ถ้าเป็น permission-denied แปลว่ายังไม่ได้วางกฎ avatars ใน Firestore',
    'chat.title': 'แชท',
    'chat.placeholder': 'พิมพ์ข้อความ',
    'chat.send': 'ส่ง',
    'chat.muted': 'เกมนี้ไม่ให้คนดูพิมพ์แชท',
    'chat.failed': 'ส่งไม่สำเร็จ ({why}) — ถ้าเป็น permission-denied แปลว่ายังไม่ได้วาง Security Rules ตัวใหม่',
    'chat.empty': 'ยังไม่มีข้อความ',
    'rules.title': 'กติกาเกม',
    'rules.pick': 'เลือกเกมที่อยากอ่านกติกา',
    'rules.back': 'กลับ',
    'rules.none': 'เกมนี้ยังไม่ได้เขียนกติกาไว้',
    'lobby.noGame': 'ยังไม่ได้เลือกเกม',
    'lobby.hostPicks': 'เจ้าของห้องเป็นคนเลือกเกม',
    'lobby.wrongCount': 'เกมนี้เล่น {min}–{max} คน ตอนนี้มี {n}',
    'lobby.players': '{min}–{max} คน',
    'lobby.ready': 'พร้อม',
    'lobby.unready': 'ยังไม่พร้อม',
    'lobby.start': 'เริ่มเกม',
    'lobby.waitHost': 'รอเจ้าของห้องกดเริ่มเกม',
    'lobby.needTwo': 'ต้องมีผู้เล่นอย่างน้อย 2 คน',
    'lobby.someoneOffline': 'มีคนหลุดอยู่ รอสักครู่',
    'lobby.waitReady': 'รออีก {n} คนกดพร้อม',

    'badge.host': 'เจ้าของห้อง',
    'badge.ready': 'พร้อม',
    'badge.spectator': 'คนดู',
    'badge.offline': 'หลุด',
    'badge.you': 'คุณ',

    'play.title': 'เริ่มเกมแล้ว',
    'play.hint': 'ตรงนี้คือที่ที่เกมจะมาเสียบในสไลซ์ถัดไป ตอนนี้มีไว้พิสูจน์ว่าสถานะห้องเปลี่ยนถึงทุกเครื่องจริง',
    'play.back': 'กลับไปที่ห้อง',
    'play.leaveGame': 'จบเกม กลับไปที่ห้อง',
    'play.hostNote': 'คุณเป็นเจ้าของห้อง — กดกลับไปที่ห้องได้',
    'play.guestNote': 'รอเจ้าของห้องพากลับไปที่ห้อง',

    'audio.label': 'ระดับเสียง',
    'audio.master': 'รวม',
    'audio.music': 'เพลง',
    'audio.sfx': 'เสียงประกอบ',
    'audio.mute': 'ปิดเสียง',
    'audio.unmute': 'เปิดเสียง',
    'audio.blocked': 'เพลงเริ่มเล่นแล้วแต่ยังปิดเสียงอยู่ — แตะที่ไหนก็ได้สักครั้งเพื่อเปิดเสียง',
    'audio.missing': 'ไม่พบไฟล์เพลงที่ {src}',

    'boot.connecting': 'กำลังเชื่อมต่อ…',
    'build.stale': 'หน้าเว็บค้างอยู่ที่รุ่น {old} · รุ่นล่าสุดคือ {now}',
    'build.reload': 'โหลดใหม่',

    'err.roomClosed': 'ห้องถูกปิดแล้ว',
    'err.codeLength': 'รหัสห้องมี 4 ตัว',
    'err.roomNotFound': 'ไม่พบห้อง {code}',
    'err.roomFull': 'ห้องเต็มแล้ว',
    'err.codeGenFail': 'สุ่มรหัสห้องไม่ได้ ลองอีกครั้ง',
    'err.noConfig': 'ไม่พบค่า Firebase ใน js/env.js',
    'err.fileProtocol': 'เปิดผ่าน file:// ไม่ได้\n\nต้องเสิร์ฟผ่าน http — ใช้ GitHub Pages\nหรือรัน  npx serve  ในโฟลเดอร์นี้',
    'err.authNotConfigured': 'โปรเจกต์นี้ยังไม่ได้เปิดใช้ Authentication\n\nFirebase console → Build → Authentication\n→ กด Get started ก่อน แล้วค่อยเปิด Anonymous',
    'err.authAnonDisabled': 'ยังไม่ได้เปิด Anonymous sign-in\n\nAuthentication → Sign-in method\n→ Anonymous → Enable',
    'err.unauthorizedDomain': 'โดเมนนี้ยังไม่ได้รับอนุญาต\n\nAuthentication → Settings → Authorized domains\n→ เพิ่ม {host}',
    'err.signInFailed': 'เข้าสู่ระบบไม่สำเร็จ: {msg}'
  },

  en: {
    'app.title': 'Game Room',

    'home.eyebrow': 'board game lobby',
    'home.title': 'Game Room',
    'home.nameLabel': 'Your name',
    'home.namePlaceholder': 'What your friends will see',
    'home.host': 'Host Game',
    'home.join': 'Join Game',
    'home.codePlaceholder': 'Code',
    'home.setting': 'Setting',
    'home.needName': 'Enter a name first',

    'set.title': 'Setting',
    'set.back': 'Back',
    'set.avatar': 'Profile picture',
    'set.avatarPick': 'Choose',
    'set.avatarClear': 'Remove',
    'set.avatarNote': 'Kept on this device · uploaded when you join a room so friends can see it, and wiped from the backend the moment the room closes',
    'set.avatarNotImage': 'That file is not an image',
    'crop.title': 'Frame your picture',
    'crop.hint': 'Drag to move · use the slider or scroll to zoom · whatever sits inside the circle is what gets used',
    'crop.ok': 'Use this',
    'crop.cancel': 'Cancel',
    'set.avatarTooBig': 'Could not shrink that image — try another one',
    'set.language': 'Language',
    'set.langNote': 'Saved on this device only — everyone in a room can pick their own language',

    'lobby.leave': 'Leave room',
    'lobby.codeLabel': 'Room code',
    'lobby.copy': 'Tap to copy',
    'lobby.copied': 'Copied',
    'lobby.title': 'Players',
    'lobby.pickGame': 'Pick a game',
    'home.joinAs.player': 'Play',
    'home.joinAs.watch': 'Watch',
    'lobby.invite': 'Copy invite link',
    'lobby.invited': 'Link copied',
    'lobby.kick': 'Kick out',
    'lobby.toWatch': 'Move to spectators',
    'lobby.toPlay': 'Give a seat',
    'lobby.up': 'Move seat up',
    'lobby.down': 'Move seat down',
    'lobby.spectators': 'Spectators',
    'lobby.noSpectators': 'No spectators yet',
    'lobby.beSpectator': 'Just watch',
    'lobby.bePlayer': 'Take a seat',
    'lobby.comingSoon': 'Coming soon',
    'badge.left': 'left',
    'err.kicked': 'The host removed you from the room',
    'err.avatarUpload': 'Could not upload your picture ({why}) — permission-denied means the avatars rule is not published yet',
    'chat.title': 'Chat',
    'chat.placeholder': 'Type a message',
    'chat.send': 'Send',
    'chat.muted': 'This game does not let spectators chat',
    'chat.failed': 'Could not send ({why}) — if this says permission-denied, the new Security Rules are not published yet',
    'chat.empty': 'No messages yet',
    'rules.title': 'Game rules',
    'rules.pick': 'Pick a game to read about',
    'rules.back': 'Back',
    'rules.none': 'No rules written for this game yet',
    'lobby.noGame': 'No game chosen yet',
    'lobby.hostPicks': 'The host picks the game',
    'lobby.wrongCount': 'This game needs {min}–{max} players — there are {n}',
    'lobby.players': '{min}–{max} players',
    'lobby.ready': 'Ready',
    'lobby.unready': 'Unready',
    'lobby.start': 'Start',
    'lobby.waitHost': 'Waiting for the host to start',
    'lobby.needTwo': 'Needs at least 2 players',
    'lobby.someoneOffline': 'Someone dropped out — hold on',
    'lobby.waitReady': 'Waiting on {n} more to be ready',

    'badge.host': 'Host',
    'badge.ready': 'Ready',
    'badge.spectator': 'Spectator',
    'badge.offline': 'Offline',
    'badge.you': 'you',

    'play.title': 'Game started',
    'play.hint': 'This is where the game will slot in next. For now it proves the room status reaches every screen.',
    'play.back': 'Back to room',
    'play.leaveGame': 'End game, back to room',
    'play.hostNote': 'You are the host — you can go back to the room',
    'play.guestNote': 'Waiting for the host to go back to the room',

    'audio.label': 'Volume',
    'audio.master': 'Overall',
    'audio.music': 'Music',
    'audio.sfx': 'Effects',
    'audio.mute': 'Mute',
    'audio.unmute': 'Unmute',
    'audio.blocked': 'The music is already running but still silent — tap anywhere once to turn the sound on',
    'audio.missing': 'Music file not found at {src}',

    'boot.connecting': 'Connecting…',
    'build.stale': 'This page is stuck on build {old} — the latest is {now}',
    'build.reload': 'Reload',

    'err.roomClosed': 'That room was closed',
    'err.codeLength': 'A room code is 4 characters',
    'err.roomNotFound': 'No room called {code}',
    'err.roomFull': 'That room is full',
    'err.codeGenFail': 'Could not generate a room code — try again',
    'err.noConfig': 'No Firebase config found in js/env.js',
    'err.fileProtocol': 'file:// will not work\n\nServe over http — use GitHub Pages\nor run  npx serve  in this folder',
    'err.authNotConfigured': 'Authentication is not set up in this project\n\nFirebase console → Build → Authentication\n→ press Get started, then enable Anonymous',
    'err.authAnonDisabled': 'Anonymous sign-in is turned off\n\nAuthentication → Sign-in method\n→ Anonymous → Enable',
    'err.unauthorizedDomain': 'This domain is not allowed\n\nAuthentication → Settings → Authorized domains\n→ add {host}',
    'err.signInFailed': 'Sign-in failed: {msg}'
  }
};

/* ── สถานะ ─────────────────────────────────────────── */

function detect() {
  const saved = localStorage.getItem(KEY);
  if (saved && DICT[saved]) return saved;
  return (navigator.language || '').toLowerCase().startsWith('th') ? 'th' : 'en';
}

export let lang = detect();
const listeners = [];

/* ── แปล ───────────────────────────────────────────── */

export function t(key, params) {
  const table = DICT[lang] || DICT[FALLBACK];
  let s = table[key];
  if (s === undefined) s = (DICT[FALLBACK][key] !== undefined) ? DICT[FALLBACK][key] : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.split('{' + k + '}').join(v);
  }
  return s;
}

/* ข้อผิดพลาดที่ถือคีย์ไว้ ไม่ใช่ข้อความ — ชั้นหน้าจอค่อยแปลตอนแสดง */
export class AppError extends Error {
  constructor(key, params) {
    super(key);
    this.key = key;
    this.params = params || null;
  }
}
export const messageOf = (e) =>
  (e && e.key) ? t(e.key, e.params) : (e && e.message) || String(e);

/* เกมเติมคำแปลของตัวเองเข้ามาได้ ไม่ต้องมาแก้ไฟล์นี้ */
export function extend(tables) {
  for (const [l, table] of Object.entries(tables || {})) {
    if (!DICT[l]) DICT[l] = {};
    Object.assign(DICT[l], table);
  }
}

/* ── ทาลง DOM ──────────────────────────────────────── */

export function apply(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.documentElement.lang = lang;
  document.title = t('app.title');
}

export function setLang(next) {
  if (!DICT[next] || next === lang) return;
  lang = next;
  localStorage.setItem(KEY, next);
  apply();
  listeners.forEach(fn => { try { fn(next); } catch (e) { console.error(e); } });
}

export const onLangChange = (fn) => listeners.push(fn);

/* ตรวจว่ามีคีย์ไหนแปลไม่ครบ — เรียกจาก console ได้ */
window.__i18nAudit = () => {
  const all = new Set([...Object.keys(DICT.th), ...Object.keys(DICT.en)]);
  const missing = {};
  for (const l of Object.keys(DICT)) {
    const gaps = [...all].filter(k => DICT[l][k] === undefined);
    if (gaps.length) missing[l] = gaps;
  }
  return Object.keys(missing).length ? missing : 'ครบทุกคีย์';
};
