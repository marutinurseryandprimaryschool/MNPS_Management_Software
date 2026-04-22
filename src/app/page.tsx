'use client';

import React from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SchoolProvider } from '@/context/SchoolContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/components/ui/Toast';
import LoginPage from '@/components/LoginPage';
import DashboardLayout from '@/components/layout/DashboardLayout';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-surface-dim)',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)',
        }}>
          <div style={{
            width: 48,
            height: 48,
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-primary-500)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-tertiary)' }}>Loading Maruti School...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <DashboardLayout />;
}

export default function HomePage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SchoolProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </SchoolProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
