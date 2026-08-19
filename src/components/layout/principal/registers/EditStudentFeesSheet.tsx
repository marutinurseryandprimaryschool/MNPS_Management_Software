'use client';

/* ============================================
   Principal Register — edit one student's fee amounts
   ============================================
   The phone-shaped editor (and the desktop fallback) for the three heads.

   It patches ONLY the fields firestore.rules lets a responsible teacher move —
   schoolFee, ecaAnnual, ecaMonths, vanMonthly, vanMonths, isScholarship,
   notes. Identity (name, class, roll) and the teacher assignment stay
   principal-only, so a teacher cannot rename a student or hand them to
   someone else. Sending a wider patch would be denied by rules anyway; keeping
   it narrow means the denial never has to happen.

   Only CHANGED fields are sent, so the activity log records the real diff.
*/

import React, { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input, { Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { ACADEMIC_MONTHS } from '@/lib/fee-utils';
import { splitAnnualAcrossMonths } from '@/lib/principal-fees';
import { PrincipalRegisterService } from '@/lib/principal-service';
import { refreshFailedMessage } from '@/components/layout/admin/fees/error-policy';
import type { PrincipalActor, RegisterRow } from '@/types/principal';
import { describeError, inr } from './register-shared';
import { NoticeBanner, useIsNarrow } from './register-ui';

/** Exactly the keys a teacher is allowed to move (mirrors firestore.rules). */
type EditableRow = Pick<
  RegisterRow,
  'schoolFee' | 'ecaAnnual' | 'ecaMonths' | 'vanMonthly' | 'vanMonths' | 'isScholarship' | 'notes'
>;

const sameMonths = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((month, i) => month === b[i]);

/** Keeps the chip order canonical (June → March) whatever order they tap in. */
const inAcademicOrder = (months: string[]): string[] =>
  ACADEMIC_MONTHS.filter(month => months.includes(month));

function MonthChips({ label, selected, onToggle, hint }: {
  label: string;
  selected: string[];
  onToggle: (month: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <div style={{
        fontSize: '0.72rem', fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ACADEMIC_MONTHS.map(month => {
          const on = selected.includes(month);
          return (
            <button
              key={month}
              type="button"
              onClick={() => onToggle(month)}
              aria-pressed={on}
              style={{
                padding: '6px 10px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: 600, minHeight: 34,
                border: `1px solid ${on ? 'var(--color-success)' : 'var(--color-border)'}`,
                background: on ? 'var(--color-success-bg)' : 'var(--color-surface)',
                color: on ? 'var(--color-success-text)' : 'var(--color-text-secondary)',
              }}
            >
              {month.slice(0, 3)}
            </button>
          );
        })}
      </div>
      {hint && (
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)', marginTop: 6 }}>{hint}</div>
      )}
    </div>
  );
}

export interface EditStudentFeesSheetProps {
  row: RegisterRow;
  actor: PrincipalActor | null;
  onClose: () => void;
  onSaved: () => Promise<boolean>;
  /** Shown to teachers so the audit trail is never a surprise. */
  auditNotice?: string;
}

export default function EditStudentFeesSheet({
  row, actor, onClose, onSaved, auditNotice,
}: EditStudentFeesSheetProps) {
  const { showToast } = useToast();
  const narrow = useIsNarrow();

  const [schoolFee, setSchoolFee] = useState(String(row.schoolFee ?? 0));
  const [ecaAnnual, setEcaAnnual] = useState(String(row.ecaAnnual ?? 0));
  const [ecaMonths, setEcaMonths] = useState<string[]>(() => inAcademicOrder(row.ecaMonths ?? []));
  const [vanMonthly, setVanMonthly] = useState(String(row.vanMonthly ?? 0));
  const [vanMonths, setVanMonths] = useState<string[]>(() => inAcademicOrder(row.vanMonths ?? []));
  const [notes, setNotes] = useState(row.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const ecaPerMonth = useMemo(() => {
    const slices = splitAnnualAcrossMonths(Number(ecaAnnual), ecaMonths.length);
    if (slices.length === 0) return null;
    const min = Math.min(...slices);
    const max = Math.max(...slices);
    return min === max ? inr(min) : `${inr(min)}–${inr(max)}`;
  }, [ecaAnnual, ecaMonths.length]);

  const toggle = (list: string[], month: string): string[] =>
    inAcademicOrder(list.includes(month) ? list.filter(item => item !== month) : [...list, month]);

  const handleSave = async () => {
    if (saving) return;
    const school = Math.round(Number(schoolFee));
    const eca = Math.round(Number(ecaAnnual));
    const van = Math.round(Number(vanMonthly));
    if ([school, eca, van].some(value => !Number.isFinite(value) || value < 0)) {
      setFormError('Fee amounts must be zero or more.');
      return;
    }
    if (eca > 0 && ecaMonths.length === 0) {
      setFormError('Pick the months the ECA fee is spread across — otherwise it can never fall due.');
      return;
    }
    if (van > 0 && vanMonths.length === 0) {
      setFormError('Pick the months this student rides the van.');
      return;
    }
    if (!actor) {
      setFormError('Your session has no signed-in user. Refresh the app and sign in again.');
      return;
    }

    const patch: Partial<EditableRow> = {};
    if (school !== (row.schoolFee ?? 0)) patch.schoolFee = school;
    if (eca !== (row.ecaAnnual ?? 0)) patch.ecaAnnual = eca;
    if (van !== (row.vanMonthly ?? 0)) patch.vanMonthly = van;
    if (!sameMonths(ecaMonths, inAcademicOrder(row.ecaMonths ?? []))) patch.ecaMonths = ecaMonths;
    if (!sameMonths(vanMonths, inAcademicOrder(row.vanMonths ?? []))) patch.vanMonths = vanMonths;
    if (notes.trim() !== (row.notes ?? '')) patch.notes = notes.trim();

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await PrincipalRegisterService.updateRow(row.id, patch, actor);
      const refreshed = await onSaved();
      showToast(
        refreshed ? `${row.name} updated` : refreshFailedMessage(`${row.name} updated`),
        refreshed ? 'success' : 'warning',
      );
      onClose();
    } catch (e) {
      console.error('[principal-register] fee edit failed', e);
      setFormError(describeError(e, 'The change was NOT saved. Please retry.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title={`Edit fees — ${row.name}`}
      size={narrow ? 'full' : 'md'}
    >
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
          {row.className}{row.sectionName ? ` · ${row.sectionName}` : ''}
          {row.rollNo ? ` · Roll ${row.rollNo}` : ''}
        </p>

        {auditNotice && <NoticeBanner tone="info">{auditNotice}</NoticeBanner>}

        <Input
          label="School fees (year)"
          type="number"
          min={0}
          inputMode="numeric"
          value={schoolFee}
          onChange={e => setSchoolFee(e.target.value)}
          hint="Due immediately, not month by month."
        />

        <Input
          label="ECA fees (year)"
          type="number"
          min={0}
          inputMode="numeric"
          value={ecaAnnual}
          onChange={e => setEcaAnnual(e.target.value)}
          hint={ecaPerMonth
            ? `Split across ${ecaMonths.length} month${ecaMonths.length === 1 ? '' : 's'} — ${ecaPerMonth} each.`
            : 'Pick the months below to spread this amount.'}
        />
        <MonthChips
          label="ECA months"
          selected={ecaMonths}
          onToggle={month => setEcaMonths(prev => toggle(prev, month))}
          hint="A month falls due only after it ends."
        />

        <Input
          label="Van fees (per month)"
          type="number"
          min={0}
          inputMode="numeric"
          value={vanMonthly}
          onChange={e => setVanMonthly(e.target.value)}
          hint={vanMonths.length > 0
            ? `Charged for ${vanMonths.length} month${vanMonths.length === 1 ? '' : 's'}.`
            : 'No van months selected — nothing is charged.'}
        />
        <MonthChips
          label="Van months"
          selected={vanMonths}
          onToggle={month => setVanMonths(prev => toggle(prev, month))}
        />

        <Textarea
          label="Notes (optional)"
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        {formError && <NoticeBanner tone="error">{formError}</NoticeBanner>}

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
