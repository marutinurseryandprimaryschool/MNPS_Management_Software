'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing untyped Firestore data handling in this legacy screen; typed migration tracked separately. */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClassesService, StudentsService, MarksService, TeachersService, CoScholasticService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Select } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { PrinterIcon } from '@/components/ui/Icons';
import { parentData } from '@/lib/parent-api';
import { useToast } from '@/components/ui/Toast';
import {
  parseMark, upsertStudentMarks, REPORT_FA_MAX, REPORT_SA_MAX, type ExamRecord,
} from '@/lib/report-card-utils';
import type { Class, Student } from '@/types/models';

interface SharedReportCardProps {
  view: 'admin' | 'teacher' | 'parent';
}

const EXAM_COLUMNS = [
  { value: 'i_mid_term', label: 'I MID TERM' },
  { value: 'quarterly', label: 'QUARTERLY' },
  { value: 'ii_mid_term', label: 'II MID TERM' },
  { value: 'half_yearly', label: 'HALF YEARLY' },
  { value: 'iii_mid_term', label: 'III MID TERM' },
  { value: 'annual', label: 'ANNUAL' },
];

function getGrade(total: number, max: number = 100): string {
  if (total === 0 && max === 0) return '';
  const percent = (total / max) * 100;
  if (percent >= 80) return 'A';
  if (percent >= 60) return 'B';
  if (percent >= 40) return 'C';
  return 'D';
}

