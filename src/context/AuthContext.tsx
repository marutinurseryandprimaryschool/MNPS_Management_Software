'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserRole } from '@/types/enums';
import { User, Student } from '@/types/models';
import { auth, db } from '@/lib/firebase';
import { signInWithGoogle } from '@/lib/auth';
import {
  onAuthStateChanged, signOut, signInWithCustomToken, type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { linkGoogleParent, parentData, parentLogin, ParentApiError } from '@/lib/parent-api';
import { isParentClaims } from '@/lib/parent-portal/core';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  /** Parent role only: the children this session may see (from the API). */
  parentChildren: Student[];
}

interface AuthContextType extends AuthState {
  login: () => Promise<void>;
  loginAsParent: (code: string, dob: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Error policy (docs/designs/principal-role-fees-accounts.md, Addendum issue 1):
// map FirebaseError codes to user-visible messages; never fail silently.
function mapFirestoreError(
  err: unknown,
  permissionDeniedMessage: string,
  fallback: string
): string {
  const code = (err as { code?: string })?.code;
  if (code === 'permission-denied') {
    return `${permissionDeniedMessage} Please refresh the app and try again, or contact the school admin.`;
  }
  if (code === 'unavailable') {
    return 'Connection lost — nothing was saved. Check your internet connection and retry.';
  }
  return fallback;
}

// Shown when a Google account matches no staff invite and no student's email.
// Almost always a parent who pressed "Sign in with Google" on the Staff tab,
// so the login page reads this exact string to switch them to Parent Login.
export const PARENT_LOGIN_HINT =
  'This Google account is not registered with the school. Parents: use the Parent Login tab with the last 4 digits of your registered phone number and your child\'s date of birth.';

const signedOut: AuthState = { user: null, role: null, loading: false, error: null, parentChildren: [] };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...signedOut, loading: true });

  /**
   * Parent sessions are recognised by the custom claims the server put on the
   * token (role + studentIds), never by a Firestore users doc or localStorage.
   * The children come from /api/parent-data, which only ever returns the
   * students named in those claims.
   */
  const enterParentSession = useCallback(async (firebaseUser: FirebaseUser, studentIds: string[]) => {
    const me = await parentData<{ children: Student[] }>('me');
    const kids = me.children || [];
    const first = kids[0];
    setState({
      user: {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        role: UserRole.PARENT,
        name: first ? `Parent of ${first.name}` : 'Parent',
        email: firebaseUser.email || first?.email || '',
        phone: first?.phone || '',
        photo: firebaseUser.photoURL || '',
        status: 'active',
        studentId: studentIds[0],
        studentIds,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      role: UserRole.PARENT,
      loading: false,
      error: null,
      parentChildren: kids,
    });
  }, []);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setState(signedOut);
        return;
      }
      try {
        // 0. Parent claims on the token → parent session, no Firestore reads.
        const tokenResult = await firebaseUser.getIdTokenResult();
        if (isParentClaims(tokenResult.claims)) {
          await enterParentSession(firebaseUser, tokenResult.claims.studentIds);
          return;
        }

        // 1. Check if user already has a profile by UID
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          if (userData.role === UserRole.PARENT) {
            // A parent doc without claims (legacy Google parent, or a mirror the
            // server wrote): (re)pin the claims, then enter through them.
            await linkThisGoogleAccountAsParent(firebaseUser, enterParentSession, setState);
            return;
          }
          setState({
            user: { ...userData, id: firebaseUser.uid, uid: firebaseUser.uid },
            role: userData.role,
            loading: false,
            error: null,
            parentChildren: [],
          });
          return;
        }

        // 2. User doc doesn't exist yet — check if ANY users exist (first user = admin)
        const { limit } = await import('firebase/firestore');
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));

        if (usersSnap.empty) {
          // First-user bootstrap: inert under the new Firestore rules — fresh installs seed the first admin via the Firebase console.
          // First user ever — make them admin
          const newUser: Record<string, unknown> = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            role: UserRole.ADMIN,
            name: firebaseUser.displayName || 'Admin',
            email: firebaseUser.email || '',
            phone: '',
            photo: firebaseUser.photoURL || '',
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          await setDoc(userDocRef, newUser);

          // Also create a default school doc
          const schoolDocRef = doc(db, 'school', 'main');
          const schoolSnap = await getDoc(schoolDocRef);
          if (!schoolSnap.exists()) {
            await setDoc(schoolDocRef, {
              id: 'main',
              name: 'Maruti Nursery & Primary School',
              address: '',
              phone: '',
              email: firebaseUser.email || '',
              logo: '/MARUTI.png.bv.webp',
              academicYear: '2026-27',
              plan: 'standard',
              settings: {
                admissionPrefix: 'MNS',
                periodsPerDay: 8,
                schoolDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
                periodTimings: [
                  { period: 1, start: '08:30', end: '09:15' },
                  { period: 2, start: '09:15', end: '10:00' },
                  { type: 'break', label: 'Short Break', start: '10:00', end: '10:20' },
                  { period: 3, start: '10:20', end: '11:05' },
                  { period: 4, start: '11:05', end: '11:50' },
                  { type: 'lunch', label: 'Lunch Break', start: '11:50', end: '12:30' },
                  { period: 5, start: '12:30', end: '13:15' },
                  { period: 6, start: '13:15', end: '14:00' },
                  { period: 7, start: '14:00', end: '14:45' },
                  { period: 8, start: '14:45', end: '15:30' },
                ],
                maxConsecutivePeriods: 3,
              },
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          setState({
            user: {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              role: UserRole.ADMIN,
              name: firebaseUser.displayName || 'Admin',
              email: firebaseUser.email || '',
              phone: '',
              photo: firebaseUser.photoURL || '',
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            role: UserRole.ADMIN,
            loading: false,
            error: null,
            parentChildren: [],
          });
          return;
        }

        // 1b. No UID-keyed doc — check by email (handles pre-registered users)
        const emailQuery = query(
          collection(db, 'users'),
          where('email', '==', firebaseUser.email)
        );
        const emailSnap = await getDocs(emailQuery);
        const existingDoc = emailSnap.docs[0]; // first match

        if (existingDoc) {
          // Found existing user doc by email — migrate to UID-keyed doc
          const existingData = existingDoc.data();

          const mergedUser: Record<string, unknown> = {
            ...existingData,
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            name: existingData.name || firebaseUser.displayName || '',
            email: firebaseUser.email || existingData.email || '',
            photo: firebaseUser.photoURL || existingData.photo || '',
            status: 'active',
            updatedAt: serverTimestamp(),
          };

          // Atomically swap the pending pre-registration doc for a UID-keyed
          // active doc. A batch ensures we never end up with both (the old
          // duplicate-row bug in User Management). `migratedFrom` lets the
          // Firestore rules verify the pending invite this doc came from.
          if (existingDoc.id !== firebaseUser.uid) {
            const batch = writeBatch(db);
            batch.set(doc(db, 'users', firebaseUser.uid), {
              ...mergedUser,
              migratedFrom: existingDoc.id,
            });
            batch.delete(doc(db, 'users', existingDoc.id));
            try {
              await batch.commit();
            } catch (batchErr) {
              // Deliberately NO silent setDoc fallback (R1 security decision):
              // a denied batch means the pending invite could not be verified
              // by the rules. Surface it and sign the user out.
              console.error('Staff first-login migration batch failed', {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                pendingDocId: existingDoc.id,
                code: (batchErr as { code?: string })?.code,
                error: batchErr,
              });
              const batchCode = (batchErr as { code?: string })?.code;
              await signOut(auth);
              setState({
                ...signedOut,
                error: batchCode === 'unavailable'
                  ? 'Connection lost — sign-in was not completed. Check your internet connection and try again.'
                  : 'Your account invite couldn\'t be verified — contact the school admin.',
              });
              return;
            }
          } else {
            await setDoc(doc(db, 'users', firebaseUser.uid), mergedUser);
          }

          setState({
            user: {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              role: existingData.role as UserRole,
              name: existingData.name || firebaseUser.displayName || '',
              email: firebaseUser.email || '',
              phone: existingData.phone || '',
              photo: firebaseUser.photoURL || existingData.photo || '',
              status: 'active',
              createdAt: existingData.createdAt?.toDate?.() || new Date(),
              updatedAt: new Date(),
            },
            role: existingData.role as UserRole,
            loading: false,
            error: null,
            parentChildren: [],
          });
          return;
        }

        // 4. Not a staff account. A parent who signed in with Google is linked
        //    SERVER-SIDE: the API matches the verified email against the
        //    student records and pins parent claims on this account. The
        //    browser never reads the students collection to decide this.
        await linkThisGoogleAccountAsParent(firebaseUser, enterParentSession, setState);
      } catch (error) {
        console.error('Error fetching user data:', {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          code: (error as { code?: string })?.code,
          error,
        });
        setState({
          ...signedOut,
          error: mapFirestoreError(
            error,
            'Sign-in was blocked by the school\'s security rules.',
            'An error occurred while signing in. Please try again.'
          ),
        });
      }
    });

    return () => unsubscribe();
  }, [enterParentSession]);

  const loginAsParent = useCallback(async (code: string, dob: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // The server verifies code + DOB against the student records and mints
      // a token that names ONLY this family's students. Nothing is read from
      // Firestore here, so a wrong code learns nothing about anyone.
      const { token } = await parentLogin(code, dob);
      await signInWithCustomToken(auth, token);
      // onAuthStateChanged → enterParentSession finishes the session.
    } catch (err: unknown) {
      console.error('Parent login error:', (err as Error)?.message);
      const message = err instanceof ParentApiError
        ? err.message
        : 'Parent login failed. Please check your connection and try again.';
      setState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  const login = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await signInWithGoogle();
      // onAuthStateChanged will handle the rest
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
      // Don't show error for popup closed by user
      if (errorMessage.includes('popup-closed-by-user') || errorMessage.includes('cancelled-popup-request')) {
        setState(prev => ({ ...prev, loading: false, error: null }));
        return;
      }
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, []);

  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      // Legacy key from the pre-API parent login; harmless to clear.
      localStorage.removeItem('parent_session');
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const isAdmin = state.role === UserRole.ADMIN;

  return (
    <AuthContext.Provider value={{ ...state, login, loginAsParent, logout, clearError, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Ask the server to pin parent claims on a Google account whose verified
 * email is on a student record. Success → refreshed token → parent session.
 * Failure → signed out with the Parent Login hint; no student data was read.
 */
async function linkThisGoogleAccountAsParent(
  firebaseUser: FirebaseUser,
  enterParentSession: (u: FirebaseUser, studentIds: string[]) => Promise<void>,
  setState: React.Dispatch<React.SetStateAction<AuthState>>,
): Promise<void> {
  try {
    const idToken = await firebaseUser.getIdToken();
    const { studentIds } = await linkGoogleParent(idToken);
    await firebaseUser.getIdToken(true); // pick up the new claims
    await enterParentSession(firebaseUser, studentIds);
  } catch (err) {
    const status = err instanceof ParentApiError ? err.status : 0;
    await signOut(auth);
    setState({
      ...signedOut,
      error: status === 401
        ? PARENT_LOGIN_HINT
        : err instanceof ParentApiError
          ? err.message
          : 'Sign-in could not be completed. Please try again.',
    });
  }
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
