'use client';

import React from 'react';
import { DataCard, AlertCard } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { DEMO_TEACHERS, DEMO_TIMETABLE, DEMO_SCHOOL, DEMO_ASSIGNMENTS, DEMO_CHATS } from '@/lib/demo-data';
import { getGreeting, formatTime, getSubjectColor, getTodayDayOfWeek, getCurrentPeriod } from '@/lib/utils';
import { DayOfWeek } from '@/types/enums';
import { CalendarIcon, ClipboardCheckIcon, BookOpenIcon, MessageCircleIcon, UsersIcon } from '@/components/ui/Icons';

export default function TeacherDashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { user } = useAuth();
  const teacher = DEMO_TEACHERS[0];
  const today = getTodayDayOfWeek() as DayOfWeek;
  const todaySlots = DEMO_TIMETABLE.slots.filter(s => s.day === today && s.teacherId === teacher.id);
  const currentPeriod = getCurrentPeriod(DEMO_SCHOOL.settings.periodTimings);
  const currentSlot = todaySlots.find(s => s.period === currentPeriod);
  const nextSlot = todaySlots.find(s => s.period === (currentPeriod || 0) + 1);

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 className="text-h1">{getGreeting()}, {user?.name?.split(' ')[0]} 👋</h2>
        <p className="text-body-sm" style={{ marginTop: 'var(--space-1)' }}>
          {teacher.assignedClasses.length} classes assigned • {todaySlots.length} periods today
        </p>
      </div>

      {/* Current / Next Period Alert */}
      {currentSlot && (
        <AlertCard type="info" title={`Current: ${currentSlot.subjectName}`} message={`Class 5-A • Period ${currentSlot.period}`} action="Mark Attendance" onAction={() => onNavigate('attendance')} className="mb-4" />
      )}
      {nextSlot && !currentSlot && (
        <AlertCard type="success" title={`Next: ${nextSlot.subjectName}`} message={`Class 5-A • Period ${nextSlot.period}`} className="mb-4" />
      )}

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        <DataCard icon={<CalendarIcon size={22} />} value={todaySlots.length} label="Today's Periods" color="var(--color-primary-500)" onClick={() => onNavigate('timetable')} />
        <DataCard icon={<ClipboardCheckIcon size={22} />} value={1} label="Pending Attendance" color="var(--color-warning)" onClick={() => onNavigate('attendance')} />
        <DataCard icon={<BookOpenIcon size={22} />} value={DEMO_ASSIGNMENTS.filter(a => a.teacherId === teacher.id).length} label="Active Assignments" color="var(--color-info)" onClick={() => onNavigate('assignments')} />
        <DataCard icon={<MessageCircleIcon size={22} />} value={2} label="Unread Messages" color="var(--color-error)" onClick={() => onNavigate('chat')} />
      </div>

      {/* Today's Schedule */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <CalendarIcon size={18} />
          <h3 className="text-h3">Today&apos;s Schedule</h3>
        </div>
        {todaySlots.length === 0 ? (
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', padding: 'var(--space-4)', textAlign: 'center' }}>No classes today! 🎉</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {DEMO_SCHOOL.settings.periodTimings.map((timing, i) => {
              if (timing.type === 'break' || timing.type === 'lunch') {
                return (
                  <div key={i} style={{ textAlign: 'center', padding: 'var(--space-1)', font: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>
                    ☕ {timing.label}
                  </div>
                );
              }
              const slot = todaySlots.find(s => s.period === timing.period);
              if (!slot) {
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', opacity: 0.5 }}>
                    <span className="text-caption" style={{ width: 50 }}>P{timing.period}</span>
                    <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Free Period</span>
                  </div>
                );
              }
              const colors = getSubjectColor(slot.subjectName);
              const isCurrent = slot.period === currentPeriod;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', background: isCurrent ? colors.bg : 'transparent', borderLeft: isCurrent ? `3px solid ${colors.color}` : '3px solid transparent', transition: 'all 200ms' }}>
                  <span className="text-caption" style={{ width: 50 }}>{formatTime(timing.start)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: 'var(--text-body)', fontWeight: 500, color: colors.color }}>{slot.subjectName}</div>
                    <div className="text-caption">Class 5-A</div>
                  </div>
                  {isCurrent && <span style={{ fontSize: '0.625rem', padding: '2px 8px', background: colors.color, color: 'white', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>NOW</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assigned Classes */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <UsersIcon size={18} />
          <h3 className="text-h3">My Classes</h3>
        </div>
        <div className="grid-3">
          {teacher.assignedClasses.map((ac, i) => (
            <div key={i} style={{ padding: 'var(--space-3)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
              <div style={{ font: 'var(--text-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{ac.className}-{ac.sectionName}</div>
              <div className="text-caption">{ac.subjectName}</div>
              {ac.isClassTeacher && <span style={{ fontSize: '0.625rem', padding: '1px 6px', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderRadius: 'var(--radius-full)', fontWeight: 600, marginTop: 4, display: 'inline-block' }}>Class Teacher</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
