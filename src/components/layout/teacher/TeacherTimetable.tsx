'use client';

import React, { useState, useEffect } from 'react';
import { TimetablesService, TeachersService } from '@/lib/firestore-service';
import { formatTime, getUpcomingSaturday, toDateKey, getEffectiveSaturdaySlots } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { DAY_SHORT_LABELS, DayOfWeek } from '@/types/enums';
import { CalendarIcon } from '@/components/ui/Icons';
import type { Teacher, Timetable, TimetableSlot, PeriodTiming } from '@/types/models';

// Map JS getDay() to DayOfWeek enum
const JS_DAY_MAP: Record<number, DayOfWeek> = {
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

// Color palette for subjects
const SUBJECT_COLORS = [
  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },   // Blue
  { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' },   // Green
  { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },   // Orange
  { bg: '#FAF5FF', border: '#E9D5FF', text: '#7C3AED' },   // Purple
  { bg: '#FDF2F8', border: '#FBCFE8', text: '#BE185D' },   // Pink
  { bg: '#ECFDF5', border: '#A7F3D0', text: '#059669' },   // Emerald
  { bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' },   // Amber
  { bg: '#F0F9FF', border: '#BAE6FD', text: '#0369A1' },   // Sky
  { bg: '#FFF1F2', border: '#FECDD3', text: '#BE123C' },   // Rose
  { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' },   // Violet
];

export default function TeacherTimetable() {
  const { user } = useAuth();
  const { school } = useSchool();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(true);

  const todayEnum = JS_DAY_MAP[new Date().getDay()] || null;

  useEffect(() => {
    async function fetchData() {
      try {
        if (!user || !school?.academicYear) return;
        let teacherData = await TeachersService.getByUserId(user.uid || user.id, school.academicYear);
        if (!teacherData && user.email) {
          teacherData = await TeachersService.getByEmail(user.email, school.academicYear);
        }
        setTeacher(teacherData as unknown as Teacher | null);
        const allTimetables = await TimetablesService.getAll(school.academicYear);
        setTimetables(allTimetables as unknown as Timetable[]);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, school?.academicYear]);

  const satDate = React.useMemo(() => getUpcomingSaturday(new Date()), []);
  const satDateKey = React.useMemo(() => toDateKey(satDate), [satDate]);

  const mySlots: TimetableSlot[] = [];
  if (teacher) {
    for (const tt of timetables) {
      // Mon–Fri (and any non-Saturday day) come straight from the recurring plan
      for (const slot of (tt.slots || [])) {
        if (slot.day === DayOfWeek.SATURDAY) continue;
        if (slot.teacherId === teacher.id) {
          mySlots.push(slot);
        }
      }
      // Saturday uses the per-date override when present, else the recurring Sat slots
      const effectiveSat = getEffectiveSaturdaySlots(tt, satDateKey);
      for (const slot of effectiveSat.slots) {
        if (slot.teacherId === teacher.id) {
          mySlots.push(slot);
        }
      }
    }
  }

  // Build a unique subject → color map from the slots
  const subjectColorMap = new Map<string, typeof SUBJECT_COLORS[0]>();
  const uniqueSubjects: string[] = [];
  mySlots.forEach(s => {
    if (!uniqueSubjects.includes(s.subjectId)) uniqueSubjects.push(s.subjectId);
  });
  uniqueSubjects.forEach((id, i) => subjectColorMap.set(id, SUBJECT_COLORS[i % SUBJECT_COLORS.length]));

  const days = (school.settings?.schoolDays || []) as DayOfWeek[];
  const rawTimings = school.settings?.periodTimings || [];
  // Fall back to plain numbered periods when no custom timings are configured,
  // otherwise the grid renders no rows even when slots exist.
  const periodsPerDay = school.settings?.periodsPerDay || 8;
  const timings: PeriodTiming[] = rawTimings.length > 0
    ? rawTimings
    : Array.from({ length: periodsPerDay }, (_, i) => ({ period: i + 1, start: '', end: '' }));

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading timetable...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">My Timetable</h2>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {mySlots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-full)', background: 'var(--color-primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
            <CalendarIcon size={28} />
          </div>
          <p className="text-body" style={{ fontWeight: 500 }}>No timetable assigned yet</p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Your admin will assign your timetable soon.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'auto', border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: days.length * 140 + 80 }}>
            <thead>
              <tr>
                <th style={{
                  width: 80, padding: 'var(--space-3)', background: 'var(--color-surface-variant)',
                  borderBottom: '2px solid var(--color-border)', textAlign: 'center',
                  fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: 'var(--color-text-tertiary)',
                }}>Period</th>
                {days.map(day => {
                  const isToday = day === todayEnum;
                  const isSaturday = day === DayOfWeek.SATURDAY;
                  return (
                    <th key={day} style={{
                      padding: 'var(--space-3)', textAlign: 'center', fontWeight: 700,
                      borderBottom: '2px solid var(--color-border)',
                      borderLeft: isSaturday ? '4px double var(--color-border)' : undefined,
                      background: isToday ? 'rgba(220, 38, 38, 0.08)' : 'var(--color-surface-variant)',
                      color: isToday ? 'var(--color-primary-600)' : 'var(--color-text-primary)',
                      fontSize: '0.85rem',
                    }}>
                      <div>{DAY_SHORT_LABELS[day]}</div>
                      {isToday && (
                        <span style={{
                          display: 'inline-block', marginTop: 2,
                          padding: '1px 8px', borderRadius: 'var(--radius-full)',
                          background: 'var(--color-primary-500)', color: 'white',
                          fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em',
                        }}>TODAY</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {timings.map(timing => {
                // Break/Lunch row
                if (timing.type) {
                  return (
                    <tr key={timing.label}>
                      <td colSpan={days.length + 1} style={{
                        padding: 'var(--space-2)', textAlign: 'center',
                        background: timing.type === 'lunch' ? '#FEF3C7' : '#F0F9FF',
                        fontWeight: 600, fontSize: '0.75rem',
                        color: timing.type === 'lunch' ? '#B45309' : '#0369A1',
                        borderBottom: '1px solid var(--color-divider)',
                      }}>
                        {timing.label} ({formatTime(timing.start)} – {formatTime(timing.end)})
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={timing.period}>
                    {/* Period label */}
                    <td style={{
                      padding: 'var(--space-2)', textAlign: 'center',
                      borderBottom: '1px solid var(--color-divider)',
                      borderRight: '1px solid var(--color-divider)',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-primary-600)' }}>P{timing.period}</div>
                      {timing.start && timing.end && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-tertiary)' }}>{formatTime(timing.start)}–{formatTime(timing.end)}</div>
                      )}
                    </td>

                    {days.map(day => {
                      const slot = mySlots.find(s => s.day === day && s.period === timing.period);
                      const isToday = day === todayEnum;
                      const isSaturday = day === DayOfWeek.SATURDAY;
                      const color = slot ? subjectColorMap.get(slot.subjectId) : null;

                      return (
                        <td key={day} style={{
                          padding: 4,
                          borderBottom: '1px solid var(--color-divider)',
                          borderRight: '1px solid var(--color-divider)',
                          borderLeft: isSaturday ? '4px double var(--color-border)' : undefined,
                          verticalAlign: 'top', height: 64,
                          background: isToday
                            ? 'rgba(220, 38, 38, 0.04)'
                            : isSaturday
                              ? 'rgba(99, 102, 241, 0.04)'
                              : 'transparent',
                        }}>
                          {slot ? (
                            <div style={{
                              padding: '8px 10px', borderRadius: 'var(--radius-md)',
                              background: color?.bg || '#F3F4F6',
                              height: '100%',
                            }}>
                              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: color?.text || '#374151', lineHeight: 1.3 }}>
                                {slot.subjectName}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: color?.text || '#6B7280', opacity: 0.7, marginTop: 2 }}>
                                {slot.teacherName}
                              </div>
                            </div>
                          ) : (
                            <div style={{
                              height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)',
                              opacity: 0.4,
                            }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>Free</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
