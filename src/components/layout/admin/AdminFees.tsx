'use client';
/* Fee management screen — capability-per-tab, engine-backed
   (docs/designs/principal-role-fees-accounts.md):
   - Overview: viewAllFees (admin-like) — all numbers from the fee engine.
   - Structures: manageFeeStructures — ecaMonths, term due dates, nudges.
   - Payments: enterFeePayments (principal) — entry, edit, soft-delete,
     per-payment history; every mutation batches with an audit entry.
   NO inline fee math lives here — src/lib/fee-utils.ts is the engine. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BusRoutesService, ClassesService, FeePaymentsService, FeeStructuresService, StudentsService,
} from '@/lib/firestore-service';
import Button from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/SharedUI';
import { PlusIcon } from '@/components/ui/Icons';
import { formatCompactCurrency } from '@/lib/utils';
import { hasCapability } from '@/lib/permissions';
import {
  computeStudentFeeSummary, excludeDeleted, paymentDateKey, type StudentFeeSummary,
} from '@/lib/fee-utils';
import StructureModal from './fees/StructureModal';
import StructuresSection from './fees/StructuresSection';
import PaymentModal from './fees/PaymentModal';
import PaymentEditModal from './fees/PaymentEditModal';
import PaymentHistoryModal from './fees/PaymentHistoryModal';
import PaymentsSection from './fees/PaymentsSection';
import FeeOverviewSection from './fees/FeeOverviewSection';
import ClassDrilldown from './fees/ClassDrilldown';
import FeeAdjustModal from './fees/FeeAdjustModal';
import { softDeletePaymentWithHistory } from './fees/payment-mutations';
import {
  describeWriteError, isBrowserOffline, OFFLINE_NOT_SAVED_MESSAGE,
  refreshAfterWrite, refreshFailedMessage,
} from './fees/error-policy';
import type { BusRoute, Class, FeePayment, FeeStructure, Student } from '@/types/models';

const DELETE_PAYMENT_PERMISSION_MESSAGE = 'Only the Principal can delete fee payments.';
const STRUCTURE_PERMISSION_MESSAGE =
  'Only admin, principal, or correspondent can manage fee structures.';

function AccessNote({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
      <p className="text-body" style={{ fontWeight: 500 }}>{message}</p>
    </div>
  );
}

export default function AdminFees({ subPage }: { subPage?: 'overview' | 'structures' | 'payments' }) {
  const { user, role } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  const effectiveView = subPage || 'all';

  // ── Capabilities (UI gating; firestore.rules is the enforcement surface) ──
  const canViewAllFees = hasCapability(role, 'viewAllFees');
  const canManageStructures = hasCapability(role, 'manageFeeStructures');
  const canManageScholarships = hasCapability(role, 'manageScholarships');
  const canEnterPayments = hasCapability(role, 'enterFeePayments');
  const canEditPayments = hasCapability(role, 'editFeePayments');

  // ── Data ──
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>([]);
  const [loading, setLoading] = useState(true);

  // ── UI state ──
  const [viewingClassId, setViewingClassId] = useState<string | null>(null);
  const [viewingSectionId, setViewingSectionId] = useState<string | null>(null);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);
  const [deleteStructureTarget, setDeleteStructureTarget] = useState<FeeStructure | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payStudent, setPayStudent] = useState<Student | null>(null);
  const [editPaymentTarget, setEditPaymentTarget] = useState<FeePayment | null>(null);
  const [historyPaymentTarget, setHistoryPaymentTarget] = useState<FeePayment | null>(null);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<FeePayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [feeAdjustStudent, setFeeAdjustStudent] = useState<Student | null>(null);

  const refreshData = useCallback(async () => {
    if (!school?.academicYear) return;
    const [fs, p, c, s, br] = await Promise.all([
      FeeStructuresService.getAll(school.academicYear),
      FeePaymentsService.getAll(school.academicYear),
      ClassesService.getAll(school.academicYear),
      StudentsService.getAll(school.academicYear),
      BusRoutesService.getAll(),
    ]);
    setFeeStructures(fs as unknown as FeeStructure[]);
    // Newest first by collection date, then entry time.
    const sorted = [...(p as unknown as FeePayment[])].sort((a, b) => {
      const ka = paymentDateKey(a) || '';
      const kb = paymentDateKey(b) || '';
      if (ka !== kb) return ka < kb ? 1 : -1;
      const ta = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const tb = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return tb - ta;
    });
    setPayments(sorted);
    setClasses(c as unknown as Class[]);
    setStudents(s as unknown as Student[]);
    setBusRoutes(br as unknown as BusRoute[]);
  }, [school?.academicYear]);

  useEffect(() => {
    refreshData()
      .catch(e => {
        console.error('Fee data load failed', e);
        showToast('Failed to load fee data — refresh to retry.', 'error');
      })
      .finally(() => setLoading(false));
    // showToast is stable (useCallback in provider).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshData]);

  // ── Engine summaries (the ONLY source of dues/pending numbers) ──
  const scholarships = useMemo(() => school?.settings?.scholarships || [], [school]);
  const livePayments = useMemo(() => excludeDeleted(payments), [payments]);

  const paymentsByStudent = useMemo(() => {
    const map: Record<string, FeePayment[]> = {};
    for (const p of payments) {
      if (!map[p.studentId]) map[p.studentId] = [];
      map[p.studentId].push(p);
    }
    return map;
  }, [payments]);

  const summaries = useMemo(() => {
    const map = new Map<string, StudentFeeSummary>();
    for (const st of students) {
      const structure = feeStructures.find(fs => fs.classId === st.classId) || null;
      map.set(st.id, computeStudentFeeSummary({
        structure,
        student: st,
        busRoutes,
        scholarships,
        academicYear: school?.academicYear,
      }, paymentsByStudent[st.id] || []));
    }
    return map;
  }, [students, feeStructures, busRoutes, scholarships, paymentsByStudent, school?.academicYear]);

  const getSummary = useCallback(
    (studentId: string) => summaries.get(studentId) || null,
    [summaries],
  );

  // ── Structure delete (hard delete allowed for structures, confirmed) ──
  const handleConfirmDeleteStructure = async () => {
    if (!deleteStructureTarget) return;
    if (isBrowserOffline()) { showToast(OFFLINE_NOT_SAVED_MESSAGE, 'error'); return; }
    const target = deleteStructureTarget;
    setDeleteStructureTarget(null);
    try {
      await FeeStructuresService.delete(target.id);
    } catch (e) {
      console.error('Fee structure delete failed', { structureId: target.id, error: e });
      showToast(describeWriteError(e, STRUCTURE_PERMISSION_MESSAGE), 'error');
      return;
    }
    // Delete IS committed — a refetch failure must not read as a failed delete.
    const refreshed = await refreshAfterWrite(refreshData);
    showToast(
      refreshed ? 'Fee structure deleted' : refreshFailedMessage('Fee structure deleted'),
      refreshed ? 'success' : 'warning',
    );
  };

  // ── Payment soft delete (deleted:true + history entry in ONE batch) ──
  const handleConfirmDeletePayment = async () => {
    if (!deletePaymentTarget || deletingPayment) return;
    if (isBrowserOffline()) { showToast(OFFLINE_NOT_SAVED_MESSAGE, 'error'); return; }
    setDeletingPayment(true);
    try {
      await softDeletePaymentWithHistory(
        deletePaymentTarget,
        { id: user?.id || '', name: user?.name || 'Principal' },
      );
    } catch (e) {
      console.error('Payment delete failed', { paymentId: deletePaymentTarget.id, error: e });
      showToast(describeWriteError(e, DELETE_PAYMENT_PERMISSION_MESSAGE), 'error');
      setDeletingPayment(false);
      return;
    }
    // Soft-delete IS committed — a refetch failure must not read as "not deleted".
    const refreshed = await refreshAfterWrite(refreshData);
    showToast(
      refreshed ? 'Payment deleted — kept in the audit history' : refreshFailedMessage('Payment deleted'),
      refreshed ? 'success' : 'warning',
    );
    setDeletePaymentTarget(null);
    setDeletingPayment(false);
  };

  const totalCollected = livePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const showOverview = (effectiveView === 'all' || effectiveView === 'overview') && canViewAllFees;
  const pageTitle = effectiveView === 'overview' ? 'Fee Overview'
    : effectiveView === 'structures' ? 'Fee Structures'
      : effectiveView === 'payments' ? 'Payments'
        : 'Fee Management';

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="text-h1">{pageTitle}</h2>
            <Badge variant="primary">{school?.academicYear}</Badge>
          </div>
          <p className="text-body-sm">Total Collected: {formatCompactCurrency(totalCollected)}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {canManageStructures && (effectiveView === 'all' || effectiveView === 'structures') && (
            <Button variant="secondary" onClick={() => { setEditingStructure(null); setShowStructureModal(true); }} icon={<PlusIcon size={18} />}>
              Fee Structure
            </Button>
          )}
          {canEnterPayments && (effectiveView === 'all' || effectiveView === 'payments') && (
            <Button variant="primary" onClick={() => { setPayStudent(null); setShowPaymentModal(true); }} icon={<PlusIcon size={18} color="white" />}>
              Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* ═══ OVERVIEW (engine-backed) ═══ */}
      {(effectiveView === 'all' || effectiveView === 'overview') && !canViewAllFees && (
        <AccessNote message="You don't have access to school-wide fee data." />
      )}
      {showOverview && !viewingClassId && (
        <FeeOverviewSection
          livePayments={livePayments}
          summaries={summaries}
          students={students}
          classes={classes}
          feeStructures={feeStructures}
          onOpenSection={(classId, sectionId) => { setViewingClassId(classId); setViewingSectionId(sectionId || null); }}
        />
      )}

      {/* ═══ CLASS DRILL-DOWN ═══ */}
      {showOverview && viewingClassId && (
        <ClassDrilldown
          classId={viewingClassId}
          sectionId={viewingSectionId}
          classes={classes}
          students={students}
          feeStructures={feeStructures}
          summaries={summaries}
          scholarships={scholarships}
          canEnterPayments={canEnterPayments}
          canManageScholarships={canManageScholarships}
          onBack={() => { setViewingClassId(null); setViewingSectionId(null); }}
          onPay={st => { setPayStudent(st); setShowPaymentModal(true); }}
          onAdjust={st => setFeeAdjustStudent(st)}
        />
      )}

      {/* ═══ STRUCTURES (manageFeeStructures) ═══ */}
      {effectiveView === 'structures' && (
        canManageStructures ? (
          <StructuresSection
            feeStructures={feeStructures}
            onEdit={fs => { setEditingStructure(fs); setShowStructureModal(true); }}
            onDelete={fs => setDeleteStructureTarget(fs)}
          />
        ) : (
          <AccessNote message="Only admin, principal, or correspondent can manage fee structures." />
        )
      )}

      {/* ═══ PAYMENTS (enterFeePayments — principal) ═══ */}
      {effectiveView === 'payments' && (
        canEnterPayments ? (
          <PaymentsSection
            payments={payments}
            canEditPayments={canEditPayments}
            onEdit={p => setEditPaymentTarget(p)}
            onDelete={p => setDeletePaymentTarget(p)}
            onHistory={p => setHistoryPaymentTarget(p)}
          />
        ) : (
          <AccessNote message="Only the Principal can record and manage fee payments." />
        )
      )}

      {/* ═══ MODALS ═══ */}
      {canManageStructures && (
        <StructureModal
          isOpen={showStructureModal}
          editing={editingStructure}
          classes={classes}
          academicYear={school?.academicYear || ''}
          onClose={() => { setShowStructureModal(false); setEditingStructure(null); }}
          onSaved={refreshData}
        />
      )}

      {canEnterPayments && (
        <PaymentModal
          isOpen={showPaymentModal}
          classes={classes}
          students={students}
          payments={payments}
          getSummary={getSummary}
          initialStudent={payStudent}
          onClose={() => { setShowPaymentModal(false); setPayStudent(null); }}
          onSaved={refreshData}
        />
      )}

      {canEditPayments && (
        <>
          <PaymentEditModal
            payment={editPaymentTarget}
            getSummary={getSummary}
            onClose={() => setEditPaymentTarget(null)}
            onSaved={refreshData}
          />
          <PaymentHistoryModal
            payment={historyPaymentTarget}
            onClose={() => setHistoryPaymentTarget(null)}
          />
          <ConfirmDialog
            isOpen={!!deletePaymentTarget}
            onClose={() => { if (!deletingPayment) setDeletePaymentTarget(null); }}
            onConfirm={() => void handleConfirmDeletePayment()}
            title="Delete payment?"
            message={deletePaymentTarget
              ? `₹${Number(deletePaymentTarget.amount).toLocaleString()} (${deletePaymentTarget.category}) for ${deletePaymentTarget.studentName} will be removed from all totals. It stays in the audit history and cannot be permanently erased.`
              : ''}
            confirmLabel={deletingPayment ? 'Deleting…' : 'Delete'}
            variant="danger"
          />
        </>
      )}

      {canManageScholarships && (
        <FeeAdjustModal
          student={feeAdjustStudent}
          structures={feeStructures}
          onClose={() => setFeeAdjustStudent(null)}
          onSaved={refreshData}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteStructureTarget}
        onClose={() => setDeleteStructureTarget(null)}
        onConfirm={() => void handleConfirmDeleteStructure()}
        title="Delete fee structure?"
        message={deleteStructureTarget
          ? `The fee structure for ${deleteStructureTarget.className || 'this class'} will be removed. Recorded payments are not affected.`
          : ''}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
