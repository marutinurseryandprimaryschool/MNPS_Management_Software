'use client';
import React, { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchableSelect({ label, options, value, onChange, placeholder = 'Search...' }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.value === value);
  const filtered = search
    ? options.filter(o => o.value !== '' && o.label.toLowerCase().includes(search.toLowerCase()))
    : options.filter(o => o.value !== '');

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {label && (
        <label style={{
          display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 500,
          color: 'var(--color-text-secondary)',
        }}>{label}</label>
      )}
      <div
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        style={{
          display: 'flex', alignItems: 'center', padding: '9px 12px',
          border: `1.5px solid ${isOpen ? 'var(--color-primary-500)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-md)', cursor: 'pointer',
          background: 'var(--color-surface)', transition: 'border-color 150ms',
          fontSize: '0.9rem', color: selectedOption?.value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
          minHeight: 40,
        }}
      >
        {isOpen ? (
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={selectedOption?.label || placeholder}
            onClick={e => e.stopPropagation()}
            style={{
              border: 'none', outline: 'none', background: 'transparent', width: '100%',
              fontSize: '0.9rem', color: 'var(--color-text-primary)', padding: 0,
            }}
          />
        ) : (
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOption?.label || placeholder}
          </span>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginLeft: 8, opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          marginTop: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: '0.85rem', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
              No results found
            </div>
          ) : filtered.map(opt => (
            <div
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              style={{
                padding: '9px 14px', cursor: 'pointer', fontSize: '0.9rem',
                background: opt.value === value ? 'var(--color-primary-50)' : 'transparent',
                color: opt.value === value ? 'var(--color-primary-500)' : 'var(--color-text-primary)',
                fontWeight: opt.value === value ? 600 : 400,
                transition: 'background 100ms',
              }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'var(--color-surface-variant)'; }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
