'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  MarksService, 
  StudentsService, 
  TeachersService, 
  AssessmentService
} from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';
import { 
  CheckCircleIcon, ClipboardCheckIcon, CalendarIcon, ChevronLeftIcon, EyeIcon
} from '@/components/ui/Icons';
import type { Student, AssessmentSession } from '@/types/models';
import { MonthlyExam } from '@/types/enums';

const MONTH_LABELS: Record<string, string> = {
  [MonthlyExam.JUNE]: 'June',
  [MonthlyExam.JULY]: 'July',
  [MonthlyExam.AUGUST]: 'August',
  [MonthlyExam.SEPTEMBER]: 'September',
  [MonthlyExam.OCTOBER]: 'October',
  [MonthlyExam.NOVEMBER]: 'November',
  [MonthlyExam.DECEMBER]: 'December',
  [MonthlyExam.JANUARY]: 'January',
  [MonthlyExam.FEBRUARY]: 'February',
  [MonthlyExam.MARCH]: 'March',
};

type MonthlyMarksMap = Record<string, Record<string, string>>;

export default function TeacherFormative() {
  const { user } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [teacher, setTeacher] = useState<any>(null);
  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [allMarks, setAllMarks] = useState<any[]>([]);
  
  const [activeSession, setActiveSession] = useState<AssessmentSession | null>(null);
  const [marks, setMarks] = useState<MonthlyMarksMap>({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    try {
      if (!user || !school?.academicYear) return;
      const [studentsData, sessionsData, marksData] = await Promise.all([
        StudentsService.getAll(school.academicYear),
        AssessmentService.getAll(school.academicYear),
        MarksService.getAll(school.academicYear),
      ]);
      let tData = await TeachersService.getByUserId(user.uid || user.id, school.academicYear) || await TeachersService.getByEmail(user.email || '', school.academicYear);
      setTeacher(tData);
      setStudents(studentsData as unknown as Student[]);
      setAllMarks(marksData);
      const filtered = (sessionsData as unknown as AssessmentSession[]).filter(s => 
        s.type === 'weekly' && tData?.assignedClasses?.some((a: any) => a.classId === s.classId && a.sectionId === s.sectionId)
      );
      setSessions(filtered);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user, school?.academicYear]);

  const loadExistingMarks = async (session: AssessmentSession) => {
    const existing = allMarks.find((m: any) => m.examType === 'formative_weekly' && m.month === session.month && m.week === session.week && m.classId === session.classId && m.sectionId === session.sectionId);
    if (existing) {
      const newMarks: MonthlyMarksMap = {};
      existing.records.forEach((r: any) => {
        newMarks[r.studentId] = {};
        r.subjectScores.forEach((s: any) => { newMarks[r.studentId][s.subjectId] = String(s.marksObtained); });
      });
      setMarks(newMarks);
    } else { setMarks({}); }
  };

  const handleEnterMarks = (session: AssessmentSession) => {
    const tSubIds = teacher?.subjects || [];
    const filteredSubs = session.subjects.filter(s => tSubIds.includes(s.id));
    if (filteredSubs.length === 0) return showToast('Not authorized for these subjects.');
    setActiveSession({ ...session, subjects: filteredSubs });
    loadExistingMarks(session);
  };

  const handleSaveMarks = async () => {
    if (!activeSession || activeSession.status === 'closed') return;
    setIsSaving(true);
    try {
      const classStudents = students.filter(s => s.classId === activeSession.classId && s.sectionId === activeSession.sectionId);
      const records = classStudents.map(student => {
        const studentMarks = marks[student.id] || {};
        const subjectScores = activeSession.subjects.map(sub => ({ subjectId: sub.id, subjectName: sub.name, marksObtained: parseInt(studentMarks[sub.id]) || 0 }));
        return { studentId: student.id, studentName: student.name, marksObtained: subjectScores.reduce((sum, s) => sum + s.marksObtained, 0), subjectScores };
      });
      const existing = allMarks.find((m: any) => m.examType === 'formative_weekly' && m.month === activeSession.month && m.week === activeSession.week && m.classId === activeSession.classId && m.sectionId === activeSession.sectionId);
      let finalRecords = records;
      if (existing) {
        finalRecords = existing.records.map((oldR: any) => {
          const newR = records.find(r => r.studentId === oldR.studentId);
          if (!newR) return oldR;
          const merged = oldR.subjectScores.map((oldS: any) => {
            const match = newR.subjectScores.find(ns => ns.subjectId === oldS.subjectId);
            return match ? match : oldS;
          });
          return { ...oldR, subjectScores: merged, marksObtained: merged.reduce((sum: number, s: any) => sum + s.marksObtained, 0) };
        });
      }
      const payload = { examType: 'formative_weekly', examName: activeSession.name, month: activeSession.month, week: activeSession.week, classId: activeSession.classId, sectionId: activeSession.sectionId, className: activeSession.className, sectionName: activeSession.sectionName, maxMarks: activeSession.maxMarks, subjects: (existing as any)?.subjects || activeSession.subjects, records: finalRecords, status: 'published' };
      if (existing) await MarksService.update(existing.id, payload);
      else await MarksService.create({ ...payload, createdAt: new Date() });
      showToast(`Marks saved!`);
      setActiveSession(null);
      fetchData();
    } catch (error) { showToast('Failed to save marks'); } finally { setIsSaving(false); }
  };

  const isCompleted = (s: AssessmentSession) => {
    const tSubIds = teacher?.subjects || [];
    const ex = allMarks.find((m: any) => m.examType === 'formative_weekly' && m.month === s.month && m.week === s.week && m.classId === s.classId && m.sectionId === s.sectionId);
    return !!ex && ex.records.some((r: any) => r.subjectScores.some((sc: any) => tSubIds.includes(sc.subjectId)));
  };

  const gridData = useMemo(() => {
    const months: Record<string, any> = {};
    sessions.forEach(s => {
      const monthKey = s.month ? MONTH_LABELS[s.month] || s.month : 'Other';
      if (!months[monthKey]) months[monthKey] = { name: monthKey, classes: {} };
      const classKey = `${s.className}-${s.sectionName}`;
      if (!months[monthKey].classes[classKey]) months[monthKey].classes[classKey] = { className: s.className, sectionName: s.sectionName, academicTerm: s.term, sessions: {} };
      months[monthKey].classes[classKey].sessions[s.week || 'W1'] = { ...s, isDone: isCompleted(s) };
    });
    return Object.values(months).map(month => ({
      ...month,
      classes: Object.values(month.classes).sort((a: any, b: any) => a.className.localeCompare(b.className, undefined, { numeric: true }))
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions, allMarks, teacher]);

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  if (activeSession) {
    const classStudents = students.filter(s => s.classId === activeSession.classId && s.sectionId === activeSession.sectionId);
    const isReadOnly = activeSession.status === 'closed';

    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button onClick={() => setActiveSession(null)} style={{ width: 40, height: 40, borderRadius: '8px', border: '1px solid var(--color-border)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeftIcon size={20} /></button>
          <div>
            <h2 className="text-h2" style={{ margin: 0 }}>{activeSession.name}</h2>
            {isReadOnly && <Badge variant="warning" size="sm">READ ONLY - FINALIZED</Badge>}
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Student</th>
                  {activeSession.subjects.map(sub => <th key={sub.id} style={{ padding: '12px', textAlign: 'center' }}>{sub.name}</th>)}
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 700 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map(student => (
                  <tr key={student.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <td style={{ padding: '12px' }}>{student.name}</td>
                    {activeSession.subjects.map(sub => (
                      <td key={sub.id} style={{ padding: '8px', textAlign: 'center' }}>
                        <input 
                          type="text" 
                          disabled={isReadOnly}
                          value={marks[student.id]?.[sub.id] || ''} 
                          onChange={e => { const v = e.target.value; if ((parseInt(v)||0) > (activeSession.maxMarks||100)) return; setMarks(p=>({...p,[student.id]:{...(p[student.id]||{}),[sub.id]:v}})); }} 
                          placeholder="0" 
                          style={{ 
                            width: '60px', padding: '8px', textAlign: 'center', borderRadius: '4px', border: '1px solid var(--color-border)',
                            background: isReadOnly ? 'var(--color-surface-variant)' : 'white'
                          }} 
                        />
                      </td>
                    ))}
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700 }}>{activeSession.subjects.reduce((sum, sub) => sum + (parseInt(marks[student.id]?.[sub.id]) || 0), 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isReadOnly && (
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', background: 'var(--color-surface-variant)' }}>
              <Button variant="primary" onClick={handleSaveMarks} loading={isSaving}>Submit Evaluation</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '40px' }}>
        <h1 className="text-h1">Monthly Formative</h1>
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Fill marks for each week in the monthly evaluation cycle.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {gridData.map(month => (
          <div key={month.name}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <CalendarIcon size={20} color="var(--color-primary-600)" />
                <h3 className="text-h3" style={{ margin: 0 }}>{month.name} Cycle</h3>
                <div style={{ height: '1px', flex: 1, background: 'var(--color-divider)' }}></div>
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {Object.values(month.classes).map((cls: any) => {
                  const weeks = ['W1', 'W2', 'W3', 'W4'];
                  const doneCount = weeks.filter(w => cls.sessions[w]?.isDone).length;
                  return (
                    <div key={`${month.name}-${cls.className}`} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                             <h4 className="text-h4" style={{ margin: 0 }}>{cls.className}-{cls.sectionName}</h4>
                             <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{cls.academicTerm}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                             <span style={{ display: 'block', fontSize: '18px', fontWeight: 800, color: doneCount === 4 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{doneCount}/4</span>
                             <span className="text-caption">Done</span>
                          </div>
                       </div>

                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                          {weeks.map(w => {
                            const s = cls.sessions[w];
                            const isFinalized = s?.status === 'closed';
                            return (
                              <button
                                key={w}
                                disabled={!s}
                                onClick={() => s && handleEnterMarks(s)}
                                style={{
                                  height: '44px', borderRadius: '8px', border: '1px solid var(--color-border)',
                                  background: !s ? 'var(--color-surface-variant)' : isFinalized ? 'var(--color-info-bg)' : s.isDone ? 'var(--color-success-bg)' : 'white',
                                  color: !s ? 'var(--color-text-tertiary)' : isFinalized ? 'var(--color-info)' : s.isDone ? 'var(--color-success)' : 'var(--color-text-primary)',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                  cursor: s ? 'pointer' : 'not-allowed', transition: 'all 0.2s', fontSize: '10px', fontWeight: 800
                                }}
                              >
                                {w}
                                {isFinalized ? <EyeIcon size={12} style={{ marginTop: '2px' }} /> : s?.isDone ? <CheckCircleIcon size={12} style={{ marginTop: '2px' }} /> : <ClipboardCheckIcon size={12} style={{ marginTop: '2px' }} />}
                              </button>
                            );
                          })}
                       </div>
                       {Object.values(cls.sessions).some((s: any) => s.status === 'closed') && (
                         <p className="text-caption" style={{ color: 'var(--color-info)', fontWeight: 600, textAlign: 'center', margin: 0 }}>Some weeks are finalized (Read-Only)</p>
                       )}
                    </div>
                  );
                })}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
