'use client';

import React from 'react';
import { DEMO_ATTENDANCE } from '@/lib/demo-data';
import { Badge } from '@/components/ui/SharedUI';
import { DataCard } from '@/components/ui/Card';
import { BarChartIcon, CheckCircleIcon, XCircleIcon } from '@/components/ui/Icons';
import { AttendanceStatus } from '@/types/enums';

export default function ParentAttendance() {
  const attendance = DEMO_ATTENDANCE[0];
  const childRecord = attendance?.records[0]; // demo: first student
  const monthlyData = [
    { date: 'Apr 01', status: 'present' }, { date: 'Apr 02', status: 'present' },
    { date: 'Apr 03', status: 'absent' }, { date: 'Apr 04', status: 'present' },
    { date: 'Apr 05', status: 'present' }, { date: 'Apr 07', status: 'present' },
    { date: 'Apr 08', status: 'late' }, { date: 'Apr 09', status: 'present' },
    { date: 'Apr 10', status: 'present' }, { date: 'Apr 11', status: 'present' },
    { date: 'Apr 12', status: 'present' }, { date: 'Apr 13', status: 'present' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Attendance</h2>
      </div>

      <div className="grid-3" style={{ marginBottom: 'var(--space-4)' }}>
        <DataCard icon={<BarChartIcon size={24} />} value="92%" label="This Month" color="var(--color-success)" />
        <DataCard icon={<CheckCircleIcon size={24} />} value="11" label="Days Present" color="var(--color-primary-500)" />
        <DataCard icon={<XCircleIcon size={24} />} value="1" label="Days Absent" color="var(--color-error)" />
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)' }}>
        <h3 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>April 2026</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-2)' }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} style={{ textAlign: 'center', font: 'var(--text-overline)' }}>{d}</div>
          ))}
          {monthlyData.map((day, i) => (
            <div key={i} style={{ textAlign: 'center', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', background: day.status === 'present' ? 'var(--color-success-bg)' : day.status === 'absent' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', cursor: 'pointer' }}>
              <span style={{ font: 'var(--text-body-sm)', fontWeight: 500, color: day.status === 'present' ? 'var(--color-success)' : day.status === 'absent' ? 'var(--color-error)' : 'var(--color-warning)' }}>{day.date.split(' ')[1]}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-success)' }} /><span className="text-caption">Present</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-error)' }} /><span className="text-caption">Absent</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-warning)' }} /><span className="text-caption">Late</span></div>
        </div>
      </div>
    </div>
  );
}
