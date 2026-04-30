'use client';

import React, { useState, useEffect } from 'react';
import { DataCard, ActionCard } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { TeachersService, TimetablesService, AssignmentsService } from '@/lib/firestore-service';
import { useSchool } from '@/context/SchoolContext';
import { getGreeting } from '@/lib/utils';
import { DayOfWeek } from '@/types/enums';
import {
  CalendarIcon, ClipboardCheckIcon, BookOpenIcon,
  FileTextIcon, ZapIcon
} from '@/components/ui/Icons';
import type { Teacher, TimetableSlot, Timetable } from '@/types/models';

// Map JS getDay() (0=Sun, 1=Mon, ..., 6=Sat) to DayOfWeek enum
const JS_DAY_MAP: Record<number, DayOfWeek> = {
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

export default function TeacherDashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { user } = useAuth();
  const { school } = useSchool();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [todaySlots, setTodaySlots] = useState<TimetableSlot[]>([]);
  const [assignedClassCount, setAssignedClassCount] = useState(0);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        if (!user) return;
        // Try by userId first, then fall back to email
        let teacherData = await TeachersService.getByUserId(user.uid || user.id);
        if (!teacherData && user.email) {
          teacherData = await TeachersService.getByEmail(user.email);
        }
        setTeacher(teacherData as unknown as Teacher | null);

        if (teacherData) {
          const td = teacherData as unknown as Teacher;

          // Fetch timetables and find today's slots + unique assigned classes
          const allTimetables = await TimetablesService.getAll();
          const timetables = allTimetables as unknown as Timetable[];
          const todayEnum = JS_DAY_MAP[new Date().getDay()];
          const myTodaySlots: TimetableSlot[] = [];
          const uniqueClassIds = new Set<string>();

          timetables.forEach(tt => {
            let teacherInThisTimetable = false;
            (tt.slots || []).forEach(slot => {
              if (slot.teacherId === td.id) {
                teacherInThisTimetable = true;
                if (todayEnum && slot.day === todayEnum) {
                  myTodaySlots.push(slot);
                }
              }
            });
            if (teacherInThisTimetable) {
              uniqueClassIds.add(tt.classId);
            }
          });

          setTodaySlots(myTodaySlots);
          setAssignedClassCount(uniqueClassIds.size);

          const assignments = await AssignmentsService.getByTeacher(td.id);
          setAssignmentCount(assignments.length);
        }

      } catch (error) {
        console.error('Error fetching teacher dashboard:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading dashboard...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 className="text-h1">{getGreeting()}, {user?.name?.split(' ')[0]}</h2>
        <p className="text-body-sm" style={{ marginTop: 'var(--space-1)' }}>{school.name}</p>
      </div>

      <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        <DataCard icon={<CalendarIcon size={22} />} value={assignedClassCount} label="Assigned Classes" color="var(--color-primary-500)" onClick={() => onNavigate('timetable')} />
        <DataCard icon={<ClipboardCheckIcon size={22} />} value={todaySlots.length} label="Today's Periods" color="var(--color-info)" onClick={() => onNavigate('timetable')} />
        <DataCard icon={<BookOpenIcon size={22} />} value={assignmentCount} label="Assignments" color="var(--color-warning)" onClick={() => onNavigate('assignments')} />

      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <ZapIcon size={18} />
          <h3 className="text-h3">Quick Actions</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <ActionCard icon={<ClipboardCheckIcon size={18} />} title="Take Attendance" description="Mark today's attendance" onClick={() => onNavigate('attendance')} />

          <ActionCard icon={<BookOpenIcon size={18} />} title="Create Assignment" description="Assign work to students" onClick={() => onNavigate('assignments')} />
        </div>
      </div>
    </div>
  );
}
