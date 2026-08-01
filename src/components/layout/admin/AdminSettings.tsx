'use client';

import React, { useState, useEffect } from 'react';
import { useSchool } from '@/context/SchoolContext';
import { CLASS_PROGRESSION, CLASS_SLOTS, getNextClass, getClassSlotIndex, buildAutoClassMapping } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { 
  UsersService, 
  TeachersService, 
  StudentsService, 
  FeeStructuresService, 
  FeePaymentsService, 
  AttendanceService, 
  MarksService, 
  AssessmentService, 
  WeeklyTestsService, 
  TimetablesService, 
  ClassesService,
  MasterResetService
} from '@/lib/firestore-service';
import { db } from '@/lib/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { UserRole } from '@/types/enums';
import type { Scholarship } from '@/types/models';
import Input from '@/components/ui/Input';
import { Select } from '@/components/ui/Input';
import { SunIcon, PlusIcon, UserIcon, EditIcon, TrashIcon } from '@/components/ui/Icons';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Tabs, Avatar, Badge } from '@/components/ui/SharedUI';

interface UserData {
  id: string;
  uid?: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone?: string;
}

export default function AdminSettings() {
  const { school, updateSchool } = useSchool();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [isRollingOver, setIsRollingOver] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);

  const [rolloverForm, setRolloverForm] = useState({
    targetYear: '',
    carryBalance: true,
  });
  const [classMapping, setClassMapping] = useState<Record<string, string>>({}); // sourceClassId -> targetClassId

  useEffect(() => {
    if (school?.academicYear) {
      ClassesService.getAll(school.academicYear).then(setClasses).catch(console.error);
    }
  }, [school?.academicYear]);

  const [userForm, setUserForm] = useState({
    name: '', email: '', role: UserRole.PRINCIPAL, phone: '', employeeId: '',
  });

  const [schoolForm, setSchoolForm] = useState({
    name: school.name,
    address: school.address,
    phone: school.phone,
    email: school.email,
    academicYear: school.academicYear,
  });

  const [academicForm, setAcademicForm] = useState({
    admissionPrefix: school.settings?.admissionPrefix || 'MNS',
    periodsPerDay: school.settings?.periodsPerDay || 8,
    maxPeriodsPerTeacherPerDay: school.settings?.maxPeriodsPerTeacherPerDay || 6,
    maxConsecutivePeriods: school.settings?.maxConsecutivePeriods || 3,
  });

  // ── Scholarships (multiple named programs, each with per-class amounts) ──
  const scholarships: Scholarship[] = school.settings?.scholarships || [];
  const [scholarshipDraft, setScholarshipDraft] = useState<Scholarship | null>(null); // open ↔ editing/creating
  const [scholarshipSaving, setScholarshipSaving] = useState(false);

  const genScholarshipId = () => `sch_${Math.random().toString(36).slice(2, 10)}`;

  const openScholarshipCreate = () => {
    setScholarshipDraft({ id: genScholarshipId(), name: '', active: true, amountsByClass: {} });
  };
  const openScholarshipEdit = (s: Scholarship) => {
    // Deep-copy so edits are isolated until Save.
    setScholarshipDraft({ ...s, amountsByClass: { ...(s.amountsByClass || {}) } });
  };

  const setDraftClassAmount = (classId: string, value: string) => {
    setScholarshipDraft(prev => {
      if (!prev) return prev;
      const next = { ...prev.amountsByClass };
      if (value === '') delete next[classId];
      else {
        const n = Number(value);
        if (Number.isNaN(n)) return prev;
        next[classId] = n;
      }
      return { ...prev, amountsByClass: next };
    });
  };

  const persistScholarships = async (next: Scholarship[]) => {
    await updateSchool({
      settings: { ...school.settings, scholarships: next },
    });
  };

  const handleSaveScholarship = async () => {
    if (!scholarshipDraft) return;
    if (!scholarshipDraft.name.trim()) { showToast('Name is required'); return; }
    const cleaned: Scholarship = { ...scholarshipDraft, name: scholarshipDraft.name.trim() };
    const existing = scholarships.some(s => s.id === cleaned.id);
    const next = existing
      ? scholarships.map(s => (s.id === cleaned.id ? cleaned : s))
      : [...scholarships, cleaned];
    setScholarshipSaving(true);
    try {
      await persistScholarships(next);
      showToast(existing ? 'Scholarship updated' : 'Scholarship added');
      setScholarshipDraft(null);
    } catch {
      showToast('Failed to save');
    } finally {
      setScholarshipSaving(false);
    }
  };

  const handleDeleteScholarship = async (id: string) => {
    const s = scholarships.find(x => x.id === id);
    if (!s) return;
    if (!confirm(`Remove "${s.name}"? Students assigned to it will fall back to their class default fee.`)) return;
    try {
      await persistScholarships(scholarships.filter(x => x.id !== id));
      showToast('Scholarship removed');
    } catch {
      showToast('Failed to remove');
    }
  };

  const handleToggleScholarshipActive = async (id: string, active: boolean) => {
    try {
      await persistScholarships(scholarships.map(x => (x.id === id ? { ...x, active } : x)));
    } catch {
      showToast('Failed to update');
    }
  };

  useEffect(() => {
    UsersService.getAll().then(async data => {
      const list = data as unknown as UserData[];
      // Self-heal pre-existing duplicates: when a user logged in before the
      // batched migration shipped, the email-keyed pending doc was left behind
      // alongside the new UID-keyed active doc. Admins now have permission to
      // delete pending docs, so silently remove the stale ones.
      if (isAdmin) {
        const byEmailGroups = new Map<string, UserData[]>();
        for (const u of list) {
          if (!u.email) continue;
          const k = u.email.toLowerCase();
          const arr = byEmailGroups.get(k) || [];
          arr.push(u);
          byEmailGroups.set(k, arr);
        }
        const toDelete: string[] = [];
        for (const group of byEmailGroups.values()) {
          if (group.length < 2) continue;
          const hasActive = group.some(g => g.status === 'active');
          if (!hasActive) continue;
          for (const g of group) {
            if (g.status === 'pending') toDelete.push(g.id);
          }
        }
        if (toDelete.length > 0) {
          await Promise.allSettled(toDelete.map(id => UsersService.delete(id)));
          const refreshed = await UsersService.getAll();
          setUsers(refreshed as unknown as UserData[]);
          return;
        }
      }
      setUsers(list);
    }).catch(console.error).finally(() => setLoadingUsers(false));
  }, [isAdmin]);

  useEffect(() => {
    setSchoolForm({
      name: school.name,
      address: school.address,
      phone: school.phone,
      email: school.email,
      academicYear: school.academicYear,
    });
    setAcademicForm({
      admissionPrefix: school.settings?.admissionPrefix || 'MNS',
      periodsPerDay: school.settings?.periodsPerDay || 8,
      maxPeriodsPerTeacherPerDay: school.settings?.maxPeriodsPerTeacherPerDay || 6,
      maxConsecutivePeriods: school.settings?.maxConsecutivePeriods || 3,
    });
  }, [school]);

  const handleAddUser = async () => {
    if (!userForm.email || !userForm.role) {
      showToast('Please enter an email and select a role');
      return;
    }
    try {
      // Check if user already exists
      const existing = await UsersService.getByEmail(userForm.email);
      if (existing) {
        showToast('A user with this email already exists');
        return;
      }

      const userName = userForm.name || userForm.email.split('@')[0];

      // Create a pre-registered user with status 'pending'. Teachers are added
      // via the Teachers section, so this form never creates a teachers doc.
      await UsersService.create({
        name: userName,
        email: userForm.email,
        role: userForm.role,
        phone: userForm.phone,
        status: 'pending',
        photo: '',
        uid: '',
      });

      const updated = await UsersService.getAll();
      setUsers(updated as unknown as UserData[]);
      setShowAddUserModal(false);
      setUserForm({ name: '', email: '', role: UserRole.PRINCIPAL, phone: '', employeeId: '' });
      showToast('User added! They can now sign in with Google.');
    } catch (error) {
      console.error('Error adding user:', error);
      showToast('Failed to add user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await UsersService.delete(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast('User removed');
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('Failed to remove user');
    }
  };

  const openEditUser = (u: UserData) => {
    setEditingUser(u);
    setUserForm({ name: u.name, email: u.email, role: u.role as UserRole, phone: u.phone || '', employeeId: '' });
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await UsersService.update(editingUser.id, {
        name: userForm.name,
        role: userForm.role,
        phone: userForm.phone,
      });
      // If teacher, also update the teachers doc
      if (userForm.role === UserRole.TEACHER || editingUser.role === 'teacher') {
        const allTeachers = await TeachersService.getAll() as unknown as { id: string; email: string }[];
        const matchingTeacher = allTeachers.find(t => t.email === editingUser.email);
        if (matchingTeacher) {
          await TeachersService.update(matchingTeacher.id, {
            name: userForm.name,
            phone: userForm.phone,
          });
        }
      }
      const updated = await UsersService.getAll();
      setUsers(updated as unknown as UserData[]);
      setShowEditModal(false);
      setEditingUser(null);
      showToast('User updated!');
    } catch (error) {
      console.error('Error updating user:', error);
      showToast('Failed to update user');
    }
  };

  const handleSaveSchool = async () => {
    try {
      await updateSchool(schoolForm as Record<string, unknown> as Partial<typeof school>);
      showToast('Settings saved!');
    } catch {
      showToast('Failed to save settings');
    }
  };

  const handleSaveAcademic = async () => {
    const periodsPerDay = Number(academicForm.periodsPerDay);
    if (!Number.isFinite(periodsPerDay) || periodsPerDay < 1 || periodsPerDay > 12) {
      showToast('Periods Per Day must be between 1 and 12');
      return;
    }
    try {
      await updateSchool({
        settings: {
          ...school.settings,
          admissionPrefix: academicForm.admissionPrefix,
          periodsPerDay,
          maxPeriodsPerTeacherPerDay: Number(academicForm.maxPeriodsPerTeacherPerDay) || 6,
          maxConsecutivePeriods: Number(academicForm.maxConsecutivePeriods) || 3,
        },
      });
      showToast('Academic settings saved!');
    } catch {
      showToast('Failed to save academic settings');
    }
  };

  const handleRollover = async () => {
    if (!rolloverForm.targetYear) {
      showToast('Please select a target academic year');
      return;
    }
    if (rolloverForm.targetYear === school.academicYear) {
      showToast('Target year must be different from current year');
      return;
    }

    // Confirmation dialog with summary
    const confirmMessage = `⚠️ IMPORTANT: This will roll over to ${rolloverForm.targetYear}.\n\n` +
      `✓ Students will be promoted to new classes\n` +
      `✓ Pending fee balances will be carried over (if selected)\n` +
      `✓ Class structures will be created (if not exists)\n` +
      `✓ Fee structures will be copied (if not exists)\n\n` +
      `✗ Teacher assignments will NOT be copied (fresh start)\n` +
      `✗ Timetables, attendance, marks will NOT be copied\n` +
      `✓ Bus routes will remain unchanged\n\n` +
      `Do you want to proceed?`;
    
    if (!window.confirm(confirmMessage)) return;

    const unmappedClasses = classes.filter(c => !classMapping[c.id]);
    if (unmappedClasses.length > 0) {
      if (!window.confirm(`You haven't mapped ${unmappedClasses.length} classes. Students in these classes will not be promoted. Continue?`)) return;
    }

    setIsRollingOver(true);
    try {
      showToast('Rollover started... this may take a moment.');
      
      let totalPromoted = 0;
      let totalBalanceCarried = 0;
      let classesCreated = 0;
      let feeStructuresCreated = 0;

      // 1. Get all data ONLY for current year - avoid fetching past academic data
      const allStudents = await StudentsService.getAll(school.academicYear) as any[];
      const allPayments = await FeePaymentsService.getAll(school.academicYear) as any[];
      const allStructures = await FeeStructuresService.getAll(school.academicYear) as any[];
      const currentClasses = await ClassesService.getAll(school.academicYear) as any[];

      // 2. Check if target classes exist - AVOID DUPLICATION
      const targetClasses = await ClassesService.getAll(rolloverForm.targetYear) as any[];
      const classIdMap: Record<string, string> = {}; // sourceClassId -> targetClassId

      if (targetClasses.length === 0) {
        showToast('Creating class structures for new year...');
        for (const cls of currentClasses) {
          const newId = await ClassesService.create({
            name: cls.name,
            order: cls.order || 0,
            sections: cls.sections || [],
            subjects: cls.subjects || [],
            academicYear: rolloverForm.targetYear,
          });
          classIdMap[cls.id] = newId;
          classesCreated++;
        }
      } else {
        // Target classes already exist - map by name to avoid duplication
        showToast('Target classes already exist. Using existing classes...');
        currentClasses.forEach(c => {
          const matching = targetClasses.find(tc => tc.name === c.name);
          if (matching) {
            classIdMap[c.id] = matching.id;
          }
        });
      }

      // 3. Process student promotions and fee structures
      for (const mapping of Object.entries(classMapping)) {
        const [sourceId, targetId] = mapping;
        if (targetId === 'graduate' || targetId === 'none') continue;

        const classStudents = allStudents.filter(s => s.classId === sourceId);
        
        // Use the newly created target ID if we created classes, or the selected one
        const finalTargetId = classIdMap[targetId] || targetId;
        const targetClass = targetClasses.find(c => c.id === finalTargetId) || currentClasses.find(c => c.id === targetId);

        // Clone Fee Structure for the target class if it doesn't exist (AVOID DUPLICATION)
        const structure = allStructures.find(fs => fs.classId === sourceId);
        if (structure) {
          const targetStructures = await FeeStructuresService.getAll(rolloverForm.targetYear) as any[];
          const targetStructure = targetStructures.find(fs => fs.classId === finalTargetId);
          
          if (!targetStructure) {
            await FeeStructuresService.create({
              ...structure,
              id: undefined, // Let Firestore generate new ID
              classId: finalTargetId,
              academicYear: rolloverForm.targetYear,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            feeStructuresCreated++;
          }
        }

        // Promote each student
        for (const student of classStudents) {
          let pendingBalance = 0;
          if (rolloverForm.carryBalance && structure) {
            // Calculate pending balance from current year only
            const studentPayments = allPayments.filter(p => p.studentId === student.id);
            const totalPaid = studentPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            
            const totalExpected = structure.totalAmount || 0;
            pendingBalance = Math.max(0, totalExpected - totalPaid);
          }

          // Resolve the target section by matching the student's current section NAME
          // inside the target class (e.g. Class 1 Section "A" → Class 2 Section "A").
          const targetSections: { id: string; name: string }[] = targetClass?.sections || [];
          const sourceClass = currentClasses.find(c => c.id === sourceId);
          const sourceSectionName = sourceClass?.sections?.find(
            (s: { id: string; name: string }) => s.id === student.sectionId
          )?.name || student.sectionName || '';

          const matchedSection = targetSections.find(
            s => s.name.trim().toLowerCase() === sourceSectionName.trim().toLowerCase()
          );

          // Update student - Promote to new class with new academic year
          await StudentsService.update(student.id, {
            academicYear: rolloverForm.targetYear,
            classId: finalTargetId,
            className: targetClass?.name || '',
            // Use matched section ID; fall back to old sectionId only if no match
            sectionId: matchedSection?.id || student.sectionId,
            sectionName: matchedSection?.name || student.sectionName || '',
            previousBalance: (student.previousBalance || 0) + pendingBalance,
          });

          totalPromoted++;
          if (pendingBalance > 0) totalBalanceCarried += pendingBalance;
        }
      }

      // 4. Teacher Assignments - FRESH START (not copied from previous year)
      // Teachers need to be re-assigned manually in the new academic year
      // This is intentional - teacher assignments should not auto-carry over

      // 5. Bus Routes - remain unchanged (global data, not academic-year specific)
      // No action needed - bus routes are already preserved

      // 6. Academic records (timetables, attendance, marks) - NOT copied (fresh start)
      // These will be created fresh in the new academic year

      // 7. Update global school year
      await updateSchool({ academicYear: rolloverForm.targetYear });

      showToast(
        `Success! ${totalPromoted} students promoted to ${rolloverForm.targetYear}.\n` +
        `Classes created: ${classesCreated}, Fee structures created: ${feeStructuresCreated}.\n` +
        `Total balance carried: ₹${totalBalanceCarried.toLocaleString()}`
      );
      setShowRolloverModal(false);
    } catch (error) {
      console.error('Rollover error:', error);
      showToast('Rollover failed. See console for details.');
    } finally {
      setIsRollingOver(false);
    }
  };

  const handleMasterReset = async () => {
    const confirmation1 = window.confirm("⚠️ DANGER: This will permanently DELETE all students, classes, attendance, marks, and fees. This cannot be undone. Are you absolutely sure?");
    if (!confirmation1) return;
    
    const confirmation2 = window.prompt("To confirm deletion, type 'RESET' in all caps:");
    if (confirmation2 !== 'RESET') return;

    try {
      showToast("Resetting system... please wait.");
      await MasterResetService.wipeAllData();
      showToast(`System reset complete. All data wiped for ${school.academicYear}.`);
      window.location.reload();
    } catch (e) {
      console.error(e);
      showToast("Reset failed. Check console.");
    }
  };

  // Roles that can be added directly from this page. Teachers are intentionally
  // excluded — they must be added via the Teachers section, which also creates
  // the underlying Teacher record (subjects, assignments, employee ID, etc.).
  const addUserRoleOptions = [
    { value: UserRole.PRINCIPAL, label: 'Principal' },
    { value: UserRole.CORRESPONDENT, label: 'Correspondent' },
    { value: UserRole.PARENT, label: 'Parent' },
    { value: UserRole.ADMIN, label: 'Admin' },
  ];
  // Edit form keeps the Teacher option so existing teacher rows remain editable.
  const editUserRoleOptions = [
    { value: UserRole.TEACHER, label: 'Teacher' },
    ...addUserRoleOptions,
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Settings</h2>
      </div>

      <Tabs tabs={[
        { id: 'users', label: 'User Management' },
        { id: 'general', label: 'General' },
        { id: 'academic', label: 'Academic' },
        { id: 'appearance', label: 'Appearance' },
        { id: 'scholarships', label: 'Scholarships' },
      ]} activeTab={activeTab} onChange={setActiveTab} />

      <div style={{ marginTop: 'var(--space-4)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)' }}>
        {activeTab === 'users' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h3 className="text-h3">User Management</h3>
                <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
                  Add users by email. When they sign in with Google using that email, they&apos;ll be assigned the role you set here.
                </p>
              </div>
              {isAdmin && (
                <Button variant="primary" onClick={() => setShowAddUserModal(true)} icon={<PlusIcon size={18} color="white" />}>
                  Add User
                </Button>
              )}
            </div>

            {loadingUsers ? (
              <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-4)' }}>Loading users...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                {(() => {
                  const sections = [
                    { role: UserRole.ADMIN, title: 'Admins' },
                    { role: UserRole.PRINCIPAL, title: 'Principal' },
                    { role: UserRole.CORRESPONDENT, title: 'Correspondent' },
                    { role: UserRole.TEACHER, title: 'Teachers' },
                    { role: UserRole.PARENT, title: 'Parents' },
                  ];

                  // Dedupe by email — a user logging in for the first time creates a
                  // UID-keyed active doc, while the original pre-registration doc may
                  // linger if cleanup failed. Prefer active > pending, and UID-keyed
                  // > email-only, so the list always shows the canonical row.
                  const byEmail = new Map<string, UserData>();
                  for (const u of users) {
                    const key = (u.email || u.id).toLowerCase();
                    const existing = byEmail.get(key);
                    if (!existing) { byEmail.set(key, u); continue; }
                    const score = (x: UserData) =>
                      (x.status === 'active' ? 2 : x.status === 'pending' ? 1 : 0) +
                      (x.uid ? 0.5 : 0);
                    if (score(u) > score(existing)) byEmail.set(key, u);
                  }
                  const dedupedUsers = Array.from(byEmail.values());

                  return sections.map(section => {
                    const sectionUsers = dedupedUsers.filter(u => u.role === section.role);
                    if (sectionUsers.length === 0) return null;

                    return (
                      <div key={section.role}>
                        <h4 className="text-overline" style={{ marginBottom: 'var(--space-2)', color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
                          {section.title} — {sectionUsers.length}
                        </h4>
                        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden', background: 'var(--color-surface)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 0.5fr', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                            <span className="text-overline" style={{ fontSize: '0.65rem' }}>Name</span>
                            <span className="text-overline" style={{ fontSize: '0.65rem' }}>Email</span>
                            <span className="text-overline" style={{ fontSize: '0.65rem' }}>Role</span>
                            <span className="text-overline" style={{ fontSize: '0.65rem' }}>Status</span>
                            <span className="text-overline" style={{ fontSize: '0.65rem', textAlign: 'right' }}>Actions</span>
                          </div>
                          {sectionUsers.map(u => (
                            <div key={u.id} style={{
                              display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 0.5fr',
                              alignItems: 'center',
                              padding: 'var(--space-2) var(--space-4)',
                              borderBottom: '1px solid var(--color-divider)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                                <Avatar name={u.name || u.email} size={28} />
                                <span style={{ font: 'var(--text-body-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unnamed'}</span>
                              </div>
                              <span style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{u.email}</span>
                              <span style={{ font: 'var(--text-body-sm)', textTransform: 'capitalize', fontSize: '0.8rem' }}>{u.role}</span>
                              <div>
                                <Badge variant={u.status === 'active' ? 'success' : u.status === 'pending' ? 'warning' : 'default'}>
                                  {u.status === 'active' ? 'Active' : u.status === 'pending' ? 'Pending' : u.status}
                                </Badge>
                              </div>
                              <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
                                {isAdmin && (
                                  <button onClick={() => openEditUser(u)}
                                    style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-500)' }}>
                                    <EditIcon size={14} />
                                  </button>
                                )}
                                {isAdmin && u.role !== 'admin' && (
                                  <button onClick={() => handleDeleteUser(u.id)}
                                    style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}>
                                    <TrashIcon size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}

                {users.length === 0 && (
                  <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                    <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No users yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '600px' }}>
            <h3 className="text-h3">School Information</h3>
            <Input label="School Name" value={schoolForm.name} onChange={e => setSchoolForm(p => ({ ...p, name: e.target.value }))} />
            <Input label="Address" value={schoolForm.address} onChange={e => setSchoolForm(p => ({ ...p, address: e.target.value }))} />
            <div className="grid-2">
              <Input label="Phone" value={schoolForm.phone} onChange={e => setSchoolForm(p => ({ ...p, phone: e.target.value }))} />
              <Input label="Email" value={schoolForm.email} onChange={e => setSchoolForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <Input label="Academic Year" value={schoolForm.academicYear} onChange={e => setSchoolForm(p => ({ ...p, academicYear: e.target.value }))} />
            <Button variant="primary" onClick={handleSaveSchool}>Save Changes</Button>
          </div>
        )}

        {activeTab === 'academic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '600px' }}>
            <h3 className="text-h3">Academic Settings</h3>
            <Input label="Admission Prefix" value={academicForm.admissionPrefix} onChange={e => setAcademicForm(p => ({ ...p, admissionPrefix: e.target.value }))} />
            <div className="grid-2">
              <Input label="Periods Per Day" type="number" min={1} max={12} value={String(academicForm.periodsPerDay)} onChange={e => setAcademicForm(p => ({ ...p, periodsPerDay: e.target.value === '' ? '' as unknown as number : Number(e.target.value) }))} />
              <Input label="Max Periods/Teacher/Day" type="number" min={1} value={String(academicForm.maxPeriodsPerTeacherPerDay)} onChange={e => setAcademicForm(p => ({ ...p, maxPeriodsPerTeacherPerDay: e.target.value === '' ? '' as unknown as number : Number(e.target.value) }))} />
            </div>
            <Input label="Max Consecutive Periods" type="number" min={1} value={String(academicForm.maxConsecutivePeriods)} onChange={e => setAcademicForm(p => ({ ...p, maxConsecutivePeriods: e.target.value === '' ? '' as unknown as number : Number(e.target.value) }))} />
            <div className="divider" />
            <h3 className="text-h3">Grade Scale</h3>
            {school.settings?.gradeScale?.map((gs, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ width: 40, font: 'var(--text-body)', fontWeight: 600 }}>{gs.grade}</span>
                <span className="text-caption">{gs.min}% – {gs.max}%</span>
              </div>
            ))}
            {(!school.settings?.gradeScale || school.settings.gradeScale.length === 0) && (
              <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Grade scale will be configured from the school settings.</p>
            )}
            <Button variant="primary" onClick={handleSaveAcademic}>Save Changes</Button>

            <div className="divider" style={{ margin: 'var(--space-6) 0' }} />
            
            <div style={{ padding: 'var(--space-4)', background: 'var(--color-primary-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary-100)' }}>
              <h4 className="text-h4" style={{ color: 'var(--color-primary-700)', marginBottom: 'var(--space-2)' }}>System Migration Tool</h4>
              <p className="text-caption" style={{ color: 'var(--color-primary-600)', marginBottom: 'var(--space-4)' }}>
                If your existing data (students, fees, attendance) is not showing up after the update, use this tool to tag all existing records with the current academic year ({school.academicYear}).
              </p>
              <Button 
                variant="secondary" 
                onClick={async () => {
                  if (!window.confirm(`This will update all existing records to academic year ${school.academicYear}. Proceed?`)) return;
                  try {
                    showToast('Migration started... please wait.');
                    
                    // We need to fetch and update everything. This is a heavy operation.
                    const collections = ['students', 'feeStructures', 'feePayments', 'attendance', 'marks', 'assessmentSessions', 'weeklyTests', 'timetables', 'classes'];
                    let totalUpdated = 0;

                    for (const coll of collections) {
                      const docs = await UsersService.getAll().then(() => {
                        // Using a generic fetch since we don't have a global service for everything
                        // But I can use the existing services
                        switch(coll) {
                          case 'students': return StudentsService.getAll();
                          case 'feeStructures': return FeeStructuresService.getAll();
                          case 'feePayments': return FeePaymentsService.getAll();
                          case 'attendance': return AttendanceService.getAll();
                          case 'marks': return MarksService.getAll();
                          case 'assessmentSessions': return AssessmentService.getAll();
                          case 'weeklyTests': return WeeklyTestsService.getAll();
                          case 'timetables': return TimetablesService.getAll();
                          case 'classes': return ClassesService.getAll();
                          default: return [];
                        }
                      });

                      for (const d of docs) {
                        if (!d.academicYear) {
                          // Update using the specific service update method if available
                          const updateData = { academicYear: school.academicYear };
                          switch(coll) {
                            case 'students': await StudentsService.update(d.id, updateData); break;
                            case 'feeStructures': await FeeStructuresService.update(d.id, updateData); break;
                            case 'attendance': await AttendanceService.update(d.id, updateData); break;
                            case 'marks': await MarksService.update(d.id, updateData); break;
                            case 'assessmentSessions': await AssessmentService.update(d.id, updateData); break;
                            case 'weeklyTests': await WeeklyTestsService.update(d.id, updateData); break;
                            case 'timetables': await TimetablesService.update(d.id, updateData); break;
                            case 'classes': await ClassesService.update(d.id, updateData); break;
                            case 'feePayments': await FeePaymentsService.update(d.id, updateData); break;
                          }
                          totalUpdated++;
                        }
                      }
                    }
                    showToast(`Migration complete! ${totalUpdated} records updated.`);
                  } catch (e) {
                    console.error(e);
                    showToast('Migration failed. Check console.');
                  }
                }}
              >
                Initialize {school.academicYear} Data
              </Button>
            </div>

            <div className="divider" style={{ margin: 'var(--space-6) 0' }} />
            
            <div style={{ padding: 'var(--space-4)', background: '#F0FDF4', borderRadius: 'var(--radius-md)', border: '1px solid #BBF7D0' }}>
              <h4 className="text-h4" style={{ color: '#166534', marginBottom: 'var(--space-2)' }}>Year-End Rollover</h4>
              <p className="text-caption" style={{ color: '#15803D', marginBottom: 'var(--space-4)' }}>
                Move students to their next classes for the upcoming academic year. You can carry over unpaid balances and promote students in bulk.
              </p>
              <Button 
                variant="primary" 
                style={{ background: '#22C55E', borderColor: '#22C55E' }}
                onClick={() => {
                  // Auto-increment the academic year
                  const nextYear = school.academicYear.includes('-')
                    ? `${parseInt(school.academicYear.split('-')[0]) + 1}-${parseInt(school.academicYear.split('-')[1]) + 1}`
                    : '';
                  setRolloverForm({ targetYear: nextYear, carryBalance: true });
                  // Auto-populate class mapping based on the canonical progression
                  setClassMapping(buildAutoClassMapping(classes));
                  setShowRolloverModal(true);
                }}
              >
                Start Rollover Wizard
              </Button>
            </div>

            <div className="divider" style={{ margin: 'var(--space-6) 0' }} />

            <div style={{ padding: 'var(--space-4)', background: '#FEF2F2', borderRadius: 'var(--radius-md)', border: '1px solid #FECACA' }}>
              <h4 className="text-h4" style={{ color: '#991B1B', marginBottom: 'var(--space-2)' }}>Master System Reset</h4>
              <p className="text-caption" style={{ color: '#B91C1C', marginBottom: 'var(--space-4)' }}>
                Completely wipe all students, classes, and academic records to start fresh from {school.academicYear}. <strong>User accounts and teacher profiles will not be deleted.</strong>
              </p>
              <Button 
                variant="primary" 
                style={{ background: '#DC2626', borderColor: '#DC2626' }}
                onClick={handleMasterReset}
              >
                Wipe All Data & Start Fresh
              </Button>
            </div>
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
          </div>
        )}

        {activeTab === 'scholarships' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="text-h3" style={{ margin: 0 }}>Scholarships</h3>
                <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                  Define scholarship programs (e.g. RTE) with the total yearly fee per class.
                  Assign one to a student in <strong>Students → Edit → Academic</strong>.
                </p>
              </div>
              <Button variant="primary" onClick={openScholarshipCreate} icon={<PlusIcon size={16} color="white" />}>
                Add Scholarship
              </Button>
            </div>

            {scholarships.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
                <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
                  No scholarships yet. Click <strong>Add Scholarship</strong> to create one.
                </p>
              </div>
            ) : (
              <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                {scholarships.map((s, i) => {
                  const priced = Object.keys(s.amountsByClass || {}).length;
                  return (
                    <div key={s.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto auto auto',
                      alignItems: 'center', gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-4)',
                      borderTop: i === 0 ? 'none' : '1px solid var(--color-divider)',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ font: 'var(--text-body)', fontWeight: 600 }}>{s.name || <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Untitled</span>}</div>
                        <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                          {priced === 0 ? 'No class prices set' : `${priced} class${priced === 1 ? '' : 'es'} priced`}
                        </div>
                      </div>
                      <span style={{
                        padding: '2px 10px', borderRadius: 'var(--radius-full)',
                        background: s.active ? '#ECFDF5' : 'var(--color-surface-variant)',
                        color: s.active ? '#059669' : 'var(--color-text-tertiary)',
                        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{s.active ? 'Active' : 'Inactive'}</span>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} title="Toggle active">
                        <input
                          type="checkbox"
                          checked={s.active}
                          onChange={e => handleToggleScholarshipActive(s.id, e.target.checked)}
                        />
                      </label>
                      <button
                        onClick={() => openScholarshipEdit(s)}
                        title="Edit"
                        style={{ padding: 8, background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-primary-500)', cursor: 'pointer', display: 'flex' }}
                      >
                        <EditIcon size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteScholarship(s.id)}
                        title="Remove"
                        style={{ padding: 8, background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-error)', cursor: 'pointer', display: 'flex' }}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scholarship add/edit modal (top-level so it works from any tab) */}
      <Modal
        isOpen={!!scholarshipDraft}
        onClose={() => setScholarshipDraft(null)}
        title={scholarshipDraft
          ? (scholarships.some(s => s.id === scholarshipDraft.id) ? 'Edit Scholarship' : 'New Scholarship')
          : ''}
        size="md"
      >
        {scholarshipDraft && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Input
              label="Scholarship name"
              placeholder="e.g. RTE"
              value={scholarshipDraft.name}
              onChange={e => setScholarshipDraft(p => p ? { ...p, name: e.target.value } : p)}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={scholarshipDraft.active}
                onChange={e => setScholarshipDraft(p => p ? { ...p, active: e.target.checked } : p)}
              />
              <span className="text-body-sm">Active (show in student dropdown)</span>
            </label>

            <div>
              <div className="text-caption" style={{ fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Fee per class (₹ / year)
              </div>
              {classes.length === 0 ? (
                <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>No classes configured yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 'var(--space-2)', maxHeight: '40vh', overflowY: 'auto', padding: 2 }}>
                  {classes.map((c: any) => (
                    <div key={c.id}>
                      <label className="text-caption" style={{ display: 'block', marginBottom: 2, color: 'var(--color-text-secondary)' }}>{c.name}</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="—"
                        value={scholarshipDraft.amountsByClass?.[c.id] ?? ''}
                        onChange={e => setDraftClassAmount(c.id, e.target.value)}
                        style={{
                          width: '100%', padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                          background: 'var(--color-surface-variant)',
                          fontSize: '0.9rem', outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setScholarshipDraft(null)} disabled={scholarshipSaving}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveScholarship} disabled={scholarshipSaving}>
                {scholarshipSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add User Modal */}
      <Modal isOpen={showAddUserModal} onClose={() => setShowAddUserModal(false)} title="Add New User" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <UserIcon size={16} />
            <span className="text-caption" style={{ color: '#0369A1', lineHeight: 1.5 }}>
              Add a user by their Google email. When they sign in with Google, they will automatically get the role you assign here.
            </span>
          </div>
          <Input label="Name (optional)" placeholder="Full name" value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Google Email" placeholder="user@gmail.com" type="email" required value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} />
          <div className="grid-2">
            <Select label="Role" options={addUserRoleOptions} value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value as UserRole }))} />
            <Input label="Phone (optional)" placeholder="+91 XXXXX XXXXX" value={userForm.phone} onChange={e => setUserForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
            To add a teacher, use the Teachers section — that flow also captures subjects and class assignments.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => setShowAddUserModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddUser}>Add User</Button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingUser(null); }} title="Edit User" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Name" placeholder="Full name" value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Email" value={editingUser?.email || ''} disabled />
          <div className="grid-2">
            <Select label="Role" options={editUserRoleOptions} value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value as UserRole }))} />
            <Input label="Phone" placeholder="+91 XXXXX XXXXX" value={userForm.phone} onChange={e => setUserForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => { setShowEditModal(false); setEditingUser(null); }}>Cancel</Button>
            <Button variant="primary" onClick={handleUpdateUser}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* Rollover Modal */}
      <Modal isOpen={showRolloverModal} onClose={() => setShowRolloverModal(false)} title="Year-End Rollover Wizard" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <span className="text-caption" style={{ color: '#15803D', lineHeight: 1.5 }}>
              This wizard will move students to their next classes for the new academic year.
              <strong> Current Year: {school.academicYear}</strong>
            </span>
          </div>

          <div className="grid-2">
            <Input
              label="Target Academic Year"
              placeholder="e.g., 2026-27, 2035-36"
              value={rolloverForm.targetYear}
              onChange={e => setRolloverForm(p => ({ ...p, targetYear: e.target.value }))}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 24 }}>
              <input
                type="checkbox"
                id="carryBalance"
                checked={rolloverForm.carryBalance}
                onChange={e => setRolloverForm(p => ({ ...p, carryBalance: e.target.checked }))}
              />
              <label htmlFor="carryBalance" className="text-body-sm">Carry Over Pending Balances</label>
            </div>
          </div>

          {/* What gets copied and what doesn't */}
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius-md)' }}>
            <h5 className="text-overline" style={{ color: '#92400E', marginBottom: 'var(--space-2)' }}>ROLLOVER SUMMARY</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <p className="text-caption" style={{ color: '#166534', fontWeight: 600, marginBottom: 'var(--space-1)' }}>✓ WILL BE COPIED:</p>
                <ul className="text-caption" style={{ color: '#92400E', margin: 0, paddingLeft: 'var(--space-3)' }}>
                  <li>Students (promoted to new classes)</li>
                  <li>Pending fee balances (if selected)</li>
                  <li>Class structures (if not exists)</li>
                  <li>Fee structures (if not exists)</li>
                  <li>Bus routes (unchanged)</li>
                </ul>
              </div>
              <div>
                <p className="text-caption" style={{ color: '#991B1B', fontWeight: 600, marginBottom: 'var(--space-1)' }}>✗ WILL NOT BE COPIED:</p>
                <ul className="text-caption" style={{ color: '#92400E', margin: 0, paddingLeft: 'var(--space-3)' }}>
                  <li>Teacher assignments (fresh start)</li>
                  <li>Timetables</li>
                  <li>Attendance records</li>
                  <li>Marks/assessments</li>
                  <li>Past academic year data</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="divider" />

          <h4 className="text-h4">Class Promotion Mapping</h4>
          <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
            Automatically pre-filled based on the canonical class order. Override any row if needed for {rolloverForm.targetYear || 'the target year'}.
          </p>

          {/* Canonical class progression legend */}
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 'var(--radius-md)' }}>
            <p className="text-overline" style={{ color: '#0369A1', marginBottom: 'var(--space-2)' }}>📋 CLASS ORDER ({CLASS_PROGRESSION.length} classes)</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', alignItems: 'center' }}>
              {CLASS_PROGRESSION.map((cls, idx) => (
                <React.Fragment key={cls}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    background: '#DBEAFE', color: '#1D4ED8',
                    font: 'var(--text-caption)', fontWeight: 700, fontSize: '0.7rem',
                  }}>{cls}</span>
                  {idx < CLASS_PROGRESSION.length - 1 && (
                    <span style={{ color: '#64748B', fontSize: '0.75rem' }}>→</span>
                  )}
                </React.Fragment>
              ))}
              <span style={{ marginLeft: 4, color: '#6B7280', fontSize: '0.7rem', fontStyle: 'italic' }}>→ Graduated</span>
            </div>
          </div>

          <div style={{ maxHeight: '340px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--color-surface-variant)', position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }} className="text-overline">Old Class ({school.academicYear})</th>
                  <th style={{ padding: '12px', textAlign: 'center', width: 40 }} className="text-overline">→</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }} className="text-overline">New Class ({rolloverForm.targetYear || '...'})</th>
                </tr>
              </thead>
              <tbody>
                {/* Sort classes by canonical progression order */}
                {[...classes]
                  .sort((a, b) => {
                    const aIdx = getClassSlotIndex(a.name);
                    const bIdx = getClassSlotIndex(b.name);
                    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
                  })
                  .map(cls => {
                    const autoNext = getNextClass(cls.name);
                    const isMapped = !!classMapping[cls.id];
                    const mappedTarget = classes.find(c => c.id === classMapping[cls.id]);
                    const isAutoMapped = isMapped && (
                      classMapping[cls.id] === 'graduate' ||
                      (autoNext !== null && mappedTarget !== undefined &&
                        getClassSlotIndex(mappedTarget.name) === getClassSlotIndex(autoNext))
                    );
                    const isKnown = getClassSlotIndex(cls.name) !== -1;
                    return (
                      <tr key={cls.id} style={{ borderBottom: '1px solid var(--color-divider)', background: isAutoMapped ? '#F0FFF4' : isMapped ? '#FFFBEB' : 'transparent' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: isKnown ? '#22C55E' : '#F59E0B',
                              flexShrink: 0,
                            }} />
                            <span style={{ font: 'var(--text-body-sm)', fontWeight: 600 }}>{cls.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#6B7280', fontSize: '1rem' }}>→</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <select
                              value={classMapping[cls.id] || ''}
                              onChange={e => setClassMapping(p => ({ ...p, [cls.id]: e.target.value }))}
                              style={{
                                flex: 1, padding: '7px 10px',
                                borderRadius: 'var(--radius-sm)',
                                border: `1.5px solid ${isAutoMapped ? '#86EFAC' : isMapped ? '#FCD34D' : 'var(--color-border)'}`,
                                font: 'var(--text-body-sm)',
                                background: isAutoMapped ? '#F0FFF4' : isMapped ? '#FFFBEB' : 'white',
                                color: 'var(--color-text-primary)',
                              }}
                            >
                              <option value="">— Not mapped —</option>
                              {CLASS_SLOTS.map(slot => {
                                const target = classes.find(c => {
                                  const key = c.name.trim().toLowerCase();
                                  return slot.label.toLowerCase() === key || slot.aliases.includes(key);
                                });
                                return target ? (
                                  <option key={slot.label} value={target.id}>{target.name}</option>
                                ) : null;
                              })}
                              <option value="graduate">🎓 Graduated / Completed</option>
                              <option value="none">✗ Do Not Promote</option>
                            </select>
                            {isAutoMapped && (
                              <span title="Auto-mapped" style={{ color: '#16A34A', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Auto</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => setShowRolloverModal(false)}>Cancel</Button>
            <Button variant="primary" style={{ background: '#22C55E', borderColor: '#22C55E' }} onClick={handleRollover} loading={isRollingOver}>
              Confirm & Execute Rollover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
