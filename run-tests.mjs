/* run-tests.mjs — รันชุดทดสอบ
   ─────────────────────────────────────────────────────────────
     node run-tests.mjs             ทั้งหมด แบบย่อ
     node run-tests.mjs wreckers    เฉพาะเกมนั้น (ตัวตรวจกลางยังรันเสมอ)
     node run-tests.mjs -v          เต็ม เห็นทุกหัวข้อ

   ไล่หาไฟล์ `*.test.mjs` เองทั้งโฟลเดอร์ ไม่มีรายชื่อให้ลืมเติม
   ของเดิมเป็นรายชื่อเขียนมือ พอเพิ่มเทสใหม่แล้วลืมเติมก็เท่ากับไม่มีเทส */
import { execFileSync } from 'node:child_process';
import { globSync } from 'node:fs';

const args = process.argv.slice(2);
const loud = args.includes('-v');
const only = args.find(a => !a.startsWith('-'));

/* ตัวตรวจกลางไม่ผูกกับเกมไหน จึงรันทุกครั้งแม้กรองเกมแล้ว
   เพราะเลขรุ่นกับ import ที่พังกระทบทั้งเว็บ ไม่ใช่แค่เกมที่กำลังแก้ */
const CHECKS = ['check-build.mjs', 'check-files.mjs', 'check-exports.mjs',
                'check-shell.mjs', 'check-i18n.mjs', 'check-refs.mjs', 'check-art.mjs'];

const tests = globSync('js/**/*.test.mjs').sort();
const groupOf = (f) => f.split('/')[2] || 'อื่น ๆ';

const picked = only ? tests.filter(f => groupOf(f).includes(only) || f.includes(only)) : tests;
if (only && !picked.length) {
  console.log(`ไม่พบเทสของ "${only}" — มีให้เลือก: ${[...new Set(tests.map(groupOf))].join(' · ')}`);
  process.exit(1);
}

const OK = '\u2713', NO = '\u2717';
let bad = 0, pass = 0, fail = 0;

function run(file, label) {
  let out = '', ok = true;
  try { out = execFileSync(process.execPath, [file], { encoding: 'utf8' }); }
  catch (e) { ok = false; out = (e.stdout || '') + (e.stderr || ''); }

  /* ดึงตัวเลขสรุปจากบรรทัดท้ายของแต่ละไฟล์ จะได้ย่อเหลือบรรทัดเดียวได้ */
  const m = out.match(/ผ่าน (\d+) · ไม่ผ่าน (\d+)/);
  if (m) { pass += +m[1]; fail += +m[2]; if (+m[2]) ok = false; }

  const count = m ? `${m[1]} เคส` : '';
  console.log(`  ${ok ? OK : NO} ${label.padEnd(22)} ${count}`);

  /* เงียบตอนผ่าน พ่นเต็มตอนพังหรือตอนสั่ง -v — ผลที่ยาวเป็นหน้าจอทำให้มองไม่เห็นอันที่พัง */
  if (!ok || loud) console.log(out.split('\n').map(l => '      ' + l).join('\n'));
  if (!ok) bad++;
}

let last = '';
for (const f of picked) {
  const g = groupOf(f);
  if (g !== last) { console.log(`\nเกม ${g}`); last = g; }
  run(f, f.split('/').pop());
}

console.log('\nตัวตรวจทั้งโปรเจกต์');
for (const f of CHECKS) run(f, f.replace('.mjs', ''));

console.log(`\n${'\u2500'.repeat(46)}`);
console.log(bad ? `${NO} ไม่ผ่าน ${bad} ไฟล์ · เคสที่ตก ${fail}` : `${OK} ผ่านทั้งหมด · ${pass} เคส`);
process.exit(bad ? 1 : 0);
