/* index.js — Curtain Rivalry
   ยังไม่เปิดให้เล่น ลงทะเบียนไว้เป็นการ์ด Coming Soon ก่อน
   ตั้ง comingSoon: true แล้วหน้าเลือกเกมจะทำให้ทึบและกดไม่ได้เอง
   พอกติกาพร้อมค่อยเติม init / onAction / render แล้วลบบรรทัดนั้นทิ้ง */

import { register } from '../../games.js';

register({
  id: 'curtain_rivalry',
  category: 'board',
  comingSoon: true,
  cover: 'assets/game/curtain_rivalry/cover.png',

  i18n: {
    th: {
      'game.curtain_rivalry.name': 'Curtain Rivalry',
      'game.curtain_rivalry.desc': 'บอร์ดเกมที่ออกแบบเอง กำลังพัฒนา'
    },
    en: {
      'game.curtain_rivalry.name': 'Curtain Rivalry',
      'game.curtain_rivalry.desc': 'An original board game, in development'
    }
  }
});
