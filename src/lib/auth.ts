import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser,
  type Auth,
} from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export function onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
  return firebaseOnAuthStateChanged(auth, callback);
}

export { auth };
export type { Auth, FirebaseUser };
