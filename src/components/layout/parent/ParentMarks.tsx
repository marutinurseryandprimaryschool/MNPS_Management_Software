'use client';

import React, { useState, useEffect } from 'react';
import { MarksService, StudentsService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Badge } from '@/components/ui/SharedUI';
import type { Marks, Student } from '@/types/models';

export default function ParentMarks() {
  const { user } = useAuth();
  const { school } = useSchool();
  const [allMarks, setAllMarks] = useState<Marks[]>([]);
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
        const marks = await MarksService.getAll(school.academicYear);
        setAllMarks(marks as unknown as Marks[]);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, school?.academicYear]);

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  // Filter marks for child's class
  const childMarks = allMarks.filter(m => m.classId === child?.classId);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Marks & Grades</h2>
      </div>

      {!child ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No child linked to your account.</p>
        </div>
      ) : childMarks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No marks published yet for {child.name}.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {childMarks.map(m => {
            const record = m.records?.find(r => r.studentId === child.id);
            return (
              <div key={m.id} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 className="text-h3">{m.examName}</h3>
                    <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{m.subjectName} • Max: {m.maxMarks}</p>
                  </div>
                  {record && (
                    <div style={{ textAlign: 'right' }}>
                      <div className="text-h2" style={{ color: 'var(--color-primary-500)' }}>{record.marksObtained}/{m.maxMarks}</div>
                      <Badge variant="info">{record.grade}</Badge>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
