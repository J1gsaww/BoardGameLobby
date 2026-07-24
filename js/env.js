/* env.js — โหลดก่อนไฟล์อื่น
   apiKey ของ Firebase ฝั่งเว็บไม่ใช่ความลับ มันแค่ชี้ว่าเป็นโปรเจกต์ไหน
   ความปลอดภัยจริงมาจาก Security Rules ไม่ใช่จากการซ่อนคีย์ */
(function () {
  'use strict';

  const PROJECTS = {
    dev: {
      apiKey:            'AIzaSyDZqQmG9kMs7rKggbQvUixFVEnObso2sio',
      authDomain:        'boardgamelobby-34b0f.firebaseapp.com',
      projectId:         'boardgamelobby-34b0f',
      storageBucket:     'boardgamelobby-34b0f.firebasestorage.app',
      messagingSenderId: '927504507212',
      appId:             '1:927504507212:web:ae5407ddfddfa9cd3defe9'
    },
    prod: null            // วางคอนฟิกของโปรดักชันทีหลังได้ ไม่ต้องแก้ที่อื่น
  };

  const h = location.hostname;
  const local = h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') ||
                location.protocol === 'file:';
  const env = local ? 'dev' : (PROJECTS.prod ? 'prod' : 'dev');

  window.BUILD = '2026-07-23.28';
  window.APP_ENV = env;
  window.FIREBASE_CONFIG = PROJECTS[env];
  window.MAX_IN_ROOM = 15;

  // ที่อยู่ไฟล์เพลง — เปลี่ยนชื่อไฟล์แล้วแก้ที่นี่ที่เดียว
  // encodeURI จัดการช่องว่างในชื่อไฟล์ให้เอง ('Lobby Music.mp3' -> 'Lobby%20Music.mp3')
  window.MUSIC_SRC = encodeURI('assets/music/Lobby Music.mp3');
  window.__envInfo = () => ({ env, host: h, projectId: PROJECTS[env].projectId });
})();
