'use client';

import React from 'react';
import { DEMO_MARKS, DEMO_SCHOOL } from '@/lib/demo-data';
import { Badge } from '@/components/ui/SharedUI';
import { DataCard } from '@/components/ui/Card';

export default function ParentMarks() {
  const marks = DEMO_MARKS[0];
  const childMarks = marks.records[0]; // demo: first student's marks

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Marks & Grades</h2>
      </div>

      <div className="grid-3" style={{ marginBottom: 'var(--space-4)' }}>
        <DataCard icon="📝" value={childMarks?.grade || 'B+'} label="Avg Grade" color="var(--color-info)" />
        <DataCard icon="📊" value={`${childMarks?.marksObtained || 0}/${marks.maxMarks}`} label="Last Exam" color="var(--color-primary-500)" />
        <DataCard icon="🏆" value="5th" label="Class Rank" color="var(--color-warning)" />
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
          <h3 className="text-h3">{marks.examName}</h3>
          <p className="text-caption">{marks.subjectName} • Max Marks: {marks.maxMarks}</p>
        </div>
        <div style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <span className="text-display" style={{ color: 'var(--color-primary-500)' }}>{childMarks?.marksObtained}</span>
              <span className="text-h2" style={{ color: 'var(--color-text-tertiary)' }}>/{marks.maxMarks}</span>
            </div>
            <Badge variant="success" size="md">{childMarks?.grade}</Badge>
          </div>
          <div className="divider" />
          <h4 className="text-overline" style={{ marginBottom: 'var(--space-2)' }}>All Subjects</h4>
          {['Mathematics', 'English', 'Science', 'Hindi', 'Social Studies'].map((sub, i) => {
            const m = 60 + Math.floor(Math.random() * 35);
            const grade = DEMO_SCHOOL.settings.gradeScale.find(g => m >= g.min && m <= g.max)?.grade || 'C';
            return (
              <div key={sub} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-divider)' }}>
                <span className="text-body-sm">{sub}</span>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                  <span className="text-body-sm" style={{ fontWeight: 600 }}>{m}/100</span>
                  <Badge variant={m >= 80 ? 'success' : m >= 50 ? 'info' : 'error'}>{grade}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
