'use client';

import React from 'react';
import { DEMO_ADMIN_STATS, DEMO_ATTENDANCE_TREND, DEMO_FEE_BY_CLASS } from '@/lib/demo-data';
import { DataCard } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { GraduationCapIcon, UsersIcon, BarChartIcon, CreditCardIcon } from '@/components/ui/Icons';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['var(--color-primary-500)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-info)'];

export default function AdminReports() {
  const genderData = [
    { name: 'Male', value: 243 },
    { name: 'Female', value: 177 },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Reports & Analytics</h2>
      </div>

      <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        <DataCard icon={<GraduationCapIcon size={24} />} value={DEMO_ADMIN_STATS.totalStudents} label="Total Students" color="var(--color-primary-500)" />
        <DataCard icon={<UsersIcon size={24} />} value={DEMO_ADMIN_STATS.totalTeachers} label="Total Teachers" color="var(--color-info)" />
        <DataCard icon={<BarChartIcon size={24} />} value={`${DEMO_ADMIN_STATS.avgAttendance}%`} label="Avg Attendance" color="var(--color-success)" />
        <DataCard icon={<CreditCardIcon size={24} />} value={formatCurrency(DEMO_ADMIN_STATS.totalFeeCollected)} label="Total Collection" color="var(--color-warning)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }} className="responsive-grid-2">
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)' }}>
          <h3 className="text-h3" style={{ marginBottom: 'var(--space-4)' }}>Fee Collection Comparison</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={DEMO_FEE_BY_CLASS}>
              <XAxis dataKey="class" tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13 }} />
              <Bar dataKey="collected" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} barSize={24} name="Collected" />
              <Bar dataKey="target" fill="var(--color-surface-variant)" radius={[4, 4, 0, 0]} barSize={24} name="Target" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)' }}>
          <h3 className="text-h3" style={{ marginBottom: 'var(--space-4)' }}>Student Gender Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={genderData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                {genderData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--color-primary-500)' : 'var(--color-info)'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-primary-500)' }} />
              <span className="text-caption">Male (243)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-info)' }} />
              <span className="text-caption">Female (177)</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .responsive-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
