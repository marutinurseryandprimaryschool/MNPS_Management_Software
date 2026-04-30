'use client';

import React, { useState, useEffect } from 'react';
import { AssignmentsService, TeachersService, ClassesService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input, { Textarea, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { PlusIcon, EditIcon, TrashIcon } from '@/components/ui/Icons';
import { Badge } from '@/components/ui/SharedUI';
import type { Assignment, Teacher, Class } from '@/types/models';

export default function TeacherAssignments() {
  const { user } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '', classId: '', sectionId: '', dueDate: '' });

  useEffect(() => {
    async function fetchData() {
      try {
        if (!user || !school?.academicYear) return;
        const teacherData = await TeachersService.getByUserId(user.uid || user.id, school.academicYear);
        setTeacher(teacherData as unknown as Teacher | null);
        const allAssignments = await AssignmentsService.getAll();
        setAssignments(allAssignments as unknown as Assignment[]);
        const classesData = await ClassesService.getAll(school.academicYear);
        setClasses(classesData as unknown as Class[]);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, school?.academicYear]);

  const handleCreate = async () => {
    if (!formData.title || !formData.classId) { showToast('Fill required fields'); return; }
    try {
      const cls = classes.find(c => c.id === formData.classId);
      await AssignmentsService.create({
        title: formData.title,
        description: formData.description,
        classId: formData.classId,
        sectionId: formData.sectionId,
        subjectId: '',
        teacherId: teacher?.id || '',
        dueDate: formData.dueDate ? new Date(formData.dueDate) : new Date(),
        attachments: [],
        status: 'active',
        className: cls?.name || '',
        sectionName: cls?.sections.find(s => s.id === formData.sectionId)?.name || '',
        academicYear: school.academicYear,
      });
      const updated = await AssignmentsService.getAll();
      setAssignments(updated as unknown as Assignment[]);
      setShowAddModal(false);
      setFormData({ title: '', description: '', classId: '', sectionId: '', dueDate: '' });
      showToast('Assignment created!');
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to create assignment');
    }
  };

  const openEditModal = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      title: assignment.title,
      description: assignment.description || '',
      classId: assignment.classId,
      sectionId: assignment.sectionId,
      dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : ''
    });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!editingAssignment || !formData.title || !formData.classId) {
      showToast('Fill required fields');
      return;
    }
    try {
      const cls = classes.find(c => c.id === formData.classId);
      await AssignmentsService.update(editingAssignment.id, {
        title: formData.title,
        description: formData.description,
        classId: formData.classId,
        sectionId: formData.sectionId,
        className: cls?.name || '',
        sectionName: cls?.sections.find(s => s.id === formData.sectionId)?.name || '',
        dueDate: formData.dueDate ? new Date(formData.dueDate) : new Date(),
      });
      const updated = await AssignmentsService.getAll();
      setAssignments(updated as unknown as Assignment[]);
      setShowEditModal(false);
      setEditingAssignment(null);
      setFormData({ title: '', description: '', classId: '', sectionId: '', dueDate: '' });
      showToast('Assignment updated!');
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to update assignment');
    }
  };

  const handleDelete = async (assignmentId: string) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;
    try {
      await AssignmentsService.delete(assignmentId);
      const updated = await AssignmentsService.getAll();
      setAssignments(updated as unknown as Assignment[]);
      showToast('Assignment deleted!');
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to delete assignment');
    }
  };

  const selectedClassData = classes.find(c => c.id === formData.classId);

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Assignments</h2>
          <p className="text-body-sm">{assignments.length} assignments</p>
        </div>
        <Button variant="primary" onClick={() => setShowAddModal(true)} icon={<PlusIcon size={20} color="white" />}>Create</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {assignments.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
            <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No assignments yet. Create one to get started.</p>
          </div>
        )}
        {assignments.map(a => (
          <div key={a.id} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 className="text-h3">{a.title}</h3>
                <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{a.className}-{a.sectionName} • Due: {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Badge variant={a.status === 'active' ? 'success' : 'default'}>{a.status}</Badge>
                <button onClick={() => openEditModal(a)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-500)' }}>
                  <EditIcon size={16} />
                </button>
                <button onClick={() => handleDelete(a.id)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}>
                  <TrashIcon size={16} />
                </button>
              </div>
            </div>
            {a.description && <p className="text-body-sm" style={{ marginTop: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>{a.description}</p>}
          </div>
        ))}
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Create Assignment" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Title" required value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} />
          <Textarea label="Description" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={3} />
          <div className="grid-2">
            <Select label="Class" options={[{ value: '', label: 'Select' }, ...classes.map(c => ({ value: c.id, label: c.name }))]} value={formData.classId} onChange={e => setFormData(p => ({ ...p, classId: e.target.value, sectionId: '' }))} />
            <Select label="Section" options={[{ value: '', label: 'Select' }, ...(selectedClassData?.sections.map(s => ({ value: s.id, label: s.name })) || [])]} value={formData.sectionId} onChange={e => setFormData(p => ({ ...p, sectionId: e.target.value }))} />
          </div>
          <Input label="Due Date" type="date" value={formData.dueDate} onChange={e => setFormData(p => ({ ...p, dueDate: e.target.value }))} />
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingAssignment(null); }} title="Edit Assignment" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Title" required value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} />
          <Textarea label="Description" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={3} />
          <div className="grid-2">
            <Select label="Class" options={[{ value: '', label: 'Select' }, ...classes.map(c => ({ value: c.id, label: c.name }))]} value={formData.classId} onChange={e => setFormData(p => ({ ...p, classId: e.target.value, sectionId: '' }))} />
            <Select label="Section" options={[{ value: '', label: 'Select' }, ...(classes.find(c => c.id === formData.classId)?.sections.map(s => ({ value: s.id, label: s.name })) || [])]} value={formData.sectionId} onChange={e => setFormData(p => ({ ...p, sectionId: e.target.value }))} />
          </div>
          <Input label="Due Date" type="date" value={formData.dueDate} onChange={e => setFormData(p => ({ ...p, dueDate: e.target.value }))} />
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => { setShowEditModal(false); setEditingAssignment(null); }}>Cancel</Button>
            <Button variant="primary" onClick={handleEdit}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
