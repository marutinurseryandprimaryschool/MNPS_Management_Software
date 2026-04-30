'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClassesService, StudentsService, BusRoutesService } from '@/lib/firestore-service';
import { useSchool } from '@/context/SchoolContext';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input, { Textarea, Select, SearchInput } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/SharedUI';
import { Avatar, Badge } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';
import {
  PlusIcon, SchoolIcon, UploadIcon, ArrowLeftIcon,
  EditIcon, TrashIcon, UsersIcon, EyeIcon,
} from '@/components/ui/Icons';
import type { Class, Section, Student, BusRoute } from '@/types/models';
import * as XLSX from 'xlsx';

// ── Column mapping for Excel import ──
const COLUMN_MAP: Record<string, string> = {
  'emis id': 'emisId', 'emisid': 'emisId', 'emis': 'emisId',
  'name': 'name', 'student name': 'name',
  'name in tamil': 'nameTamil', 'tamil name': 'nameTamil', 'nametamil': 'nameTamil',
  'father name': 'fatherName', 'fathername': 'fatherName', 'father': 'fatherName',
  'father occupation': 'fatherOccupation', 'fatheroccupation': 'fatherOccupation',
  'father education': 'fatherEducation', 'fathereducation': 'fatherEducation',
  'mother name': 'motherName', 'mothername': 'motherName', 'mother': 'motherName',
  'mother occupation': 'motherOccupation', 'motheroccupation': 'motherOccupation',
  'mother education': 'motherEducation', 'mothereducation': 'motherEducation',
  'guardian name': 'guardianName', 'guardianname': 'guardianName',
  'guardian occupation': 'guardianOccupation', 'guardianoccupation': 'guardianOccupation',
  'aadhaar number': 'aadhaarNumber', 'aadhaarnumber': 'aadhaarNumber', 'aadhaar': 'aadhaarNumber',
  'phone number': 'phone', 'phonenumber': 'phone', 'phone': 'phone', 'mobile': 'phone',
  'phone number verify status': 'phoneVerifyStatus', 'phoneverifystatus': 'phoneVerifyStatus',
  'data of birth': 'dob', 'date of birth': 'dob', 'dob': 'dob', 'dateofbirth': 'dob',
  'gender': 'gender', 'sex': 'gender',
  'data of joining': 'dateOfJoining', 'date of joining': 'dateOfJoining', 'dateofjoining': 'dateOfJoining',
  'email': 'email', 'email id': 'email',
  'address': 'address',
  'pin code': 'pinCode', 'pincode': 'pinCode',
  'blood group': 'bloodGroup', 'bloodgroup': 'bloodGroup',
  'religion': 'religion',
  'medium of instruction': 'mediumOfInstruction', 'mediumofinstruction': 'mediumOfInstruction', 'medium': 'mediumOfInstruction',
  'admission number': 'admissionNumber', 'admissionnumber': 'admissionNumber', 'adm no': 'admissionNumber',
  'community': 'community',
  'disability group name': 'disabilityGroupName', 'disabilitygroupname': 'disabilityGroupName', 'disability': 'disabilityGroupName',
  'groupcode': 'groupCode', 'group code': 'groupCode',
  'mother tounge': 'motherTongue', 'mother tongue': 'motherTongue', 'mothertongue': 'motherTongue',
  'transport': 'transportType', 'transport type': 'transportType', 'bus student': 'transportType', 'bus': 'transportType',
  'class': '_rawClass', 'section': '_rawSection',
};

const EMPTY_FORM: Record<string, string> = {
  emisId: '', name: '', nameTamil: '', dob: '', gender: 'male', bloodGroup: '',
  classId: '', sectionId: '', address: '', pinCode: '',
  fatherName: '', fatherOccupation: '', fatherEducation: '',
  motherName: '', motherOccupation: '', motherEducation: '',
  guardianName: '', guardianOccupation: '',
  aadhaarNumber: '', phone: '', phoneVerifyStatus: '', email: '',
  dateOfJoining: '', admissionNumber: '', religion: '', mediumOfInstruction: '',
  community: '', disabilityGroupName: '', groupCode: '', motherTongue: '',
  transportType: 'out', routeId: '',
};

// Color palette for class cards
const CLASS_COLORS = [
  { bg: '#EEF2FF', accent: '#6366F1', text: '#4338CA' },
  { bg: '#F0FDF4', accent: '#22C55E', text: '#15803D' },
  { bg: '#FFF7ED', accent: '#F97316', text: '#C2410C' },
  { bg: '#FDF2F8', accent: '#EC4899', text: '#BE185D' },
  { bg: '#F0F9FF', accent: '#0EA5E9', text: '#0369A1' },
  { bg: '#FAF5FF', accent: '#A855F7', text: '#7E22CE' },
  { bg: '#FEF2F2', accent: '#EF4444', text: '#B91C1C' },
  { bg: '#ECFDF5', accent: '#10B981', text: '#047857' },
];

