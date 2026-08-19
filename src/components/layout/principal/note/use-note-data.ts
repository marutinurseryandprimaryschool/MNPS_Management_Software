'use client';

/* ============================================
   Fees Note — data hook
   ============================================
   Loads the register rows, the payments and the settings for one academic
   year, then runs every row through the engine. Screens never call Firestore
   directly: reads go through PrincipalRegisterService / PrincipalPaymentsService
   / PrincipalSettingsService, and every rupee comes from computeRowSummary.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeRowSummary, emptyRowSummary } from '@/lib/principal-fees';
import {
  PrincipalPaymentsService, PrincipalRegisterService, PrincipalSettingsService,
} from '@/lib/principal-service';
import type {
  PrincipalPayment, PrincipalSettings, RegisterRow, RowSummary,
} from '@/types/principal';
import { describeReadError } from '../principal-shared';

export interface NoteTotals {
  students: number;
  charged: number;
  paid: number;
  pending: number;
  dueNow: number;
}

const EMPTY_TOTALS: NoteTotals = {
  students: 0, charged: 0, paid: 0, pending: 0, dueNow: 0,
};

export interface NoteData {
  rows: RegisterRow[];
  payments: PrincipalPayment[];
  paymentsFor: (rowId: string) => PrincipalPayment[];
  summaryFor: (rowId: string) => RowSummary;
  settings: PrincipalSettings | null;
  totals: NoteTotals;
  loading: boolean;
  error: string | null;
  /** Refetch everything. THROWS on failure so post-write callers can tell. */
  reload: () => Promise<void>;
  /** Refetch and own the loading/error state — the first load and Retry. */
  retry: () => Promise<void>;
  /** Optimistic, immutable field patch on one row — writes nothing. */
  patchRow: (rowId: string, patch: Partial<RegisterRow>) => void;
}

export function useNoteData(academicYear: string): NoteData {
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [payments, setPayments] = useState<PrincipalPayment[]>([]);
  const [settings, setSettings] = useState<PrincipalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ONE clock for the whole screen. Two rows judged against different "today"
  // values could disagree about whether a month has ended.
  const [today] = useState(() => new Date());

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const reload = useCallback(async () => {
    if (!academicYear) return;
    const [rowList, paymentList, saved] = await Promise.all([
      PrincipalRegisterService.listRows(academicYear),
      PrincipalPaymentsService.listByYear(academicYear),
      PrincipalSettingsService.get(),
    ]);
    if (!aliveRef.current) return;
    setRows(rowList);
    setPayments(paymentList);
    setSettings(saved);
  }, [academicYear]);

  const retry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await reload();
    } catch (err) {
      console.error('[fees-note] load failed', { academicYear, error: err });
      setError(describeReadError(err, 'the fees note'));
    } finally {
      setLoading(false);
    }
  }, [reload, academicYear]);

  useEffect(() => { void retry(); }, [retry]);

  const paymentsByRow = useMemo(() => {
    const byRow = new Map<string, PrincipalPayment[]>();
    for (const payment of payments) {
      const existing = byRow.get(payment.rowId);
      if (existing) existing.push(payment);
      else byRow.set(payment.rowId, [payment]);
    }
    return byRow;
  }, [payments]);

  const summaries = useMemo(() => {
    const byRow = new Map<string, RowSummary>();
    for (const row of rows) {
      byRow.set(row.id, computeRowSummary(row, paymentsByRow.get(row.id) ?? [], today));
    }
    return byRow;
  }, [rows, paymentsByRow, today]);

  const totals = useMemo<NoteTotals>(() => {
    let running = { ...EMPTY_TOTALS, students: rows.length };
    for (const summary of summaries.values()) {
      running = {
        students: running.students,
        charged: running.charged + summary.totalCharged,
        paid: running.paid + summary.totalPaid,
        pending: running.pending + summary.totalPending,
        dueNow: running.dueNow + summary.totalDueNow,
      };
    }
    return running;
  }, [rows.length, summaries]);

  const summaryFor = useCallback(
    (rowId: string): RowSummary => summaries.get(rowId) ?? emptyRowSummary(),
    [summaries],
  );

  const paymentsFor = useCallback(
    (rowId: string): PrincipalPayment[] => paymentsByRow.get(rowId) ?? [],
    [paymentsByRow],
  );

  const patchRow = useCallback((rowId: string, patch: Partial<RegisterRow>) => {
    setRows(prev => prev.map(row => (row.id === rowId ? { ...row, ...patch } : row)));
  }, []);

  return {
    rows, payments, paymentsFor, summaryFor, settings, totals,
    loading, error, reload, retry, patchRow,
  };
}
