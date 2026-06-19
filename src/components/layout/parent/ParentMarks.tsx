'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  MarksService,
  StudentsService,
  ClassesService,
  WeeklyTestsService,
} from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Avatar, Badge } from '@/components/ui/SharedUI';
import Button from '@/components/ui/Button';
import { findChildrenOfParent } from '@/lib/utils';
import { EXAM_TERMS_ORDER, EXAM_TERM_LABELS } from '@/types/enums';
import type { Class, Student } from '@/types/models';

interface ParentMarksProps {
  defaultTab?: 'major' | 'weekly';
}

const MONTHS: { value: string; label: string }[] = [
  { value: 'june', label: 'June' }, { value: 'july', label: 'July' },
  { value: 'august', label: 'August' }, { value: 'september', label: 'September' },
  { value: 'october', label: 'October' }, { value: 'november', label: 'November' },
  { value: 'december', label: 'December' }, { value: 'january', label: 'January' },
  { value: 'february', label: 'February' }, { value: 'march', label: 'March' },
];

function gradeColor(grade?: string): { bg: string; text: string } {
  const g = (grade || '').toUpperCase();
  if (g.startsWith('A')) return { bg: '#ECFDF5', text: '#059669' };
  if (g.startsWith('B')) return { bg: '#EFF6FF', text: '#1D4ED8' };
  if (g.startsWith('C')) return { bg: '#FEF3C7', text: '#B45309' };
  if (g.startsWith('D')) return { bg: '#FEF2F2', text: '#DC2626' };
  return { bg: 'var(--color-surface-variant)', text: 'var(--color-text-tertiary)' };
}

function gradeFromPercent(p: number): string {
  if (p >= 80) return 'A';
  if (p >= 60) return 'B';
  if (p >= 40) return 'C';
  return 'D';
}

