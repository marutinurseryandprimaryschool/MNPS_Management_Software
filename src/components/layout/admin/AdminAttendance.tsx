'use client';

import React, { useState, useEffect } from 'react';
import { AttendanceService, ClassesService } from '@/lib/firestore-service';
import { useSchool } from '@/context/SchoolContext';
import { Select } from '@/components/ui/Input';
import { Avatar, Badge } from '@/components/ui/SharedUI';
import Modal from '@/components/ui/Modal';
import { ClipboardCheckIcon } from '@/components/ui/Icons';
import type { Attendance, Class } from '@/types/models';

export default function AdminAttendance() {
  const { school } = useSchool();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);

  useEffect(() => {
    if (!school?.academicYear) return;
    ClassesService.getAll(school.academicYear).then(data => setClasses(data as unknown as Class[])).catch(console.error).finally(() => setLoading(false));
  }, [school?.academicYear]);

  useEffect(() => {
    if (selectedDate && selectedClass) {
      const cls = classes.find(c => c.id === selectedClass);
      const sectionId = cls?.sections?.[0]?.id || '';
      if (sectionId) {
        AttendanceService.getByDateClass(selectedDate, selectedClass, sectionId, school.academicYear)
          .then(data => setAttendances(data as unknown as Attendance[]))
          .catch(console.error);
      }
    } else if (selectedDate && school?.academicYear) {
      AttendanceService.getAll(school.academicYear).then(data => {
        const filtered = (data as unknown as Attendance[]).filter(a => a.date === selectedDate);
        setAttendances(filtered);
      }).catch(console.error);
    }
  }, [selectedDate, selectedClass, classes]);

  const todayFormatted = new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="text-h1">Attendance</h2>
            <Badge variant="primary">{school?.academicYear}</Badge>
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>{todayFormatted}</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', maxWidth: 500, marginBottom: 'var(--space-5)' }}>
        <div>
          <label className="text-body-sm" style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Date</label>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', font: 'var(--text-body-sm)',
              background: 'var(--color-surface)', color: 'var(--color-text-primary)',
            }} />
        </div>
        <Select label="Class" options={[{ value: '', label: 'All Classes' }, ...classes.map(c => ({ value: c.id, label: c.name }))]} value={selectedClass} onChange={e => setSelectedClass(e.target.value)} />
      </div>

      {/* Attendance cards */}
      {attendances.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-full)', background: 'var(--color-primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
            <ClipboardCheckIcon size={28} />
          </div>
          <p className="text-body" style={{ fontWeight: 500 }}>No attendance records</p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No attendance submitted for this date yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          {attendances.map(att => {
            const total = att.records?.length || 0;
            const present = att.records?.filter(r => r.status === 'present').length || 0;
            const absent = total - present;
            const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

            return (
              <div key={att.id}
                onClick={() => setSelectedAttendance(att)}
                style={{
                  background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)', padding: 'var(--space-5)',
                  cursor: 'pointer', transition: 'all 200ms',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--color-primary-300)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
              >
                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <h3 className="text-h3" style={{ margin: 0 }}>{att.className} — Section {att.sectionName}</h3>
                    <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', margin: '2px 0 0' }}>by {att.teacherName}</p>
                  </div>
                  <Badge variant="info">{total} students</Badge>
                </div>

                {/* Progress bar */}
                <div style={{ height: 8, borderRadius: 4, background: '#FEE2E2', overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
                  <div style={{
                    height: '100%', width: `${percentage}%`,
                    background: 'linear-gradient(90deg, #059669, #34D399)',
                    borderRadius: 4, transition: 'width 300ms',
                  }} />
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#059669' }} />
                      <span className="text-body-sm" style={{ fontWeight: 600 }}>{present}</span>
                      <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Present</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#DC2626' }} />
                      <span className="text-body-sm" style={{ fontWeight: 600 }}>{absent}</span>
                      <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Absent</span>
                    </div>
                  </div>
                  <span className="text-h3" style={{ color: percentage >= 80 ? '#059669' : percentage >= 50 ? '#D97706' : '#DC2626' }}>
                    {percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Detail Modal ===== */}
      <Modal isOpen={!!selectedAttendance} onClose={() => setSelectedAttendance(null)}
        title={selectedAttendance ? `${selectedAttendance.className} — Section ${selectedAttendance.sectionName}` : ''}
        size="lg"
      >
        {selectedAttendance && (() => {
          const presentStudents = selectedAttendance.records?.filter(r => r.status === 'present') || [];
          const absentStudents = selectedAttendance.records?.filter(r => r.status !== 'present') || [];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Summary */}
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <div style={{
                  flex: 1, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
                  background: '#ECFDF5', border: '1px solid #A7F3D0', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#059669' }}>{presentStudents.length}</div>
                  <div className="text-body-sm" style={{ fontWeight: 500, color: '#059669' }}>Present</div>
                </div>
                <div style={{
                  flex: 1, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
                  background: '#FEF2F2', border: '1px solid #FECACA', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#DC2626' }}>{absentStudents.length}</div>
                  <div className="text-body-sm" style={{ fontWeight: 500, color: '#DC2626' }}>Absent</div>
                </div>
              </div>

              {/* Teacher info */}
              <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                Submitted by <strong>{selectedAttendance.teacherName}</strong> • {selectedAttendance.date}
              </p>

              {/* Absent list (shown first — more important) */}
              {absentStudents.length > 0 && (
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    marginBottom: 'var(--space-3)',
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#DC2626' }} />
                    <span className="text-overline" style={{ color: '#DC2626' }}>Absent Students ({absentStudents.length})</span>
                  </div>
                  <div style={{
                    borderRadius: 'var(--radius-md)', border: '1px solid #FECACA',
                    overflow: 'hidden', background: '#FEF2F2',
                  }}>
                    {absentStudents.map((r, i) => (
                      <div key={r.studentId} style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                        padding: 'var(--space-3) var(--space-4)',
                        borderBottom: i < absentStudents.length - 1 ? '1px solid #FECACA' : 'none',
                      }}>
                        <span className="text-caption" style={{ width: 24, textAlign: 'center', color: '#DC2626', fontWeight: 600 }}>{i + 1}</span>
                        <Avatar name={r.studentName} size={28} />
                        <span className="text-body-sm" style={{ fontWeight: 500 }}>{r.studentName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Present list */}
              {presentStudents.length > 0 && (
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    marginBottom: 'var(--space-3)',
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#059669' }} />
                    <span className="text-overline" style={{ color: '#059669' }}>Present Students ({presentStudents.length})</span>
                  </div>
                  <div style={{
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                    overflow: 'hidden',
                  }}>
                    {presentStudents.map((r, i) => (
                      <div key={r.studentId} style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                        padding: 'var(--space-2) var(--space-4)',
                        borderBottom: i < presentStudents.length - 1 ? '1px solid var(--color-divider)' : 'none',
                      }}>
                        <span className="text-caption" style={{ width: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{i + 1}</span>
                        <Avatar name={r.studentName} size={24} />
                        <span className="text-body-sm">{r.studentName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
