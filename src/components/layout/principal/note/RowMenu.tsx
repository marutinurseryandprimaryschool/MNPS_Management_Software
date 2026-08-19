'use client';

/* ============================================
   Fees Note — row menu
   ============================================
   The per-student actions (record payment, months, edit, remove). Positioned
   with `fixed` off the button's rect: the desktop grid scrolls horizontally,
   and an absolutely positioned menu would be clipped by that scroll box.
*/

import React, { useEffect, useRef, useState } from 'react';
import { MoreVerticalIcon } from '@/components/ui/Icons';

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface RowMenuProps {
  items: RowMenuItem[];
  /** Names the student the menu belongs to, for screen readers. */
  label: string;
}

interface Anchor {
  top: number;
  right: number;
}

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 61,
  minWidth: 190,
  padding: 'var(--space-1)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  display: 'flex',
  flexDirection: 'column',
};

const itemStyle = (danger?: boolean, disabled?: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  textAlign: 'left',
  font: 'var(--text-body-sm)',
  color: disabled
    ? 'var(--color-text-tertiary)'
    : danger ? 'var(--color-error)' : 'var(--color-text-primary)',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  whiteSpace: 'nowrap',
});

const triggerStyle: React.CSSProperties = {
  padding: 6,
  background: 'none',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  color: 'var(--color-text-secondary)',
};

export default function RowMenu({ items, label }: RowMenuProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The anchor is a snapshot of the button's position; once the page or the
  // grid scrolls it is stale, so the menu closes rather than floating away.
  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [anchor]);

  const open = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({
      top: Math.round(rect.bottom + 4),
      right: Math.max(8, Math.round(window.innerWidth - rect.right)),
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        style={triggerStyle}
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={() => (anchor ? setAnchor(null) : open())}
      >
        <MoreVerticalIcon size={16} />
      </button>

      {anchor && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 60 }}
            onClick={() => setAnchor(null)}
            aria-hidden="true"
          />
          <div style={{ ...menuStyle, top: anchor.top, right: anchor.right }} role="menu">
            {items.map(item => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                style={itemStyle(item.danger, item.disabled)}
                onClick={() => {
                  setAnchor(null);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
