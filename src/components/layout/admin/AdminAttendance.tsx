'use client';

import React, { useState } from 'react';
import { DEMO_ATTENDANCE, DEMO_STUDENTS, DEMO_CLASSES } from '@/lib/demo-data';
import { Select } from '@/components/ui/Input';
import { Badge, Tabs } from '@/components/ui/SharedUI';
import { AttendanceStatus } from '@/types/enums';
import { DataCard } from '@/components/ui/Card';
import { BarChartIcon, CheckCircleIcon, XCircleIcon, UsersIcon } from '@/components/ui/Icons';

export default function AdminAttendance() {
  const [selectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('class_005');
  const attendance = DEMO_ATTENDANCE[0];

  const present = attendance?.records.filter(r => r.status === AttendanceStatus.PRESENT).length || 0;
  const absent = attendance?.records.filter(r => r.status === AttendanceStatus.ABSENT).length || 0;
  const total = attendance?.records.length || 0;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Attendance</h2>
          <p className="text-body-sm">{selectedDate}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <input type="date" defaultValue={selectedDate} style={{ height: 40, padding: '0 12px', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-variant)', font: 'var(--text-body)', color: 'var(--color-text-primary)' }} />
        <Select options={DEMO_CLASSES.map(c => ({ value: c.id, label: c.name }))} value={selectedClass} onChange={e => setSelectedClass(e.target.value)} fullWidth={false} style={{ width: '140px' }} />
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-4)' }}>
        <DataCard icon={<BarChartIcon size={24} />} value={`${percentage}%`} label="Attendance Rate" color="var(--color-primary-500)" />
        <DataCard icon={<CheckCircleIcon size={24} />} value={present} label="Present" color="var(--color-success)" />
        <DataCard icon={<XCircleIcon size={24} />} value={absent} label="Absent" color="var(--color-error)" />
        <DataCard icon={<UsersIcon size={24} />} value={total} label="Total Students" color="var(--color-info)" />
      </div>

      {/* Attendance Records */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
          <span className="text-overline">Class 5-A • Period 1 — Mathematics (Rajesh Kumar)</span>
        </div>
        {attendance?.records.map(record => (
          <div key={record.studentId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
            <span className="text-body">{record.studentName}</span>
            <Badge variant={record.status === AttendanceStatus.PRESENT ? 'success' : record.status === AttendanceStatus.LATE ? 'warning' : 'error'}>
              {record.status.toUpperCase()}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
