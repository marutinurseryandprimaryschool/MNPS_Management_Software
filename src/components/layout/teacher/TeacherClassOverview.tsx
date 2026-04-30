'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  TeachersService, 
  StudentsService, 
  MarksService, 
  AttendanceService,
  ClassesService,
  AssessmentService
} from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Badge, Avatar, Tabs } from '@/components/ui/SharedUI';
import Button from '@/components/ui/Button';
import { 
  BarChartIcon, UsersIcon, ClipboardCheckIcon, 
  FileTextIcon, TrendingUpIcon, AlertTriangleIcon,
  SearchIcon, FilterIcon, CalendarIcon, ChevronRightIcon,
  EditIcon, ArrowLeftIcon, PlusIcon
} from '@/components/ui/Icons';
import Modal from '@/components/ui/Modal';
import Input, { Textarea, Select as UISelect } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import type { Student } from '@/types/models';
import { ExamTerm } from '@/types/enums';

interface TeacherClassOverviewProps {
  view?: 'dashboard' | 'students' | 'attendance' | 'performance';
}

// Define Term Groups
const TERM_GROUPS = {
  'Term 1': [ExamTerm.I_MID_TERM, ExamTerm.QUARTERLY, 'first mid-term', 'mid-term'],
  'Term 2': [ExamTerm.II_MID_TERM, ExamTerm.HALF_YEARLY, 'second mid-term', 'half early'],
  'Term 3': [ExamTerm.III_MID_TERM, ExamTerm.ANNUAL, 'annual'],
};

const EMPTY_FORM: Record<string, string> = {
  emisId: '', name: '', nameTamil: '', dob: '', gender: 'male', bloodGroup: '',
  classId: '', sectionId: '', address: '', pinCode: '',
  fatherName: '', fatherOccupation: '', fatherEducation: '',
  motherName: '', motherOccupation: '', motherEducation: '',
  guardianName: '', guardianOccupation: '',
  aadhaarNumber: '', phone: '', phoneVerifyStatus: '', email: '',
  dateOfJoining: '', admissionNumber: '', religion: '', mediumOfInstruction: '',
  community: '', disabilityGroupName: '', groupCode: '', motherTongue: '',
};

const toDateStr = (val: any): string => {
  if (!val) return '';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch { return ''; }
};

