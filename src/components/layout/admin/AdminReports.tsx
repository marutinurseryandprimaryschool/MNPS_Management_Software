'use client';

import React, { useState, useEffect } from 'react';
import { StudentsService, TeachersService, FeePaymentsService } from '@/lib/firestore-service';
import { useSchool } from '@/context/SchoolContext';
import { formatCompactCurrency } from '@/lib/utils';
import { BarChartIcon, CreditCardIcon, GraduationCapIcon, UsersIcon } from '@/components/ui/Icons';

export default function AdminReports() {
  const { school } = useSchool();
  const [stats, setStats] = useState({ totalStudents: 0, totalTeachers: 0, totalFee: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!school?.academicYear) return;
    Promise.all([
      StudentsService.getAll(school.academicYear),
      TeachersService.getAll(),
      FeePaymentsService.getAll(school.academicYear),
    ]).then(([students, teachers, payments]) => {
      const totalFee = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      setStats({ totalStudents: students.length, totalTeachers: teachers.length, totalFee });
    }).catch(console.error).finally(() => setLoading(false));
  }, [school?.academicYear]);

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading reports...</span></div></div>;
  }

  const cards = [
    { icon: <GraduationCapIcon size={24} />, label: 'Total Students', value: stats.totalStudents, color: 'var(--color-primary-500)' },
    { icon: <UsersIcon size={24} />, label: 'Total Teachers', value: stats.totalTeachers, color: 'var(--color-info)' },
    { icon: <CreditCardIcon size={24} />, label: 'Total Fee Collected', value: formatCompactCurrency(stats.totalFee), color: 'var(--color-success)' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <BarChartIcon size={24} />
          <h2 className="text-h1">Reports</h2>
        </div>
      </div>

      <div className="grid-3" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {cards.map((card, i) => (
          <div key={i} style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)',
            border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 'var(--radius-md)',
              background: `color-mix(in srgb, ${card.color} 10%, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color,
            }}>{card.icon}</div>
            <div>
              <div className="text-h2">{card.value}</div>
              <div className="text-caption">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)', border: '1px solid var(--color-border)' }}>
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
          Detailed reports and charts will be available as more data is added to the system.
        </p>
      </div>
    </div>
  );
}
