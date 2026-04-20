'use client';

import React, { useState } from 'react';
import { DEMO_TEACHERS } from '@/lib/demo-data';
import { SearchInput } from '@/components/ui/Input';
import Button, { FAB } from '@/components/ui/Button';
import { Avatar, Badge } from '@/components/ui/SharedUI';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { PlusIcon, AwardIcon } from '@/components/ui/Icons';

export default function AdminTeachers() {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const { showToast } = useToast();

  const filteredTeachers = DEMO_TEACHERS.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.employeeId.toLowerCase().includes(search.toLowerCase())
  );

  const detail = selected ? DEMO_TEACHERS.find(t => t.id === selected) : null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Teachers</h2>
          <p className="text-body-sm">{filteredTeachers.length} teachers</p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)} icon={<PlusIcon size={20} color="white" />}>Add Teacher</Button>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or employee ID" />
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {filteredTeachers.map(teacher => (
          <div key={teacher.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)', cursor: 'pointer', transition: 'background 100ms' }}
            onClick={() => setSelected(teacher.id)}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-variant)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Avatar name={teacher.name} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ font: 'var(--text-body)', fontWeight: 500 }}>{teacher.name}</div>
              <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>
                {teacher.employeeId} • {teacher.subjectNames?.join(', ')}
              </div>
            </div>
            <div className="desktop-only" style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
              {teacher.assignedClasses.slice(0, 3).map((ac, i) => (
                <Badge key={i} variant="info">{ac.className}-{ac.sectionName}</Badge>
              ))}
              {teacher.assignedClasses.length > 3 && <Badge>+{teacher.assignedClasses.length - 3}</Badge>}
            </div>
            <Badge variant="success">Active</Badge>
          </div>
        ))}
      </div>

      {/* Teacher Detail */}
      <Modal isOpen={!!detail} onClose={() => setSelected(null)} title="Teacher Profile" size="lg">
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <Avatar name={detail.name} size={64} />
              <div>
                <h3 className="text-h2">{detail.name}</h3>
                <p className="text-body-sm">{detail.employeeId} • {detail.email}</p>
              </div>
            </div>
            <div className="divider" />
            <div className="grid-2">
              <div><span className="text-caption">Phone</span><p className="text-body">{detail.phone}</p></div>
              <div><span className="text-caption">Subjects</span><p className="text-body">{detail.subjectNames?.join(', ')}</p></div>
            </div>
            <div>
              <span className="text-caption">Assigned Classes</span>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                {detail.assignedClasses.map((ac, i) => (
                  <div key={i} style={{ background: 'var(--color-primary-50)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', font: 'var(--text-body-sm)' }}>
                    {ac.className}-{ac.sectionName} ({ac.subjectName}) {ac.isClassTeacher && <AwardIcon size={14} style={{ marginLeft: 4 }} />}
                  </div>
                ))}
              </div>
            </div>
            <div className="divider" />
            <div className="grid-3">
              <div style={{ background: 'var(--color-info-bg)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div className="text-h2" style={{ color: 'var(--color-info)' }}>{detail.assignedClasses.length}</div>
                <div className="text-caption">Classes</div>
              </div>
              <div style={{ background: 'var(--color-success-bg)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div className="text-h2" style={{ color: 'var(--color-success)' }}>24</div>
                <div className="text-caption">Periods/Week</div>
              </div>
              <div style={{ background: 'var(--color-warning-bg)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div className="text-h2" style={{ color: 'var(--color-warning)' }}>4.2</div>
                <div className="text-caption">Avg/Day</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Teacher */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add New Teacher" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="grid-2">
            <Input label="Full Name" placeholder="Enter teacher name" />
            <Input label="Employee ID" placeholder="EMP___" />
          </div>
          <div className="grid-2">
            <Input label="Email" type="email" placeholder="teacher@school.edu.in" />
            <Input label="Phone" type="tel" placeholder="+91 XXXXX XXXXX" />
          </div>
          <Select label="Subjects" options={[
            { value: 'sub_math', label: 'Mathematics' }, { value: 'sub_eng', label: 'English' },
            { value: 'sub_sci', label: 'Science' }, { value: 'sub_hindi', label: 'Hindi' },
            { value: 'sub_social', label: 'Social Studies' }, { value: 'sub_cs', label: 'Computer Science' },
          ]} placeholder="Select subject" />
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setShowAdd(false); showToast('Teacher added successfully!'); }}>Add Teacher</Button>
          </div>
        </div>
      </Modal>

      <FAB icon={<PlusIcon size={24} color="white" />} onClick={() => setShowAdd(true)} label="Add Teacher" />
    </div>
  );
}
