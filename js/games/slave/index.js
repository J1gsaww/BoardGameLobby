/* index.js — ทะเบียนของเกมสลาฟ
   เหลือแค่ "หน้าตาและของประจำเกม" กติกากับหน้าจอมาจากแกนกลาง */

import { register } from '../../games.js';
import '../core/trick-i18n.js';
import { makeGame } from '../core/trick-game.js';
import { makeUI } from '../core/trick-ui.js';
import { SLAVE } from './rules.js';
import { TRICK_GUIDE } from '../core/trick-guide.js';

const game = makeGame(SLAVE);
const ui = makeUI(SLAVE);

register({
  id: 'slave',
  cover: 'assets/game/slave/cover.png',
  table: 'assets/game/slave/table.png',
  music: 'assets/music/slave.mp3',
  guide: TRICK_GUIDE,
  minPlayers: SLAVE.minPlayers,
  maxPlayers: SLAVE.maxPlayers,

  settings: [
    { key: 'mode',        default: 'normal', options: ['normal', 'endless'] },
    { key: 'turnSeconds', default: 0,        options: [0, 5, 10, 15, 20] }
  ],

  init: game.init,
  onAction: game.onAction,
  tick: game.tick,
  render: ui.render,

  i18n: {
    th: {
      'game.slave.name': 'สลาฟ',
      'game.slave.desc': '4–10 คน · ทิ้งไพ่ให้หมดก่อนใคร · คนแพ้ต้องยกไพ่ดีที่สุดให้คนชนะรอบหน้า',
      'game.slave.mode': 'โหมด',
      'game.slave.mode.normal': 'ปกติ — สองรอบจบ',
      'game.slave.mode.endless': 'ไม่รู้จบ — มีคะแนน',
      'game.slave.turnSeconds': 'เวลาต่อตา',
      'game.slave.turnSeconds.0': 'ไม่จับเวลา',
      'game.slave.turnSeconds.5': '5 วิ',
      'game.slave.turnSeconds.10': '10 วิ',
      'game.slave.turnSeconds.15': '15 วิ',
      'game.slave.turnSeconds.20': '20 วิ'
    },
    en: {
      'game.slave.name': 'Slave',
      'game.slave.desc': '4–10 players · shed your hand first · the loser hands their best cards to the winner next round',
      'game.slave.mode': 'Mode',
      'game.slave.mode.normal': 'Normal — two rounds',
      'game.slave.mode.endless': 'Endless — with scoring',
      'game.slave.turnSeconds': 'Turn timer',
      'game.slave.turnSeconds.0': 'No timer',
      'game.slave.turnSeconds.5': '5s',
      'game.slave.turnSeconds.10': '10s',
      'game.slave.turnSeconds.15': '15s',
      'game.slave.turnSeconds.20': '20s'
    }
  }
});
