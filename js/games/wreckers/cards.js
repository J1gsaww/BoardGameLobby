/* cards.js — รายการการ์ดพิเศษที่เลือกใส่เพิ่มได้
   ─────────────────────────────────────────────────────────────
   เก็บชื่อกับคำอธิบายไว้ในไฟล์นี้เลย ไม่ผ่านระบบคีย์ภาษา
   เพราะเป็นเนื้อหาของเกมนี้เกมเดียว และจะได้แก้ข้อความการ์ด
   กับจำนวนใบพร้อมกันในที่เดียว ไม่ต้องไล่แก้สองไฟล์

   count คือจำนวนใบต่อชนิด — Common ชนิดละ 3 · Rare กับ Map ชนิดละ 1
   ───────────────────────────────────────────────────────────── */

export const RARITY = ['common', 'rare', 'map'];

export const RARITY_LABEL = {
  common: { th: 'Common', en: 'Common' },
  rare:   { th: 'Rare',   en: 'Rare' },
  map:    { th: 'Map',    en: 'Map' }
};

/* ── สุ่มชุดการ์ดพิเศษ ──────────────────────────────────────
   นับเป็น "ชุด" ไม่ใช่ "ใบ" เพราะบางชนิดมีหลายใบ
   สุ่ม 6 ชุดอาจได้ 10 ใบก็ได้ ขึ้นกับว่าจับได้ชนิดไหน

   ข้อจำกัดเพื่อความสมดุล: ถ้าจับได้ **เกยตื้น** ต้องมี **ผลัดเวร** กับ
   **Anthemoessa** ติดมาด้วยเสมอ เพราะเกยตื้นทำให้เกาะมีสี่กล่องได้
   ซึ่งเปลี่ยนสมดุลตอนโหวตบนเกาะไปเลย สองใบนั้นเป็นทางแก้ที่ทำให้ยังเล่นได้
   แต่สองใบนั้นอยู่เดี่ยว ๆ ได้ ไม่ต้องมีเกยตื้น */
export const NEEDS_WITH = { aground: ['relief', 'anthemoessa'] };

export function randomSets(n, rng = Math.random) {
  const ids = [...new Set(EXTRA_CARDS.map(c => c.id))];
  const bag = [...ids];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }

  const out = bag.slice(0, Math.min(n, bag.length));

  /* ใบที่ต้องมีคู่หู — สลับใบที่ไม่เกี่ยวออกไปให้ ไม่ใช่เติมจนเกินจำนวนที่ขอ */
  for (const [lead, mates] of Object.entries(NEEDS_WITH)) {
    if (!out.includes(lead)) continue;
    const locked = new Set([lead, ...mates]);
    for (const mate of mates) {
      if (out.includes(mate)) continue;
      const spot = out.findIndex(id => !locked.has(id));
      if (spot < 0) break;
      out[spot] = mate;
    }
  }
  return out;
}

