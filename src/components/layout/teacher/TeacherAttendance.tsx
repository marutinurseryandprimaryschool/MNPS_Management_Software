'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing untyped Firestore data handling in this legacy screen; typed migration tracked separately. */

import React, { useState, useEffect } from 'react';
import { AttendanceService, TeachersService, ClassesService, StudentsService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { AttendanceStatus, AttendanceSession } from '@/types/enums';
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
  // Each student tracks both sessions in one screen — teacher sees AM + PM
  // side-by-side on every row and submits the whole day in one go.
  type DualStatus = { am: AttendanceStatus; pm: AttendanceStatus };
  const [attendance, setAttendance] = useState<Record<string, DualStatus>>({});
  const [existingMorningRecord, setExistingMorningRecord] = useState<Attendance | null>(null);
  const [existingAfternoonRecord, setExistingAfternoonRecord] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  // Track both AM and PM marked status per section for the card indicators.
  const [markedSections, setMarkedSections] = useState<Record<string, { am?: Attendance; pm?: Attendance }>>({});
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

        // Fetch all attendance for today to show marked indicators (AM + PM).
        const todayRecords = await AttendanceService.getByDate(selectedDate, school.academicYear);
        const marked: Record<string, { am?: Attendance; pm?: Attendance }> = {};
        todayRecords?.forEach((r: any) => {
          const key = `${r.classId}-${r.sectionId}`;
          const session = (r.session as AttendanceSession) || AttendanceSession.MORNING;
          const entry = marked[key] || {};
          if (session === AttendanceSession.AFTERNOON) entry.pm = r;
          else entry.am = r;
          marked[key] = entry;
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
      const [amRecord, pmRecord] = await Promise.all([
        AttendanceService.getRecord(selectedClass, selectedSection, selectedDate, AttendanceSession.MORNING, school.academicYear),
        AttendanceService.getRecord(selectedClass, selectedSection, selectedDate, AttendanceSession.AFTERNOON, school.academicYear),
      ]);

      setExistingMorningRecord(amRecord as unknown as Attendance | null);
      setExistingAfternoonRecord(pmRecord as unknown as Attendance | null);

      // Seed per-student dual state from whatever's saved; missing halves default to PRESENT.
      const seeded: Record<string, DualStatus> = {};
      (amRecord as any)?.records?.forEach((r: any) => {
        seeded[r.studentId] = { am: r.status, pm: AttendanceStatus.PRESENT };
      });
      (pmRecord as any)?.records?.forEach((r: any) => {
        seeded[r.studentId] = { ...(seeded[r.studentId] || { am: AttendanceStatus.PRESENT, pm: AttendanceStatus.PRESENT }), pm: r.status };
      });
      setAttendance(seeded);
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
      setExistingMorningRecord(null);
      setExistingAfternoonRecord(null);
    } else {
      setSelectedClass(classId);
      setSelectedSection(sectionId);
      setAttendance({});
      setExistingMorningRecord(null);
      setExistingAfternoonRecord(null);
    }
  };

  const defaultDual = (): DualStatus => ({ am: AttendanceStatus.PRESENT, pm: AttendanceStatus.PRESENT });

  const toggleStatus = (studentId: string, session: AttendanceSession) => {
    setAttendance(prev => {
      const current = prev[studentId] || defaultDual();
      const key = session === AttendanceSession.AFTERNOON ? 'pm' : 'am';
      const flipped = current[key] === AttendanceStatus.PRESENT ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT;
      return { ...prev, [studentId]: { ...current, [key]: flipped } };
    });
  };

  const setAllStatus = (status: AttendanceStatus) => {
    setAttendance(prev => {
      const next: Record<string, DualStatus> = { ...prev };
      filteredStudents.forEach(s => { next[s.id] = { am: status, pm: status }; });
      return next;
    });
  };

  const copyMorningToAfternoon = () => {
    setAttendance(prev => {
      const next: Record<string, DualStatus> = { ...prev };
      filteredStudents.forEach(s => {
        const cur = next[s.id] || defaultDual();
        next[s.id] = { am: cur.am, pm: cur.am };
      });
      return next;
    });
  };

  const dualFor = (studentId: string): DualStatus => attendance[studentId] || defaultDual();
  const amPresent = filteredStudents.filter(s => dualFor(s.id).am === AttendanceStatus.PRESENT).length;
  const pmPresent = filteredStudents.filter(s => dualFor(s.id).pm === AttendanceStatus.PRESENT).length;
  const amAbsent = filteredStudents.length - amPresent;
  const pmAbsent = filteredStudents.length - pmPresent;

  const handleSubmit = async () => {
    if (!selectedClass || !selectedSection) {
      showToast('Select a class and section first');
      return;
    }
    setSubmitting(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const baseMeta = {
        date: dateStr,
        classId: selectedClass,
        sectionId: selectedSection,
        subjectId: '',
        teacherId: teacher?.id || '',
        className: selectedClassData?.name || '',
        sectionName: selectedClassData?.sections.find(s => s.id === selectedSection)?.name || '',
        teacherName: teacher?.name || user?.name || '',
        academicYear: school.academicYear,
      };

      const buildRecords = (session: AttendanceSession) =>
        filteredStudents.map(s => ({
          studentId: s.id,
          studentName: s.name,
          status: dualFor(s.id)[session === AttendanceSession.AFTERNOON ? 'pm' : 'am'],
        }));

      const writeSession = async (session: AttendanceSession, existing: Attendance | null) => {
        const payload = {
          ...baseMeta,
          session,
          records: buildRecords(session),
          submittedAt: new Date(),
        };
        if (existing?.id) {
          await AttendanceService.update(existing.id, payload);
        } else {
          await AttendanceService.create(payload);
        }
        return payload;
      };

      const [amPayload, pmPayload] = await Promise.all([
        writeSession(AttendanceSession.MORNING, existingMorningRecord),
        writeSession(AttendanceSession.AFTERNOON, existingAfternoonRecord),
      ]);

      showToast('Attendance saved for morning and afternoon!');

      await fetchExistingAttendance();
      const key = `${selectedClass}-${selectedSection}`;
      setMarkedSections(prev => ({
        ...prev,
        [key]: {
          am: { ...amPayload, id: existingMorningRecord?.id || 'new' } as unknown as Attendance,
          pm: { ...pmPayload, id: existingAfternoonRecord?.id || 'new' } as unknown as Attendance,
        },
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
            const markedData = markedSections[`${ac.classId}-${ac.sectionId}`];
            const amMarked = !!markedData?.am;
            const pmMarked = !!markedData?.pm;
            const isMarked = amMarked || pmMarked;
            const activeRecord = amMarked && pmMarked ? markedData!.pm! : (markedData?.am || markedData?.pm);
            const markedPresent = activeRecord?.records.filter(r => r.status === AttendanceStatus.PRESENT).length || 0;
            const markedAbsent = (activeRecord?.records.length || 0) - markedPresent;

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
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, fontSize: '0.62rem', fontWeight: 700 }}>
                  <span title="Morning" style={{
                    padding: '1px 6px', borderRadius: 'var(--radius-full)',
                    background: amMarked ? '#059669' : 'rgba(0,0,0,0.08)',
                    color: amMarked ? '#fff' : 'rgba(0,0,0,0.4)',
                  }}>AM{amMarked ? ' ✓' : ''}</span>
                  <span title="Afternoon" style={{
                    padding: '1px 6px', borderRadius: 'var(--radius-full)',
                    background: pmMarked ? '#059669' : 'rgba(0,0,0,0.08)',
                    color: pmMarked ? '#fff' : 'rgba(0,0,0,0.4)',
                  }}>PM{pmMarked ? ' ✓' : ''}</span>
                </div>
                <h4 style={{ font: 'var(--text-h3)', color: colors.text, marginBottom: 2, marginTop: 20 }}>{ac.className}</h4>
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

          {/* Already submitted banner — describe which sessions already exist */}
          {(existingMorningRecord || existingAfternoonRecord) && (() => {
            const parts: string[] = [];
            if (existingMorningRecord) parts.push(`Morning by ${existingMorningRecord.teacherName}`);
            if (existingAfternoonRecord) parts.push(`Afternoon by ${existingAfternoonRecord.teacherName}`);
            return (
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
                    Already submitted: {parts.join(' · ')}
                  </span>
                </div>
                <span className="text-caption" style={{ color: '#059669', fontWeight: 600, flexShrink: 0 }}>
                  You can edit and resubmit
                </span>
              </div>
            );
          })()}

          {/* Quick stats header — separate morning and afternoon totals */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 'var(--space-4)', background: 'var(--color-surface-variant)',
            borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 'var(--space-3)',
          }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="text-h2" style={{ color: 'var(--color-text-primary)' }}>{filteredStudents.length}</div>
                <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Total</div>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--color-border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span className="text-caption" style={{ fontWeight: 700, color: '#B45309', letterSpacing: '0.04em' }}>☀️ MORNING</span>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <span style={{ color: '#059669', fontWeight: 700 }}>{amPresent}<span className="text-caption" style={{ marginLeft: 2, opacity: 0.8 }}>P</span></span>
                  <span style={{ color: '#DC2626', fontWeight: 700 }}>{amAbsent}<span className="text-caption" style={{ marginLeft: 2, opacity: 0.8 }}>A</span></span>
                </div>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--color-border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span className="text-caption" style={{ fontWeight: 700, color: '#4338CA', letterSpacing: '0.04em' }}>🌙 AFTERNOON</span>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <span style={{ color: '#059669', fontWeight: 700 }}>{pmPresent}<span className="text-caption" style={{ marginLeft: 2, opacity: 0.8 }}>P</span></span>
                  <span style={{ color: '#DC2626', fontWeight: 700 }}>{pmAbsent}<span className="text-caption" style={{ marginLeft: 2, opacity: 0.8 }}>A</span></span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text" placeholder="Filter student..." value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  style={{ padding: '6px 12px', paddingLeft: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.8rem', outline: 'none' }}
                />
                <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <button onClick={() => setAllStatus(AttendanceStatus.PRESENT)} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid #059669', background: '#ECFDF5', color: '#059669',
                cursor: 'pointer', font: 'var(--text-caption)', fontWeight: 600,
              }}>All Present</button>
              <button onClick={() => setAllStatus(AttendanceStatus.ABSENT)} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid #DC2626', background: '#FEF2F2', color: '#DC2626',
                cursor: 'pointer', font: 'var(--text-caption)', fontWeight: 600,
              }}>All Absent</button>
              <button onClick={copyMorningToAfternoon} title="Set every student's afternoon status to match their morning" style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)',
                cursor: 'pointer', font: 'var(--text-caption)', fontWeight: 600,
              }}>Copy AM → PM</button>
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
                {/* Column header above the toggles so the morning/afternoon split is obvious */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr 130px 130px',
                  alignItems: 'center', gap: 'var(--space-3)',
                  padding: '6px var(--space-4)',
                  background: 'var(--color-surface)',
                  borderBottom: '1px solid var(--color-divider)',
                  fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  <span></span>
                  <span>Student</span>
                  <span style={{ textAlign: 'center', color: '#B45309' }}>☀️ Morning</span>
                  <span style={{ textAlign: 'center', color: '#4338CA' }}>🌙 Afternoon</span>
                </div>

                {displayStudents.map((student, index) => {
                  const dual = dualFor(student.id);
                  const amPresentRow = dual.am === AttendanceStatus.PRESENT;
                  const pmPresentRow = dual.pm === AttendanceStatus.PRESENT;
                  const renderToggle = (session: AttendanceSession, isPresent: boolean) => (
                    <button
                      onClick={() => toggleStatus(student.id, session)}
                      style={{
                        display: 'flex', alignItems: 'center',
                        width: 116, height: 32,
                        borderRadius: 'var(--radius-full)',
                        border: 'none', cursor: 'pointer',
                        background: isPresent ? '#059669' : '#DC2626',
                        position: 'relative',
                        transition: 'background 200ms',
                        padding: 0,
                        margin: '0 auto',
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        left: isPresent ? 3 : 'auto',
                        right: isPresent ? 'auto' : 3,
                        width: 26, height: 26,
                        borderRadius: '50%',
                        background: 'white',
                        transition: 'all 200ms',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                      <span style={{
                        flex: 1, textAlign: 'center',
                        color: 'white', fontSize: '0.7rem',
                        fontWeight: 700, letterSpacing: '0.03em',
                        paddingLeft: isPresent ? 26 : 0,
                        paddingRight: isPresent ? 0 : 26,
                      }}>
                        {isPresent ? 'PRESENT' : 'ABSENT'}
                      </span>
                    </button>
                  );
                  const rowHighlight = !amPresentRow || !pmPresentRow ? '#FEF2F2' : 'transparent';
                  return (
                    <div key={student.id} style={{
                      display: 'grid', gridTemplateColumns: '36px 1fr 130px 130px',
                      alignItems: 'center', gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: '1px solid var(--color-divider)',
                      background: rowHighlight,
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

                      {renderToggle(AttendanceSession.MORNING, amPresentRow)}
                      {renderToggle(AttendanceSession.AFTERNOON, pmPresentRow)}
                    </div>
                  );
                })}

                {/* Submit bar — saves both morning and afternoon at once */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-4)',
                  background: 'var(--color-surface-variant)',
                  borderTop: '1px solid var(--color-border)',
                  flexWrap: 'wrap', gap: 'var(--space-3)',
                }}>
                  <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    ☀️ <strong>{amPresent}</strong>P / <strong>{amAbsent}</strong>A &nbsp;·&nbsp;
                    🌙 <strong>{pmPresent}</strong>P / <strong>{pmAbsent}</strong>A &nbsp; out of <strong>{filteredStudents.length}</strong> students
                  </p>
                  <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Saving...' : (existingMorningRecord || existingAfternoonRecord) ? 'Update Attendance' : 'Submit Attendance'}
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
