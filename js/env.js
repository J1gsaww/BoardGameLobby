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
    /* โปรเจกต์สำรองไว้เทส — โควตา Firestore นับแยกกันคนละโปรเจกต์
       วันไหนโควตาของ dev หมดก่อนบ่ายสอง ก็สลับมาใช้ตัวนี้เล่นต่อได้
       เอาคอนฟิกจาก Firebase Console ของโปรเจกต์ใหม่มาวางแทน null */
    alt: {
      apiKey:            'AIzaSyAtbOJ7PGQuouTQUeZF3ZAjaElctAsRhqQ',
      authDomain:        'boardgamelobbytemp.firebaseapp.com',
      projectId:         'boardgamelobbytemp',
      storageBucket:     'boardgamelobbytemp.firebasestorage.app',
      messagingSenderId: '148115770924',
      appId:             '1:148115770924:web:c614ec25ec476152eb4b89'
      /* measurementId ไม่ต้องใส่ มันใช้กับ Analytics ซึ่งเกมนี้ไม่ได้เปิด */
    },

    prod: null            // วางคอนฟิกของโปรดักชันทีหลังได้ ไม่ต้องแก้ที่อื่น
  };

  const h = location.hostname;
  const local = h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') ||
                location.protocol === 'file:';

  /* สลับโปรเจกต์ด้วย ?db=alt ท้าย URL

     **ตัวหลักเป็นค่าเริ่มต้นเสมอ** ตัวสำรองต้องขอทุกครั้งที่เปิดหน้าต่างใหม่
     ของเดิมจำไว้ถาวรในเครื่อง ค่าที่ตั้งครั้งเดียวเลยกลายเป็นค่าถาวรโดยไม่ตั้งใจ
     แล้วเบราว์เซอร์แต่ละตัวก็ค้างคนละโปรเจกต์จนหาห้องกันไม่เจอ

     ตอนนี้จำแค่ในแท็บนี้ ปิดแท็บแล้วลืม รีเฟรชยังอยู่
     ลิงก์เชิญพาค่านี้ไปด้วยอยู่แล้ว คนที่กดเข้ามาจึงลงโปรเจกต์เดียวกันเสมอ */
  const KEY = 'wr.db';
  try { localStorage.removeItem(KEY); } catch {}   /* ล้างของเก่าที่เคยจำไว้ถาวร */

  const asked = new URLSearchParams(location.search).get('db');
  if (asked) { try { sessionStorage.setItem(KEY, asked); } catch {} }
  let pick = asked;
  if (!pick) { try { pick = sessionStorage.getItem(KEY); } catch {} }

  const env = (pick && PROJECTS[pick]) ? pick
            : local ? 'dev'
            : (PROJECTS.prod ? 'prod' : 'dev');

  if (pick && !PROJECTS[pick]) {
    console.warn('[env] ยังไม่ได้วางคอนฟิกของ', pick, '— ใช้', env, 'ไปก่อน');
  }
  console.info('[env] ใช้โปรเจกต์', env, '·', PROJECTS[env].projectId);
  window.DB_ENV = env;

  window.BUILD = '2026-07-28.15';
  window.APP_ENV = env;
  window.FIREBASE_CONFIG = PROJECTS[env];
  window.MAX_IN_ROOM = 15;

  // ที่อยู่ไฟล์เพลง — เปลี่ยนชื่อไฟล์แล้วแก้ที่นี่ที่เดียว
  // encodeURI จัดการช่องว่างในชื่อไฟล์ให้เอง ('Lobby Music.mp3' -> 'Lobby%20Music.mp3')
  window.MUSIC_SRC = encodeURI('assets/music/Lobby Music.mp3');
  window.__envInfo = () => ({ env, host: h, projectId: PROJECTS[env].projectId });
})();
