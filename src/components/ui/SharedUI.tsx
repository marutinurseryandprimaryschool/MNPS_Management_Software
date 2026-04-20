'use client';

import React from 'react';
import { getInitials } from '@/lib/utils';

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md';
}) {
  const colors = {
    default: { bg: 'var(--color-surface-variant)', color: 'var(--color-text-secondary)' },
    success: { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    error: { bg: 'var(--color-error-bg)', color: 'var(--color-error)' },
    warning: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
    info: { bg: 'var(--color-info-bg)', color: 'var(--color-info)' },
  };
  
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      borderRadius: 'var(--radius-full)',
      background: colors[variant].bg, color: colors[variant].color,
      font: size === 'sm' ? 'var(--text-overline)' : 'var(--text-caption)',
      fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

export function Avatar({
  name,
  src,
  size = 40,
  color,
}: {
  name: string;
  src?: string;
  size?: number;
  color?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          background: 'var(--color-surface-variant)',
        }}
      />
    );
  }
  
  const initials = getInitials(name);
  const bgColor = color || `hsl(${name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360}, 60%, 85%)`;
  const textColor = `hsl(${name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360}, 60%, 35%)`;
  
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bgColor, color: textColor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 600, fontSize: size * 0.4, fontFamily: 'var(--font-family)',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export function Skeleton({
  width,
  height = 20,
  radius,
  className,
}: {
  width?: string | number;
  height?: string | number;
  radius?: string;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        width: width || '100%',
        height,
        borderRadius: radius || 'var(--radius-sm)',
        background: 'var(--color-surface-variant)',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '64px 16px', textAlign: 'center',
    }}>
      {icon && <div style={{ marginBottom: '16px', opacity: 0.5, fontSize: '3rem' }}>{icon}</div>}
      <h3 style={{ font: 'var(--text-heading-3)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>{title}</h3>
      {description && <p style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-tertiary)', maxWidth: '320px' }}>{description}</p>}
      {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </div>
  );
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{
      display: 'flex', gap: '0', borderBottom: '2px solid var(--color-border)',
      overflowX: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: '10px 16px',
            font: 'var(--text-body)',
            fontWeight: activeTab === tab.id ? 600 : 400,
            color: activeTab === tab.id ? 'var(--color-primary-500)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === tab.id ? '2px solid var(--color-primary-500)' : '2px solid transparent',
            marginBottom: '-2px',
            background: 'none', border: 'none', cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 150ms ease',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span style={{
              padding: '1px 6px', borderRadius: 'var(--radius-full)',
              background: activeTab === tab.id ? 'var(--color-primary-50)' : 'var(--color-surface-variant)',
              fontSize: '0.75rem', fontWeight: 600,
            }}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
