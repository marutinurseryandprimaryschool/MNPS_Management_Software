'use client';

import React from 'react';
import { DataCard, AlertCard } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { DEMO_STUDENTS, DEMO_ASSIGNMENTS } from '@/lib/demo-data';
import { getGreeting, formatCurrency } from '@/lib/utils';
import { Avatar } from '@/components/ui/SharedUI';
import { ClipboardCheckIcon, FileTextIcon, BookOpenIcon, CreditCardIcon, CalendarIcon } from '@/components/ui/Icons';

export default function ParentDashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { user } = useAuth();
  const child = DEMO_STUDENTS[0]; // Demo: first student

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 className="text-h1">{getGreeting()}, {user?.name?.split(' ')[0]}</h2>
        <p className="text-body-sm" style={{ marginTop: 'var(--space-1)' }}>Parent Portal • Maruti School</p>
      </div>

      {/* Child Card */}
      <div style={{ background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700))', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', color: 'white', marginBottom: 'var(--space-6)', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Avatar name={child.name} size={56} />
          <div>
            <h3 style={{ font: 'var(--text-heading-2)', color: 'white' }}>{child.name}</h3>
            <p style={{ font: 'var(--text-body-sm)', opacity: 0.9 }}>{child.className}-{child.sectionName} • {child.admissionNumber}</p>
          </div>
        </div>
      </div>

      {/* Alert */}
      <AlertCard type="warning" title="Fee Reminder" message="Term 1 fee of ₹10,000 is due on April 30" action="Pay Now" onAction={() => onNavigate('fees')} className="mb-4" />

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        <DataCard icon={<ClipboardCheckIcon size={22} />} value="92%" label="Attendance" color="var(--color-success)" onClick={() => onNavigate('attendance')} />
        <DataCard icon={<FileTextIcon size={22} />} value="B+" label="Avg Grade" color="var(--color-info)" onClick={() => onNavigate('marks')} />
        <DataCard icon={<BookOpenIcon size={22} />} value={DEMO_ASSIGNMENTS.length} label="Assignments" color="var(--color-primary-500)" onClick={() => onNavigate('assignments')} />
        <DataCard icon={<CreditCardIcon size={22} />} value={formatCurrency(14000)} label="Pending Fees" color="var(--color-warning)" onClick={() => onNavigate('fees')} />
      </div>

      {/* Upcoming */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }} className="responsive-grid-2">
        {/* Upcoming Assignments */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <BookOpenIcon size={18} />
            <h3 className="text-h3">Upcoming Assignments</h3>
          </div>
          {DEMO_ASSIGNMENTS.map(a => {
            const daysLeft = Math.ceil((a.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return (
              <div key={a.id} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-divider)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-body-sm" style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{a.title}</span>
                  <span className="text-caption" style={{ color: daysLeft <= 2 ? 'var(--color-error)' : 'var(--color-text-tertiary)' }}>
                    {daysLeft}d left
                  </span>
                </div>
                <span className="text-caption">{a.subjectName} • {a.teacherName}</span>
              </div>
            );
          })}
        </div>

        {/* Today's Timetable */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <CalendarIcon size={18} />
            <h3 className="text-h3">Today&apos;s Schedule</h3>
          </div>
          {['Mathematics', 'English', 'Science', 'Hindi', 'Social Studies', 'Computer Science'].map((sub, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-divider)' }}>
              <span className="text-caption" style={{ width: 28 }}>P{i + 1}</span>
              <span className="text-body-sm" style={{ color: 'var(--color-text-primary)' }}>{sub}</span>
            </div>
          ))}
          <button style={{ display: 'block', marginTop: 'var(--space-2)', font: 'var(--text-body-sm)', color: 'var(--color-primary-500)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => onNavigate('timetable')}>
            View Full Timetable →
          </button>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) { .responsive-grid-2 { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
