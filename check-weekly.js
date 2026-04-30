const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAL9J9BiJvPkM4zKB1yi-mIliZC0ngpfw0",
  authDomain: "maruti-management.firebaseapp.com",
  projectId: "maruti-management",
  storageBucket: "maruti-management.firebasestorage.app",
  messagingSenderId: "975109116662",
  appId: "1:975109116662:web:6d70fadd33e767f10a92d7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const q = query(collection(db, 'weeklyTests'));
  const s = await getDocs(q);
  s.forEach(d => console.log(d.id, JSON.stringify(d.data())));
  process.exit(0);
}
check();
