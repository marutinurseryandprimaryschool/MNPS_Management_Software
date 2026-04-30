'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ClassesService, StudentsService, MarksService } from '@/lib/firestore-service';
import { useSchool } from '@/context/SchoolContext';
import { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/SharedUI';
import type { Class, Student } from '@/types/models';

const EXAMS = [
  { value: 'i_mid_term', label: 'I Mid Term', term: 'Term 1' },
  { value: 'quarterly', label: 'Quarterly', term: 'Term 1' },
  { value: 'ii_mid_term', label: 'II Mid Term', term: 'Term 2' },
  { value: 'half_yearly', label: 'Half Yearly', term: 'Term 2' },
  { value: 'iii_mid_term', label: 'III Mid Term', term: 'Term 3' },
  { value: 'annual', label: 'Annual', term: 'Term 3' },
];

export default function AdminExamResults() {
  const { school } = useSchool();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allMarks, setAllMarks] = useState<any[]>([]);

  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');

  useEffect(() => {
    async function load() {
      if (!school?.academicYear) return;
      try {
        const [cl, st, m] = await Promise.all([
          ClassesService.getAll(school.academicYear),
          StudentsService.getAll(school.academicYear),
          MarksService.getAll(school.academicYear)
        ]);
        setClasses(cl as unknown as Class[]);
        setStudents(st as unknown as Student[]);
        setAllMarks(m as any[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [school?.academicYear]);

  const uniqueClassSections = useMemo(() => {
    const list: any[] = [];
    classes.forEach(c => {
      c.sections.forEach(s => {
        list.push({
          classId: c.id,
          sectionId: s.id,
          className: c.name,
          sectionName: s.name,
          subjects: c.subjects || []
        });
      });
    });
    return list;
  }, [classes]);

  const classStudents = useMemo(() => 
    students.filter(s => s.classId === selectedClassId && s.sectionId === selectedSectionId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  [students, selectedClassId, selectedSectionId]);

  const reportData = useMemo(() => {
    if (!selectedExam || !selectedClassId || !selectedSectionId) return null;

    // Filter marks for this exam and class/section
    const classMarks = allMarks.filter(m => 
      m.examType === 'major_exam' && 
      m.examId === selectedExam && 
      m.classId === selectedClassId && 
      m.sectionId === selectedSectionId
    );

    const cls = uniqueClassSections.find(c => c.classId === selectedClassId && c.sectionId === selectedSectionId);
    const subjects = cls?.subjects || [];
    const subjectCount = subjects.length;
    const maxTotal = subjectCount * 100;

    const studentMap: Record<string, { total: number; subjectsCount: number; subjectMarks: Record<string, number> }> = {};
    classStudents.forEach(s => {
      studentMap[s.id] = { total: 0, subjectsCount: 0, subjectMarks: {} };
    });

    classMarks.forEach(subjectMarkDoc => {
      const subjectId = subjectMarkDoc.subjectId;
      (subjectMarkDoc.records || []).forEach((r: any) => {
        if (studentMap[r.studentId]) {
          studentMap[r.studentId].total += (r.totalMarks || 0);
          studentMap[r.studentId].subjectsCount += 1;
          studentMap[r.studentId].subjectMarks[subjectId] = r.totalMarks || 0;
        }
      });
    });

    const rows = classStudents.map(student => {
      const data = studentMap[student.id];
      const percentage = maxTotal > 0 ? (data.total / maxTotal) * 100 : 0;
      let grade = 'F';
      if (percentage >= 90) grade = 'A1';
      else if (percentage >= 80) grade = 'A2';
      else if (percentage >= 70) grade = 'B1';
      else if (percentage >= 60) grade = 'B2';
      else if (percentage >= 50) grade = 'C1';
      else if (percentage >= 40) grade = 'C2';
      else if (percentage >= 33) grade = 'D';

      return {
        ...student,
        totalObtained: data.total,
        subjectsCount: data.subjectsCount,
        subjectMarks: data.subjectMarks,
        percentage,
        grade
      };
    });

    rows.sort((a, b) => b.totalObtained - a.totalObtained); // Rank by total

    return {
      rows,
      subjects,
      subjectCount,
      maxTotal,
      enteredSubjects: classMarks.length
    };
  }, [allMarks, classStudents, selectedExam, selectedClassId, selectedSectionId, uniqueClassSections]);

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: 32 }}>
        <h1 className="text-h1">Class Exam Results</h1>
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          View overall aggregated student marks for a specific exam.
        </p>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Select 
            label="Exam" 
            value={selectedExam}
            onChange={(e: any) => setSelectedExam(e.target.value)}
            options={[
              { value: '', label: 'Select Exam...' },
              ...EXAMS.map(e => ({ value: e.value, label: `${e.label} (${e.term})` }))
            ]}
          />
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
        </div>
      </div>

      {reportData && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 className="text-h3" style={{ margin: 0 }}>Overall Mark Report</h2>
              <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                Based on {reportData.enteredSubjects} out of {reportData.subjectCount} subjects entered by teachers.
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Maximum Possible Marks</div>
              <div className="text-h2" style={{ color: 'var(--color-primary-700)' }}>{reportData.maxTotal}</div>
            </div>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--color-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', font: 'var(--text-body-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Rank</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Student Name</th>
                  {reportData.subjects.map((sub: any) => (
                    <th key={sub.id} style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{sub.name}</th>
                  ))}
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--color-primary-700)', fontWeight: 700, background: 'var(--color-primary-50)' }}>Total Marks</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Percentage</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {reportData.rows.map((row, index) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-tertiary)' }}>
                      #{index + 1}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.name}</td>
                    {reportData.subjects.map((sub: any) => (
                      <td key={sub.id} style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        {row.subjectMarks[sub.id] !== undefined ? row.subjectMarks[sub.id] : '-'}
                      </td>
                    ))}
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontSize: 15, background: 'var(--color-primary-50)' }}>
                      {row.totalObtained}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      {row.percentage.toFixed(1)}%
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ 
                        fontWeight: 800, 
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: row.grade.startsWith('A') ? 'var(--color-success-bg)' : 
                                    row.grade.startsWith('B') ? 'var(--color-primary-50)' :
                                    row.grade === 'F' ? 'var(--color-error-bg)' : 'var(--color-surface-variant)',
                        color: row.grade.startsWith('A') ? 'var(--color-success)' : 
                               row.grade.startsWith('B') ? 'var(--color-primary-600)' :
                               row.grade === 'F' ? 'var(--color-error)' : 'var(--color-text-primary)'
                      }}>
                        {row.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
