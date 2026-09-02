'use client';

/* ============================================
   Principal Accounts — day close (Phase 3 §16–§17)
   ============================================
   The end-of-day drawer count. The ledger says what cash SHOULD be in hand;
   the Principal types what she actually counted; the panel shows the
   difference and closes the day.

   A CLOSED day rejects new or edited payments and expenses on that date —
   enforced by firestore.rules, not just this screen — until the Principal
   reopens it (the auditable correction path: reopen → correct → close again).

   Money math: expectedCash arrives from computeDailyLedger (the caller);
   the difference/assessment comes from computeDayCloseAssessment. Nothing is
   computed here beyond wiring the two together for preview.
*/

import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import Input, { Textarea } from '@/components/ui/Input';
import { computeDayCloseAssessment } from '@/lib/principal-fees';
import {
  EXPENSE_COLOR, INCOME_COLOR, dateKeyLabel, formatINR, formatSignedINR,
  panelHeaderStyle, panelStyle,
} from '../principal-shared';
import type { DayCloseAssessment, PrincipalDayClose } from '@/types/principal';

const ASSESSMENT_LABEL: Record<DayCloseAssessment, string> = {
  matched: 'MATCHED',
  short: 'SHORT',
  excess: 'EXCESS',
};

const ASSESSMENT_COLOR: Record<DayCloseAssessment, string> = {
  matched: 'var(--color-success)',
  short: 'var(--color-error)',
  excess: 'var(--color-warning)',
};

function AssessmentChip({ assessment }: { assessment: DayCloseAssessment }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--radius-full)',
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
      color: ASSESSMENT_COLOR[assessment], background: 'var(--color-surface-variant)',
    }}>
      {ASSESSMENT_LABEL[assessment]}
    </span>
  );
}

