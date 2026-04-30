'use client';

import React, { useState, useEffect } from 'react';
import { AttendanceService, TeachersService, ClassesService, StudentsService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { AttendanceStatus } from '@/types/enums';
import type { Attendance, Teacher, Class, Student } from '@/types/models';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Avatar } from '@/components/ui/SharedUI';
import { ClipboardCheckIcon, CalendarIcon } from '@/components/ui/Icons';

const COLORS = [
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#4338CA' },
  { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' },
  { bg: '#FDF2F8', border: '#FBCFE8', text: '#BE185D' },
  { bg: '#FFF7ED', border: '#FFEDD5', text: '#C2410C' },
  { bg: '#ECFDF5', border: '#A7F3D0', text: '#059669' },
  { bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' },
  { bg: '#F0F9FF', border: '#BAE6FD', text: '#0369A1' },
];

interface ClassSectionCard {
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  studentCount: number;
  colorIndex: number;
}

export default function TeacherAttendance() {
  const { user } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [existingRecord, setExistingRecord] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [markedSections, setMarkedSections] = useState<Record<string, Attendance>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        if (!user || !school?.academicYear) return;
        const [classesData, studentsData] = await Promise.all([
          ClassesService.getAll(school.academicYear),
          StudentsService.getAll(school.academicYear),
        ]);
        let teacherData = await TeachersService.getByUserId(user.uid || user.id, school.academicYear);
        if (!teacherData && user.email) {
          teacherData = await TeachersService.getByEmail(user.email, school.academicYear);
        }
        setTeacher(teacherData as unknown as Teacher | null);
        setClasses(classesData as unknown as Class[]);
        setStudents(studentsData as unknown as Student[]);

        // Fetch all attendance for today to show marked indicators
        const todayRecords = await AttendanceService.getByDate(selectedDate, school.academicYear);
        const marked: Record<string, Attendance> = {};
        todayRecords?.forEach((r: any) => {
          marked[`${r.classId}-${r.sectionId}`] = r;
        });
        setMarkedSections(marked);

      } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, selectedDate, school?.academicYear]);

  useEffect(() => {
    if (selectedClass && selectedSection) {
      fetchExistingAttendance();
    }
  }, [selectedClass, selectedSection, selectedDate]);

  const fetchExistingAttendance = async () => {
    if (!school?.academicYear) return;
    setLoadingAttendance(true);
    try {
      const record = await AttendanceService.getRecord(selectedClass, selectedSection, selectedDate, school.academicYear);
      if (record) {
        setExistingRecord(record as unknown as Attendance);
        const initialAttendance: Record<string, AttendanceStatus> = {};
        record.records?.forEach((r: any) => {
          initialAttendance[r.studentId] = r.status;
        });
        setAttendance(initialAttendance);
      } else {
        setExistingRecord(null);
        setAttendance({});
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const teacherClasses: ClassSectionCard[] = [];
  if (teacher) {
    teacher.assignedClasses?.forEach((ac, idx) => {
      const cls = classes.find(c => c.id === ac.classId);
      if (cls) {
        // Support both single sectionId and array of sectionIds
        const sids = (ac as any).sectionIds || (ac.sectionId ? [ac.sectionId] : []);
        sids.forEach((sid: any) => {
          const section = cls.sections.find(s => s.id === sid);
          if (section) {
            teacherClasses.push({
              classId: ac.classId,
              sectionId: sid,
              className: cls.name,
              sectionName: section.name,
              studentCount: students.filter(s => s.classId === ac.classId && s.sectionId === sid).length,
              colorIndex: idx % COLORS.length,
            });
          }
        });
      }
    });
  }

  const selectedClassData = classes.find(c => c.id === selectedClass);
  const filteredStudents = students.filter(s => s.classId === selectedClass && s.sectionId === selectedSection);

  const selectCard = (classId: string, sectionId: string) => {
    if (selectedClass === classId && selectedSection === sectionId) {
      setSelectedClass('');
      setSelectedSection('');
      setAttendance({});
      setExistingRecord(null);
    } else {
      setSelectedClass(classId);
      setSelectedSection(sectionId);
      setAttendance({});
      setExistingRecord(null);
    }
  };

  const toggleStatus = (studentId: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: prev[studentId] === AttendanceStatus.PRESENT ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT,
    }));
  };

  const markAllPresent = () => {
    const all: Record<string, AttendanceStatus> = {};
    filteredStudents.forEach(s => { all[s.id] = AttendanceStatus.PRESENT; });
    setAttendance(prev => ({ ...prev, ...all }));
  };

  const markAllAbsent = () => {
    const all: Record<string, AttendanceStatus> = {};
    filteredStudents.forEach(s => { all[s.id] = AttendanceStatus.ABSENT; });
    setAttendance(prev => ({ ...prev, ...all }));
  };

  const presentCount = filteredStudents.filter(s => (attendance[s.id] || AttendanceStatus.PRESENT) === AttendanceStatus.PRESENT).length;
  const absentCount = filteredStudents.length - presentCount;

  const handleSubmit = async () => {
    if (!selectedClass || !selectedSection) {
      showToast('Select a class and section first');
      return;
    }
    setSubmitting(true);
    try {
      const records = filteredStudents.map(s => ({
        studentId: s.id,
        studentName: s.name,
        status: attendance[s.id] || AttendanceStatus.PRESENT,
      }));

      const payload = {
        date: selectedDate.toISOString().split('T')[0],
        classId: selectedClass,
        sectionId: selectedSection,
        period: 1,
        subjectId: '',
        teacherId: teacher?.id || '',
        className: selectedClassData?.name || '',
        sectionName: selectedClassData?.sections.find(s => s.id === selectedSection)?.name || '',
        teacherName: teacher?.name || user?.name || '',
        records,
        academicYear: school.academicYear,
        submittedAt: new Date(),
      };

      if (existingRecord?.id) {
        await AttendanceService.update(existingRecord.id, payload);
        showToast('Attendance updated successfully!');
      } else {
        await AttendanceService.create(payload);
        showToast('Attendance submitted successfully!');
      }

      await fetchExistingAttendance();
      setMarkedSections(prev => ({
        ...prev,
        [`${selectedClass}-${selectedSection}`]: { ...payload, id: existingRecord?.id || 'new' } as unknown as Attendance,
      }));
    } catch (error) {
      console.error('Error submitting attendance:', error);
      showToast('Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const todayFormatted = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="text-h1">Take Attendance</h2>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>{todayFormatted}</p>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'var(--color-surface)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', cursor: 'pointer' }}>
          <CalendarIcon size={18} />
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            style={{ border: 'none', background: 'transparent', font: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--color-text-primary)', outline: 'none', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Class/Section Cards */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3 className="text-overline" style={{ marginBottom: 'var(--space-3)' }}>My Classes</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
          {teacherClasses.map((ac) => {
            const isSelected = selectedClass === ac.classId && selectedSection === ac.sectionId;
            const colors = COLORS[ac.colorIndex];
            const isMarked = !!markedSections[`${ac.classId}-${ac.sectionId}`];
            const markedData = markedSections[`${ac.classId}-${ac.sectionId}`];
            const markedPresent = markedData?.records.filter(r => r.status === AttendanceStatus.PRESENT).length || 0;
            const markedAbsent = (markedData?.records.length || 0) - markedPresent;

            return (
              <div
                key={`${ac.classId}-${ac.sectionId}`}
                onClick={() => selectCard(ac.classId, ac.sectionId)}
                style={{
                  background: colors.bg,
                  border: `2px solid ${isSelected ? 'var(--color-primary-500)' : colors.border}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4)',
                  cursor: 'pointer',
                  transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isSelected ? 'scale(1.02)' : 'none',
                  boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                  position: 'relative',
                }}
              >
                {isMarked && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
                )}
                <h4 style={{ font: 'var(--text-h3)', color: colors.text, marginBottom: 2 }}>{ac.className}</h4>
                <p style={{ font: 'var(--text-body-sm)', fontWeight: 600, color: colors.text, opacity: 0.8 }}>Section {ac.sectionName}</p>
                <p style={{ font: 'var(--text-caption)', color: colors.text, opacity: 0.6, marginTop: 8 }}>{ac.studentCount} Students</p>

                {isMarked && !isSelected && (
                  <div style={{
                    display: 'flex', gap: 'var(--space-2)', marginTop: 6,
                    fontSize: '0.68rem', fontWeight: 600,
                  }}>
                    <span style={{ color: '#059669' }}>● {markedPresent}P</span>
                    {markedAbsent > 0 && <span style={{ color: '#DC2626' }}>● {markedAbsent}A</span>}
                  </div>
                )}
              </div>
            );
          })}
          {teacherClasses.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 'var(--space-6)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)', textAlign: 'center' }}>
              <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
                {teacher ? 'No classes assigned to your profile.' : 'Teacher profile not found. Please contact admin to link your account.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* No class selected empty state */}
      {!selectedClass && (
        <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-full)', background: 'var(--color-primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
            <ClipboardCheckIcon size={28} />
          </div>
          <p className="text-body" style={{ fontWeight: 500 }}>Select a class</p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Tap a card above to start marking attendance</p>
        </div>
      )}

      {/* Loading state for attendance fetch */}
      {selectedClass && selectedSection && loadingAttendance && (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading attendance...</span>
        </div>
      )}

      {/* Student list */}
      {selectedClass && selectedSection && !loadingAttendance && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>

          {/* Already submitted banner */}
          {existingRecord && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              background: '#F0FDF4', borderBottom: '1px solid #BBF7D0',
              flexWrap: 'wrap',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 'var(--radius-full)',
                background: '#059669', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
              }}>✓</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <span className="text-body-sm" style={{ fontWeight: 600, color: '#065F46' }}>
                  Attendance already submitted
                </span>
                <span className="text-caption" style={{ color: '#059669', marginLeft: 8 }}>
                  by {existingRecord.teacherName}
                </span>
              </div>
              <span className="text-caption" style={{ color: '#059669', fontWeight: 600, flexShrink: 0 }}>
                You can edit and resubmit
              </span>
            </div>
          )}

          {/* Quick stats header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 'var(--space-4)', background: 'var(--color-surface-variant)',
            borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 'var(--space-3)',
          }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="text-h2" style={{ color: 'var(--color-text-primary)' }}>{filteredStudents.length}</div>
                <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Total</div>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--color-border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div className="text-h2" style={{ color: '#059669' }}>{presentCount}</div>
                <div className="text-caption" style={{ color: '#059669' }}>Present</div>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--color-border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div className="text-h2" style={{ color: '#DC2626' }}>{absentCount}</div>
                <div className="text-caption" style={{ color: '#DC2626' }}>Absent</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" placeholder="Filter student..." value={studentSearch} 
                  onChange={e => setStudentSearch(e.target.value)}
                  style={{ padding: '6px 12px', paddingLeft: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.8rem', outline: 'none' }}
                />
                <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <button onClick={markAllPresent} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid #059669', background: '#ECFDF5', color: '#059669',
                cursor: 'pointer', font: 'var(--text-caption)', fontWeight: 600,
              }}>All Present</button>
              <button onClick={markAllAbsent} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid #DC2626', background: '#FEF2F2', color: '#DC2626',
                cursor: 'pointer', font: 'var(--text-caption)', fontWeight: 600,
              }}>All Absent</button>
            </div>
          </div>

          {(() => {
            const displayStudents = studentSearch 
              ? filteredStudents.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()))
              : filteredStudents;

            return displayStudents.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>{studentSearch ? 'No students found matching your filter.' : 'No students in this class/section.'}</p>
              </div>
            ) : (
              <>
                {displayStudents.map((student, index) => {
                  const status = attendance[student.id] || AttendanceStatus.PRESENT;
                  const isPresent = status === AttendanceStatus.PRESENT;
                  return (
                    <div key={student.id} style={{
                      display: 'grid', gridTemplateColumns: '36px 1fr auto',
                      alignItems: 'center', gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: '1px solid var(--color-divider)',
                      background: !isPresent ? '#FEF2F2' : 'transparent',
                      transition: 'background 200ms',
                    }}>
                      <span style={{
                        font: 'var(--text-caption)', fontWeight: 600,
                        color: 'var(--color-text-tertiary)', textAlign: 'center',
                      }}>{index + 1}</span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <Avatar name={student.name} size={32} />
                        <span style={{ font: 'var(--text-body)', fontWeight: 500 }}>{student.name}</span>
                      </div>

                      <button
                        onClick={() => toggleStatus(student.id)}
                        style={{
                          display: 'flex', alignItems: 'center',
                          width: 110, height: 36,
                          borderRadius: 'var(--radius-full)',
                          border: 'none', cursor: 'pointer',
                          background: isPresent ? '#059669' : '#DC2626',
                          position: 'relative',
                          transition: 'background 200ms',
                          padding: 0,
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          left: isPresent ? 4 : 'auto',
                          right: isPresent ? 'auto' : 4,
                          width: 28, height: 28,
                          borderRadius: '50%',
                          background: 'white',
                          transition: 'all 200ms',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                        <span style={{
                          flex: 1, textAlign: 'center',
                          color: 'white', fontSize: '0.75rem',
                          fontWeight: 700, letterSpacing: '0.03em',
                          paddingLeft: isPresent ? 28 : 0,
                          paddingRight: isPresent ? 0 : 28,
                        }}>
                          {isPresent ? 'PRESENT' : 'ABSENT'}
                        </span>
                      </button>
                    </div>
                  );
                })}

                {/* Submit bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-4)',
                  background: 'var(--color-surface-variant)',
                  borderTop: '1px solid var(--color-border)',
                  flexWrap: 'wrap', gap: 'var(--space-3)',
                }}>
                  <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <strong>{presentCount}</strong> present, <strong>{absentCount}</strong> absent out of <strong>{filteredStudents.length}</strong> students
                  </p>
                  <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Saving...' : existingRecord ? 'Update Attendance' : 'Submit Attendance'}
                  </Button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
