/* net.js — ต่อ Firebase แล้วขอรหัสประจำตัวแบบไม่ระบุตัวตน
   ผู้เล่นไม่เห็นขั้นตอนนี้เลย ไม่มีหน้าสมัคร ไม่มีรหัสผ่าน
   แต่ต้องมี เพราะ Security Rules ต้องรู้ว่า "ใคร" กำลังเขียน
   และเพราะรหัสนี้เองที่ทำให้คนที่รีเฟรชหน้ากลับเข้าที่เดิมได้ */

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

export let db = null;
export let fb = {};
export const me = { uid: null };

export async function connect() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) throw new Error('ไม่พบค่า Firebase ใน js/env.js');
  if (location.protocol === 'file:') {
    throw new Error('เปิดผ่าน file:// ไม่ได้\n\nต้องเสิร์ฟผ่าน http — ใช้ GitHub Pages\nหรือรัน  npx serve  ในโฟลเดอร์นี้');
  }

  const [{ initializeApp }, a, f] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`)
  ]);

  const app = initializeApp(cfg);
  const auth = a.getAuth(app);
  db = f.getFirestore(app);

  fb = {
    doc: f.doc, collection: f.collection,
    getDoc: f.getDoc, getDocs: f.getDocs,
    setDoc: f.setDoc, updateDoc: f.updateDoc, deleteDoc: f.deleteDoc,
    onSnapshot: f.onSnapshot, serverTimestamp: f.serverTimestamp,
    writeBatch: f.writeBatch, runTransaction: f.runTransaction
  };

  const user = await new Promise((res, rej) => {
    const stop = a.onAuthStateChanged(auth, u => { if (u) { stop(); res(u); } });
    a.signInAnonymously(auth).catch(e => {
      stop();
      rej(new Error(e.code === 'auth/operation-not-allowed'
        ? 'ยังไม่ได้เปิด Anonymous sign-in\n\nFirebase console → Authentication\n→ Sign-in method → Anonymous → Enable'
        : e.code === 'auth/unauthorized-domain'
          ? `โดเมนนี้ยังไม่ได้รับอนุญาต\n\nAuthentication → Settings → Authorized domains\n→ เพิ่ม ${location.hostname}`
          : 'เข้าสู่ระบบไม่สำเร็จ: ' + e.message));
    });
  });

  me.uid = user.uid;
  return me;
}
