/* guide.js — คู่มือในเกมของ Yahhh */

export const YAHHH_GUIDE = {
  th: [
    {
      h: 'สำรับกับการจั่ว',
      p: [
        'สำรับมี 30 ใบ — แต้ม A ถึง 6 คูณดอกห้าอย่าง จิก ข้าวหลามตัด โพแดง โพดำ และดาว',
        'ดอกดาวใส่เข้ามาเพื่อให้แต้มหนึ่งมีครบห้าใบ จะได้ทำ Yahhhhh ได้',
        'ต้นตาจั่วห้าใบจากสำรับที่สับใหม่ทั้งกอง',
        'ล็อกใบที่ชอบไว้แล้วสุ่มใบที่เหลือใหม่ ทำได้อีกสี่รอบ · ใบที่ทิ้งกลับเข้ากองของตานั้น'
      ]
    },
    {
      h: 'กระดานคะแนน',
      p: [
        'มี 14 ช่อง ลงได้ช่องละครั้งเดียวทั้งเกม จึงเล่นคนละ 14 รอบ',
        'จบตาแล้วต้องเลือกลงหนึ่งช่องเสมอ',
        'ลงช่องที่ได้ศูนย์แต้มก็ได้ — เป็นการทิ้งช่องที่ทำไม่ได้ ไม่ใช่ความผิดพลาด',
        'ดอกไม่มีผลกับคะแนน ยกเว้นช่องดอกเหมือนกันช่องเดียว'
      ]
    },
    {
      h: 'คะแนนของแต่ละช่อง',
      p: [
        'A ถึง 6 — รวมแต้มของใบที่เป็นเลขนั้น',
        'คู่ สองคู่ ตอง โฟร์ — รวมแต้มของใบที่เข้าชุด · สองคู่ต้องคนละแต้ม',
        'ดอกเหมือนกัน — รวมแต้มของใบดอกเดียวกัน นับได้ไม่เกินสี่ใบ',
        'ฟูลเฮาส์ 25 แต้ม · เสตรทเรียงห้าใบเต็ม 35 แต้ม · Yahhhhh เหมือนกันทั้งห้าใบ 50 แต้ม'
      ]
    },
    {
      h: 'จบเกม',
      p: [
        'เกมจบเมื่อทั้งสองคนลงครบทั้ง 14 ช่อง',
        'รวมคะแนนทุกช่อง ใครมากกว่าชนะ เท่ากันคือเสมอ'
      ]
    }
  ],
  en: [
    {
      h: 'The deck and the draw',
      p: [
        'Thirty cards — ranks A to 6 across five suits: clubs, diamonds, hearts, spades and stars',
        'The star suit exists so every rank has five cards, which makes Yahhhhh possible',
        'Each turn starts by drawing five from a freshly shuffled deck',
        'Lock the cards you like and reroll the rest, four more times. Discards go back into that turn\u2019s deck'
      ]
    },
    {
      h: 'The score sheet',
      p: [
        'Fourteen rows, each usable once per game, so you play fourteen rounds each',
        'You must fill exactly one row at the end of every turn',
        'Scoring zero in a row is allowed — it is how you spend a row you cannot fill',
        'Suits do not affect scoring, except in the one row that asks for them'
      ]
    },
    {
      h: 'What each row pays',
      p: [
        'A to 6 — the total of the cards of that rank',
        'Pair, two pair, three and four of a kind — the total of the cards in the set. Two pair must be different ranks',
        'Same suit — the total of cards sharing one suit, counting at most four of them',
        'Full house 25 · a full five-card straight 35 · Yahhhhh, all five alike, 50'
      ]
    },
    {
      h: 'Ending the game',
      p: [
        'The game ends when both sheets are full',
        'Add every row. The higher total wins, equal totals are a draw'
      ]
    }
  ]
};
