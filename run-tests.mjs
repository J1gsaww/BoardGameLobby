/* run-tests.mjs — รันชุดทดสอบทั้งหมดในคำสั่งเดียว
   node run-tests.mjs */
import { execFileSync } from 'node:child_process';

const files = [
  'js/games/core/cards.test.mjs',
  'js/games/core/engine.test.mjs',
  'js/games/core/score.test.mjs',
  'js/games/core/flow.test.mjs',
  'js/games/core/tycoon.test.mjs'
];

let bad = 0;
for (const f of files) {
  process.stdout.write('\n\u2500\u2500 ' + f + ' \u2500\u2500\n');
  try { process.stdout.write(execFileSync(process.execPath, [f], { encoding: 'utf8' })); }
  catch (e) { bad++; process.stdout.write(e.stdout || String(e)); }
}
process.stdout.write(bad ? `\nมีไฟล์ที่ไม่ผ่าน ${bad} ไฟล์\n` : '\nผ่านทั้งหมด\n');
process.exit(bad ? 1 : 0);
