'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { WeeklyTestsService, StudentsService, TeachersService, ClassesService, MarksService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Select } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';
import { ChevronLeftIcon, CheckCircleIcon, CalendarIcon } from '@/components/ui/Icons';
import type { Student, Teacher, Class } from '@/types/models';

const MONTHS = [
  { value: 'june', label: 'June' }, { value: 'july', label: 'July' },
  { value: 'august', label: 'August' }, { value: 'september', label: 'September' },
  { value: 'october', label: 'October' }, { value: 'november', label: 'November' },
  { value: 'december', label: 'December' }, { value: 'january', label: 'January' },
  { value: 'february', label: 'February' }, { value: 'march', label: 'March' },
];

const MONTH_LABEL: Record<string, string> = Object.fromEntries(MONTHS.map(m => [m.value, m.label]));

const EXAMS = [
  { value: 'i_mid_term', label: 'I Mid Term', term: 'Term 1', defaultMonths: ['june', 'july'] },
  { value: 'quarterly', label: 'Quarterly', term: 'Term 1', defaultMonths: ['june', 'july', 'august', 'september'] },
  { value: 'ii_mid_term', label: 'II Mid Term', term: 'Term 2', defaultMonths: ['october', 'november'] },
  { value: 'half_yearly', label: 'Half Yearly', term: 'Term 2', defaultMonths: ['october', 'november', 'december', 'january'] },
  { value: 'iii_mid_term', label: 'III Mid Term', term: 'Term 3', defaultMonths: ['january', 'february'] },
  { value: 'annual', label: 'Annual', term: 'Term 3', defaultMonths: ['january', 'february', 'march'] },
];

// Calculate best 2 scores from a list of numbers
function bestTwo(scores: number[]): number {
  const valid = scores.filter(s => !isNaN(s) && s >= 0);
  if (valid.length === 0) return 0;
  return valid.sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0);
}

type MarksMap = Record<string, {
  faProject: string;
  faReading: string;
  sa: string;
  faClassExam?: number; // auto-calculated
}>;

