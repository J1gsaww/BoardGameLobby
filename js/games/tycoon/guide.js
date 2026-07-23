/* guide.js — เฉพาะส่วนที่ Tycoon ต่างจากกติกาพื้นฐาน
   ที่เหลืออ่านได้จาก core/trick-guide.js */

export const TYCOON_EXTRA = {
  th: [
    {
      h: 'Tycoon ต่างจากพื้นฐานตรงไหน',
      p: [
        'เล่นได้ 4 คนเป๊ะ ๆ เท่านั้น ไม่มากไม่น้อยกว่านี้',
        'มีโจ๊กเกอร์เพิ่มเข้ามาในสำรับ ตั้งได้ 2, 3 หรือ 4 ใบ ค่าตั้งต้นคือ 2 ใบเท่าเกมต้นฉบับ'
      ]
    },
    {
      h: 'โจ๊กเกอร์ลงเดี่ยว',
      p: [
        'โจ๊กเกอร์ใบเดียวชนะไพ่เดี่ยวทุกใบในสำรับ',
        'มีใบเดียวที่ล้มมันได้ คือ โพดำของแต้มที่อ่อนที่สุดในลำดับตอนนั้น',
        'ปกติแต้มอ่อนสุดคือ 3 ตัวล้มจึงเป็นโพดำ 3',
        'ตอนปฏิวัติแต้มอ่อนสุดคือ 2 ตัวล้มจึงกลายเป็นโพดำ 2',
        'พอถูกล้มแล้ว ไพ่ใบอื่นทับต่อได้ตามปกติ'
      ]
    },
    {
      h: 'โจ๊กเกอร์เป็นไพ่แทน',
      p: [
        'เอาโจ๊กเกอร์ไปเติมชุดได้ คู่ 4 เติมโจ๊กเกอร์อีกใบกลายเป็นตอง 4 ทันที',
        'ตอง 5 เติมโจ๊กเกอร์กลายเป็นโฟร์ 5 ซึ่งทำให้เกิดการปฏิวัติด้วย',
        'เติมเข้าไพ่คนละแต้มไม่ได้'
      ]
    },
    {
      h: 'ลงเลข 8 จบกอง',
      p: [
        'ลงไพ่เลข 8 เมื่อไหร่ กองนั้นจบทันที ไม่ต้องรอให้ใครผ่าน',
        'คนที่ลง 8 ได้เริ่มกองใหม่เองต่อเลย',
        'ใช้ได้ทั้งลงเดี่ยว คู่ ตอง และโฟร์'
      ]
    },
    {
      h: 'ปฏิวัติ',
      p: [
        'เมื่อใดที่มีคนลงโฟร์ (4 ใบ) จะเกิดการปฏิวัติ',
        'ลำดับไพ่กลับหัวทั้งหมด ทั้งแต้มและดอก — จากเดิม 3 ดอกจิกเล็กสุดถึง 2 โพดำใหญ่สุด กลายเป็นตรงข้าม',
        'กติกาชุดใหญ่ชนะชุดเล็กไม่กลับ ตองยังชนะเดี่ยวเหมือนเดิม',
        'ปฏิวัติซ้อนกันได้ไม่จำกัด ลงโฟร์อีกครั้งก็พลิกกลับอีกรอบ',
        'เริ่มรอบใหม่แล้วลำดับกลับมาเป็นปกติเสมอ'
      ]
    }
  ],

  en: [
    {
      h: 'How Tycoon differs',
      p: [
        'Exactly 4 players — no more, no fewer',
        'Jokers are added to the deck: 2, 3 or 4 of them. The default is 2, as in the original game.'
      ]
    },
    {
      h: 'A joker played alone',
      p: [
        'A single joker beats every other single card in the deck',
        'Only one card can take it down: the spade of whichever rank is currently weakest',
        'Normally the weakest rank is 3, so that card is the 3 of spades',
        'Under revolution the weakest rank is 2, so it becomes the 2 of spades',
        'Once the joker has been taken down, play continues normally on top of it'
      ]
    },
    {
      h: 'Jokers as wild cards',
      p: [
        'A joker can fill out a set — a pair of 4s plus a joker becomes a triple of 4s',
        'A triple of 5s plus a joker becomes a four, which also triggers a revolution',
        'You cannot use one to join cards of different ranks'
      ]
    },
    {
      h: 'The eight cut',
      p: [
        'Playing an 8 ends the trick immediately — nobody gets to respond',
        'Whoever played it leads the next trick',
        'It works whether the 8 is played as a single, pair, triple or four'
      ]
    },
    {
      h: 'Revolution',
      p: [
        'Playing four of a kind triggers a revolution',
        'The entire card order flips, ranks and suits alike',
        'Set size is unaffected — a triple still beats a single',
        'Revolutions stack: another four flips it straight back',
        'The order always resets to normal at the start of a new round'
      ]
    }
  ]
};
