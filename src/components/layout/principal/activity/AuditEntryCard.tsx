'use client';

/* One row of the activity log: who did what, when, and the fields that moved.
   This is what makes the teachers' edit access accountable — every register,
   payment, expense and settings change lands here, write-once. */

import React from 'react';
import { Badge } from '@/components/ui/SharedUI';
import {
  ACTION_LABELS, ACTION_VARIANTS, MAX_CHANGES_SHOWN, TARGET_LABELS,
  diffAuditEntry, formatAuditTime,
} from './audit-format';
import type { PrincipalAuditEntry } from '@/types/principal';

export default function AuditEntryCard({ entry }: { entry: PrincipalAuditEntry }) {
  const changes = diffAuditEntry(entry);
  const shown = changes.slice(0, MAX_CHANGES_SHOWN);
  const hidden = changes.length - shown.length;

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: 'var(--space-4)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Badge variant={ACTION_VARIANTS[entry.action] ?? 'info'}>
          {ACTION_LABELS[entry.action] ?? entry.action}
        </Badge>
        <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
          {TARGET_LABELS[entry.target] ?? entry.target}
        </span>
        <span className="text-caption" style={{ marginLeft: 'auto', color: 'var(--color-text-tertiary)' }}>
          {formatAuditTime(entry)}
        </span>
      </div>

      <div className="text-body-sm" style={{ fontWeight: 600 }}>
        {entry.summary || `${ACTION_LABELS[entry.action] ?? entry.action} a record`}
      </div>

      <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
        by {entry.actorName || 'Unknown user'}
        {entry.actorRole ? ` (${entry.actorRole})` : ''}
        {entry.studentName ? ` · ${entry.studentName}` : ''}
      </div>

      {shown.length > 0 && (
        <div style={{
          marginTop: 'var(--space-1)', borderTop: '1px solid var(--color-divider)',
          paddingTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {shown.map(change => (
            <div
              key={change.field}
              style={{
                display: 'grid', gridTemplateColumns: 'minmax(90px, 30%) 1fr',
                gap: 'var(--space-2)', alignItems: 'baseline',
              }}
            >
              <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{change.label}</span>
              <span className="text-caption" style={{ wordBreak: 'break-word' }}>
                <span style={{ color: 'var(--color-text-tertiary)', textDecoration: 'line-through' }}>
                  {change.before}
                </span>
                {' → '}
                <span style={{ fontWeight: 600 }}>{change.after}</span>
              </span>
            </div>
          ))}
          {hidden > 0 && (
            <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
              +{hidden} more {hidden === 1 ? 'field' : 'fields'} changed
            </span>
          )}
        </div>
      )}
    </div>
  );
}
