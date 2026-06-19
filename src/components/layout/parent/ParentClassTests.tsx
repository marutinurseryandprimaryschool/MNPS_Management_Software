'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ClassTestsService, StudentsService, ClassesService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import Button from '@/components/ui/Button';
import { findChildrenOfParent } from '@/lib/utils';
import type { Class, ClassTest, ClassTestRecord, Student } from '@/types/models';

export default function ParentClassTests() {
  const { user } = useAuth();
  const { school } = useSchool();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [classes, setClasses] = useState<Class[]>([]);
  const [allTests, setAllTests] = useState<ClassTest[]>([]);

  useEffect(() => {
    async function load() {
      try {
        if (!user || !school?.academicYear) return;
        const [allStudents, cl, tests] = await Promise.all([
          StudentsService.getAll(school.academicYear),
          ClassesService.getAll(school.academicYear),
          ClassTestsService.getAll(school.academicYear),
        ]);
        const myKids = findChildrenOfParent(allStudents as unknown as Student[], user);
        setChildren(myKids);
        if (myKids.length > 0) setSelectedChildId(myKids[0].id);
        setClasses(cl as unknown as Class[]);
        setAllTests(tests as unknown as ClassTest[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, school?.academicYear]);

  const child = useMemo(() => children.find(c => c.id === selectedChildId), [children, selectedChildId]);
  const childClass = useMemo(() => classes.find(c => c.id === child?.classId), [classes, child]);

  type Row = { test: ClassTest; rec: ClassTestRecord | null };
  // Sort by subject (so they group together visually) then by date (newest first).
  const rows: Row[] = useMemo(() => {
    if (!child) return [];
    return allTests
      .filter(t => t.classId === child.classId && t.sectionId === child.sectionId)
      .map(t => ({ test: t, rec: t.records?.find(r => r.studentId === child.id) || null }))
      .sort((a, b) => {
        const sa = a.test.subjectName.localeCompare(b.test.subjectName);
        if (sa !== 0) return sa;
        return a.test.testDate < b.test.testDate ? 1 : -1;
      });
  }, [allTests, child]);

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  if (children.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header"><h2 className="text-h1">Class Tests</h2></div>
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No child linked to your account.</p>
        </div>
      </div>
    );
  }

  // Light highlight for the first row of each subject — keeps the same-subject
  // rows visually adjacent without needing separate cards.
  const isSubjectStart = (i: number) =>
    i === 0 || rows[i - 1].test.subjectId !== rows[i].test.subjectId;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Class Tests</h2>
          {child && (
            <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              {child.name} · {child.className || childClass?.name}
              {child.sectionName ? ` · Section ${child.sectionName}` : ''}
            </p>
          )}
        </div>
      </div>

      {children.length > 1 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
          {children.map(c => (
            <Button
              key={c.id}
              variant={selectedChildId === c.id ? 'primary' : 'secondary'}
              onClick={() => setSelectedChildId(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            No class tests recorded yet for {child?.name}.
          </p>
        </div>
      ) : (
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          overflowX: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-variant)' }}>
                <th style={thStyle}>Subject</th>
                <th style={thStyle}>Test</th>
                <th style={thStyle}>Date</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const score = row.rec?.marksObtained;
                const showSubject = isSubjectStart(i);
                return (
                  <tr key={row.test.id} style={{
                    borderTop: showSubject && i > 0 ? '2px solid var(--color-border)' : '1px solid var(--color-divider)',
                  }}>
                    <td style={{ ...tdStyle, fontWeight: showSubject ? 600 : 400, color: showSubject ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                      {showSubject ? row.test.subjectName : ''}
                    </td>
                    <td style={tdStyle}>{row.test.testName}</td>
                    <td style={{ ...tdStyle, color: 'var(--color-text-tertiary)' }}>
                      {new Date(row.test.testDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{
                      ...tdStyle, textAlign: 'right', fontWeight: 700,
                      color: score !== null && score !== undefined ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                    }}>
                      {score !== null && score !== undefined ? `${score} / ${row.test.maxMarks}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--color-text-tertiary)',
  borderBottom: '1px solid var(--color-border)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 16px',
};
