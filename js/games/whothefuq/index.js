/* index.js — Who the faq are you
   เกมสืบสวนหาว่าใครถือตัวละครอะไร จากคุณสมบัติที่ค่อย ๆ ถูกเปิดออกมา
   กติกาแกนนิ่งแล้ว แต่ยังรอรายการการ์ดอีเวนต์ จึงยังไม่เปิดให้เล่น */

import { register } from '../../games.js';

register({
  id: 'whothefuq',
  category: 'board',
  comingSoon: true,
  cover: 'assets/game/whothefuq/cover.png',

  i18n: {
    th: {
      'game.whothefuq.name': 'Who the faq are you',
      'game.whothefuq.desc': 'เกมสืบสวนหาว่าใครเป็นอาชีพอะไร จากคุณสมบัติที่ค่อย ๆ หลุดออกมา กำลังพัฒนา'
    },
    en: {
      'game.whothefuq.name': 'Who the faq are you',
      'game.whothefuq.desc': 'A deduction game — work out who is who from the traits that slip out. In development'
    }
  }
});
