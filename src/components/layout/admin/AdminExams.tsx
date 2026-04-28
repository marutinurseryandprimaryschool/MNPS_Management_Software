'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  AssessmentService, 
  ClassesService, 
  StudentsService, 
  MarksService 
} from '@/lib/firestore-service';
import Input, { Select } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Badge, Tabs } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';
import { 
  CheckCircleIcon, 
  EyeIcon, 
  ArrowLeftIcon,
  CalendarIcon,
  ChevronLeftIcon,
  PlusIcon,
  UsersIcon
} from '@/components/ui/Icons';
import type { AssessmentSession, Class, Student } from '@/types/models';
import { MonthlyExam, ExamTerm, EXAM_TERM_LABELS } from '@/types/enums';

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

interface AdminExamsProps {
  type?: 'formative' | 'summative' | 'all';
}

export default function AdminExams({ type = 'all' }: AdminExamsProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [activeTab, setActiveTab] = useState<'open' | 'closed' | 'all'>('open');
  const [selectedSession, setSelectedSession] = useState<AssessmentSession | null>(null);
  const [sessionMarks, setSessionMarks] = useState<any | null>(null);
  const [showCreator, setShowCreator] = useState(false);

  // Creation State
  const [selectedAcademicTerm, setSelectedAcademicTerm] = useState<'Term 1' | 'Term 2' | 'Term 3' | ''>('');
  const [selectedTerm, setSelectedTerm] = useState<ExamTerm | ''>('');
  const [selectedMonth, setSelectedMonth] = useState<MonthlyExam | ''>('');
  const [selectedWeek, setSelectedWeek] = useState<'W1' | 'W2' | 'W3' | 'W4' | 'all'>('all');
  const [examType, setExamType] = useState<'weekly' | 'term'>(type === 'formative' ? 'weekly' : 'term');
  const [maxMarks, setMaxMarks] = useState(type === 'formative' ? '10' : '100');
  const [selectedAssignments, setSelectedAssignments] = useState<{classId: string, sectionId: string}[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const TERM_TO_EXAMS: Record<string, ExamTerm[]> = {
    'Term 1': [ExamTerm.I_MID_TERM, ExamTerm.QUARTERLY],
    'Term 2': [ExamTerm.II_MID_TERM, ExamTerm.HALF_YEARLY],
    'Term 3': [ExamTerm.III_MID_TERM, ExamTerm.ANNUAL],
  };

  const fetchData = async () => {
    try {
      const [sessionsData, classesData, studentsData] = await Promise.all([
        AssessmentService.getAll(),
        ClassesService.getAll(),
        StudentsService.getAll(),
      ]);
      
      let filtered = sessionsData as unknown as AssessmentSession[];
      if (type === 'formative') filtered = filtered.filter(s => s.type === 'weekly');
      else if (type === 'summative') filtered = filtered.filter(s => s.type === 'term');

      setSessions(filtered);
      setClasses(classesData as unknown as Class[]);
      setStudents(studentsData as unknown as Student[]);
    } catch (error) {
      console.error('Error fetching admin exams:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
    setExamType(type === 'formative' ? 'weekly' : 'term');
    setMaxMarks(type === 'formative' ? '10' : '100');
  }, [type]);

  const toggleAssignment = (classId: string, sectionId: string) => {
    setSelectedAssignments(prev => {
      const exists = prev.find(a => a.classId === classId && a.sectionId === sectionId);
      if (exists) return prev.filter(a => !(a.classId === classId && a.sectionId === sectionId));
      return [...prev, { classId, sectionId }];
    });
  };

  const handleCreateSession = async () => {
    if (selectedAssignments.length === 0) return showToast('Select Class & Section');
    setIsCreating(true);
    try {
      const weeksToCreate = (examType === 'weekly' && selectedWeek === 'all') ? ['W1', 'W2', 'W3', 'W4'] : [selectedWeek];
      for (const assignment of selectedAssignments) {
        const classData = classes.find(c => c.id === assignment.classId);
        const sectionName = classData?.sections.find(s => s.id === assignment.sectionId)?.name || '';
        for (const week of weeksToCreate) {
          const isDuplicate = sessions.some(s => s.type === examType && s.classId === assignment.classId && s.sectionId === assignment.sectionId && (examType === 'weekly' ? (s.month === selectedMonth && s.week === week) : s.term === selectedTerm));
          if (isDuplicate) continue;
          let name = examType === 'weekly' ? `${classData?.name} ${sectionName} - ${MONTH_LABELS[selectedMonth as string]} ${week}` : `${classData?.name} ${sectionName} - ${EXAM_TERM_LABELS[selectedTerm as ExamTerm]}`;
          await AssessmentService.create({ schoolId: 'maruti-nursery', type: examType, name, term: examType === 'term' ? selectedTerm : null, academicTerm: selectedAcademicTerm, month: examType === 'weekly' ? selectedMonth : null, week: examType === 'weekly' ? week : null, classId: assignment.classId, sectionId: assignment.sectionId, className: classData?.name || '', sectionName, status: 'open', maxMarks: parseInt(maxMarks), subjects: classData?.subjects || [], createdBy: 'admin', createdAt: new Date() });
        }
      }
      showToast('Evaluation Batch Opened!');
      fetchData();
      setShowCreator(false);
      setSelectedAssignments([]);
    } catch (error) { showToast('Failed to create'); } finally { setIsCreating(false); }
  };

  const handleToggleStatus = async (session: AssessmentSession) => {
    const newStatus = session.status === 'open' ? 'closed' : 'open';
    try {
      await AssessmentService.update(session.id, { status: newStatus });
      showToast(`Exam ${newStatus === 'open' ? 'Re-opened' : 'Closed'}`);
      fetchData();
    } catch (error) { console.error(error); }
  };

  const handleViewMarks = async (session: AssessmentSession) => {
    setSelectedSession(session);
    try {
      const allMarks = await MarksService.getAll();
      const existing = allMarks.find((m: any) => m.classId === session.classId && m.sectionId === session.sectionId && ((session.type === 'term' && m.term === session.term) || (session.type === 'weekly' && m.month === session.month && m.week === session.week)));
      setSessionMarks(existing || null);
    } catch (error) { console.error(error); }
  };

  const consolidatedBatches = useMemo(() => {
    const groups: Record<string, any> = {};
    const filtered = sessions.filter(s => {
      if (activeTab === 'open') return s.status === 'open';
      if (activeTab === 'closed') return s.status === 'closed';
      return true;
    });
    filtered.forEach(s => {
      const batchKey = s.type === 'weekly' ? `${s.academicTerm} - ${MONTH_LABELS[s.month || '']}` : `${s.academicTerm}`;
      if (!groups[batchKey]) groups[batchKey] = { key: batchKey, type: s.type, academicTerm: s.academicTerm, month: s.month, classes: {} };
      const classKey = `${s.className} ${s.sectionName}`;
      if (!groups[batchKey].classes[classKey]) groups[batchKey].classes[classKey] = { name: classKey, classId: s.classId, sectionId: s.sectionId, sessions: {} };
      const sessionKey = s.type === 'weekly' ? s.week : s.term;
      groups[batchKey].classes[classKey].sessions[sessionKey as string] = s;
    });
    return Object.values(groups).map(batch => ({
      ...batch,
      classes: Object.values(batch.classes).sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    })).sort((a, b) => a.key.localeCompare(b.key));
  }, [sessions, activeTab]);

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  if (selectedSession) {
    const sessionStudents = students.filter(s => s.classId === selectedSession.classId && s.sectionId === selectedSession.sectionId);
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button onClick={() => { setSelectedSession(null); setSessionMarks(null); }} style={{ width: 40, height: 40, borderRadius: '8px', border: '1px solid var(--color-border)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeftIcon size={20} /></button>
          <div>
            <h2 className="text-h2" style={{ margin: 0 }}>{selectedSession.name}</h2>
            <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', margin: '4px 0 0 0' }}>{sessionStudents.length} students in this class</p>
          </div>
        </div>

        {sessionStudents.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <p>No students found for this class/section.</p>
            <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Class: {selectedSession.classId}, Section: {selectedSession.sectionId}</p>
          </div>
        ) : sessionMarks && sessionMarks.records && sessionMarks.records.length > 0 ? (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Student</th>
                  {selectedSession.subjects.map(sub => <th key={sub.id} style={{ padding: '12px', textAlign: 'center' }}>{sub.name}</th>)}
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 700 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {sessionStudents.map(student => {
                  const record = sessionMarks.records.find((r: any) => String(r.studentId) === String(student.id));
                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                      <td style={{ padding: '12px' }}>{student.name}</td>
                      {selectedSession.subjects.map(sub => {
                        const score = record?.subjectScores?.find((s: any) => s.subjectId === sub.id)?.marksObtained;
                        return <td key={sub.id} style={{ padding: '12px', textAlign: 'center', color: score ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>{score ?? '—'}</td>;
                      })}
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700 }}>{record?.marksObtained ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ marginBottom: '8px' }}>No marks submitted for this session yet.</p>
            <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Teachers need to enter and submit marks for this evaluation.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
           <h1 className="text-h1">{type === 'formative' ? 'Formative Cycles' : 'Summative Exams'}</h1>
           <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Manage school-wide evaluations by month and class.</p>
        </div>
        <Button variant="primary" icon={<PlusIcon size={18} />} onClick={() => setShowCreator(!showCreator)}>{showCreator ? 'View All' : 'Create New Cycle'}</Button>
      </div>

      {showCreator && (
        <div className="card" style={{ padding: '24px', marginBottom: '32px', background: 'var(--color-primary-50)' }}>
           <h3 className="text-h4" style={{ marginTop: 0, marginBottom: '20px' }}>Setup New Evaluation</h3>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <Select label="Term" value={selectedAcademicTerm} onChange={e => setSelectedAcademicTerm(e.target.value as any)} options={[{value:'',label:'Term...'},{value:'Term 1',label:'Term One'},{value:'Term 2',label:'Term Two'},{value:'Term 3',label:'Term Three'}]} />
              {type === 'formative' ? <Select label="Month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value as any)} options={[{value:'',label:'Month...'},...Object.keys(MONTH_LABELS).map(m=>({value:m,label:MONTH_LABELS[m]}))]} /> : <Select label="Milestone" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value as any)} options={[{value:'',label:'Exam...'},...(selectedAcademicTerm?TERM_TO_EXAMS[selectedAcademicTerm].map(t=>({value:t,label:EXAM_TERM_LABELS[t]})):[])]} />}
              <Input label="Max Marks" type="number" value={maxMarks} onChange={e => setMaxMarks(e.target.value)} />
           </div>
           <p className="text-caption" style={{ fontWeight: 700, marginBottom: '8px' }}>Target Classes</p>
           <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
              {classes.map(cls => cls.sections.map(sec => {
                const isSelected = selectedAssignments.some(a => a.classId === cls.id && a.sectionId === sec.id);
                return <button key={`${cls.id}-${sec.id}`} onClick={() => toggleAssignment(cls.id, sec.id)} style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid', borderColor: isSelected ? 'var(--color-primary-500)' : 'var(--color-border)', background: isSelected ? 'var(--color-primary-100)' : 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>{cls.name}-{sec.name}</button>;
              }))}
           </div>
           <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="primary" onClick={handleCreateSession} loading={isCreating}>Open Cycle</Button></div>
        </div>
      )}

      <div style={{ marginBottom: '24px' }}><Tabs tabs={[{id:'open',label:'Active Cycles'},{id:'closed',label:'History'}]} activeTab={activeTab} onChange={val => setActiveTab(val as any)} /></div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {consolidatedBatches.map(batch => (
          <div key={batch.key}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <CalendarIcon size={20} color="var(--color-primary-600)" />
                <h3 className="text-h3" style={{ margin: 0 }}>{batch.key}</h3>
                <div style={{ height: '1px', flex: 1, background: 'var(--color-divider)' }}></div>
             </div>
             
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {Object.values(batch.classes).map((cls: any) => {
                  const keys = batch.type === 'weekly' ? ['W1', 'W2', 'W3', 'W4'] : TERM_TO_EXAMS[batch.academicTerm];
                  return (
                    <div key={cls.name} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 className="text-h4" style={{ margin: 0 }}>{cls.name}</h4>
                          <Badge variant="outline" size="sm">{batch.type.toUpperCase()}</Badge>
                       </div>
                       
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                          {keys.map(k => {
                            const s = cls.sessions[k];
                            return (
                              <button
                                key={k}
                                disabled={!s}
                                onClick={() => s && handleViewMarks(s)}
                                style={{
                                  height: '44px', borderRadius: '8px', border: '1px solid var(--color-border)',
                                  background: !s ? 'var(--color-surface-variant)' : s.status === 'closed' ? 'var(--color-success-bg)' : 'white',
                                  color: !s ? 'var(--color-text-tertiary)' : s.status === 'closed' ? 'var(--color-success)' : 'var(--color-text-primary)',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                  cursor: s ? 'pointer' : 'not-allowed', transition: 'all 0.2s', fontSize: '10px', fontWeight: 800
                                }}
                              >
                                {k}
                                {s?.status === 'closed' && <CheckCircleIcon size={12} style={{ marginTop: '2px' }} />}
                              </button>
                            );
                          })}
                       </div>

                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--color-divider)' }}>
                          <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Actions:</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                             {Object.keys(cls.sessions).sort().map(key => {
                               const s = cls.sessions[key];
                               return (
                                 <button key={s.id} onClick={() => handleToggleStatus(s)} style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer' }}>
                                   {key}: {s.status === 'open' ? 'Finalize' : 'Re-open'}
                                 </button>
                               );
                             })}
                          </div>
                       </div>
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
