'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import styles from './Card.module.css';

/* ── Data Card ── */
export function DataCard({
  icon,
  value,
  label,
  trend,
  color,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  trend?: string;
  color?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div className={cn(styles.dataCard, className)} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <div className={styles.dataIcon} style={{ color: color || 'var(--color-primary-500)', background: color ? `${color}15` : 'var(--color-primary-50)' }}>
        {icon}
      </div>
      <div className={styles.dataContent}>
        <span className={styles.dataValue}>{value}</span>
        <span className={styles.dataLabel}>{label}</span>
      </div>
      {trend && <span className={styles.dataTrend}>{trend}</span>}
    </div>
  );
}

/* ── List Card ── */
export function ListCard({
  avatar,
  title,
  subtitle,
  meta,
  trailing,
  onClick,
  className,
}: {
  avatar?: React.ReactNode;
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div className={cn(styles.listCard, className)} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      {avatar && <div className={styles.listAvatar}>{avatar}</div>}
      <div className={styles.listContent}>
        <span className={styles.listTitle}>{title}</span>
        {subtitle && <span className={styles.listSubtitle}>{subtitle}</span>}
        {meta && <span className={styles.listMeta}>{meta}</span>}
      </div>
      {trailing && <div className={styles.listTrailing}>{trailing}</div>}
    </div>
  );
}

/* ── Action Card ── */
export function ActionCard({
  icon,
  title,
  description,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button className={cn(styles.actionCard, className)} onClick={onClick}>
      <span className={styles.actionIcon}>{icon}</span>
      <div className={styles.actionContent}>
        <span className={styles.actionTitle}>{title}</span>
        {description && <span className={styles.actionDesc}>{description}</span>}
      </div>
      <span className={styles.actionChevron}>›</span>
    </button>
  );
}

/* ── Alert Card ── */
export function AlertCard({
  type = 'info',
  title,
  message,
  action,
  onAction,
  className,
}: {
  type?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
  className?: string;
}) {
  const colors = {
    info: { border: 'var(--color-info)', bg: 'var(--color-info-bg)' },
    success: { border: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    warning: { border: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
    error: { border: 'var(--color-error)', bg: 'var(--color-error-bg)' },
  };
  
  return (
    <div className={cn(styles.alertCard, className)} style={{ borderLeftColor: colors[type].border, background: colors[type].bg }}>
      <div className={styles.alertContent}>
        <span className={styles.alertTitle}>{title}</span>
        {message && <span className={styles.alertMessage}>{message}</span>}
      </div>
      {action && onAction && (
        <button className={styles.alertAction} onClick={onAction} style={{ color: colors[type].border }}>
          {action}
        </button>
      )}
    </div>
  );
}

/* ── Card Container ── */
export default function Card({
  children,
  className,
  padding,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  onClick?: () => void;
}) {
  return (
    <div className={cn(styles.card, className)} style={{ padding }} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      {children}
    </div>
  );
}
