'use client';

/* Per-record activity trail (principalAudit, newest first) shown in a modal —
   used by the Accounts screen for an expense's history. Reads only; audit
   entries are write-once and can never be edited or deleted. */

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { PrincipalAuditService } from '@/lib/principal-service';
import { describeReadError } from '../principal-shared';
import AuditEntryCard from './AuditEntryCard';
import type { PrincipalAuditEntry } from '@/types/principal';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Doc id whose entries to show; null keeps the modal closed. */
  targetId: string | null;
  title?: string;
  subtitle?: string;
}

interface TrailState {
  /** Which record `entries`/`error` describe — anything else reads as loading. */
  targetId: string | null;
  entries: PrincipalAuditEntry[] | null;
  error: string | null;
}

const EMPTY_TRAIL: TrailState = { targetId: null, entries: null, error: null };

export default function AuditTrailModal({
  isOpen, onClose, targetId, title = 'Activity', subtitle,
}: AuditTrailModalProps) {
  // One state object keyed by targetId: switching records shows "Loading…"
  // without an extra reset render.
  const [trail, setTrail] = useState<TrailState>(EMPTY_TRAIL);

  useEffect(() => {
    if (!isOpen || !targetId) return;
    let cancelled = false;
    PrincipalAuditService.listForTarget(targetId)
      .then(rows => { if (!cancelled) setTrail({ targetId, entries: rows, error: null }); })
      .catch(loadError => {
        console.error('Audit trail load failed', { targetId, error: loadError });
        if (cancelled) return;
        setTrail({ targetId, entries: null, error: describeReadError(loadError, 'the activity log') });
      });
    return () => { cancelled = true; };
  }, [isOpen, targetId]);

  const loaded = trail.targetId === targetId;
  const entries = loaded ? trail.entries : null;
  const error = loaded ? trail.error : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      {subtitle && (
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>
          {subtitle}
        </p>
      )}

      {error ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
          <div>
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : entries === null ? (
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading activity…</p>
      ) : entries.length === 0 ? (
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          No activity recorded for this record.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {entries.map(entry => <AuditEntryCard key={entry.id} entry={entry} />)}
        </div>
      )}
    </Modal>
  );
}
