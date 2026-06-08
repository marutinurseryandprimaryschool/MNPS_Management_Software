'use client';

import React, { useState, useEffect } from 'react';
import { 
  ReportCardService, 
  StudentsService, 
  TeachersService, 
  ClassesService 
} from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Select } from '@/components/ui/Input';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Tabs, Avatar, Badge } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';
import { 
  ArrowLeftIcon, 
  FileTextIcon, 
  PlusIcon, 
  CheckCircleIcon,
  PrinterIcon
} from '@/components/ui/Icons';
import type { 
  Student, 
  Class, 
  Teacher, 
  ReportCard, 
  Subject, 
  TermSummary,
  SubjectTermScore,
  CoScholasticRecord,
  AttendanceTermRecord
} from '@/types/models';
import { 
  ExamTerm, 
  EXAM_TERM_LABELS, 
  EXAM_TERMS_ORDER, 
  CoScholasticArea, 
  CO_SCHOLASTIC_LABELS 
} from '@/types/enums';
import { 
  buildTermSummary, 
  getGradeColor, 
  calcRanks 
} from '@/lib/report-card-utils';

export default function TeacherReportCard() {
  const { user } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState('view'); // 'view' or 'edit'
  const [selectedTerm, setSelectedTerm] = useState<ExamTerm>(ExamTerm.I_MID_TERM);
  
  const [reportCard, setReportCard] = useState<ReportCard | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State for Editing
  const [faScores, setFaScores] = useState<Record<string, number>>({});
  const [saScores, setSaScores] = useState<Record<string, number>>({});
  const [saMaxes, setSaMaxes] = useState<Record<string, number>>({});
  const [coGrades, setCoGrades] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState({ present: 0, total: 0 });
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user || !school?.academicYear) return;
        const [classesData, studentsData] = await Promise.all([
          ClassesService.getAll(school.academicYear),
          StudentsService.getAll(school.academicYear),
        ]);
        
        let teacherData = await TeachersService.getByUserId(user.uid || user.id, school.academicYear);
        if (!teacherData && user.email) teacherData = await TeachersService.getByEmail(user.email, school.academicYear);
        
        setTeacher(teacherData as unknown as Teacher | null);
        setClasses(classesData as unknown as Class[]);
        setStudents(studentsData as unknown as Student[]);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, school?.academicYear]);

  useEffect(() => {
    if (selectedStudent) {
      loadReportCard(selectedStudent.id);
    } else {
      setReportCard(null);
    }
  }, [selectedStudent]);

  const loadReportCard = async (studentId: string) => {
    try {
      const cards = await ReportCardService.getByStudent(studentId);
      if (cards && cards.length > 0) {
        // Filter by current academic year if needed
        setReportCard(cards[0] as unknown as ReportCard);
        prepareEditState(cards[0] as unknown as ReportCard, selectedTerm);
      } else {
        setReportCard(null);
        resetEditState();
      }
    } catch (error) {
      console.error('Error loading report card:', error);
    }
  };

  const prepareEditState = (card: ReportCard, term: ExamTerm) => {
    const termData = card.terms?.[term];
    const newFa: Record<string, number> = {};
    const newSa: Record<string, number> = {};
    const newSaMax: Record<string, number> = {};
    
    if (termData) {
      termData.subjectScores.forEach(score => {
        newFa[score.subjectId] = score.fa;
        newSa[score.subjectId] = score.sa;
        newSaMax[score.subjectId] = score.saMax;
      });
    }
    
    setFaScores(newFa);
    setSaScores(newSa);
    setSaMaxes(newSaMax);
    
    const newCo: Record<string, string> = {};
    card.coScholastic.forEach(record => {
      if (record.grades[term]) {
        newCo[record.area] = record.grades[term]!;
      }
    });
    setCoGrades(newCo);
    
    const att = card.attendance.find(a => a.term === term);
    setAttendance(att ? { present: att.daysPresent, total: att.totalWorkingDays } : { present: 0, total: 0 });
    setRemarks(card.remarks?.[term] || '');
  };

  const resetEditState = () => {
    setFaScores({});
    setSaScores({});
    setSaMaxes({});
    setCoGrades({});
    setAttendance({ present: 0, total: 0 });
    setRemarks('');
  };

  const handleTermChange = (term: ExamTerm) => {
    setSelectedTerm(term);
    if (reportCard) {
      prepareEditState(reportCard, term);
    }
  };

  const handleSave = async () => {
    if (!selectedStudent || !selectedClass) return;
    
    setIsSaving(true);
    try {
      const classData = classes.find(c => c.id === selectedClass);
      if (!classData) throw new Error('Class not found');
      
      const subjects = classData.subjects || [];
      const termSummary = buildTermSummary(
        selectedTerm,
        subjects,
        faScores,
        saScores,
        saMaxes,
        school.settings?.gradeScale
      );
      
      const updatedReportCard: Partial<ReportCard> = reportCard ? { ...reportCard } : {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        admissionNumber: selectedStudent.admissionNumber,
        classId: selectedClass,
        sectionId: selectedSection,
        academicYear: school.academicYear,
        terms: {},
        coScholastic: Object.values(CoScholasticArea).map(area => ({ area, grades: {} })),
        attendance: [],
        remarks: {},
        signatures: {},
        status: 'draft'
      };
      
      // Update Term Summary
      updatedReportCard.terms = {
        ...(updatedReportCard.terms || {}),
        [selectedTerm]: termSummary
      };
      
      // Update Co-Scholastic
      updatedReportCard.coScholastic = updatedReportCard.coScholastic?.map(record => {
        if (coGrades[record.area]) {
          return {
            ...record,
            grades: { ...record.grades, [selectedTerm]: coGrades[record.area] }
          };
        }
        return record;
      });
      
      // Update Attendance
      const otherAtt = updatedReportCard.attendance?.filter(a => a.term !== selectedTerm) || [];
      updatedReportCard.attendance = [
        ...otherAtt,
        { term: selectedTerm, daysPresent: attendance.present, totalWorkingDays: attendance.total }
      ];
      
      // Update Remarks
      updatedReportCard.remarks = {
        ...(updatedReportCard.remarks || {}),
        [selectedTerm]: remarks
      };

      if (reportCard?.id) {
        await ReportCardService.update(reportCard.id, updatedReportCard as any);
      } else {
        await ReportCardService.create(updatedReportCard as any);
      }
      
      showToast('Report card updated successfully!');
      loadReportCard(selectedStudent.id);
      setActiveTab('view');
    } catch (error) {
      console.error('Error saving report card:', error);
      showToast('Failed to save report card');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedClassData = classes.find(c => c.id === selectedClass);
  const classSubjects = selectedClassData?.subjects || [];
  const filteredStudents = students.filter(s => s.classId === selectedClass && s.sectionId === selectedSection);

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Academic Report Cards</h2>
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          Manage multi-term structured academic evaluation system.
        </p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
        background: 'var(--color-surface)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)'
      }}>
        <Select 
          label="Class" 
          value={selectedClass} 
          onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); setSelectedStudent(null); }}
          options={[{ value: '', label: 'Select Class' }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
        />
        {selectedClass && (
          <Select 
            label="Section" 
            value={selectedSection} 
            onChange={e => { setSelectedSection(e.target.value); setSelectedStudent(null); }}
            options={[{ value: '', label: 'Select Section' }, ...(selectedClassData?.sections.map(s => ({ value: s.id, label: s.name })) || [])]}
          />
        )}
        {selectedSection && (
          <Select 
            label="Student" 
            value={selectedStudent?.id || ''} 
            onChange={e => setSelectedStudent(filteredStudents.find(s => s.id === e.target.value) || null)}
            options={[{ value: '', label: 'Select Student' }, ...filteredStudents.map(s => ({ value: s.id, label: s.name }))]}
          />
        )}
      </div>

      {selectedStudent && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <Avatar name={selectedStudent.name} size={48} />
              <div>
                <h3 className="text-h3" style={{ margin: 0 }}>{selectedStudent.name}</h3>
                <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
                  Adm: {selectedStudent.admissionNumber} • {selectedClassData?.name} {selectedClassData?.sections.find(s => s.id === selectedSection)?.name}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button 
                variant={activeTab === 'view' ? 'primary' : 'secondary'} 
                onClick={() => setActiveTab('view')}
                icon={<FileTextIcon size={18} />}
              >
                View Full
              </Button>
              <Button 
                variant={activeTab === 'edit' ? 'primary' : 'secondary'} 
                onClick={() => setActiveTab('edit')}
                icon={<PlusIcon size={18} />}
              >
                Enter Marks
              </Button>
            </div>
          </div>

          <Tabs 
            tabs={EXAM_TERMS_ORDER.map(term => ({ id: term, label: EXAM_TERM_LABELS[term] }))}
            activeTab={selectedTerm}
            onChange={val => handleTermChange(val as ExamTerm)}
          />

          <div style={{ marginTop: 'var(--space-6)' }}>
            {activeTab === 'edit' ? (
              <div className="card" style={{ padding: 'var(--space-6)' }}>
                <h4 className="text-h4" style={{ marginBottom: 'var(--space-4)' }}>
                  Marks Entry - {EXAM_TERM_LABELS[selectedTerm]}
                </h4>
                
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>
                        <th style={{ padding: 'var(--space-3)' }}>Subject</th>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'center' }}>FA (40)</th>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'center' }}>SA Score</th>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'center' }}>SA Max</th>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'center' }}>Total (100)</th>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'center' }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classSubjects.map(sub => {
                        const fa = faScores[sub.id] || 0;
                        const sa = saScores[sub.id] || 0;
                        const saMax = saMaxes[sub.id] || 60;
                        const saNorm = Math.round((sa / saMax) * 60);
                        const total = fa + saNorm;
                        
                        return (
                          <tr key={sub.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                            <td style={{ padding: 'var(--space-3)', fontWeight: 500 }}>{sub.name}</td>
                            <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                              <Input 
                                type="number" 
                                value={fa} 
                                onChange={e => setFaScores(p => ({ ...p, [sub.id]: parseInt(e.target.value) || 0 }))}
                                style={{ width: 70, textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                              <Input 
                                type="number" 
                                value={sa} 
                                onChange={e => setSaScores(p => ({ ...p, [sub.id]: parseInt(e.target.value) || 0 }))}
                                style={{ width: 70, textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                              <Input 
                                type="number" 
                                value={saMax} 
                                onChange={e => setSaMaxes(p => ({ ...p, [sub.id]: parseInt(e.target.value) || 60 }))}
                                style={{ width: 70, textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: 'var(--space-3)', textAlign: 'center', fontWeight: 700 }}>
                              {total}
                            </td>
                            <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                              <Badge variant={total >= 33 ? 'success' : 'error'}>
                                {buildTermSummary(selectedTerm, [sub], { [sub.id]: fa }, { [sub.id]: sa }, { [sub.id]: saMax }, school.settings?.gradeScale).subjectScores[0].grade}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 'var(--space-6)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    <div>
                      <h5 className="text-h5" style={{ marginBottom: 'var(--space-3)' }}>Co-Scholastic Grades</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {Object.values(CoScholasticArea).map(area => (
                          <div key={area} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="text-body-sm">{CO_SCHOLASTIC_LABELS[area]}</span>
                            <Select 
                              value={coGrades[area] || ''}
                              onChange={e => setCoGrades(p => ({ ...p, [area]: e.target.value }))}
                              options={[
                                { value: '', label: '-' },
                                { value: 'A', label: 'A' },
                                { value: 'B', label: 'B' },
                                { value: 'C', label: 'C' },
                              ]}
                              style={{ width: 80 }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-h5" style={{ marginBottom: 'var(--space-3)' }}>Signatures / Approvals</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <Input 
                          label="Class Teacher Name/Digital Sign" 
                          value={reportCard?.signatures?.[selectedTerm]?.classTeacher || ''}
                          onChange={e => {
                            // This would ideally update a state but for now we can just show the concept
                            // or add a new state signatures
                          }}
                        />
                        <Input label="Principal Approval" value="Authorized" disabled />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-h5" style={{ marginBottom: 'var(--space-3)' }}>Attendance & Remarks</h5>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                      <Input
                        label="Present"
                        type="number"
                        step="0.5"
                        value={attendance.present}
                        onChange={e => setAttendance(p => ({ ...p, present: parseFloat(e.target.value) || 0 }))}
                      />
                      <Input
                        label="Working Days"
                        type="number"
                        value={attendance.total}
                        onChange={e => setAttendance(p => ({ ...p, total: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <Input 
                      label="Teacher Remarks" 
                      type="text"
                      value={remarks} 
                      onChange={e => setRemarks(e.target.value)} 
                    />
                  </div>
                </div>

                <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="primary" onClick={handleSave} loading={isSaving}>
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 className="text-h4" style={{ margin: 0 }}>Progress Report Table</h4>
                  <Button variant="secondary" size="sm" icon={<PrinterIcon size={16} />}>Print</Button>
                </div>
                
                <div style={{ overflowX: 'auto', padding: 'var(--space-4)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid var(--color-text-primary)' }}>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ border: '1px solid black', padding: '8px' }}>SUBJECT</th>
                        {EXAM_TERMS_ORDER.map(term => (
                          <th key={term} colSpan={4} style={{ border: '1px solid black', padding: '8px', fontSize: '10px' }}>
                            {EXAM_TERM_LABELS[term].toUpperCase()}
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {EXAM_TERMS_ORDER.map(term => (
                          <React.Fragment key={term}>
                            <th style={{ border: '1px solid black', padding: '4px', fontSize: '8px' }}>FA 40</th>
                            <th style={{ border: '1px solid black', padding: '4px', fontSize: '8px' }}>SA 60</th>
                            <th style={{ border: '1px solid black', padding: '4px', fontSize: '8px' }}>Total 100</th>
                            <th style={{ border: '1px solid black', padding: '4px', fontSize: '8px' }}>Grade</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classSubjects.map(sub => (
                        <tr key={sub.id}>
                          <td style={{ border: '1px solid black', padding: '8px', fontWeight: 600, fontSize: '11px' }}>{sub.name.toUpperCase()}</td>
                          {EXAM_TERMS_ORDER.map(term => {
                            const score = reportCard?.terms?.[term]?.subjectScores.find(s => s.subjectId === sub.id);
                            return (
                              <React.Fragment key={term}>
                                <td style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontSize: '11px' }}>{score?.fa || '-'}</td>
                                <td style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontSize: '11px' }}>{score?.saNormalized || '-'}</td>
                                <td style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontSize: '11px', fontWeight: 600 }}>{score?.total || '-'}</td>
                                <td style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontSize: '11px' }}>{score?.grade || '-'}</td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                      
                      {/* Summary Rows */}
                      <tr style={{ background: '#f9f9f9' }}>
                        <td style={{ border: '1px solid black', padding: '8px', fontWeight: 700, fontSize: '11px' }}>TOTAL</td>
                        {EXAM_TERMS_ORDER.map(term => (
                          <td key={term} colSpan={4} style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontWeight: 700, color: 'var(--color-error)' }}>
                            {reportCard?.terms?.[term]?.termTotal || '-'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid black', padding: '8px', fontWeight: 700, fontSize: '11px' }}>AVERAGE</td>
                        {EXAM_TERMS_ORDER.map(term => (
                          <td key={term} colSpan={4} style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontWeight: 700 }}>
                            {reportCard?.terms?.[term]?.average ? `${reportCard?.terms?.[term]?.average}%` : '-'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid black', padding: '8px', fontWeight: 700, fontSize: '11px' }}>GRADE</td>
                        {EXAM_TERMS_ORDER.map(term => (
                          <td key={term} colSpan={4} style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontWeight: 700, color: 'var(--color-warning)' }}>
                            {reportCard?.terms?.[term]?.grade || '-'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid black', padding: '8px', fontWeight: 700, fontSize: '11px' }}>ATTENDANCE</td>
                        {EXAM_TERMS_ORDER.map(term => {
                          const att = reportCard?.attendance.find(a => a.term === term);
                          return (
                            <td key={term} colSpan={4} style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontSize: '10px' }}>
                              {att ? `${att.daysPresent} / ${att.totalWorkingDays}` : '-'}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid black', padding: '8px', fontWeight: 700, fontSize: '11px' }}>REMARKS</td>
                        {EXAM_TERMS_ORDER.map(term => (
                          <td key={term} colSpan={4} style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontStyle: 'italic', fontSize: '10px' }}>
                            {reportCard?.remarks?.[term] || '-'}
                          </td>
                        ))}
                      </tr>
                      
                      {/* Co-Scholastic Rows */}
                      {Object.values(CoScholasticArea).map(area => (
                        <tr key={area}>
                          <td style={{ border: '1px solid black', padding: '8px', fontWeight: 700, fontSize: '11px' }}>{CO_SCHOLASTIC_LABELS[area].toUpperCase()}</td>
                          {EXAM_TERMS_ORDER.map(term => {
                            const rec = reportCard?.coScholastic.find(r => r.area === area);
                            return (
                              <td key={term} colSpan={4} style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontSize: '11px' }}>
                                {rec?.grades[term] || '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!selectedStudent && (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: '3rem', opacity: 0.2, marginBottom: 'var(--space-4)' }}>📊</div>
          <h3 className="text-h3">No Student Selected</h3>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Select a class, section, and student to view or manage their report card.
          </p>
        </div>
      )}
    </div>
  );
}
