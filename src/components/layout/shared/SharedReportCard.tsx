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
  parseMark, parseKgMark, upsertStudentMarks, upsertCoRecord, isKgClass,
  CO_FIELDS, REPORT_FA_MAX, REPORT_SA_MAX, type ExamRecord, type CoField,
} from '@/lib/report-card-utils';
import ReportCardSheet, { EXAM_COLUMNS, type MarkDraft, type CoDraft } from './ReportCardSheet';
import type { Class, Student } from '@/types/models';

interface SharedReportCardProps {
  view: 'admin' | 'teacher' | 'parent';
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

  /* -- Edit (teachers, Principal, admin; never parents) --
     Mark drafts are keyed "subjectId|examId"; co-scholastic drafts by examId.
     Saving writes the SAME per-student records the Exam Marks and
     Co-Scholastic screens use: one record per student, whoever edits it. */
  const canEditMarks = view !== 'parent';
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, MarkDraft>>({});
  const [coDrafts, setCoDrafts] = useState<Record<string, CoDraft>>({});
  const [initial, setInitial] = useState<{ marks: Record<string, MarkDraft>; co: Record<string, CoDraft> }>({ marks: {}, co: {} });
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
  useEffect(() => { setEditing(false); setDrafts({}); setCoDrafts({}); }, [selectedStudentId, selectedClassId, selectedSectionId]);

  const isKG = isKgClass(activeClassData?.className);
  const markText = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
  const emptyCo = (): CoDraft => Object.fromEntries(CO_FIELDS.map(f => [f, ''])) as CoDraft;

  const startEditing = () => {
    if (!reportData) return;
    const marks: Record<string, MarkDraft> = {};
    reportData.subjects.forEach((sub: any) => {
      EXAM_COLUMNS.forEach(ex => {
        const cell = reportData.matrix[sub.id][ex.value];
        const fa = markText(cell?.faTotal);
        const sa = markText(cell?.saScore);
        marks[`${sub.id}|${ex.value}`] = {
          fa, sa,
          // A total typed on its own (GK, Computer, Hindi) — only when there is no FA/SA split.
          total: fa === '' && sa === '' ? markText(cell?.totalMarks) : '',
          kg: markText(cell?.kgMark ?? cell?.totalMarks),
        };
      });
    });
    const co: Record<string, CoDraft> = {};
    EXAM_COLUMNS.forEach(ex => {
      const rec = reportData.coScholasticData[ex.value] || {};
      const d = emptyCo();
      CO_FIELDS.forEach(f => { d[f] = markText(rec[f]); });
      co[ex.value] = d;
    });
    setDrafts(marks);
    setCoDrafts(co);
    setInitial({ marks, co });
    setEditing(true);
  };

  const setDraft = (key: string, part: keyof MarkDraft, value: string) =>
    setDrafts(prev => ({ ...prev, [key]: { ...(prev[key] || { fa: '', sa: '', total: '', kg: '' }), [part]: value } }));
  const setCoDraft = (examId: string, field: CoField, value: string) =>
    setCoDrafts(prev => ({ ...prev, [examId]: { ...(prev[examId] || emptyCo()), [field]: value } }));

