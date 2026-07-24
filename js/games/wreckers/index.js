/* index.js — Wreckers
   Wreckers คือคนที่ล่อเรือให้ชนโขดหินแล้วเก็บของจากซาก เป็นอาชีพจริงในประวัติศาสตร์
   ยังไม่เปิดให้เล่น รอกติกา */

import { register } from '../../games.js';

register({
  id: 'wreckers',
  category: 'board',
  comingSoon: true,
  cover: 'assets/game/wreckers/cover.png',

  i18n: {
    th: {
      'game.wreckers.name': 'Wreckers',
      'game.wreckers.desc': 'โจรสลัดแย่งสมบัติกันบนเรือที่กำลังจะจม ไว้ใจใครไม่ได้สักคน กำลังพัฒนา'
    },
    en: {
      'game.wreckers.name': 'Wreckers',
      'game.wreckers.desc': 'Pirates tearing into the same haul on a sinking ship, and nobody can be trusted. In development'
    }
  }
});
