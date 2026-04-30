'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  WeeklyTestsService, 
  StudentsService, 
  TeachersService, 
  ClassesService,
  MarksService
} from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Select } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Avatar, Badge } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';
import { 
  CalendarIcon, CheckCircleIcon
} from '@/components/ui/Icons';
import type { Student, Teacher, Class } from '@/types/models';

const MONTHS = [
  { value: 'june', label: 'June' },
  { value: 'july', label: 'July' },
  { value: 'august', label: 'August' },
  { value: 'september', label: 'September' },
  { value: 'october', label: 'October' },
  { value: 'november', label: 'November' },
  { value: 'december', label: 'December' },
  { value: 'january', label: 'January' },
  { value: 'february', label: 'February' },
  { value: 'march', label: 'March' },
];

export default function TeacherWeeklyMarks() {
  const { user } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  
  // Selection state
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  
  // Marks state: { [studentId]: { W1, W2, W3, W4 } }
  const [marks, setMarks] = useState<Record<string, { W1?: string; W2?: string; W3?: string; W4?: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'loading' | 'saved' | 'unsaved' | 'none'>('loading');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        if (!user || !school?.academicYear) return;
        const [classesData, allStudents] = await Promise.all([
          ClassesService.getAll(school.academicYear),
          StudentsService.getAll(school.academicYear)
        ]);
        
        let teacherData = await TeachersService.getByUserId(user.uid || user.id, school.academicYear);
        if (!teacherData && user.email) {
          teacherData = await TeachersService.getByEmail(user.email, school.academicYear);
        }
        
        setTeacher(teacherData as unknown as Teacher);
        setAllClasses(classesData as unknown as Class[]);
        setStudents(allStudents as unknown as Student[]);

        // Auto-selection moved to a separate effect
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, school?.academicYear]);

  // Load existing marks when selection changes
  useEffect(() => {
    if (!selectedClassId || !selectedSectionId || !selectedSubjectId || !selectedMonth) {
      setSaveStatus('none');
      return;
    }
    setSaveStatus('loading');
    setMarks({});

    async function loadMarks() {
      try {
        const existing: any[] = await WeeklyTestsService.getByClassSubjectMonth(
          selectedClassId, selectedSectionId, selectedSubjectId, selectedMonth, school.academicYear
        ) as any[];

        // Fetch old marks for backwards compatibility
        const oldMarksDocs = await MarksService.getAll() as any[];
        const oldMarks = oldMarksDocs.filter(m => 
          m.examType === 'formative_weekly' && 
          m.classId === selectedClassId && 
          m.sectionId === selectedSectionId && 
          m.month?.toLowerCase() === selectedMonth.toLowerCase()
        );

        const marksMap: typeof marks = {};
        
        // Use classStudents to ensure every student is checked
        // Note: classStudents isn't in scope of this effect dependencies directly if we don't pass it, 
        // but we can map the students list we have. Or we can just build map from both sources.
        
        const allStudentIds = new Set<string>();
        existing.forEach(t => { if (t.studentId) allStudentIds.add(t.studentId); });
        oldMarks.forEach(doc => {
          doc.records?.forEach((r: any) => { if (r.studentId) allStudentIds.add(r.studentId); });
        });
        
        allStudentIds.forEach(studentId => {
          let W1 = '', W2 = '', W3 = '', W4 = '';
          
          // 1. New Format
          const test = existing.find(t => t.studentId === studentId);
          if (test?.weeks) {
            if (test.weeks.W1 !== undefined) W1 = String(test.weeks.W1);
            if (test.weeks.W2 !== undefined) W2 = String(test.weeks.W2);
            if (test.weeks.W3 !== undefined) W3 = String(test.weeks.W3);
            if (test.weeks.W4 !== undefined) W4 = String(test.weeks.W4);
          }
          
          // 2. Old Format Fallback
          const checkOld = (weekStr: string) => {
            const oldDoc = oldMarks.find(m => m.week === weekStr);
            const rec = oldDoc?.records?.find((r: any) => r.studentId === studentId);
            const sub = rec?.subjectScores?.find((s: any) => s.subjectId === selectedSubjectId);
            if (sub && sub.marksObtained !== undefined) return String(sub.marksObtained);
            return '';
          };

          if (W1 === '') W1 = checkOld('W1');
          if (W2 === '') W2 = checkOld('W2');
          if (W3 === '') W3 = checkOld('W3');
          if (W4 === '') W4 = checkOld('W4');

          // If there is ANY data, add to map
          if (W1 || W2 || W3 || W4 || test) {
            marksMap[studentId] = { W1, W2, W3, W4 };
          }
        });

        setMarks(marksMap);
        
        // If there's new data, it's 'saved'. If it's purely old data, it's 'unsaved' so they can hit save to migrate.
        const hasNewData = existing && existing.length > 0;
        const hasOldData = Object.keys(marksMap).some(k => 
          marksMap[k].W1 !== '' || marksMap[k].W2 !== '' || marksMap[k].W3 !== '' || marksMap[k].W4 !== ''
        );
        
        setSaveStatus(hasNewData ? 'saved' : (hasOldData ? 'unsaved' : 'none'));
        setIsEditing(!hasNewData); // Lock fields if already saved in new database
      } catch (error) {
        console.error(error);
      }
    }
    loadMarks();
  }, [selectedClassId, selectedSectionId, selectedSubjectId, selectedMonth, school.academicYear]);

  const classStudents = useMemo(() => {
    return students.filter(s => s.classId === selectedClassId && s.sectionId === selectedSectionId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, selectedClassId, selectedSectionId]);

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

    // Fallback if subjectIds array is not used but teacher has a global subjects array
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

  // Auto-select first assignment when available
  useEffect(() => {
    if (uniqueClassSections.length > 0 && !selectedClassId) {
      const first = uniqueClassSections[0];
      setSelectedClassId(first.classId);
      setSelectedSectionId(first.sectionId);
    }
  }, [uniqueClassSections, selectedClassId]);

  // Auto-select first subject when available subjects change
  useEffect(() => {
    if (availableSubjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(availableSubjects[0].subjectId);
    }
  }, [availableSubjects, selectedSubjectId]);

  const handleMarkChange = (studentId: string, week: 'W1' | 'W2' | 'W3' | 'W4', value: string) => {
    // Valid marks are 0-10
    const num = parseInt(value);
    if (value !== '' && (isNaN(num) || num < 0 || num > 10)) return;
    
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [week]: value
      }
    }));
    setSaveStatus('unsaved');
  };

  const handleSave = async () => {
    if (!teacher || !selectedClassId || !selectedSectionId || !selectedSubjectId) return;
    setIsSaving(true);
    try {
      // Load all existing docs for this class/subject/month in one query
      const existingDocs = await WeeklyTestsService.getByClassSubjectMonth(
        selectedClassId, selectedSectionId, selectedSubjectId, selectedMonth, school.academicYear
      ) as any[];
      const existingByStudent: Record<string, any> = {};
      existingDocs.forEach((d: any) => { existingByStudent[d.studentId] = d; });

      const promises = classStudents.map(student => {
        const studentMarks = marks[student.id] || {};
        const weeksPayload: any = {};
        ['W1', 'W2', 'W3', 'W4'].forEach(w => {
          const v = studentMarks[w as keyof typeof studentMarks];
          if (v !== undefined && v !== '') weeksPayload[w] = parseInt(v) || 0;
        });

        const payload = {
          studentId: student.id, studentName: student.name,
          classId: selectedClassId, sectionId: selectedSectionId,
          subjectId: selectedSubjectId, teacherId: (teacher as any).id || '',
          month: selectedMonth, academicYear: school.academicYear,
          weeks: weeksPayload,
        };

        const existing = existingByStudent[student.id];
        if (existing?.id) return WeeklyTestsService.update(existing.id, payload);
        return WeeklyTestsService.create(payload);
      });

      await Promise.all(promises);
      setSaveStatus('saved');
      setIsEditing(false);
      showToast('Weekly marks saved successfully!');
    } catch (error) {
      console.error(error);
      showToast('Failed to save marks');
    } finally { setIsSaving(false); }
  };

  if (loading) return <div className="page-container"><p>Loading Weekly Tests...</p></div>;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="text-h1" style={{ margin: 0 }}>Weekly Marks Entry</h1>
            {saveStatus === 'saved' && <Badge variant="success">All Saved</Badge>}
            {saveStatus === 'unsaved' && <Badge variant="warning">Unsaved Changes</Badge>}
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: '4px' }}>Record marks for the 4 weekly tests (Max 10 marks each).</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {saveStatus === 'saved' && !isEditing ? (
            <Button variant="secondary" onClick={() => setIsEditing(true)}>
              Edit Marks
            </Button>
          ) : (
            <Button variant="primary" icon={<CheckCircleIcon size={18} />} onClick={handleSave} loading={isSaving} disabled={saveStatus === 'saved' && !isEditing}>
              Save All Marks
            </Button>
          )}
        </div>
      </div>

      {/* Selectors */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
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
        <Select 
          label="Month" 
          value={selectedMonth} 
          onChange={e => setSelectedMonth(e.target.value)}
          options={MONTHS}
        />
      </div>

      {/* Marks Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '16px', textAlign: 'left', width: '300px' }}>Student Name</th>
                <th style={{ padding: '16px', textAlign: 'center' }}>Week 1 (10)</th>
                <th style={{ padding: '16px', textAlign: 'center' }}>Week 2 (10)</th>
                <th style={{ padding: '16px', textAlign: 'center' }}>Week 3 (10)</th>
                <th style={{ padding: '16px', textAlign: 'center' }}>Week 4 (10)</th>
                <th style={{ padding: '16px', textAlign: 'center', background: 'var(--color-primary-50)', fontWeight: 700 }}>Best 2 Total</th>
              </tr>
            </thead>
            <tbody>
              {classStudents.map(student => {
                const sMarks = marks[student.id] || {};
                const weekValues = [
                  parseInt(sMarks.W1 || '0') || 0,
                  parseInt(sMarks.W2 || '0') || 0,
                  parseInt(sMarks.W3 || '0') || 0,
                  parseInt(sMarks.W4 || '0') || 0
                ].sort((a, b) => b - a);
                const bestTwo = weekValues[0] + weekValues[1];

                return (
                  <tr key={student.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Avatar name={student.name} size={32} />
                        <span style={{ fontWeight: 500 }}>{student.name}</span>
                      </div>
                    </td>
                    {['W1', 'W2', 'W3', 'W4'].map(w => (
                      <td key={w} style={{ padding: '8px', textAlign: 'center' }}>
                        <input 
                          type="text"
                          value={sMarks[w as keyof typeof sMarks] || ''}
                          onChange={e => handleMarkChange(student.id, w as any, e.target.value)}
                          placeholder="-"
                          disabled={!isEditing && saveStatus === 'saved'}
                          style={{ 
                            width: '60px', padding: '10px', textAlign: 'center', borderRadius: '8px', 
                            border: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600,
                            background: (!isEditing && saveStatus === 'saved') ? 'var(--color-surface-variant)' : 'white'
                          }}
                        />
                      </td>
                    ))}
                    <td style={{ padding: '16px', textAlign: 'center', background: 'var(--color-primary-50)', fontWeight: 800, color: 'var(--color-primary-700)' }}>
                      {bestTwo}
                    </td>
                  </tr>
                );
              })}
              {classStudents.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                    No students found for this class and section.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
