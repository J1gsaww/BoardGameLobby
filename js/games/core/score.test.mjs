/* score.test.mjs — ชุดทดสอบระบบคะแนน
   รันด้วย  node js/games/slave/score.test.mjs */

import { rankPoints, playPoints, toppleBonus, addScores, leaderboard, leftoverPoints } from './score.js';
import { titles } from './engine.js';

let pass = 0, fail = 0;
const ok = (label, got, want = true) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) pass++;
  else { fail++; console.log(`  ไม่ผ่าน: ${label}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`); }
};
const group = (n) => console.log('\n' + n);

group('คะแนนตามอันดับ');
ok('4 คน', rankPoints(titles(['a','b','c','d'])), { a:300, b:200, c:60, d:0 });
ok('6 คน ประชาชนไล่ลงทีละ 10',
   rankPoints(titles(['a','b','c','d','e','f'])), { a:300, b:200, c:100, d:90, e:60, f:0 });
ok('10 คน ประชาชนไม่ต่ำกว่า 60',
   Object.values(rankPoints(titles(['a','b','c','d','e','f','g','h','i','j'])))
     .slice(2, 8), [100, 90, 80, 70, 60, 60]);
ok('รอบที่มีการล้ม คิงได้ 200 แทน 300 และคิงเดิมติดลบ 120',
   rankPoints(titles(['a','b','c','d']), 'd'), { a:200, b:200, c:60, d:-120 });
ok('รอบที่ไม่มีการล้ม คิงได้เต็ม 300', rankPoints(titles(['a','b','c','d'])).a, 300);

group('คะแนนจากการลงไพ่');
ok('เดี่ยว 5 คะแนน', playPoints(1), 5);
ok('คู่ 10 คะแนน', playPoints(2), 10);
ok('ตองไล่ 1 ถึง 8 ครั้ง',
   [1,2,3,4,5,6,7,8].map(n => playPoints(3, n)),
   [50, 100, 150, 400, 450, 700, 750, 1000]);
ok('โฟร์ไล่ 1 ถึง 8 ครั้ง',
   [1,2,3,4,5,6,7,8].map(n => playPoints(4, n)),
   [150, 200, 250, 600, 650, 1000, 1050, 1400]);
ok('ครั้งที่ 5 กับ 7 ไต่ปกติ ไม่ได้โบนัส',
   playPoints(3, 5) - playPoints(3, 4), 50);

group('โบนัสล้มคิง');
ok('ควีนล้ม', toppleBonus('queen'), 50);
ok('ประชาชนล้ม', toppleBonus('people'), 100);
ok('รองสลาฟล้ม', toppleBonus('viceSlave'), 150);
ok('สลาฟล้ม', toppleBonus('slave'), 250);
ok('สลาฟล้มคิงแล้วเป็นคิงเอง ได้รวม 450', 200 + toppleBonus('slave'), 450);

group('แต้มกำลังใจของคนที่เล่นไม่จบ');
ok('เหลือ 0 ใบ ไม่ได้อะไร', leftoverPoints(0), 0);
ok('เหลือ 1 ใบ ยังไม่ถึงเกณฑ์', leftoverPoints(1), 0);
ok('เหลือ 2 ใบ ได้ 5', leftoverPoints(2), 5);
ok('เหลือ 7 ใบ ได้ 15', leftoverPoints(7), 15);
ok('เหลือ 13 ใบ ได้ 30', leftoverPoints(13), 30);

group('กระเป๋าคะแนน');
ok('บวกทบของเดิม', addScores({ a: 100 }, { a: 50, b: 20 }), { a: 150, b: 20 });
ok('เรียงจากมากไปน้อย',
   leaderboard({ a: 100, b: 900, c: 400 }).map(x => x.uid), ['b', 'c', 'a']);

console.log(`\n${'─'.repeat(46)}\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);
process.exit(fail ? 1 : 0);