export const EXTRA_CARDS = [
  /* ── Common ชนิดละ 3 ใบ ─────────────────────────────────── */
  {
    id: 'grapple', rarity: 'common', count: 3,
    th: { name: 'ตะขอเกี่ยว', desc: 'สลับตำแหน่งกับคนที่อยู่ข้างหน้าคุณ ถ้าคุณอยู่หัวแถวอยู่แล้ว ให้สลับกับคนสุดท้ายของแถวแทน · ถ้าคุณอยู่คนเดียวในที่นั้น ตะขอเกี่ยวไม่ติดอะไรเลย คุณโดน Maroon' },
    en: { name: 'Grapple Hook', desc: 'Swap places with the player ahead of you. If you are already first, swap with the last player in the queue instead. If you stand there alone, the hook catches nothing and you are marooned.' }
  },
  {
    id: 'bilgerat', rarity: 'common', count: 2,
    th: { name: 'หนูท้องเรือ', desc: 'ย้ายกล่องสมบัติในสถานที่ที่คุณอยู่ 1 กล่อง จากฝั่งประเทศหนึ่งไปอีกฝั่ง ใช้ได้ทั้งบนเรือและบนเกาะ' },
    en: { name: 'Bilge Rat', desc: 'Move one cargo box where you are from one nation\u2019s side to the other \u2014 works on a ship or on the island.' }
  },
  {
    id: 'whisper', rarity: 'common', count: 2,
    th: { name: 'The Whisper', desc: 'ติดอยู่กับตัวคุณ · การโหวตครั้งถัดไปที่คุณมีสิทธิ์ร่วม จะมีไพ่จากกองกลางเข้าหม้อเพิ่มอีก 1 ใบ ทำงานเอง เลือกใช้ไม่ได้ · ติดซ้อนกันหลายใบได้ นับเพิ่มใบละ 1' },
    en: { name: 'The Whisper', desc: 'Stays with you. The next vote you may join draws one extra card from the central pile into the pot. It works on its own \u2014 you cannot choose when. Copies stack, one extra card each.' }
  },
  {
    id: 'jettison', rarity: 'common', count: 2,
    th: { name: 'ปล่อยของ', desc: 'ย้ายกล่องสมบัติ 1 กล่องจากเรือใหญ่ลำไหนก็ได้ ไปไว้ที่เรือสินค้า' },
    en: { name: 'Jettison', desc: 'Move one cargo box from either big ship onto the merchant ship.' }
  },
  {
    id: 'contract', rarity: 'common', count: 3,
    th: { name: 'สัญญาฉบับใหม่', desc: 'ทิ้งไพ่โหวตในมือกี่ใบก็ได้ แล้วจั่วขึ้นมาใหม่เท่าจำนวนที่ทิ้ง' },
    en: { name: 'A New Contract', desc: 'Discard any number of vote cards from your hand, then draw that many back.' }
  },
  {
    /* [2026-07-27] ลดจาก 3 เหลือ 2 ใบตามที่ผู้ใช้เคาะ */
    id: 'relief', rarity: 'common', count: 2,
    th: { name: 'ผลัดเวร', desc: 'สลับตำแหน่งกับผู้เล่นที่อยู่ข้างหลังคุณโดยตรง ใช้ถอยลงจากตำแหน่งที่กำลังตกเป็นเป้าได้ · ถ้าคุณอยู่ท้ายแถวอยู่แล้ว ให้สลับกับคนหัวแถวแทน · ถ้าคุณอยู่คนเดียวในที่นั้น ไม่มีใครให้ผลัดเวร คุณโดน Maroon' },
    en: { name: 'Relief Watch', desc: 'Swap places with the player directly behind you \u2014 a way to step down from a position under threat. If you are already last in line, swap with the player at the front instead. If you stand there alone, there is nobody to relieve you and you are marooned.' }
  },

  /* ── Rare ชนิดละ 1 ใบ ───────────────────────────────────── */
  {
    id: 'holdmutiny', rarity: 'rare', count: 1,
    th: { name: 'กบฏใต้ท้องเรือ', desc: 'สั่งโหวตก่อกบฏได้ทันทีไม่ว่าจะยืนตำแหน่งไหน · บนเรือ ถ้าผ่านกัปตันเด้งลงเกาะและคุณขึ้นเป็นกัปตัน · บนเกาะ ถ้าผ่านคุณขึ้นเป็นประธานเกาะแทนคนเดิม' },
    en: { name: 'Mutiny in the Hold', desc: 'Call a mutiny vote from any position. On a ship, if it passes the Captain is marooned and you take the helm. On the island, if it passes you replace the President.' }
  },
  {
    id: 'wreckers', rarity: 'rare', count: 1,
    th: { name: 'พวกล่อเรือ', desc: 'สั่งเรือใหญ่ทั้งสองลำยิงแข่งกัน · ลำที่ยิงสำเร็จฝ่ายเดียวชิงกล่องจากอีกลำ 2 ใบ · เสมอกัน (สำเร็จทั้งคู่หรือพลาดทั้งคู่) กล่องของทั้งสองลำกลับไปเรือสินค้า โดยลูกเรือคนท้ายสุดของแต่ละลำเลือกเองว่าจะคืนฝั่งประเทศไหน · ลำที่ว่างเปล่าถือว่าอีกลำยิงฟรี · ว่างทั้งสองลำ ให้สองคนท้ายสุดของเกาะเลือกแทน คนท้ายสุดเลือกลำขวา คนรองสุดท้ายเลือกลำซ้าย' },
    en: { name: 'The Wreckers', desc: 'Both big ships open fire at once. A ship that lands its shot alone takes two boxes from the other. If they tie \u2014 both hit or both miss \u2014 every box on both ships returns to the merchant, and the last crew member aboard each ship chooses which nation side to give up. An empty ship means the other fires unopposed. If both are empty, the last two ashore choose instead: last picks the right ship, second to last picks the left.' }
  },
  {
    id: 'vegan', rarity: 'rare', count: 1,
    th: { name: 'มังสวิรัส', desc: 'ทุกคนโดน Maroon ก่อน แล้วจึงเก็บ Albatross ที่ติดตัวอยู่ทุกใบกลับเข้ากองแล้วสับใหม่ ไม่รวมการ์ด 5 ใบล่างสุด · ถ้าไม่มีใครอยู่บนเกาะเลย ให้เรือทั้งสองลำยิงแข่งกันก่อน ลำที่ชนะได้ลงเกาะก่อน เสมอกันให้สุ่มลำดับทั้งหมด' },
    en: { name: 'Vegetarian', desc: 'Everyone is marooned first, then every Albatross attached to a player returns to the deck and it is shuffled \u2014 excluding the bottom five cards. If nobody is ashore, the two ships fire against each other first: the winning ship goes ashore first, and on a tie the whole order is random.' }
  },
  {
    id: 'shipwreck', rarity: 'rare', count: 1,
    th: { name: 'เรือล่ม', desc: 'ทุกคนบนเรือลำเดียวกันตกลงเกาะ · ถ้าเปิดตอนอยู่บนเกาะ ทุกคนที่อยู่บนเกาะเสียไพ่โหวตถาวรคนละ 1 ใบ' },
    en: { name: 'Shipwreck', desc: 'The ship goes down \u2014 everyone aboard is marooned to the island. Flipped on the island instead, every player on the island permanently loses one vote card.' }
  },
  {
    id: 'blackflag', rarity: 'rare', count: 1,
    th: { name: 'ธงดำ', desc: 'เปิดบนเรือ สั่งโหวตโจมตีได้ทันทีโดยไม่ต้องเป็นกัปตัน · เปิดบนเกาะ สั่งโหวตย้ายกล่องได้ทันทีโดยไม่ต้องเป็นผู้ว่าฯ' },
    en: { name: 'Black Flag', desc: 'Flipped on a ship, call an attack vote without being Captain. Flipped on the island, call a cargo vote without being Governor.' }
  },
  {
    id: 'treasurehunt', rarity: 'rare', count: 1,
    th: { name: 'ล่าสมบัติ', desc: 'เปิดการ์ด 3 ใบบนสุดของกอง เอาไว้ 1 ใบ ที่เหลือวางกลับเรียงตามใจ · ใบที่เอาไว้ทำงานทันทีเว้นแต่เขียนกำกับว่าเก็บได้' },
    en: { name: 'Treasure Hunt', desc: 'Reveal the top three cards, take one, put the rest back in any order. The one you take resolves at once unless it says it can be held.' }
  },
  {
    id: 'aground', rarity: 'rare', count: 1,
    th: { name: 'เกยตื้น', desc: 'แบ่งกล่องบนเรือสินค้าลงเรือใหญ่สองลำเท่า ๆ กัน เศษที่เหลือคงไว้บนเรือสินค้า · ถ้าเรือสินค้าว่างอยู่แล้ว ให้ย้ายกล่องจากเรือใหญ่ไปไว้บนเกาะประเทศละ 1 กล่อง' },
    en: { name: 'Aground', desc: 'Split the merchant\u2019s cargo evenly between both big ships, leaving any remainder aboard. If the merchant is already empty, move one box of each nation from the big ships onto the island instead.' }
  },
  {
    id: 'doldrums', rarity: 'rare', count: 1,
    th: { name: 'ลมสงบ', desc: 'ตลอดรอบนี้ ห้ามใครสั่งโหวตชนิดใดก็ตาม ไม่ว่าจะอยู่ที่ไหนบนกระดาน' },
    en: { name: 'Doldrums', desc: 'For the rest of this round, no vote of any kind may be called anywhere on the board.' }
  },

  /* ── Map ชนิดละ 1 ใบ — เปิดแล้วต้องยกให้คนอื่นเสมอ ───────── */
  {
    id: 'lyonesse', rarity: 'map', count: 1,
    th: { name: 'Lyonesse', desc: 'ลงระหว่างการโหวต ดูไพ่ทั้งหมดในหม้อก่อนนับ แล้วทิ้ง 1 ใบที่เลือกเอง' },
    en: { name: 'Lyonesse', desc: 'Play during a vote: look at the whole pot before counting, then discard one card of your choice.' }
  },
  {
    id: 'anthemoessa', rarity: 'map', count: 1,
    th: { name: 'Anthemoessa', desc: 'เลือกผู้เล่น 1 คนจากตรงไหนก็ได้บนกระดาน ให้เข้ามาร่วมโหวตรอบนี้ด้วย' },
    en: { name: 'Anthemoessa', desc: 'Choose any one player anywhere on the board \u2014 they join this vote.' }
  }
];

export const cardById = (id) => EXTRA_CARDS.find(c => c.id === id) || null;

/* จำนวนใบรวมของชุดที่เลือกไว้ */
export const countOf = (ids) =>
  (ids || []).reduce((sum, id) => sum + (cardById(id)?.count || 0), 0);

export const ALL_IDS = EXTRA_CARDS.map(c => c.id);
export const TOTAL_EXTRA = countOf(ALL_IDS);
