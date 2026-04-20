'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserRole } from '@/types/enums';
import { User } from '@/types/models';
import { DEMO_USERS } from '@/lib/demo-data';
import { auth, db } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  schoolId: string;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    schoolId: 'school_demo_001',
    loading: true,
    error: null,
  });

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            // Convert timestamps back to Date objects if needed because Firestore stores them as Timestamps
            // But relying on our naive User type, this suffices for demo functionality.
            setState({
              user: userData,
              role: userData.role,
              schoolId: 'school_demo_001',
              loading: false,
              error: null,
            });
            return;
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
      
      setState({
        user: null,
        role: null,
        schoolId: 'school_demo_001',
        loading: false,
        error: null,
      });
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // 1. Try to login
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      // 2. If user doesn't exist, try to auto-seed them (for demo purposes only)
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          // Identify which demo user this might be
          let mappedRole: UserRole | null = null;
          if (email.includes('admin')) mappedRole = UserRole.ADMIN;
          else if (email.includes('principal')) mappedRole = UserRole.PRINCIPAL;
          else if (email.includes('correspondent')) mappedRole = UserRole.CORRESPONDENT;
          else if (email.includes('teacher')) mappedRole = UserRole.TEACHER;
          else if (email.includes('parent')) mappedRole = UserRole.PARENT;

          if (mappedRole) {
            // If they are explicitly trying to seed but used the old 'demo' password which is too short, suggest the right one
            if (password.length < 6) {
              setState(prev => ({
                ...prev,
                loading: false,
                error: 'Firebase requires 6+ character passwords. Please use "demo1234" instead of "demo".',
              }));
              return;
            }

            // Auto register
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Get seed data
            const seedUser = { ...DEMO_USERS[mappedRole] };
            seedUser.uid = user.uid; // Update to actual firebase uid
            
            // Convert Dates to ISO strings before saving to Firestore so they don't break
            const dataToSave = JSON.parse(JSON.stringify(seedUser));
            
            // Seed to Firestore
            await setDoc(doc(db, 'users', user.uid), dataToSave);
            
            // Login succeeds after registration because auth state changes
            return;
          }
        } catch (seedErr: any) {
          console.error("Auto-seeding failed", seedErr);
          if (seedErr.code === 'auth/weak-password') {
            setState(prev => ({ ...prev, loading: false, error: 'Password is too weak. Demo accounts require "demo1234".' }));
            return;
          }
        }
      }
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Invalid credentials. Please try again.',
      }));
      return; // Do not throw so we don't trigger Next.js error overlays
    }
  }, []);

  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const switchRole = useCallback((role: UserRole) => {
    const user = DEMO_USERS[role];
    setState(prev => ({
      ...prev,
      user,
      role,
    }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, switchRole }}>
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
