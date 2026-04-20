'use client';

import React, { useState } from 'react';
import { DEMO_STUDENTS, DEMO_CLASSES } from '@/lib/demo-data';
import { SearchInput, Select } from '@/components/ui/Input';
import Button, { FAB } from '@/components/ui/Button';
import { Avatar, Badge, Tabs } from '@/components/ui/SharedUI';
import Modal from '@/components/ui/Modal';
import Input, { Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { PlusIcon, MoreVerticalIcon } from '@/components/ui/Icons';

export default function AdminStudents() {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const { showToast } = useToast();

  const filteredStudents = DEMO_STUDENTS.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.admissionNumber.toLowerCase().includes(search.toLowerCase());
    const matchClass = !classFilter || s.classId === classFilter;
    return matchSearch && matchClass;
  });

  const studentDetail = selectedStudent ? DEMO_STUDENTS.find(s => s.id === selectedStudent) : null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Students</h2>
          <p className="text-body-sm">{filteredStudents.length} students</p>
        </div>
        <Button variant="primary" onClick={() => setShowAddModal(true)} icon={<PlusIcon size={20} color="white" />}>
          <span className="desktop-only">Add Student</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or admission #" />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <Select
            options={[{ value: '', label: 'All Classes' }, ...DEMO_CLASSES.map(c => ({ value: c.id, label: c.name }))]}
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            fullWidth={true}
          />
        </div>
      </div>

      {/* Student List */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {/* Desktop Table Header */}
        <div className="desktop-only" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 0.5fr', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
          <span className="text-overline">Student</span>
          <span className="text-overline">Class</span>
          <span className="text-overline">Admission #</span>
          <span className="text-overline">Status</span>
          <span className="text-overline" style={{ textAlign: 'right' }}>Actions</span>
        </div>

        {filteredStudents.map(student => (
          <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)', cursor: 'pointer', transition: 'background 100ms' }}
            onClick={() => setSelectedStudent(student.id)}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-variant)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Avatar name={student.name} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: 'var(--text-body)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{student.name}</div>
              <div className="mobile-only" style={{ font: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>
                {student.className} {student.sectionName} • {student.admissionNumber}
              </div>
            </div>
            <span className="desktop-only" style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)', minWidth: '80px' }}>{student.className}-{student.sectionName}</span>
            <span className="desktop-only" style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)', minWidth: '140px' }}>{student.admissionNumber}</span>
            <Badge variant="success">Active</Badge>
            <div style={{ flexShrink: 0, paddingLeft: 'var(--space-2)' }}>
              <button style={{ padding: '0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%' }} onClick={(e) => { e.stopPropagation(); /* show options */ }}>
                <MoreVerticalIcon size={18} />
              </button>
            </div>
          </div>
        ))}
        {filteredStudents.length === 0 && (
          <div className="empty-state">
            <p>No students found.</p>
          </div>
        )}
      </div>

      {/* Student Detail Modal */}
      <Modal isOpen={!!studentDetail} onClose={() => setSelectedStudent(null)} title="Student Profile" size="lg">
        {studentDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <Avatar name={studentDetail.name} size={64} />
              <div>
                <h3 className="text-h2">{studentDetail.name}</h3>
                <p className="text-body-sm">{studentDetail.admissionNumber} • {studentDetail.className}-{studentDetail.sectionName}</p>
              </div>
            </div>
            <div className="divider" />
            <div className="grid-2">
              <div><span className="text-caption">Date of Birth</span><p className="text-body">{studentDetail.dob.toLocaleDateString()}</p></div>
              <div><span className="text-caption">Gender</span><p className="text-body" style={{ textTransform: 'capitalize' }}>{studentDetail.gender}</p></div>
              <div><span className="text-caption">Blood Group</span><p className="text-body">{studentDetail.bloodGroup}</p></div>
              <div><span className="text-caption">Status</span><div><Badge variant="success">Active</Badge></div></div>
            </div>
            <div><span className="text-caption">Address</span><p className="text-body">{studentDetail.address}</p></div>
            <div className="divider" />
            <div className="grid-3">
              <div style={{ background: 'var(--color-success-bg)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div className="text-h2" style={{ color: 'var(--color-success)' }}>92%</div>
                <div className="text-caption">Attendance</div>
              </div>
              <div style={{ background: 'var(--color-info-bg)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div className="text-h2" style={{ color: 'var(--color-info)' }}>B+</div>
                <div className="text-caption">Avg Grade</div>
              </div>
              <div style={{ background: 'var(--color-warning-bg)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div className="text-h2" style={{ color: 'var(--color-warning)' }}>₹14K</div>
                <div className="text-caption">Fee Pending</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Student Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Student" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="grid-2">
            <Input label="Full Name" placeholder="Enter student name" required />
            <Input label="Date of Birth" type="date" required />
          </div>
          <div className="grid-2">
            <Select label="Gender" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} placeholder="Select gender" />
            <Select label="Blood Group" options={['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(b => ({ value: b, label: b }))} placeholder="Select" />
          </div>
          <div className="grid-2">
            <Select label="Class" options={DEMO_CLASSES.map(c => ({ value: c.id, label: c.name }))} placeholder="Select class" />
            <Select label="Section" options={[{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }]} placeholder="Select section" />
          </div>
          <Textarea label="Address" placeholder="Enter address" rows={2} />
          <div className="divider" />
          <h3 className="text-h3">Parent Details</h3>
          <div className="grid-2">
            <Input label="Parent Name" placeholder="Enter parent name" />
            <Input label="Phone Number" placeholder="+91 XXXXX XXXXX" type="tel" />
          </div>
          <Input label="Email" placeholder="parent@email.com" type="email" />
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setShowAddModal(false); showToast('Student created successfully!'); }}>Create Student</Button>
          </div>
        </div>
      </Modal>

      <div className="mobile-only">
        <FAB icon={<PlusIcon size={24} color="white" />} onClick={() => setShowAddModal(true)} label="Add Student" />
      </div>
    </div>
  );
}