export default function SharedReportCard({ view }: SharedReportCardProps) {
  const { user, parentChildren } = useAuth();
  const { school } = useSchool();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allMarks, setAllMarks] = useState<any[]>([]);
  const [allCoScholastic, setAllCoScholastic] = useState<any[]>([]);

  // Selection state
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const printableRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  /* -- Edit marks (teachers, Principal, admin; never parents) --
     Drafts are keyed "subjectId|examId" and hold the typed FA / SA text.
     Saving writes into the SAME marks docs the Exam Marks screen uses. */
  const canEditMarks = view !== 'parent';
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { fa: string; sa: string }>>({});
  const [savingMarks, setSavingMarks] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        if (!school?.academicYear) return;

        // Parents never read these collections: the API returns the child's
        // class and ONLY the child's own entries in marks / co-scholastic.
        if (view === 'parent') {
          const kids = parentChildren;
          const first = kids[0];
          if (first) {
            // One call per child; each response holds that child's own
            // records only, so the sibling switcher never shows a classmate.
            const perChild = await Promise.all(kids.map(k =>
              parentData<{ class: Class | null; marks: any[]; coScholastic: any[] }>('reportCard', k.id)));
            const cls = perChild.map(p => p.class).filter((c): c is Class => !!c);
            setClasses(Array.from(new Map(cls.map(c => [c.id, c])).values()));
            setStudents(kids);
            setAllMarks(perChild.flatMap(p => p.marks || []));
            setAllCoScholastic(perChild.flatMap(p => p.coScholastic || []));
            setSelectedClassId(first.classId);
            setSelectedSectionId(first.sectionId);
            setSelectedStudentId(first.id);
          }
          return;
        }

        const [cl, st, m, co] = await Promise.all([
          ClassesService.getAll(school.academicYear),
          StudentsService.getAll(school.academicYear),
          MarksService.getAll(school.academicYear),
          CoScholasticService.getAll() // Note: CoScholastic getAll doesn't have year param in service, but getByClassSectionExam does
        ]);
        
        // Let's filter coScholastic manually if getAll doesn't support it yet
        const filteredCo = co.filter((c: any) => c.academicYear === school.academicYear);
        
        setClasses(cl as unknown as Class[]);
        setStudents(st as unknown as Student[]);
        setAllMarks(m as any[]);
        setAllCoScholastic(filteredCo);

        // If teacher, set their class automatically as default
        if (view === 'teacher' && user) {
          let teacherData = await TeachersService.getByUserId(user.uid || user.id);
          if (!teacherData && user.email) {
            teacherData = await TeachersService.getByEmail(user.email);
          }
          if (teacherData) {
            const assignment = (teacherData as any).assignedClasses?.find((a: any) => a.isClassTeacher);
            if (assignment) {
              setSelectedClassId(assignment.classId);
              setSelectedSectionId(assignment.sectionId);
            }
          }
        }

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [view, user, parentChildren, school?.academicYear]);

  const uniqueClassSections = useMemo(() => {
    const list: any[] = [];
    classes.forEach(c => {
      c.sections.forEach(s => {
        list.push({
          classId: c.id,
          sectionId: s.id,
          className: c.name,
          sectionName: s.name,
          subjects: c.subjects || []
        });
      });
    });
    return list;
  }, [classes]);

  const classStudents = useMemo(() => 
    students.filter(s => s.classId === selectedClassId && s.sectionId === selectedSectionId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  [students, selectedClassId, selectedSectionId]);

  const selectedStudent = useMemo(() => 
    classStudents.find(s => s.id === selectedStudentId),
  [classStudents, selectedStudentId]);

  const activeClassData = useMemo(() => 
    uniqueClassSections.find(c => c.classId === selectedClassId && c.sectionId === selectedSectionId),
  [uniqueClassSections, selectedClassId, selectedSectionId]);

  // Build report card matrix
  const reportData = useMemo(() => {
    if (!selectedStudent || !activeClassData) return null;

    const subjects = activeClassData.subjects || [];
    
    // Matrix: subjectId -> examId -> marks
    const matrix: Record<string, Record<string, any>> = {};
    subjects.forEach((sub: any) => {
      matrix[sub.id] = {};
      EXAM_COLUMNS.forEach(ex => {
        matrix[sub.id][ex.value] = null;
      });
    });

    // Totals per exam
    const examTotals: Record<string, { total: number; max: number; count: number }> = {};
    EXAM_COLUMNS.forEach(ex => {
      examTotals[ex.value] = { total: 0, max: 0, count: 0 };
    });

    // Populate matrix
    allMarks.forEach(doc => {
      if (
        doc.classId === selectedClassId && 
        doc.sectionId === selectedSectionId && 
        doc.examType === 'major_exam'
      ) {
        const examId = doc.examId;
        const subId = doc.subjectId;
        if (matrix[subId] && examTotals[examId]) {
          const studentRecord = (doc.records || []).find((r: any) => r.studentId === selectedStudentId);
          if (studentRecord) {
            matrix[subId][examId] = studentRecord;
            examTotals[examId].total += (studentRecord.totalMarks || 0);
            examTotals[examId].max += 100; // assuming 100 max per subject
            examTotals[examId].count += 1;
          }
        }
      }
    });

    // Build co-scholastic records
    const coScholasticData: Record<string, any> = {};
    EXAM_COLUMNS.forEach(ex => {
      coScholasticData[ex.value] = null;
    });

    allCoScholastic.forEach(doc => {
      if (
        doc.classId === selectedClassId &&
        doc.sectionId === selectedSectionId
      ) {
        const studentRecord = (doc.records || []).find((r: any) => r.studentId === selectedStudentId);
        if (studentRecord) {
          coScholasticData[doc.examId] = studentRecord;
        }
      }
    });

    return { subjects, matrix, examTotals, coScholasticData };
  }, [selectedStudent, activeClassData, allMarks, allCoScholastic, selectedClassId, selectedSectionId, selectedStudentId]);

  // Switching student or class discards unsaved drafts.
  useEffect(() => { setEditing(false); setDrafts({}); }, [selectedStudentId, selectedClassId, selectedSectionId]);

  const markText = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

  const startEditing = () => {
    if (!reportData) return;
    const next: Record<string, { fa: string; sa: string }> = {};
    reportData.subjects.forEach((sub: any) => {
      EXAM_COLUMNS.forEach(ex => {
        const cell = reportData.matrix[sub.id][ex.value];
        next[`${sub.id}|${ex.value}`] = { fa: markText(cell?.faTotal), sa: markText(cell?.saScore) };
      });
    });
    setDrafts(next);
    setEditing(true);
  };

  const setDraft = (key: string, part: 'fa' | 'sa', value: string) =>
    setDrafts(prev => ({ ...prev, [key]: { ...(prev[key] || { fa: '', sa: '' }), [part]: value } }));

  const saveMarks = async () => {
    if (!reportData || !selectedStudent || savingMarks || !school?.academicYear) return;
    // 1. Validate and collect only the cells that changed.
    const changes: { subjectId: string; examId: string; fa: number | null; sa: number | null }[] = [];
    for (const sub of reportData.subjects as any[]) {
      for (const ex of EXAM_COLUMNS) {
        const key = `${sub.id}|${ex.value}`;
        const draft = drafts[key] || { fa: '', sa: '' };
        const cell = reportData.matrix[sub.id][ex.value];
        if (draft.fa.trim() === markText(cell?.faTotal) && draft.sa.trim() === markText(cell?.saScore)) continue;
        const fa = parseMark(draft.fa, REPORT_FA_MAX);
        const sa = parseMark(draft.sa, REPORT_SA_MAX);
        if (fa === 'invalid' || sa === 'invalid') {
          showToast(`${sub.name}, ${ex.label}: FA must be 0-${REPORT_FA_MAX} and SA 0-${REPORT_SA_MAX}.`, 'error');
          return;
        }
        changes.push({ subjectId: sub.id, examId: ex.value, fa, sa });
      }
    }
    if (changes.length === 0) { setEditing(false); return; }

    setSavingMarks(true);
    try {
      const updatedDocs: any[] = [];
      for (const change of changes) {
        const match = (m: any) => m.examType === 'major_exam' && m.examId === change.examId
          && m.classId === selectedClassId && m.sectionId === selectedSectionId
          && m.subjectId === change.subjectId
          && (!m.academicYear || m.academicYear === school.academicYear);
        const local = allMarks.find(match);
        // Re-read the doc so a teacher's save in the meantime is not overwritten.
        const fresh = local?.id ? await MarksService.getById(local.id) as any : null;
        const base: ExamRecord[] = (fresh?.records || local?.records || []) as ExamRecord[];
        const records = upsertStudentMarks(base, selectedStudent.id, selectedStudent.name, change.fa, change.sa);
        if (local?.id) {
          await MarksService.update(local.id, { records });
          updatedDocs.push({ ...(fresh || local), id: local.id, records });
        } else {
          const payload = {
            examType: 'major_exam', examId: change.examId,
            examName: EXAM_COLUMNS.find(e => e.value === change.examId)?.label || change.examId,
            classId: selectedClassId, sectionId: selectedSectionId, subjectId: change.subjectId,
            faMax: REPORT_FA_MAX, records, status: 'draft',
            academicYear: school.academicYear, createdAt: new Date(),
          };
          const created: any = await MarksService.create(payload);
          updatedDocs.push({ ...payload, id: typeof created === 'string' ? created : created?.id });
        }
      }
      // 2. Show the saved marks immediately.
      setAllMarks(prev => {
        const byId = new Map(prev.map(m => [m.id, m]));
        updatedDocs.forEach(d => byId.set(d.id, d));
        return Array.from(byId.values());
      });
      setEditing(false);
      showToast(`Marks saved for ${selectedStudent.name}`);
    } catch (error) {
      console.error('[report-card] save marks failed', error);
      showToast('Could not save the marks. Check your connection and try again.', 'error');
    } finally {
      setSavingMarks(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  return (
    <div className="page-container">
      <style dangerouslySetInnerHTML={{__html: `
        @page {
          size: A4 landscape;
          /* margin:0 suppresses the browser-injected URL, timestamp and page
             numbers that were showing as "6/20/26 — Maruti Nursery — 1/2".
             Our own padding below gives the content breathing room. */
          margin: 0;
        }
        @media print {
          html, body {
            width: 297mm;
            margin: 0;
            padding: 0;
          }
          body * {
            visibility: hidden;
          }
          .printable-report, .printable-report * {
            visibility: visible;
          }
          .printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 8mm 10mm;
            box-shadow: none !important;
            border: none !important;
          }
          /* Keep the whole report on a single sheet. */
          .printable-report .report-table {
            font-size: 9px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .printable-report .report-table th,
          .printable-report .report-table td {
            padding: 2px 4px;
          }
          /* Signature rows had height:50px which alone pushed everything
             to a 2nd sheet — collapse them aggressively for print. */
          .printable-report .signature-row td {
            height: 26px !important;
            padding-bottom: 2px !important;
          }
          .no-print {
            display: none !important;
          }
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #000;
          font-family: Arial, sans-serif;
          font-size: 11px;
        }
        .report-table th, .report-table td {
          border: 1px solid #000;
          padding: 4px 6px;
          text-align: center;
        }
        .report-table th {
          font-weight: bold;
          background-color: #f9fafb;
        }
        .report-table .text-left {
          text-align: left;
        }
        .report-table .text-bold {
          font-weight: bold;
        }
        .report-table .col-sub {
          width: 25px;
        }
        .grade-text {
          color: #d97706; /* A1 grade color like in image */
        }
        .total-text {
          color: #dc2626; /* Red totals like in image */
        }
      `}} />

      <div className="page-header no-print" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="text-h1">Student Report Card</h1>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Select a student to generate and print their comprehensive academic report card.
          </p>
        </div>
        {reportData && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {canEditMarks && !editing && (
              <Button variant="secondary" onClick={startEditing}>Edit marks</Button>
            )}
            {editing && (
              <>
                <Button variant="secondary" onClick={() => { setEditing(false); setDrafts({}); }} disabled={savingMarks}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => { void saveMarks(); }} disabled={savingMarks}>
                  {savingMarks ? 'Saving...' : 'Save marks'}
                </Button>
              </>
            )}
            {!editing && (
              <Button variant="primary" icon={<PrinterIcon size={18} />} onClick={handlePrint}>
                Print Report Card
              </Button>
            )}
          </div>
        )}
      </div>

      {view !== 'parent' && (
        <div className="card no-print" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <Select 
              label="Class & Section" 
              value={`${selectedClassId}|${selectedSectionId}`}
              onChange={(e: any) => {
                if (e.target.value === '|') {
                  setSelectedClassId('');
                  setSelectedSectionId('');
                } else {
                  const [c, s] = e.target.value.split('|');
                  setSelectedClassId(c);
                  setSelectedSectionId(s);
                }
                setSelectedStudentId('');
              }}
              options={[
                { value: '|', label: 'Select Class...' },
                ...uniqueClassSections.map(a => ({
                  value: `${a.classId}|${a.sectionId}`,
                  label: `${a.className} - ${a.sectionName}`
                }))
              ]}
            />
            
            <Select
              label="Student"
              value={selectedStudentId}
              onChange={(e: any) => setSelectedStudentId(e.target.value)}
              disabled={!selectedClassId || !selectedSectionId}
              options={[
                { value: '', label: 'Select Student...' },
                ...classStudents.map(s => ({
                  value: s.id,
                  label: s.name
                }))
              ]}
            />
          </div>
        </div>
      )}

      {view === 'parent' && (() => {
        const myChildren = parentChildren;
        // No picker if 0 or 1 child — the single child auto-selects via the load effect.
        if (myChildren.length <= 1) return null;
        return (
          <div className="card no-print" style={{ padding: 20, marginBottom: 24 }}>
            <p className="text-caption" style={{ marginBottom: 12 }}>Select Child</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {myChildren.map((s: Student) => (
                <Button
                  key={s.id}
                  variant={selectedStudentId === s.id ? 'primary' : 'secondary'}
                  onClick={() => {
                    setSelectedClassId(s.classId);
                    setSelectedSectionId(s.sectionId);
                    setSelectedStudentId(s.id);
                  }}
                >
                  {s.name}
                </Button>
              ))}
            </div>
          </div>
        );
      })()}

      {reportData && selectedStudent && activeClassData && (
        <div className="card printable-report" ref={printableRef} style={{ padding: 32, overflowX: 'auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 24, textTransform: 'uppercase', fontWeight: 800 }}>Maruti Nursery & Primary School</h2>
            <h3 style={{ margin: '8px 0 0 0', fontSize: 18 }}>Academic Progress Report</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary-800)', margin: 0 }}>PROGRESS REPORT</h2>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary-600)', marginTop: '2px' }}>
                  ACADEMIC YEAR {school.academicYear}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Student Name: <span style={{ borderBottom: '1px dashed #000', padding: '0 40px 0 8px' }}>{selectedStudent.name}</span></div>
                <div>Class: <span style={{ borderBottom: '1px dashed #000', padding: '0 40px 0 8px' }}>{activeClassData.className} - {activeClassData.sectionName}</span></div>
                <div>Admission No: <span style={{ borderBottom: '1px dashed #000', padding: '0 40px 0 8px' }}>{selectedStudent.admissionNumber || '____'}</span></div>
              </div>
            </div>
          </div>

          <table className="report-table">
            <thead>
              <tr>
                <th rowSpan={2} style={{ minWidth: 120 }}>SUBJECT</th>
                {EXAM_COLUMNS.map(ex => (
                  <th key={ex.value} colSpan={4}>{ex.label}</th>
                ))}
              </tr>
              <tr>
                {EXAM_COLUMNS.map(ex => (
                  <React.Fragment key={ex.value + '_sub'}>
                    <th className="col-sub">FA<br/>40</th>
                    <th className="col-sub">SA<br/>60</th>
                    <th className="col-sub">Total<br/>100</th>
                    <th className="col-sub">Grade</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Subject Rows */}
              {reportData.subjects.map((sub: any) => (
                <tr key={sub.id}>
                  <td className="text-left text-bold" style={{ textTransform: 'uppercase' }}>{sub.name}</td>
                  {EXAM_COLUMNS.map(ex => {
                    const cell = reportData.matrix[sub.id][ex.value];
                    if (editing) {
                      const key = `${sub.id}|${ex.value}`;
                      const draft = drafts[key] || { fa: '', sa: '' };
                      const fa = parseMark(draft.fa, REPORT_FA_MAX);
                      const sa = parseMark(draft.sa, REPORT_SA_MAX);
                      const ok = fa !== 'invalid' && sa !== 'invalid';
                      const total = ok && (fa !== null || sa !== null)
                        ? Math.round(((fa ?? 0) + (sa ?? 0)) * 10) / 10
                        : null;
                      const input = (part: 'fa' | 'sa', max: number) => {
                        const bad = parseMark(draft[part], max) === 'invalid';
                        return (
                          <input
                            inputMode="decimal"
                            aria-label={`${sub.name} ${ex.label} ${part.toUpperCase()} out of ${max}`}
                            value={draft[part]}
                            onChange={e => setDraft(key, part, e.target.value)}
                            style={{
                              width: 38, padding: '2px', textAlign: 'center', fontSize: 12,
                              border: `1px solid ${bad ? 'var(--color-error)' : 'var(--color-border)'}`,
                              borderRadius: 4, background: bad ? '#fef2f2' : '#fff',
                            }}
                          />
                        );
                      };
                      return (
                        <React.Fragment key={ex.value + sub.id}>
                          <td>{input('fa', REPORT_FA_MAX)}</td>
                          <td>{input('sa', REPORT_SA_MAX)}</td>
                          <td className="total-text text-bold">{total ?? '-'}</td>
                          <td className="grade-text text-bold">{total ? getGrade(total, 100) : '-'}</td>
                        </React.Fragment>
                      );
                    }
                    if (!cell) {
                      return (
                        <React.Fragment key={ex.value + sub.id}>
                          <td>-</td><td>-</td><td>-</td><td>-</td>
                        </React.Fragment>
                      );
                    }
                    return (
                      <React.Fragment key={ex.value + sub.id}>
                        <td>{cell.faTotal !== undefined && cell.faTotal !== null ? cell.faTotal : '-'}</td>
                        <td>{cell.saScore !== undefined && cell.saScore !== null ? cell.saScore : '-'}</td>
                        <td className="total-text text-bold">{cell.totalMarks !== undefined && cell.totalMarks !== null ? cell.totalMarks : '-'}</td>
                        <td className="grade-text text-bold">{cell.totalMarks ? getGrade(cell.totalMarks, 100) : '-'}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}

              {/* Total Row */}
              <tr>
                <td className="text-left text-bold">TOTAL</td>
                {EXAM_COLUMNS.map(ex => {
                  const stat = reportData.examTotals[ex.value];
                  if (stat.count === 0) return <td key={ex.value} colSpan={4}>-</td>;
                  return (
                    <td key={ex.value} colSpan={4} className="total-text text-bold" style={{ fontSize: 13 }}>
                      {stat.total}
                    </td>
                  );
                })}
              </tr>

              {/* Average Row */}
              <tr>
                <td className="text-left text-bold">AVERAGE</td>
                {EXAM_COLUMNS.map(ex => {
                  const stat = reportData.examTotals[ex.value];
                  if (stat.count === 0) return <td key={ex.value} colSpan={4}>-</td>;
                  const maxPossible = reportData.subjects.length * 100;
                  const avg = maxPossible > 0 ? (stat.total / maxPossible) * 100 : 0;
                  return (
                    <td key={ex.value} colSpan={4} className="text-bold">
                      {avg.toFixed(0)}%
                    </td>
                  );
                })}
              </tr>

              {/* Grade Row */}
              <tr>
                <td className="text-left text-bold">GRADE</td>
                {EXAM_COLUMNS.map(ex => {
                  const stat = reportData.examTotals[ex.value];
                  if (stat.count === 0) return <td key={ex.value} colSpan={4}>-</td>;
                  const maxPossible = reportData.subjects.length * 100;
                  const grade = getGrade(stat.total, maxPossible);
                  return (
                    <td key={ex.value} colSpan={4} className="grade-text text-bold">
                      {grade}
                    </td>
                  );
                })}
              </tr>

              {/* Working Days Row */}
              <tr>
                <td className="text-left text-bold">NO OF WORKING DAYS</td>
                {EXAM_COLUMNS.map(ex => (
                  <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.workingDays || '-'}</td>
                ))}
              </tr>

              {/* Remarks Row */}
              <tr>
                <td className="text-left text-bold">REMARKS</td>
                {EXAM_COLUMNS.map(ex => (
                  <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.remarks || '-'}</td>
                ))}
              </tr>

              {/* Co-Scholastic Headers */}
              <tr>
                <td className="text-left text-bold">NEATNESS</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.neatness || '-'}</td>)}
              </tr>
              <tr>
                <td className="text-left text-bold">LIFE SKILLS</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.lifeSkills || '-'}</td>)}
              </tr>
              <tr>
                <td className="text-left text-bold">ATTITUDES AND VALUES</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.attitudes || '-'}</td>)}
              </tr>
              <tr>
                <td className="text-left text-bold">YOGA, HEALTH & WELLNESS</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.yoga || '-'}</td>)}
              </tr>
              <tr>
                <td className="text-left text-bold">CO-CURRICULAR ACTIVITIES</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.coCurricular || '-'}</td>)}
              </tr>
              
              {/* Signatures */}
              <tr className="signature-row">
                <td className="text-left text-bold" style={{ height: 50, verticalAlign: 'bottom', paddingBottom: 8 }}>SIGNATURE OF CLASS TEACHER</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} style={{ verticalAlign: 'bottom', paddingBottom: 8 }}></td>)}
              </tr>
              <tr className="signature-row">
                <td className="text-left text-bold" style={{ height: 50, verticalAlign: 'bottom', paddingBottom: 8 }}>SIGNATURE OF THE PRINCIPAL</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} style={{ verticalAlign: 'bottom', paddingBottom: 8 }}></td>)}
              </tr>
              <tr className="signature-row">
                <td className="text-left text-bold" style={{ height: 50, verticalAlign: 'bottom', paddingBottom: 8 }}>SIGNATURE OF THE PARENT</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} style={{ verticalAlign: 'bottom', paddingBottom: 8 }}></td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
