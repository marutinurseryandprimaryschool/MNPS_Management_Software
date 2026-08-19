import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
const app = initializeApp({ apiKey:"AIzaSyAL9J9BiJvPkM4zKB1yi-mIliZC0ngpfw0", authDomain:"maruti-management.firebaseapp.com", projectId:"maruti-management", storageBucket:"maruti-management.firebasestorage.app", messagingSenderId:"975109116662", appId:"1:975109116662:web:6d70fadd33e767f10a92d7" });
await signInAnonymously(getAuth(app));
const db = getFirestore(app);
for (const email of ['sharmijayaram83@gmail.com','thanusivanallaperumal@gmail.com']) {
  const s = await getDocs(query(collection(db,'users'), where('email','==',email)));
  s.forEach(d => console.log(email, '→ role:', d.data().role, '| status:', d.data().status));
  if (s.empty) console.log(email, '→ NOT FOUND');
}
const t = await getDocs(collection(db,'teachers'));
t.forEach(d => { const v=d.data(); if ((v.email||'').toLowerCase()==='sharmijayaram83@gmail.com') console.log('ALSO a teacher record:', v.name, '| id:', d.id); });
console.log('principals total:', (await getDocs(query(collection(db,'users'), where('role','==','principal')))).size);
