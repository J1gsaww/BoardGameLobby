/* die.test.mjs — ตรวจว่าตารางพิกัดลูกเต๋ายังเป็นทรงตันจริง
   รันด้วย  node js/games/wreckers/die.test.mjs

   ตัวเลขในตารางเป็นพิกัดที่คำนวณมาแล้วก๊อปวางไว้ พิมพ์ตกไปตัวเดียว
   ทรงจะบิดโดยไม่มีอะไรฟ้อง หน้าเว็บก็ยังวาดออกมาได้เหมือนเดิม
   ชุดนี้จึงวัดของจริง — จุดยอดห่างจุดกลางเท่ากันไหม แต่ละหน้าอยู่บนระนาบเดียวกันไหม
   ด้านทุกด้านยาวเท่ากันไหม และจุดยอดหนึ่งจุดมีกี่หน้ามาบรรจบ */

import { dieSvg, rollPose, HERO, SIDES, shapeOf } from './die.js';

let pass = 0, fail = 0;
const ok = (label, got, want = true) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) pass++;
  else { fail++; console.log(`  ไม่ผ่าน: ${label}\n    ได้    ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`); }
};
const group = (n) => console.log('\n' + n);
const near = (a, b, eps = 5e-3) => Math.abs(a - b) < eps;

/* ดึงพิกัดกลับจาก SVG ไม่ได้ จึงประกาศตารางซ้ำไว้ตรงนี้
   ถ้าไฟล์จริงถูกแก้แล้วลืมแก้ที่นี่ ชุดทดสอบจะฟ้องทันทีว่าไม่ตรงกัน */
const { readFileSync } = await import('node:fs');
const src = readFileSync(new URL('./die.js', import.meta.url), 'utf8');

function tableOf(sides) {
  const block = src.split(`  ${sides}: {`)[1];
  const v = [...block.split('f: [')[0].matchAll(/\[\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)\]/g)]
    .map(m => [+m[1], +m[2], +m[3]]);
  const f = [...block.split('f: [')[1].split(']\n  }')[0].matchAll(/\[([\d,\s]+)\]/g)]
    .map(m => m[1].split(',').map(Number));
  return { v, f };
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

const SHAPE = { 4: [4, 3, 4], 6: [6, 4, 8], 12: [12, 5, 20] };   // จำนวนหน้า · มุมต่อหน้า · จุดยอด

for (const sides of [4, 6, 12]) {
  const { v, f } = tableOf(sides);
  const [nf, corners, nv] = SHAPE[sides];
  group(`ลูกเต๋า ${sides} หน้า`);

  ok('จำนวนจุดยอด', v.length, nv);
  ok('จำนวนหน้า', f.length, nf);
  ok('ทุกหน้ามีมุมเท่ากัน', f.every(x => x.length === corners));
  ok('ดัชนีทุกตัวมีจุดยอดจริง', f.every(x => x.every(i => i >= 0 && i < nv)));

  ok('จุดยอดทุกจุดห่างจุดกลางเท่ากัน', v.every(p => near(Math.hypot(...p), 1)));

  // ทุกมุมของหน้าเดียวกันต้องอยู่บนระนาบเดียวกัน วัดจากระยะถึงระนาบของสามจุดแรก
  const planar = f.every(idx => {
    const n = cross(sub(v[idx[1]], v[idx[0]]), sub(v[idx[2]], v[idx[0]]));
    const d = dot(n, v[idx[0]]);
    return idx.every(i => near(dot(n, v[i]) - d, 0, 1e-2));
  });
  ok('ทุกหน้าแบนราบ ไม่บิด', planar);

  // ด้านทุกด้านของทรงตันเพลโตยาวเท่ากันหมด
  const edges = f.flatMap(idx => idx.map((i, k) => dist(v[i], v[idx[(k + 1) % idx.length]])));
  ok('ด้านทุกด้านยาวเท่ากัน', edges.every(L => near(L, edges[0])));

  // ทรงตันเพลโตทุกทรง จุดยอดหนึ่งจุดมีสามหน้ามาบรรจบ ยกเว้นทรงแปดหน้ากับยี่สิบหน้า
  const used = {};
  f.forEach(idx => idx.forEach(i => { used[i] = (used[i] || 0) + 1; }));
  ok('ทุกจุดยอดมีสามหน้ามาบรรจบ', Object.values(used), Array(nv).fill(3));
}

group('ท่าทางการทอย');
ok('รายชื่อชนิดครบ', SIDES.sort((a, b) => a - b), [4, 6, 12]);
ok('ชนิดที่ไม่มีตกไปที่ลูกบาศก์', shapeOf(20), 6);
ok('ทอยจบแล้วนิ่งตรงท่านิ่งพอดี', rollPose(1), HERO);
ok('เริ่มทอยหมุนไปไกลกว่าท่านิ่งมาก', rollPose(0).y - HERO.y, 1080);
ok('เกินหนึ่งก็ไม่หมุนเลยท่านิ่ง', rollPose(1.4), HERO);
ok('ท่านิ่งคือหันตรง ไม่เอียง', [HERO.x, HERO.y, HERO.z], [0, 0, 0]);

group('ภาพที่วาดออกมา');
const rolling = dieSvg(12, rollPose(0.4));
const landed = dieSvg(12, HERO, 11);
ok('ระหว่างกลิ้งไม่มีตัวเลขโผล่', !/<text/.test(rolling));
ok('นิ่งแล้วมีตัวเลข', /<text[^>]*>11<\/text>/.test(landed));
const shapes = (svg) => (svg.match(/<polygon/g) || []).length;
ok('ทุกหน้าวาดสองชั้น หน้ากับขอบลบมุม', shapes(landed) % 2, 0);
ok('หน้าที่หันหลังให้กล้องถูกตัดทิ้ง', shapes(landed) / 2 < 12);
ok('หันตรงแล้วยังเห็นห้าเหลี่ยมกลางกับวงแหวนรอบนอกครบ', shapes(landed) / 2, 6);
ok('D6 หันตรงเหลือหน้าเดียว แต่ยังมีขอบลบมุม', shapes(dieSvg(6, HERO, 5)), 2);
ok('D4 หมุนไว้ให้มีหน้าหลักหันเข้ากล้อง', shapes(dieSvg(4, HERO, 3)), 2);
ok('ทุกหน้าได้สีของตัวเอง ไม่ใช่สีเดียวทั้งใบ',
   new Set([...landed.matchAll(/fill="(rgb\([^)]+\))"/g)].map(m => m[1])).size >= 4);

console.log(`\n${'─'.repeat(46)}\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);
process.exit(fail ? 1 : 0);
