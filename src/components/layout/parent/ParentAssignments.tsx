'use client';

import React from 'react';
import { DEMO_ASSIGNMENTS } from '@/lib/demo-data';
import { Badge } from '@/components/ui/SharedUI';
import { formatDate, getSubjectColor } from '@/lib/utils';
import { BookOpenIcon, UserIcon, CalendarIcon } from '@/components/ui/Icons';

export default function ParentAssignments() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Assignments</h2>
        <p className="text-body-sm">{DEMO_ASSIGNMENTS.length} active</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {DEMO_ASSIGNMENTS.map(assignment => {
          const colors = getSubjectColor(assignment.subjectName || '');
          const daysLeft = Math.ceil((assignment.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

          return (
            <div key={assignment.id} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', borderLeft: `4px solid ${colors.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 className="text-h3">{assignment.title}</h3>
                  <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>{assignment.description}</p>
                </div>
                <Badge variant={daysLeft <= 2 ? 'error' : daysLeft <= 5 ? 'warning' : 'success'}>
                  {daysLeft > 0 ? `${daysLeft}d left` : 'Overdue'}
                </Badge>
              </div>
              <div className="divider" />
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <span className="text-caption" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}><BookOpenIcon size={14} /> {assignment.subjectName}</span>
                <span className="text-caption" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}><UserIcon size={14} /> {assignment.teacherName}</span>
                <span className="text-caption" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}><CalendarIcon size={14} /> Due: {formatDate(assignment.dueDate)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
