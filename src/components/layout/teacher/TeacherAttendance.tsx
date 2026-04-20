'use client';

import React, { useState } from 'react';
import { DEMO_STUDENTS, DEMO_CLASSES, DEMO_TEACHERS } from '@/lib/demo-data';
import { AttendanceStatus } from '@/types/enums';
import { Select } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Badge, Avatar } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';

export default function TeacherAttendance() {
  const teacher = DEMO_TEACHERS[0];
  const [selectedClass] = useState('class_005');
  const [selectedSection] = useState('sec_5a');
  const [selectedPeriod] = useState('1');
  const { showToast } = useToast();

  const students = DEMO_STUDENTS.filter(s => s.classId === selectedClass && s.sectionId === selectedSection);
  
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(students.map(s => [s.id, AttendanceStatus.PRESENT]))
  );

  const toggleStatus = (studentId: string) => {
    setRecords(prev => {
      const current = prev[studentId];
      const next = current === AttendanceStatus.PRESENT ? AttendanceStatus.ABSENT : current === AttendanceStatus.ABSENT ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
      return { ...prev, [studentId]: next };
    });
  };

  const presentCount = Object.values(records).filter(s => s === AttendanceStatus.PRESENT).length;
  const absentCount = Object.values(records).filter(s => s === AttendanceStatus.ABSENT).length;
  const lateCount = Object.values(records).filter(s => s === AttendanceStatus.LATE).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Mark Attendance</h2>
          <p className="text-body-sm">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <Select options={teacher.assignedClasses.map(ac => ({ value: `${ac.classId}-${ac.sectionId}`, label: `${ac.className}-${ac.sectionName} (${ac.subjectName})` }))} value={`${selectedClass}-${selectedSection}`} fullWidth={false} style={{ width: '240px' }} onChange={() => {}} />
        <Select options={[1,2,3,4,5,6,7,8].map(p => ({ value: String(p), label: `Period ${p}` }))} value={selectedPeriod} fullWidth={false} style={{ width: '120px' }} onChange={() => {}} />
      </div>

      {/* Summary Bar */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)' }} />
          <span className="text-body-sm">Present: {presentCount}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-error)' }} />
          <span className="text-body-sm">Absent: {absentCount}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)' }} />
          <span className="text-body-sm">Late: {lateCount}</span>
        </div>
        <span style={{ marginLeft: 'auto' }} className="text-body-sm" >{students.length} students</span>
      </div>

      {/* Student List */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {students.map((student, i) => {
          const status = records[student.id];
          const statusColor = status === AttendanceStatus.PRESENT ? 'var(--color-success)' : status === AttendanceStatus.ABSENT ? 'var(--color-error)' : 'var(--color-warning)';
          return (
            <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)', cursor: 'pointer' }} onClick={() => toggleStatus(student.id)}>
              <span className="text-caption" style={{ width: 24, textAlign: 'center' }}>{i + 1}</span>
              <Avatar name={student.name} size={32} />
              <span className="text-body" style={{ flex: 1, fontWeight: 500 }}>{student.name}</span>
              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                {[AttendanceStatus.PRESENT, AttendanceStatus.ABSENT, AttendanceStatus.LATE].map(s => (
                  <button key={s} onClick={e => { e.stopPropagation(); setRecords(prev => ({ ...prev, [student.id]: s })); }}
                    style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', border: `2px solid ${s === status ? (s === AttendanceStatus.PRESENT ? 'var(--color-success)' : s === AttendanceStatus.ABSENT ? 'var(--color-error)' : 'var(--color-warning)') : 'var(--color-border)'}`, background: s === status ? (s === AttendanceStatus.PRESENT ? 'var(--color-success-bg)' : s === AttendanceStatus.ABSENT ? 'var(--color-error-bg)' : 'var(--color-warning-bg)') : 'transparent', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 100ms' }}>
                    {s === AttendanceStatus.PRESENT ? '✓' : s === AttendanceStatus.ABSENT ? '✕' : 'L'}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit */}
      <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="text-body" style={{ fontWeight: 600 }}>{Math.round((presentCount / students.length) * 100)}% Attendance</span>
          <span className="text-body-sm" style={{ marginLeft: 'var(--space-2)' }}>{presentCount}/{students.length} present</span>
        </div>
        <Button variant="primary" size="lg" onClick={() => showToast('Attendance submitted successfully!')}>Submit Attendance</Button>
      </div>
    </div>
  );
}
