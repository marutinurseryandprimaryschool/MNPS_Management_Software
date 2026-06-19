'use client';

import React, { useState, useEffect } from 'react';
import { AttendanceService, StudentsService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { AttendanceSession, AttendanceStatus } from '@/types/enums';
import { computeDaysPresent, isParentOfStudent } from '@/lib/utils';
import type { Attendance, AttendanceRecord, Student } from '@/types/models';

type Half = AttendanceStatus | undefined;
const sessionOf = (a: Attendance): AttendanceSession =>
  (a.session as AttendanceSession) || AttendanceSession.MORNING;

const pillStyle = (status: Half): React.CSSProperties => {
  if (status === undefined) {
    return { background: 'var(--color-surface-variant)', color: 'var(--color-text-tertiary)', border: '1px dashed var(--color-border)' };
  }
  if (status === AttendanceStatus.PRESENT) {
    return { background: 'var(--color-success-bg)', color: 'var(--color-success)' };
  }
  if (status === AttendanceStatus.LATE) {
    return { background: 'var(--color-warning-bg)', color: 'var(--color-warning)' };
  }
  return { background: 'var(--color-error-bg)', color: 'var(--color-error)' };
};

const pillText = (status: Half) =>
  status === undefined ? '—' : status.toUpperCase();

export default function ParentAttendance() {
  const { user } = useAuth();
  const { school } = useSchool();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [child, setChild] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        if (!user || !school?.academicYear) return;
        const allStudents = await StudentsService.getAll(school.academicYear);
        const myChild = (allStudents as unknown as Student[]).find(s => isParentOfStudent(user, s));
        setChild(myChild || null);

        const allAttendance = await AttendanceService.getAll(school.academicYear);
        setAttendances(allAttendance as unknown as Attendance[]);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, school?.academicYear]);

  // Roll the per-session docs up into one row per date for this child.
  const childAttendance = attendances.filter(a =>
    a.records?.some((r: AttendanceRecord) => r.studentId === child?.id)
  );

  const byDate = new Map<string, { am: Half; pm: Half }>();
  for (const doc of childAttendance) {
    const rec = doc.records?.find((r: AttendanceRecord) => r.studentId === child?.id);
    if (!rec) continue;
    const session = sessionOf(doc);
    const slot = byDate.get(doc.date) || { am: undefined as Half, pm: undefined as Half };
    if (session === AttendanceSession.AFTERNOON) slot.pm = rec.status;
    else slot.am = rec.status;
    byDate.set(doc.date, slot);
  }
  const dateRows = Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1)); // newest first

  const { daysPresent, daysCounted } = child
    ? computeDaysPresent(childAttendance, child.id)
    : { daysPresent: 0, daysCounted: 0 };
  const pct = daysCounted > 0 ? Math.round((daysPresent / daysCounted) * 100) : 0;

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Attendance</h2>
        {child && (
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {child.name}
          </p>
        )}
      </div>

      {!child ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No child linked to your account.</p>
        </div>
      ) : dateRows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No attendance records found for {child.name}.</p>
        </div>
      ) : (
        <>
          {/* Summary card */}
          <div style={{
            display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)',
          }}>
            <div style={{
              flex: 1, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
              background: '#ECFDF5', border: '1px solid #A7F3D0', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#059669' }}>
                {daysPresent.toFixed(1)}
              </div>
              <div className="text-body-sm" style={{ fontWeight: 500, color: '#059669' }}>
                Days Present
              </div>
            </div>
            <div style={{
              flex: 1, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{daysCounted}</div>
              <div className="text-body-sm" style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                School Days
              </div>
            </div>
            <div style={{
              flex: 1, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
              background: '#EFF6FF', border: '1px solid #BFDBFE', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1D4ED8' }}>{pct}%</div>
              <div className="text-body-sm" style={{ fontWeight: 500, color: '#1D4ED8' }}>
                Attendance
              </div>
            </div>
          </div>

          {/* Per-day list with AM + PM pills */}
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto',
              gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-surface-variant)',
              borderBottom: '1px solid var(--color-border)',
              fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <span>Date</span>
              <span style={{ textAlign: 'center', minWidth: 90 }}>Morning</span>
              <span style={{ textAlign: 'center', minWidth: 90 }}>Afternoon</span>
            </div>
            {dateRows.map(([date, { am, pm }]) => (
              <div key={date} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 'var(--space-3)',
                alignItems: 'center', padding: 'var(--space-3) var(--space-4)',
                borderBottom: '1px solid var(--color-divider)',
              }}>
                <div style={{ font: 'var(--text-body)', fontWeight: 500 }}>
                  {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontWeight: 600,
                  fontSize: '0.72rem', textAlign: 'center', minWidth: 90,
                  ...pillStyle(am),
                }}>{pillText(am)}</span>
                <span style={{
                  padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontWeight: 600,
                  fontSize: '0.72rem', textAlign: 'center', minWidth: 90,
                  ...pillStyle(pm),
                }}>{pillText(pm)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
