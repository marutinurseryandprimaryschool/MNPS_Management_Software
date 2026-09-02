'use client';

/* ============================================
   Class Fee Register — the teacher's own class-section
   ============================================
   Teachers asked for their old fee view back: the WHOLE class-section, with
   school, ECA and van fees and who has paid — not only the students the
   Principal has assigned to them.

   It reads the PRINCIPAL REGISTER, not the legacy fee collections. That
   matters: the legacy screen could only show a van fee when the old student
   record carried `transportType: 'bus'` and a route id, while the school now
   maintains van fees on the register row (vanMonthly / vanMonths). Reading
   the register means school, ECA and van all appear, scholarship rows are
   flagged, and the numbers are the SAME ones the Principal sees — two
   screens cannot drift apart when they share one source.

   READ-ONLY by construction: no record-payment, no fee editing. Money is the
   Principal's to record; firestore.rules enforces that regardless of this UI.
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Badge } from '@/components/ui/SharedUI';
import { SearchInput } from '@/components/ui/Input';
import { TeachersService } from '@/lib/firestore-service';
import { useRegisterData } from '../principal/registers/useRegisterData';
import StudentRegisterList from '../principal/registers/StudentRegisterList';
import StudentDetailSheet from '../principal/registers/StudentDetailSheet';
import { compareStudents, inr } from '../principal/registers/register-shared';
import {
  EmptyBlock, ErrorBlock, LoadingBlock, NoticeBanner, StatGrid, surfaceCard, useIsNarrow,
} from '../principal/registers/register-ui';

/** One class-section this teacher is responsible for. */
interface AssignedSection {
  className: string;
  sectionName: string;
}

const norm = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export default function TeacherClassFeeRegister() {
  const { user, role } = useAuth();
  const { school } = useSchool();
  const narrow = useIsNarrow();
  const data = useRegisterData(school?.academicYear);

  const [sections, setSections] = useState<AssignedSection[] | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [detailRowId, setDetailRowId] = useState<string | null>(null);

  const myUid = user?.uid || user?.id || '';

  /**
   * Which class-sections this teacher holds. Read from their teacher record
   * and the per-year assignments, matched on the AUTH uid — the same identity
   * firestore.rules compares — with the teacher-doc id as a fallback for
   * records whose uid has not been healed yet.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [teachers, assignments] = await Promise.all([
          TeachersService.getAll(),
          TeachersService.getAllAssignments(school?.academicYear),
        ]);
        if (cancelled) return;

        const mine = (teachers as Record<string, unknown>[]).find(teacher =>
          norm(teacher.userId) === norm(myUid)
          || norm(teacher.uid) === norm(myUid)
          || norm(teacher.email) === norm(user?.email));

        const mineAssignments = mine
          ? (assignments as Record<string, unknown>[]).find(a => a.teacherId === mine.id)
          : undefined;

        const list = ((mineAssignments?.assignments ?? []) as Record<string, unknown>[])
          .map(entry => ({
            className: String(entry.className ?? ''),
            sectionName: String(entry.sectionName ?? ''),
          }))
          .filter(entry => entry.className);

        setSections(list);
        setSectionError(null);
      } catch (error) {
        if (cancelled) return;
        console.error('[class-fee-register] could not load your class assignment', error);
        // Never fall back to "no students" — that reads as an empty class.
        setSectionError('Could not load which class you are assigned to. Please retry.');
        setSections(null);
      }
    })();
    return () => { cancelled = true; };
  }, [myUid, user?.email, school?.academicYear]);

  /** Register rows belonging to any class-section this teacher holds. */
  const myRows = useMemo(() => {
    if (!sections || sections.length === 0) return [];
    return data.rows
      .filter(row => sections.some(section =>
        norm(row.className) === norm(section.className)
        // A section-less assignment covers the whole class.
        && (!section.sectionName || norm(row.sectionName) === norm(section.sectionName))))
      .sort(compareStudents);
  }, [data.rows, sections]);

  const term = search.trim().toLowerCase();
  const visibleRows = useMemo(() => (term
    ? myRows.filter(row =>
      `${row.name} ${row.className} ${row.sectionName ?? ''} ${row.rollNo ?? ''}`
        .toLowerCase().includes(term))
    : myRows), [myRows, term]);

  const totals = useMemo(() => myRows.reduce((acc, row) => {
    const summary = data.summaryFor(row.id);
    return {
      charged: acc.charged + summary.totalCharged,
      paid: acc.paid + summary.totalPaid,
      pending: acc.pending + summary.totalPending,
      dueNow: acc.dueNow + summary.totalDueNow,
      scholarship: acc.scholarship + (row.isScholarship ? 1 : 0),
    };
  }, { charged: 0, paid: 0, pending: 0, dueNow: 0, scholarship: 0 }), [myRows, data]);

  const detailRow = data.rows.find(row => row.id === detailRowId) ?? null;

  if (data.loading || sections === null) {
    if (sectionError) {
      return (
        <div className="page-container">
          <ErrorBlock
            title="Could not open the class fee register"
            message={sectionError}
            onRetry={() => window.location.reload()}
          />
        </div>
      );
    }
    return <div className="page-container"><LoadingBlock label="Loading your class…" /></div>;
  }

  if (data.error) {
    return (
      <div className="page-container">
        <ErrorBlock
          title="Could not load the fee register"
          message={data.error}
          onRetry={() => { void data.reload(); }}
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="text-h1">Class Fee Register</h2>
            {school?.academicYear && <Badge variant="primary">{school.academicYear}</Badge>}
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {sections.length > 0
              ? `${sections.map(s => [s.className, s.sectionName].filter(Boolean).join(' · ')).join(', ')}`
              : 'Your class-section'}
            {' — school, ECA and van fees for every student. View only.'}
          </p>
        </div>
      </div>

      {sections.length === 0 ? (
        <EmptyBlock
          title="No class assigned to you yet"
          hint="Ask the office to assign your class and section on your teacher record — this page then lists that section's fees."
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
            {totals.scholarship > 0 && (
              <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 'var(--space-3) 0 0' }}>
                {totals.scholarship} scholarship student{totals.scholarship === 1 ? '' : 's'} in this
                section — their rows are marked below.
              </p>
            )}
          </div>

          <NoticeBanner tone="info">
            View only. Fee amounts and payments are recorded by the Principal; tap a student to see
            their full breakdown and payment history.
          </NoticeBanner>

          <div style={{ marginBottom: 'var(--space-4)', maxWidth: narrow ? '100%' : 360 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search student, section or roll" />
          </div>

          <div style={{ ...surfaceCard, overflow: 'hidden' }}>
            <StudentRegisterList
              rows={visibleRows}
              summaryFor={data.summaryFor}
              onOpen={row => setDetailRowId(row.id)}
              showClass
              showStatus
              emptyLabel={myRows.length === 0
                ? 'No students from your section are in the fees register yet.'
                : 'No student matches that search.'}
            />
          </div>
        </>
      )}

      {detailRow && (
        <StudentDetailSheet
          row={detailRow}
          summary={data.summaryFor(detailRow.id)}
          payments={data.paymentsFor(detailRow.id)}
          onClose={() => setDetailRowId(null)}
        />
      )}
    </div>
  );
}
