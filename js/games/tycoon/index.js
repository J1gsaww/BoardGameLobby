/* index.js — ทะเบียนของ Tycoon
   ใช้กติกาและหน้าจอชุดเดียวกับสลาฟ ต่างกันแค่ไฟล์ rules.js กับของประจำเกม */

import { register } from '../../games.js';
import '../core/trick-i18n.js';
import { makeGame } from '../core/trick-game.js';
import { makeUI } from '../core/trick-ui.js';
import { TYCOON } from './rules.js';
import { withExtra } from '../core/trick-guide.js';
import { TYCOON_EXTRA } from './guide.js';

const game = makeGame(TYCOON);
const ui = makeUI(TYCOON);

register({
  id: 'tycoon',
  cover: 'assets/game/tycoon/cover.png',
  table: 'assets/game/tycoon/table.png',
  music: 'assets/music/slave.mp3',
  spectators: true,          // รับคนดูได้
  allowSpectatorChat: true,  // เกมนี้ไม่มีข้อมูลลับจากคนดู พิมพ์ได้ตามปกติ
  guide: withExtra(TYCOON_EXTRA),
  minPlayers: TYCOON.minPlayers,
  maxPlayers: TYCOON.maxPlayers,

  settings: [
    { key: 'mode',        default: 'normal', options: ['normal', 'endless'] },
    { key: 'jokers',      default: 2,        options: [2, 3, 4] },
    { key: 'turnSeconds', default: 0,        options: [0, 5, 10, 15, 20] }
  ],

  init: game.init,
  onAction: game.onAction,
  tick: game.tick,
  render: ui.render,

  i18n: {
    th: {
      'game.tycoon.name': 'Tycoon',
      'game.tycoon.desc': '4 คนเป๊ะ ๆ · มีโจ๊กเกอร์ · ลง 8 จบกอง · ลงโฟร์แล้วลำดับไพ่กลับหัวทั้งวง',
      'game.tycoon.mode': 'โหมด',
      'game.tycoon.mode.normal': 'ปกติ — สองรอบจบ',
      'game.tycoon.mode.endless': 'ไม่รู้จบ — มีคะแนน',
      'game.tycoon.jokers': 'จำนวนโจ๊กเกอร์',
      'game.tycoon.jokers.2': '2 ใบ — ตามเกมต้นฉบับ',
      'game.tycoon.jokers.3': '3 ใบ',
      'game.tycoon.jokers.4': '4 ใบ',
      'game.tycoon.turnSeconds': 'เวลาต่อตา',
      'game.tycoon.turnSeconds.0': 'ไม่จับเวลา',
      'game.tycoon.turnSeconds.5': '5 วิ',
      'game.tycoon.turnSeconds.10': '10 วิ',
      'game.tycoon.turnSeconds.15': '15 วิ',
      'game.tycoon.turnSeconds.20': '20 วิ'
    },
    en: {
      'game.tycoon.name': 'Tycoon',
      'game.tycoon.desc': 'exactly 4 players · jokers · an 8 ends the trick · a four-of-a-kind flips the whole card order',
      'game.tycoon.mode': 'Mode',
      'game.tycoon.mode.normal': 'Normal — two rounds',
      'game.tycoon.mode.endless': 'Endless — with scoring',
      'game.tycoon.jokers': 'Jokers',
      'game.tycoon.jokers.2': '2 — the base game',
      'game.tycoon.jokers.3': '3',
      'game.tycoon.jokers.4': '4',
      'game.tycoon.turnSeconds': 'Turn timer',
      'game.tycoon.turnSeconds.0': 'No timer',
      'game.tycoon.turnSeconds.5': '5s',
      'game.tycoon.turnSeconds.10': '10s',
      'game.tycoon.turnSeconds.15': '15s',
      'game.tycoon.turnSeconds.20': '20s'
    }
  }
});
