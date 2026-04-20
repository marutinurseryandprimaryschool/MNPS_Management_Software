import { TimetableSlot, ScheduleConflict, Teacher } from '@/types/models';
import { ConflictType, ConflictSeverity, DayOfWeek } from '@/types/enums';

/* ============================================
   CampusOS — Scheduling Engine
   Conflict detection & teacher suggestion
   ============================================ */

interface TimetableData {
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  slots: TimetableSlot[];
}

/**
 * Pass 1: Check teacher availability
 */
function checkTeacherAvailability(
  timetable: TimetableData,
  teachers: Teacher[]
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (const slot of timetable.slots) {
    if (!slot.teacherId) continue;
    const teacher = teachers.find(t => t.id === slot.teacherId);
    if (!teacher) continue;

    const dayAvailability = teacher.availability?.[slot.day];
    if (dayAvailability && dayAvailability[slot.period] === false) {
      conflicts.push({
        type: ConflictType.TEACHER_UNAVAILABLE,
        severity: ConflictSeverity.ERROR,
        slot,
        teacher: slot.teacherName,
        day: slot.day,
        period: slot.period,
        message: `${slot.teacherName} is unavailable on ${slot.day} Period ${slot.period}`,
        fix: 'Choose a different teacher or change the slot',
      });
    }
  }

  return conflicts;
}

/**
 * Pass 2: Check teacher double-booking across ALL timetables
 */
function checkDoubleBooking(
  allTimetables: TimetableData[]
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const teacherSlotMap: Record<string, { classSection: string; slot: TimetableSlot }[]> = {};

  for (const tt of allTimetables) {
    for (const slot of tt.slots) {
      if (!slot.teacherId) continue;
      const key = `${slot.teacherId}-${slot.day}-${slot.period}`;
      if (!teacherSlotMap[key]) teacherSlotMap[key] = [];
      teacherSlotMap[key].push({
        classSection: `${tt.className}-${tt.sectionName}`,
        slot,
      });
    }
  }

  for (const [, entries] of Object.entries(teacherSlotMap)) {
    if (entries.length > 1) {
      const first = entries[0];
      const second = entries[1];
      conflicts.push({
        type: ConflictType.TEACHER_DOUBLE_BOOKED,
        severity: ConflictSeverity.ERROR,
        teacher: first.slot.teacherName,
        day: first.slot.day,
        period: first.slot.period,
        message: `${first.slot.teacherName} is assigned to ${first.classSection} and ${second.classSection} on ${first.slot.day} Period ${first.slot.period}`,
        fix: 'Remove teacher from one of the slots',
      });
    }
  }

  return conflicts;
}

/**
 * Pass 3: Class integrity checks
 */
function checkClassIntegrity(
  timetable: TimetableData,
  schoolDays: DayOfWeek[],
  periodsPerDay: number,
  breakPeriods: number[] = []
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Check for empty slots
  for (const day of schoolDays) {
    for (let period = 1; period <= periodsPerDay; period++) {
      if (breakPeriods.includes(period)) continue;
      
      const hasSlot = timetable.slots.some(
        s => s.day === day && s.period === period && s.subjectId
      );

      if (!hasSlot) {
        conflicts.push({
          type: ConflictType.EMPTY_SLOT,
          severity: ConflictSeverity.WARNING,
          day,
          period,
          message: `No subject assigned for ${day} Period ${period}`,
          fix: 'Assign a subject and teacher',
        });
      }
    }

    // Check subject overload (same subject > 2 times per day)
    const subjectCount: Record<string, number> = {};
    for (const slot of timetable.slots.filter(s => s.day === day)) {
      if (slot.subjectId) {
        subjectCount[slot.subjectName] = (subjectCount[slot.subjectName] || 0) + 1;
      }
    }

    for (const [subject, count] of Object.entries(subjectCount)) {
      if (count > 2) {
        conflicts.push({
          type: ConflictType.SUBJECT_OVERLOAD,
          severity: ConflictSeverity.WARNING,
          day,
          message: `${subject} appears ${count} times on ${day} (max: 2)`,
          fix: 'Redistribute subject across the week',
        });
      }
    }
  }

  return conflicts;
}

/**
 * Full validation: Run all 3 passes
 */
export function validateTimetable(
  timetable: TimetableData,
  allTimetables: TimetableData[],
  teachers: Teacher[],
  schoolDays: DayOfWeek[],
  periodsPerDay: number,
  breakPeriods: number[] = []
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [
    ...checkTeacherAvailability(timetable, teachers),
    ...checkDoubleBooking(allTimetables),
    ...checkClassIntegrity(timetable, schoolDays, periodsPerDay, breakPeriods),
  ];

  return conflicts;
}

