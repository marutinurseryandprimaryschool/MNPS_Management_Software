import React, { useState, useEffect } from 'react';
import { TimetablesService, StudentsService, SchoolService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { DAYS_OF_WEEK, DAY_LABELS } from '@/types/enums';
import type { Timetable, Student } from '@/types/models';

export default function ParentTimetable() {
  const { user } = useAuth();
  const { school: currentSchool } = useSchool();
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [child, setChild] = useState<Student | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        if (!user || !currentSchool?.academicYear) return;
        const [allStudents, schoolData] = await Promise.all([
          StudentsService.getAll(currentSchool.academicYear),
          SchoolService.get()
        ]);
        
        setSchoolSettings(schoolData?.settings);

        const myChild = (allStudents as unknown as Student[]).find(s =>
          s.email?.toLowerCase() === user.email?.toLowerCase()
        );
        setChild(myChild || null);

        if (myChild) {
          const tt = await TimetablesService.getByClassSection(myChild.classId, myChild.sectionId, currentSchool.academicYear);
          setTimetable(tt as unknown as Timetable);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, currentSchool?.academicYear]);

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  if (!child) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No child linked to your account.</p>
        </div>
      </div>
    );
  }

  if (!timetable) {
    return (
      <div className="page-container">
        <div className="page-header"><h2 className="text-h1">Timetable</h2></div>
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No timetable published yet for {child.name}&apos;s class ({child.className}-{child.sectionName}).</p>
        </div>
      </div>
    );
  }

  const rawTimings = (schoolSettings?.periodTimings || []).filter((t: any) => t.type !== 'break' && t.type !== 'lunch');
  // Fall back to plain numbered periods when no custom timings are configured,
  // otherwise the grid renders no period columns even when slots exist.
  const periodsPerDay = schoolSettings?.periodsPerDay || 8;
  const periods = rawTimings.length > 0
    ? rawTimings
    : Array.from({ length: periodsPerDay }, (_, i) => ({ period: i + 1, start: '', end: '' }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Class Timetable</h2>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>{child.name} • {child.className}-{child.sectionName}</p>
        </div>
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto', border: '1px solid var(--color-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-variant)' }}>
              <th style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', width: 100 }}>Day</th>
              {periods.map((p: any) => (
                <th key={p.period} style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Period {p.period}</div>
                  {p.start && p.end && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{p.start} - {p.end}</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS_OF_WEEK.map(day => (
              <tr key={day}>
                <td style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', fontWeight: 600, background: 'var(--color-surface-variant)', fontSize: '0.85rem' }}>
                  {DAY_LABELS[day]}
                </td>
                {periods.map((p: any) => {
                  const slot = timetable.slots?.find(s => s.day === day && s.period === p.period);
                  return (
                    <td key={`${day}-${p.period}`} style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
                      {slot ? (
                        <div>
                          <div style={{ font: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--color-primary-600)' }}>{slot.subjectName}</div>
                          <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontSize: '0.65rem' }}>{slot.teacherName}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.7rem' }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
