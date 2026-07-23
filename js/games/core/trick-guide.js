/* trick-guide.js — กติกาที่ใช้ร่วมกันทุกเกมในตระกูลสลาฟ
   เกมแต่ละตัวเอาไปต่อท้ายด้วยหัวข้อ "ต่างจากพื้นฐานตรงไหน" ของตัวเอง
   เก็บเป็นข้อมูล ไม่ใช่ HTML หน้าจอจะได้จัดรูปแบบเองได้ */

export const TRICK_GUIDE = {
  th: [
    {
      h: 'เป้าหมาย',
      p: ['ทิ้งไพ่ในมือให้หมดก่อนคนอื่น คนที่เหลือคนสุดท้ายเป็นสลาฟ']
    },
    {
      h: 'ลำดับไพ่',
      p: [
        'แต้มจากเล็กไปใหญ่ 3 4 5 6 7 8 9 10 J Q K A 2 — เลข 2 ใหญ่ที่สุด เลข 3 เล็กที่สุด',
        'ดอกจากเล็กไปใหญ่ ดอกจิก ข้าวหลามตัด โพแดง โพดำ',
        'เทียบแต้มก่อนเสมอ แต้มเท่ากันจึงเทียบดอกที่สูงที่สุดในชุด'
      ]
    },
    {
      h: 'การลงไพ่',
      p: [
        'กองแบ่งเป็นสองสาย — สายคี่ลง 1 หรือ 3 ใบ สายคู่ลง 2 หรือ 4 ใบ',
        'กองเริ่มด้วยสายไหน ทั้งกองต้องลงสายนั้น ข้ามสายไม่ได้',
        'ไพ่ในชุดเดียวกันต้องแต้มเดียวกันทั้งหมด',
        'ตอง (3 ใบ) ชนะไพ่เดี่ยวเสมอไม่ว่าแต้มอะไร · โฟร์ (4 ใบ) ชนะไพ่คู่เสมอ'
      ]
    },
    {
      h: 'การเล่นในหนึ่งกอง',
      p: [
        'รอบแรก คนถือดอกจิก 3 เป็นคนเริ่ม และต้องลงใบนั้นในกองแรก',
        'คนถัดไปต้องลงชุดที่มีค่าสูงกว่า ถ้าลงไม่ได้หรือไม่อยากลงให้ผ่าน',
        'ผ่านแล้วออกจากกองนั้นเลย กลับมาลงอีกไม่ได้แม้จะมีไพ่ที่ลงได้',
        'ทุกคนผ่านหมด คนที่ลงล่าสุดชนะกอง เคลียร์กองแล้วเริ่มกองใหม่ ลงอะไรก็ได้',
        'คนเริ่มกองใหม่จะผ่านไม่ได้ ต้องลงอะไรสักอย่าง'
      ]
    },
    {
      h: 'การกลับทิศ',
      p: [
        'ถ้าคนที่ชนะกองหมดไพ่ไปแล้ว ทิศการวนจะกลับด้าน แล้วค่อยเลือกคนถัดไปในทิศใหม่'
      ]
    },
    {
      h: 'อันดับเมื่อจบรอบ',
      p: [
        'คนหมดไพ่ออกจากการเล่นทันที แต่รอบยังไม่จบจนกว่าจะเหลือคนสุดท้าย',
        'เรียงตามลำดับที่หมดไพ่ — คิง ควีน ประชาชน รองสลาฟ สลาฟ',
        'เล่น 4 คนจะไม่มีประชาชน'
      ]
    },
    {
      h: 'การแลกไพ่รอบถัดไป',
      p: [
        'คิงแลกกับสลาฟ 2 ใบ · ควีนแลกกับรองสลาฟ 1 ใบ',
        'ฝั่งล่างต้องยกไพ่ที่ดีที่สุดให้ เลือกเองไม่ได้ ระบบหยิบให้',
        'ฝั่งบนคืนใบไหนก็ได้ตามใจ',
        'ยิ่งแพ้ยิ่งเสียเปรียบรอบหน้า นี่คือหัวใจของเกม'
      ]
    },
    {
      h: 'การเริ่มรอบถัดไป',
      p: [
        'สลาฟเป็นคนเริ่ม ลงอะไรก็ได้',
        'ทิศการวนใช้แบบหนีคิง คือทิศที่กว่าจะถึงตาคิงนานที่สุด',
        'ถ้าสองทิศระยะเท่ากันให้วนทวนเข็ม'
      ]
    },
    {
      h: 'การล้มคิง',
      p: [
        'ถ้าใครหมดไพ่ก่อนคิง คนนั้นเป็นคิงใหม่ทันที',
        'คิงเดิมตกเป็นสลาฟทันที ทิ้งไพ่ในมือและออกจากรอบนั้นเลย',
        'ในโหมดไม่รู้จบ คิงที่โดนล้มติดลบ 200 คะแนน ส่วนคนล้มได้โบนัสตามอันดับเดิมของตัวเอง'
      ]
    },
    {
      h: 'โหมดการเล่น',
      p: [
        'ปกติ — เล่นสองรอบจบ คิงของรอบสองเป็นผู้ชนะ',
        'ไม่รู้จบ — จบรอบแล้วโหวต ต้องเห็นตรงกันทุกคนถึงเล่นต่อ มีระบบคะแนนสะสม'
      ]
    },
    {
      h: 'คะแนนในโหมดไม่รู้จบ',
      p: [
        'อันดับ — คิง 500 · ควีน 300 · ประชาชน 150 ลดลงคนละ 20 แต่ไม่ต่ำกว่า 80 · รองสลาฟ 50 · สลาฟ 0',
        'ลงไพ่ — เดี่ยว 5 · คู่ 10 · ตอง 50 ขึ้นไป · โฟร์ 150 ขึ้นไป',
        'ตองหรือโฟร์ที่ลงทับกันในกองเดียว คะแนนไต่ขึ้นเรื่อย ๆ และครั้งที่ 4, 6, 8 ได้โบนัสก้อนใหญ่'
      ]
    }
  ],

  en: [
    {
      h: 'Goal',
      p: ['Shed your whole hand before anyone else. The last player left is the slave.']
    },
    {
      h: 'Card order',
      p: [
        'Ranks low to high: 3 4 5 6 7 8 9 10 J Q K A 2 — the 2 is highest, the 3 is lowest',
        'Suits low to high: clubs, diamonds, hearts, spades',
        'Rank is compared first; only on a tie does the highest suit in the set decide'
      ]
    },
    {
      h: 'Playing cards',
      p: [
        'A trick is either odd (1 or 3 cards) or even (2 or 4 cards)',
        'Whichever the trick opens with locks it for the whole trick — you cannot switch',
        'Every card in a set must share the same rank',
        'A triple always beats a single, and a four always beats a pair, whatever the rank'
      ]
    },
    {
      h: 'Playing a trick',
      p: [
        'In round one, whoever holds the 3 of clubs leads and must include it',
        'The next player must beat it, or pass',
        'Once you pass you are out of that trick, even if you could have played',
        'When everyone else has passed, the last player to play wins the trick and leads the next one',
        'Whoever leads a new trick cannot pass — they must play something'
      ]
    },
    {
      h: 'Reversing direction',
      p: [
        'If the trick winner has already run out of cards, the play direction flips before the next leader is chosen'
      ]
    },
    {
      h: 'Positions at the end of a round',
      p: [
        'Players leave as they run out, but the round continues until one player is left',
        'Ordered by who finished first: king, queen, people, vice slave, slave',
        'With 4 players there are no people'
      ]
    },
    {
      h: 'The card swap',
      p: [
        'King swaps 2 cards with the slave; queen swaps 1 with the vice slave',
        'The lower player must hand over their best cards — chosen automatically, no say in it',
        'The upper player gives back whatever they like',
        'Losing costs you next round too. That is the heart of the game.'
      ]
    },
    {
      h: 'Starting the next round',
      p: [
        'The slave leads and may play anything',
        'The direction is whichever way takes longest to reach the king',
        'If both directions are equally long, play goes anticlockwise'
      ]
    },
    {
      h: 'Toppling the king',
      p: [
        'If anyone finishes before the king, they become the new king',
        'The old king drops straight to slave, discards their hand and leaves the round',
        'In endless mode a toppled king loses 200 points, and the toppler gains a bonus based on their own previous position'
      ]
    },
    {
      h: 'Modes',
      p: [
        'Normal — two rounds; the king of round two wins',
        'Endless — vote after each round; everyone must agree to continue. Scores accumulate.'
      ]
    },
    {
      h: 'Scoring in endless mode',
      p: [
        'Positions — king 500, queen 300, people 150 dropping by 20 each but never below 80, vice slave 50, slave 0',
        'Plays — single 5, pair 10, triple 50 and up, four 150 and up',
        'Triples and fours stacked in one trick climb steadily, with a large bonus on the 4th, 6th and 8th'
      ]
    }
  ]
};

/* ต่อหัวข้อของเกมเข้ากับกติกาพื้นฐาน */
export const withExtra = (extra) => ({
  th: [...TRICK_GUIDE.th, ...(extra?.th || [])],
  en: [...TRICK_GUIDE.en, ...(extra?.en || [])]
});