export default function TeacherClassOverview({ view = 'dashboard' }: TeacherClassOverviewProps) {
  const { user } = useAuth();
  const { school } = useSchool();
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [classInfo, setClassInfo] = useState<any>(null);
  const [assignedClasses, setAssignedClasses] = useState<any[]>([]);
  const [selectedAssignmentIdx, setSelectedAssignmentIdx] = useState(0);
  const [search, setSearch] = useState('');
  
  // Performance specific state
  const [marks, setMarks] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [activeParentTerm, setActiveParentTerm] = useState<string>('Term 1');
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const { showToast } = useToast();

  // Profile/Edit state
  const [viewingStudent, setViewingStudent] = useState<any | null>(null);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formSection, setFormSection] = useState('basic');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        if (!school?.academicYear) return;
        let teacherData = await TeachersService.getByUserId(user.uid || user.id, school.academicYear);
        if (!teacherData && user.email) teacherData = await TeachersService.getByEmail(user.email, school.academicYear);
        
        setTeacher(teacherData);

        if (teacherData) {
          const assignments = (teacherData as any).assignedClasses || [];
          setAssignedClasses(assignments);
          
          if (assignments.length > 0) {
            // Prefer class teacher assignment if it exists and we haven't selected one yet
            let idx = selectedAssignmentIdx;
            if (idx === 0 && assignments.some((a: any) => a.isClassTeacher)) {
              idx = assignments.findIndex((a: any) => a.isClassTeacher);
              setSelectedAssignmentIdx(idx);
            }
            
            const selected = assignments[idx];
            setClassInfo(selected);
            
            // Load class info
            const [studentsData, marksData, attendData, assessData, allCls] = await Promise.all([
              StudentsService.getByClassSection(selected.classId, selected.sectionId, school.academicYear),
              MarksService.getAll(school.academicYear),
              AttendanceService.getAll(school.academicYear),
              AssessmentService.getByClassSection(selected.classId, selected.sectionId, school.academicYear),
              ClassesService.getAll(school.academicYear)
            ]);

            setAllClasses(allCls);
            setStudents(studentsData);

            const classMarks = marksData.filter((m: any) => m.classId === selected.classId && m.sectionId === selected.sectionId);
            setMarks(classMarks);
            setAssessments(assessData);

            // Calculate Stats
            const classAttendance = attendData.filter((a: any) => a.classId === selected.classId && a.sectionId === selected.sectionId);

            // 1. Attendance %
            let totalPossible = 0;
            let totalPresent = 0;
            classAttendance.forEach((a: any) => {
              a.records.forEach((r: any) => {
                totalPossible++;
                if (r.status === 'present') totalPresent++;
              });
            });
            const attendancePct = totalPossible > 0 ? (totalPresent / totalPossible) * 100 : 0;

            setStats({
              attendancePct: attendancePct.toFixed(1),
              totalStudents: studentsData.length,
              totalAttendanceLogs: classAttendance.length
            });
          }
        }
      } catch (err) {
        console.error('Error loading class overview:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user, selectedAssignmentIdx, school?.academicYear]);

  const setField = (key: string, val: string) => setFormData(p => ({ ...p, [key]: val }));

  const openEdit = (s: any) => {
    setEditingStudent(s);
    setFormData({
      emisId: s.emisId || '', name: s.name, nameTamil: s.nameTamil || '',
      dob: toDateStr(s.dob),
      gender: s.gender || 'male', bloodGroup: s.bloodGroup || '',
      classId: s.classId || '', sectionId: s.sectionId || '',
      address: s.address || '', pinCode: s.pinCode || '',
      fatherName: s.fatherName || '', fatherOccupation: s.fatherOccupation || '', fatherEducation: s.fatherEducation || '',
      motherName: s.motherName || '', motherOccupation: s.motherOccupation || '', motherEducation: s.motherEducation || '',
      guardianName: s.guardianName || '', guardianOccupation: s.guardianOccupation || '',
      aadhaarNumber: s.aadhaarNumber || '', phone: s.phone || '', phoneVerifyStatus: s.phoneVerifyStatus || '',
      email: s.email || '',
      dateOfJoining: toDateStr(s.dateOfJoining),
      admissionNumber: s.admissionNumber || '',
      religion: s.religion || '', mediumOfInstruction: s.mediumOfInstruction || '',
      community: s.community || '', disabilityGroupName: s.disabilityGroupName || '',
      groupCode: s.groupCode || '', motherTongue: s.motherTongue || '',
    });
    setFormSection('basic');
    setShowEditModal(true);
  };

  const handleSaveStudent = async () => {
    if (!formData.name) { showToast('Student name is required'); return; }
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...formData,
        academicYear: school?.academicYear,
        dob: formData.dob ? new Date(formData.dob) : null,
        dateOfJoining: formData.dateOfJoining ? new Date(formData.dateOfJoining) : null,
      };
      
      if (editingStudent) {
        await StudentsService.update(editingStudent.id, payload);
        showToast('Student details updated successfully!');
        
        // Update local state
        setStudents(prev => prev.map(s => s.id === editingStudent.id ? { ...s, ...payload } : s));
        if (viewingStudent?.id === editingStudent.id) {
          setViewingStudent({ ...viewingStudent, ...payload });
        }
      }
      setShowEditModal(false);
    } catch (error) {
      console.error('Error saving student:', error);
      showToast('Failed to update student details');
    } finally {
      setIsSaving(false);
    }
  };

  // Derive subjects for the class
  const classSubjects = useMemo(() => {
    if (!classInfo || !allClasses) return [];
    const cls = allClasses.find(c => c.id === classInfo.classId);
    return cls?.subjects || [];
  }, [classInfo, allClasses]);

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  if (!assignedClasses || assignedClasses.length === 0) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ background: 'var(--color-surface-variant)', padding: 'var(--space-8)', borderRadius: 'var(--radius-xl)', maxWidth: 500 }}>
          <AlertTriangleIcon size={48} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-4)' }} />
          <h2 className="text-h2">No Classes Assigned</h2>
          <p className="text-body" style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            You haven't been assigned to any class or subject. 
            Please contact the administrator to get your assignments.
          </p>
        </div>
      </div>
    );
  }

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const renderDashboard = () => (
    <>
      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: 'var(--color-primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-600)' }}>
            <UsersIcon size={24} />
          </div>
          <div>
            <span className="text-overline" style={{ color: 'var(--color-text-tertiary)' }}>Students</span>
            <h3 className="text-h2" style={{ margin: 0 }}>{stats?.totalStudents || 0}</h3>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: 'var(--color-success-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success-600)' }}>
            <ClipboardCheckIcon size={24} />
          </div>
          <div>
            <span className="text-overline" style={{ color: 'var(--color-text-tertiary)' }}>Working Days</span>
            <h3 className="text-h2" style={{ margin: 0 }}>{stats?.totalAttendanceLogs || 0}</h3>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h4 className="text-h4" style={{ marginBottom: 'var(--space-4)' }}>Recent Activity</h4>
          <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>Class management activities will appear here.</p>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h4 className="text-h4" style={{ marginBottom: 'var(--space-4)' }}>Quick Summary</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-body-sm">Attendance Logs</span>
              <Badge variant="info">{stats?.totalAttendanceLogs}</Badge>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderStudents = () => (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <h4 className="text-h4" style={{ margin: 0 }}>Class Roster</h4>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flex: 1, justifyContent: 'flex-end', minWidth: 200 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <SearchIcon size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
            <input 
              type="text" 
              placeholder="Search students..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 38px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', font: 'var(--text-body-sm)' }}
            />
          </div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '12px var(--space-4)', textAlign: 'left' }} className="text-overline">Student Name</th>
              <th style={{ padding: '12px var(--space-4)', textAlign: 'center' }} className="text-overline">Admission #</th>
              <th style={{ padding: '12px var(--space-4)', textAlign: 'center' }} className="text-overline">Mobile</th>
              <th style={{ padding: '12px var(--space-4)', textAlign: 'center' }} className="text-overline">Status</th>
              <th style={{ padding: '12px var(--space-4)', textAlign: 'right' }} className="text-overline">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <Avatar name={s.name} size={36} />
                    <span className="text-body-sm" style={{ fontWeight: 600 }}>{s.name}</span>
                  </div>
                </td>
                <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                  <span className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.admissionNumber}</span>
                </td>
                <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                  <span className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.phone || s.parentPhone || 'N/A'}</span>
                </td>
                <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                  <Badge variant={s.status === 'active' ? 'success' : 'default'} size="sm">{s.status}</Badge>
                </td>
                <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                  <button 
                    onClick={() => setViewingStudent(s)}
                    className="text-button" 
                    style={{ color: 'var(--color-primary-600)', fontSize: '12px', fontWeight: 600 }}
                  >
                    View Profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAttendance = () => (
    <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
      <CalendarIcon size={48} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-4)' }} />
      <h3 className="text-h3">Class Attendance Logs</h3>
      <p className="text-body" style={{ color: 'var(--color-text-secondary)' }}>Detailed monthly attendance logs for Class {classInfo.className} will be displayed here.</p>
    </div>
  );

  const renderPerformance = () => {
    // Standard exam list for tabs
    const examTabs = [
      { id: ExamTerm.I_MID_TERM, label: 'I Mid Term' },
      { id: ExamTerm.QUARTERLY, label: 'Quarterly' },
      { id: ExamTerm.II_MID_TERM, label: 'II Mid Term' },
      { id: ExamTerm.HALF_YEARLY, label: 'Half Yearly' },
      { id: ExamTerm.III_MID_TERM, label: 'III Mid Term' },
      { id: ExamTerm.ANNUAL, label: 'Annual' },
    ];

    // Get marks for the selected exam only
    const termMarks = marks.filter(m => {
      const eId = (m.examId || '').toLowerCase().replace(/_/g, ' ');
      const eName = (m.examName || '').toLowerCase().replace(/_/g, ' ');
      const target = activeParentTerm.toLowerCase().replace(/_/g, ' ');
      return eId === target || eName === target || eId.includes(target) || eName.includes(target);
    });
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <Tabs 
          tabs={examTabs}
          activeTab={activeParentTerm}
          onChange={(id) => setActiveParentTerm(id)}
        />

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="text-h3" style={{ margin: 0 }}>
              {examTabs.find(t => t.id === activeParentTerm)?.label || 'Exam'} Consolidation
            </h3>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Badge variant="warning">Read Only Mode</Badge>
            </div>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px var(--space-4)', textAlign: 'left', minWidth: 200 }} className="text-overline">Student</th>
                  {classSubjects.map((sub: any) => (
                    <th key={sub.id} style={{ padding: '12px var(--space-4)', textAlign: 'center' }} className="text-overline">{sub.name}</th>
                  ))}
                  <th style={{ padding: '12px var(--space-4)', textAlign: 'center', background: 'var(--color-primary-50)' }} className="text-overline">Total %</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  let studentTotal = 0;
                  let maxTotal = 0;
                  
                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span className="text-body-sm" style={{ fontWeight: 600 }}>{student.name}</span>
                        </div>
                      </td>
                      {classSubjects.map((sub: any) => {
                        // For a term, there might be multiple exams (Midterm + Quarterly)
                        // We aggregate them or show the most recent one? 
                        // Let's aggregate for the term view.
                        const subjectMarksInTerm = termMarks.filter(m => m.subjectId === sub.id);
                        
                        let subTotal = 0;
                        let subMax = 0;
                        let hasData = false;

                        subjectMarksInTerm.forEach(markRecord => {
                          const studentMark = markRecord?.records?.find((r: any) => r.studentId === student.id);
                          if (studentMark) {
                            // In this system, totalMarks = faTotal + saScore
                            const score = Number(studentMark.totalMarks || 0);
                            subTotal += score;
                            // Each major exam is out of 100 (FA + SA)
                            subMax += 100; 
                            hasData = true;
                          }
                        });
                        
                        studentTotal += subTotal;
                        maxTotal += subMax;

                        return (
                          <td key={sub.id} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                            {hasData ? (
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="text-body-sm" style={{ fontWeight: 700 }}>{subTotal}</span>
                                <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontSize: '10px' }}>/ {subMax}</span>
                              </div>
                            ) : (
                              <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center', background: 'var(--color-primary-50)' }}>
                        <span className="text-body-sm" style={{ fontWeight: 800, color: 'var(--color-primary-700)' }}>
                          {maxTotal > 0 ? ((studentTotal / maxTotal) * 100).toFixed(1) + '%' : 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Formative Assessments Section */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
            <h4 className="text-h4" style={{ margin: 0 }}>Formative Assessments (Weekly)</h4>
          </div>
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
             <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Detailed formative assessment tracking for all {classSubjects.length} subjects.
             </p>
             <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
                {classSubjects.map((s: any) => {
                   const subjectAssessments = assessments.filter(a => a.subjectId === s.id);
                   return (
                      <div key={s.id} style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', minWidth: 120 }}>
                         <span className="text-caption" style={{ fontWeight: 600, display: 'block' }}>{s.name}</span>
                         <div style={{ marginTop: 4 }}>
                            <Badge variant="info">{subjectAssessments.length} Tests</Badge>
                         </div>
                      </div>
                   );
                })}
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
            {classInfo?.isClassTeacher ? (
              <Badge variant="primary">Class Teacher</Badge>
            ) : (
              <Badge variant="info">Subject Teacher</Badge>
            )}
            
            {assignedClasses.length > 1 ? (
              <select 
                value={selectedAssignmentIdx}
                onChange={(e) => setSelectedAssignmentIdx(parseInt(e.target.value))}
                style={{
                  padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                  background: 'white', font: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer'
                }}
              >
                {assignedClasses.map((ac, idx) => (
                  <option key={idx} value={idx}>
                    {ac.className} - {ac.sectionName} {ac.subjectName ? `(${ac.subjectName})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ font: 'var(--text-caption)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {classInfo?.className} — {classInfo?.sectionName}
              </span>
            )}
          </div>
          <h2 className="text-h1">
            {view === 'dashboard' && 'Class Overview'}
            {view === 'students' && 'My Students'}
            {view === 'attendance' && 'Class Attendance'}
            {view === 'performance' && 'Class Performance'}
          </h2>
        </div>
      </div>

      {view === 'dashboard' && renderDashboard()}
      {view === 'students' && renderStudents()}
      {view === 'attendance' && renderAttendance()}
      {view === 'performance' && renderPerformance()}

      {/* ===== STUDENT DETAIL MODAL ===== */}
      {viewingStudent && (
        <Modal isOpen={!!viewingStudent} onClose={() => setViewingStudent(null)} title="Student Details" size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-lg)' }}>
              <Avatar name={viewingStudent.name} size={64} />
              <div style={{ flex: 1 }}>
                <h3 style={{ font: 'var(--text-heading-2)', margin: 0 }}>{viewingStudent.name}</h3>
                {viewingStudent.nameTamil && <p className="text-body-sm" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{viewingStudent.nameTamil}</p>}
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <Badge variant={viewingStudent.status === 'active' ? 'success' : 'default'}>{viewingStudent.status}</Badge>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="secondary" onClick={() => { setViewingStudent(null); openEdit(viewingStudent); }} icon={<EditIcon size={16} />}>Edit Details</Button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
              <div>
                <p className="text-overline" style={{ color: 'var(--color-primary-500)', marginBottom: 'var(--space-2)' }}>Personal Information</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-divider)', paddingBottom: 4 }}>
                    <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Admission #</span>
                    <span className="text-body-sm" style={{ fontWeight: 600 }}>{viewingStudent.admissionNumber || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-divider)', paddingBottom: 4 }}>
                    <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>EMIS ID</span>
                    <span className="text-body-sm" style={{ fontWeight: 600 }}>{viewingStudent.emisId || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-divider)', paddingBottom: 4 }}>
                    <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Date of Birth</span>
                    <span className="text-body-sm" style={{ fontWeight: 600 }}>{toDateStr(viewingStudent.dob)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-divider)', paddingBottom: 4 }}>
                    <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Gender</span>
                    <span className="text-body-sm" style={{ fontWeight: 600, textTransform: 'capitalize' }}>{viewingStudent.gender || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-divider)', paddingBottom: 4 }}>
                    <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Blood Group</span>
                    <span className="text-body-sm" style={{ fontWeight: 600 }}>{viewingStudent.bloodGroup || '—'}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-overline" style={{ color: 'var(--color-primary-500)', marginBottom: 'var(--space-2)' }}>Contact Details</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-divider)', paddingBottom: 4 }}>
                    <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Mobile</span>
                    <span className="text-body-sm" style={{ fontWeight: 600 }}>{viewingStudent.phone || viewingStudent.parentPhone || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-divider)', paddingBottom: 4 }}>
                    <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Email</span>
                    <span className="text-body-sm" style={{ fontWeight: 600 }}>{viewingStudent.email || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Address</span>
                    <span className="text-body-sm" style={{ fontWeight: 500 }}>{viewingStudent.address || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-overline" style={{ color: 'var(--color-primary-500)', marginBottom: 'var(--space-2)' }}>Family Information</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontWeight: 600 }}>Father</span>
                  <div className="text-body-sm">
                    <span style={{ fontWeight: 600 }}>{viewingStudent.fatherName || '—'}</span>
                    <span style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: 12 }}>{viewingStudent.fatherOccupation}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontWeight: 600 }}>Mother</span>
                  <div className="text-body-sm">
                    <span style={{ fontWeight: 600 }}>{viewingStudent.motherName || '—'}</span>
                    <span style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: 12 }}>{viewingStudent.motherOccupation}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ===== EDIT STUDENT MODAL ===== */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Student Details" size="lg">
        <Tabs tabs={[
          { id: 'basic', label: 'Basic Info' },
          { id: 'parents', label: 'Parents / Guardian' },
          { id: 'academic', label: 'Academic' },
          { id: 'contact', label: 'Contact & Identity' },
        ]} activeTab={formSection} onChange={setFormSection} />
        
        <div style={{ marginTop: 'var(--space-4)', maxHeight: '60vh', overflowY: 'auto', paddingRight: 'var(--space-2)' }}>
          {formSection === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Student Name *" required value={formData.name} onChange={e => setField('name', e.target.value)} />
                <Input label="Name in Tamil" value={formData.nameTamil} onChange={e => setField('nameTamil', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Date of Birth" type="date" value={formData.dob} onChange={e => setField('dob', e.target.value)} />
                <UISelect label="Gender" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} value={formData.gender} onChange={(e: any) => setField('gender', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Blood Group" value={formData.bloodGroup} onChange={e => setField('bloodGroup', e.target.value)} placeholder="e.g. O+" />
                <Input label="Date of Joining" type="date" value={formData.dateOfJoining} onChange={e => setField('dateOfJoining', e.target.value)} />
              </div>
              <Textarea label="Address" value={formData.address} onChange={e => setField('address', e.target.value)} rows={2} />
              <Input label="Pin Code" value={formData.pinCode} onChange={e => setField('pinCode', e.target.value)} />
            </div>
          )}

          {formSection === 'parents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <p className="text-overline">Father Details</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Father Name" value={formData.fatherName} onChange={e => setField('fatherName', e.target.value)} />
                <Input label="Occupation" value={formData.fatherOccupation} onChange={e => setField('fatherOccupation', e.target.value)} />
                <Input label="Education" value={formData.fatherEducation} onChange={e => setField('fatherEducation', e.target.value)} />
              </div>
              <p className="text-overline">Mother Details</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Mother Name" value={formData.motherName} onChange={e => setField('motherName', e.target.value)} />
                <Input label="Occupation" value={formData.motherOccupation} onChange={e => setField('motherOccupation', e.target.value)} />
                <Input label="Education" value={formData.motherEducation} onChange={e => setField('motherEducation', e.target.value)} />
              </div>
            </div>
          )}

          {formSection === 'academic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="EMIS ID" value={formData.emisId} onChange={e => setField('emisId', e.target.value)} />
                <Input label="Admission Number" value={formData.admissionNumber} onChange={e => setField('admissionNumber', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Religion" value={formData.religion} onChange={e => setField('religion', e.target.value)} />
                <Input label="Community" value={formData.community} onChange={e => setField('community', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Medium of Instruction" value={formData.mediumOfInstruction} onChange={e => setField('mediumOfInstruction', e.target.value)} />
                <Input label="Mother Tongue" value={formData.motherTongue} onChange={e => setField('motherTongue', e.target.value)} />
              </div>
            </div>
          )}

          {formSection === 'contact' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Phone Number" value={formData.phone} onChange={e => setField('phone', e.target.value)} />
                <Input label="Email" type="email" value={formData.email} onChange={e => setField('email', e.target.value)} />
              </div>
              <Input label="Aadhaar Number" value={formData.aadhaarNumber} onChange={e => setField('aadhaarNumber', e.target.value)} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveStudent} loading={isSaving}>Update Student</Button>
        </div>
      </Modal>
    </div>
  );
}
