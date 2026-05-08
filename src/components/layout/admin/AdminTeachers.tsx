'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TeachersService, UsersService, ClassesService } from '@/lib/firestore-service';
import { useSchool } from '@/context/SchoolContext';
import { SearchInput } from '@/components/ui/Input';
import Button, { FAB } from '@/components/ui/Button';
import { Avatar, Badge } from '@/components/ui/SharedUI';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { PlusIcon, EditIcon, TrashIcon, CheckCircleIcon } from '@/components/ui/Icons';
import type { Teacher, Class, TeacherAssignment } from '@/types/models';

// ── Pill component for multi-select chips ──
function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 12px',
        borderRadius: 'var(--radius-full)',
        border: selected ? '2px solid var(--color-primary-500)' : '1px solid var(--color-border)',
        background: selected ? 'var(--color-primary-50)' : 'var(--color-surface)',
        color: selected ? 'var(--color-primary-700)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        font: 'var(--text-caption)',
        fontWeight: selected ? 600 : 400,
        transition: 'all 150ms',
      }}
    >
      {label}
    </button>
  );
}

export default function AdminTeachers() {
  const { school } = useSchool();
  const [search, setSearch] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', employeeId: '',
  });
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedAssignments, setSelectedAssignments] = useState<TeacherAssignment[]>([]);
  const [classTeacherAssignment, setClassTeacherAssignment] = useState<{ classId: string; sectionId: string } | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Build a unique subjects list from all classes
  const allSubjects = React.useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach(c => {
      c.subjects?.forEach(s => {
        if (!map.has(s.id)) map.set(s.id, s.name);
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classes]);

  const fetchData = useCallback(async () => {
    try {
      if (!school?.academicYear) return;
      const [teacherData, classData, assignmentData] = await Promise.all([
        TeachersService.getAll(),
        ClassesService.getAll(school.academicYear),
        TeachersService.getAllAssignments(school.academicYear)
      ]);

      const mergedTeachers = (teacherData as any[]).map(t => {
        const myAssignments = assignmentData.find(a => a.teacherId === t.id);
        return {
          ...t,
          assignedClasses: myAssignments?.assignments || []
        };
      });

      setTeachers(mergedTeachers as unknown as Teacher[]);
      setAllAssignments(assignmentData);
      setClasses(classData as unknown as Class[]);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [school?.academicYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredTeachers = teachers.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.email?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subjectId) ? prev.filter(s => s !== subjectId) : [...prev, subjectId]
    );
  };

  const toggleAssignment = (classId: string, sectionId: string, className: string, sectionName: string) => {
    setSelectedAssignments(prev => {
      const exists = prev.find(a => a.classId === classId && a.sectionId === sectionId);
      if (exists) {
        // If removing an assignment that is currently designated as class teacher, clear it
        if (classTeacherAssignment?.classId === classId && classTeacherAssignment?.sectionId === sectionId) {
          setClassTeacherAssignment(null);
        }
        return prev.filter(a => !(a.classId === classId && a.sectionId === sectionId));
      }
      return [...prev, { classId, sectionId, subjectId: '', isClassTeacher: false, className, sectionName }];
    });
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', employeeId: '' });
    setSelectedSubjects([]);
    setSelectedAssignments([]);
    setClassTeacherAssignment(null);
  };

  const handleCreateTeacher = async () => {
    if (!formData.name || !formData.email) {
      showToast('Please fill Name and Email');
      return;
    }
    try {
      const existingUser = await UsersService.getByEmail(formData.email);
      const finalAssignments = [...selectedAssignments];
      
      if (classTeacherAssignment) {
        const alreadyInAssignments = finalAssignments.find(a => a.classId === classTeacherAssignment.classId && a.sectionId === classTeacherAssignment.sectionId);
        if (alreadyInAssignments) {
          alreadyInAssignments.isClassTeacher = true;
        } else {
          const cls = classes.find(c => c.id === classTeacherAssignment.classId);
          const sec = cls?.sections.find(s => s.id === classTeacherAssignment.sectionId);
          finalAssignments.push({
            classId: classTeacherAssignment.classId,
            sectionId: classTeacherAssignment.sectionId,
            subjectId: '',
            isClassTeacher: true,
            className: cls?.name,
            sectionName: sec?.name
          });
        }
      }

      const subjectNames = selectedSubjects.map(id => allSubjects.find(s => s.id === id)?.name || '');

      const teacherId = await TeachersService.create({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        employeeId: formData.employeeId || `EMP${String(teachers.length + 1).padStart(3, '0')}`,
        userId: existingUser?.id || '',
        photo: '',
        subjects: selectedSubjects,
        subjectNames,
        assignedClasses: [], // Keep empty on main object
        availability: {},
        status: 'active',
      });

      // Save year-specific assignments
      await TeachersService.updateAssignments(teacherId, school.academicYear, finalAssignments);

      if (!existingUser) {
        await UsersService.create({
          name: formData.name,
          email: formData.email,
          role: 'teacher',
          phone: formData.phone,
          status: 'pending',
          photo: '',
          uid: '',
          teacherId,
        });
      }

      await fetchData();
      setShowAddModal(false);
      resetForm();
      showToast('Teacher added successfully!');
    } catch (error) {
      console.error('Error creating teacher:', error);
      showToast('Failed to add teacher');
    }
  };

  const openEditTeacher = (t: Teacher) => {
    setEditingTeacher(t);
    setFormData({ name: t.name, email: t.email || '', phone: t.phone || '', employeeId: t.employeeId || '' });
    setSelectedSubjects(t.subjects || []);
    setSelectedAssignments(t.assignedClasses || []);
    
    const ct = t.assignedClasses?.find(a => a.isClassTeacher);
    setClassTeacherAssignment(ct ? { classId: ct.classId, sectionId: ct.sectionId } : null);
    
    setShowEditModal(true);
  };

  const handleEditTeacher = async () => {
    if (!editingTeacher) return;
    try {
      const finalAssignments = [...selectedAssignments];
      
      if (classTeacherAssignment) {
        const alreadyInAssignments = finalAssignments.find(a => a.classId === classTeacherAssignment.classId && a.sectionId === classTeacherAssignment.sectionId);
        if (alreadyInAssignments) {
          alreadyInAssignments.isClassTeacher = true;
        } else {
          const cls = classes.find(c => c.id === classTeacherAssignment.classId);
          const sec = cls?.sections.find(s => s.id === classTeacherAssignment.sectionId);
          finalAssignments.push({
            classId: classTeacherAssignment.classId,
            sectionId: classTeacherAssignment.sectionId,
            subjectId: '',
            isClassTeacher: true,
            className: cls?.name,
            sectionName: sec?.name
          });
        }
      }
      
      // Clear isClassTeacher for all others
      finalAssignments.forEach(a => {
        if (classTeacherAssignment?.classId !== a.classId || classTeacherAssignment?.sectionId !== a.sectionId) {
          a.isClassTeacher = false;
        }
      });

      const subjectNames = selectedSubjects.map(id => allSubjects.find(s => s.id === id)?.name || '');

      await TeachersService.update(editingTeacher.id, {
        name: formData.name,
        phone: formData.phone,
        employeeId: formData.employeeId,
        subjects: selectedSubjects,
        subjectNames,
      });

      await TeachersService.updateAssignments(editingTeacher.id, school.academicYear, finalAssignments);

      const user = await UsersService.getByEmail(editingTeacher.email || '');
      if (user) {
        await UsersService.update(user.id, { name: formData.name, phone: formData.phone });
      }
      await fetchData();
      setShowEditModal(false);
      setEditingTeacher(null);
      setSelectedTeacher(null);
      showToast('Teacher updated!');
    } catch (error) {
      console.error('Error updating teacher:', error);
      showToast('Failed to update teacher');
    }
  };

  const handleDeleteTeacher = async (t: Teacher) => {
    if (!confirm(`Are you sure you want to remove ${t.name}?`)) return;
    try {
      await TeachersService.delete(t.id);
      setTeachers(prev => prev.filter(x => x.id !== t.id));
      setSelectedTeacher(null);
      showToast('Teacher removed');
    } catch (error) {
      console.error('Error deleting teacher:', error);
      showToast('Failed to remove teacher');
    }
  };

  // ── Shared form fields for Add/Edit ──
  const renderFormFields = (isEdit: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Input label="Full Name" placeholder="Enter teacher name" required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
      <Input label="Email" placeholder="teacher@email.com" type="email" required value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} disabled={isEdit} />
      <div className="grid-2">
        <Input label="Phone" placeholder="+91 XXXXX XXXXX" type="tel" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} />
        <Input label="Employee ID" placeholder="EMP001" value={formData.employeeId} onChange={e => setFormData(p => ({ ...p, employeeId: e.target.value }))} />
      </div>

      {/* Subjects multi-select */}
      <div>
        <label className="text-body-sm" style={{ fontWeight: 500, display: 'block', marginBottom: 'var(--space-2)' }}>Subjects</label>
        {allSubjects.length === 0 ? (
          <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>No subjects available. Add subjects in Classes first.</p>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {allSubjects.map(sub => (
              <Pill key={sub.id} label={sub.name} selected={selectedSubjects.includes(sub.id)} onClick={() => toggleSubject(sub.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Class/Section multi-select */}
      <div>
        <label className="text-body-sm" style={{ fontWeight: 500, display: 'block', marginBottom: 'var(--space-2)' }}>Assign to Classes & Sections</label>
        {classes.length === 0 ? (
          <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>No classes available. Create classes first.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {classes.map(cls => (
              <div key={cls.id}>
                <span className="text-caption" style={{ fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{cls.name}</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {cls.sections?.map(sec => {
                    const isSelected = selectedAssignments.some(a => a.classId === cls.id && a.sectionId === sec.id);
                    return (
                      <Pill
                        key={sec.id}
                        label={`Section ${sec.name}`}
                        selected={isSelected}
                        onClick={() => toggleAssignment(cls.id, sec.id, cls.name, sec.name)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Class Teacher Designation */}
      <div>
        <label className="text-body-sm" style={{ fontWeight: 600, display: 'block', marginBottom: 'var(--space-2)' }}>Assign as Class Teacher</label>
        <div style={{ padding: 'var(--space-4)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <p className="text-caption" style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-tertiary)' }}>Choose one class that this teacher will lead officially.</p>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>
              <Pill 
                label="No Class Assigned" 
                selected={classTeacherAssignment === null} 
                onClick={() => setClassTeacherAssignment(null)} 
              />
            </div>
            {classes.map(cls => (
              <div key={cls.id}>
                <span className="text-caption" style={{ fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{cls.name}</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {cls.sections?.map(sec => {
                    const isSelected = classTeacherAssignment?.classId === cls.id && classTeacherAssignment?.sectionId === sec.id;
                    return (
                      <Pill 
                        key={sec.id} 
                        label={`Section ${sec.name}`} 
                        selected={isSelected} 
                        onClick={() => setClassTeacherAssignment({ classId: cls.id, sectionId: sec.id })} 
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
        <Button variant="secondary" onClick={() => {
          isEdit ? (setShowEditModal(false), setEditingTeacher(null)) : setShowAddModal(false);
          resetForm();
        }}>Cancel</Button>
        <Button variant="primary" onClick={isEdit ? handleEditTeacher : handleCreateTeacher}>
          {isEdit ? 'Save Changes' : 'Add Teacher'}
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading teachers...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Teachers</h2>
          <p className="text-body-sm">{filteredTeachers.length} teachers</p>
        </div>
        <div className="desktop-only">
          <Button variant="primary" onClick={() => { resetForm(); setShowAddModal(true); }} icon={<PlusIcon size={20} color="white" />}>
            Add Teacher
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-4)', maxWidth: 400 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search teachers..." />
      </div>

      <div className="hide-scrollbar" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto', border: '1px solid var(--color-border)' }}>
        <div style={{ minWidth: 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.2fr 1fr 80px', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
            <span className="text-overline">Teacher</span>
            <span className="text-overline">Email</span>
            <span className="text-overline">Employee ID</span>
            <span className="text-overline">Status</span>
            <span className="text-overline" style={{ textAlign: 'right' }}>Actions</span>
          </div>

        {filteredTeachers.map(teacher => (
          <div key={teacher.id} style={{
            display: 'grid', gridTemplateColumns: '2fr 2fr 1.2fr 1fr 80px', gap: 'var(--space-4)',
            alignItems: 'center',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--color-divider)',
            cursor: 'pointer', transition: 'background 100ms',
          }}
            onClick={() => setSelectedTeacher(teacher)}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-variant)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
              <Avatar name={teacher.name} size={36} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ font: 'var(--text-body)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teacher.name}</span>
                {teacher.assignedClasses?.some(a => a.isClassTeacher) && (
                  <span className="text-caption" style={{ color: 'var(--color-success-600)', fontWeight: 600 }}>Class Teacher</span>
                )}
              </div>
            </div>
            <span style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teacher.email}</span>
            <span style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)' }}>{teacher.employeeId}</span>
            <div><Badge variant={teacher.status === 'active' ? 'success' : 'default'}>{teacher.status}</Badge></div>
            <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
              <button style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-500)' }} onClick={e => { e.stopPropagation(); openEditTeacher(teacher); }}>
                <EditIcon size={16} />
              </button>
              <button style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }} onClick={e => { e.stopPropagation(); handleDeleteTeacher(teacher); }}>
                <TrashIcon size={16} />
              </button>
            </div>
          </div>
        ))}
        {filteredTeachers.length === 0 && (
          <div className="empty-state"><p>{teachers.length === 0 ? 'No teachers added yet.' : 'No teachers match your search.'}</p></div>
        )}
        </div>
      </div>

      {/* ===== Teacher Profile Modal ===== */}
      <Modal isOpen={!!selectedTeacher} onClose={() => setSelectedTeacher(null)} title="Teacher Profile" size="lg">
        {selectedTeacher && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-lg)' }}>
              <Avatar name={selectedTeacher.name} size={64} />
              <div style={{ flex: '1 1 0%', minWidth: 200 }}>
                <h3 className="text-h2" style={{ margin: 0 }}>{selectedTeacher.name}</h3>
                <p className="text-body-sm" style={{ margin: 0, color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>{selectedTeacher.employeeId} • {selectedTeacher.email}</p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', flex: '1 1 auto' }}>
                <Button variant="secondary" onClick={() => { setSelectedTeacher(null); openEditTeacher(selectedTeacher); }} icon={<EditIcon size={16} />} style={{ flex: '1 1 0%', justifyContent: 'center' }}>Edit</Button>
                <Button variant="secondary" onClick={() => handleDeleteTeacher(selectedTeacher)} icon={<TrashIcon size={16} />} style={{ flex: '1 1 0%', justifyContent: 'center' }}>Delete</Button>
              </div>
            </div>

            {/* Details */}
            <div className="grid-2">
              <div><span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Phone</span><p className="text-body" style={{ margin: '4px 0 0' }}>{selectedTeacher.phone || 'N/A'}</p></div>
              <div><span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Status</span><div style={{ marginTop: 4 }}><Badge variant={selectedTeacher.status === 'active' ? 'success' : 'default'}>{selectedTeacher.status}</Badge></div></div>
            </div>

            <div className="divider" />

            {/* Subjects */}
            <div>
              <span className="text-overline" style={{ color: 'var(--color-primary-500)', marginBottom: 'var(--space-2)', display: 'block' }}>Subjects</span>
              {selectedTeacher.subjectNames && selectedTeacher.subjectNames.length > 0 ? (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {selectedTeacher.subjectNames.map((name, i) => (
                    <span key={i} style={{
                      padding: '4px 12px', borderRadius: 'var(--radius-full)',
                      background: 'var(--color-primary-50)', color: 'var(--color-primary-700)',
                      font: 'var(--text-caption)', fontWeight: 600,
                    }}>{name}</span>
                  ))}
                </div>
              ) : (
                <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>No subjects assigned</p>
              )}
            </div>

            {/* Assigned Classes */}
            <div>
              <span className="text-overline" style={{ color: 'var(--color-primary-500)', marginBottom: 'var(--space-2)', display: 'block' }}>Assigned Classes</span>
              {selectedTeacher.assignedClasses && selectedTeacher.assignedClasses.length > 0 ? (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {selectedTeacher.assignedClasses.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Badge variant={a.isClassTeacher ? 'success' : 'info'} size="sm">
                        {a.className} — Section {a.sectionName}
                        {a.isClassTeacher && ' (Class Teacher)'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>No classes assigned</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ===== Add Teacher Modal ===== */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); resetForm(); }} title="Add New Teacher" size="lg">
        {renderFormFields(false)}
      </Modal>

      {/* ===== Edit Teacher Modal ===== */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingTeacher(null); resetForm(); }} title="Edit Teacher" size="lg">
        {renderFormFields(true)}
      </Modal>

      <div className="mobile-only">
        <FAB icon={<PlusIcon size={24} color="white" />} onClick={() => { resetForm(); setShowAddModal(true); }} label="Add Teacher" />
      </div>
    </div>
  );
}
