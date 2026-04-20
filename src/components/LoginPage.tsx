'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/enums';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { SchoolIcon, UserIcon, AwardIcon, BriefcaseIcon, GraduationCapIcon, UsersIcon, BookOpenIcon, CalendarIcon, SparklesIcon } from '@/components/ui/Icons';
import styles from './LoginPage.module.css';

const DEMO_ACCOUNTS = [
  { role: UserRole.ADMIN, icon: <UserIcon size={20} />, label: 'Admin', color: '#4F46E5' },
  { role: UserRole.PRINCIPAL, icon: <AwardIcon size={20} />, label: 'Principal', color: '#7C3AED' },
  { role: UserRole.CORRESPONDENT, icon: <BriefcaseIcon size={20} />, label: 'Correspondent', color: '#DB2777' },
  { role: UserRole.TEACHER, icon: <GraduationCapIcon size={20} />, label: 'Teacher', color: '#059669' },
  { role: UserRole.PARENT, icon: <UsersIcon size={20} />, label: 'Parent', color: '#D97706' },
];

const FEATURES = [
  { icon: <BookOpenIcon size={20} />, text: 'Student Management' },
  { icon: <CalendarIcon size={20} />, text: 'Timetable Scheduling' },
  { icon: <SparklesIcon size={20} />, text: 'Attendance Tracking' },
];

export default function LoginPage() {
  const { login, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      // Error handled by context
    }
    setLoading(false);
  };

  const handleQuickLogin = async (role: UserRole) => {
    setLoading(true);
    const emails: Record<UserRole, string> = {
      [UserRole.ADMIN]: 'admin@campusos.demo',
      [UserRole.PRINCIPAL]: 'principal@campusos.demo',
      [UserRole.CORRESPONDENT]: 'correspondent@campusos.demo',
      [UserRole.TEACHER]: 'teacher@campusos.demo',
      [UserRole.PARENT]: 'parent@campusos.demo',
    };
    try {
      await login(emails[role], 'demo1234');
    } catch (err) {
      // error is already handled by context
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      {/* Left Side - Branding */}
      <div className={styles.branding}>
        <div className={styles.brandingContent}>
          <div className={styles.logoRow}>
            <div className={styles.logoMarkLarge}>
              <SchoolIcon size={32} color="white" />
            </div>
            <span className={styles.logoText}>CampusOS</span>
          </div>

          <h1 className={styles.brandingTitle}>
            AJK School<br />
            <span className={styles.brandingHighlight}>Management System</span>
          </h1>

          <p className={styles.brandingSubtitle}>
            Streamline your school operations with our comprehensive platform.
            Manage students, teachers, attendance, fees, and communication—all in one place.
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
              <span className={styles.statNumber}>500+</span>
              <span className={styles.statLabel}>Schools</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNumber}>50K+</span>
              <span className={styles.statLabel}>Students</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNumber}>99.9%</span>
              <span className={styles.statLabel}>Uptime</span>
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
            <h2 className={styles.formTitle}>Welcome Back</h2>
            <p className={styles.formSubtitle}>Sign in to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
            />

            <div className={styles.forgotWrapper}>
              <button type="button" className={styles.forgotLink}>Forgot Password?</button>
            </div>

            {(authError) && <p className={styles.error}>{authError}</p>}

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Sign In
            </Button>
          </form>

          <div className={styles.dividerWrapper}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>Quick Demo Login</span>
            <span className={styles.dividerLine} />
          </div>

          <div className={styles.quickLogins}>
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.role}
                className={styles.quickBtn}
                onClick={() => handleQuickLogin(acc.role)}
                disabled={loading}
                title={`Login as ${acc.label}`}
              >
                <span className={styles.quickIconWrap} style={{ '--accent': acc.color } as React.CSSProperties}>
                  {acc.icon}
                </span>
                <span className={styles.quickLabel}>{acc.label}</span>
              </button>
            ))}
          </div>

          <p className={styles.footer}>
            © 2026 CampusOS. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
