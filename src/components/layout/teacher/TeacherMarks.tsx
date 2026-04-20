'use client';

import React, { useState } from 'react';
import { DEMO_STUDENTS, DEMO_TEACHERS, DEMO_MARKS, DEMO_SCHOOL } from '@/lib/demo-data';
import { Select } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Badge, Avatar, Tabs } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';
import { MarksStatus } from '@/types/enums';
import { PlusIcon } from '@/components/ui/Icons';

export default function TeacherMarks() {
  const [activeTab, setActiveTab] = useState('entry');
  const [showAddExam, setShowAddExam] = useState(false);
  const { showToast } = useToast();
  const teacher = DEMO_TEACHERS[0];
  const marks = DEMO_MARKS[0];
  const students = DEMO_STUDENTS.filter(s => s.classId === 'class_005' && s.sectionId === 'sec_5a');

  const [marksData, setMarksData] = useState<Record<string, number>>(
    Object.fromEntries(marks.records.map(r => [r.studentId, r.marksObtained]))
  );

  const handleMarksChange = (studentId: string, value: string) => {
    const num = parseInt(value) || 0;
    setMarksData(prev => ({ ...prev, [studentId]: Math.min(num, marks.maxMarks) }));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Marks & Grades</h2>
          <p className="text-body-sm">Enter and publish student marks</p>
        </div>
        <Button variant="primary" onClick={() => setShowAddExam(true)} icon={<PlusIcon size={20} color="white" />}>New Exam</Button>
      </div>

      <Tabs tabs={[
        { id: 'entry', label: 'Enter Marks' },
        { id: 'published', label: 'Published', count: 1 },
      ]} activeTab={activeTab} onChange={setActiveTab} />

      <div style={{ marginTop: 'var(--space-4)' }}>
        {activeTab === 'entry' && (
          <>
            <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
              <Select options={teacher.assignedClasses.map(ac => ({ value: ac.classId, label: `${ac.className}-${ac.sectionName} (${ac.subjectName})` }))} fullWidth={false} style={{ width: '260px' }} onChange={() => {}} />
              <Select options={[{ value: 'midterm', label: 'Mid-Term 2026' }, { value: 'finals', label: 'Finals 2026' }]} fullWidth={false} style={{ width: '160px' }} onChange={() => {}} />
            </div>

            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)', font: 'var(--text-overline)' }}>
                <span>Student</span><span>Marks ({marks.maxMarks})</span><span>Grade</span><span>%</span>
              </div>
              {students.map(student => {
                const m = marksData[student.id] || 0;
                const pct = Math.round((m / marks.maxMarks) * 100);
                const grade = DEMO_SCHOOL.settings.gradeScale.find(g => pct >= g.min && pct <= g.max)?.grade || 'F';
                return (
                  <div key={student.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: 'var(--space-2) var(--space-4)', borderBottom: '1px solid var(--color-divider)', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Avatar name={student.name} size={28} />
                      <span className="text-body-sm">{student.name}</span>
                    </div>
                    <input type="number" value={m} onChange={e => handleMarksChange(student.id, e.target.value)} min={0} max={marks.maxMarks}
                      style={{ width: 60, height: 32, padding: '0 8px', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', font: 'var(--text-body)', textAlign: 'center', background: 'var(--color-surface-variant)' }} />
                    <Badge variant={pct >= 80 ? 'success' : pct >= 50 ? 'info' : 'error'}>{grade}</Badge>
                    <span className="text-body-sm">{pct}%</span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <Button variant="secondary" onClick={() => showToast('Draft saved!', 'info')}>Save Draft</Button>
              <Button variant="primary" onClick={() => showToast('Marks published successfully!')}>Publish</Button>
            </div>
          </>
        )}

        {activeTab === 'published' && (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div>
                <h3 className="text-h3">{marks.examName}</h3>
                <p className="text-caption">{marks.className}-{marks.sectionName} • {marks.subjectName} • Max: {marks.maxMarks}</p>
              </div>
              <Badge variant="success">Published</Badge>
            </div>
            <div className="divider" />
            {marks.records.map(r => (
              <div key={r.studentId} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-divider)' }}>
                <span className="text-body-sm">{r.studentName}</span>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                  <span className="text-body-sm" style={{ fontWeight: 600 }}>{r.marksObtained}/{marks.maxMarks}</span>
                  <Badge variant={r.marksObtained >= 80 ? 'success' : r.marksObtained >= 50 ? 'info' : 'error'}>{r.grade}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showAddExam} onClose={() => setShowAddExam(false)} title="Create New Exam" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Exam Name" placeholder="e.g. Mid-Term Examination 2026" />
          <Select label="Exam Type" options={[{ value: 'midterm', label: 'Mid-Term' }, { value: 'finals', label: 'Finals' }, { value: 'unit', label: 'Unit Test' }]} placeholder="Select type" />
          <div className="grid-2">
            <Select label="Class-Section" options={teacher.assignedClasses.map(ac => ({ value: ac.classId, label: `${ac.className}-${ac.sectionName}` }))} placeholder="Select class" />
            <Input label="Max Marks" type="number" placeholder="100" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowAddExam(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setShowAddExam(false); showToast('Exam created!'); }}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