export default function TeacherExamMarks() {
  const { user } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [allMarks, setAllMarks] = useState<any[]>([]);

  // Step 1: Selection
  const [selectedExam, setSelectedExam] = useState(EXAMS[0].value);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedMonths, setSelectedMonths] = useState<string[]>(EXAMS[0].defaultMonths);
  const [isKG, setIsKG] = useState(false);

  // Step 2: Marks data
  const [weeklyData, setWeeklyData] = useState<Record<string, Record<string, number[]>>>({}); // studentId -> subjectId -> scores[]
  const [marks, setMarks] = useState<MarksMap>({});
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<'setup' | 'entry'>('setup');
  const [saveStatus, setSaveStatus] = useState<'loading' | 'saved' | 'unsaved' | 'none'>('none');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        if (!school?.academicYear) return;
        const [td, cl, st, marksData] = await Promise.all([
          TeachersService.getByUserId(user.uid || user.id, school.academicYear),
          ClassesService.getAll(school.academicYear),
          StudentsService.getAll(school.academicYear),
          MarksService.getAll(school.academicYear),
        ]);
        const teacherObj = (td || await TeachersService.getByEmail(user.email || '', school.academicYear)) as unknown as Teacher;
        setTeacher(teacherObj);
        setAllClasses(cl as unknown as Class[]);
        setStudents(st as unknown as Student[]);
        setAllMarks(marksData as any[]);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    load();
  }, [user, school?.academicYear]);

  const uniqueClassSections = useMemo(() => {
    const list: any[] = [];
    const added = new Set<string>();
    
    (teacher?.assignedClasses || []).forEach(ac => {
      const cls = allClasses.find(c => c.id === ac.classId);
      const sids = (ac as any).sectionIds || (ac.sectionId ? [ac.sectionId] : []);
      sids.forEach((sid: string) => {
        const section = cls?.sections.find(s => s.id === sid);
        const key = `${ac.classId}|${sid}`;
        if (!added.has(key)) {
          added.add(key);
          list.push({
            classId: ac.classId,
            sectionId: sid,
            className: cls?.name || ac.className || 'Unknown Class',
            sectionName: section?.name || ac.sectionName || 'Unknown Section',
          });
        }
      });
    });
    return list;
  }, [teacher, allClasses]);

  const availableSubjects = useMemo(() => {
    if (!selectedClassId || !selectedSectionId) return [];
    
    const list: any[] = [];
    const added = new Set<string>();

    (teacher?.assignedClasses || []).forEach(ac => {
      if (ac.classId !== selectedClassId) return;
      const sids = (ac as any).sectionIds || (ac.sectionId ? [ac.sectionId] : []);
      if (!sids.includes(selectedSectionId)) return;

      const cls = allClasses.find(c => c.id === ac.classId);
      const subIds = (ac as any).subjectIds || (ac.subjectId ? [ac.subjectId] : []);
      
      subIds.forEach((subId: string) => {
        if (!added.has(subId)) {
          added.add(subId);
          const subject = cls?.subjects.find(s => s.id === subId);
          list.push({
            subjectId: subId,
            subjectName: subject?.name || ac.subjectName || 'Unknown Subject'
          });
        }
      });
    });

    if (list.length === 0 && teacher?.subjects?.length) {
      const cls = allClasses.find(c => c.id === selectedClassId);
      if (cls) {
        cls.subjects.forEach(sub => {
          if (teacher.subjects.includes(sub.id)) {
            list.push({
              subjectId: sub.id,
              subjectName: sub.name
            });
          }
        });
      }
    }

    return list;
  }, [teacher, allClasses, selectedClassId, selectedSectionId]);

  useEffect(() => {
    if (uniqueClassSections.length > 0 && !selectedClassId) {
      const first = uniqueClassSections[0];
      setSelectedClassId(first.classId);
      setSelectedSectionId(first.sectionId);
    }
  }, [uniqueClassSections, selectedClassId]);

  useEffect(() => {
    if (availableSubjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(availableSubjects[0].subjectId);
    }
  }, [availableSubjects, selectedSubjectId]);

  const classId = selectedClassId;
  const sectionId = selectedSectionId;
  const subjectId = selectedSubjectId;

  const classStudents = useMemo(() =>
    students.filter(s => s.classId === classId && s.sectionId === sectionId)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [students, classId, sectionId]
  );

  const faMax = isKG ? 20 : 40;
  const examInfo = EXAMS.find(e => e.value === selectedExam)!;

  const toggleMonth = (m: string) => {
    setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const handleProceed = async () => {
    if (!classId || !subjectId || selectedMonths.length === 0) {
      showToast('Please select a class, subject, and at least one month.');
      return;
    }

    // Fetch weekly test data for selected months
    try {
      const allWeekly: any[] = [];
      for (const month of selectedMonths) {
        const data = await WeeklyTestsService.getByClassSubjectMonth(classId, sectionId, subjectId, month, school.academicYear);
        allWeekly.push(...data);
      }

      // Build: studentId -> all weekly scores across selected months
      const weeklyMap: Record<string, number[]> = {};
      for (const wt of allWeekly) {
        if (!weeklyMap[wt.studentId]) weeklyMap[wt.studentId] = [];
        const w = wt.weeks || {};
        ['W1', 'W2', 'W3', 'W4'].forEach(k => {
          if (w[k] !== undefined && w[k] !== null) weeklyMap[wt.studentId].push(Number(w[k]));
        });
      }

      // Load existing exam marks if any
      const existingMark = await MarksService.getAll().then((all: any[]) =>
        all.find(m => m.examType === 'major_exam' && m.examId === selectedExam && m.classId === classId && m.sectionId === sectionId && m.subjectId === subjectId)
      );

      const initMarks: MarksMap = {};
      for (const student of classStudents) {
        const scores = weeklyMap[student.id] || [];
        const faClassExam = bestTwo(scores);
        const existing = existingMark?.records?.find((r: any) => r.studentId === student.id);
        initMarks[student.id] = {
          faProject: existing ? String(existing.faProjectScore ?? '') : '',
          faReading: isKG ? '0' : (existing ? String(existing.faReadingScore ?? '') : ''),
          sa: existing ? String(existing.saScore ?? '') : '',
          faClassExam,
        };
      }

      setMarks(initMarks);
      setSaveStatus(existingMark ? 'saved' : 'none');
      setIsEditing(!existingMark);
      setStep('entry');
    } catch (e) {
      console.error(e);
      showToast('Failed to load weekly test data.');
    }
  };

  const loadRecentMark = (m: any) => {
    setSelectedExam(m.examId);
    setSelectedClassId(m.classId);
    setSelectedSectionId(m.sectionId);
    setSelectedSubjectId(m.subjectId);
    setSelectedMonths(m.selectedMonths || []);
    
    const initMarks: MarksMap = {};
    for (const r of (m.records || [])) {
      initMarks[r.studentId] = {
        faProject: String(r.faProjectScore ?? ''),
        faReading: String(r.faReadingScore ?? ''),
        sa: String(r.saScore ?? ''),
        faClassExam: r.faClassExamScore || 0,
      };
    }
    setMarks(initMarks);
    setSaveStatus('saved');
    setIsEditing(false);
    setStep('entry');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const records = classStudents.map(student => {
        const m = marks[student.id] || {};
        const faClass = m.faClassExam ?? 0;
        const faProj = parseInt(m.faProject) || 0;
        const faRead = isKG ? 0 : (parseInt(m.faReading) || 0);
        const faTotal = faClass + faProj + faRead;
        const sa = parseInt(m.sa) || 0;
        return {
          studentId: student.id, studentName: student.name,
          faClassExamScore: faClass, faProjectScore: faProj,
          faReadingScore: faRead, faTotal,
          saScore: sa, totalMarks: faTotal + sa,
          selectedMonths,
        };
      });

      // Check if record already exists
      const allMarks = await MarksService.getAll() as any[];
      const existing = allMarks.find(m =>
        m.examType === 'major_exam' && m.examId === selectedExam &&
        m.classId === classId && m.sectionId === sectionId && m.subjectId === subjectId
      );

      const payload = {
        examType: 'major_exam', examId: selectedExam,
        examName: examInfo.label, classId, sectionId, subjectId,
        isKG, faMax, selectedMonths, records, status: 'draft',
        academicYear: school.academicYear,
      };

      if (existing) await MarksService.update(existing.id, payload);
      else await MarksService.create({ ...payload, createdAt: new Date() });

      setSaveStatus('saved');
      setIsEditing(false);
      showToast(`Marks saved for ${examInfo.label}!`);
      setStep('setup');
    } catch (e) {
      console.error(e);
      showToast('Failed to save marks.');
    } finally { setIsSaving(false); }
  };

  const updateMark = (studentId: string, field: 'faProject' | 'faReading' | 'sa', value: string) => {
    const maxes: Record<string, number> = { 
      faProject: 10, 
      faReading: 10, 
      sa: isKG ? 80 : 60 
    };
    const num = parseInt(value);
    if (value !== '' && (isNaN(num) || num < 0 || num > maxes[field])) return;
    setMarks(p => ({ ...p, [studentId]: { ...(p[studentId] || {}), [field]: value } }));
    setSaveStatus('unsaved');
  };

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  // ─── ENTRY VIEW ───
  if (step === 'entry') {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={() => setStep('setup')} style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeftIcon size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 className="text-h2" style={{ margin: 0 }}>{examInfo.label} — Marks Entry</h2>
              {saveStatus === 'saved' && <Badge variant="success">All Saved</Badge>}
              {saveStatus === 'unsaved' && <Badge variant="warning">Unsaved Changes</Badge>}
            </div>
            <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
              FA months: {selectedMonths.map(m => MONTH_LABEL[m]).join(', ')} | FA = {faMax} pts
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
            {saveStatus === 'saved' && !isEditing ? (
              <Button variant="secondary" onClick={() => setIsEditing(true)}>
                Edit Marks
              </Button>
            ) : (
              <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={saveStatus === 'saved' && !isEditing}>
                Save Marks
              </Button>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', minWidth: 200 }}>Student</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: 'var(--color-primary-700)', background: 'var(--color-primary-50)' }}>Class Exam (Best 2) /{faMax === 40 ? 20 : 20}</th>
                  {!isKG && <th style={{ padding: '12px', textAlign: 'center' }}>Project /10</th>}
                  {!isKG && <th style={{ padding: '12px', textAlign: 'center' }}>Reading /10</th>}
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 700, background: 'var(--color-primary-50)', color: 'var(--color-primary-700)' }}>FA Total /{faMax}</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>SA (Exam Paper)</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 800 }}>Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map(student => {
                  const m = marks[student.id] || { faClassExam: 0, faProject: '', faReading: '', sa: '' };
                  const faClass = m.faClassExam ?? 0;
                  const faProj = parseInt(m.faProject) || 0;
                  const faRead = isKG ? 0 : (parseInt(m.faReading) || 0);
                  const faTotal = faClass + faProj + faRead;
                  const sa = parseInt(m.sa) || 0;
                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{student.name}</td>
                      <td style={{ padding: '8px', textAlign: 'center', background: 'var(--color-primary-50)' }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-700)' }}>{faClass}</span>
                        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', display: 'block' }}>auto</span>
                      </td>
                      {!isKG && (
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <input type="text" value={m.faProject} onChange={e => updateMark(student.id, 'faProject', e.target.value)}
                            placeholder="0" disabled={!isEditing && saveStatus === 'saved'} style={{ 
                              width: 56, padding: '8px', textAlign: 'center', borderRadius: 6, border: '1px solid var(--color-border)',
                              background: (!isEditing && saveStatus === 'saved') ? 'var(--color-surface-variant)' : 'white'
                            }} />
                        </td>
                      )}
                      {!isKG && (
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <input type="text" value={m.faReading} onChange={e => updateMark(student.id, 'faReading', e.target.value)}
                            placeholder="0" disabled={!isEditing && saveStatus === 'saved'} style={{ 
                              width: 56, padding: '8px', textAlign: 'center', borderRadius: 6, border: '1px solid var(--color-border)',
                              background: (!isEditing && saveStatus === 'saved') ? 'var(--color-surface-variant)' : 'white'
                            }} />
                        </td>
                      )}
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, background: 'var(--color-primary-50)', color: faTotal > faMax ? 'var(--color-error)' : 'var(--color-primary-700)' }}>
                        {faTotal}/{faMax}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <input type="text" value={m.sa} onChange={e => updateMark(student.id, 'sa', e.target.value)}
                          placeholder="0" disabled={!isEditing && saveStatus === 'saved'} style={{ 
                            width: 64, padding: '8px', textAlign: 'center', borderRadius: 6, border: '1px solid var(--color-border)',
                            background: (!isEditing && saveStatus === 'saved') ? 'var(--color-surface-variant)' : 'white'
                          }} />
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 800, fontSize: 16 }}>
                        {faTotal + sa}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ─── SETUP VIEW ───
  const teacherAssignments = (teacher?.assignedClasses as any[]) || [];
  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: 32 }}>
        <h1 className="text-h1">Exam Marks Entry</h1>
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          Select the exam, class, and the months whose weekly tests form the FA score.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32, alignItems: 'start' }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <Select label="Exam" value={selectedExam}
            onChange={e => {
              const ex = EXAMS.find(x => x.value === e.target.value)!;
              setSelectedExam(e.target.value);
              setSelectedMonths(ex.defaultMonths);
            }}
            options={EXAMS.map(e => ({ value: e.value, label: `${e.label} (${e.term})` }))}
          />
          <Select 
            label="Class & Section" 
            value={`${selectedClassId}|${selectedSectionId}`}
            onChange={e => {
              if (e.target.value === '|') {
                setSelectedClassId('');
                setSelectedSectionId('');
              } else {
                const [c, s] = e.target.value.split('|');
                setSelectedClassId(c);
                setSelectedSectionId(s);
              }
              setSelectedSubjectId('');
            }}
            options={[
              { value: '|', label: 'Select Class & Section' },
              ...uniqueClassSections.map(a => ({
                value: `${a.classId}|${a.sectionId}`,
                label: `${a.className} - ${a.sectionName}`
              }))
            ]}
          />
          <Select 
            label="Subject" 
            value={selectedSubjectId}
            onChange={e => setSelectedSubjectId(e.target.value)}
            options={[
              { value: '', label: 'Select Subject' },
              ...availableSubjects.map(a => ({
                value: a.subjectId,
                label: a.subjectName
              }))
            ]}
            disabled={!selectedClassId || !selectedSectionId}
          />
        </div>

        {/* KG Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '12px 16px', background: 'var(--color-surface-variant)', borderRadius: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={isKG} onChange={e => setIsKG(e.target.checked)} style={{ width: 16, height: 16 }} />
            <span className="text-body-sm" style={{ fontWeight: 600 }}>KG Student (FA = 20 marks — Class Exam only)</span>
          </label>
          {!isKG && <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Standard 1+ (FA = 20 Class + 10 Project + 10 Reading = 40)</span>}
        </div>

        {/* Month Selection */}
        <p className="text-caption" style={{ fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Select Months for FA Calculation
        </p>
        <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
          The system will find all weekly tests in the selected months and pick the best 2 scores.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {MONTHS.map(m => {
            const active = selectedMonths.includes(m.value);
            return (
              <button key={m.value} onClick={() => toggleMonth(m.value)} style={{
                padding: '8px 16px', borderRadius: 20, border: '1px solid',
                borderColor: active ? 'var(--color-primary-500)' : 'var(--color-border)',
                background: active ? 'var(--color-primary-100)' : 'white',
                color: active ? 'var(--color-primary-700)' : 'var(--color-text-primary)',
                cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'all 0.2s'
              }}>
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Summary */}
        <div style={{ padding: '12px 16px', background: 'var(--color-primary-50)', borderRadius: 8, marginBottom: 24, display: 'flex', gap: 24 }}>
          <div><span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>FA Structure</span>
            <p className="text-body-sm" style={{ fontWeight: 700, margin: 0 }}>{isKG ? '20 (Class Exam)' : '20 + 10 + 10 = 40'}</p>
          </div>
          <div><span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Selected Months</span>
            <p className="text-body-sm" style={{ fontWeight: 700, margin: 0 }}>{selectedMonths.map(m => MONTH_LABEL[m]).join(', ') || 'None'}</p>
          </div>
          <div><span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Students</span>
            <p className="text-body-sm" style={{ fontWeight: 700, margin: 0 }}>{classStudents.length}</p>
          </div>
        </div>

        <Button variant="primary" style={{ width: '100%', marginTop: 24 }} onClick={handleProceed}>
          Load Weekly Data & Proceed to Entry →
        </Button>
      </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 className="text-h3" style={{ marginBottom: 16 }}>Recent Mark Entries</h3>
          {allMarks.filter(m => m.examType === 'major_exam').length === 0 ? (
            <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No recent marks added.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {allMarks
                .filter(m => m.examType === 'major_exam')
                .sort((a, b) => {
                  const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
                  const db = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
                  return db - da;
                })
                .slice(0, 5)
                .map(m => {
                  const cls = allClasses.find(c => c.id === m.classId);
                  const sec = cls?.sections.find(s => s.id === m.sectionId);
                  const sub = cls?.subjects.find(s => s.id === m.subjectId);
                  return (
                    <div 
                      key={m.id} 
                      onClick={() => loadRecentMark(m)}
                      style={{ 
                        padding: 12, borderRadius: 8, border: '1px solid var(--color-border)', 
                        background: 'var(--color-surface)', cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary-300)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{m.examName}</span>
                        <Badge variant="success">Saved</Badge>
                      </div>
                      <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                        {cls?.name} - {sec?.name} | {sub?.name}
                      </div>
                      <div className="text-caption" style={{ marginTop: 8, color: 'var(--color-text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{m.records?.length || 0} Students</span>
                        <span>{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString() : 'Recent'}</span>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
