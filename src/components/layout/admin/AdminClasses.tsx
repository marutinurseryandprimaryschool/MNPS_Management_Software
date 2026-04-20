'use client';

import React, { useState } from 'react';
import { DEMO_CLASSES } from '@/lib/demo-data';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/SharedUI';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export default function AdminClasses() {
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { showToast } = useToast();

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Classes & Sections</h2>
          <p className="text-body-sm">{DEMO_CLASSES.length} classes</p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)} icon={<span>+</span>}>Add Class</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {DEMO_CLASSES.map(cls => (
          <div key={cls.id} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', cursor: 'pointer' }}
              onClick={() => setExpanded(expanded === cls.id ? null : cls.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--color-primary-50)', color: 'var(--color-primary-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem' }}>
                  {cls.name.split(' ')[1]}
                </div>
                <div>
                  <h3 className="text-h3">{cls.name}</h3>
                  <p className="text-caption">{cls.sections.length} sections • {cls.subjects.length} subjects</p>
                </div>
              </div>
              <span style={{ transition: 'transform 200ms', transform: expanded === cls.id ? 'rotate(180deg)' : 'none', color: 'var(--color-text-tertiary)' }}>▾</span>
            </div>

            {expanded === cls.id && (
              <div style={{ padding: '0 var(--space-4) var(--space-4)', animation: 'fade-in-up 150ms ease-out' }}>
                <div className="divider" />
                {/* Sections */}
                <h4 className="text-overline" style={{ marginBottom: 'var(--space-2)' }}>Sections</h4>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                  {cls.sections.map(sec => (
                    <div key={sec.id} style={{ background: 'var(--color-surface-variant)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ fontWeight: 600 }}>{cls.name}-{sec.name}</span>
                      <Badge variant="default">Cap: {sec.maxCapacity}</Badge>
                    </div>
                  ))}
                </div>

                {/* Subjects */}
                <h4 className="text-overline" style={{ marginBottom: 'var(--space-2)' }}>Subjects</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-2)' }}>
                  {cls.subjects.map(sub => (
                    <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)' }}>
                      <span className="text-body-sm">{sub.name}</span>
                      <Badge variant="info">{sub.weeklyPeriods}p/w</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add New Class" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Class Name" placeholder="e.g. Class 6" />
          <Input label="Display Order" type="number" placeholder="6" />
          <div className="divider" />
          <h4 className="text-h3">Sections</h4>
          <div className="grid-2">
            <Input label="Section Name" placeholder="A" />
            <Input label="Max Capacity" type="number" placeholder="40" />
          </div>
          <Button variant="ghost" onClick={() => showToast('Add another section', 'info')}>+ Add Another Section</Button>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setShowAdd(false); showToast('Class created!'); }}>Create Class</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
