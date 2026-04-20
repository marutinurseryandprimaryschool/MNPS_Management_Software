import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser,
  type Auth,
} from 'firebase/auth';
import { auth } from './firebase';

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export function onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
  return firebaseOnAuthStateChanged(auth, callback);
}

export { auth };
export type { Auth, FirebaseUser };