function MoneyRow({ label, value, color, bold }: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '4px 0' }}>
      <span className="text-body-sm" style={{ fontWeight: bold ? 700 : 400, color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <span className="text-body-sm" style={{ fontWeight: 700, color: color ?? 'var(--color-text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

export interface DayClosePanelProps {
  dateKey: string;
  /** Ledger figures for the date, from computeDailyLedger. */
  cashCollected: number;
  cashSpent: number;
  expectedCash: number;
  /** The stored close record for this date, or null when the day is open. */
  record: PrincipalDayClose | null;
  /** True when the day-close rules are not deployed — the feature is off. */
  unavailable?: boolean;
  busy: boolean;
  onCloseDay: (actualCash: number, note: string) => void;
  onReopenDay: () => void;
}

export default function DayClosePanel({
  dateKey, cashCollected, cashSpent, expectedCash, record, unavailable = false,
  busy, onCloseDay, onReopenDay,
}: DayClosePanelProps) {
  const [actual, setActual] = useState('');
  const [note, setNote] = useState('');
  /** §17: the summary must be confirmed before anything is written. */
  const [confirming, setConfirming] = useState(false);

  const isClosed = record?.status === 'closed';
  const actualValue = Math.round(Number(actual));
  const actualValid = Number.isFinite(actualValue) && actual.trim() !== '' && actualValue >= 0;
  const preview = actualValid ? computeDayCloseAssessment(expectedCash, actualValue) : null;

  const reset = () => { setActual(''); setNote(''); setConfirming(false); };

  /* ── Feature not switched on yet: say so, don't offer a failing button ── */
  if (unavailable) {
    return (
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>
          <span className="text-overline">Day close — {dateKeyLabel(dateKey)}</span>
          <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
            not enabled yet
          </span>
        </div>
        <div style={{ padding: 'var(--space-4)' }}>
          <MoneyRow label="Cash collected" value={formatINR(cashCollected)} color={INCOME_COLOR} />
          <MoneyRow label="Cash expenses" value={formatINR(cashSpent)} color={EXPENSE_COLOR} />
          <div style={{ borderTop: '1px solid var(--color-divider)', marginTop: 4, paddingTop: 'var(--space-2)' }}>
            <MoneyRow label="Expected Cash in Hand" value={formatINR(expectedCash)} bold />
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', margin: 'var(--space-3) 0 0' }}>
            The figures above are live. Recording the counted cash needs the updated security
            rules deployed to Firebase — until then, day close stays switched off.
          </p>
        </div>
      </div>
    );
  }

  /* ── Closed: the record, loud and final ── */
  if (isClosed && record) {
    return (
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>
          <span className="text-overline">Day close — {dateKeyLabel(record.dateKey)}</span>
          <span style={{
            fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em',
            color: 'var(--color-success)',
          }}>
            CLOSED
          </span>
        </div>
        <div style={{ padding: 'var(--space-4)' }}>
          <MoneyRow label="Expected Cash" value={formatINR(record.expectedCash)} />
          <MoneyRow label="Actual Cash counted" value={formatINR(record.actualCash)} />
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 'var(--space-2)', paddingTop: 'var(--space-2)', marginTop: 4,
            borderTop: '1px solid var(--color-divider)',
          }}>
            <span className="text-body-sm" style={{ fontWeight: 700 }}>Difference</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontWeight: 700, color: ASSESSMENT_COLOR[record.assessment] }}>
                {formatSignedINR(record.difference)}
              </span>
              <AssessmentChip assessment={record.assessment} />
            </span>
          </div>
          {record.note && (
            <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', margin: 'var(--space-3) 0 0' }}>
              Note: {record.note}
            </p>
          )}
          <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', margin: 'var(--space-3) 0 0' }}>
            Closed by {record.closedByName}. New payments and expenses on this date are blocked.
            To record a correction, reopen the day, correct, and close it again — every step is
            kept in the activity log.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
            <Button variant="secondary" onClick={onReopenDay} disabled={busy}>
              Reopen for corrections
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Open (or reopened): count the drawer ── */
  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <span className="text-overline">Day close — {dateKeyLabel(dateKey)}</span>
        {record?.status === 'reopened' && (
          <span className="text-caption" style={{ color: 'var(--color-warning)', fontWeight: 700 }}>
            REOPENED — close again when the correction is done
          </span>
        )}
      </div>

      <div style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
        <div>
          <MoneyRow label="Cash collected" value={formatINR(cashCollected)} color={INCOME_COLOR} />
          <MoneyRow label="Cash expenses" value={formatINR(cashSpent)} color={EXPENSE_COLOR} />
          <div style={{ borderTop: '1px solid var(--color-divider)', marginTop: 4, paddingTop: 'var(--space-2)' }}>
            <MoneyRow label="Expected Cash in Hand" value={formatINR(expectedCash)} bold />
          </div>
        </div>

        {!confirming ? (
          <>
            <Input
              label="Actual Cash Counted"
              type="number"
              min={0}
              inputMode="numeric"
              value={actual}
              onChange={e => setActual(e.target.value)}
              hint="Count the drawer, then type the total here."
            />
            {preview && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)', background: 'var(--color-surface-variant)',
              }}>
                <span className="text-body-sm" style={{ fontWeight: 600 }}>Difference</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ fontWeight: 700, color: ASSESSMENT_COLOR[preview.assessment] }}>
                    {formatSignedINR(preview.difference)}
                  </span>
                  <AssessmentChip assessment={preview.assessment} />
                </span>
              </div>
            )}
            {preview && preview.assessment !== 'matched' && (
              <Textarea
                label="Note (why the difference?)"
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. ₹500 expense receipt missing"
              />
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={() => setConfirming(true)} disabled={!actualValid || busy}>
                Close Day
              </Button>
            </div>
          </>
        ) : (
          /* §17: one confirmation with every number, then commit. */
          <div style={{
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-2)',
          }}>
            <span className="text-overline">Confirm day close</span>
            <MoneyRow label="Date" value={dateKeyLabel(dateKey)} />
            <MoneyRow label="Cash collected" value={formatINR(cashCollected)} color={INCOME_COLOR} />
            <MoneyRow label="Cash expenses" value={formatINR(cashSpent)} color={EXPENSE_COLOR} />
            <MoneyRow label="Expected Cash" value={formatINR(expectedCash)} />
            <MoneyRow label="Actual Cash" value={formatINR(actualValue)} bold />
            {preview && (
              <MoneyRow
                label={`Difference (${ASSESSMENT_LABEL[preview.assessment]})`}
                value={formatSignedINR(preview.difference)}
                color={ASSESSMENT_COLOR[preview.assessment]}
                bold
              />
            )}
            {note.trim() && <MoneyRow label="Note" value={note.trim()} />}
            <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
              Closing blocks new payments and expenses on this date until you reopen it.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                Back
              </Button>
              <Button
                variant="primary"
                loading={busy}
                disabled={busy}
                onClick={() => { onCloseDay(actualValue, note.trim()); reset(); }}
              >
                Confirm Day Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
