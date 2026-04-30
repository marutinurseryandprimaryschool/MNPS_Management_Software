'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import { BookOpenIcon, CalendarIcon, SparklesIcon } from '@/components/ui/Icons';
import styles from './LoginPage.module.css';

const FEATURES = [
  { icon: <BookOpenIcon size={20} />, text: 'Student Management' },
  { icon: <CalendarIcon size={20} />, text: 'Timetable Scheduling' },
  { icon: <SparklesIcon size={20} />, text: 'Attendance Tracking' },
];

export default function LoginPage() {
  const { login, loginAsParent, error: authError, loading: authLoading, clearError } = useAuth();
  const [activeTab, setActiveTab] = useState<'staff' | 'parent'>('staff');
  const [loading, setLoading] = useState(false);
  const [parentCode, setParentCode] = useState('');
  const [parentDob, setParentDob] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await login();
    } catch {
      // Error handled by context
    }
    setLoading(false);
  };

  const handleParentSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentCode || !parentDob) return;
    setLoading(true);
    try {
      await loginAsParent(parentCode, parentDob);
    } catch {
      // Error handled by context
    }
    setLoading(false);
  };

  const isLoading = loading || authLoading;

  return (
    <div className={styles.container}>
      {/* Left Side - Branding */}
      <div className={styles.branding}>
        <div className={styles.brandingContent}>
          <div className={styles.logoRow}>
            <div className={styles.logoMarkLarge}>
              <Image
                src="/MARUTI.png.bv.webp"
                alt="Maruti Nursery & Primary School Logo"
                width={80}
                height={80}
                className={styles.logoImage}
                priority
              />
            </div>
            <span className={styles.logoText}>Maruti School</span>
          </div>

          <h1 className={styles.brandingTitle}>
            MARUTI NURSERY<br />
            <span className={styles.brandingHighlight}>& PRIMARY SCHOOL</span>
          </h1>

          <p className={styles.brandingSubtitle}>
            Nurturing young minds for a brighter tomorrow. Excellence in education
            through innovative learning and dedicated care for every child.
          </p>

          <div className={styles.features}>
            {FEATURES.map((feature, idx) => (
              <div key={idx} className={styles.featureItem}>
                <span className={styles.featureIcon}>{feature.icon}</span>
                <span className={styles.featureText}>{feature.text}</span>
              </div>
            ))}
          </div>

          <div className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>25+</span>
              <span className={styles.statLabel}>Years of Excellence</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNumber}>1000+</span>
              <span className={styles.statLabel}>Students</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNumber}>50+</span>
              <span className={styles.statLabel}>Expert Teachers</span>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className={styles.brandingPattern} />
      </div>

      {/* Right Side - Login Form */}
      <div className={styles.formSection}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Welcome</h2>
            <p className={styles.formSubtitle}>Sign in to access your school dashboard</p>
          </div>

          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${activeTab === 'staff' ? styles.activeTab : ''}`}
              onClick={() => {
                setActiveTab('staff');
                if (authError) clearError();
              }}
              type="button"
            >
              Staff Login
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'parent' ? styles.activeTab : ''}`}
              onClick={() => {
                setActiveTab('parent');
                if (authError) clearError();
              }}
              type="button"
            >
              Parent Login
            </button>
          </div>

          {activeTab === 'staff' ? (
            <div className={styles.googleSection}>
              <p className={styles.googleHint}>
                Use your school-registered Google account to sign in.
              </p>

              <button
                className={styles.googleBtn}
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                type="button"
                id="google-sign-in-button"
              >
                {isLoading ? (
                  <span className={styles.googleSpinner} />
                ) : (
                  <svg className={styles.googleIcon} viewBox="0 0 24 24" width="22" height="22">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                <span>{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>

              {authError && (
                <div className={styles.errorBox}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <span>{authError}</span>
                </div>
              )}
            </div>
          ) : (
            <form className={styles.parentForm} onSubmit={handleParentSignIn}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Login Code (Last 4 digits of phone)</label>
                <input
                  type="text"
                  className={styles.inputField}
                  placeholder="e.g. 1234"
                  maxLength={4}
                  value={parentCode}
                  onChange={(e) => setParentCode(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Password (Student DOB: DDMMYYYY)</label>
                <input
                  type="password"
                  className={styles.inputField}
                  placeholder="e.g. 25072004"
                  maxLength={8}
                  value={parentDob}
                  onChange={(e) => setParentDob(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>

              <button className={styles.submitBtn} disabled={isLoading} type="submit">
                {isLoading ? 'Verifying...' : 'Login as Parent'}
              </button>

              {authError && (
                <div className={styles.errorBox}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <span>{authError}</span>
                </div>
              )}
            </form>
          )}

          <div className={styles.infoBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>Contact your school administrator if you don&apos;t have access.</span>
          </div>

          <p className={styles.footer}>
            © 2026 Maruti Nursery & Primary School. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
