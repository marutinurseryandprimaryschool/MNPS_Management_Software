'use client';

/* ============================================
   Teacher-wise Register — TEACHER mode
   ============================================
   The third automatic register: a teacher opens it and sees ONLY the students
   Sharmi made them responsible for. They may correct the fee amounts on those
   students and record money they collected; they may not rename a student,
   move them to another class, or reach anyone else's row.

   That last guarantee is NOT this file's to make: `teacherUid == request.auth.uid`
   in firestore.rules is the boundary, and it also pins the editable field set.
   The filter here is convenience, not security.

   Every action is audited by the service layer, and the teacher is told so on
   screen — a permanent notice, not a one-time toast.
*/

import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/SharedUI';
import { SearchInput } from '@/components/ui/Input';
import type { PrincipalActor, RegisterRow } from '@/types/principal';
import { compareStudents, inr } from './register-shared';
import {
  EmptyBlock, NoticeBanner, StatGrid, surfaceCard, useIsNarrow,
} from './register-ui';
import type { RegisterData } from './useRegisterData';
import StudentRegisterList from './StudentRegisterList';
import StudentDetailSheet from './StudentDetailSheet';
import RecordPaymentModal from './RecordPaymentModal';
import EditStudentFeesSheet from './EditStudentFeesSheet';
import TeacherFeeGrid from './TeacherFeeGrid';

export const AUDIT_NOTICE = 'Your changes are recorded in the school’s activity log.';

export interface TeacherOwnRegisterProps {
  data: RegisterData;
  actor: PrincipalActor | null;
  academicYear?: string;
  canEditFees: boolean;
  canRecordPayments: boolean;
}

export default function TeacherOwnRegister({
  data, actor, academicYear, canEditFees, canRecordPayments,
}: TeacherOwnRegisterProps) {
  const narrow = useIsNarrow();
  const [search, setSearch] = useState('');
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const [payRowId, setPayRowId] = useState<string | null>(null);
  const [editRowId, setEditRowId] = useState<string | null>(null);

  const myUid = actor?.uid ?? '';

  const myRows = useMemo(
    () => data.rows.filter(row => row.teacherUid && row.teacherUid === myUid).sort(compareStudents),
    [data.rows, myUid],
  );

  const term = search.trim().toLowerCase();
  const visibleRows = useMemo(() => (term
    ? myRows.filter(row => `${row.name} ${row.className} ${row.sectionName ?? ''} ${row.rollNo ?? ''}`
      .toLowerCase().includes(term))
    : myRows), [myRows, term]);

  const { summaryFor } = data;

  const totals = useMemo(() => myRows.reduce((acc, row) => {
    const summary = summaryFor(row.id);
    return {
      charged: acc.charged + summary.totalCharged,
      paid: acc.paid + summary.totalPaid,
      pending: acc.pending + summary.totalPending,
      dueNow: acc.dueNow + summary.totalDueNow,
    };
  }, { charged: 0, paid: 0, pending: 0, dueNow: 0 }), [myRows, summaryFor]);

  const findRow = (id: string | null): RegisterRow | null =>
    (id ? myRows.find(row => row.id === id) ?? null : null);

  const detailRow = findRow(detailRowId);
  const payRow = findRow(payRowId);
  const editRow = findRow(editRowId);

  const openPayment = canRecordPayments ? (row: RegisterRow) => setPayRowId(row.id) : undefined;
  const openEdit = canEditFees ? (row: RegisterRow) => setEditRowId(row.id) : undefined;

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="text-h1">My Students</h2>
            {academicYear && <Badge variant="primary">{academicYear}</Badge>}
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {myRows.length} student{myRows.length === 1 ? '' : 's'} assigned to you by the Principal.
          </p>
        </div>
      </div>

      <NoticeBanner tone="info">{AUDIT_NOTICE}</NoticeBanner>

      {myRows.length === 0 ? (
        <EmptyBlock
          title="No students assigned to you yet"
          hint="The Principal assigns students to teachers from the Teacher-wise register."
        />
      ) : (
        <>
          <div style={{ ...surfaceCard, padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <StatGrid
              stats={[
                { label: 'Students', value: String(myRows.length) },
                { label: 'Charged', value: inr(totals.charged) },
                { label: 'Collected', value: inr(totals.paid), tone: 'paid' },
                { label: 'Pending', value: inr(totals.pending), tone: 'pending' },
                { label: 'Due now', value: inr(totals.dueNow), tone: 'due' },
              ]}
            />
          </div>

          <div style={{ maxWidth: 360, marginBottom: 'var(--space-4)' }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search my students" />
          </div>

          <div style={{ ...surfaceCard, overflow: 'hidden' }}>
            {visibleRows.length === 0 ? (
              <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', padding: 'var(--space-4)', margin: 0 }}>
                No student matches that search.
              </p>
            ) : narrow ? (
              /* Phone: cards + a stacked edit sheet. Never a 9-column grid. */
              <StudentRegisterList
                rows={visibleRows}
                summaryFor={data.summaryFor}
                onOpen={row => setDetailRowId(row.id)}
                onRecordPayment={openPayment}
                onEditFees={openEdit}
                showClass
              />
            ) : (
              /* PC: frozen name column, fee amounts editable in place. */
              <TeacherFeeGrid
                rows={visibleRows}
                summaryFor={data.summaryFor}
                actor={actor}
                canEditFees={canEditFees}
                defaultEcaMonths={data.settings?.defaultEcaMonths}
                defaultVanMonths={data.settings?.defaultVanMonths}
                onOpen={row => setDetailRowId(row.id)}
                onEditMonths={row => setEditRowId(row.id)}
                onRecordPayment={openPayment}
                onSaved={data.refreshQuietly}
              />
            )}
          </div>
        </>
      )}

      {detailRow && (
        <StudentDetailSheet
          row={detailRow}
          summary={data.summaryFor(detailRow.id)}
          payments={data.paymentsFor(detailRow.id)}
          onClose={() => setDetailRowId(null)}
          onRecordPayment={canRecordPayments ? () => { setPayRowId(detailRow.id); setDetailRowId(null); } : undefined}
          onEditFees={canEditFees ? () => { setEditRowId(detailRow.id); setDetailRowId(null); } : undefined}
        />
      )}

      {payRow && (
        <RecordPaymentModal
          row={payRow}
          summary={data.summaryFor(payRow.id)}
          payments={data.paymentsFor(payRow.id)}
          actor={actor}
          onClose={() => setPayRowId(null)}
          onSaved={data.refreshQuietly}
        />
      )}

      {editRow && (
        <EditStudentFeesSheet
          row={editRow}
          actor={actor}
          onClose={() => setEditRowId(null)}
          onSaved={data.refreshQuietly}
          auditNotice={AUDIT_NOTICE}
        />
      )}
    </div>
  );
}
