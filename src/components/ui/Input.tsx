'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export default function Input({
  label,
  error,
  hint,
  icon,
  fullWidth = true,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s/g, '-')}`;
  
  return (
    <div className={cn(styles.wrapper, fullWidth && styles.fullWidth, className)}>
      {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
      <div className={cn(styles.inputContainer, error && styles.hasError)}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <input id={inputId} className={styles.input} {...props} />
      </div>
      {error && <span className={styles.error}>{error}</span>}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

export function Textarea({
  label,
  error,
  hint,
  fullWidth = true,
  className,
  id,
  ...props
}: {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
  className?: string;
  id?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const inputId = id || `textarea-${label?.toLowerCase().replace(/\s/g, '-')}`;
  
  return (
    <div className={cn(styles.wrapper, fullWidth && styles.fullWidth, className)}>
      {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
      <textarea id={inputId} className={cn(styles.textarea, error && styles.hasError)} {...props} />
      {error && <span className={styles.error}>{error}</span>}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

export function Select({
  label,
  error,
  options,
  placeholder,
  fullWidth = true,
  className,
  id,
  ...props
}: {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  fullWidth?: boolean;
  className?: string;
  id?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const inputId = id || `select-${label?.toLowerCase().replace(/\s/g, '-')}`;

  return (
    <div className={cn(styles.wrapper, fullWidth && styles.fullWidth, className)}>
      {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
      <select id={inputId} className={cn(styles.select, error && styles.hasError)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn(styles.searchWrapper, className)}>
      <span className={styles.searchIcon}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.searchInput}
      />
      {value && (
        <button className={styles.searchClear} onClick={() => onChange('')} aria-label="Clear search">
          ✕
        </button>
      )}
    </div>
  );
}
