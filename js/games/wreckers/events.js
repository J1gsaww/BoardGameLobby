/* events.js — สำรับการ์ดเหตุการณ์มาตรฐาน 24 ใบ
   ─────────────────────────────────────────────────────────────
   รูปแบบเดียวกับ cards.js ทุกอย่าง ต่างกันแค่ชุดนี้อยู่ในเกมเสมอ
   ส่วน cards.js เป็นชุดที่เลือกใส่เพิ่มได้ในหน้าตั้งค่าห้อง
   รวมกันเป็นสำรับเต็ม 49 ใบ

   count คือจำนวนใบต่อชนิด — Common ชนิดละ 3 · Rare กับ Map ชนิดละ 1
   id ใช้เป็นชื่อไฟล์ภาพด้วย — ประกอบ path ผ่าน cardArt() ข้างล่างเท่านั้น
   จะได้เปลี่ยนโฟลเดอร์หรือนามสกุลทีเดียวจบ ไม่ต้องไล่แก้ทุกที่ที่เรียกใช้

   ยังไม่มีผลของการ์ดในไฟล์นี้ ไฟล์นี้เก็บแค่ตัวตนกับข้อความ
   ผลของแต่ละใบจะไปอยู่ที่ไฟล์ผลการ์ดแยกต่างหาก เพราะบางใบต้องถามผู้เล่นก่อน
   ───────────────────────────────────────────────────────────── */

/* ภาพการ์ด — เจนมาเป็น PNG จึงใช้ PNG ตรง ๆ ไม่แปลงกลางทาง
   ถ้าวันหลังอยากลดขนาดไฟล์ด้วย WebP แก้ที่ CARD_EXT บรรทัดเดียว */
export const CARD_ART = 'assets/game/wreckers/cards/';
export const CARD_EXT = '.png';
export const cardArt = (id) => `${CARD_ART}${id}${CARD_EXT}`;
export const CARD_BACK = cardArt('back');

