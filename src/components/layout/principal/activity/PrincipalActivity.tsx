'use client';

/* ============================================
   Principal Activity Log — page key 'principal-activity'
   ============================================
   The accountability surface for the Principal Register: every register,
   payment, expense and settings change, newest first, with the actor, the
   action, the student and a before → after of the fields that moved.

   Teachers can edit their own students' fee rows — this screen is what makes
   that access safe. Entries are write-once (firestore.rules), readable by the
   Principal only, and are written in the SAME batch as the change they
   describe, so nothing here can be missing for a change that happened.
*/

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { hasCapability } from '@/lib/permissions';
import { PrincipalAuditService } from '@/lib/principal-service';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/SharedUI';
import { describeReadError, pickerStyle } from '../principal-shared';
import AuditEntryCard from './AuditEntryCard';
import { auditDateKey } from './audit-format';
import type { PrincipalAuditEntry } from '@/types/principal';

/** Newest N entries fetched at a time; "Show more" widens the window. */
const PAGE_SIZE = 100;
const MAX_ENTRIES = 1000;

const ALL_ACTORS = '__all__';

export default function PrincipalActivity() {
  const { role } = useAuth();
  const canView = hasCapability(role, 'viewPrincipalAccounts');

  const [entries, setEntries] = useState<PrincipalAuditEntry[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [actorUid, setActorUid] = useState(ALL_ACTORS);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  /**
   * Fetches into state. `isStale` lets an unmounted/superseded run drop its
   * result instead of writing it. Callers that want a spinner set `loading`
   * themselves BEFORE calling — an effect must not setState synchronously.
   */
  const load = useCallback(async (max: number, isStale: () => boolean = () => false) => {
    try {
      const rows = await PrincipalAuditService.listRecent(max);
      if (isStale()) return;
      setEntries(rows);
      setLoadError(null);
    } catch (error) {
      console.error('Activity log load failed', { max, error });
      if (isStale()) return;
      setLoadError(describeReadError(error, 'the activity log'));
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    void load(limit, () => cancelled);
    return () => { cancelled = true; };
  }, [canView, limit, load]);

  const reload = () => { setLoading(true); void load(limit); };

  const actors = useMemo(() => {
    const byUid = new Map<string, string>();
    for (const entry of entries) {
      const uid = entry.actorUid || entry.actorName || '';
      if (uid && !byUid.has(uid)) byUid.set(uid, entry.actorName || uid);
    }
    return Array.from(byUid.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [entries]);

  const visible = useMemo(() => entries.filter(entry => {
    if (actorUid !== ALL_ACTORS && (entry.actorUid || entry.actorName || '') !== actorUid) return false;
    const key = auditDateKey(entry);
    if (fromDate && (!key || key < fromDate)) return false;
    if (toDate && (!key || key > toDate)) return false;
    return true;
  }), [entries, actorUid, fromDate, toDate]);

  const isFiltered = actorUid !== ALL_ACTORS || !!fromDate || !!toDate;
  const clearFilters = () => { setActorUid(ALL_ACTORS); setFromDate(''); setToDate(''); };

  if (!canView) {
    return (
      <div className="page-container">
        <div style={{
          padding: 'var(--space-8)', textAlign: 'center', background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
        }}>
          <p className="text-body" style={{ fontWeight: 600 }}>The activity log is for the Principal only</p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
            If your role changed recently, refresh the app and sign in again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="text-h1">Activity Log</h2>
            <Badge variant="primary">{visible.length} shown</Badge>
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            Every change to the fees note, payments, expenses and settings — newest first.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={reload}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 'var(--space-3)', alignItems: 'end', marginBottom: 'var(--space-4)',
      }}>
        <Select
          label="Who changed it"
          value={actorUid}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setActorUid(e.target.value)}
          options={[{ value: ALL_ACTORS, label: 'Everyone' }, ...actors]}
        />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>From date</span>
          <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} style={pickerStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>To date</span>
          <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} style={pickerStyle} />
        </label>
        {isFiltered && (
          <div>
            <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>
          </div>
        )}
      </div>

      {loadError ? (
        <div style={{
          padding: 'var(--space-8)', textAlign: 'center', background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
        }}>
          <p className="text-body" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Could not load the activity log
          </p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
            {loadError}
          </p>
          <Button variant="primary" onClick={reload}>Retry</Button>
        </div>
      ) : loading ? (
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading activity…</p>
      ) : visible.length === 0 ? (
        <div style={{
          padding: 'var(--space-8)', textAlign: 'center', background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
        }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {isFiltered
              ? 'No changes match these filters.'
              : 'No changes recorded yet. Every edit to the fees note, payments and expenses will appear here.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {visible.map(entry => <AuditEntryCard key={entry.id} entry={entry} />)}
        </div>
      )}

      {!loadError && entries.length >= limit && limit < MAX_ENTRIES && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
          <Button variant="secondary" onClick={() => setLimit(current => Math.min(MAX_ENTRIES, current + PAGE_SIZE))} disabled={loading}>
            Show older changes
          </Button>
        </div>
      )}
    </div>
  );
}
