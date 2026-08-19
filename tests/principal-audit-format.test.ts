/* Activity-log formatting: the before/after blobs in principalAudit are
   whatever the doc held, so these tests pin the untrusted-value handling
   (Timestamps, arrays, nulls) and the per-action diff rules. */

import { describe, expect, it } from 'vitest';
import {
  auditDateKey, diffAuditEntry, fieldLabel, formatAuditValue,
} from '@/components/layout/principal/activity/audit-format';
import type { PrincipalAuditEntry } from '@/types/principal';

const entry = (patch: Partial<PrincipalAuditEntry>): PrincipalAuditEntry => ({
  id: 'a1',
  at: new Date('2026-08-19T10:30:00'),
  actorUid: 'u1',
  actorName: 'Sharmi',
  actorRole: 'principal',
  action: 'update',
  target: 'register',
  targetId: 'r1',
  summary: 'Updated a row',
  before: null,
  after: null,
  ...patch,
});

describe('formatAuditValue', () => {
  it('renders empties, booleans, numbers and arrays readably', () => {
    expect(formatAuditValue(null)).toBe('—');
    expect(formatAuditValue('')).toBe('—');
    expect(formatAuditValue([])).toBe('—');
    expect(formatAuditValue(true)).toBe('Yes');
    expect(formatAuditValue(12000)).toBe('12,000');
    expect(formatAuditValue(['June', 'July'])).toBe('June, July');
  });

  it('renders a Firestore Timestamp instead of leaking [object Object]', () => {
    const stamp = { seconds: Math.floor(new Date('2026-08-19T00:00:00').getTime() / 1000) };
    expect(formatAuditValue(stamp)).toContain('2026');
    expect(formatAuditValue(stamp)).not.toContain('object');
  });

  it('never throws on a broken toDate()', () => {
    const broken = { toDate: () => { throw new Error('bad stamp'); } };
    expect(() => formatAuditValue(broken)).not.toThrow();
  });
});

describe('diffAuditEntry', () => {
  it('shows only the fields an update actually moved', () => {
    const changes = diffAuditEntry(entry({
      action: 'update',
      before: { schoolFee: 5000, ecaAnnual: 2000, updatedAt: 'x' },
      after: { schoolFee: 6000, ecaAnnual: 2000 },
    }));
    expect(changes.map(c => c.field)).toEqual(['schoolFee']);
    expect(changes[0]).toMatchObject({ label: 'School fee', before: '5,000', after: '6,000' });
  });

  it('lists what a created record was born with', () => {
    const changes = diffAuditEntry(entry({
      action: 'create',
      before: null,
      after: { name: 'Asha', className: 'UKG', schoolFee: 5000 },
    }));
    expect(changes.map(c => c.field).sort()).toEqual(['className', 'name', 'schoolFee']);
    expect(changes.find(c => c.field === 'name')?.after).toBe('Asha');
  });

  it('summarises a delete from the before-snapshot only', () => {
    const changes = diffAuditEntry(entry({
      action: 'delete',
      before: { studentName: 'Asha', amount: 500, dateKey: '2026-08-19', deleted: false, enteredByUid: 'u9' },
      after: { deleted: true },
    }));
    expect(changes.map(c => c.field)).toEqual(['studentName', 'amount', 'dateKey']);
    expect(changes.every(c => c.after === '—')).toBe(true);
  });

  it('drops the audit noise fields', () => {
    const changes = diffAuditEntry(entry({
      action: 'update',
      before: { createdAt: 'a', updatedAt: 'b', academicYear: '2026-27', notes: 'old' },
      after: { createdAt: 'c', updatedAt: 'd', academicYear: '2027-28', notes: 'new' },
    }));
    expect(changes.map(c => c.field)).toEqual(['notes']);
  });
});

describe('auditDateKey', () => {
  it('buckets on the LOCAL day so the date filter matches what Sharmi sees', () => {
    expect(auditDateKey(entry({ at: new Date(2026, 7, 19, 23, 45) }))).toBe('2026-08-19');
  });

  it('returns an empty key when the stamp is missing', () => {
    expect(auditDateKey(entry({ at: null as unknown as Date }))).toBe('');
  });
});

describe('fieldLabel', () => {
  it('falls back to a readable sentence for unmapped fields', () => {
    expect(fieldLabel('schoolFee')).toBe('School fee');
    expect(fieldLabel('someNewField')).toBe('Some new field');
  });
});
