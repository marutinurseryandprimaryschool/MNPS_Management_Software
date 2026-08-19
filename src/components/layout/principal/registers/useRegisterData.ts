'use client';

/* ============================================
   Principal Register — one load, many views
   ============================================
   The class-wise register, the teacher-wise register and the arrears report
   all render the SAME rows and the SAME payments. They share this hook so a
   student's numbers can never disagree between two screens.

   Screens never touch Firestore: everything goes through principal-service,
   and every total comes out of the pure engine in principal-fees.
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeRowSummary, emptyRowSummary } from '@/lib/principal-fees';
import {
  PrincipalPaymentsService, PrincipalRegisterService, PrincipalSettingsService,
} from '@/lib/principal-service';
import { refreshAfterWrite } from '@/components/layout/admin/fees/error-policy';
import type {
  PrincipalPayment, PrincipalSettings, RegisterRow, RowSummary,
} from '@/types/principal';
import { describeError } from './register-shared';

export interface RegisterData {
  rows: RegisterRow[];
  paymentsByRowId: Record<string, PrincipalPayment[]>;
  /**
   * Register settings, or null when they are unset or unreadable. Only the
   * default month schedules are used here — a fee amount typed onto a row with
   * no months would charge nothing, so every editor needs these defaults.
   */
  settings: PrincipalSettings | null;
  /** Memoized per-row engine output. Unknown ids get a zeroed summary. */
  summaryFor: (rowId: string) => RowSummary;
  paymentsFor: (rowId: string) => PrincipalPayment[];
  /** The instant the data was loaded — every "is this month due?" test uses it. */
  today: Date;
  loading: boolean;
  error: string | null;
  /** Full reload with a visible loading state. For first paint and Retry. */
  reload: () => Promise<void>;
  /**
   * Post-commit refetch. NEVER throws and never sets `error`: a failed refetch
   * after a COMMITTED write must not read as "not saved". Returns false when
   * the list is stale so the caller can say "reload to see the latest".
   */
  refreshQuietly: () => Promise<boolean>;
}

interface Snapshot {
  rows: RegisterRow[];
  payments: PrincipalPayment[];
  settings: PrincipalSettings | null;
  today: Date;
}

const EMPTY: Snapshot = { rows: [], payments: [], settings: null, today: new Date(0) };

export function useRegisterData(academicYear: string | undefined): RegisterData {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async (): Promise<Snapshot> => {
    if (!academicYear) return { ...EMPTY, today: new Date() };
    const [rows, payments, settings] = await Promise.all([
      PrincipalRegisterService.listRows(academicYear),
      PrincipalPaymentsService.listByYear(academicYear),
      // Never fatal: the register must still open when settings are missing,
      // and the month helpers fall back to the full academic year.
      PrincipalSettingsService.get().catch(settingsError => {
        console.error('[principal-register] settings load failed', settingsError);
        return null;
      }),
    ]);
    // `today` is stamped per load, so the arrears view re-evaluates which
    // months have ended every time the screen refreshes.
    return { rows, payments, settings, today: new Date() };
  }, [academicYear]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchSnapshot());
    } catch (e) {
      console.error('[principal-register] load failed', e);
      setError(describeError(e, 'Could not load the register. Please retry.'));
    } finally {
      setLoading(false);
    }
  }, [fetchSnapshot]);

  const refreshQuietly = useCallback(
    () => refreshAfterWrite(async () => { setSnapshot(await fetchSnapshot()); }),
    [fetchSnapshot],
  );

  useEffect(() => { void reload(); }, [reload]);

  const paymentsByRowId = useMemo(() => {
    const grouped: Record<string, PrincipalPayment[]> = {};
    for (const payment of snapshot.payments) {
      const rowId = payment.rowId || '';
      if (!rowId) continue;
      grouped[rowId] = [...(grouped[rowId] ?? []), payment];
    }
    return grouped;
  }, [snapshot.payments]);

  const summaries = useMemo(() => {
    const map = new Map<string, RowSummary>();
    for (const row of snapshot.rows) {
      map.set(row.id, computeRowSummary(row, paymentsByRowId[row.id] ?? [], snapshot.today));
    }
    return map;
  }, [snapshot.rows, snapshot.today, paymentsByRowId]);

  const summaryFor = useCallback(
    (rowId: string): RowSummary => summaries.get(rowId) ?? emptyRowSummary(),
    [summaries],
  );

  const paymentsFor = useCallback(
    (rowId: string): PrincipalPayment[] => paymentsByRowId[rowId] ?? [],
    [paymentsByRowId],
  );

  return {
    rows: snapshot.rows,
    paymentsByRowId,
    settings: snapshot.settings,
    summaryFor,
    paymentsFor,
    today: snapshot.today,
    loading,
    error,
    reload,
    refreshQuietly,
  };
}
