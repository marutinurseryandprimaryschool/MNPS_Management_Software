'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClassesService, StudentsService, MarksService, TeachersService, CoScholasticService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Select } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { PrinterIcon } from '@/components/ui/Icons';
import type { Class, Student } from '@/types/models';

interface SharedReportCardProps {
  view: 'admin' | 'teacher' | 'parent';
}

const EXAM_COLUMNS = [
  { value: 'i_mid_term', label: 'I MID TERM' },
  { value: 'quarterly', label: 'QUARTERLY' },
  { value: 'ii_mid_term', label: 'II MID TERM' },
  { value: 'half_yearly', label: 'HALF YEARLY' },
  { value: 'iii_mid_term', label: 'III MID TERM' },
  { value: 'annual', label: 'ANNUAL' },
];

function getGrade(total: number, max: number = 100): string {
  if (total === 0 && max === 0) return '';
  const percent = (total / max) * 100;
  if (percent >= 80) return 'A';
  if (percent >= 60) return 'B';
  if (percent >= 40) return 'C';
  return 'D';
}

export default function SharedReportCard({ view }: SharedReportCardProps) {
  const { user } = useAuth();
  const { school } = useSchool();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allMarks, setAllMarks] = useState<any[]>([]);
  const [allCoScholastic, setAllCoScholastic] = useState<any[]>([]);

  // Selection state
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const printableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        if (!school?.academicYear) return;
        const [cl, st, m, co] = await Promise.all([
          ClassesService.getAll(school.academicYear),
          StudentsService.getAll(school.academicYear),
          MarksService.getAll(school.academicYear),
          CoScholasticService.getAll() // Note: CoScholastic getAll doesn't have year param in service, but getByClassSectionExam does
        ]);
        
        // Let's filter coScholastic manually if getAll doesn't support it yet
        const filteredCo = co.filter((c: any) => c.academicYear === school.academicYear);
        
        setClasses(cl as unknown as Class[]);
        setStudents(st as unknown as Student[]);
        setAllMarks(m as any[]);
        setAllCoScholastic(filteredCo);

        // If teacher, set their class automatically as default
        if (view === 'teacher' && user) {
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

        // If parent, find their children and auto-select
        if (view === 'parent' && user) {
          const myChildren = (st as unknown as Student[]).filter(s =>
            s.email?.toLowerCase() === user.email?.toLowerCase()
          );
          if (myChildren.length > 0) {
            setSelectedClassId(myChildren[0].classId);
            setSelectedSectionId(myChildren[0].sectionId);
            setSelectedStudentId(myChildren[0].id);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [view, user, school?.academicYear]);

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

  const selectedStudent = useMemo(() => 
    classStudents.find(s => s.id === selectedStudentId),
  [classStudents, selectedStudentId]);

  const activeClassData = useMemo(() => 
    uniqueClassSections.find(c => c.classId === selectedClassId && c.sectionId === selectedSectionId),
  [uniqueClassSections, selectedClassId, selectedSectionId]);

  // Build report card matrix
  const reportData = useMemo(() => {
    if (!selectedStudent || !activeClassData) return null;

    const subjects = activeClassData.subjects || [];
    
    // Matrix: subjectId -> examId -> marks
    const matrix: Record<string, Record<string, any>> = {};
    subjects.forEach((sub: any) => {
      matrix[sub.id] = {};
      EXAM_COLUMNS.forEach(ex => {
        matrix[sub.id][ex.value] = null;
      });
    });

    // Totals per exam
    const examTotals: Record<string, { total: number; max: number; count: number }> = {};
    EXAM_COLUMNS.forEach(ex => {
      examTotals[ex.value] = { total: 0, max: 0, count: 0 };
    });

    // Populate matrix
    allMarks.forEach(doc => {
      if (
        doc.classId === selectedClassId && 
        doc.sectionId === selectedSectionId && 
        doc.examType === 'major_exam'
      ) {
        const examId = doc.examId;
        const subId = doc.subjectId;
        if (matrix[subId] && examTotals[examId]) {
          const studentRecord = (doc.records || []).find((r: any) => r.studentId === selectedStudentId);
          if (studentRecord) {
            matrix[subId][examId] = studentRecord;
            examTotals[examId].total += (studentRecord.totalMarks || 0);
            examTotals[examId].max += 100; // assuming 100 max per subject
            examTotals[examId].count += 1;
          }
        }
      }
    });

    // Build co-scholastic records
    const coScholasticData: Record<string, any> = {};
    EXAM_COLUMNS.forEach(ex => {
      coScholasticData[ex.value] = null;
    });

    allCoScholastic.forEach(doc => {
      if (
        doc.classId === selectedClassId &&
        doc.sectionId === selectedSectionId
      ) {
        const studentRecord = (doc.records || []).find((r: any) => r.studentId === selectedStudentId);
        if (studentRecord) {
          coScholasticData[doc.examId] = studentRecord;
        }
      }
    });

    return { subjects, matrix, examTotals, coScholasticData };
  }, [selectedStudent, activeClassData, allMarks, allCoScholastic, selectedClassId, selectedSectionId, selectedStudentId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  return (
    <div className="page-container">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-report, .printable-report * {
            visibility: visible;
          }
          .printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #000;
          font-family: Arial, sans-serif;
          font-size: 11px;
        }
        .report-table th, .report-table td {
          border: 1px solid #000;
          padding: 4px 6px;
          text-align: center;
        }
        .report-table th {
          font-weight: bold;
          background-color: #f9fafb;
        }
        .report-table .text-left {
          text-align: left;
        }
        .report-table .text-bold {
          font-weight: bold;
        }
        .report-table .col-sub {
          width: 25px;
        }
        .grade-text {
          color: #d97706; /* A1 grade color like in image */
        }
        .total-text {
          color: #dc2626; /* Red totals like in image */
        }
      `}} />

      <div className="page-header no-print" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="text-h1">Student Report Card</h1>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Select a student to generate and print their comprehensive academic report card.
          </p>
        </div>
        {reportData && (
          <Button variant="primary" icon={<PrinterIcon size={18} />} onClick={handlePrint}>
            Print Report Card
          </Button>
        )}
      </div>

      {view !== 'parent' && (
        <div className="card no-print" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
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
                setSelectedStudentId('');
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
              label="Student"
              value={selectedStudentId}
              onChange={(e: any) => setSelectedStudentId(e.target.value)}
              disabled={!selectedClassId || !selectedSectionId}
              options={[
                { value: '', label: 'Select Student...' },
                ...classStudents.map(s => ({
                  value: s.id,
                  label: s.name
                }))
              ]}
            />
          </div>
        </div>
      )}

      {view === 'parent' && students.filter(s => s.email?.toLowerCase() === user?.email?.toLowerCase()).length > 1 && (
        <div className="card no-print" style={{ padding: 20, marginBottom: 24 }}>
          <p className="text-caption" style={{ marginBottom: 12 }}>Select Child</p>
          <div style={{ display: 'flex', gap: 12 }}>
            {students.filter(s => s.email?.toLowerCase() === user?.email?.toLowerCase()).map(s => (
              <Button 
                key={s.id} 
                variant={selectedStudentId === s.id ? 'primary' : 'secondary'}
                onClick={() => {
                  setSelectedClassId(s.classId);
                  setSelectedSectionId(s.sectionId);
                  setSelectedStudentId(s.id);
                }}
              >
                {s.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {reportData && selectedStudent && activeClassData && (
        <div className="card printable-report" ref={printableRef} style={{ padding: 32, overflowX: 'auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 24, textTransform: 'uppercase', fontWeight: 800 }}>Maruti Nursery & Primary School</h2>
            <h3 style={{ margin: '8px 0 0 0', fontSize: 18 }}>Academic Progress Report</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary-800)', margin: 0 }}>PROGRESS REPORT</h2>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary-600)', marginTop: '2px' }}>
                  ACADEMIC YEAR {school.academicYear}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Student Name: <span style={{ borderBottom: '1px dashed #000', padding: '0 40px 0 8px' }}>{selectedStudent.name}</span></div>
                <div>Class: <span style={{ borderBottom: '1px dashed #000', padding: '0 40px 0 8px' }}>{activeClassData.className} - {activeClassData.sectionName}</span></div>
                <div>Admission No: <span style={{ borderBottom: '1px dashed #000', padding: '0 40px 0 8px' }}>{selectedStudent.admissionNumber || '____'}</span></div>
              </div>
            </div>
          </div>

          <table className="report-table">
            <thead>
              <tr>
                <th rowSpan={2} style={{ minWidth: 120 }}>SUBJECT</th>
                {EXAM_COLUMNS.map(ex => (
                  <th key={ex.value} colSpan={4}>{ex.label}</th>
                ))}
              </tr>
              <tr>
                {EXAM_COLUMNS.map(ex => (
                  <React.Fragment key={ex.value + '_sub'}>
                    <th className="col-sub">FA<br/>40</th>
                    <th className="col-sub">SA<br/>60</th>
                    <th className="col-sub">Total<br/>100</th>
                    <th className="col-sub">Grade</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Subject Rows */}
              {reportData.subjects.map((sub: any) => (
                <tr key={sub.id}>
                  <td className="text-left text-bold" style={{ textTransform: 'uppercase' }}>{sub.name}</td>
                  {EXAM_COLUMNS.map(ex => {
                    const cell = reportData.matrix[sub.id][ex.value];
                    if (!cell) {
                      return (
                        <React.Fragment key={ex.value + sub.id}>
                          <td>-</td><td>-</td><td>-</td><td>-</td>
                        </React.Fragment>
                      );
                    }
                    return (
                      <React.Fragment key={ex.value + sub.id}>
                        <td>{cell.faTotal !== undefined && cell.faTotal !== null ? cell.faTotal : '-'}</td>
                        <td>{cell.saScore !== undefined && cell.saScore !== null ? cell.saScore : '-'}</td>
                        <td className="total-text text-bold">{cell.totalMarks !== undefined && cell.totalMarks !== null ? cell.totalMarks : '-'}</td>
                        <td className="grade-text text-bold">{cell.totalMarks ? getGrade(cell.totalMarks, 100) : '-'}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}

              {/* Total Row */}
              <tr>
                <td className="text-left text-bold">TOTAL</td>
                {EXAM_COLUMNS.map(ex => {
                  const stat = reportData.examTotals[ex.value];
                  if (stat.count === 0) return <td key={ex.value} colSpan={4}>-</td>;
                  return (
                    <td key={ex.value} colSpan={4} className="total-text text-bold" style={{ fontSize: 13 }}>
                      {stat.total}
                    </td>
                  );
                })}
              </tr>

              {/* Average Row */}
              <tr>
                <td className="text-left text-bold">AVERAGE</td>
                {EXAM_COLUMNS.map(ex => {
                  const stat = reportData.examTotals[ex.value];
                  if (stat.count === 0) return <td key={ex.value} colSpan={4}>-</td>;
                  const maxPossible = reportData.subjects.length * 100;
                  const avg = maxPossible > 0 ? (stat.total / maxPossible) * 100 : 0;
                  return (
                    <td key={ex.value} colSpan={4} className="text-bold">
                      {avg.toFixed(0)}%
                    </td>
                  );
                })}
              </tr>

              {/* Grade Row */}
              <tr>
                <td className="text-left text-bold">GRADE</td>
                {EXAM_COLUMNS.map(ex => {
                  const stat = reportData.examTotals[ex.value];
                  if (stat.count === 0) return <td key={ex.value} colSpan={4}>-</td>;
                  const maxPossible = reportData.subjects.length * 100;
                  const grade = getGrade(stat.total, maxPossible);
                  return (
                    <td key={ex.value} colSpan={4} className="grade-text text-bold">
                      {grade}
                    </td>
                  );
                })}
              </tr>

              {/* Working Days Row */}
              <tr>
                <td className="text-left text-bold">NO OF WORKING DAYS</td>
                {EXAM_COLUMNS.map(ex => (
                  <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.workingDays || '-'}</td>
                ))}
              </tr>

              {/* Remarks Row */}
              <tr>
                <td className="text-left text-bold">REMARKS</td>
                {EXAM_COLUMNS.map(ex => (
                  <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.remarks || '-'}</td>
                ))}
              </tr>

              {/* Co-Scholastic Headers */}
              <tr>
                <td className="text-left text-bold">NEATNESS</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.neatness || '-'}</td>)}
              </tr>
              <tr>
                <td className="text-left text-bold">LIFE SKILLS</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.lifeSkills || '-'}</td>)}
              </tr>
              <tr>
                <td className="text-left text-bold">ATTITUDES AND VALUES</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.attitudes || '-'}</td>)}
              </tr>
              <tr>
                <td className="text-left text-bold">YOGA, HEALTH & WELLNESS</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.yoga || '-'}</td>)}
              </tr>
              <tr>
                <td className="text-left text-bold">CO-CURRICULAR ACTIVITIES</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} className="text-bold">{reportData.coScholasticData[ex.value]?.coCurricular || '-'}</td>)}
              </tr>
              
              {/* Signatures */}
              <tr>
                <td className="text-left text-bold" style={{ height: 50, verticalAlign: 'bottom', paddingBottom: 8 }}>SIGNATURE OF CLASS TEACHER</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} style={{ verticalAlign: 'bottom', paddingBottom: 8 }}></td>)}
              </tr>
              <tr>
                <td className="text-left text-bold" style={{ height: 50, verticalAlign: 'bottom', paddingBottom: 8 }}>SIGNATURE OF THE PRINCIPAL</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} style={{ verticalAlign: 'bottom', paddingBottom: 8 }}></td>)}
              </tr>
              <tr>
                <td className="text-left text-bold" style={{ height: 50, verticalAlign: 'bottom', paddingBottom: 8 }}>SIGNATURE OF THE PARENT</td>
                {EXAM_COLUMNS.map(ex => <td key={ex.value} colSpan={4} style={{ verticalAlign: 'bottom', paddingBottom: 8 }}></td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
