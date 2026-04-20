'use client';

import React, { useState } from 'react';
import { DEMO_ASSIGNMENTS, DEMO_TEACHERS, DEMO_CLASSES } from '@/lib/demo-data';
import Button, { FAB } from '@/components/ui/Button';
import { Badge } from '@/components/ui/SharedUI';
import Modal from '@/components/ui/Modal';
import Input, { Textarea, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { formatDate, getSubjectColor } from '@/lib/utils';

export default function TeacherAssignments() {
  const [showAdd, setShowAdd] = useState(false);
  const { showToast } = useToast();
  const teacher = DEMO_TEACHERS[0];
  const assignments = DEMO_ASSIGNMENTS.filter(a => a.teacherId === teacher.id);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Assignments</h2>
          <p className="text-body-sm">{assignments.length} active assignments</p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)} icon={<span>+</span>}>New Assignment</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {DEMO_ASSIGNMENTS.map(assignment => {
          const colors = getSubjectColor(assignment.subjectName || '');
          const daysLeft = Math.ceil((assignment.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          
          return (
            <div key={assignment.id} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', borderLeft: `4px solid ${colors.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 className="text-h3">{assignment.title}</h3>
                  <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>{assignment.description}</p>
                </div>
                <Badge variant={daysLeft <= 2 ? 'error' : daysLeft <= 5 ? 'warning' : 'success'}>
                  {daysLeft > 0 ? `${daysLeft}d left` : 'Overdue'}
                </Badge>
              </div>
              <div className="divider" />
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <span className="text-caption">📚 {assignment.subjectName}</span>
                <span className="text-caption">🏫 {assignment.className}-{assignment.sectionName}</span>
                <span className="text-caption">📅 Due: {formatDate(assignment.dueDate)}</span>
                <span className="text-caption">👤 {assignment.teacherName}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Assignment" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Title" placeholder="Assignment title" />
          <Textarea label="Description" placeholder="Assignment instructions" rows={3} />
          <div className="grid-2">
            <Select label="Class-Section" options={teacher.assignedClasses.map(ac => ({ value: `${ac.classId}-${ac.sectionId}`, label: `${ac.className}-${ac.sectionName} (${ac.subjectName})` }))} placeholder="Select class" />
            <Input label="Due Date" type="date" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setShowAdd(false); showToast('Assignment created!'); }}>Create</Button>
          </div>
        </div>
      </Modal>

      <FAB icon={<span style={{ fontSize: '1.5rem' }}>+</span>} onClick={() => setShowAdd(true)} label="New Assignment" />
    </div>
  );
}
