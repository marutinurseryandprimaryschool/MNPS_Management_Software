'use client';

import React from 'react';
import { DEMO_TIMETABLE, DEMO_SCHOOL, DEMO_TEACHERS } from '@/lib/demo-data';
import { DayOfWeek, DAYS_OF_WEEK, DAY_SHORT_LABELS } from '@/types/enums';
import { getSubjectColor, formatTime, getTodayDayOfWeek, getCurrentPeriod } from '@/lib/utils';

export default function TeacherTimetable() {
  const teacher = DEMO_TEACHERS[0];
  const timings = DEMO_SCHOOL.settings.periodTimings;
  const schoolDays = DEMO_SCHOOL.settings.schoolDays;
  const today = getTodayDayOfWeek() as DayOfWeek;
  const currentPeriod = getCurrentPeriod(timings);

  const teacherSlots = DEMO_TIMETABLE.slots.filter(s => s.teacherId === teacher.id);

  const getSlot = (day: DayOfWeek, period: number) => teacherSlots.find(s => s.day === day && s.period === period);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">My Timetable</h2>
          <p className="text-body-sm">{teacherSlots.length} periods per week</p>
        </div>
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'auto', padding: 'var(--space-2)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
          <thead>
            <tr>
              <th style={{ padding: 'var(--space-3) var(--space-3)', textAlign: 'left', font: 'var(--text-overline)', borderBottom: '1px solid var(--color-border)' }}>Time</th>
              {schoolDays.map(day => (
                <th key={day} style={{ padding: 'var(--space-3)', textAlign: 'center', font: 'var(--text-overline)', borderBottom: '1px solid var(--color-border)', background: day === today ? 'var(--color-primary-50)' : 'transparent', borderRadius: day === today ? 'var(--radius-sm) var(--radius-sm) 0 0' : undefined }}>
                  {DAY_SHORT_LABELS[day]} {day === today && '•'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timings.map((timing, idx) => {
              if (timing.type) {
                return (
                  <tr key={idx}>
                    <td colSpan={schoolDays.length + 1} style={{ padding: 'var(--space-2)', textAlign: 'center', font: 'var(--text-caption)', color: 'var(--color-text-tertiary)', background: 'var(--color-surface-variant)' }}>
                      ☕ {timing.label}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={idx}>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-divider)', minWidth: 70 }}>
                    <div className="text-body-sm" style={{ fontWeight: 600 }}>P{timing.period}</div>
                    <div className="text-caption">{formatTime(timing.start)}</div>
                  </td>
                  {schoolDays.map(day => {
                    const slot = getSlot(day, timing.period!);
                    const isCurrent = day === today && timing.period === currentPeriod;
                    if (!slot) {
                      return <td key={day} style={{ padding: 'var(--space-1)', borderBottom: '1px solid var(--color-divider)', textAlign: 'center', background: day === today ? 'var(--color-primary-50)' : undefined, opacity: 0.5 }}><span className="text-caption">—</span></td>;
                    }
                    const colors = getSubjectColor(slot.subjectName);
                    return (
                      <td key={day} style={{ padding: 'var(--space-1)', borderBottom: '1px solid var(--color-divider)', background: day === today ? 'var(--color-primary-50)' : undefined }}>
                        <div style={{ background: colors.bg, borderRadius: 'var(--radius-sm)', padding: 'var(--space-2)', borderLeft: `3px solid ${colors.color}`, position: 'relative' }}>
                          <div style={{ font: 'var(--text-body-sm)', fontWeight: 500, color: colors.color }}>{slot.subjectName}</div>
                          <div className="text-caption">Class 5-A</div>
                          {isCurrent && <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} className="animate-pulse-dot" />}
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
    </div>
  );
}
