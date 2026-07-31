/* guide.js — คู่มือในเกมของ Who the fuq are you (ย่อจาก Guide Book) */

export const WTF_GUIDE = {
  th: [
    { h: 'เป้าหมาย', p: [
      'ทุกคนได้ลามะลับคนละ 1 ตัว ห้ามให้ใครรู้ว่าตัวเองเป็นใคร',
      'พยายามทายลามะของคนอื่นให้ออกจากเกม',
      'ผู้ชนะคือลามะตัวสุดท้ายที่ยังไม่มีใครทายถูก'
    ] },
    { h: 'ลามะกับจุดเด่น', p: [
      'มีลามะ 10 ตัว จุดเด่น 9 ข้อ แต่ละตัวมีจุดเด่น 6–7 ข้อ',
      'ต้องรู้จุดเด่นเฉลี่ยราว 4–5 ข้อถึงจะฟันธงได้ ไม่มีจุดเด่นไหนที่ลามะตัวเดียวถือ',
      'จุดเด่นของทุกคนถูกล็อกไว้ ตรวจย้อนได้ จึงมีเรื่องที่โกหกได้และห้ามโกหก'
    ] },
    { h: 'โกหกได้ / ห้ามโกหก', p: [
      'โกหกได้ — ประกาศตัวตอนต้นเกม, คุยในเฟสเผือก, จะทายใครเป็นอะไร',
      'ห้ามโกหก — เปิดจุดเด่นตัวเอง, ตอบว่ามีจุดเด่น X ไหมเมื่อถูกบังคับ, ตอบว่าใช่ลามะที่ถูกทายไหม'
    ] },
    { h: 'หนึ่งรอบมี 4 เฟส', p: [
      '1) EVENT — 2 คนถัดไปตามที่นั่งเปิดการ์ดคนละใบ (P1 ทันที · P2 เก็บขึ้นมือ · P3 ทั้งวงพร้อมกัน)',
      '2) TALK — เผือกไทม์ ถาม แลกข้อมูล จับพันธมิตร โยนข้อมูลลวง',
      '3) CHALLENGE — ไล่ทีละคน เลือก "แกเป็นใคร" ใส่ใคร หรือข้าม',
      '4) RESET — เช็กว่าใครออก จบเกมหรือยัง แล้วเลื่อนคิวเปิดการ์ดไป 2 คน'
    ] },
    { h: 'แกเป็นใคร (ทาย)', p: [
      'ทายถูก → คนนั้นออกทันที ไม่เปิดไพ่ มีแค่คนทายที่รู้ว่าเป็นตัวอะไร',
      'ทายผิด → ผู้ถูกทายเลือกถามจุดเด่น 1 ข้อ ผู้ทายต้องตอบจริง',
      'ทายได้คนละ 1 ครั้งต่อรอบ · รุมคนเดียวกันได้ · ประกาศ "ข้าม" แล้วหมดสิทธิ์รอบนั้น'
    ] },
    { h: 'ปลายเกม — ดวลเดือด', p: [
      'เหลือ 2 คน คนที่โดนทายถูกทายกลับได้ 1 ครั้งก่อนออก',
      'ทายกลับถูก → เสมอทั้งคู่ · ทายกลับผิด → คนที่ทายถูกก่อนชนะ'
    ] }
  ],
  en: [
    { h: 'Goal', p: [
      'Everyone gets one secret llama — never let anyone learn who you are',
      'Try to guess other players\u2019 llamas to knock them out',
      'The winner is the last llama nobody has guessed correctly'
    ] },
    { h: 'Llamas and traits', p: [
      'Ten llamas, nine traits; each llama has six or seven traits',
      'You need roughly four to five traits to be sure — no trait is unique to one llama',
      'Every llama\u2019s traits are fixed and checkable, which is why some things may be lied about and some may not'
    ] },
    { h: 'Lies allowed / not allowed', p: [
      'Allowed — your opening claim, table talk, and which llama you guess',
      'Not allowed — revealing your own trait, answering whether you have trait X when forced, confirming a correct guess'
    ] },
    { h: 'A round has four phases', p: [
      '1) EVENT — the next two players in seat order each flip a card (P1 now · P2 held · P3 whole table)',
      '2) TALK — open discussion: ask, trade info, form alliances, spread lies',
      '3) CHALLENGE — one by one, choose to challenge someone or skip',
      '4) RESET — see who is out, check for a winner, shift the flip queue by two'
    ] },
    { h: 'The challenge', p: [
      'Correct → that player is out at once, cards unseen; only the guesser knows what they were',
      'Wrong → the target picks one trait to ask about, and you must answer truthfully',
      'One challenge per player per round · piling on one player is allowed · saying "skip" ends your turn'
    ] },
    { h: 'Endgame — the final duel', p: [
      'With two left, a correctly guessed player may guess back once before leaving',
      'Guess back right → a draw · guess back wrong → the first correct guesser wins'
    ] }
  ]
};
