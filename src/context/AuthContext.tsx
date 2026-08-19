'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserRole } from '@/types/enums';
import { User, Student } from '@/types/models';
import { auth, db } from '@/lib/firebase';
import { signInWithGoogle } from '@/lib/auth';
import { onAuthStateChanged, signOut, signInAnonymously } from 'firebase/auth';
import {
  doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp, writeBatch
} from 'firebase/firestore';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
    error: null,
  });

  // Listen to Firebase Auth state changes
  useEffect(() => {
    // Check for parent session first
    const savedParent = localStorage.getItem('parent_session');
    if (savedParent) {
      const parentData = JSON.parse(savedParent);
      setState({
        user: parentData,
        role: UserRole.PARENT,
        loading: false,
        error: null,
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // 1. Check if user already has a profile by UID
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setState({
              user: { ...userData, id: firebaseUser.uid, uid: firebaseUser.uid },
              role: userData.role,
              loading: false,
              error: null,
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
                  gradeScale: [
                    { grade: 'A+', min: 90, max: 100 },
                    { grade: 'A', min: 80, max: 89 },
                    { grade: 'B+', min: 70, max: 79 },
                    { grade: 'B', min: 60, max: 69 },
                    { grade: 'C+', min: 50, max: 59 },
                    { grade: 'C', min: 40, max: 49 },
                    { grade: 'D', min: 30, max: 39 },
                    { grade: 'F', min: 0, max: 29 },
                  ],
                  maxPeriodsPerTeacherPerDay: 6,
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
                  user: null,
                  role: null,
                  loading: false,
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
            });
            return;
          }

          // 4. User not pre-registered in 'users' — check 'students' for parent email
          const studentQuery = query(
            collection(db, 'students'),
            where('email', '==', firebaseUser.email)
          );
          const studentSnap = await getDocs(studentQuery);
          
          if (!studentSnap.empty) {
            // Found a matching student — create a PARENT role user
            const parentUser: Record<string, unknown> = {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              role: UserRole.PARENT,
              name: firebaseUser.displayName || 'Parent',
              email: firebaseUser.email || '',
              photo: firebaseUser.photoURL || '',
              status: 'active',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            await setDoc(doc(db, 'users', firebaseUser.uid), parentUser);

            setState({
              user: {
                id: firebaseUser.uid,
                uid: firebaseUser.uid,
                role: UserRole.PARENT,
                name: parentUser.name as string,
                email: parentUser.email as string,
                phone: parentUser.phone as string,
                photo: parentUser.photo as string,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              role: UserRole.PARENT,
              loading: false,
              error: null,
            });
            return;
          }

          // 5. Truly not registered — deny access
          // If anonymous, check if we have a parent session
          if (firebaseUser.isAnonymous) {
            const savedParent = localStorage.getItem('parent_session');
            if (savedParent) {
              const parentData = JSON.parse(savedParent);
              // Ensure the anonymous UID matches or update it
              setState({
                user: { ...parentData, id: firebaseUser.uid, uid: firebaseUser.uid },
                role: UserRole.PARENT,
                loading: false,
                error: null,
              });
              return;
            }
          }

          await signOut(auth);
          setState({
            user: null,
            role: null,
            loading: false,
            error: 'Access denied. Your email is not registered with our school records. Please contact the administrator to update your email in your child\'s profile.',
          });
          return;

        } catch (error) {
          console.error('Error fetching user data:', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            code: (error as { code?: string })?.code,
            error,
          });
          setState({
            user: null,
            role: null,
            loading: false,
            error: mapFirestoreError(
              error,
              'Sign-in was blocked by the school\'s security rules.',
              'An error occurred while signing in. Please try again.'
            ),
          });
        }
      } else {
        setState({
          user: null,
          role: null,
          loading: false,
          error: null,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const loginAsParent = useCallback(async (code: string, dob: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    // Tracks the throwaway session this attempt opened, so a WRONG code does
    // not leave a signed-in credential behind. Reading /students needs a
    // session, so the sign-in genuinely has to happen before the match — but
    // it is revoked the moment the match fails, and firestore.rules grants an
    // uid with no users/{uid} doc nothing in the Principal Register anyway.
    let openedSession = false;
    try {
      // 0. Sign in anonymously if not already authenticated to satisfy security rules
      if (!auth.currentUser) {
        await signInAnonymously(auth);
        openedSession = true;
      }

      // 1. Get all students to find a match
      const snap = await getDocs(collection(db, 'students'));
      const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Find student matching last 4 digits of phone and DOB (DDMMYYYY)
      const match = (students as unknown as Student[]).find((s: Student) => {
        if (!s.phone || !s.dob) return false;
        
        // Clean phone: get last 4 digits
        const last4 = s.phone.replace(/\D/g, '').slice(-4);
        
        // Clean DOB: DDMMYYYY
        let studentDob = '';
        const dobDate = s.dob as { toDate?: () => Date }; // Handle potential Firestore timestamp
        if (dobDate?.toDate) {
          const d = dobDate.toDate();
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          studentDob = `${day}${month}${year}`;
        } else if (s.dob instanceof Date) {
          const day = String(s.dob.getDate()).padStart(2, '0');
          const month = String(s.dob.getMonth() + 1).padStart(2, '0');
          const year = s.dob.getFullYear();
          studentDob = `${day}${month}${year}`;
        } else if (typeof s.dob === 'string') {
          studentDob = (s.dob as string).replace(/\D/g, '');
        }

        return last4 === code && studentDob === dob;
      });

      if (!match) {
        // Hand the credential back before failing: an unmatched visitor must
        // not walk away holding a signed-in session.
        if (openedSession) {
          openedSession = false;
          await signOut(auth).catch(signOutError => {
            console.error('Could not revoke the anonymous session after a failed parent login:', signOutError);
          });
        }
        throw new Error('Invalid Login Code or Date of Birth. Please check and try again.');
      }

      // 3. The anonymous session opened at step 0 IS the parent session — a
      //    second signInAnonymously would just return the same uid.
      const anonUid = auth.currentUser?.uid;
      if (!anonUid) {
        throw new Error('Parent sign-in could not be completed. Please try again.');
      }

      // 4. Create/Update user session in Firestore for this anonymous ID
      const parentUser: User = {
        id: anonUid,
        uid: anonUid,
        role: UserRole.PARENT,
        name: (match as Student).name,
        email: (match as Student).email || '',
        phone: (match as Student).phone || '',
        photo: (match as Student).photo || '',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to localStorage BEFORE Firestore write to ensure onAuthStateChanged picks it up
      localStorage.setItem('parent_session', JSON.stringify(parentUser));

      await setDoc(doc(db, 'users', anonUid), {
        ...parentUser,
        studentId: (match as Student).id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setState({
        user: parentUser,
        role: UserRole.PARENT,
        loading: false,
        error: null,
      });

    } catch (err: unknown) {
      console.error("Parent login error:", err);
      // A failed login must never leave a success-looking local session behind —
      // neither in localStorage nor as a live Firebase credential.
      localStorage.removeItem('parent_session');
      if (openedSession) {
        await signOut(auth).catch(signOutError => {
          console.error('Could not revoke the anonymous session after a failed parent login:', signOutError);
        });
      }
      const error = err as { message?: string; code?: string };
      let errorMsg = mapFirestoreError(
        err,
        'Parent sign-in was blocked by the school\'s security rules.',
        error.message || 'Parent login failed.'
      );

      // Handle specifically the Firebase restricted operation error
      if (error.code === 'auth/admin-restricted-operation') {
        errorMsg = 'Anonymous Sign-In is disabled. Please enable "Anonymous" in your Firebase Console (Authentication > Sign-in method) to allow parent logins.';
      }

      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMsg,
      }));
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
