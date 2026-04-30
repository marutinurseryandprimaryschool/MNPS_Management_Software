import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAL9J9BiJvPkM4zKB1yi-mIliZC0ngpfw0",
  authDomain: "maruti-management.firebaseapp.com",
  projectId: "maruti-management",
  storageBucket: "maruti-management.firebasestorage.app",
  messagingSenderId: "975109116662",
  appId: "1:975109116662:web:6d70fadd33e767f10a92d7"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
