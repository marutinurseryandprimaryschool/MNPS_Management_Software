'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TimetablesService, ClassesService, TeachersService } from '@/lib/firestore-service';
import { formatTime } from '@/lib/utils';
import { useSchool } from '@/context/SchoolContext';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { DAYS_OF_WEEK, DAY_SHORT_LABELS, TimetableStatus, DayOfWeek } from '@/types/enums';
import { CalendarIcon, PlusIcon } from '@/components/ui/Icons';
import type { Class, Teacher, Timetable, TimetableSlot, Subject, PeriodTiming } from '@/types/models';

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
  const todayEnum = JS_DAY_MAP[new Date().getDay()] || null;

  // Drag state
  const dragItem = useRef<{ subjectId: string; subjectName: string; teacherId: string; teacherName: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      if (!school?.academicYear) return;
      const [c, t, assignments] = await Promise.all([
        ClassesService.getAll(school.academicYear),
        TeachersService.getAll(),
        TeachersService.getAllAssignments(school.academicYear)
      ]);
      // Assignments are stored per-year in a separate collection, not on the
      // teacher doc — merge them in so class/section matching works.
      const mergedTeachers = (t as any[]).map(teacher => {
        const myAssignments = assignments.find(a => a.teacherId === teacher.id);
        return { ...teacher, assignedClasses: myAssignments?.assignments || [] };
      });
      setClasses(c as unknown as Class[]);
      setTeachers(mergedTeachers as unknown as Teacher[]);
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
        }).catch(console.error);
    } else {
      setTimetable(null);
      setSlots([]);
    }
  }, [selectedClass, selectedSection]);

  const selectedClassData = classes.find(c => c.id === selectedClass);
  const classSubjects = selectedClassData?.subjects || [];
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

  // ── Handle dropping a subject onto a cell ──
  const handleDrop = (day: DayOfWeek, period: number) => {
    if (!dragItem.current) return;
    const { subjectId, subjectName, teacherId, teacherName } = dragItem.current;
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
      const matching = teachers.filter(t => {
        const teachesSubject = t.subjects?.includes(sub.id) || 
                              t.subjectNames?.some(n => n.toLowerCase() === sub.name.toLowerCase());
        const assignedToThisClass = t.assignedClasses?.some(ac => 
          ac.classId === selectedClass && ac.sectionId === selectedSection
        );
        return teachesSubject && assignedToThisClass;
      });
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

  // ── Save timetable ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        classId: selectedClass,
        sectionId: selectedSection,
        className: selectedClassData?.name || '',
        sectionName: selectedClassData?.sections.find(s => s.id === selectedSection)?.name || '',
        academicYear: school.academicYear,
        version: (timetable?.version || 0) + 1,
        status: TimetableStatus.PUBLISHED,
        effectiveFrom: new Date(),
        slots,
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
      {editing && selectedClass && selectedSection && (
        <div style={{
          marginBottom: 'var(--space-4)', padding: 'var(--space-4)',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
          <p className="text-overline" style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-tertiary)' }}>
            Drag subjects to the timetable grid below
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {classSubjects.map((sub, i) => {
              const color = getSubjectColor(i);
              // Find teachers for this subject who are assigned to THIS class and section
              const matchingTeachers = teachers.filter(t => {
                const teachesSubject = t.subjects?.includes(sub.id) || 
                                      t.subjectNames?.some(n => n.toLowerCase() === sub.name.toLowerCase());
                const assignedToThisClass = t.assignedClasses?.some(ac => 
                  ac.classId === selectedClass && ac.sectionId === selectedSection
                );
                return teachesSubject && assignedToThisClass;
              });
              const teacher = matchingTeachers[0];
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
                  <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.8 }}>
                    {teacher?.name || 'No teacher'}
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
                  return (
                    <th key={day} style={{
                      padding: 'var(--space-3)', textAlign: 'center', fontWeight: 700,
                      borderBottom: '2px solid var(--color-border)',
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

                      return (
                        <td
                          key={day}
                          onDragOver={editing ? (e) => e.preventDefault() : undefined}
                          onDrop={editing ? () => handleDrop(day, timing.period!) : undefined}
                          style={{
                            padding: 4,
                            borderBottom: '1px solid var(--color-divider)',
                            borderRight: '1px solid var(--color-divider)',
                            verticalAlign: 'top', height: 64,
                            background: isToday
                              ? 'rgba(220, 38, 38, 0.04)'
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
                              <div style={{ fontSize: '0.65rem', color: color?.text || '#6B7280', opacity: 0.7, marginTop: 2 }}>
                                {slot.teacherName}
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
    </div>
  );
}