/**
 * Check if a specific slot has conflicts
 */
export function checkSlotConflict(
  teacherId: string,
  day: DayOfWeek,
  period: number,
  allTimetables: TimetableData[],
  teachers: Teacher[],
  excludeClassSection?: { classId: string; sectionId: string }
): ScheduleConflict | null {
  const teacher = teachers.find(t => t.id === teacherId);
  if (!teacher) return null;

  // Check availability
  const dayAvailability = teacher.availability?.[day];
  if (dayAvailability && dayAvailability[period] === false) {
    return {
      type: ConflictType.TEACHER_UNAVAILABLE,
      severity: ConflictSeverity.ERROR,
      teacher: teacher.name,
      day,
      period,
      message: `${teacher.name} is unavailable on ${day} Period ${period}`,
      fix: 'Choose a different teacher',
    };
  }

  // Check double booking
  for (const tt of allTimetables) {
    if (excludeClassSection && 
        tt.classId === excludeClassSection.classId && 
        tt.sectionId === excludeClassSection.sectionId) {
      continue;
    }

    const existingSlot = tt.slots.find(
      s => s.day === day && s.period === period && s.teacherId === teacherId
    );

    if (existingSlot) {
      return {
        type: ConflictType.TEACHER_DOUBLE_BOOKED,
        severity: ConflictSeverity.ERROR,
        teacher: teacher.name,
        day,
        period,
        message: `${teacher.name} is already assigned to ${tt.className}-${tt.sectionName} in this slot`,
        fix: 'Remove teacher from the other slot first',
      };
    }
  }

  return null;
}

/**
 * Auto-suggest teachers for a slot
 */
export function suggestTeachers(
  subjectId: string,
  day: DayOfWeek,
  period: number,
  classId: string,
  sectionId: string,
  teachers: Teacher[],
  allTimetables: TimetableData[],
  maxPeriodsPerDay: number = 6
): {
  teacher: Teacher;
  score: number;
  available: boolean;
  periodsToday: number;
  status: 'available' | 'nearing_limit' | 'at_limit';
}[] {
  // Filter candidates who can teach this subject
  const candidates = teachers.filter(t => 
    t.subjects.includes(subjectId) && t.status === 'active'
  );

  return candidates
    .map(teacher => {
      // Check availability
      const dayAvailability = teacher.availability?.[day];
      const isAvailable = !dayAvailability || dayAvailability[period] !== false;

      // Check double booking
      const isDoubleBooked = allTimetables.some(tt => 
        !(tt.classId === classId && tt.sectionId === sectionId) &&
        tt.slots.some(s => s.day === day && s.period === period && s.teacherId === teacher.id)
      );

      if (!isAvailable || isDoubleBooked) {
        return null;
      }

      // Calculate score
      let score = 0;

      // Already assigned to this class-section (continuity bonus)
      const currentTT = allTimetables.find(
        tt => tt.classId === classId && tt.sectionId === sectionId
      );
      if (currentTT?.slots.some(s => s.teacherId === teacher.id)) {
        score += 10;
      }

      // Count periods today across all timetables
      let periodsToday = 0;
      for (const tt of allTimetables) {
        periodsToday += tt.slots.filter(
          s => s.day === day && s.teacherId === teacher.id
        ).length;
      }

      // Fewest periods today (workload balance)
      score += (maxPeriodsPerDay - periodsToday) * 5;

      // No consecutive periods
      const hasPrevPeriod = allTimetables.some(tt =>
        tt.slots.some(s => s.day === day && s.period === period - 1 && s.teacherId === teacher.id)
      );
      const hasNextPeriod = allTimetables.some(tt =>
        tt.slots.some(s => s.day === day && s.period === period + 1 && s.teacherId === teacher.id)
      );
      if (!hasPrevPeriod && !hasNextPeriod) {
        score += 3;
      }

      // Determine status
      let status: 'available' | 'nearing_limit' | 'at_limit' = 'available';
      if (periodsToday >= maxPeriodsPerDay) {
        status = 'at_limit';
      } else if (periodsToday >= maxPeriodsPerDay - 1) {
        status = 'nearing_limit';
      }

      return {
        teacher,
        score,
        available: true,
        periodsToday,
        status,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score) as {
      teacher: Teacher;
      score: number;
      available: boolean;
      periodsToday: number;
      status: 'available' | 'nearing_limit' | 'at_limit';
    }[];
}
