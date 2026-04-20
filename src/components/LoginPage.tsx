'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/enums';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { SchoolIcon, UserIcon, AwardIcon, BriefcaseIcon, GraduationCapIcon, UsersIcon } from '@/components/ui/Icons';
import styles from './LoginPage.module.css';

const DEMO_ACCOUNTS = [
  { role: UserRole.ADMIN, icon: <UserIcon size={22} />, label: 'Admin', color: '#6366F1' },
  { role: UserRole.PRINCIPAL, icon: <AwardIcon size={22} />, label: 'Principal', color: '#8B5CF6' },
  { role: UserRole.CORRESPONDENT, icon: <BriefcaseIcon size={22} />, label: 'Correspondent', color: '#EC4899' },
  { role: UserRole.TEACHER, icon: <GraduationCapIcon size={22} />, label: 'Teacher', color: '#10B981' },
  { role: UserRole.PARENT, icon: <UsersIcon size={22} />, label: 'Parent', color: '#F59E0B' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Please enter an email'); return; }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (role: UserRole) => {
    setLoading(true);
    setError('');
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
      {/* Animated background */}
      <div className={styles.bgGradient} />
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />
      <div className={styles.bgOrb3} />

      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoArea}>
          <div className={styles.logoMark}>
            <SchoolIcon size={28} color="white" />
          </div>
          <h1 className={styles.logoTitle}>CampusOS</h1>
          <p className={styles.logoSubtitle}>School Management System</p>
        </div>

        {/* Login Form */}
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

          {error && <p className={styles.error}>{error}</p>}

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            Sign In
          </Button>

          <button type="button" className={styles.forgotLink}>Forgot Password?</button>
        </form>

        {/* Quick Login Demos */}
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
  );
}
