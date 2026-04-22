'use client';

import React from 'react';
import { DataCard, ActionCard } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { DEMO_ADMIN_STATS, DEMO_ATTENDANCE_TREND, DEMO_FEE_BY_CLASS, DEMO_RECENT_ACTIVITY, DEMO_NOTIFICATIONS } from '@/lib/demo-data';
import { getGreeting, formatCompactCurrency } from '@/lib/utils';
import {
  GraduationCapIcon, UsersIcon, BarChartIcon, CreditCardIcon,
  UserPlusIcon, CalendarIcon, ZapIcon, MegaphoneIcon,
  TrendingUpIcon, ClockIcon
} from '@/components/ui/Icons';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

// Icon mapper for activity feed
const activityIcons: Record<string, React.ReactNode> = {
  'user-plus': <UserPlusIcon size={16} />,
  'calendar': <CalendarIcon size={16} />,
  'credit-card': <CreditCardIcon size={16} />,
  'clock': <ClockIcon size={16} />,
  'bar-chart': <BarChartIcon size={16} />,
};

export default function AdminDashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { user } = useAuth();
  const stats = DEMO_ADMIN_STATS;

  return (
    <div className="page-container">
      {/* Greeting */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 className="text-h1">{getGreeting()}, {user?.name?.split(' ')[0]}</h2>
        <p className="text-body-sm" style={{ marginTop: 'var(--space-1)' }}>Academic Year: 2026-27 • Maruti School</p>
      </div>

      {/* Stats Grid */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        <DataCard icon={<GraduationCapIcon size={22} />} value={stats.totalStudents} label="Total Students" color="var(--color-primary-500)" onClick={() => onNavigate('students')} />
        <DataCard icon={<UsersIcon size={22} />} value={stats.totalTeachers} label="Total Teachers" color="var(--color-info)" onClick={() => onNavigate('teachers')} />
        <DataCard icon={<TrendingUpIcon size={22} />} value={`${stats.avgAttendance}%`} label="Avg Attendance" color="var(--color-success)" onClick={() => onNavigate('attendance')} />
        <DataCard icon={<CreditCardIcon size={22} />} value={formatCompactCurrency(stats.totalFeeCollected)} label="Fee Collected" color="var(--color-warning)" onClick={() => onNavigate('fees')} />
      </div>

      {/* Charts + Quick Actions Row */}
      <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {/* Attendance Trend */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <BarChartIcon size={18} />
            <h3 className="text-h3">Attendance Trend (7 days)</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={DEMO_ATTENDANCE_TREND}>
              <XAxis dataKey="day" tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 100]} tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13 }} />
              <Line type="monotone" dataKey="percentage" stroke="var(--color-primary-500)" strokeWidth={2.5} dot={{ fill: 'var(--color-primary-500)', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Actions */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <ZapIcon size={18} />
            <h3 className="text-h3">Quick Actions</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <ActionCard icon={<UserPlusIcon size={18} />} title="Add Student" description="Register new student" onClick={() => onNavigate('students')} />
            <ActionCard icon={<CalendarIcon size={18} />} title="Create Timetable" description="Build class schedule" onClick={() => onNavigate('timetable')} />
            <ActionCard icon={<CreditCardIcon size={18} />} title="Record Payment" description="Enter fee payment" onClick={() => onNavigate('fees')} />
            <ActionCard icon={<MegaphoneIcon size={18} />} title="Send Notification" description="Broadcast to parents" onClick={() => {}} />
          </div>
        </div>
      </div>

      {/* Fee Collection + Activity Row */}
      <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        {/* Fee Collection */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <CreditCardIcon size={18} />
            <h3 className="text-h3">Fee Collection by Class</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={DEMO_FEE_BY_CLASS} layout="vertical">
              <XAxis type="number" tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <YAxis dataKey="class" type="category" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13 }} formatter={(v) => [typeof v === 'number' ? `₹${(v/1000).toFixed(0)}K` : v, '']} />
              <Bar dataKey="collected" fill="var(--color-primary-500)" radius={[0, 4, 4, 0]} barSize={16} />
              <Bar dataKey="target" fill="var(--color-surface-variant)" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <MegaphoneIcon size={18} />
            <h3 className="text-h3">Recent Activity</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {DEMO_RECENT_ACTIVITY.map(act => (
              <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-divider)' }}>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-variant)', flexShrink: 0,
                  fontSize: '0.875rem', color: act.color
                }}>{activityIcons[act.icon] || <MegaphoneIcon size={16} />}</span>
                <div style={{ flex: 1 }}>
                  <p className="text-body-sm" style={{ color: 'var(--color-text-primary)' }}>{act.text}</p>
                  <span className="text-caption">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .responsive-grid-2 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
