/* net.js — ต่อ Firebase แล้วขอรหัสประจำตัวแบบไม่ระบุตัวตน
   ผู้เล่นไม่เห็นขั้นตอนนี้เลย ไม่มีหน้าสมัคร ไม่มีรหัสผ่าน
   แต่ต้องมี เพราะ Security Rules ต้องรู้ว่า "ใคร" กำลังเขียน
   และเพราะรหัสนี้เองที่ทำให้คนที่รีเฟรชหน้ากลับเข้าที่เดิมได้ */

import { AppError } from './i18n.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

export let db = null;
export let fb = {};
export const me = { uid: null };

export async function connect() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) throw new AppError('err.noConfig');
  if (location.protocol === 'file:') throw new AppError('err.fileProtocol');

  const [{ initializeApp }, a, f] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`)
  ]);

  const app = initializeApp(cfg);
  const auth = a.getAuth(app);
  db = f.getFirestore(app);

  // โหมดเทสหลายคนในเบราว์เซอร์เดียว — เติม ?dev=multi ท้าย URL
  // เก็บ session ไว้ในหน่วยความจำของแท็บนั้น แต่ละแท็บจึงได้ uid ของตัวเอง
  // ห้ามใช้ตอนเทสเรื่องรีเฟรชแล้วกลับเข้าที่นั่งเดิม เพราะรีเฟรช = กลายเป็นคนใหม่
  const multi = new URLSearchParams(location.search).get('dev') === 'multi';
  if (multi) {
    await a.setPersistence(auth, a.inMemoryPersistence);
    console.warn('[dev] โหมดหลายแท็บ — แท็บนี้เป็นผู้เล่นแยกอีกคน รีเฟรชแล้วจะกลายเป็นคนใหม่');
  }

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
      rej(
        e.code === 'auth/configuration-not-found' ? new AppError('err.authNotConfigured')
      : e.code === 'auth/operation-not-allowed'   ? new AppError('err.authAnonDisabled')
      : e.code === 'auth/unauthorized-domain'     ? new AppError('err.unauthorizedDomain', { host: location.hostname })
      : new AppError('err.signInFailed', { msg: e.message })
      );
    });
  });

  me.uid = user.uid;
  return me;
}
