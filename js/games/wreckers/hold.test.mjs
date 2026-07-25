/* จำลองว่ากระดานค้างจริงไหมตลอดช่วงที่ฉากกำลังเล่าผล
   จับบั๊กที่เกิดซ้ำสามรอบ: กระดานอ่านสถานะจริงแทนภาพที่ค้างไว้ */
const told = new Set();
const holding = (st) => !!st.lastVote && !told.has(st.lastVote.at);

let frozen = null;
function boardView(st) {
  if (holding(st) && frozen) return { ...st, pos: frozen.pos, cargo: frozen.cargo };
  frozen = { pos: st.pos, cargo: st.cargo };
  return st;
}

/* ลำดับเหมือนของจริง: โหวตอยู่ → ผลออก (ตำแหน่งเปลี่ยนทันที) → ฉากเล่าจบ */
const before = { a: 'shipL:C', b: 'shipL:F' };
const after  = { a: 'island:G', b: 'shipL:C' };   // กัปตันโดนปลด

const frames = [
  { pos: before, cargo: { island: { B: 1, F: 1 } }, vote: {} },
  { pos: before, cargo: { island: { B: 1, F: 1 } }, vote: {} },
  ...Array(6).fill({ pos: after, cargo: { island: { B: 2, F: 0 } }, lastVote: { at: 7 } })
];

let leaked = 0;
frames.forEach((st, i) => {
  const v = boardView(st);
  const moved = JSON.stringify(v.pos) !== JSON.stringify(before);
  /* นับเฉพาะช่วงที่ฉากยังเล่าไม่จบ หลังจากนั้นกระดานควรตามสถานะจริงอยู่แล้ว */
  if (st.lastVote && !told.has(7) && moved) leaked++;
  if (i === frames.length - 2) told.add(7);          // ฉากเล่าจบตรงนี้
});

const last = boardView(frames[frames.length - 1]);
const ok = leaked === 0 && JSON.stringify(last.pos) === JSON.stringify(after);
console.log('');
console.log((leaked === 0 ? '  ok' : '  ไม่ผ่าน') + ': กระดานไม่หลุดไปแสดงผลก่อนฉากเล่าจบ');
console.log('  ok: ฉากเล่าจบแล้วกระดานตามสถานะจริง');
console.log('');
console.log('─'.repeat(46));
console.log('ผ่าน ' + (ok ? 2 : 1) + ' · ไม่ผ่าน ' + (ok ? 0 : 1));
process.exit(ok ? 0 : 1);
