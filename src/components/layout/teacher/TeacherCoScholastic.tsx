'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing untyped Firestore data handling in this legacy screen; typed migration tracked separately. */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClassesService, 
  StudentsService, 
  CoScholasticService, 
  TeachersService, 
  AttendanceAggregationService,
  SettingsService
} from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import Input, { Select } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Badge, Avatar } from '@/components/ui/SharedUI';
import { CheckCircleIcon, RefreshIcon, CalendarIcon } from '@/components/ui/Icons';
import { useToast } from '@/components/ui/Toast';
import type { Class, Student } from '@/types/models';
import { EXAM_TERM_LABELS } from '@/types/enums';

const EXAM_OPTIONS = Object.entries(EXAM_TERM_LABELS).map(([value, label]) => ({
  value,
  label
}));

const REMARK_OPTIONS = [
  { value: 'Excellent', label: 'Excellent' },
  { value: 'Very Good', label: 'Very Good' },
  { value: 'Good', label: 'Good' },
  { value: 'Fair', label: 'Fair' },
  { value: 'Needs Improvement', label: 'Needs Improvement' },
];

const GRADE_OPTIONS = [
  { value: '', label: '-' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
];

export default function TeacherCoScholastic() {
  const { user } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examCalendar, setExamCalendar] = useState<Record<string, {start: string, end: string}>>({});
  
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [totalWorkingDays, setTotalWorkingDays] = useState('0');
  
  // existingDoc is the document from Firestore for this Class + Section + Exam
  const [existingDoc, setExistingDoc] = useState<any>(null);
  const [records, setRecords] = useState<Record<string, any>>({});
  
  const [saveStatus, setSaveStatus] = useState<'saved'|'unsaved'>('saved');

  useEffect(() => {
    async function init() {
      try {
        if (!school?.academicYear) return;
        const [cl, st, calendar] = await Promise.all([
          ClassesService.getAll(school.academicYear),
          StudentsService.getAll(school.academicYear),
          SettingsService.getExamCalendar(school.academicYear)
        ]);
        setClasses(cl as unknown as Class[]);
        setStudents(st as unknown as Student[]);
        if (calendar) setExamCalendar(calendar.terms || {});

        if (user) {
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [user, school?.academicYear]);

  // Load existing records when Class, Section, and Exam change
  useEffect(() => {
    async function loadRecords() {
      if (!selectedClassId || !selectedSectionId || !selectedExam) {
        setRecords({});
        setExistingDoc(null);
        setSaveStatus('saved');
        return;
      }
      
      try {
        const doc = await CoScholasticService.getByClassSectionExam(selectedClassId, selectedSectionId, selectedExam, school.academicYear);
        if (doc) {
          setExistingDoc(doc);
          setTotalWorkingDays(doc.totalWorkingDays || '0');
          const recMap: Record<string, any> = {};
          (doc.records || []).forEach((r: any) => {
            recMap[r.studentId] = r;
          });
          setRecords(recMap);
        } else {
          setExistingDoc(null);
          setRecords({});
          setTotalWorkingDays('0');
        }
        setSaveStatus('saved');
      } catch (err) {
        console.error(err);
        showToast('Error loading records');
      }
    }
    loadRecords();
  }, [selectedClassId, selectedSectionId, selectedExam, showToast]);

  const uniqueClassSections = useMemo(() => {
    const list: any[] = [];
    classes.forEach(c => {
      c.sections.forEach(s => {
        list.push({
          classId: c.id,
          sectionId: s.id,
          className: c.name,
          sectionName: s.name,
        });
      });
    });
    return list;
  }, [classes]);

  const classStudents = useMemo(() => 
    students.filter(s => s.classId === selectedClassId && s.sectionId === selectedSectionId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  [students, selectedClassId, selectedSectionId]);

  const currentTermDates = useMemo(() => {
    if (!selectedExam || !examCalendar[selectedExam]) return null;
    return examCalendar[selectedExam];
  }, [selectedExam, examCalendar]);

  const handleRecordChange = (studentId: string, field: string, value: string) => {
    setRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        studentId,
        [field]: value
      }
    }));
    setSaveStatus('unsaved');
  };

  const handleAutoSync = async () => {
    if (!selectedClassId || !selectedSectionId || !selectedExam) {
      showToast('Please select Class, Section, and Exam');
      return;
    }

    if (!currentTermDates || !currentTermDates.start || !currentTermDates.end) {
      showToast('Exam dates not set by Admin. Please contact administrator.');
      return;
    }

    setIsSyncing(true);
    try {
      const summary = await AttendanceAggregationService.getClassAttendanceSummary(
        selectedClassId, 
        selectedSectionId,
        currentTermDates.start,
        currentTermDates.end
      );
      
      setTotalWorkingDays(summary.workingDays.toString());
      
      const newRecords = { ...records };
      classStudents.forEach(s => {
        const presentCount = summary.studentStats[s.id] || 0;
        newRecords[s.id] = {
          ...(newRecords[s.id] || {}),
          studentId: s.id,
          presentDays: presentCount.toString()
        };
      });
      
      setRecords(newRecords);
      setSaveStatus('unsaved');
      showToast(`Successfully synced for period: ${currentTermDates.start} to ${currentTermDates.end}`);
    } catch (err) {
      console.error(err);
      showToast('Failed to sync attendance');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedClassId || !selectedSectionId || !selectedExam) {
      showToast('Please select Class, Section, and Exam');
      return;
    }
    
    setIsSaving(true);
    try {
      const recordsArray = classStudents.map(s => {
        const r = records[s.id] || {};
        const presentDays = r.presentDays || '0';
        const workingDaysString = `${presentDays}/${totalWorkingDays}`;
        
        return {
          studentId: s.id,
          studentName: s.name,
          presentDays: presentDays,
          workingDays: workingDaysString,
          remarks: r.remarks || 'Excellent',
          neatness: r.neatness || 'A',
          lifeSkills: r.lifeSkills || 'A',
          attitudes: r.attitudes || 'A',
          yoga: r.yoga || 'A',
          coCurricular: r.coCurricular || 'A',
        };
      });

      const payload = {
        classId: selectedClassId,
        sectionId: selectedSectionId,
        examId: selectedExam,
        totalWorkingDays,
        academicYear: school.academicYear,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || user?.id,
        records: recordsArray,
      };

      if (existingDoc) {
        await CoScholasticService.update(existingDoc.id, payload);
      } else {
        const newDocId = await CoScholasticService.create(payload);
        setExistingDoc({ id: newDocId, ...payload });
      }
      
      setSaveStatus('saved');
      showToast('Records saved successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to save records');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="page-container">Loading...</div>;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="text-h1" style={{ margin: 0 }}>Co-Scholastic & Remarks Entry</h1>
            {saveStatus === 'saved' ? <Badge variant="success">All Saved</Badge> : <Badge variant="warning">Unsaved Changes</Badge>}
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
            Record attendance, remarks, and behavioral grades for the report card.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="primary" icon={<CheckCircleIcon size={18} />} onClick={handleSave} loading={isSaving} disabled={saveStatus === 'saved' || classStudents.length === 0}>
            Save Records
          </Button>
        </div>
      </div>

      <div className="card" style={{ padding: '20px', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
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
          label="Exam Term"
          value={selectedExam}
          onChange={(e: any) => setSelectedExam(e.target.value)}
          options={[
            { value: '', label: 'Select Exam...' },
            ...EXAM_OPTIONS
          ]}
        />
        <div style={{ position: 'relative' }}>
          <Input
            label="Total Working Days"
            type="number"
            value={totalWorkingDays}
            onChange={(e: any) => {
              setTotalWorkingDays(e.target.value);
              setSaveStatus('unsaved');
            }}
            placeholder="0"
          />
          <button 
            onClick={handleAutoSync}
            disabled={isSyncing || !selectedExam}
            style={{ 
              position: 'absolute', right: '8px', bottom: '8px', 
              background: 'var(--color-primary-600)', color: 'white', border: 'none', 
              borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, 
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              opacity: (isSyncing || !selectedExam) ? 0.5 : 1
            }}
          >
            <RefreshIcon size={14} />
            {isSyncing ? 'Syncing...' : 'Sync Attendance'}
          </button>
        </div>
      </div>

      {selectedExam && (
        <div style={{ marginBottom: '24px', padding: '12px 16px', background: currentTermDates ? 'var(--color-primary-50)' : 'var(--color-warning-50)', borderRadius: '8px', border: '1px solid', borderColor: currentTermDates ? 'var(--color-primary-100)' : 'var(--color-warning-100)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CalendarIcon size={18} color={currentTermDates ? 'var(--color-primary-600)' : 'var(--color-warning-600)'} />
          <span style={{ fontSize: '13px', color: currentTermDates ? 'var(--color-primary-900)' : 'var(--color-warning-900)', fontWeight: 500 }}>
            {currentTermDates 
              ? `Attendance Period: ${currentTermDates.start} to ${currentTermDates.end} (Set by Admin)`
              : `Warning: Start and End dates for ${(EXAM_TERM_LABELS as any)[selectedExam]} have not been set by the Admin.`
            }
          </span>
        </div>
      )}

      {selectedClassId && selectedSectionId && selectedExam && classStudents.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '16px', textAlign: 'left', minWidth: '200px' }}>Student Name</th>
                  <th style={{ padding: '16px', textAlign: 'left', width: '120px' }}>Present Days</th>
                  <th style={{ padding: '16px', textAlign: 'left', width: '180px' }}>Remarks</th>
                  <th style={{ padding: '16px', textAlign: 'center', width: '100px' }}>Neatness</th>
                  <th style={{ padding: '16px', textAlign: 'center', width: '100px' }}>Life Skills</th>
                  <th style={{ padding: '16px', textAlign: 'center', width: '100px' }}>Attitudes</th>
                  <th style={{ padding: '16px', textAlign: 'center', width: '100px' }}>Yoga</th>
                  <th style={{ padding: '16px', textAlign: 'center', width: '100px' }}>Co-Curr</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map(student => {
                  const rec = records[student.id] || {};
                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Avatar name={student.name} size={32} />
                          <span style={{ fontWeight: 500 }}>{student.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Input 
                          type="number"
                          value={rec.presentDays || '0'} 
                          onChange={(e: any) => handleRecordChange(student.id, 'presentDays', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Select
                          value={rec.remarks || 'Excellent'}
                          onChange={(e: any) => handleRecordChange(student.id, 'remarks', e.target.value)}
                          options={REMARK_OPTIONS}
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Select
                          value={rec.neatness || 'A'}
                          onChange={(e: any) => handleRecordChange(student.id, 'neatness', e.target.value)}
                          options={GRADE_OPTIONS}
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Select
                          value={rec.lifeSkills || 'A'}
                          onChange={(e: any) => handleRecordChange(student.id, 'lifeSkills', e.target.value)}
                          options={GRADE_OPTIONS}
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Select
                          value={rec.attitudes || 'A'}
                          onChange={(e: any) => handleRecordChange(student.id, 'attitudes', e.target.value)}
                          options={GRADE_OPTIONS}
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Select
                          value={rec.yoga || 'A'}
                          onChange={(e: any) => handleRecordChange(student.id, 'yoga', e.target.value)}
                          options={GRADE_OPTIONS}
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Select
                          value={rec.coCurricular || 'A'}
                          onChange={(e: any) => handleRecordChange(student.id, 'coCurricular', e.target.value)}
                          options={GRADE_OPTIONS}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {selectedClassId && selectedSectionId && selectedExam && classStudents.length === 0 && (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <p className="text-body" style={{ color: 'var(--color-text-tertiary)' }}>No students found in this class.</p>
        </div>
      )}
    </div>
  );
}
