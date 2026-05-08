'use client';

import React, { useState, useEffect } from 'react';
import { ClassesService } from '@/lib/firestore-service';
import { useSchool } from '@/context/SchoolContext';
import Button, { FAB } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { PlusIcon, SchoolIcon, EditIcon, TrashIcon } from '@/components/ui/Icons';
import type { Class } from '@/types/models';

export default function AdminClasses() {
  const { school } = useSchool();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '', order: 1, sections: 'A,B', academicYear: school?.academicYear || '', subjects: '',
  });

  const resetForm = () => {
    setFormData({ name: '', order: 1, sections: 'A,B', academicYear: school?.academicYear || '', subjects: '' });
  };

  useEffect(() => {
    if (!school?.academicYear) return;
    ClassesService.getAll(school.academicYear).then(data => {
      setClasses(data as unknown as Class[]);
    }).catch(console.error).finally(() => setLoading(false));
  }, [school?.academicYear]);

  const parseSubjects = (subjectsStr: string) => {
    return subjectsStr.split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({
        id: `sub_${name.replace(/\s+/g, '_').toLowerCase()}`,
        name,
        code: name.substring(0, 3).toUpperCase(),
        weeklyPeriods: 5,
      }));
  };

  const handleCreateClass = async () => {
    if (!formData.name) {
      showToast('Please enter a class name');
      return;
    }
    try {
      const sections = formData.sections.split(',').map(s => ({
        id: `sec_${formData.name.replace(/\s/g, '').toLowerCase()}_${s.trim().toLowerCase()}`,
        name: s.trim(),
        classTeacherId: '',
        maxCapacity: 40,
      })).filter(s => s.name);

      const subjects = parseSubjects(formData.subjects);

      await ClassesService.create({
        name: formData.name,
        order: formData.order,
        sections,
        subjects,
        academicYear: formData.academicYear,
      });

      const updated = await ClassesService.getAll(school!.academicYear);
      setClasses(updated as unknown as Class[]);
      setShowAddModal(false);
      resetForm();
      showToast('Class created successfully!');
    } catch (error) {
      console.error('Error creating class:', error);
      showToast('Failed to create class');
    }
  };

  const openEditClass = (cls: Class) => {
    setEditingClass(cls);
    setFormData({
      name: cls.name,
      order: cls.order,
      sections: cls.sections?.map(s => s.name).join(', ') || '',
      academicYear: cls.academicYear,
      subjects: cls.subjects?.map(s => s.name).join(', ') || '',
    });
    setShowEditModal(true);
  };

  const handleEditClass = async () => {
    if (!editingClass) return;
    try {
      // Keep existing section IDs when possible
      const existingSections = editingClass.sections || [];
      const newSectionNames = formData.sections.split(',').map(s => s.trim()).filter(Boolean);
      const sections = newSectionNames.map(name => {
        const existing = existingSections.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing;
        return {
          id: `sec_${editingClass.name.replace(/\s/g, '').toLowerCase()}_${name.toLowerCase()}`,
          name,
          classTeacherId: '',
          maxCapacity: 40,
        };
      });

      // Keep existing subject IDs when possible
      const existingSubjects = editingClass.subjects || [];
      const newSubjectNames = formData.subjects.split(',').map(s => s.trim()).filter(Boolean);
      const subjects = newSubjectNames.map(name => {
        const existing = existingSubjects.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing;
        return {
          id: `sub_${name.replace(/\s+/g, '_').toLowerCase()}`,
          name,
          code: name.substring(0, 3).toUpperCase(),
          weeklyPeriods: 5,
        };
      });

      await ClassesService.update(editingClass.id, {
        name: formData.name,
        order: formData.order,
        sections,
        subjects,
        academicYear: formData.academicYear,
      });

      const updated = await ClassesService.getAll(school!.academicYear);
      setClasses(updated as unknown as Class[]);
      setShowEditModal(false);
      setEditingClass(null);
      resetForm();
      showToast('Class updated successfully!');
    } catch (error) {
      console.error('Error updating class:', error);
      showToast('Failed to update class');
    }
  };

  const handleDeleteClass = async (cls: Class) => {
    if (!confirm(`Are you sure you want to delete ${cls.name}? This will remove all associated data.`)) return;
    try {
      await ClassesService.delete(cls.id);
      setClasses(prev => prev.filter(c => c.id !== cls.id));
      showToast('Class deleted');
    } catch (error) {
      console.error('Error deleting class:', error);
      showToast('Failed to delete class');
    }
  };

  // Shared form for Add/Edit
  const renderFormFields = (isEdit: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Input label="Class Name" placeholder="e.g. Class 1" required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
      <div className="grid-2">
        <Input label="Order" type="number" value={String(formData.order)} onChange={e => setFormData(p => ({ ...p, order: parseInt(e.target.value) || 1 }))} />
        <Input label="Academic Year" value={formData.academicYear} onChange={e => setFormData(p => ({ ...p, academicYear: e.target.value }))} />
      </div>
      <Input label="Sections (comma separated)" placeholder="A, B, C" value={formData.sections} onChange={e => setFormData(p => ({ ...p, sections: e.target.value }))} />
      
      {/* Subjects input */}
      <div>
        <Input label="Subjects (comma separated)" placeholder="Tamil, English, Maths, Science, Social" value={formData.subjects} onChange={e => setFormData(p => ({ ...p, subjects: e.target.value }))} />
        {formData.subjects && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
            {formData.subjects.split(',').map(s => s.trim()).filter(Boolean).map((name, i) => (
              <span key={i} style={{
                padding: '2px 10px', borderRadius: 'var(--radius-full)',
                background: 'var(--color-primary-50)', color: 'var(--color-primary-700)',
                font: 'var(--text-caption)', fontWeight: 600,
              }}>{name}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
        <Button variant="secondary" onClick={() => {
          isEdit ? (setShowEditModal(false), setEditingClass(null)) : setShowAddModal(false);
          resetForm();
        }}>Cancel</Button>
        <Button variant="primary" onClick={isEdit ? handleEditClass : handleCreateClass}>
          {isEdit ? 'Save Changes' : 'Create Class'}
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading classes...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Classes & Sections</h2>
          <p className="text-body-sm">{classes.length} classes</p>
        </div>
        <div className="desktop-only">
          <Button variant="primary" onClick={() => { resetForm(); setShowAddModal(true); }} icon={<PlusIcon size={20} color="white" />}>
            Add Class
          </Button>
        </div>
      </div>

      <div className="grid-3" style={{ gap: 'var(--space-4)' }}>
        {classes.map(cls => (
          <div key={cls.id} style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)',
            border: '1px solid var(--color-border)', transition: 'box-shadow 200ms',
            position: 'relative',
          }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}>
            
            {/* Action buttons — top right */}
            <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 'var(--space-1)' }}>
              <button onClick={() => openEditClass(cls)} style={{
                padding: 6, background: 'var(--color-surface-variant)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-primary-500)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <EditIcon size={14} />
              </button>
              <button onClick={() => handleDeleteClass(cls)} style={{
                padding: 6, background: 'var(--color-surface-variant)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-error)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TrashIcon size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary-50)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-500)',
              }}>
                <SchoolIcon size={20} />
              </div>
              <div>
                <h3 className="text-h3">{cls.name}</h3>
                <p className="text-caption">{cls.academicYear}</p>
              </div>
            </div>
            <div className="divider" />

            {/* Sections */}
            <div style={{ marginTop: 'var(--space-3)' }}>
              <p className="text-caption" style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-tertiary)' }}>Sections</p>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {cls.sections?.map(sec => (
                  <span key={sec.id} style={{
                    padding: '2px 10px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-surface-variant)', font: 'var(--text-caption)',
                    fontWeight: 600,
                  }}>{sec.name}</span>
                ))}
                {(!cls.sections || cls.sections.length === 0) && (
                  <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>No sections</span>
                )}
              </div>
            </div>

            {/* Subjects */}
            <div style={{ marginTop: 'var(--space-3)' }}>
              <p className="text-caption" style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-tertiary)' }}>Subjects</p>
              {cls.subjects && cls.subjects.length > 0 ? (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {cls.subjects.map(s => (
                    <span key={s.id} style={{
                      padding: '2px 10px', borderRadius: 'var(--radius-full)',
                      background: 'var(--color-primary-50)', color: 'var(--color-primary-700)',
                      font: 'var(--text-caption)', fontWeight: 600,
                    }}>{s.name}</span>
                  ))}
                </div>
              ) : (
                <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>No subjects — click edit to add</span>
              )}
            </div>
          </div>
        ))}
        {classes.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)' }}>
            <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No classes created yet. Click &quot;Add Class&quot; to get started.</p>
          </div>
        )}
      </div>

      {/* Add Class Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); resetForm(); }} title="Add New Class" size="md">
        {renderFormFields(false)}
      </Modal>

      {/* Edit Class Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingClass(null); resetForm(); }} title={`Edit ${editingClass?.name || 'Class'}`} size="md">
        {renderFormFields(true)}
      </Modal>

      <div className="mobile-only">
        <FAB icon={<PlusIcon size={24} color="white" />} onClick={() => { resetForm(); setShowAddModal(true); }} label="Add Class" />
      </div>
    </div>
  );
}
