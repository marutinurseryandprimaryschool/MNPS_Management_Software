'use client';

import React, { useState } from 'react';
import { DEMO_MATERIALS, DEMO_TEACHERS } from '@/lib/demo-data';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input, { Textarea, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatFileSize, getSubjectColor } from '@/lib/utils';

export default function TeacherMaterials() {
  const [showAdd, setShowAdd] = useState(false);
  const { showToast } = useToast();
  const teacher = DEMO_TEACHERS[0];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Study Materials</h2>
          <p className="text-body-sm">{DEMO_MATERIALS.length} materials uploaded</p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)} icon={<span>📁</span>}>Upload Material</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {DEMO_MATERIALS.map(material => {
          const colors = getSubjectColor(material.subjectName || '');
          return (
            <div key={material.id} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', borderLeft: `4px solid ${colors.color}` }}>
              <h3 className="text-h3">{material.title}</h3>
              <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>{material.description}</p>
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <span className="text-caption">📚 {material.subjectName}</span>
                  <span className="text-caption">🏫 {material.className}-{material.sectionName}</span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {material.files.map((file, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-1) var(--space-2)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)', font: 'var(--text-caption)', cursor: 'pointer' }}>
                      📎 {file.name} ({formatFileSize(file.size)})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Upload Study Material" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Title" placeholder="Material title" />
          <Textarea label="Description" placeholder="What is this material about?" rows={2} />
          <Select label="Class-Section" options={teacher.assignedClasses.map(ac => ({ value: `${ac.classId}-${ac.sectionId}`, label: `${ac.className}-${ac.sectionName} (${ac.subjectName})` }))} placeholder="Select class" />
          <div style={{ border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-8)', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📁</div>
            <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>Click to upload or drag files here</p>
            <p className="text-caption">PDF, DOC, PPT, Images (max 10MB)</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setShowAdd(false); showToast('Material uploaded!'); }}>Upload</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