export const BASE_CARDS = [
  /* ── Common ชนิดละ 3 ใบ (รวม 12) ────────────────────────── */
  {
    id: 'pistol', rarity: 'common', count: 3,
    th: { name: 'ปืนพก', desc: 'Maroon ผู้เล่นคนใดก็ได้ยกเว้นตัวเอง เลือกข้ามเรือข้ามเกาะได้' },
    en: { name: 'Pistol', desc: 'Maroon any player except yourself. Reaches across ships and the island.' }
  },
  {
    id: 'blackspot', rarity: 'common', count: 3,
    th: { name: 'จุดดำ', desc: 'คนที่เปิดใบนี้โดน Maroon ทันที' },
    en: { name: 'Black Spot', desc: 'Whoever flips this card is marooned at once.' }
  },
  {
    id: 'albatross', rarity: 'common', count: 3,
    th: { name: 'นกอัลบาทรอส', desc: 'ติดไก่ไว้กับตัวคุณ ถ้าเรือลำเดียวกันมีไก่ตั้งแต่ 2 ตัวขึ้นไป ทุกคนบนเรือลำนั้นโดน Maroon ตามลำดับผู้เล่น' },
    en: { name: 'Albatross', desc: 'A bird settles on you. If one ship carries two or more birds, everyone aboard is marooned in player order.' }
  },
  {
    id: 'marque', rarity: 'common', count: 3,
    th: { name: 'หนังสือตราตั้ง', desc: 'เก็บไว้กับตัวได้ · ใช้แล้วส่งใครก็ได้จากเกาะหรือเรือเล็กไปต่อท้ายแถวเรือใหญ่ลำไหนก็ได้ นับเป็น Action' },
    en: { name: 'Letter of Marque', desc: 'May be kept in hand. Send any player from the island or a rowboat to the back of either big ship\u2019s queue. Counts as your action.' }
  },

  /* ── Map ชนิดละ 1 ใบ (รวม 3) ────────────────────────────
     เปิดแล้วต้องยกให้คนอื่นเสมอ เก็บเองไม่ได้
     คนที่ได้รับใช้ในเทิร์นตัวเองตอนไหนก็ได้ และไม่นับเป็น Action */
  {
    id: 'fountain', rarity: 'map', count: 1,
    th: { name: 'น้ำพุอมตะ', desc: 'กันการโดน Maroon ได้ 1 ครั้ง ไม่ว่าจะมาจากทางไหน' },
    en: { name: 'Fountain of Youth', desc: 'Prevents one marooning, from any source.' }
  },
  {
    id: 'atlantis', rarity: 'map', count: 1,
    th: { name: 'แอตแลนติส', desc: 'ใช้แทรกตาคนอื่นได้ ย้ายตัวเองไปยืนข้างหลังผู้เล่นที่เลือก คนที่ถูกดันจนล้นความจุโดน Maroon' },
    en: { name: 'Atlantis', desc: 'Play on another player\u2019s turn. Move yourself directly behind them; anyone pushed past the last slot is marooned.' }
  },
  {
    id: 'eldorado', rarity: 'map', count: 1,
    th: { name: 'เอลโดราโด', desc: 'ใช้ขณะโหวต ส่งไพ่เข้าหม้อได้ 2 ใบแทน 1 แต่การโหวตครั้งถัดไปห้ามร่วม' },
    en: { name: 'El Dorado', desc: 'Play during a vote to submit two cards instead of one. You must sit out the next vote.' }
  },

  /* ── Rare ชนิดละ 1 ใบ (รวม 9) ───────────────────────────── */
  {
    id: 'facade', rarity: 'rare', count: 1,
    th: { name: 'หน้ากาก', desc: 'สลับตำแหน่งบนกระดานกับผู้เล่นที่อยู่ทางขวาของคุณ' },
    en: { name: 'Facade', desc: 'Swap board positions with the player to your right.' }
  },
  {
    id: 'eightbell', rarity: 'rare', count: 1,
    th: { name: 'ระฆังแปดครั้ง', desc: 'ทุกคนในสถานที่เดียวกับคุณสุ่มตำแหน่งยืนใหม่ทั้งหมด' },
    en: { name: 'Eight Bells', desc: 'Everyone where you stand is shuffled into new positions.' }
  },
  {
    id: 'crowsnest', rarity: 'rare', count: 1,
    th: { name: 'รังกา', desc: 'สั่งให้ผู้เล่นคนหนึ่งทิ้งไพ่โหวตทั้งมือ แล้วคุณเลือกไพ่จากกองคืนให้เขาตาม Maximum Vote ของเขา' },
    en: { name: 'Crow\u2019s Nest', desc: 'Make one player discard their whole vote hand, then you choose replacements from the pile up to their maximum.' }
  },
  {
    id: 'blackpowder', rarity: 'rare', count: 1,
    th: { name: 'ดินปืน', desc: 'ระเบิดเรือเล็กทิ้ง 1 ลำ ใครอยู่บนลำนั้นโดน Maroon' },
    en: { name: 'Black Powder', desc: 'Blow up one rowboat. Anyone aboard is marooned.' }
  },
  {
    id: 'piratecode', rarity: 'rare', count: 1,
    th: { name: 'ประมวลโจรสลัด', desc: 'คนที่เปิดใบนี้ห้ามร่วมโหวต 2 ครั้ง นับจากตาที่เปิด' },
    en: { name: 'Pirate Code', desc: 'Whoever flips this must sit out the next two votes.' }
  },
  {
    id: 'scurvy', rarity: 'rare', count: 1,
    th: { name: 'ลักปิดลักเปิด', desc: 'ทุกคนในสถานที่เดียวกับคุณถูกข้ามเทิร์น 1 ครั้ง คนเปิดโดนข้ามเทิร์นถัดไปของตัวเอง' },
    en: { name: 'Scurvy', desc: 'Everyone where you stand loses their next turn. You lose yours as well.' }
  },
  {
    id: 'cabinfever', rarity: 'rare', count: 1,
    th: { name: 'บ้าเรือ', desc: 'เลือกผู้เล่นหนึ่งคน เอาไพ่ประเทศของคุณกับของเขามาสับรวมกันแล้วแจกคืนคนละใบ' },
    en: { name: 'Cabin Fever', desc: 'Pick a player. Shuffle your nation card together with theirs and deal one back to each.' }
  },
  {
    id: 'stormyseas', rarity: 'rare', count: 1,
    th: { name: 'ทะเลบ้า', desc: 'กล่องทุกกล่องบนเรือที่คุณอยู่ถูกซัดไปเรือสินค้า ถ้าเปิดบนเกาะ กล่องบนเกาะกลับไปเป็น 1–1' },
    en: { name: 'Stormy Seas', desc: 'Every box on your ship is swept onto the merchant ship. Flipped on the island, island cargo resets to 1\u20131.' }
  },
  {
    id: 'armada', rarity: 'rare', count: 1,
    th: { name: 'กองเรือสเปน', desc: 'เกมจบทันที นับกล่องบนฝั่งประเทศแล้วตัดสินผู้ชนะ' },
    en: { name: 'Spanish Armada', desc: 'The game ends immediately. Count the boxes on each nation\u2019s side and decide the winner.' }
  }
];

/* ใบที่บังคับให้เกมจบ ต้องอยู่ใน 5 ใบล่างสุดของกองเสมอ
   สับกองทั้งใบก่อน แล้วเอา 4 ใบล่างสุดมารวมกับใบนี้ สับเฉพาะห้าใบนั้นแล้ววางกลับใต้สุด
   ผลคือไม่มีใครรู้ว่าเกมจะจบตาไหน แต่รู้ว่าใกล้จบแล้วเมื่อกองบางลง */
export const ENDER = 'armada';
export const ENDER_ZONE = 5;

/* การ์ดที่เปิดแล้วต้องยกให้คนอื่น เก็บเองไม่ได้ */
export const isMap = (card) => card?.rarity === 'map';

export const baseById = (id) => BASE_CARDS.find(c => c.id === id) || null;

/* จำนวนใบรวมของชุดมาตรฐาน — ควรได้ 24 พอดี มีชุดทดสอบคอยยืนยันให้ */
export const BASE_TOTAL = BASE_CARDS.reduce((n, c) => n + c.count, 0);
