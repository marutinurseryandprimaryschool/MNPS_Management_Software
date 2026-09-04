'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing untyped Firestore data handling in this legacy screen; typed migration tracked separately. */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TimetablesService, ClassesService, TeachersService } from '@/lib/firestore-service';
import { formatTime, getUpcomingSaturday, toDateKey } from '@/lib/utils';
import { useSchool } from '@/context/SchoolContext';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { DAYS_OF_WEEK, DAY_SHORT_LABELS, TimetableStatus, DayOfWeek } from '@/types/enums';
import { CalendarIcon, PlusIcon } from '@/components/ui/Icons';
import {
  findTeacherConflict, isTeacherValidForSlot, resolveAssignedTeacher, resolveEligibleTeachers,
  type BookedSlot, type TeacherLike,
} from '@/lib/timetable-teachers';
import {
  assignmentsForSection, buildAssignmentIndex, eligibleTeachersForSubject,
  type AssignmentDoc, type SubjectAssignment, type TeacherRecord,
} from '@/lib/subject-assignments';
import type { Class, Teacher, Timetable, TimetableSlot, Subject, PeriodTiming, SaturdayOverride } from '@/types/models';

// ── Color palette for subjects ──
const SUBJECT_COLORS = [
  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
  { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' },
  { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },
  { bg: '#FAF5FF', border: '#E9D5FF', text: '#7C3AED' },
  { bg: '#FDF2F8', border: '#FBCFE8', text: '#BE185D' },
  { bg: '#ECFDF5', border: '#A7F3D0', text: '#059669' },
  { bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' },
  { bg: '#F0F9FF', border: '#BAE6FD', text: '#0369A1' },
  { bg: '#FFF1F2', border: '#FECDD3', text: '#BE123C' },
  { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' },
];

function getSubjectColor(index: number) {
  return SUBJECT_COLORS[index % SUBJECT_COLORS.length];
}

// Map JS getDay() to DayOfWeek enum
const JS_DAY_MAP: Record<number, DayOfWeek> = {
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

export default function AdminTimetable() {
  const { school } = useSchool();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Every teacher booking across all classes — powers double-booking checks. */
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  /** Class-section → subject → teacher, from Subject & Teacher Assignment. */
  const [assignmentIndex, setAssignmentIndex] = useState<SubjectAssignment[]>([]);
  /** The cell whose teacher the Admin is overriding (§9). */
  const [changeTeacherFor, setChangeTeacherFor] = useState<TimetableSlot | null>(null);
  const todayEnum = JS_DAY_MAP[new Date().getDay()] || null;

  // ── Per-Saturday override state ──
  const satDate = React.useMemo(() => getUpcomingSaturday(new Date()), []);
  const satDateKey = React.useMemo(() => toDateKey(satDate), [satDate]);
  const [satMode, setSatMode] = useState<'recurring' | 'custom' | 'holiday'>('recurring');
  const [satSlots, setSatSlots] = useState<TimetableSlot[]>([]);
  const [satSaving, setSatSaving] = useState(false);

  // Drag state
  const dragItem = useRef<{ subjectId: string; subjectName: string; teacherId: string; teacherName: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      if (!school?.academicYear) return;
      const [c, t, assignments, allTimetables] = await Promise.all([
        ClassesService.getAll(school.academicYear),
        TeachersService.getAll(),
        TeachersService.getAllAssignments(school.academicYear),
        // Every class's timetable, read once, so a drop can tell whether the
        // teacher is already standing in another room that period (spec §14).
        TimetablesService.getAll(school.academicYear).catch(() => [] as any[]),
      ]);
      // Assignments are stored per-year in a separate collection, not on the
      // teacher doc — merge them in so class/section matching works.
      const mergedTeachers = (t as any[]).map(teacher => {
        const myAssignments = assignments.find(a => a.teacherId === teacher.id);
        return { ...teacher, assignedClasses: myAssignments?.assignments || [] };
      });
      setClasses(c as unknown as Class[]);
      setTeachers(mergedTeachers as unknown as Teacher[]);
      // The class-section view of the same allocations the resolver reads —
      // one source, so this screen and the assignment page cannot disagree.
      setAssignmentIndex(buildAssignmentIndex(
        t as unknown as TeacherRecord[],
        assignments as unknown as AssignmentDoc[],
      ));
      // Flatten every saved slot into "teacher X is booked day/period" rows.
      setBookedSlots((allTimetables as any[]).flatMap(tt =>
        ((tt.slots ?? []) as TimetableSlot[])
          .filter(slot => slot.teacherId)
          .map(slot => ({
            day: String(slot.day),
            period: slot.period,
            teacherId: slot.teacherId,
            classId: tt.classId,
            sectionId: tt.sectionId,
            className: tt.className,
            sectionName: tt.sectionName,
          }))));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [school?.academicYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (selectedClass && selectedSection && school?.academicYear) {
      TimetablesService.getByClassSection(selectedClass, selectedSection, school.academicYear)
        .then(data => {
          const tt = data as unknown as Timetable | null;
          setTimetable(tt);
          setSlots(tt?.slots || []);
          setEditing(!tt);
          // Sync Saturday override editor from the saved override (if any)
          const existing = tt?.saturdayOverrides?.[satDateKey];
          if (existing?.status === 'holiday') {
            setSatMode('holiday');
            setSatSlots([]);
          } else if (existing?.status === 'custom') {
            setSatMode('custom');
            setSatSlots(existing.slots || []);
          } else {
            setSatMode('recurring');
            setSatSlots([]);
          }
        }).catch(console.error);
    } else {
      setTimetable(null);
      setSlots([]);
      setSatMode('recurring');
      setSatSlots([]);
    }
  }, [selectedClass, selectedSection, satDateKey]);

  const selectedClassData = classes.find(c => c.id === selectedClass);
  /* §12 — the palette offers only subjects CONFIGURED for this class-section
     under Subject & Teacher Assignment, not the school's whole subject list.
     A subject with no allocation has no teacher to put in the cell, so
     offering it could only produce an unassigned period.

     A section that has been configured shows exactly its configured
     subjects; one that has not been configured yet falls back to the class's
     own subject list, so an existing timetable can still be edited while the
     school works through the new assignment page. */
  const allClassSubjects = selectedClassData?.subjects || [];
  const assignedSubjectIds = useMemo(() => new Set(
    assignmentsForSection(assignmentIndex, selectedClass, selectedSection)
      .map(a => a.subjectId),
  ), [assignmentIndex, selectedClass, selectedSection]);
  const sectionIsConfigured = assignedSubjectIds.size > 0;
  const classSubjects = sectionIsConfigured
    ? allClassSubjects.filter(sub => assignedSubjectIds.has(sub.id))
    : allClassSubjects;
  const days = (school.settings?.schoolDays || []) as DayOfWeek[];
  const rawTimings = school.settings?.periodTimings || [];
  // No custom period timings are configured (and there's no settings UI for them),
  // so fall back to plain numbered periods — otherwise the grid renders no rows.
  const periodsPerDay = school.settings?.periodsPerDay || 8;
  const timings: PeriodTiming[] = rawTimings.length > 0
    ? rawTimings
    : Array.from({ length: periodsPerDay }, (_, i) => ({ period: i + 1, start: '', end: '' }));
  const periods = timings.filter(t => t.period);

  // Build subject-color map 
  const subjectColorMap = new Map<string, { bg: string; border: string; text: string }>();
  classSubjects.forEach((s, i) => subjectColorMap.set(s.id, getSubjectColor(i)));

  // ── Get slot for a specific day/period ──
  const getSlot = (day: DayOfWeek, period: number) => slots.find(s => s.day === day && s.period === period);

  /**
   * A saved cell froze whatever teacher was known at SAVE time — which is why
   * assigning a teacher later never changed the grid. Resolve the name LIVE
   * from the current teacher setup (subject + this class/section) at every
   * render: assign a teacher today and the timetable shows their name
   * immediately, no re-save needed. Falls back to the stored teacher (by id,
   * so renames follow) and only then to the frozen text.
   */
  const liveTeacherName = (slot: { subjectId: string; subjectName: string; teacherId: string; teacherName: string }): string => {
    /* An existing timetable keeps the teacher it was SAVED with (spec §13):
       the stored id wins, resolved to the teacher's current name so a rename
       follows without rewriting the record. Only a cell that never stored a
       teacher falls through to the allocation, and if nobody is allocated it
       says so rather than borrowing whoever happens to teach the subject. */
    const stored = slot.teacherId ? teachers.find(t => t.id === slot.teacherId) : undefined;
    if (stored) return stored.name;

    const assigned = resolveAssignedTeacher(teachers as unknown as TeacherLike[], {
      classId: selectedClass,
      sectionId: selectedSection,
      subjectId: slot.subjectId,
      subjectName: slot.subjectName,
    });
    return assigned?.name || slot.teacherName || 'Unassigned';
  };

  // ── Handle dropping a subject onto a cell ──
  const handleDrop = (day: DayOfWeek, period: number) => {
    if (!dragItem.current) return;
    const { subjectId, subjectName, teacherId, teacherName } = dragItem.current;

    /* §14 — a teacher cannot stand in two rooms in the same period. Keyed on
       teacher + day + period, so the same teacher in a DIFFERENT period, or
       another teacher in this one, passes untouched. This warns rather than
       blocks: the Admin may be mid-rearrangement across two classes. */
    const clash = findTeacherConflict(bookedSlots, {
      teacherId, day: String(day), period, classId: selectedClass, sectionId: selectedSection,
    });
    if (clash) {
      showToast(
        `${teacherName} is already assigned to ${clash.className ?? 'another class'}`
        + `${clash.sectionName ? ` — ${clash.sectionName}` : ''} in this period.`,
        'warning',
      );
    }

    setSlots(prev => {
      const filtered = prev.filter(s => !(s.day === day && s.period === period));
      return [...filtered, { day, period, subjectId, subjectName, teacherId, teacherName }];
    });
    dragItem.current = null;
  };

  // ── Remove a slot ──
  const removeSlot = (day: DayOfWeek, period: number) => {
    setSlots(prev => prev.filter(s => !(s.day === day && s.period === period)));
  };

  // ── Auto-generate timetable ──
  const autoGenerate = () => {
    if (classSubjects.length === 0) {
      showToast('Add subjects to this class first (Classes → Edit)');
      return;
    }

    const newSlots: TimetableSlot[] = [];
    const teacherDayPeriod = new Map<string, Set<string>>(); // teacherId -> set of "day-period"

    // Build subject-teacher map from teacher assignments
    const subjectTeacherMap = new Map<string, Teacher[]>();
    classSubjects.forEach(sub => {
      // Auto Generate resolves through the SAME function as manual editing
      // (spec §16), so the two can never produce different allocations.
      const matching = resolveEligibleTeachers(teachers as unknown as TeacherLike[], {
        classId: selectedClass,
        sectionId: selectedSection,
        subjectId: sub.id,
        subjectName: sub.name,
      }) as unknown as Teacher[];
      subjectTeacherMap.set(sub.id, matching);
    });

    days.forEach(day => {
      periods.forEach(timing => {
        if (!timing.period) return;

        // Round-robin subjects
        const subjectIndex = ((timing.period! - 1) + days.indexOf(day) * 2) % classSubjects.length;
        const subject = classSubjects[subjectIndex];

        // Find an available teacher for this subject
        const candidateTeachers = subjectTeacherMap.get(subject.id) || [];
        let assignedTeacher: Teacher | undefined;

        for (const t of candidateTeachers) {
          const key = `${day}-${timing.period}`;
          const used = teacherDayPeriod.get(t.id) || new Set();
          if (!used.has(key)) {
            assignedTeacher = t;
            used.add(key);
            teacherDayPeriod.set(t.id, used);
            break;
          }
        }

        newSlots.push({
          day,
          period: timing.period!,
          subjectId: subject.id,
          subjectName: subject.name,
          teacherId: assignedTeacher?.id || '',
          teacherName: assignedTeacher?.name || 'Unassigned',
        });
      });
    });

    setSlots(newSlots);
    setEditing(true);
    showToast('Timetable auto-generated! Drag subjects to adjust.');
  };

  // ── Saturday override: drag helpers ──
  const handleSatDrop = (period: number) => {
    if (!dragItem.current) return;
    const { subjectId, subjectName, teacherId, teacherName } = dragItem.current;
    setSatSlots(prev => {
      const filtered = prev.filter(s => s.period !== period);
      return [...filtered, { day: DayOfWeek.SATURDAY, period, subjectId, subjectName, teacherId, teacherName }];
    });
    dragItem.current = null;
  };

  const removeSatSlot = (period: number) => {
    setSatSlots(prev => prev.filter(s => s.period !== period));
  };

  // ── Save Saturday override ──
  const handleSaveSaturdayOverride = async () => {
    if (!timetable?.id) {
      showToast('Save the main timetable first');
      return;
    }
    setSatSaving(true);
    try {
      const nextOverrides = { ...(timetable.saturdayOverrides || {}) };
      if (satMode === 'recurring') {
        delete nextOverrides[satDateKey];
      } else {
        nextOverrides[satDateKey] = satMode === 'holiday'
          ? { status: 'holiday', slots: [] }
          : { status: 'custom', slots: satSlots };
      }
      await TimetablesService.update(timetable.id, { saturdayOverrides: nextOverrides });
      const updated = await TimetablesService.getByClassSection(selectedClass, selectedSection, school.academicYear);
      setTimetable(updated as unknown as Timetable);
      showToast(`Saturday ${satDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} saved!`);
    } catch (err) {
      console.error('Error saving Saturday override:', err);
      showToast('Failed to save Saturday override');
    } finally {
      setSatSaving(false);
    }
  };

  // ── Save timetable ──
  const handleSave = async () => {
    setSaving(true);
    try {
      /* Re-resolve every slot's teacher from the CURRENT setup before saving.
         The teacher's own timetable filters saved slots by teacherId, so a
         slot frozen as ''/Unassigned would stay invisible to the teacher
         forever — saving is the moment the stored ids catch up. */
      const resolvedSlots = slots.map(slot => {
        const key = {
          classId: selectedClass,
          sectionId: selectedSection,
          subjectId: slot.subjectId,
          subjectName: slot.subjectName,
        };
        const roster = teachers as unknown as TeacherLike[];

        /* Keep a teacher who is genuinely allocated here — including one the
           Admin chose among several (spec §13: never rewrite a valid saved
           assignment). Drop one who is not, rather than persisting a pairing
           the allocation does not support. */
        if (slot.teacherId && isTeacherValidForSlot(roster, key, slot.teacherId)) {
          const current = teachers.find(t => t.id === slot.teacherId);
          return current ? { ...slot, teacherName: current.name } : slot;
        }

        const assigned = resolveAssignedTeacher(roster, key);
        return assigned
          ? { ...slot, teacherId: assigned.id, teacherName: assigned.name }
          : { ...slot, teacherId: '', teacherName: 'Unassigned' };
      });

      /* §18 — the write path re-checks the pairing itself, because UI
         filtering is not protection. */
      const invalid = resolvedSlots.find(slot => !isTeacherValidForSlot(
        teachers as unknown as TeacherLike[],
        {
          classId: selectedClass,
          sectionId: selectedSection,
          subjectId: slot.subjectId,
          subjectName: slot.subjectName,
        },
        slot.teacherId,
      ));
      if (invalid) {
        showToast(
          `${invalid.teacherName} is not assigned to teach ${invalid.subjectName} in this class and section. `
          + 'Fix the assignment under Teachers, then save again.',
          'error',
        );
        setSaving(false);
        return;
      }

      const data = {
        classId: selectedClass,
        sectionId: selectedSection,
        className: selectedClassData?.name || '',
        sectionName: selectedClassData?.sections.find(s => s.id === selectedSection)?.name || '',
        academicYear: school.academicYear,
        version: (timetable?.version || 0) + 1,
        status: TimetableStatus.PUBLISHED,
        effectiveFrom: new Date(),
        slots: resolvedSlots,
        createdBy: user?.id || '',
      };
      if (timetable?.id) {
        await TimetablesService.update(timetable.id, data);
      } else {
        await TimetablesService.create(data);
      }
      const updated = await TimetablesService.getByClassSection(selectedClass, selectedSection, school.academicYear);
      setTimetable(updated as unknown as Timetable);
      setEditing(false);
      showToast('Timetable saved!');
    } catch (err) {
      console.error('Error saving timetable:', err);
      showToast('Failed to save timetable');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Timetable</h2>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {selectedClassData ? `${selectedClassData.name} — Section ${selectedClassData.sections.find(s => s.id === selectedSection)?.name || ''}` : 'Select a class to manage'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {selectedClass && selectedSection && (
            <>
              <Button variant="secondary" onClick={autoGenerate}>Auto Generate</Button>
              {editing && (
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Timetable'}
                </Button>
              )}
              {!editing && timetable && (
                <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Class + Section Card Picker (flattened) ── */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <p className="text-overline" style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-tertiary)' }}>
          Select a class
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 'var(--space-3)',
        }}>
          {(() => {
            let cardIndex = 0;
            return classes.flatMap(cls =>
              (cls.sections || []).map(sec => {
                const idx = cardIndex++;
                const isSelected = selectedClass === cls.id && selectedSection === sec.id;
                const color = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
                const label = `${cls.name} — ${sec.name}`;
                return (
                  <div
                    key={`${cls.id}-${sec.id}`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedClass('');
                        setSelectedSection('');
                        setTimetable(null);
                        setSlots([]);
                      } else {
                        setSelectedClass(cls.id);
                        setSelectedSection(sec.id);
                        setTimetable(null);
                        setSlots([]);
                      }
                    }}
                    style={{
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${isSelected ? color.text : 'var(--color-border)'}`,
                      background: isSelected ? color.bg : 'var(--color-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      boxShadow: isSelected ? `0 0 0 1px ${color.border}` : 'none',
                    }}
                  >
                    {isSelected && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        width: 20, height: 20, borderRadius: 'var(--radius-full)',
                        background: color.text, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 700,
                      }}>✓</div>
                    )}
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-md)',
                      background: isSelected ? `${color.text}15` : 'var(--color-surface-variant)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 'var(--space-2)',
                      color: isSelected ? color.text : 'var(--color-text-tertiary)',
                      fontSize: '0.85rem', fontWeight: 700,
                    }}>
                      {sec.name}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? color.text : 'var(--color-text-primary)' }}>
                      {label}
                    </div>
                    <div style={{
                      fontSize: '0.72rem', color: isSelected ? color.text : 'var(--color-text-tertiary)',
                      opacity: isSelected ? 0.8 : 1, marginTop: 2,
                    }}>
                      {cls.subjects?.length || 0} subject{(cls.subjects?.length || 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })
            );
          })()}
        </div>
      </div>

      {/* Empty state – when no class is selected */}
      {!selectedClass && (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-full)', background: 'var(--color-primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
            <CalendarIcon size={28} />
          </div>
          <p className="text-body" style={{ fontWeight: 500 }}>Select a class</p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Tap a card above to view or create a timetable</p>
        </div>
      )}

      {/* No timetable yet */}
      {selectedClass && selectedSection && slots.length === 0 && !editing && (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body" style={{ fontWeight: 500, marginBottom: 'var(--space-3)' }}>No timetable created yet</p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
            <Button variant="primary" onClick={autoGenerate} icon={<PlusIcon size={16} color="white" />}>Auto Generate</Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>Create Manually</Button>
          </div>
        </div>
      )}

      {/* ===== Subject palette (drag source) — only in edit mode ===== */}
      {(editing || satMode === 'custom') && selectedClass && selectedSection && (
        <div style={{
          marginBottom: 'var(--space-4)', padding: 'var(--space-4)',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
          <p className="text-overline" style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-tertiary)' }}>
            Drag subjects to the timetable grid {satMode === 'custom' ? 'or this Saturday' : 'below'}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {classSubjects.map((sub, i) => {
              const color = getSubjectColor(i);
              // Find teachers for this subject who are assigned to THIS class and section
              // Same resolver as everywhere else — the palette can only offer
              // a teacher actually allocated to this subject in this section.
              const matchingTeachers = resolveEligibleTeachers(
                teachers as unknown as TeacherLike[],
                {
                  classId: selectedClass,
                  sectionId: selectedSection,
                  subjectId: sub.id,
                  subjectName: sub.name,
                },
              ) as unknown as Teacher[];
              // Only auto-fill when the allocation is unambiguous; with several
              // teachers the Admin picks, and with none nobody is invented.
              const teacher = matchingTeachers.length === 1 ? matchingTeachers[0] : undefined;
              return (
                <div
                  key={sub.id}
                  draggable
                  onDragStart={() => {
                    dragItem.current = {
                      subjectId: sub.id,
                      subjectName: sub.name,
                      teacherId: teacher?.id || '',
                      teacherName: teacher?.name || 'Unassigned',
                    };
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-md)',
                    background: color.bg, border: `2px solid ${color.border}`,
                    color: color.text, fontWeight: 600, fontSize: '0.85rem',
                    cursor: 'grab', userSelect: 'none',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}
                >
                  <span>{sub.name}</span>
                  {/* Say WHY there is no teacher: none allocated here, or
                      several so the Admin must choose (spec §8). */}
                  <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.8 }}>
                    {teacher?.name
                      ?? (matchingTeachers.length > 1
                        ? `${matchingTeachers.length} teachers — pick one`
                        : 'No teacher assigned here')}
                  </span>
                </div>
              );
            })}
            {classSubjects.length === 0 && (
              <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                No subjects in this class. Go to Classes → Edit to add subjects first.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ===== Timetable Grid ===== */}
      {selectedClass && selectedSection && (slots.length > 0 || editing) && (
        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)', overflow: 'auto', border: '1px solid var(--color-border)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: days.length * 140 + 80 }}>
            <thead>
              <tr>
                <th style={{
                  width: 80, padding: 'var(--space-3)', background: 'var(--color-surface-variant)',
                  borderBottom: '2px solid var(--color-border)', textAlign: 'center',
                  fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: 'var(--color-text-tertiary)',
                  position: 'sticky', left: 0, zIndex: 2,
                }}>Period</th>
                {days.map(day => {
                  const isToday = day === todayEnum;
                  const isSaturday = day === DayOfWeek.SATURDAY;
                  return (
                    <th key={day} style={{
                      padding: 'var(--space-3)', textAlign: 'center', fontWeight: 700,
                      borderBottom: '2px solid var(--color-border)',
                      borderLeft: isSaturday ? '4px double var(--color-border)' : undefined,
                      fontSize: '0.8rem',
                      background: isToday ? 'rgba(220, 38, 38, 0.08)' : 'var(--color-surface-variant)',
                      color: isToday ? 'var(--color-primary-600)' : 'var(--color-text-primary)',
                    }}>
                      <div>{DAY_SHORT_LABELS[day]}</div>
                      {isToday && (
                        <span style={{
                          display: 'inline-block', marginTop: 2,
                          padding: '1px 8px', borderRadius: 'var(--radius-full)',
                          background: 'var(--color-primary-500)', color: 'white',
                          fontSize: '0.6rem', fontWeight: 700,
                        }}>TODAY</span>
                      )}
                      {isSaturday && (
                        <div style={{ fontSize: '0.6rem', fontWeight: 500, marginTop: 2, color: 'var(--color-text-tertiary)' }}>
                          weekly plan
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {timings.map(timing => {
                // Break/lunch row
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
                      position: 'sticky', left: 0, background: 'var(--color-surface)',
                      zIndex: 1,
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>P{timing.period}</div>
                      {timing.start && timing.end && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-tertiary)' }}>{formatTime(timing.start)}–{formatTime(timing.end)}</div>
                      )}
                    </td>

                    {days.map(day => {
                      const slot = getSlot(day, timing.period!);
                      const color = slot ? (subjectColorMap.get(slot.subjectId) || SUBJECT_COLORS[0]) : null;
                      const isToday = day === todayEnum;
                      const isSaturday = day === DayOfWeek.SATURDAY;

                      return (
                        <td
                          key={day}
                          onDragOver={editing ? (e) => e.preventDefault() : undefined}
                          onDrop={editing ? () => handleDrop(day, timing.period!) : undefined}
                          style={{
                            padding: 4,
                            borderBottom: '1px solid var(--color-divider)',
                            borderRight: '1px solid var(--color-divider)',
                            borderLeft: isSaturday ? '4px double var(--color-border)' : undefined,
                            verticalAlign: 'top', height: 64,
                            background: isToday
                              ? 'rgba(220, 38, 38, 0.04)'
                              : isSaturday
                                ? 'rgba(99, 102, 241, 0.04)'
                                : (editing && !slot ? 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.02) 5px, rgba(0,0,0,0.02) 10px)' : 'transparent'),
                          }}
                        >
                          {slot ? (
                            <div
                              draggable={editing}
                              onDragStart={editing ? () => {
                                dragItem.current = {
                                  subjectId: slot.subjectId,
                                  subjectName: slot.subjectName,
                                  teacherId: slot.teacherId,
                                  teacherName: slot.teacherName,
                                };
                                // Remove from current position so it can be dropped elsewhere
                                setTimeout(() => removeSlot(day, timing.period!), 0);
                              } : undefined}
                              style={{
                                padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                                background: color?.bg || '#F3F4F6',
                                border: `1.5px solid ${color?.border || '#D1D5DB'}`,
                                height: '100%', cursor: editing ? 'grab' : 'default',
                                position: 'relative',
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: color?.text || '#374151', lineHeight: 1.2 }}>
                                {slot.subjectName}
                              </div>
                              {/* The teacher is READ-ONLY: it comes from the
                                  configured assignment. Editing offers an
                                  explicit override rather than a free choice
                                  (§9, §13). */}
                              <div
                                style={{
                                  fontSize: '0.65rem', color: color?.text || '#6B7280',
                                  opacity: 0.7, marginTop: 2,
                                  textDecoration: editing ? 'underline dotted' : 'none',
                                  cursor: editing ? 'pointer' : 'default',
                                }}
                                title={editing ? 'Change teacher for this period' : undefined}
                                onClick={editing
                                  ? event => { event.stopPropagation(); setChangeTeacherFor(slot); }
                                  : undefined}
                              >
                                {liveTeacherName(slot)}
                              </div>
                              {editing && (
                                <button
                                  onClick={() => removeSlot(day, timing.period!)}
                                  style={{
                                    position: 'absolute', top: 2, right: 2,
                                    width: 16, height: 16, borderRadius: '50%',
                                    background: 'rgba(0,0,0,0.15)', border: 'none',
                                    color: '#fff', fontSize: '10px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    lineHeight: 1,
                                  }}
                                >×</button>
                              )}
                            </div>
                          ) : editing ? (
                            <div style={{
                              height: '100%', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', opacity: 0.3, fontSize: '0.7rem',
                              color: 'var(--color-text-tertiary)',
                            }}>
                              Drop here
                            </div>
                          ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>—</span>
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

      {/* ===== This Saturday — per-week override ===== */}
      {selectedClass && selectedSection && timetable && (
        <div style={{
          marginTop: 'var(--space-5)', padding: 'var(--space-4)',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          borderLeft: '4px double var(--color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <p className="text-overline" style={{ color: 'var(--color-text-tertiary)', marginBottom: 2 }}>This Saturday</p>
              <h3 className="text-h3" style={{ margin: 0 }}>
                {satDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {(['recurring', 'custom', 'holiday'] as const).map(m => {
                const isActive = satMode === m;
                const label = m === 'recurring' ? 'Use weekly plan' : m === 'custom' ? 'Custom plan' : 'Holiday';
                return (
                  <button
                    key={m}
                    onClick={() => setSatMode(m)}
                    style={{
                      padding: '6px 14px', borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${isActive ? 'var(--color-primary-500)' : 'var(--color-border)'}`,
                      background: isActive ? 'var(--color-primary-50)' : 'var(--color-surface)',
                      color: isActive ? 'var(--color-primary-700)' : 'var(--color-text-primary)',
                      fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
              <Button variant="primary" onClick={handleSaveSaturdayOverride} disabled={satSaving}>
                {satSaving ? 'Saving...' : 'Save Saturday'}
              </Button>
            </div>
          </div>

          {satMode === 'recurring' && (
            <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
              Using the recurring Saturday plan from the main timetable above. Switch to <strong>Custom plan</strong> to override just this Saturday, or <strong>Holiday</strong> to clear it.
            </p>
          )}

          {satMode === 'holiday' && (
            <div style={{
              padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
              background: '#FEF3C7', border: '1px solid #FDE68A', color: '#B45309',
              fontWeight: 600, fontSize: '0.9rem', textAlign: 'center',
            }}>
              Marked as holiday — no classes will be shown for {satDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.
            </div>
          )}

          {satMode === 'custom' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.max(periods.length, 1)}, minmax(120px, 1fr))`,
              gap: 'var(--space-2)',
            }}>
              {periods.map(timing => {
                const slot = satSlots.find(s => s.period === timing.period);
                const color = slot ? (subjectColorMap.get(slot.subjectId) || SUBJECT_COLORS[0]) : null;
                return (
                  <div
                    key={timing.period}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleSatDrop(timing.period!)}
                    style={{
                      minHeight: 72, padding: 6,
                      borderRadius: 'var(--radius-md)',
                      border: slot ? `1.5px solid ${color?.border}` : '1.5px dashed var(--color-border)',
                      background: slot ? color?.bg : 'rgba(0,0,0,0.02)',
                      position: 'relative',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>
                      P{timing.period}
                    </div>
                    {slot ? (
                      <>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: color?.text, lineHeight: 1.2 }}>
                          {slot.subjectName}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: color?.text, opacity: 0.75, marginTop: 2 }}>
                          {liveTeacherName(slot)}
                        </div>
                        <button
                          onClick={() => removeSatSlot(timing.period!)}
                          style={{
                            position: 'absolute', top: 4, right: 4,
                            width: 16, height: 16, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.15)', border: 'none',
                            color: '#fff', fontSize: '10px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            lineHeight: 1,
                          }}
                        >×</button>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: 12, opacity: 0.6 }}>
                        Drop here
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Change Teacher (§9) — an explicit override of the configured
          assignment, offered only among teachers qualified for the subject,
          and refused when it would double-book. */}
      {changeTeacherFor && (() => {
        const slot = changeTeacherFor;
        const configured = resolveAssignedTeacher(teachers as unknown as TeacherLike[], {
          classId: selectedClass,
          sectionId: selectedSection,
          subjectId: slot.subjectId,
          subjectName: slot.subjectName,
        });
        const options = eligibleTeachersForSubject(
          teachers as unknown as TeacherRecord[], slot.subjectId, slot.subjectName,
        );
        return (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)',
            }}
            onClick={() => setChangeTeacherFor(null)}
          >
            <div
              onClick={event => event.stopPropagation()}
              style={{
                background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)', padding: 'var(--space-5)',
                width: 'min(420px, 100%)', display: 'grid', gap: 'var(--space-3)',
              }}
            >
              <h3 className="text-h3" style={{ margin: 0 }}>Change teacher</h3>
              <p className="text-body-sm" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                {slot.subjectName} · {DAY_SHORT_LABELS[slot.day] ?? slot.day} period {slot.period}
                {configured
                  ? ` — assigned to ${configured.name} for this class and section.`
                  : ' — no teacher is assigned for this subject in this class and section.'}
              </p>

              <select
                value={slot.teacherId || ''}
                onChange={event => {
                  const teacher = teachers.find(t => t.id === event.target.value);
                  if (!teacher) return;
                  const clash = findTeacherConflict(bookedSlots, {
                    teacherId: teacher.id,
                    day: String(slot.day),
                    period: slot.period,
                    classId: selectedClass,
                    sectionId: selectedSection,
                  });
                  if (clash) {
                    showToast(
                      `${teacher.name} is already assigned to ${clash.className ?? 'another class'}`
                      + `${clash.sectionName ? ` — ${clash.sectionName}` : ''} in this period.`,
                      'error',
                    );
                    return;
                  }
                  setSlots(prev => prev.map(item =>
                    item.day === slot.day && item.period === slot.period
                      ? { ...item, teacherId: teacher.id, teacherName: teacher.name }
                      : item));
                  setChangeTeacherFor(null);
                  showToast(`${slot.subjectName} → ${teacher.name} for this period`);
                }}
                style={{
                  padding: '8px 12px', minHeight: 40, fontSize: '0.9rem',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface)', color: 'var(--color-text-primary)',
                }}
              >
                <option value="">Choose a teacher…</option>
                {options.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}{teacher.id === configured?.id ? ' (assigned)' : ''}
                  </option>
                ))}
              </select>

              {options.length === 0 && (
                <p className="text-body-sm" style={{ margin: 0, color: 'var(--color-warning-text)' }}>
                  No teacher lists {slot.subjectName} on their profile. Add it under Teachers, then
                  set the allocation under Subject &amp; Teacher Assignment.
                </p>
              )}

              <p className="text-caption" style={{ margin: 0, color: 'var(--color-text-tertiary)' }}>
                Overriding here changes this period only. To change who teaches
                {' '}{slot.subjectName} in this class, edit Subject &amp; Teacher Assignment.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setChangeTeacherFor(null)}>Close</Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