export default function ParentMarks({ defaultTab = 'major' }: ParentMarksProps = {}) {
  const { user } = useAuth();
  const { school } = useSchool();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [classes, setClasses] = useState<Class[]>([]);
  const [allMarks, setAllMarks] = useState<any[]>([]);
  const [allWeekly, setAllWeekly] = useState<any[]>([]);

  // Each sidebar item renders its own page — no tab UI. defaultTab decides
  // which view we render.
  const mode: 'exams' | 'weekly' = defaultTab === 'weekly' ? 'weekly' : 'exams';
  const [weeklyMonth, setWeeklyMonth] = useState('june');

  useEffect(() => {
    async function load() {
      try {
        if (!user || !school?.academicYear) return;
        const [allStudents, cl, m, w] = await Promise.all([
          StudentsService.getAll(school.academicYear),
          ClassesService.getAll(school.academicYear),
          MarksService.getAll(school.academicYear),
          WeeklyTestsService.getAll(),
        ]);
        const myKids = findChildrenOfParent(allStudents as unknown as Student[], user);
        setChildren(myKids);
        if (myKids.length > 0) setSelectedChildId(myKids[0].id);
        setClasses(cl as unknown as Class[]);
        setAllMarks(m as any[]);
        setAllWeekly((w as any[]).filter(x => x.academicYear === school.academicYear));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, school?.academicYear]);

  const child = useMemo(() => children.find(c => c.id === selectedChildId), [children, selectedChildId]);
  const childClass = useMemo(
    () => classes.find(c => c.id === child?.classId),
    [classes, child],
  );
  const subjects = childClass?.subjects || [];

  // ── Major exam matrix: subjectId × examId → cell ──
  const examMatrix = useMemo(() => {
    if (!child) return null;
    const matrix: Record<string, Record<string, any>> = {};
    subjects.forEach(sub => {
      matrix[sub.id] = {};
      EXAM_TERMS_ORDER.forEach(ex => { matrix[sub.id][ex] = null; });
    });
    const examTotals: Record<string, { total: number; max: number; count: number }> = {};
    EXAM_TERMS_ORDER.forEach(ex => { examTotals[ex] = { total: 0, max: 0, count: 0 }; });

    allMarks.forEach((doc: any) => {
      if (doc.examType !== 'major_exam') return;
      if (doc.classId !== child.classId || doc.sectionId !== child.sectionId) return;
      const examId = doc.examId;
      const subId = doc.subjectId;
      if (!matrix[subId] || !examTotals[examId]) return;
      const rec = (doc.records || []).find((r: any) => r.studentId === child.id);
      if (!rec) return;
      matrix[subId][examId] = rec;
      if (typeof rec.totalMarks === 'number') {
        examTotals[examId].total += rec.totalMarks;
        examTotals[examId].max += 100;
        examTotals[examId].count += 1;
      }
    });
    return { matrix, examTotals };
  }, [child, subjects, allMarks]);

  // ── Weekly tests for selected month, grouped by subject ──
  const weeklyForMonth = useMemo(() => {
    if (!child) return [] as { subjectId: string; subjectName: string; weeks: { W1?: number; W2?: number; W3?: number; W4?: number }; total: number | null; outOf: number }[];
    // Each week is scored out of 10.
    const PER_WEEK_MAX = 10;
    return subjects.map(sub => {
      const doc = allWeekly.find(w =>
        w.studentId === child.id && w.subjectId === sub.id && w.month === weeklyMonth
      );
      const weeks = doc?.weeks || {};
      const vals = ['W1', 'W2', 'W3', 'W4']
        .map(k => weeks[k as keyof typeof weeks])
        .filter((v): v is number => typeof v === 'number');
      const total = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
      // Only the weeks that actually have a mark count toward the denominator —
      // so a student who only sat W1 sees "7 / 10", not "7 / 40".
      const outOf = vals.length * PER_WEEK_MAX;
      return { subjectId: sub.id, subjectName: sub.name, weeks, total, outOf };
    });
  }, [child, subjects, allWeekly, weeklyMonth]);


  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  if (children.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header"><h2 className="text-h1">Marks &amp; Grades</h2></div>
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No child linked to your account.</p>
        </div>
      </div>
    );
  }

  const pageTitle = mode === 'weekly' ? 'Weekly Tests' : 'Major Exams';
  const pageSubtitle = mode === 'weekly'
    ? `Monthly W1–W4 scores for ${child?.name || 'your child'}`
    : `Term-wise exam marks for ${child?.name || 'your child'}`;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">{pageTitle}</h2>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {pageSubtitle}
          </p>
        </div>
      </div>

      {/* Child header card */}
      {child && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          padding: 'var(--space-4)', background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)', marginBottom: 'var(--space-4)',
        }}>
          <Avatar name={child.name} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: 'var(--text-h3)', fontWeight: 700 }}>{child.name}</div>
            <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
              {child.className || childClass?.name} {child.sectionName ? `· Section ${child.sectionName}` : ''}
              {child.admissionNumber ? ` · #${child.admissionNumber}` : ''}
            </div>
          </div>
          <Badge variant="primary">{school?.academicYear}</Badge>
        </div>
      )}

      {/* Child switcher when more than one */}
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

      {/* ─── Major Exams view ─── */}
      {mode === 'exams' && examMatrix && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {EXAM_TERMS_ORDER.map(term => {
            const totals = examMatrix.examTotals[term];
            const hasData = totals.count > 0;
            const pct = totals.max > 0 ? Math.round((totals.total / totals.max) * 100) : 0;
            const overallGrade = hasData ? gradeFromPercent(pct) : '';
            const gc = gradeColor(overallGrade);

            return (
              <div key={term} style={{
                background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--color-surface-variant)',
                  borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 'var(--space-3)',
                }}>
                  <h3 className="text-h3" style={{ margin: 0 }}>{EXAM_TERM_LABELS[term]}</h3>
                  {hasData ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                        {totals.total} / {totals.max} · {pct}%
                      </span>
                      <span style={{
                        padding: '4px 12px', borderRadius: 'var(--radius-full)',
                        background: gc.bg, color: gc.text,
                        fontWeight: 700, fontSize: '0.85rem',
                      }}>{overallGrade}</span>
                    </div>
                  ) : (
                    <Badge variant="default">Not yet published</Badge>
                  )}
                </div>

                {hasData && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface)' }}>
                          <th style={{ textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--color-divider)', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 700, letterSpacing: '0.04em' }}>Subject</th>
                          <th style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid var(--color-divider)', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 700, letterSpacing: '0.04em', width: 80 }}>FA / 40</th>
                          <th style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid var(--color-divider)', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 700, letterSpacing: '0.04em', width: 80 }}>SA / 60</th>
                          <th style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid var(--color-divider)', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 700, letterSpacing: '0.04em', width: 90 }}>Total / 100</th>
                          <th style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid var(--color-divider)', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 700, letterSpacing: '0.04em', width: 70 }}>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map(sub => {
                          const cell = examMatrix.matrix[sub.id]?.[term];
                          if (!cell) {
                            return (
                              <tr key={sub.id}>
                                <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-divider)', fontWeight: 500 }}>{sub.name}</td>
                                <td colSpan={4} style={{ padding: '10px', borderBottom: '1px solid var(--color-divider)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>—</td>
                              </tr>
                            );
                          }
                          const sg = gradeFromPercent(cell.totalMarks || 0);
                          const cellColor = gradeColor(sg);
                          return (
                            <tr key={sub.id}>
                              <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-divider)', fontWeight: 500 }}>{sub.name}</td>
                              <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--color-divider)' }}>{cell.faTotal ?? '—'}</td>
                              <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--color-divider)' }}>{cell.saScore ?? '—'}</td>
                              <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--color-divider)', fontWeight: 700, color: 'var(--color-primary-600)' }}>{cell.totalMarks ?? '—'}</td>
                              <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--color-divider)' }}>
                                <span style={{
                                  display: 'inline-block', padding: '2px 10px',
                                  borderRadius: 'var(--radius-full)',
                                  background: cellColor.bg, color: cellColor.text,
                                  fontWeight: 700, fontSize: '0.75rem',
                                }}>{sg}</span>
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
          })}
        </div>
      )}

      {/* ─── Weekly Tests view ─── */}
      {mode === 'weekly' && (
        <div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
            {MONTHS.map(m => (
              <button
                key={m.value}
                onClick={() => setWeeklyMonth(m.value)}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-full)',
                  border: `1.5px solid ${weeklyMonth === m.value ? 'var(--color-primary-500)' : 'var(--color-border)'}`,
                  background: weeklyMonth === m.value ? 'var(--color-primary-50)' : 'var(--color-surface)',
                  color: weeklyMonth === m.value ? 'var(--color-primary-700)' : 'var(--color-text-secondary)',
                  fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                  transition: 'all 150ms',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {weeklyForMonth.every(w => w.total === null && Object.values(w.weeks).every(v => v === undefined)) ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
              <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                No weekly tests recorded for {MONTHS.find(m => m.value === weeklyMonth)?.label} yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
              {weeklyForMonth.map(row => {
                const hasAny = Object.values(row.weeks).some(v => v !== undefined);
                if (!hasAny) return null;
                const totalPct = row.total !== null && row.outOf > 0 ? (row.total / row.outOf) * 100 : null;
                const totalGrade = totalPct !== null ? gradeFromPercent(totalPct) : '';
                const tc = gradeColor(totalGrade);
                return (
                  <div key={row.subjectId} style={{
                    background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)',
                    padding: 'var(--space-4)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                      <h4 className="text-h4" style={{ margin: 0 }}>{row.subjectName}</h4>
                      {row.total !== null && (
                        <span style={{
                          padding: '2px 10px', borderRadius: 'var(--radius-full)',
                          background: tc.bg, color: tc.text,
                          fontWeight: 700, fontSize: '0.75rem',
                        }}>Total {row.total} / {row.outOf}</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
                      {(['W1', 'W2', 'W3', 'W4'] as const).map(wk => {
                        const v = row.weeks[wk];
                        return (
                          <div key={wk} style={{
                            textAlign: 'center', padding: 'var(--space-2)',
                            borderRadius: 'var(--radius-sm)',
                            background: v !== undefined ? 'var(--color-primary-50)' : 'var(--color-surface-variant)',
                            border: `1px solid ${v !== undefined ? 'var(--color-primary-200)' : 'var(--color-border)'}`,
                          }}>
                            <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontWeight: 600, marginBottom: 2 }}>{wk}</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: v !== undefined ? 'var(--color-primary-700)' : 'var(--color-text-tertiary)' }}>
                              {v !== undefined ? v : '—'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
