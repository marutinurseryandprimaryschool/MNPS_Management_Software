'use client';

import React, { useState, useEffect } from 'react';
import { AttendanceService, StudentsService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import type { Attendance, Student } from '@/types/models';

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
        const myChild = (allStudents as unknown as Student[]).find(s =>
          s.email?.toLowerCase() === user.email?.toLowerCase()
        );
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

  // Filter attendance records for this child
  const childAttendance = attendances.filter(a =>
    a.records?.some(r => r.studentId === child?.id)
  );

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Attendance</h2>
      </div>

      {!child ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No child linked to your account.</p>
        </div>
      ) : childAttendance.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No attendance records found for {child.name}.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          {childAttendance.map(a => {
            const record = a.records?.find(r => r.studentId === child.id);
            return (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
                <div>
                  <div style={{ font: 'var(--text-body)', fontWeight: 500 }}>
                    {new Date(a.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Daily Attendance</div>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.8rem',
                  background: record?.status === 'present' ? 'var(--color-success-bg)' : record?.status === 'late' ? 'var(--color-warning-bg)' : 'var(--color-error-bg)',
                  color: record?.status === 'present' ? 'var(--color-success)' : record?.status === 'late' ? 'var(--color-warning)' : 'var(--color-error)',
                }}>{record?.status?.toUpperCase() || 'N/A'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