  const saveMarks = async () => {
    if (!reportData || !selectedStudent || savingMarks || !school?.academicYear) return;
    const year = school.academicYear;
    const examLabel = (id: string) => EXAM_COLUMNS.find(e => e.value === id)?.label || id;

    // 1. Validate and collect only what changed.
    type MarkChange = { subjectId: string; examId: string; fa: number | null; sa: number | null; total: number | null; kg: string | null };
    const markChanges: MarkChange[] = [];
    for (const sub of reportData.subjects as any[]) {
      for (const ex of EXAM_COLUMNS) {
        const key = `${sub.id}|${ex.value}`;
        const d = drafts[key] || { fa: '', sa: '', total: '', kg: '' };
        const before = initial.marks[key] || { fa: '', sa: '', total: '', kg: '' };
        if (isKG) {
          if (d.kg.trim() === before.kg.trim()) continue;
          const kg = parseKgMark(d.kg);
          if (kg === 'invalid') {
            showToast(`${sub.name}, ${ex.label}: enter a mark 0-100, "ab", "-" or a grade letter.`, 'error');
            return;
          }
          markChanges.push({ subjectId: sub.id, examId: ex.value, fa: null, sa: null, total: null, kg: kg.value });
          continue;
        }
        if (d.fa.trim() === before.fa.trim() && d.sa.trim() === before.sa.trim() && d.total.trim() === before.total.trim()) continue;
        const fa = parseMark(d.fa, REPORT_FA_MAX);
        const sa = parseMark(d.sa, REPORT_SA_MAX);
        const total = fa === null && sa === null ? parseMark(d.total, 100) : null;
        if (fa === 'invalid' || sa === 'invalid' || total === 'invalid') {
          showToast(`${sub.name}, ${ex.label}: FA 0-${REPORT_FA_MAX}, SA 0-${REPORT_SA_MAX}, or a total 0-100.`, 'error');
          return;
        }
        markChanges.push({ subjectId: sub.id, examId: ex.value, fa, sa, total, kg: null });
      }
    }
    const coChanges = EXAM_COLUMNS
      .map(ex => ex.value as string)
      .filter(examId => CO_FIELDS.some(f => (coDrafts[examId]?.[f] ?? '').trim() !== (initial.co[examId]?.[f] ?? '').trim()));
    if (markChanges.length === 0 && coChanges.length === 0) { setEditing(false); return; }

    setSavingMarks(true);
    try {
      // 2. Marks: one doc per class/section/subject/exam; only this student's record changes.
      const updatedDocs: any[] = [];
      for (const change of markChanges) {
        const match = (m: any) => m.examType === 'major_exam' && m.examId === change.examId
          && m.classId === selectedClassId && m.sectionId === selectedSectionId
          && m.subjectId === change.subjectId
          && (!m.academicYear || m.academicYear === year);
        const local = allMarks.find(match);
        // Re-read so a teacher's save in the meantime is not overwritten.
        const fresh = local?.id ? await MarksService.getById(local.id) as any : null;
        const base: ExamRecord[] = (fresh?.records || local?.records || []) as ExamRecord[];
        const records = upsertStudentMarks(base, selectedStudent.id, selectedStudent.name,
          change.fa, change.sa, { total: change.total, kgMark: change.kg });
        if (local?.id) {
          await MarksService.update(local.id, { records });
          updatedDocs.push({ ...(fresh || local), id: local.id, records });
        } else {
          const payload = {
            examType: 'major_exam', examId: change.examId, examName: examLabel(change.examId),
            classId: selectedClassId, sectionId: selectedSectionId, subjectId: change.subjectId,
            isKG, faMax: REPORT_FA_MAX, records, status: 'draft', academicYear: year, createdAt: new Date(),
          };
          const created: any = await MarksService.create(payload);
          updatedDocs.push({ ...payload, id: typeof created === 'string' ? created : created?.id });
        }
      }

      // 3. Co-scholastic: one doc per class/section/exam; only this student's record changes.
      const updatedCo: any[] = [];
      for (const examId of coChanges) {
        const fresh = await CoScholasticService.getByClassSectionExam(selectedClassId, selectedSectionId, examId, year) as any;
        const changed: Partial<Record<CoField, string>> = {};
        CO_FIELDS.forEach(f => {
          const now = coDrafts[examId]?.[f] ?? '';
          if (now.trim() !== (initial.co[examId]?.[f] ?? '').trim()) changed[f] = now;
        });
        const records = upsertCoRecord(fresh?.records || [], selectedStudent.id, selectedStudent.name, changed);
        if (fresh?.id) {
          await CoScholasticService.update(fresh.id, { records, updatedAt: new Date().toISOString() });
          updatedCo.push({ ...fresh, records });
        } else {
          const payload = {
            classId: selectedClassId, sectionId: selectedSectionId, examId,
            academicYear: year, records, updatedAt: new Date().toISOString(),
          };
          const created: any = await CoScholasticService.create(payload);
          updatedCo.push({ ...payload, id: typeof created === 'string' ? created : created?.id });
        }
      }

      // 4. Show the saved values immediately.
      const merge = (prev: any[], next: any[]) => {
        const byId = new Map(prev.map(m => [m.id, m]));
        next.forEach(d => byId.set(d.id, d));
        return Array.from(byId.values());
      };
      if (updatedDocs.length) setAllMarks(prev => merge(prev, updatedDocs));
      if (updatedCo.length) setAllCoScholastic(prev => merge(prev, updatedCo));
      setEditing(false);
      showToast(`Report card saved for ${selectedStudent.name}`);
    } catch (error) {
      console.error('[report-card] save failed', error);
      showToast('Could not save the report card. Check your connection and try again.', 'error');
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
              <Button variant="secondary" onClick={startEditing}>Edit report card</Button>
            )}
            {editing && (
              <>
                <Button variant="secondary" onClick={() => { setEditing(false); setDrafts({}); setCoDrafts({}); }} disabled={savingMarks}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => { void saveMarks(); }} disabled={savingMarks}>
                  {savingMarks ? 'Saving...' : 'Save report card'}
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
                <div style={{ fontWeight: 700 }}>STD: <span style={{ borderBottom: '1px dashed #000', padding: '0 24px 0 8px' }}>{activeClassData.className} {activeClassData.sectionName}</span></div>
                <div>Student Name: <span style={{ borderBottom: '1px dashed #000', padding: '0 40px 0 8px' }}>{selectedStudent.name}</span></div>
                <div>Class: <span style={{ borderBottom: '1px dashed #000', padding: '0 40px 0 8px' }}>{activeClassData.className} - {activeClassData.sectionName}</span></div>
                <div>Admission No: <span style={{ borderBottom: '1px dashed #000', padding: '0 40px 0 8px' }}>{selectedStudent.admissionNumber || '____'}</span></div>
              </div>
            </div>
          </div>

          <ReportCardSheet
            isKG={isKG}
            subjects={reportData.subjects}
            matrix={reportData.matrix}
            coData={reportData.coScholasticData}
            editing={editing}
            drafts={drafts}
            coDrafts={coDrafts}
            onMark={setDraft}
            onCo={setCoDraft}
          />
        </div>
      )}
    </div>
  );
}
