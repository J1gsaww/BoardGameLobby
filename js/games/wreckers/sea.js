/* sea.js — ทะเลเคลื่อนไหวแบบไม่มีรอยต่อ
   ─────────────────────────────────────────────────────────────
   ปัญหา: คลิปวนรอบไหนก็ตามจะมีจังหวะกระตุกตอนกระโดดกลับไปเฟรมแรก

   วิธีแก้: ซ้อนสองชั้นที่เล่นคลิปเดียวกันแต่เหลื่อมกันครึ่งรอบ
   แล้วค่อย ๆ สลับความทึบไปมา ชั้นบนจะทึบพอดีตอนชั้นล่างถึงรอยต่อ
   และจางพอดีตอนตัวเองถึงรอยต่อ ผลคือไม่มีใครเห็นรอยต่อของทั้งคู่

   ใช้วิดีโอเป็นหลักเพราะสั่งเวลาเล่นได้ เลื่อนเฟสให้ห่างครึ่งรอบเป๊ะ ๆ
   ถ้าไม่มีไฟล์วิดีโอจะถอยไปใช้ GIF แทน แต่ GIF สั่งเวลาไม่ได้
   จึงต้องโหลดเป็นก้อนข้อมูลแล้วสร้างสองที่อยู่จากก้อนเดียวกัน
   จะได้สองไทม์ไลน์ที่เดินแยกกันโดยโหลดครั้งเดียว
   ───────────────────────────────────────────────────────────── */

const FADE_MS = 1500;
const GIF_LOOP_MS = 11000;      // ความยาววนของ Ocean.gif วัดมาแล้ว

let timer = null;

export function stopSea() {
  clearInterval(timer);
  timer = null;
}

/* สร้างชั้นทะเลลงในเวที เรียกครั้งเดียวตอนสร้างโครง */
export function mountSea(stage, art) {
  stopSea();

  const a = video(art), b = video(art);
  b.classList.add('over');
  stage.prepend(a, b);

  let started = false;
  const begin = () => {
    if (started) return;
    started = true;
    const d = a.duration || GIF_LOOP_MS / 1000;
    try { b.currentTime = d / 2; } catch { /* ยังโหลดไม่เสร็จ */ }
    b.play?.().catch(() => {});
    drive(() => a.currentTime, d);
  };

  a.addEventListener('loadedmetadata', begin, { once: true });
  a.addEventListener('error', () => useGif(stage, art), { once: true });
  setTimeout(() => { if (!started && a.readyState >= 1) begin(); }, 2500);
}

function video(art) {
  const v = document.createElement('video');
  v.className = 'wr-sea';
  v.autoplay = true; v.muted = true; v.loop = true;
  v.playsInline = true; v.setAttribute('playsinline', '');
  v.preload = 'auto';
  for (const [file, type] of [['Ocean.webm', 'video/webm'], ['Ocean.mp4', 'video/mp4']]) {
    const s = document.createElement('source');
    s.src = art + file; s.type = type;
    v.appendChild(s);
  }
  return v;
}

/* สลับความทึบตามตำแหน่งเวลาของชั้นล่าง
   ชั้นบนทึบตอนชั้นล่างใกล้รอยต่อ (ท้ายคลิปกับต้นคลิป)
   และจางตอนชั้นบนเองใกล้รอยต่อ ซึ่งคือกลางคลิปของชั้นล่างพอดี */
function drive(nowSec, dur) {
  const stageOver = () => document.querySelector('.wr-sea.over');
  timer = setInterval(() => {
    const over = stageOver();
    if (!over) { stopSea(); return; }
    const t = nowSec() % dur;
    over.classList.toggle('lit', t > dur * 0.75 || t < dur * 0.25);
  }, 200);
}

/* ── ทางถอย: ใช้ GIF ─────────────────────────────────────────
   โหลดครั้งเดียวแล้วสร้างสองที่อยู่จากก้อนข้อมูลเดียวกัน
   ถ้าใช้ที่อยู่เดียวกันตรง ๆ เบราว์เซอร์จะเดินไทม์ไลน์พร้อมกัน
   สองชั้นจะแสดงเฟรมเดียวกันเป๊ะ การซ้อนก็ไม่ช่วยอะไรเลย */
async function useGif(stage, art) {
  stage.querySelectorAll('.wr-sea').forEach(el => el.remove());
  try {
    const blob = await (await fetch(art + 'Ocean.gif')).blob();
    const a = img(URL.createObjectURL(blob));
    stage.prepend(a);

    setTimeout(() => {
      const b = img(URL.createObjectURL(blob));   // เริ่มช้ากว่าครึ่งรอบ
      b.classList.add('over');
      stage.prepend(b);
      const t0 = Date.now();
      drive(() => (Date.now() - t0) / 1000 + GIF_LOOP_MS / 2000, GIF_LOOP_MS / 1000);
    }, GIF_LOOP_MS / 2);
  } catch (e) {
    console.warn('[sea] โหลดทะเลไม่ได้', e);
  }
}

function img(src) {
  const el = document.createElement('img');
  el.className = 'wr-sea';
  el.src = src; el.alt = ''; el.draggable = false;
  return el;
}
