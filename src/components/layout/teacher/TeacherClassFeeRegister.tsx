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
import { StudentsService, TeachersService } from '@/lib/firestore-service';
import type { RegisterRow } from '@/types/principal';
import { useRegisterData } from '../principal/registers/useRegisterData';
import StudentRegisterList from '../principal/registers/StudentRegisterList';
import StudentDetailSheet from '../principal/registers/StudentDetailSheet';
import { compareStudents, inr } from '../principal/registers/register-shared';
import {
  EmptyBlock, ErrorBlock, LoadingBlock, NoticeBanner, StatGrid, surfaceCard, useIsNarrow,
} from '../principal/registers/register-ui';

/** The single section this teacher is CLASS TEACHER of. */
interface ClassTeacherOf {
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
}

const norm = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export default function TeacherClassFeeRegister() {
  const { user, role } = useAuth();
  const { school } = useSchool();
  const narrow = useIsNarrow();
  const data = useRegisterData(school?.academicYear);

  /** null = still resolving; the object or 'none' once known. */
  const [classOf, setClassOf] = useState<ClassTeacherOf | 'none' | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);
  /** The section's FULL roll, from the school's student list. */
  const [classStudents, setClassStudents] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState('');
  const [detailRowId, setDetailRowId] = useState<string | null>(null);

  const myUid = user?.uid || user?.id || '';

  /**
   * The section this teacher is CLASS TEACHER of — not every section they
   * teach a subject in. That was the old register's scope and the one the
   * teachers asked for: "my class", singular. A teacher who takes a subject
   * in four sections is class teacher of at most one.
   *
   * The section's whole roll then comes from the school's student list, so
   * the page shows CLASS STRENGTH rather than only the children who happen
   * to be in the fees register already.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [teachers, assignments] = await Promise.all([
          TeachersService.getAll(),
          TeachersService.getAllAssignments(school?.academicYear ?? ''),
        ]);
        if (cancelled) return;

        const mine = (teachers as Record<string, unknown>[]).find(teacher =>
          norm(teacher.userId) === norm(myUid)
          || norm(teacher.uid) === norm(myUid)
          || norm(teacher.email) === norm(user?.email));

        const mineAssignments = mine
          ? (assignments as Record<string, unknown>[]).find(a => a.teacherId === mine.id)
          : undefined;

        // Assignments live per-year; older records keep them on the teacher doc.
        const entries = [
          ...((mineAssignments?.assignments ?? []) as Record<string, unknown>[]),
          ...((mine?.assignedClasses ?? []) as Record<string, unknown>[]),
        ];
        const classTeacherEntry = entries.find(entry => entry.isClassTeacher === true);

        if (!classTeacherEntry) {
          setClassOf('none');
          setSectionError(null);
          return;
        }

        const section: ClassTeacherOf = {
          classId: String(classTeacherEntry.classId ?? ''),
          sectionId: String(classTeacherEntry.sectionId ?? ''),
          className: String(classTeacherEntry.className ?? ''),
          sectionName: String(classTeacherEntry.sectionName ?? ''),
        };

        const roll = section.sectionId
          ? await StudentsService.getByClassSection(
            section.classId, section.sectionId, school?.academicYear)
          : await StudentsService.getByClass(section.classId, school?.academicYear);
        if (cancelled) return;

        setClassStudents((roll as Record<string, unknown>[]) ?? []);
        setClassOf(section);
        setSectionError(null);
      } catch (error) {
        if (cancelled) return;
        console.error('[class-fee-register] could not load your class', error);
        // Never fall back to "no students" — that reads as an empty class.
        setSectionError('Could not load your class list. Please retry.');
        setClassOf(null);
      }
    })();
    return () => { cancelled = true; };
  }, [myUid, user?.email, school?.academicYear]);

  /**
   * The section's roll as REGISTER rows, so school / ECA / van balances come
   * from the very records the Principal maintains. A child on the roll with
   * no register row yet is carried as a zero row rather than dropped — the
   * class teacher should see their whole class, and a missing fee setup is
   * information, not a reason to hide the student.
   */
  const myRows = useMemo(() => {
    if (!classOf || classOf === 'none') return [];
    const byKey = new Map<string, RegisterRow>();
    for (const row of data.rows) {
      byKey.set(`${norm(row.name)}|${norm(row.className)}`, row);
    }
    return classStudents
      .map((student, index) => {
        const name = String(student.name ?? '');
        const className = String(student.className ?? classOf.className);
        const existing = byKey.get(`${norm(name)}|${norm(className)}`);
        if (existing) return existing;
        return {
          id: `unregistered:${String(student.id ?? index)}`,
          academicYear: school?.academicYear ?? '',
          name,
          className,
          sectionName: String(student.sectionName ?? student.section ?? ''),
          rollNo: String(student.rollNo ?? student.rollNumber ?? ''),
          schoolFee: 0,
          ecaAnnual: 0,
          ecaMonths: [],
          vanMonthly: 0,
          vanMonths: [],
        } as unknown as RegisterRow;
      })
      .sort(compareStudents);
  }, [classStudents, classOf, data.rows, school?.academicYear]);

  /** How many of the class have no fee row yet — worth saying out loud. */
  const unregisteredCount = useMemo(
    () => myRows.filter(row => row.id.startsWith('unregistered:')).length,
    [myRows],
  );

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

  /* Look the student up in the ROLL, not in data.rows: a child on the class
     list who has no register row yet exists only in myRows, so searching
     data.rows found nothing and the sheet simply never opened for them. */
  const detailRow = myRows.find(row => row.id === detailRowId) ?? null;

  if (data.loading || classOf === null) {
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
            {classOf !== 'none'
              ? [classOf.className, classOf.sectionName].filter(Boolean).join(' · ')
              : 'Your class'}
            {' — school, ECA and van fees for every student in your class. View only.'}
          </p>
        </div>
      </div>

      {classOf === 'none' ? (
        <EmptyBlock
          title="You are not set as a class teacher yet"
          hint="This page lists your own class. Ask the office to mark you as class teacher of your section on your teacher record, and your class appears here."
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

          {unregisteredCount > 0 && (
            <NoticeBanner tone="warning">
              {unregisteredCount} of your {myRows.length} students {unregisteredCount === 1 ? 'is' : 'are'} on
              the class roll but not yet in the fees register, so {unregisteredCount === 1 ? 'it shows' : 'they show'} ₹0.
              The Principal adds them from the Fees Note.
            </NoticeBanner>
          )}

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
