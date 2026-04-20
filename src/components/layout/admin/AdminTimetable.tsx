'use client';

import React, { useState } from 'react';
import { DEMO_TIMETABLE, DEMO_CLASSES, DEMO_TEACHERS, DEMO_SCHOOL } from '@/lib/demo-data';
import { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/SharedUI';
import { DayOfWeek, DAYS_OF_WEEK, DAY_SHORT_LABELS } from '@/types/enums';
import { getSubjectColor, formatTime } from '@/lib/utils';

export default function AdminTimetable() {
  const [selectedClass, setSelectedClass] = useState('class_005');
  const [selectedSection, setSelectedSection] = useState('sec_5a');

  const timetable = DEMO_TIMETABLE;
  const timings = DEMO_SCHOOL.settings.periodTimings;
  const schoolDays = DEMO_SCHOOL.settings.schoolDays;

  const getSlot = (day: DayOfWeek, period: number) => {
    return timetable.slots.find(s => s.day === day && s.period === period);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Timetable</h2>
          <p className="text-body-sm">Academic Year: 2026-27</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Badge variant="success">Published</Badge>
        </div>
      </div>

      {/* Class/Section Filter */}
      <div className="flex gap-3 mb-4">
        <Select options={DEMO_CLASSES.map(c => ({ value: c.id, label: c.name }))} value={selectedClass} onChange={e => setSelectedClass(e.target.value)} fullWidth={false} style={{ width: '140px' }} />
        <Select options={[{ value: 'sec_5a', label: 'Section A' }, { value: 'sec_5b', label: 'Section B' }]} value={selectedSection} onChange={e => setSelectedSection(e.target.value)} fullWidth={false} style={{ width: '140px' }} />
      </div>

      {/* Timetable Grid */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
          <thead>
            <tr>
              <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)', font: 'var(--text-overline)', position: 'sticky', left: 0, zIndex: 1 }}>
                Period / Day
              </th>
              {schoolDays.map(day => (
                <th key={day} style={{ padding: 'var(--space-3)', textAlign: 'center', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)', font: 'var(--text-overline)' }}>
                  {DAY_SHORT_LABELS[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timings.map((timing, idx) => {
              if (timing.type === 'break' || timing.type === 'lunch') {
                return (
                  <tr key={idx}>
                    <td colSpan={schoolDays.length + 1} style={{ padding: 'var(--space-2) var(--space-4)', background: 'var(--color-surface-variant)', textAlign: 'center', font: 'var(--text-caption)', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
                      ☕ {timing.label} ({formatTime(timing.start)} – {formatTime(timing.end)})
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={idx}>
                  <td style={{ padding: 'var(--space-2) var(--space-4)', borderBottom: '1px solid var(--color-divider)', position: 'sticky', left: 0, background: 'var(--color-surface)', zIndex: 1, minWidth: '80px' }}>
                    <div style={{ font: 'var(--text-body-sm)', fontWeight: 600 }}>P{timing.period}</div>
                    <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>{formatTime(timing.start)}</div>
                  </td>
                  {schoolDays.map(day => {
                    const slot = getSlot(day, timing.period!);
                    if (!slot) {
                      return (
                        <td key={day} style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--color-divider)', textAlign: 'center' }}>
                          <div style={{ color: 'var(--color-text-tertiary)', font: 'var(--text-caption)' }}>—</div>
                        </td>
                      );
                    }
                    const colors = getSubjectColor(slot.subjectName);
                    return (
                      <td key={day} style={{ padding: 'var(--space-1)', borderBottom: '1px solid var(--color-divider)' }}>
                        <div style={{ background: colors.bg, borderRadius: 'var(--radius-sm)', padding: 'var(--space-2)', borderLeft: `3px solid ${colors.color}`, minHeight: '48px', cursor: 'pointer', transition: 'all 100ms' }}>
                          <div style={{ font: 'var(--text-body-sm)', fontWeight: 600, color: colors.color }}>{slot.subjectName}</div>
                          <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>{slot.teacherName.split(' ')[0]}</div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        {['Mathematics', 'English', 'Science', 'Hindi', 'Social Studies', 'Computer Science', 'Physical Education', 'Art'].map(sub => {
          const colors = getSubjectColor(sub);
          return (
            <div key={sub} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: colors.color }} />
              <span className="text-caption">{sub}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
