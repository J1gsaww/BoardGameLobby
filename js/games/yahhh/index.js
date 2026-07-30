/* index.js — ทะเบียนของ Yahhh */

import { register } from '../../games.js';
import { init, onAction, tick } from './game.js';
import { render } from './ui.js';
import { YAHHH_GUIDE } from './guide.js';

register({
  id: 'yahhh',
  category: 'card',
  cover: 'assets/game/yahhh/cover.png',
  table: 'assets/game/yahhh/table.png',
  spectators: true,
  allowSpectatorChat: true,      /* ไม่มีข้อมูลลับเลย คนดูพิมพ์ได้ตามปกติ */
  guide: YAHHH_GUIDE,
  minPlayers: 2,
  maxPlayers: 2,

  settings: [],

  init, onAction, tick, render,

  i18n: {
    th: {
      'game.yahhh.name': 'Yahhh',
      'game.yahhh.desc': '2 คน · ยาห์ทซีที่เปลี่ยนลูกเต๋าเป็นไพ่ · จั่วห้าใบ ล็อกใบที่ชอบ สุ่มใหม่ได้อีกสี่รอบ แล้วเลือกช่องลงคะแนน · 13 ช่อง คนละ 13 รอบ',

      'yahhh.round': 'รอบที่ {n} จาก {of}',
      'yahhh.yourTurn': 'ตาของคุณ',
      'yahhh.theirTurn': 'ตาของ {name}',
      'yahhh.rerollsLeft': 'สุ่มใหม่ได้อีก {n} รอบ',
      'yahhh.reroll': 'สุ่มใบที่ไม่ได้ล็อก ({n})',
      'yahhh.tapToLock': 'กดที่ไพ่เพื่อล็อกไว้ กดซ้ำเพื่อปลด',
      'yahhh.total': 'รวม',
      'yahhh.over.win': '{name} ชนะ',
      'yahhh.over.draw': 'เสมอกัน',
      'yahhh.log.score': '{name} ลง {row} ได้ {n} แต้ม',

      'yahhh.row.r1': 'A',
      'yahhh.row.r2': '2',
      'yahhh.row.r3': '3',
      'yahhh.row.r4': '4',
      'yahhh.row.r5': '5',
      'yahhh.row.r6': '6',
      'yahhh.row.pair': 'คู่',
      'yahhh.row.twoPair': 'สองคู่',
      'yahhh.row.three': 'ตอง',
      'yahhh.row.four': 'โฟร์',
      'yahhh.row.full': 'ฟูลเฮาส์',
      'yahhh.row.suit': 'ดอกเหมือนกัน',
      'yahhh.row.straight': 'เสตรท'
    },
    en: {
      'game.yahhh.name': 'Yahhh',
      'game.yahhh.desc': '2 players · Yahtzee with cards instead of dice · draw five, lock what you like, reroll four more times, then choose a row',

      'yahhh.round': 'Round {n} of {of}',
      'yahhh.yourTurn': 'Your turn',
      'yahhh.theirTurn': "{name}'s turn",
      'yahhh.rerollsLeft': '{n} rerolls left',
      'yahhh.reroll': 'Reroll the rest ({n})',
      'yahhh.tapToLock': 'Tap a card to lock it, tap again to release',
      'yahhh.total': 'Total',
      'yahhh.over.win': '{name} wins',
      'yahhh.over.draw': 'A draw',
      'yahhh.log.score': '{name} scored {n} in {row}',

      'yahhh.row.r1': 'A',
      'yahhh.row.r2': '2',
      'yahhh.row.r3': '3',
      'yahhh.row.r4': '4',
      'yahhh.row.r5': '5',
      'yahhh.row.r6': '6',
      'yahhh.row.pair': 'Pair',
      'yahhh.row.twoPair': 'Two pair',
      'yahhh.row.three': 'Three of a kind',
      'yahhh.row.four': 'Four of a kind',
      'yahhh.row.full': 'Full house',
      'yahhh.row.suit': 'Same suit',
      'yahhh.row.straight': 'Straight'
    }
  }
});
