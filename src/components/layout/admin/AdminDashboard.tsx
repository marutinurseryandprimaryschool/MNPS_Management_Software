'use client';

import React, { useState, useEffect } from 'react';
import { DataCard, ActionCard } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Badge } from '@/components/ui/SharedUI';
import { StudentsService, TeachersService, ClassesService, NotificationsService } from '@/lib/firestore-service';
import { PrincipalPaymentsService } from '@/lib/principal-service';
import { hasCapability } from '@/lib/permissions';
import { getGreeting, formatCompactCurrency } from '@/lib/utils';
import {
  GraduationCapIcon, UsersIcon, BarChartIcon, CreditCardIcon,
  UserPlusIcon, CalendarIcon, ZapIcon, MegaphoneIcon,
  TrendingUpIcon, ClockIcon
} from '@/components/ui/Icons';

const activityIcons: Record<string, React.ReactNode> = {
  'user-plus': <UserPlusIcon size={16} />,
  'calendar': <CalendarIcon size={16} />,
  'credit-card': <CreditCardIcon size={16} />,
  'clock': <ClockIcon size={16} />,
  'bar-chart': <BarChartIcon size={16} />,
};

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  avgAttendance: number;
  totalFeeCollected: number;
  totalClasses: number;
}

export default function AdminDashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { user, role } = useAuth();
  const { school } = useSchool();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalTeachers: 0,
    avgAttendance: 0,
    totalFeeCollected: 0,
    totalClasses: 0,
  });
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; createdAt: Date }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * The money on this screen is the PRINCIPAL REGISTER's money — the legacy
   * feePayments collection is retired and unrouted, so totalling it here would
   * show Sharmi a number unrelated to the note she types into. Admin and
   * correspondent hold no register capability, so they see no fee figure and
   * get no fee shortcut at all.
   */
  const showsFees = hasCapability(role, 'viewPrincipalRegister');
  const canOpenRegister = hasCapability(role, 'editPrincipalRegister');

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        if (!school?.academicYear) return;
        const [students, teachers, classes, notifs, principalPayments] = await Promise.all([
          StudentsService.getAll(school.academicYear),
          TeachersService.getAll(),
          ClassesService.getAll(school.academicYear),
          NotificationsService.getAll(),
          showsFees
            ? PrincipalPaymentsService.listByYear(school.academicYear)
            : Promise.resolve([]),
        ]);

        // listByYear already drops soft-deleted receipts, so this is the same
        // "collected" figure every register screen shows.
        const totalFee = principalPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        if (cancelled) return;
        setStats({
          totalStudents: students.length,
          totalTeachers: teachers.length,
          avgAttendance: 0,
          totalFeeCollected: totalFee,
          totalClasses: classes.length,
        });
        setLoadError(null);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setNotifications(notifs.slice(0, 5) as any[]);
      } catch (error) {
        // Never silent: a read failure used to render a confident ₹0.
        console.error('Error fetching dashboard data:', error);
        if (!cancelled) {
          setLoadError('Some dashboard figures could not be loaded. Reload the page to try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [school?.academicYear, showsFees]);

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Greeting */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 className="text-h1">{getGreeting()}, {user?.name?.split(' ')[0]}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
          <p className="text-body-sm">Maruti Nursery & Primary School</p>
          <Badge variant="primary">{school.academicYear}</Badge>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)', background: 'var(--color-error-bg)',
            color: 'var(--color-error)', border: '1px solid var(--color-error)',
            fontSize: '0.85rem',
          }}
        >
          {loadError}
        </div>
      )}

      {/* Stats Grid */}
      <div className={showsFees ? 'grid-4' : 'grid-3'} style={{ marginBottom: 'var(--space-6)' }}>
        <DataCard icon={<GraduationCapIcon size={22} />} value={stats.totalStudents} label="Total Students" color="var(--color-primary-500)" onClick={() => onNavigate('students')} />
        <DataCard icon={<UsersIcon size={22} />} value={stats.totalTeachers} label="Total Teachers" color="var(--color-info)" onClick={() => onNavigate('teachers')} />
        <DataCard icon={<TrendingUpIcon size={22} />} value={`${stats.totalClasses}`} label="Total Classes" color="var(--color-success)" onClick={() => onNavigate('classes')} />
        {showsFees && (
          <DataCard icon={<CreditCardIcon size={22} />} value={formatCompactCurrency(stats.totalFeeCollected)} label="Fee Collected" color="var(--color-warning)" onClick={() => onNavigate('principal-accounts')} />
        )}
      </div>

      {/* Quick Actions + Recent Activity Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        {/* Quick Actions */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <ZapIcon size={18} />
            <h3 className="text-h3">Quick Actions</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <ActionCard icon={<UserPlusIcon size={18} />} title="Add Student" description="Register new student" onClick={() => onNavigate('students')} />
            <ActionCard icon={<CalendarIcon size={18} />} title="Create Timetable" description="Build class schedule" onClick={() => onNavigate('timetable')} />
            {canOpenRegister && (
              <ActionCard icon={<CreditCardIcon size={18} />} title="Record Payment" description="Open the fees note" onClick={() => onNavigate('principal-note')} />
            )}
            <ActionCard icon={<MegaphoneIcon size={18} />} title="Manage Users" description="Add teachers & staff" onClick={() => onNavigate('settings')} />
          </div>
        </div>

        {/* Recent Notifications */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <MegaphoneIcon size={18} />
            <h3 className="text-h3">Recent Notifications</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {notifications.length === 0 && (
              <div style={{ padding: 'var(--space-8) 0', textAlign: 'center' }}>
                <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No notifications yet</p>
              </div>
            )}
            {notifications.map((n) => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-divider)' }}>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-variant)', flexShrink: 0,
                  fontSize: '0.875rem', color: 'var(--color-primary-500)'
                }}><MegaphoneIcon size={16} /></span>
                <div style={{ flex: 1 }}>
                  <p className="text-body-sm" style={{ color: 'var(--color-text-primary)' }}>{n.title}</p>
                  <span className="text-caption">{n.body?.slice(0, 80)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
