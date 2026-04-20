'use client';

import React from 'react';
import { useSchool } from '@/context/SchoolContext';
import Input from '@/components/ui/Input';
import { SunIcon } from '@/components/ui/Icons';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Tabs } from '@/components/ui/SharedUI';

export default function AdminSettings() {
  const { school } = useSchool();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = React.useState('general');

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Settings</h2>
      </div>

      <Tabs tabs={[
        { id: 'general', label: 'General' },
        { id: 'academic', label: 'Academic' },
        { id: 'appearance', label: 'Appearance' },
      ]} activeTab={activeTab} onChange={setActiveTab} />

      <div style={{ marginTop: 'var(--space-4)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)' }}>
        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '600px' }}>
            <h3 className="text-h3">School Information</h3>
            <Input label="School Name" defaultValue={school.name} />
            <Input label="Address" defaultValue={school.address} />
            <div className="grid-2">
              <Input label="Phone" defaultValue={school.phone} />
              <Input label="Email" defaultValue={school.email} />
            </div>
            <Input label="Academic Year" defaultValue={school.academicYear} />
            <Button variant="primary" onClick={() => showToast('Settings saved!')}>Save Changes</Button>
          </div>
        )}

        {activeTab === 'academic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '600px' }}>
            <h3 className="text-h3">Academic Settings</h3>
            <Input label="Admission Prefix" defaultValue={school.settings.admissionPrefix} />
            <div className="grid-2">
              <Input label="Periods Per Day" type="number" defaultValue={String(school.settings.periodsPerDay)} />
              <Input label="Max Periods/Teacher/Day" type="number" defaultValue={String(school.settings.maxPeriodsPerTeacherPerDay)} />
            </div>
            <Input label="Max Consecutive Periods" type="number" defaultValue={String(school.settings.maxConsecutivePeriods)} />
            <div className="divider" />
            <h3 className="text-h3">Grade Scale</h3>
            {school.settings.gradeScale.map((gs, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ width: 40, font: 'var(--text-body)', fontWeight: 600 }}>{gs.grade}</span>
                <span className="text-caption">{gs.min}% – {gs.max}%</span>
              </div>
            ))}
            <Button variant="primary" onClick={() => showToast('Academic settings saved!')}>Save Changes</Button>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '600px' }}>
            <h3 className="text-h3">Appearance</h3>
            <div>
              <label className="text-body-sm" style={{ fontWeight: 500, display: 'block', marginBottom: 'var(--space-2)' }}>Theme Mode</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button disabled style={{ padding: 'var(--space-3) var(--space-6)', borderRadius: 'var(--radius-sm)', border: '2px solid var(--color-primary-500)', background: 'var(--color-primary-50)', cursor: 'default', font: 'var(--text-body)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <SunIcon size={16} /> Light
                </button>
              </div>
              <p className="text-caption" style={{ marginTop: 'var(--space-2)', color: 'var(--color-text-tertiary)' }}>Light mode is the only available theme.</p>
            </div>
            <div className="divider" />
            <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>More appearance settings coming soon: Accent colors, font preferences, density options.</p>
          </div>
        )}
      </div>
    </div>
  );
}
