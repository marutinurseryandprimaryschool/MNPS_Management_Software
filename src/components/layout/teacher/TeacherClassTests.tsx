'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ClassTestsService, StudentsService, TeachersService, ClassesService,
} from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Select } from '@/components/ui/Input';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Avatar, Badge } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';
import { PlusIcon, TrashIcon, EditIcon } from '@/components/ui/Icons';
import type { Student, Teacher, Class, ClassTest, ClassTestRecord } from '@/types/models';

export default function TeacherClassTests() {
  const { user } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [tests, setTests] = useState<ClassTest[]>([]);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newTest, setNewTest] = useState({ testName: '', testDate: new Date().toISOString().split('T')[0], maxMarks: 20 });

  const [editingTest, setEditingTest] = useState<ClassTest | null>(null);
  const [editMarks, setEditMarks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        if (!user || !school?.academicYear) return;
        const [classesData, studentsData] = await Promise.all([
          ClassesService.getAll(school.academicYear),
          StudentsService.getAll(school.academicYear),
        ]);
        let teacherData = await TeachersService.getByUserId(user.uid || user.id, school.academicYear);
        if (!teacherData && user.email) {
          teacherData = await TeachersService.getByEmail(user.email, school.academicYear);
        }
        setTeacher(teacherData as unknown as Teacher);
        setAllClasses(classesData as unknown as Class[]);
        setStudents(studentsData as unknown as Student[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, school?.academicYear]);

  // Build the teacher's class/section options.
  const uniqueClassSections = useMemo(() => {
    const list: { classId: string; sectionId: string; className: string; sectionName: string }[] = [];
    const added = new Set<string>();
    (teacher?.assignedClasses || []).forEach(ac => {
      const cls = allClasses.find(c => c.id === ac.classId);
      const sids = (ac as any).sectionIds || (ac.sectionId ? [ac.sectionId] : []);
      sids.forEach((sid: string) => {
        const key = `${ac.classId}|${sid}`;
        if (added.has(key)) return;
        added.add(key);
        const section = cls?.sections.find(s => s.id === sid);
        list.push({
          classId: ac.classId,
          sectionId: sid,
          className: cls?.name || ac.className || 'Class',
          sectionName: section?.name || ac.sectionName || 'Section',
        });
      });
    });
    return list;
  }, [teacher, allClasses]);

  // Subjects available for the selected class — using either explicit teacher
  // subjects or all class subjects as a fallback.
  const availableSubjects = useMemo(() => {
    if (!selectedClassId) return [] as { subjectId: string; subjectName: string }[];
    const cls = allClasses.find(c => c.id === selectedClassId);
    if (!cls) return [];
    const teacherSubs = teacher?.subjects || [];
    return (cls.subjects || [])
      .filter(s => teacherSubs.length === 0 || teacherSubs.includes(s.id))
      .map(s => ({ subjectId: s.id, subjectName: s.name }));
  }, [teacher, allClasses, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId && uniqueClassSections.length > 0) {
      const first = uniqueClassSections[0];
      setSelectedClassId(first.classId);
      setSelectedSectionId(first.sectionId);
    }
  }, [uniqueClassSections, selectedClassId]);

  useEffect(() => {
    if (selectedClassId && !selectedSubjectId && availableSubjects.length > 0) {
      setSelectedSubjectId(availableSubjects[0].subjectId);
    }
  }, [availableSubjects, selectedClassId, selectedSubjectId]);

  // Load the tests for the current selection.
  const reloadTests = async () => {
    if (!selectedClassId || !selectedSectionId || !selectedSubjectId || !school?.academicYear) {
      setTests([]);
      return;
    }
    try {
      const data = await ClassTestsService.getByClassSectionSubject(
        selectedClassId, selectedSectionId, selectedSubjectId, school.academicYear,
      );
      setTests((data as unknown as ClassTest[])
        .sort((a, b) => (a.testDate < b.testDate ? 1 : -1)));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { reloadTests(); }, [selectedClassId, selectedSectionId, selectedSubjectId, school?.academicYear]);

  const classStudents = useMemo(() =>
    students
      .filter(s => s.classId === selectedClassId && s.sectionId === selectedSectionId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  [students, selectedClassId, selectedSectionId]);

  const selectedClass = allClasses.find(c => c.id === selectedClassId);
  const selectedSubjectName = availableSubjects.find(s => s.subjectId === selectedSubjectId)?.subjectName || '';

  const handleCreate = async () => {
    if (!newTest.testName.trim()) { showToast('Enter a test name'); return; }
    if (!Number.isFinite(newTest.maxMarks) || newTest.maxMarks <= 0) { showToast('Max marks must be > 0'); return; }
    try {
      const records: ClassTestRecord[] = classStudents.map(s => ({
        studentId: s.id,
        studentName: s.name,
        marksObtained: null,
      }));
      const payload = {
        classId: selectedClassId,
        sectionId: selectedSectionId,
        subjectId: selectedSubjectId,
        subjectName: selectedSubjectName,
        teacherId: teacher?.id || '',
        teacherName: teacher?.name || user?.name || '',
        testName: newTest.testName.trim(),
        testDate: newTest.testDate,
        maxMarks: Number(newTest.maxMarks),
        academicYear: school.academicYear,
        records,
        className: selectedClass?.name || '',
        sectionName: selectedClass?.sections.find(s => s.id === selectedSectionId)?.name || '',
      };
      await ClassTestsService.create(payload);
      showToast(`Test "${payload.testName}" created`);
      setCreateOpen(false);
      setNewTest({ testName: '', testDate: new Date().toISOString().split('T')[0], maxMarks: 20 });
      await reloadTests();
    } catch (e) {
      console.error(e);
      showToast('Failed to create test');
    }
  };

  const openEdit = (test: ClassTest) => {
    setEditingTest(test);
    const initial: Record<string, string> = {};
    // Seed every student row from the test's records.
    test.records.forEach(r => {
      initial[r.studentId] = r.marksObtained === null || r.marksObtained === undefined
        ? '' : String(r.marksObtained);
    });
    // If the roster changed since the test was created, include new students too.
    classStudents.forEach(s => {
      if (!(s.id in initial)) initial[s.id] = '';
    });
    setEditMarks(initial);
  };

  const handleSaveMarks = async () => {
    if (!editingTest) return;
    setSaving(true);
    try {
      const records: ClassTestRecord[] = classStudents.map(s => {
        const raw = (editMarks[s.id] ?? '').trim();
        const num = raw === '' ? null : Number(raw);
        return {
          studentId: s.id,
          studentName: s.name,
          marksObtained: num === null || Number.isNaN(num) ? null : num,
        };
      });
      await ClassTestsService.update(editingTest.id, { records });
      showToast('Marks saved');
      setEditingTest(null);
      await reloadTests();
    } catch (e) {
      console.error(e);
      showToast('Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (test: ClassTest) => {
    if (!confirm(`Delete "${test.testName}"? This cannot be undone.`)) return;
    try {
      await ClassTestsService.delete(test.id);
      showToast('Test deleted');
      await reloadTests();
    } catch (e) {
      console.error(e);
      showToast('Failed to delete');
    }
  };

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Class Test Marks</h2>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            Create tests for your subject and enter marks for each student.
          </p>
        </div>
        {selectedClassId && selectedSectionId && selectedSubjectId && (
          <Button variant="primary" onClick={() => setCreateOpen(true)} icon={<PlusIcon size={16} color="white" />}>
            New Test
          </Button>
        )}
      </div>

      {/* Selection bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 'var(--space-3)', padding: 'var(--space-4)',
        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)', marginBottom: 'var(--space-4)',
      }}>
        <Select
          label="Class & Section"
          value={`${selectedClassId}|${selectedSectionId}`}
          onChange={(e: any) => {
            const [c, s] = e.target.value.split('|');
            setSelectedClassId(c || '');
            setSelectedSectionId(s || '');
            setSelectedSubjectId('');
          }}
          options={[
            { value: '|', label: 'Select…' },
            ...uniqueClassSections.map(cs => ({
              value: `${cs.classId}|${cs.sectionId}`,
              label: `${cs.className} — ${cs.sectionName}`,
            })),
          ]}
        />
        <Select
          label="Subject"
          value={selectedSubjectId}
          onChange={(e: any) => setSelectedSubjectId(e.target.value)}
          disabled={!selectedClassId}
          options={[
            { value: '', label: 'Select…' },
            ...availableSubjects.map(s => ({ value: s.subjectId, label: s.subjectName })),
          ]}
        />
      </div>

      {/* Tests list */}
      {!selectedClassId || !selectedSubjectId ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Pick a class and subject to see tests.</p>
        </div>
      ) : tests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body" style={{ fontWeight: 600, marginBottom: 4 }}>No tests yet</p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>
            Click <strong>New Test</strong> above to create the first one.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
          {tests.map(t => {
            const entered = t.records.filter(r => r.marksObtained !== null && r.marksObtained !== undefined);
            const avg = entered.length > 0
              ? entered.reduce((sum, r) => sum + (r.marksObtained || 0), 0) / entered.length
              : null;
            return (
              <div key={t.id} style={{
                background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)',
                padding: 'var(--space-4)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="text-h3" style={{ margin: 0 }}>{t.testName}</h3>
                    <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      {new Date(t.testDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · Max {t.maxMarks}
                    </p>
                  </div>
                  <Badge variant="info">{entered.length}/{t.records.length}</Badge>
                </div>
                {avg !== null && (
                  <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    Class average: <strong>{avg.toFixed(1)}</strong> / {t.maxMarks}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button variant="primary" onClick={() => openEdit(t)} icon={<EditIcon size={14} color="white" />}>
                    {entered.length === 0 ? 'Enter Marks' : 'Edit Marks'}
                  </Button>
                  <button
                    onClick={() => handleDelete(t)}
                    style={{ padding: '8px 12px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-error)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    aria-label="Delete test"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create-test modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Class Test" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Input
            label="Test name"
            placeholder="e.g. Spelling Test 1, Chapter 3 Test"
            value={newTest.testName}
            onChange={e => setNewTest(p => ({ ...p, testName: e.target.value }))}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Input label="Test date" type="date" value={newTest.testDate} onChange={e => setNewTest(p => ({ ...p, testDate: e.target.value }))} />
            <Input label="Max marks" type="number" min={1} value={String(newTest.maxMarks)} onChange={e => setNewTest(p => ({ ...p, maxMarks: Number(e.target.value) || 0 }))} />
          </div>
          <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
            For <strong>{selectedClass?.name} — Section {selectedClass?.sections.find(s => s.id === selectedSectionId)?.name}</strong>, subject <strong>{selectedSubjectName}</strong>. {classStudents.length} student rows will be created (you fill in marks next).
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate}>Create Test</Button>
          </div>
        </div>
      </Modal>

      {/* Marks-entry modal */}
      <Modal isOpen={!!editingTest} onClose={() => setEditingTest(null)}
        title={editingTest ? `${editingTest.testName} — ${editingTest.subjectName}` : ''}
        size="lg"
      >
        {editingTest && (
          <div>
            <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>
              {new Date(editingTest.testDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}Max marks: <strong>{editingTest.maxMarks}</strong>
              {' · '}Leave blank for absent / not attempted.
            </p>
            <div style={{ maxHeight: '60vh', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 100px', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-text-tertiary)' }}>
                <span>#</span>
                <span>Student</span>
                <span style={{ textAlign: 'center' }}>Marks</span>
              </div>
              {classStudents.map((s, i) => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 100px', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-divider)' }}>
                  <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', textAlign: 'center' }}>{i + 1}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Avatar name={s.name} size={26} />
                    <span style={{ font: 'var(--text-body-sm)', fontWeight: 500 }}>{s.name}</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={editingTest.maxMarks}
                    value={editMarks[s.id] ?? ''}
                    onChange={e => setEditMarks(prev => ({ ...prev, [s.id]: e.target.value }))}
                    placeholder="—"
                    style={{
                      width: 80, padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                      fontSize: '0.9rem', textAlign: 'center',
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
              <Button variant="secondary" onClick={() => setEditingTest(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveMarks} disabled={saving}>
                {saving ? 'Saving…' : 'Save Marks'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