export default function AdminStudents() {
  const { school } = useSchool();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Navigation state
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [viewAll, setViewAll] = useState(false);

  // Search & filter (for section view and all-students view)
  const [search, setSearch] = useState('');

  // Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formSection, setFormSection] = useState('basic');

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedRows, setUploadedRows] = useState<Record<string, string>[]>([]);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detail view state
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (!school?.academicYear) return;
      const [classData, studentData, routeData] = await Promise.all([
        ClassesService.getAll(school.academicYear),
        StudentsService.getAll(school.academicYear),
        BusRoutesService.getAll(),
      ]);
      setClasses((classData as unknown as Class[]).sort((a, b) => (a.order || 0) - (b.order || 0)));
      setStudents(studentData as unknown as Student[]);
      setRoutes(routeData as unknown as BusRoute[]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [school?.academicYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Helpers ──
  const getStudentsForSection = (classId: string, sectionId: string) =>
    students.filter(s => s.classId === classId && s.sectionId === sectionId);

  const getStudentsForClass = (classId: string) =>
    students.filter(s => s.classId === classId);

  const sectionStudents = selectedClass && selectedSection
    ? getStudentsForSection(selectedClass.id, selectedSection.id)
    : [];

  const filteredStudents = (viewAll ? students : sectionStudents).filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) ||
      s.admissionNumber?.toLowerCase().includes(q) ||
      s.emisId?.toLowerCase().includes(q) ||
      s.fatherName?.toLowerCase().includes(q);
  });

  // ── Safe date-to-string ──
  const toDateStr = (val: unknown): string => {
    if (!val) return '';
    try {
      const d = val instanceof Date ? val : new Date(val as string);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch { return ''; }
  };

  // ── Form handlers ──
  const setField = (key: string, val: string) => setFormData(p => ({ ...p, [key]: val }));

  const openAdd = () => {
    setEditingStudent(null);
    setFormData({
      ...EMPTY_FORM,
      classId: selectedClass?.id || '',
      sectionId: selectedSection?.id || '',
    });
    setFormSection('basic');
    setShowAddModal(true);
  };

  const openEdit = (s: Student) => {
    setEditingStudent(s);
    setFormData({
      emisId: s.emisId || '', name: s.name, nameTamil: s.nameTamil || '',
      dob: toDateStr(s.dob),
      gender: s.gender || 'male', bloodGroup: s.bloodGroup || '',
      classId: s.classId || '', sectionId: s.sectionId || '',
      address: s.address || '', pinCode: s.pinCode || '',
      fatherName: s.fatherName || '', fatherOccupation: s.fatherOccupation || '', fatherEducation: s.fatherEducation || '',
      motherName: s.motherName || '', motherOccupation: s.motherOccupation || '', motherEducation: s.motherEducation || '',
      guardianName: s.guardianName || '', guardianOccupation: s.guardianOccupation || '',
      aadhaarNumber: s.aadhaarNumber || '', phone: s.phone || '', phoneVerifyStatus: s.phoneVerifyStatus || '',
      email: s.email || '',
      dateOfJoining: toDateStr(s.dateOfJoining),
      admissionNumber: s.admissionNumber || '',
      religion: s.religion || '', mediumOfInstruction: s.mediumOfInstruction || '',
      community: s.community || '', disabilityGroupName: s.disabilityGroupName || '',
      groupCode: s.groupCode || '', motherTongue: s.motherTongue || '',
      transportType: (s as any).transportType || 'out',
      routeId: (s as any).routeId || '',
    });
    setFormSection('basic');
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!formData.name) { showToast('Student name is required'); return; }
    try {
      const classId = formData.classId || selectedClass?.id || '';
      const sectionId = formData.sectionId || selectedSection?.id || '';
      const className = selectedClass?.name || editingStudent?.className || '';
      const sectionName = selectedSection?.name || editingStudent?.sectionName || '';

      const payload: Record<string, unknown> = {
        ...formData,
        classId,
        sectionId,
        dob: formData.dob ? new Date(formData.dob) : null,
        dateOfJoining: formData.dateOfJoining ? new Date(formData.dateOfJoining) : null,
        className,
        sectionName,
        academicYear: school.academicYear,
        routeName: routes.find(r => r.id === formData.routeId)?.routeName || '',
        parentIds: editingStudent?.parentIds || [],
        status: editingStudent?.status || 'active',
        photo: editingStudent?.photo || '',
      };
      if (editingStudent) {
        await StudentsService.update(editingStudent.id, payload);
        showToast('Student updated!');
      } else {
        await StudentsService.create(payload);
        showToast('Student added!');
      }
      await fetchData();
      setShowAddModal(false);
    } catch (error) {
      console.error('Error saving student:', error);
      showToast('Failed to save student');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      await StudentsService.delete(id);
      setStudents(prev => prev.filter(s => s.id !== id));
      showToast('Student removed');
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to remove student');
    }
  };

  // ── Excel handling ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (raw.length === 0) { showToast('No data found in file'); return; }

        // Map columns
        const mapped = raw.map(row => {
          const out: Record<string, string> = {};
          for (const [header, value] of Object.entries(row)) {
            const key = COLUMN_MAP[header.toLowerCase().trim()] || COLUMN_MAP[header.toLowerCase().replace(/[^a-z]/g, '')] || '';
            if (key) out[key] = String(value).trim();
          }
          // Ensure name exists
          if (!out.name) {
            const firstVal = Object.values(row).find(v => typeof v === 'string' && v.trim().length > 2);
            if (firstVal) out.name = String(firstVal).trim();
          }
          return out;
        }).filter(r => r.name);

        // Parse section from _rawClass (e.g., '1-A') or _rawSection (e.g., 'A')
        const withSection = mapped.map(row => {
          let sec = (row._rawSection || '').trim().toUpperCase();
          const rawCls = (row._rawClass || '').trim();
          // If class contains dash like '1-A', extract section from it
          if (!sec && rawCls.includes('-')) {
            const parts = rawCls.split('-');
            sec = parts.slice(1).join('-').trim().toUpperCase();
          }
          return { ...row, _parsedSection: sec };
        });

        setUploadedRows(withSection);
        if (mapped.length === 0) showToast('No valid student rows found');
      } catch {
        showToast('Failed to read file. Please check the format.');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBulkUpload = async () => {
    if (uploadedRows.length === 0 || !selectedClass) return;
    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const row of uploadedRows) {
      try {
        const genderRaw = (row.gender || '').toLowerCase();
        const gender = genderRaw.startsWith('f') ? 'female' : genderRaw === 'other' ? 'other' : 'male';

        let dob: Date | null = null;
        if (row.dob) {
          const parsed = new Date(row.dob);
          if (!isNaN(parsed.getTime())) dob = parsed;
        }
        let dateOfJoining: Date | null = null;
        if (row.dateOfJoining) {
          const parsed = new Date(row.dateOfJoining);
          if (!isNaN(parsed.getTime())) dateOfJoining = parsed;
        }

        // Auto-resolve section from Excel data
        const parsedSec = (row._parsedSection || '').toUpperCase();
        let targetSection: Section | undefined;
        if (parsedSec && selectedClass.sections) {
          targetSection = selectedClass.sections.find(s =>
            s.name.toUpperCase() === parsedSec
          );
        }
        // Fallback to selectedSection if uploading from section view
        if (!targetSection && selectedSection) {
          targetSection = selectedSection;
        }
        if (!targetSection && selectedClass.sections?.length > 0) {
          targetSection = selectedClass.sections[0];
        }

        // Normalize transportation type from Excel
        const transportRaw = (row.transportType || '').toLowerCase().trim();
        const transportType = (transportRaw === 'bus' || transportRaw === 'yes' || transportRaw === 'true' || transportRaw === 'school bus') ? 'bus' : 'out';

        await StudentsService.create({
          emisId: row.emisId || '',
          name: row.name,
          nameTamil: row.nameTamil || '',
          dob,
          gender,
          bloodGroup: row.bloodGroup || '',
          classId: selectedClass.id,
          sectionId: targetSection?.id || '',
          className: selectedClass.name,
          sectionName: targetSection?.name || '',
          academicYear: school.academicYear,
          address: row.address || '',
          pinCode: row.pinCode || '',
          fatherName: row.fatherName || '',
          fatherOccupation: row.fatherOccupation || '',
          fatherEducation: row.fatherEducation || '',
          motherName: row.motherName || '',
          motherOccupation: row.motherOccupation || '',
          motherEducation: row.motherEducation || '',
          guardianName: row.guardianName || '',
          guardianOccupation: row.guardianOccupation || '',
          aadhaarNumber: row.aadhaarNumber || '',
          phone: row.phone || '',
          phoneVerifyStatus: row.phoneVerifyStatus || '',
          email: row.email || '',
          dateOfJoining,
          admissionNumber: row.admissionNumber || '',
          religion: row.religion || '',
          mediumOfInstruction: row.mediumOfInstruction || '',
          community: row.community || '',
          disabilityGroupName: row.disabilityGroupName || '',
          groupCode: row.groupCode || '',
          motherTongue: row.motherTongue || '',
          transportType,
          parentIds: [],
          status: 'active',
          photo: '',
        });
        successCount++;
      } catch (err) {
        console.error('Failed to upload row:', row.name, err);
        failCount++;
      }
    }

    setUploading(false);
    showToast(`Uploaded ${successCount} students${failCount > 0 ? `, ${failCount} failed` : ''}`);
    setShowUploadModal(false);
    setUploadedRows([]);
    setUploadFileName('');
    await fetchData();
  };

  // ── Navigate to section ──
  const openSection = (cls: Class, sec: Section) => {
    setSelectedClass(cls);
    setSelectedSection(sec);
    setViewAll(false);
    setSearch('');
  };

  // Open upload for a class (class-level, auto-distribute by section)
  const openClassUpload = (cls: Class) => {
    setSelectedClass(cls);
    setSelectedSection(null);
    setUploadedRows([]);
    setUploadFileName('');
    setShowUploadModal(true);
  };

  const goBack = () => {
    setSelectedClass(null);
    setSelectedSection(null);
    setViewAll(false);
    setSearch('');
  };

  // ── Loading ──
  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  // ═══════════════════════════════════════════════
  // VIEW 2: Section Student List
  // ═══════════════════════════════════════════════
  if (selectedClass && selectedSection) {
    return (
      <div className="page-container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <button onClick={goBack} style={{
            padding: 'var(--space-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center',
            transition: 'background 150ms',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-variant)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
          >
            <ArrowLeftIcon size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <h2 className="text-h2" style={{ margin: 0 }}>{selectedClass.name} — Section {selectedSection.name}</h2>
            <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
              {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => { setUploadedRows([]); setUploadFileName(''); setShowUploadModal(true); }} icon={<UploadIcon size={18} />}>
              Upload Excel
            </Button>
            <Button variant="primary" onClick={openAdd} icon={<PlusIcon size={20} color="white" />}>
              Add Student
            </Button>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 'var(--space-4)', maxWidth: 400 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, EMIS ID, father name..." />
        </div>

        {/* Student List */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--color-border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 1fr 0.8fr 0.6fr', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-surface-variant)', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--color-border)' }}>
            <span className="text-overline">Student</span>
            <span className="text-overline">Father Name</span>
            <span className="text-overline">Phone</span>
            <span className="text-overline">Status</span>
            <span className="text-overline" style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {filteredStudents.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <UsersIcon size={40} />
              <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
                No students in this section yet. Add one manually or upload an Excel file.
              </p>
            </div>
          ) : filteredStudents.map(s => (
            <div key={s.id}
              style={{
                display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 1fr 0.8fr 0.6fr',
                alignItems: 'center',
                padding: 'var(--space-3) var(--space-4)',
                borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--color-divider)',
                transition: 'background 100ms',
                cursor: 'pointer',
              }}
              onClick={() => setViewingStudent(s)}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-variant)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                <Avatar name={s.name} size={36} />
                <div style={{ minWidth: 0 }}>
                  <span style={{ font: 'var(--text-body)', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  {s.emisId && <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>EMIS: {s.emisId}</span>}
                </div>
              </div>
              <span style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)' }}>{s.fatherName || '—'}</span>
              <span style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)' }}>{s.phone || '—'}</span>
              <Badge variant={s.status === 'active' ? 'success' : 'default'}>{s.status}</Badge>
              <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
                <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-500)' }}><EditIcon size={16} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}><TrashIcon size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* ===== STUDENT DETAIL MODAL ===== */}
        {viewingStudent && (
          <Modal isOpen={!!viewingStudent} onClose={() => setViewingStudent(null)} title="Student Details" size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Profile header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-lg)' }}>
                <Avatar name={viewingStudent.name} size={64} />
                <div style={{ flex: 1 }}>
                  <h3 style={{ font: 'var(--text-heading-2)', margin: 0 }}>{viewingStudent.name}</h3>
                  {viewingStudent.nameTamil && <p className="text-body-sm" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{viewingStudent.nameTamil}</p>}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <Badge variant={viewingStudent.status === 'active' ? 'success' : 'default'}>{viewingStudent.status}</Badge>
                    {viewingStudent.className && (
                      <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--color-primary-50)', color: 'var(--color-primary-700)', font: 'var(--text-caption)', fontWeight: 600 }}>
                        {viewingStudent.className}{viewingStudent.sectionName ? `-${viewingStudent.sectionName}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button variant="secondary" onClick={() => { setViewingStudent(null); openEdit(viewingStudent); }} icon={<EditIcon size={16} />}>Edit</Button>
                </div>
              </div>

              {/* Detail sections */}
              {(() => {
                const s = viewingStudent;
                const DetailRow = ({ label, value }: { label: string; value: string | undefined | null }) => (
                  value ? (
                    <div style={{ display: 'flex', padding: 'var(--space-2) 0', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--color-divider)' }}>
                      <span style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-tertiary)', width: 180, flexShrink: 0 }}>{label}</span>
                      <span style={{ font: 'var(--text-body-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{value}</span>
                    </div>
                  ) : null
                );
                const SectionTitle = ({ title }: { title: string }) => (
                  <p className="text-overline" style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-1)', color: 'var(--color-primary-500)' }}>{title}</p>
                );
                const fmtDate = (d: unknown) => {
                  if (!d) return '';
                  try {
                    const dt = d instanceof Date ? d : new Date(d as string);
                    if (isNaN(dt.getTime())) return '';
                    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                  } catch { return ''; }
                };

                return (
                  <>
                    <SectionTitle title="Personal Information" />
                    <DetailRow label="EMIS ID" value={s.emisId} />
                    <DetailRow label="Admission Number" value={s.admissionNumber} />
                    <DetailRow label="Date of Birth" value={fmtDate(s.dob)} />
                    <DetailRow label="Gender" value={s.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1) : ''} />
                    <DetailRow label="Blood Group" value={s.bloodGroup} />
                    <DetailRow label="Date of Joining" value={fmtDate(s.dateOfJoining)} />
                    <DetailRow label="Address" value={s.address} />
                    <DetailRow label="Pin Code" value={s.pinCode} />

                    <SectionTitle title="Father Details" />
                    <DetailRow label="Father Name" value={s.fatherName} />
                    <DetailRow label="Occupation" value={s.fatherOccupation} />
                    <DetailRow label="Education" value={s.fatherEducation} />

                    <SectionTitle title="Mother Details" />
                    <DetailRow label="Mother Name" value={s.motherName} />
                    <DetailRow label="Occupation" value={s.motherOccupation} />
                    <DetailRow label="Education" value={s.motherEducation} />

                    <SectionTitle title="Guardian Details" />
                    <DetailRow label="Guardian Name" value={s.guardianName} />
                    <DetailRow label="Occupation" value={s.guardianOccupation} />

                    <SectionTitle title="Contact & Identity" />
                    <DetailRow label="Phone" value={s.phone} />
                    <DetailRow label="Email" value={s.email} />
                    <DetailRow label="Aadhaar Number" value={s.aadhaarNumber} />

                    <SectionTitle title="Academic" />
                    <DetailRow label="Religion" value={s.religion} />
                    <DetailRow label="Community" value={s.community} />
                    <DetailRow label="Medium of Instruction" value={s.mediumOfInstruction} />
                    <DetailRow label="Mother Tongue" value={s.motherTongue} />
                    <DetailRow label="Disability Group" value={s.disabilityGroupName} />
                    <DetailRow label="Group Code" value={s.groupCode} />
                  </>
                );
              })()}
            </div>
          </Modal>
        )}

        {/* ===== ADD/EDIT STUDENT MODAL ===== */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editingStudent ? 'Edit Student' : `Add Student — ${selectedClass.name} ${selectedSection.name}`} size="lg">
          <Tabs tabs={[
            { id: 'basic', label: 'Basic Info' },
            { id: 'parents', label: 'Parents / Guardian' },
            { id: 'academic', label: 'Academic' },
            { id: 'contact', label: 'Contact & Identity' },
          ]} activeTab={formSection} onChange={setFormSection} />
          <div style={{ marginTop: 'var(--space-4)' }}>
            {formSection === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="grid-2">
                  <Input label="Student Name *" required value={formData.name} onChange={e => setField('name', e.target.value)} />
                  <Input label="Name in Tamil" value={formData.nameTamil} onChange={e => setField('nameTamil', e.target.value)} />
                </div>
                <div className="grid-2">
                  <Input label="Date of Birth" type="date" value={formData.dob} onChange={e => setField('dob', e.target.value)} />
                  <Select label="Gender" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} value={formData.gender} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setField('gender', e.target.value)} />
                </div>
                <div className="grid-2">
                  <Input label="Blood Group" value={formData.bloodGroup} onChange={e => setField('bloodGroup', e.target.value)} placeholder="e.g. O+" />
                  <Input label="Date of Joining" type="date" value={formData.dateOfJoining} onChange={e => setField('dateOfJoining', e.target.value)} />
                </div>
                {/* Class info - read only */}
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)' }}>
                  📚 Class: <strong>{selectedClass.name}</strong> &nbsp;|&nbsp; Section: <strong>{selectedSection.name}</strong>
                </div>
                <Textarea label="Address" value={formData.address} onChange={e => setField('address', e.target.value)} rows={2} />
                <Input label="Pin Code" value={formData.pinCode} onChange={e => setField('pinCode', e.target.value)} />
              </div>
            )}
            {formSection === 'parents' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <p className="text-overline" style={{ marginBottom: '-8px' }}>Father Details</p>
                <div className="grid-3">
                  <Input label="Father Name" value={formData.fatherName} onChange={e => setField('fatherName', e.target.value)} />
                  <Input label="Occupation" value={formData.fatherOccupation} onChange={e => setField('fatherOccupation', e.target.value)} />
                  <Input label="Education" value={formData.fatherEducation} onChange={e => setField('fatherEducation', e.target.value)} />
                </div>
                <p className="text-overline" style={{ marginBottom: '-8px' }}>Mother Details</p>
                <div className="grid-3">
                  <Input label="Mother Name" value={formData.motherName} onChange={e => setField('motherName', e.target.value)} />
                  <Input label="Occupation" value={formData.motherOccupation} onChange={e => setField('motherOccupation', e.target.value)} />
                  <Input label="Education" value={formData.motherEducation} onChange={e => setField('motherEducation', e.target.value)} />
                </div>
                <p className="text-overline" style={{ marginBottom: '-8px' }}>Guardian Details</p>
                <div className="grid-2">
                  <Input label="Guardian Name" value={formData.guardianName} onChange={e => setField('guardianName', e.target.value)} />
                  <Input label="Occupation" value={formData.guardianOccupation} onChange={e => setField('guardianOccupation', e.target.value)} />
                </div>
              </div>
            )}
            {formSection === 'academic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="grid-2">
                  <Input label="EMIS ID" value={formData.emisId} onChange={e => setField('emisId', e.target.value)} />
                  <Input label="Admission Number" value={formData.admissionNumber} onChange={e => setField('admissionNumber', e.target.value)} />
                </div>
                <div className="grid-2">
                  <Input label="Religion" value={formData.religion} onChange={e => setField('religion', e.target.value)} />
                  <Input label="Community" value={formData.community} onChange={e => setField('community', e.target.value)} />
                </div>
                <div className="grid-2">
                  <Input label="Medium of Instruction" value={formData.mediumOfInstruction} onChange={e => setField('mediumOfInstruction', e.target.value)} />
                  <Input label="Mother Tongue" value={formData.motherTongue} onChange={e => setField('motherTongue', e.target.value)} />
                </div>
                <div className="grid-2">
                  <Input label="Disability Group" value={formData.disabilityGroupName} onChange={e => setField('disabilityGroupName', e.target.value)} />
                  <Input label="Group Code" value={formData.groupCode} onChange={e => setField('groupCode', e.target.value)} />
                </div>
                <div className="grid-2">
                  <Select 
                    label="Transportation" 
                    options={[{ value: 'out', label: 'Out Student' }, { value: 'bus', label: 'School Bus' }]} 
                    value={formData.transportType} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setField('transportType', e.target.value)} 
                  />
                  {formData.transportType === 'bus' && (
                    <Select 
                      label="Assigned Route" 
                      options={[
                        { value: '', label: 'Select Route' },
                        ...routes.map(r => ({ value: r.id, label: `${r.routeName} (₹${r.fee})` }))
                      ]} 
                      value={formData.routeId} 
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setField('routeId', e.target.value)} 
                    />
                  )}
                </div>
              </div>
            )}
            {formSection === 'contact' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="grid-2">
                  <Input label="Phone Number" value={formData.phone} onChange={e => setField('phone', e.target.value)} />
                  <Input label="Phone Verify Status" value={formData.phoneVerifyStatus} onChange={e => setField('phoneVerifyStatus', e.target.value)} />
                </div>
                <Input label="Email" type="email" value={formData.email} onChange={e => setField('email', e.target.value)} />
                <Input label="Aadhaar Number" value={formData.aadhaarNumber} onChange={e => setField('aadhaarNumber', e.target.value)} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--color-border)' }}>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>{editingStudent ? 'Update' : 'Add Student'}</Button>
          </div>
        </Modal>

        {/* ===== UPLOAD EXCEL MODAL ===== */}
        <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title={`Upload Students — ${selectedClass.name}${selectedSection ? ` ${selectedSection.name}` : ''}`} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-primary-50)', borderRadius: 'var(--radius-md)', font: 'var(--text-body-sm)', color: 'var(--color-primary-700)' }}>
              {selectedSection
                ? <>Students will be assigned to <strong>{selectedClass.name} — Section {selectedSection.name}</strong>.</>
                : <>Students will be <strong>auto-distributed</strong> to sections based on the Section column in your Excel (e.g., &quot;1-A&quot; or &quot;A&quot;).</>
              }
            </div>

            {/* File picker */}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: 'none' }} />
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: 'var(--space-6)',
                borderWidth: 2, borderStyle: 'dashed', borderColor: uploadFileName ? 'var(--color-success)' : 'var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                background: uploadFileName ? 'var(--color-success-bg)' : 'var(--color-surface-variant)',
                cursor: 'pointer', textAlign: 'center',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { if (!uploadFileName) e.currentTarget.style.borderColor = 'var(--color-primary-300)'; }}
              onMouseLeave={e => { if (!uploadFileName) e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            >
              <UploadIcon size={32} />
              <p className="text-body-sm" style={{ fontWeight: 500, marginTop: 'var(--space-2)' }}>
                {uploadFileName ? `✓ ${uploadFileName}` : 'Click to select Excel / CSV file'}
              </p>
              {uploadedRows.length > 0 && (
                <p className="text-caption" style={{ color: 'var(--color-success)', marginTop: '4px', fontWeight: 600 }}>
                  {uploadedRows.length} students found and ready to upload
                </p>
              )}
            </div>

            {/* Section distribution summary */}
            {uploadedRows.length > 0 && !selectedSection && (() => {
              const sectionCounts: Record<string, number> = {};
              uploadedRows.forEach(r => {
                const sec = r._parsedSection || 'Unknown';
                sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
              });
              return (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {Object.entries(sectionCounts).sort().map(([sec, count]) => (
                    <span key={sec} style={{
                      padding: '4px 12px', borderRadius: 'var(--radius-full)',
                      background: sec === 'Unknown' ? 'var(--color-warning-bg)' : 'var(--color-primary-50)',
                      color: sec === 'Unknown' ? 'var(--color-warning)' : 'var(--color-primary-700)',
                      font: 'var(--text-caption)', fontWeight: 600,
                    }}>
                      Section {sec}: {count} students
                    </span>
                  ))}
                </div>
              );
            })()}

            {/* Preview table */}
            {uploadedRows.length > 0 && (
              <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 'var(--radius-md)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--color-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', font: 'var(--text-body-sm)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-variant)', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', font: 'var(--text-overline)', color: 'var(--color-text-secondary)' }}>#</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', font: 'var(--text-overline)', color: 'var(--color-text-secondary)' }}>Name</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', font: 'var(--text-overline)', color: 'var(--color-text-secondary)' }}>Section</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', font: 'var(--text-overline)', color: 'var(--color-text-secondary)' }}>Father</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', font: 'var(--text-overline)', color: 'var(--color-text-secondary)' }}>Phone</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', font: 'var(--text-overline)', color: 'var(--color-text-secondary)' }}>EMIS ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedRows.map((row, i) => (
                      <tr key={i} style={{ borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--color-divider)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-tertiary)' }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{row.name}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                            background: 'var(--color-primary-50)', color: 'var(--color-primary-700)',
                            fontWeight: 600, fontSize: '0.75rem',
                          }}>
                            {row._parsedSection || (selectedSection?.name) || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>{row.fatherName || '—'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>{row.phone || '—'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>{row.emisId || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowUploadModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleBulkUpload} disabled={uploadedRows.length === 0 || uploading}>
                {uploading ? 'Uploading...' : `Upload ${uploadedRows.length} Students`}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // VIEW: All Students (flat list)
  // ═══════════════════════════════════════════════
  if (viewAll) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <button onClick={goBack} style={{
            padding: 'var(--space-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-variant)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
          >
            <ArrowLeftIcon size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <h2 className="text-h2" style={{ margin: 0 }}>All Students</h2>
            <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
              {filteredStudents.length} of {students.length} students
            </p>
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-4)', maxWidth: 400 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, EMIS ID, father name..." />
        </div>

        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--color-border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr 0.8fr 0.6fr', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-surface-variant)', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--color-border)' }}>
            <span className="text-overline">Student</span>
            <span className="text-overline">Class</span>
            <span className="text-overline">Father Name</span>
            <span className="text-overline">Phone</span>
            <span className="text-overline">Status</span>
            <span className="text-overline" style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {filteredStudents.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No students match your search.</p>
            </div>
          ) : filteredStudents.map(s => (
            <div key={s.id}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr 0.8fr 0.6fr',
                alignItems: 'center',
                padding: 'var(--space-3) var(--space-4)',
                borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--color-divider)',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-variant)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                <Avatar name={s.name} size={36} />
                <span style={{ font: 'var(--text-body)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              </div>
              <span style={{ font: 'var(--text-body-sm)', fontWeight: 500 }}>
                {s.className || '—'}{s.sectionName ? `-${s.sectionName}` : ''}
              </span>
              <span style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)' }}>{s.fatherName || '—'}</span>
              <span style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)' }}>{s.phone || '—'}</span>
              <Badge variant={s.status === 'active' ? 'success' : 'default'}>{s.status}</Badge>
              <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
                <button onClick={() => openEdit(s)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-500)' }}><EditIcon size={16} /></button>
                <button onClick={() => handleDelete(s.id)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}><TrashIcon size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Edit modal for All Students view */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Edit Student" size="lg">
          <Tabs tabs={[
            { id: 'basic', label: 'Basic Info' },
            { id: 'parents', label: 'Parents / Guardian' },
            { id: 'academic', label: 'Academic' },
            { id: 'contact', label: 'Contact & Identity' },
          ]} activeTab={formSection} onChange={setFormSection} />
          <div style={{ marginTop: 'var(--space-4)' }}>
            {formSection === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="grid-2">
                  <Input label="Student Name *" required value={formData.name} onChange={e => setField('name', e.target.value)} />
                  <Input label="Name in Tamil" value={formData.nameTamil} onChange={e => setField('nameTamil', e.target.value)} />
                </div>
                <div className="grid-2">
                  <Input label="Date of Birth" type="date" value={formData.dob} onChange={e => setField('dob', e.target.value)} />
                  <Select label="Gender" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} value={formData.gender} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setField('gender', e.target.value)} />
                </div>
                <div className="grid-2">
                  <Input label="Blood Group" value={formData.bloodGroup} onChange={e => setField('bloodGroup', e.target.value)} />
                  <Input label="Date of Joining" type="date" value={formData.dateOfJoining} onChange={e => setField('dateOfJoining', e.target.value)} />
                </div>
                <Textarea label="Address" value={formData.address} onChange={e => setField('address', e.target.value)} rows={2} />
                <Input label="Pin Code" value={formData.pinCode} onChange={e => setField('pinCode', e.target.value)} />
              </div>
            )}
            {formSection === 'parents' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="grid-3">
                  <Input label="Father Name" value={formData.fatherName} onChange={e => setField('fatherName', e.target.value)} />
                  <Input label="Occupation" value={formData.fatherOccupation} onChange={e => setField('fatherOccupation', e.target.value)} />
                  <Input label="Education" value={formData.fatherEducation} onChange={e => setField('fatherEducation', e.target.value)} />
                </div>
                <div className="grid-3">
                  <Input label="Mother Name" value={formData.motherName} onChange={e => setField('motherName', e.target.value)} />
                  <Input label="Occupation" value={formData.motherOccupation} onChange={e => setField('motherOccupation', e.target.value)} />
                  <Input label="Education" value={formData.motherEducation} onChange={e => setField('motherEducation', e.target.value)} />
                </div>
                <div className="grid-2">
                  <Input label="Guardian Name" value={formData.guardianName} onChange={e => setField('guardianName', e.target.value)} />
                  <Input label="Occupation" value={formData.guardianOccupation} onChange={e => setField('guardianOccupation', e.target.value)} />
                </div>
              </div>
            )}
            {formSection === 'academic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="grid-2">
                  <Input label="EMIS ID" value={formData.emisId} onChange={e => setField('emisId', e.target.value)} />
                  <Input label="Admission Number" value={formData.admissionNumber} onChange={e => setField('admissionNumber', e.target.value)} />
                </div>
                <div className="grid-2">
                  <Input label="Religion" value={formData.religion} onChange={e => setField('religion', e.target.value)} />
                  <Input label="Community" value={formData.community} onChange={e => setField('community', e.target.value)} />
                </div>
                <div className="grid-2">
                  <Input label="Medium of Instruction" value={formData.mediumOfInstruction} onChange={e => setField('mediumOfInstruction', e.target.value)} />
                  <Input label="Mother Tongue" value={formData.motherTongue} onChange={e => setField('motherTongue', e.target.value)} />
                </div>
              </div>
            )}
            {formSection === 'contact' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="grid-2">
                  <Input label="Phone Number" value={formData.phone} onChange={e => setField('phone', e.target.value)} />
                  <Input label="Phone Verify Status" value={formData.phoneVerifyStatus} onChange={e => setField('phoneVerifyStatus', e.target.value)} />
                </div>
                <Input label="Email" type="email" value={formData.email} onChange={e => setField('email', e.target.value)} />
                <Input label="Aadhaar Number" value={formData.aadhaarNumber} onChange={e => setField('aadhaarNumber', e.target.value)} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--color-border)' }}>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>Update</Button>
          </div>
        </Modal>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // VIEW 1: Class-Section Grid (default)
  // ═══════════════════════════════════════════════
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="text-h1">Students</h2>
            <Badge variant="primary">{school?.academicYear}</Badge>
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>Manage student records and admissions</p>
        </div>
        <Button variant="secondary" onClick={() => { setViewAll(true); setSearch(''); }} icon={<UsersIcon size={18} />}>
          View All Students
        </Button>
      </div>

      {classes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-4)' }}>
          <SchoolIcon size={56} />
          <h3 className="text-h3" style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>No Classes Created</h3>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', maxWidth: 400, margin: '0 auto' }}>
            You need to create classes and sections first before adding students. Go to the <strong>Classes</strong> section in the sidebar to get started.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {classes.map((cls, idx) => {
            const color = CLASS_COLORS[idx % CLASS_COLORS.length];
            const totalInClass = getStudentsForClass(cls.id).length;

            return (
              <div key={cls.id} style={{
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--color-border)',
                overflow: 'hidden',
              }}>
                {/* Class header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-4) var(--space-5)',
                  background: color.bg,
                  borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--color-border)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-md)',
                    background: 'white', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: color.accent,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    <SchoolIcon size={22} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ font: 'var(--text-heading-3)', color: color.text, margin: 0 }}>{cls.name}</h3>
                    <p className="text-caption" style={{ margin: 0 }}>{cls.academicYear} • {totalInClass} students</p>
                  </div>
                  <Button variant="secondary" onClick={() => openClassUpload(cls)} icon={<UploadIcon size={16} />}>
                    Upload Excel
                  </Button>
                </div>

                {/* Section pills */}
                <div style={{ padding: 'var(--space-4) var(--space-5)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  {cls.sections && cls.sections.length > 0 ? cls.sections.map(sec => {
                    const count = getStudentsForSection(cls.id, sec.id).length;
                    return (
                      <button
                        key={sec.id}
                        onClick={() => openSection(cls, sec)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                          padding: 'var(--space-3) var(--space-4)',
                          background: 'var(--color-surface-variant)',
                          borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          transition: 'all 150ms',
                          minWidth: 140,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = color.bg;
                          e.currentTarget.style.borderColor = color.accent;
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'var(--color-surface-variant)';
                          e.currentTarget.style.borderColor = 'var(--color-border)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                          background: color.accent, color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.875rem',
                        }}>
                          {sec.name}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ font: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            Section {sec.name}
                          </div>
                          <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>
                            {count} student{count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </button>
                    );
                  }) : (
                    <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No sections defined</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Upload modal for class-level upload */}
      {selectedClass && (
        <Modal isOpen={showUploadModal} onClose={() => { setShowUploadModal(false); setSelectedClass(null); }} title={`Upload Students — ${selectedClass.name}`} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-primary-50)', borderRadius: 'var(--radius-md)', font: 'var(--text-body-sm)', color: 'var(--color-primary-700)' }}>
              Students will be <strong>auto-distributed</strong> to sections based on the Section column in your Excel (e.g., &quot;1-A&quot; or &quot;A&quot;).
            </div>

            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: 'none' }} />
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: 'var(--space-6)',
                borderWidth: 2, borderStyle: 'dashed', borderColor: uploadFileName ? 'var(--color-success)' : 'var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                background: uploadFileName ? 'var(--color-success-bg)' : 'var(--color-surface-variant)',
                cursor: 'pointer', textAlign: 'center',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { if (!uploadFileName) e.currentTarget.style.borderColor = 'var(--color-primary-300)'; }}
              onMouseLeave={e => { if (!uploadFileName) e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            >
              <UploadIcon size={32} />
              <p className="text-body-sm" style={{ fontWeight: 500, marginTop: 'var(--space-2)' }}>
                {uploadFileName ? `✓ ${uploadFileName}` : 'Click to select Excel / CSV file'}
              </p>
              {uploadedRows.length > 0 && (
                <p className="text-caption" style={{ color: 'var(--color-success)', marginTop: '4px', fontWeight: 600 }}>
                  {uploadedRows.length} students found and ready to upload
                </p>
              )}
            </div>

            {/* Section distribution summary */}
            {uploadedRows.length > 0 && (() => {
              const sectionCounts: Record<string, number> = {};
              uploadedRows.forEach(r => {
                const sec = r._parsedSection || 'Unknown';
                sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
              });
              return (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {Object.entries(sectionCounts).sort().map(([sec, count]) => (
                    <span key={sec} style={{
                      padding: '4px 12px', borderRadius: 'var(--radius-full)',
                      background: sec === 'Unknown' ? 'var(--color-warning-bg)' : 'var(--color-primary-50)',
                      color: sec === 'Unknown' ? 'var(--color-warning)' : 'var(--color-primary-700)',
                      font: 'var(--text-caption)', fontWeight: 600,
                    }}>
                      Section {sec}: {count} students
                    </span>
                  ))}
                </div>
              );
            })()}

            {/* Preview table */}
            {uploadedRows.length > 0 && (
              <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 'var(--radius-md)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--color-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', font: 'var(--text-body-sm)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-variant)', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', font: 'var(--text-overline)', color: 'var(--color-text-secondary)' }}>#</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', font: 'var(--text-overline)', color: 'var(--color-text-secondary)' }}>Name</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', font: 'var(--text-overline)', color: 'var(--color-text-secondary)' }}>Section</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', font: 'var(--text-overline)', color: 'var(--color-text-secondary)' }}>Father</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', font: 'var(--text-overline)', color: 'var(--color-text-secondary)' }}>Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedRows.map((row, i) => (
                      <tr key={i} style={{ borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--color-divider)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-tertiary)' }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{row.name}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                            background: 'var(--color-primary-50)', color: 'var(--color-primary-700)',
                            fontWeight: 600, fontSize: '0.75rem',
                          }}>
                            {row._parsedSection || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>{row.fatherName || '—'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>{row.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => { setShowUploadModal(false); setSelectedClass(null); }}>Cancel</Button>
              <Button variant="primary" onClick={async () => { await handleBulkUpload(); setSelectedClass(null); }} disabled={uploadedRows.length === 0 || uploading}>
                {uploading ? 'Uploading...' : `Upload ${uploadedRows.length} Students`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
