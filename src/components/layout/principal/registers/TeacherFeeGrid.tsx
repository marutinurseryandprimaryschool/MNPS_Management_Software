'use client';

/* ============================================
   Teacher register — desktop inline fee grid
   ============================================
   The PC half of the teacher-wise register: a data grid with the student name
   frozen in the first column and the three fee amounts editable in place.

   Keyboard model (matches the fees note):
     Tab    — native, moves to the next cell across the row
     Enter  — commits and drops into the same column of the next student
     Esc    — abandons the edit and restores the stored value
   A cell commits on blur too, so clicking away never loses a typed number.

   Every commit goes through PrincipalRegisterService.updateRow, which writes
   the activity-log entry in the same batch. A failed write keeps the typed
   value on screen (marked red) rather than silently reverting it, so nothing
   the teacher typed disappears without them being told.

   An ECA or van amount is never written on its own: the engine derives every
   due from the MONTH schedule, so an amount on a row with no months charges
   ₹0. A commit therefore carries the seeded month list with it, exactly as
   the fees note does (see monthsForAmount).

   The phone build never renders this — see TeacherOwnRegister.
*/

import React, { useCallback, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { PrincipalRegisterService } from '@/lib/principal-service';
import type { NewRegisterRow, PrincipalActor, RegisterRow, RowSummary } from '@/types/principal';
import { fieldPatch, monthsForAmount } from '../note/note-helpers';
import { describeError } from './register-shared';
import {
  Money, table, tableScroll, td, tdRight, tdSticky, thRight, thSticky,
} from './register-ui';

/** The three amounts that are editable in place. Month sets need the sheet. */
type NumericField = 'schoolFee' | 'ecaAnnual' | 'vanMonthly';

const FIELDS: { key: NumericField; label: string; title: string }[] = [
  { key: 'schoolFee', label: 'School fee', title: 'Annual school fee — due immediately' },
  { key: 'ecaAnnual', label: 'ECA / year', title: 'Annual ECA fee, split across the ECA months' },
  { key: 'vanMonthly', label: 'Van / month', title: 'Van charge for each van month' },
];

const cellKey = (rowId: string, field: NumericField): string => `${rowId}::${field}`;

/** Which month list a typed amount has to schedule, and where its default comes from. */
const MONTH_FIELD: Partial<Record<NumericField, 'ecaMonths' | 'vanMonths'>> = {
  ecaAnnual: 'ecaMonths',
  vanMonthly: 'vanMonths',
};

export interface TeacherFeeGridProps {
  rows: RegisterRow[];
  summaryFor: (rowId: string) => RowSummary;
  actor: PrincipalActor | null;
  canEditFees: boolean;
  /**
   * Per-row override. A teacher now sees their whole class-section, but
   * firestore.rules only lets them edit rows the Principal formally handed
   * over (teacherUid == their uid). Rows failing this render read-only, so
   * the grid never offers a keystroke the server would reject.
   */
  canEditRow?: (row: RegisterRow) => boolean;
  /** Principal's default schedules; the full academic year when unset. */
  defaultEcaMonths?: string[];
  defaultVanMonths?: string[];
  onOpen: (row: RegisterRow) => void;
  onEditMonths: (row: RegisterRow) => void;
  onRecordPayment?: (row: RegisterRow) => void;
  onSaved: () => Promise<boolean>;
}

export default function TeacherFeeGrid({
  rows, summaryFor, actor, canEditFees, canEditRow, defaultEcaMonths, defaultVanMonths,
  onOpen, onEditMonths, onRecordPayment, onSaved,
}: TeacherFeeGridProps) {
  const { showToast } = useToast();
  const inputs = useRef(new Map<string, HTMLInputElement>());
  /**
   * Synchronous in-flight guard. Enter commits and then moves focus, which
   * fires blur on the cell it just left — a state-based flag would still read
   * `false` in that same tick and write the row twice.
   */
  const inFlight = useRef(new Set<string>());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [failedKeys, setFailedKeys] = useState<Record<string, boolean>>({});

  const setDraft = useCallback((key: string, value: string | null) => setDrafts(prev => (
    value === null
      ? Object.fromEntries(Object.entries(prev).filter(([entryKey]) => entryKey !== key))
      : { ...prev, [key]: value }
  )), []);

  const commit = useCallback(async (row: RegisterRow, field: NumericField) => {
    const key = cellKey(row.id, field);
    const draft = drafts[key];
    if (draft === undefined || inFlight.current.has(key)) return;

    const stored = Number(row[field] ?? 0);
    const value = Math.round(Number(draft));

    if (draft.trim() === '' || !Number.isFinite(value) || value < 0) {
      setDraft(key, null);
      setFailedKeys(prev => ({ ...prev, [key]: false }));
      showToast('Fee amounts must be a number, zero or more — the old value was kept.', 'error');
      return;
    }
    if (value === stored) {
      setDraft(key, null);
      return;
    }
    if (!actor) {
      showToast('Your session has no signed-in user. Refresh the app and sign in again.', 'error');
      return;
    }

    // An ECA / van amount with no months attached charges NOTHING, because the
    // engine bills per scheduled month (and defaults van to no months at all).
    // Seed the schedule in the SAME patch, or "Van 500" saves green and bills
    // ₹0. firestore.rules keeps ecaMonths/vanMonths inside the field set a
    // responsible teacher may write, so this stays within their permissions.
    const patch: Partial<NewRegisterRow> = fieldPatch(field, value);
    const monthField = MONTH_FIELD[field];
    const seededMonths = monthField
      ? monthsForAmount(
        value,
        row[monthField],
        monthField === 'ecaMonths' ? defaultEcaMonths : defaultVanMonths,
      )
      : null;
    if (monthField && seededMonths) patch[monthField] = seededMonths;

    inFlight.current.add(key);
    setSavingKeys(prev => ({ ...prev, [key]: true }));
    try {
      await PrincipalRegisterService.updateRow(row.id, patch, actor);
      // Committed. From here a refetch failure is NOT a save failure.
      const refreshed = await onSaved();
      setDraft(key, null);
      setFailedKeys(prev => ({ ...prev, [key]: false }));
      if (!refreshed) {
        showToast('Saved — but the list could not refresh. Reload to see the latest.', 'warning');
      } else if (seededMonths) {
        // Say which months are now being billed — the teacher only typed an
        // amount, and the schedule decides what the student actually owes.
        showToast(
          `Scheduled across ${seededMonths.length} month${seededMonths.length === 1 ? '' : 's'}`
          + ` for ${row.name}. Use “Months” to change which ones.`,
          'info',
        );
      }
    } catch (e) {
      console.error('[principal-register] inline fee edit failed', e);
      setFailedKeys(prev => ({ ...prev, [key]: true }));
      showToast(describeError(e, 'The change was NOT saved. Please retry.'), 'error');
    } finally {
      inFlight.current.delete(key);
      setSavingKeys(prev => ({ ...prev, [key]: false }));
    }
  }, [drafts, actor, onSaved, showToast, setDraft, defaultEcaMonths, defaultVanMonths]);

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    row: RegisterRow,
    field: NumericField,
    index: number,
  ) => {
    const key = cellKey(row.id, field);
    if (event.key === 'Escape') {
      // Abandon the edit WITHOUT blurring: a blur here would fire onBlur with
      // the pre-clear closure and commit the value the user just cancelled.
      // Focus stays in the cell, now showing the stored number again.
      event.preventDefault();
      setDraft(key, null);
      setFailedKeys(prev => ({ ...prev, [key]: false }));
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    // Moving focus fires blur on this cell, and blur is what commits — so the
    // commit happens exactly once whether or not there is a next row.
    const next = rows[index + 1];
    const target = next ? inputs.current.get(cellKey(next.id, field)) : undefined;
    if (target) target.focus();
    else event.currentTarget.blur();
  };

  return (
    <div style={tableScroll}>
      <table style={table}>
        <thead>
          <tr>
            <th style={thSticky}>Student</th>
            {FIELDS.map(field => (
              <th key={field.key} style={thRight} title={field.title}>{field.label}</th>
            ))}
            <th style={thRight}>Collected</th>
            <th style={thRight}>Pending</th>
            <th style={thRight}>Due now</th>
            <th style={thRight}>&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const summary = summaryFor(row.id);
            return (
              <tr key={row.id}>
                <td style={tdSticky}>
                  <button
                    type="button"
                    onClick={() => onOpen(row)}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      font: 'inherit', fontWeight: 600, color: 'var(--color-text-primary)',
                      textAlign: 'left', textDecoration: 'underline dotted',
                    }}
                    title="Open the month-by-month breakdown"
                  >
                    {row.name}
                  </button>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
                    {[row.className, row.sectionName].filter(Boolean).join(' · ')}
                  </div>
                </td>

                {FIELDS.map(field => {
                  const key = cellKey(row.id, field.key);
                  const value = drafts[key] ?? String(row[field.key] ?? 0);
                  return (
                    <td key={field.key} style={{ ...tdRight, padding: '4px 6px' }}>
                      <input
                        ref={element => {
                          if (element) inputs.current.set(key, element);
                          else inputs.current.delete(key);
                        }}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        disabled={!canEditFees || (canEditRow ? !canEditRow(row) : false) || savingKeys[key]}
                        value={value}
                        aria-label={`${field.label} for ${row.name}`}
                        onChange={event => setDraft(key, event.target.value)}
                        onKeyDown={event => handleKeyDown(event, row, field.key, index)}
                        onBlur={() => { void commit(row, field.key); }}
                        style={{
                          width: 96, textAlign: 'right', padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)', fontSize: '0.85rem',
                          fontFamily: 'inherit', background: 'var(--color-surface)',
                          color: 'var(--color-text-primary)',
                          border: `1px solid ${failedKeys[key]
                            ? 'var(--color-error)'
                            : drafts[key] !== undefined ? 'var(--color-warning)' : 'var(--color-border)'}`,
                        }}
                      />
                    </td>
                  );
                })}

                <td style={tdRight}><Money amount={summary.totalPaid} tone="paid" /></td>
                <td style={tdRight}><Money amount={summary.totalPending} tone="pending" /></td>
                <td style={tdRight}><Money amount={summary.totalDueNow} tone="due" bold /></td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Button variant="ghost" size="sm" onClick={() => onEditMonths(row)}>Months</Button>
                  {onRecordPayment && (
                    <Button variant="secondary" size="sm" onClick={() => onRecordPayment(row)}>
                      Record payment
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
