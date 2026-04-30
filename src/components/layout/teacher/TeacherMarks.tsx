'use client';

import React, { useState, useEffect } from 'react';
import { 
  MarksService, 
  StudentsService, 
  TeachersService, 
  ClassesService, 
  ReportCardService,
  AssessmentService 
} from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Select } from '@/components/ui/Input';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Tabs, Avatar, Badge } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';
import { 
  ArrowLeftIcon, FileTextIcon, CheckCircleIcon, 
  EditIcon, TrashIcon 
} from '@/components/ui/Icons';
import type { Student, Class, Teacher, Marks, Subject, ReportCard, AssessmentSession } from '@/types/models';
import { ExamTerm, EXAM_TERM_LABELS, EXAM_TERMS_ORDER } from '@/types/enums';
import { buildTermSummary } from '@/lib/report-card-utils';

type SubjectMarksMap = Record<string, Record<string, { fa: string; sa: string }>>;

export default function TeacherMarks() {
  const { user } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [allMarks, setAllMarks] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [activeSession, setActiveSession] = useState<AssessmentSession | null>(null);
  const [marks, setMarks] = useState<SubjectMarksMap>({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    try {
      if (!user || !school?.academicYear) return;
      const [classesData, studentsData, sessionsData, marksData] = await Promise.all([
        ClassesService.getAll(school.academicYear),
        StudentsService.getAll(school.academicYear),
        AssessmentService.getAll(school.academicYear),
        MarksService.getAll(school.academicYear),
      ]);
      
      let teacherData = await TeachersService.getByUserId(user.uid || user.id, school.academicYear);
      if (!teacherData && user.email) teacherData = await TeachersService.getByEmail(user.email, school.academicYear);
      
      const teacherObj = teacherData as unknown as Teacher | null;
      setTeacher(teacherObj);
      setClasses(classesData as unknown as Class[]);
      setStudents(studentsData as unknown as Student[]);
      setAllMarks(marksData);

      // Filter sessions: Only show term sessions for classes the teacher is assigned to
      const allSessions = sessionsData as unknown as AssessmentSession[];
      const filteredSessions = allSessions.filter(s => {
        if (!teacherObj) return false;
        if (s.type !== 'term') return false;
        return teacherObj.assignedClasses?.some(a => {
          const sids = (a as any).sectionIds || (a.sectionId ? [a.sectionId] : []);
          return a.classId === s.classId && sids.includes(s.sectionId);
        });
      });
      setSessions(filteredSessions);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user, school?.academicYear]);

  const handleEnterMarks = (session: AssessmentSession) => {
    if (teacher) {
      const isAssigned = teacher.assignedClasses?.some(a => {
        const sids = (a as any).sectionIds || (a.sectionId ? [a.sectionId] : []);
        return a.classId === session.classId && sids.includes(session.sectionId);
      });
      if (!isAssigned) {
        showToast('You are not assigned to this class or section.');
        return;
      }

      const teacherSubjectIds = teacher.subjects || [];
      const filteredSubjects = session.subjects.filter(s => teacherSubjectIds.includes(s.id));
      
      if (filteredSubjects.length === 0) {
        showToast('You are assigned to this class, but none of your authorized subjects are in this exam.');
        return;
      }
      
      setActiveSession({ ...session, subjects: filteredSubjects });
      loadExistingMarks(session);
    } else {
      setActiveSession(session);
      loadExistingMarks(session);
    }
  };

  const loadExistingMarks = async (session: AssessmentSession) => {
    const existing = allMarks.find((m: any) => 
      m.examType === 'term_evaluation' && 
      m.term === session.term && 
      m.classId === session.classId && 
      m.sectionId === session.sectionId
    );

    if (existing) {
      const newMarks: SubjectMarksMap = {};
      (existing as any).records.forEach((r: any) => {
        newMarks[r.studentId] = {};
        r.subjectScores.forEach((s: any) => {
          newMarks[r.studentId][s.subjectId] = {
            fa: String(s.fa || 0),
            sa: String(s.sa || 0)
          };
        });
      });
      setMarks(newMarks);
    } else {
      setMarks({});
    }
  };

  const handleMarkChange = (studentId: string, subjectId: string, field: 'fa' | 'sa', value: string) => {
    const num = parseInt(value) || 0;
    const max = field === 'fa' ? 40 : 60;
    if (num > max) return;
    
    setMarks(p => ({
      ...p,
      [studentId]: {
        ...(p[studentId] || {}),
        [subjectId]: {
          ...(p[studentId]?.[subjectId] || { fa: '0', sa: '0' }),
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async () => {
    if (!activeSession) return;
    
    setIsSaving(true);
    try {
      const classStudents = students.filter(s => s.classId === activeSession.classId && s.sectionId === activeSession.sectionId);
      
      const currentEntryRecords = classStudents.map(student => {
        const studentMarks = marks[student.id] || {};
        const subjectScores = activeSession.subjects.map(sub => {
          const fa = parseInt(studentMarks[sub.id]?.fa) || 0;
          const sa = parseInt(studentMarks[sub.id]?.sa) || 0;
          return {
            subjectId: sub.id,
            subjectName: sub.name,
            fa,
            sa,
            total: fa + sa,
            marksObtained: fa + sa
          };
        });
        
        return {
          studentId: student.id,
          studentName: student.name,
          marksObtained: subjectScores.reduce((sum, s) => sum + s.total, 0),
          subjectScores,
        };
      });

      const examName = activeSession.name;
      const existing = allMarks.find((m: any) => 
        m.examType === 'term_evaluation' && 
        m.term === activeSession.term && 
        m.classId === activeSession.classId && 
        m.sectionId === activeSession.sectionId
      );

      let finalRecords = currentEntryRecords;

      if (existing) {
        finalRecords = (existing as any).records.map((oldRecord: any) => {
          const newRecord = currentEntryRecords.find(r => r.studentId === oldRecord.studentId);
          if (!newRecord) return oldRecord;

          const newScoresMap = new Map(newRecord.subjectScores.map(s => [s.subjectId, s]));
          const mergedSubjectScores = oldRecord.subjectScores.map((oldSub: any) => {
            if (newScoresMap.has(oldSub.subjectId)) return newScoresMap.get(oldSub.subjectId);
            return oldSub;
          });

          return {
            ...oldRecord,
            subjectScores: mergedSubjectScores,
            marksObtained: mergedSubjectScores.reduce((sum: number, s: any) => sum + (s.total || 0), 0)
          };
        });
      }

      const payload = {
        examType: 'term_evaluation',
        examName,
        term: activeSession.term,
        classId: activeSession.classId,
        sectionId: activeSession.sectionId,
        className: activeSession.className,
        sectionName: activeSession.sectionName,
        maxMarks: 100,
        subjects: (existing as any)?.subjects || activeSession.subjects,
        records: finalRecords,
        status: 'published',
      };

      if (existing) {
        await MarksService.update(existing.id, payload);
      } else {
        await MarksService.create({ ...payload, createdAt: new Date() });
      }

      // Sync with Report Cards
      for (const record of finalRecords) {
        const student = students.find(s => s.id === record.studentId);
        if (!student) continue;

        const subjectsList = (existing as any)?.subjects || activeSession.subjects;
        const studentFa: Record<string, number> = {};
        const studentSa: Record<string, number> = {};
        const studentSaMax: Record<string, number> = {};
        
        record.subjectScores.forEach((s: any) => {
          studentFa[s.subjectId] = s.fa || 0;
          studentSa[s.subjectId] = s.sa || 0;
          studentSaMax[s.subjectId] = 60;
        });

        const termSummary = buildTermSummary(
          activeSession.term as ExamTerm,
          subjectsList,
          studentFa,
          studentSa,
          studentSaMax,
          school.settings?.gradeScale
        );

        const existingCards = await ReportCardService.getByStudent(student.id);
        const reportCardData = existingCards[0] as unknown as ReportCard;
        
        const updatedReportCard: Partial<ReportCard> = reportCardData ? { ...reportCardData } : {
          studentId: student.id,
          studentName: student.name,
          admissionNumber: student.admissionNumber,
          classId: activeSession.classId,
          sectionId: activeSession.sectionId,
          academicYear: school.academicYear,
          terms: {},
          coScholastic: [],
          attendance: [],
          remarks: {},
          status: 'draft'
        };

        updatedReportCard.terms = {
          ...(updatedReportCard.terms || {}),
          [activeSession.term as string]: termSummary
        };

        if (reportCardData?.id) {
          await ReportCardService.update(reportCardData.id, updatedReportCard as any);
        } else {
          await ReportCardService.create(updatedReportCard as any);
        }
      }

      showToast(`Marks for ${examName} saved and synced!`);
      setActiveSession(null);
      fetchData();
    } catch (error) {
      console.error('Error saving marks:', error);
      showToast('Failed to save marks');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMarks = async (session: AssessmentSession) => {
    if (!teacher) return;
    if (!window.confirm('Are you sure you want to delete your marks for this session? This action cannot be undone.')) return;

    try {
      const existing = allMarks.find((m: any) => 
        m.examType === 'term_evaluation' && 
        m.term === session.term && 
        m.classId === session.classId && 
        m.sectionId === session.sectionId
      );

      if (!existing) return;

      const teacherSubjectIds = teacher.subjects || [];
      
      const updatedRecords = existing.records.map((record: any) => {
        const remainingScores = record.subjectScores.filter((s: any) => !teacherSubjectIds.includes(s.subjectId));
        return {
          ...record,
          subjectScores: remainingScores,
          marksObtained: remainingScores.reduce((sum: number, s: any) => sum + (s.total || 0), 0)
        };
      });

      await MarksService.update(existing.id, {
        ...existing,
        records: updatedRecords
      });

      showToast('Marks deleted. Session moved to Pending.');
      fetchData();
    } catch (error) {
      console.error('Error deleting marks:', error);
      showToast('Failed to delete marks');
    }
  };

  const isSessionCompleted = (session: AssessmentSession) => {
    if (!teacher) return false;
    const teacherSubjectIds = teacher.subjects || [];
    
    const existing = allMarks.find((m: any) => 
      m.examType === 'term_evaluation' && 
      m.term === session.term && 
      m.classId === session.classId && 
      m.sectionId === session.sectionId
    );

    if (!existing) return false;

    return existing.records.some((r: any) => 
      r.subjectScores.some((s: any) => teacherSubjectIds.includes(s.subjectId))
    );
  };

  const pendingSessions = sessions.filter(s => !isSessionCompleted(s));
  const completedSessions = sessions.filter(s => isSessionCompleted(s));

  if (loading) return <div className="page-container"><p>Loading Summative Assessments...</p></div>;

  if (activeSession) {
    const classStudents = students.filter(s => s.classId === activeSession.classId && s.sectionId === activeSession.sectionId);
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <Button variant="secondary" size="sm" onClick={() => setActiveSession(null)} icon={<ArrowLeftIcon size={16} />} />
          <div>
            <h2 className="text-h2" style={{ margin: 0 }}>{activeSession.name}</h2>
            <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Entering FA (40) and SA (60) Marks</p>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', position: 'sticky', left: 0, background: 'var(--color-surface-variant)', zIndex: 1 }}>Student Name</th>
                  {activeSession.subjects.map(sub => (
                    <th key={sub.id} colSpan={2} style={{ padding: '12px', textAlign: 'center', minWidth: '160px', borderLeft: '1px solid var(--color-border)' }}>{sub.name}</th>
                  ))}
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 700, borderLeft: '2px solid var(--color-border)' }}>Total</th>
                </tr>
                <tr style={{ background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)', fontSize: '11px' }}>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--color-surface-variant)', zIndex: 1 }}></th>
                  {activeSession.subjects.map(sub => (
                    <React.Fragment key={sub.id}>
                      <th style={{ padding: '4px', textAlign: 'center', borderLeft: '1px solid var(--color-border)', color: 'var(--color-text-tertiary)' }}>FA (40)</th>
                      <th style={{ padding: '4px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>SA (60)</th>
                    </React.Fragment>
                  ))}
                  <th style={{ borderLeft: '2px solid var(--color-border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map(student => {
                  let studentTotal = 0;
                  activeSession.subjects.forEach(sub => {
                    const fa = parseInt(marks[student.id]?.[sub.id]?.fa) || 0;
                    const sa = parseInt(marks[student.id]?.[sub.id]?.sa) || 0;
                    studentTotal += (fa + sa);
                  });
                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                      <td style={{ padding: '12px', fontWeight: 500, position: 'sticky', left: 0, background: 'var(--color-white)', zIndex: 1 }}>{student.name}</td>
                      {activeSession.subjects.map(sub => (
                        <React.Fragment key={sub.id}>
                          <td style={{ padding: '8px 4px', textAlign: 'center', borderLeft: '1px solid var(--color-divider)' }}>
                            <input 
                              type="text" value={marks[student.id]?.[sub.id]?.fa || ''} 
                              onChange={e => handleMarkChange(student.id, sub.id, 'fa', e.target.value)}
                              placeholder="0"
                              style={{ width: '45px', padding: '6px', textAlign: 'center', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                            />
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                            <input 
                              type="text" value={marks[student.id]?.[sub.id]?.sa || ''} 
                              onChange={e => handleMarkChange(student.id, sub.id, 'sa', e.target.value)}
                              placeholder="0"
                              style={{ width: '45px', padding: '6px', textAlign: 'center', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                            />
                          </td>
                        </React.Fragment>
                      ))}
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, borderLeft: '2px solid var(--color-border)' }}>{studentTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)' }}>
            <Button variant="primary" onClick={handleSubmit} loading={isSaving}>Save All Marks</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Summative Assessments</h2>
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Upload final marks for major milestone exams (Mid-terms, Quarterly, Annual).</p>
      </div>

      <Tabs 
        tabs={[
          { id: 'pending', label: 'Pending', count: pendingSessions.length },
          { id: 'completed', label: 'Completed', count: completedSessions.length }
        ]} 
        activeTab={activeTab} 
        onChange={val => setActiveTab(val as any)} 
      />

      <div style={{ marginTop: 'var(--space-6)' }}>
        {activeTab === 'pending' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {pendingSessions.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 'var(--space-12)', opacity: 0.5 }}>
                <p>No pending term assessments. All marks are entered!</p>
              </div>
            ) : (
              pendingSessions.map(session => (
                <div 
                  key={session.id} 
                  className="card" 
                  style={{ 
                    padding: 'var(--space-6)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: 'var(--space-5)',
                    borderLeft: '4px solid var(--color-info-500)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'white',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'default',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                    e.currentTarget.style.borderColor = 'var(--color-info-200)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        <Badge variant="info" size="sm">
                          {session.className} - {session.sectionName}
                        </Badge>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--color-border)' }}></span>
                        <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontWeight: 500 }}>Term Evaluation</span>
                      </div>
                      <h4 className="text-h4" style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.4, color: 'var(--color-text-primary)' }}>{session.name}</h4>
                    </div>
                    <div style={{ 
                      width: '44px', 
                      height: '44px', 
                      borderRadius: '12px', 
                      background: 'var(--color-info-50)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'var(--color-info-600)',
                      flexShrink: 0,
                      boxShadow: 'inset 0 0 0 1px var(--color-info-100)'
                    }}>
                      <FileTextIcon size={22} />
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: 'var(--space-4)',
                    padding: 'var(--space-4)',
                    background: 'var(--color-surface-variant)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontWeight: 500, fontSize: '10px', textTransform: 'uppercase' }}>Structure</span>
                      <span className="text-body-sm" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>40 FA + 60 SA</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontWeight: 500, fontSize: '10px', textTransform: 'uppercase' }}>Subjects</span>
                      <span className="text-body-sm" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{session.subjects.length} Assigned</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto' }}>
                    <Button 
                      variant="primary" 
                      style={{ 
                        width: '100%', 
                        height: '44px', 
                        fontSize: '0.95rem', 
                        fontWeight: 600,
                        background: 'var(--color-info-600)',
                        boxShadow: '0 4px 12px var(--color-info-200)' 
                      }} 
                      onClick={() => handleEnterMarks(session)}
                    >
                      Enter Summative Marks
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {completedSessions.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 'var(--space-12)', opacity: 0.5 }}>
                <p>No completed term assessments yet.</p>
              </div>
            ) : (
              completedSessions.map(session => (
                <div 
                  key={session.id} 
                  className="card" 
                  style={{ 
                    padding: 'var(--space-6)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: 'var(--space-5)',
                    borderLeft: '4px solid var(--color-success-500)',
                    border: '1px solid var(--color-success-100)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'linear-gradient(to bottom right, #f0fdf4, #ffffff)',
                    boxShadow: 'var(--shadow-sm)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        <Badge variant="success" size="sm">
                          {session.className} - {session.sectionName}
                        </Badge>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--color-success-200)' }}></span>
                        <span className="text-caption" style={{ color: 'var(--color-success-700)', fontWeight: 600 }}>Completed</span>
                      </div>
                      <h4 className="text-h4" style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.4, color: 'var(--color-text-primary)' }}>{session.name}</h4>
                    </div>
                    <div style={{ 
                      width: '44px', 
                      height: '44px', 
                      borderRadius: '12px', 
                      background: 'var(--color-success-100)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'var(--color-success-700)',
                      flexShrink: 0
                    }}>
                      <CheckCircleIcon size={22} />
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-2)', 
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'rgba(34, 197, 94, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    color: 'var(--color-success-700)'
                  }}>
                    <CheckCircleIcon size={16} />
                    <span className="text-caption" style={{ fontWeight: 600 }}>Term Evaluation Marks Synced</span>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'auto' }}>
                    <Button 
                      variant="secondary" 
                      style={{ 
                        flex: 1, 
                        height: '40px',
                        background: 'white',
                        borderColor: 'var(--color-border)',
                        fontWeight: 600
                      }} 
                      icon={<EditIcon size={16} />} 
                      onClick={() => handleEnterMarks(session)}
                    >
                      Edit Marks
                    </Button>
                    <Button 
                      variant="secondary" 
                      style={{ 
                        flex: 1, 
                        height: '40px',
                        color: 'var(--color-error-600)', 
                        borderColor: 'var(--color-error-100)',
                        background: 'white',
                        fontWeight: 600
                      }} 
                      icon={<TrashIcon size={16} />} 
                      onClick={() => handleDeleteMarks(session)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
