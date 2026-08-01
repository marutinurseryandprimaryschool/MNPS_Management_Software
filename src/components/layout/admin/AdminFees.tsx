'use client';
import React, { useState, useEffect } from 'react';
import { FeeStructuresService, FeePaymentsService, ClassesService, StudentsService, BusRoutesService } from '@/lib/firestore-service';
import { Select } from '@/components/ui/Input';
import SearchableSelect from '@/components/ui/SearchableSelect';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { useToast } from '@/components/ui/Toast';
import { Badge, Tabs, Avatar } from '@/components/ui/SharedUI';
import { PlusIcon, CreditCardIcon, EditIcon, TrashIcon } from '@/components/ui/Icons';
import { formatCompactCurrency } from '@/lib/utils';
import type { FeePayment, Class, Student } from '@/types/models';

// All 12 months in calendar order. Staff manually unchecks holiday months per
// their school's calendar — no auto-exclusion of summer break.
const ACADEMIC_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface TermFee { name: string; amount: number }
interface AdditionalFee { name: string; amount: number }
interface BusRoute { id: string; routeName: string; fee: number; }
interface FeeStructureData {
  id: string; classId: string; className: string; academicYear: string;
  terms: TermFee[]; extracurricular: number; additionalFees: AdditionalFee[];
  busFee: number; busMonths: string[]; totalAmount: number;
  includeBusFee?: boolean;
}

export default function AdminFees({ subPage }: { subPage?: 'overview' | 'structures' | 'payments' }) {
  const { user } = useAuth();
  const { school } = useSchool();
  const [activeTab, setActiveTab] = useState(subPage === 'payments' ? 'payments' : 'structures');
  const effectiveView = subPage || 'all';
  const [feeStructures, setFeeStructures] = useState<FeeStructureData[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingStructure, setEditingStructure] = useState<FeeStructureData | null>(null);

  // ── Per-student fee adjustment (scholarship etc.) ──
  const [feeEditStudent, setFeeEditStudent] = useState<Student | null>(null);
  const [feeEditForm, setFeeEditForm] = useState<{ amount: string; reason: string }>({ amount: '', reason: '' });
  const [feeEditSaving, setFeeEditSaving] = useState(false);

  // Returns the class-fee portion for a specific student. Priority:
  //   1. Manual feeAdjustment.amount (per-student override).
  //   2. Scholarship program amount for the student's class (e.g. RTE).
  //   3. Fee structure default (fs.totalAmount).
  const effectiveClassFee = (fs: FeeStructureData, st: Student): number => {
    if (st.feeAdjustment && typeof st.feeAdjustment.amount === 'number') {
      return st.feeAdjustment.amount;
    }
    if (st.scholarshipId) {
      const scholarship = (school.settings?.scholarships || []).find(x => x.id === st.scholarshipId && x.active);
      const amt = scholarship?.amountsByClass?.[st.classId];
      if (typeof amt === 'number') return amt;
    }
    return fs.totalAmount;
  };
  const [viewingClassId, setViewingClassId] = useState<string | null>(null);
  const [viewingSectionId, setViewingSectionId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const { showToast } = useToast();

  const [structureForm, setStructureForm] = useState({
    classId: '', term1: '', term2: '', term3: '', extracurricular: '',
    includeBusFee: false,
    busMonths: ACADEMIC_MONTHS,
    additionalFees: [] as { name: string; amount: string }[],
  });
  const [paymentForm, setPaymentForm] = useState({
    studentId: '', classId: '', category: '', amount: '', mode: 'cash', referenceNumber: '',
  });

  const refreshData = async () => {
    if (!school?.academicYear) return;
    const [fs, p, c, s, br] = await Promise.all([
      FeeStructuresService.getAll(school.academicYear), 
      FeePaymentsService.getAll(school.academicYear),
      ClassesService.getAll(school.academicYear), 
      StudentsService.getAll(school.academicYear),
      BusRoutesService.getAll(),
    ]);
    setFeeStructures(fs as unknown as FeeStructureData[]);
    const sorted = (p as unknown as FeePayment[]).sort((a, b) => {
      const dA = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const dB = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return dB - dA;
    });
    setPayments(sorted);
    setClasses(c as unknown as Class[]);
    setStudents(s as unknown as Student[]);
    setBusRoutes(br as unknown as BusRoute[]);
  };

  useEffect(() => { 
    refreshData().catch(console.error).finally(() => setLoading(false)); 
  }, [school?.academicYear]);

  // ── Structure CRUD ──
  const openAddStructure = () => {
    setEditingStructure(null);
    setStructureForm({ classId: '', term1: '', term2: '', term3: '', extracurricular: '', includeBusFee: false, busMonths: ACADEMIC_MONTHS, additionalFees: [] });
    setShowStructureModal(true);
  };
  const openEditStructure = (fs: FeeStructureData) => {
    setEditingStructure(fs);
    setStructureForm({
      classId: fs.classId, term1: String(fs.terms?.[0]?.amount || ''),
      term2: String(fs.terms?.[1]?.amount || ''), term3: String(fs.terms?.[2]?.amount || ''),
      extracurricular: String(fs.extracurricular || ''),
      includeBusFee: fs.includeBusFee ?? (fs.busFee > 0),
      busMonths: fs.busMonths || ACADEMIC_MONTHS,
      additionalFees: (fs.additionalFees || []).map(a => ({ name: a.name, amount: String(a.amount) })),
    });
    setShowStructureModal(true);
  };
  const addAdditionalFee = () => {
    setStructureForm(p => ({ ...p, additionalFees: [...p.additionalFees, { name: '', amount: '' }] }));
  };
  const removeAdditionalFee = (idx: number) => {
    setStructureForm(p => ({ ...p, additionalFees: p.additionalFees.filter((_, i) => i !== idx) }));
  };

  const handleSaveStructure = async () => {
    if (!structureForm.classId) { showToast('Select a class'); return; }
    const cls = classes.find(c => c.id === structureForm.classId);
    const t1 = parseFloat(structureForm.term1) || 0;
    const t2 = parseFloat(structureForm.term2) || 0;
    const t3 = parseFloat(structureForm.term3) || 0;
    const ext = parseFloat(structureForm.extracurricular) || 0;
    const additional = structureForm.additionalFees.filter(a => a.name).map(a => ({ name: a.name, amount: parseFloat(a.amount) || 0 }));
    const total = t1 + t2 + t3 + ext + additional.reduce((s, a) => s + a.amount, 0);
    const payload = {
      classId: structureForm.classId, className: cls?.name || '',
      academicYear: school.academicYear,
      terms: [{ name: 'Term 1', amount: t1 }, { name: 'Term 2', amount: t2 }, { name: 'Term 3', amount: t3 }],
      extracurricular: ext, additionalFees: additional,
      busFee: 0, // Bus fee now comes from the student's assigned route
      includeBusFee: structureForm.includeBusFee,
      busMonths: structureForm.busMonths, totalAmount: total,
    };
    try {
      if (editingStructure?.id) await FeeStructuresService.update(editingStructure.id, payload);
      else await FeeStructuresService.create(payload);
      await refreshData();
      setShowStructureModal(false);
      showToast(editingStructure ? 'Fee structure updated!' : 'Fee structure created!');
    } catch (e) { console.error(e); showToast('Failed to save'); }
  };

  const handleDeleteStructure = async (id: string) => {
    try { await FeeStructuresService.delete(id); await refreshData(); showToast('Deleted'); }
    catch (e) { console.error(e); showToast('Failed'); }
  };

  // ── Payment ──
  const selectedPaymentClass = classes.find(c => c.id === paymentForm.classId);
  const paymentStructure = feeStructures.find(fs => fs.classId === paymentForm.classId);
  // Helper for category-wise totals
  const getCategoryPaidMap = (studentId: string) => {
    const map: Record<string, number> = {};
    payments.filter(p => p.studentId === studentId).forEach(p => {
      map[p.category] = (map[p.category] || 0) + (Number(p.amount) || 0);
    });
    return map;
  };

  const categoryOptions = () => {
    const opts = [{ value: '', label: 'Select Category' }];
    if (paymentStructure) {
      const categoryPaid = paymentForm.studentId ? getCategoryPaidMap(paymentForm.studentId) : {};
      
      (paymentStructure.terms || []).forEach(t => {
        const paid = categoryPaid[t.name] || 0;
        if (paid < t.amount) opts.push({ value: t.name, label: `${t.name} — ${paid > 0 ? `Bal: ₹${(t.amount - paid).toLocaleString()}` : `₹${t.amount.toLocaleString()}`}` });
      });
      
      if (paymentStructure.extracurricular) {
        const paid = categoryPaid['Extracurricular'] || 0;
        if (paid < paymentStructure.extracurricular) opts.push({ value: 'Extracurricular', label: `Extracurricular — ${paid > 0 ? `Bal: ₹${(paymentStructure.extracurricular - paid).toLocaleString()}` : `₹${paymentStructure.extracurricular.toLocaleString()}`}` });
      }
      
      (paymentStructure.additionalFees || []).forEach(a => {
        const paid = categoryPaid[a.name] || 0;
        if (paid < a.amount) opts.push({ value: a.name, label: `${a.name} — ${paid > 0 ? `Bal: ₹${(a.amount - paid).toLocaleString()}` : `₹${a.amount.toLocaleString()}`}` });
      });

      const student = students.find(s => s.id === paymentForm.studentId);
      if ((student as any)?.transportType === 'bus' && paymentStructure.includeBusFee) {
        const routeId = (student as any)?.routeId;
        const route = busRoutes.find(r => r.id === routeId);
        const busFee = route?.fee || 0;
        const activeMonths = paymentStructure.busMonths || ACADEMIC_MONTHS;
        if (busFee > 0) {
          activeMonths.forEach(month => {
            const cat = `Bus Fee - ${month}`;
            const paid = categoryPaid[cat] || 0;
            if (paid < busFee) {
              opts.push({ value: cat, label: `${cat} — ${paid > 0 ? `Bal: ₹${(busFee - paid).toLocaleString()}` : `₹${busFee.toLocaleString()}`}` });
            }
          });
        }
      }
    }
    opts.push({ value: 'Other', label: 'Other' });
    return opts;
  };

  const autoFillAmount = (cat: string) => {
    if (!paymentStructure) return;
    const categoryPaid = paymentForm.studentId ? getCategoryPaidMap(paymentForm.studentId) : {};
    const alreadyPaid = categoryPaid[cat] || 0;

    const term = paymentStructure.terms?.find(t => t.name === cat);
    if (term) { setPaymentForm(p => ({ ...p, amount: String(Math.max(0, term.amount - alreadyPaid)) })); return; }
    
    if (cat === 'Extracurricular') { setPaymentForm(p => ({ ...p, amount: String(Math.max(0, paymentStructure.extracurricular - alreadyPaid)) })); return; }
    
    const add = paymentStructure.additionalFees?.find(a => a.name === cat);
    if (add) { setPaymentForm(p => ({ ...p, amount: String(Math.max(0, add.amount - alreadyPaid)) })); return; }

    if (cat.startsWith('Bus Fee -')) {
      const student = students.find(s => s.id === paymentForm.studentId);
      const routeId = (student as any)?.routeId;
      const route = busRoutes.find(r => r.id === routeId);
      const busFee = route?.fee || 0;
      setPaymentForm(p => ({ ...p, amount: String(Math.max(0, busFee - alreadyPaid)) }));
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.studentId || !paymentForm.amount) { showToast('Select student and enter amount'); return; }
    const student = students.find(s => s.id === paymentForm.studentId);
    try {
      await FeePaymentsService.create({
        type: 'payment', studentId: paymentForm.studentId, studentName: student?.name || '',
        classId: paymentForm.classId, className: selectedPaymentClass?.name || '',
        sectionId: student?.sectionId || '', sectionName: student?.sectionName || '',
        amount: parseFloat(paymentForm.amount), mode: paymentForm.mode,
        category: paymentForm.category, referenceNumber: paymentForm.referenceNumber,
        receiptNumber: `RCP-${Date.now().toString(36).toUpperCase()}`,
        collectedBy: user?.id || '', collectedByName: user?.name || 'Admin',
        collectedByEmail: user?.email || '', paidAt: new Date(),
        academicYear: school.academicYear,
      });
      await refreshData();
      setShowPaymentModal(false);
      setPaymentForm({ studentId: '', classId: '', category: '', amount: '', mode: 'cash', referenceNumber: '' });
      showToast('Payment recorded!');
    } catch (e) { console.error(e); showToast('Failed'); }
  };

  const handleSaveFeeAdjustment = async () => {
    if (!feeEditStudent) return;
    const fs = feeStructures.find(s => s.classId === feeEditStudent.classId);
    const structureAmount = fs?.totalAmount ?? 0;
    const parsed = Number(feeEditForm.amount);
    if (!Number.isFinite(parsed) || parsed < 0) { showToast('Enter a valid amount'); return; }
    setFeeEditSaving(true);
    try {
      // If the entered amount matches the class structure and no reason is
      // given, treat it as "no override" — clear the adjustment cleanly.
      const shouldClear = parsed === structureAmount && !feeEditForm.reason.trim();
      const updates: Record<string, unknown> = shouldClear
        ? { feeAdjustment: null }
        : { feeAdjustment: { amount: parsed, reason: feeEditForm.reason.trim() || null } };
      await StudentsService.update(feeEditStudent.id, updates);
      await refreshData();
      showToast(shouldClear ? 'Fee adjustment removed' : 'Fee updated');
      setFeeEditStudent(null);
    } catch (e) {
      console.error(e);
      showToast('Failed to update fee');
    } finally {
      setFeeEditSaving(false);
    }
  };

  const handleResetFeeAdjustment = async () => {
    if (!feeEditStudent) return;
    setFeeEditSaving(true);
    try {
      await StudentsService.update(feeEditStudent.id, { feeAdjustment: null });
      await refreshData();
      showToast('Fee reset to class default');
      setFeeEditStudent(null);
    } catch (e) {
      console.error(e);
      showToast('Failed to reset fee');
    } finally {
      setFeeEditSaving(false);
    }
  };

  const totalCollected = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayPayments = payments.filter(p => p.paidAt && new Date(p.paidAt).toISOString().split('T')[0] === todayStr);
  const todayTotal = todayPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  // ── Month filter for the "This Month" collection card ──
  // Stored as `YYYY-MM`. Defaults to the current month; user can pick any past month.
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [monthFilter, setMonthFilter] = useState<string>(currentMonthKey);
  const monthPayments = payments.filter(p =>
    p.paidAt && new Date(p.paidAt).toISOString().slice(0, 7) === monthFilter
  );
  const monthTotal = monthPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const isCurrentMonth = monthFilter === currentMonthKey;
  const monthLabel = new Date(monthFilter + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const filteredStudents = paymentForm.classId
    ? students.filter(s => s.classId === paymentForm.classId)
    : students;

  if (loading) return <div className="page-container"><div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:300 }}><span className="text-body-sm" style={{ color:'var(--color-text-tertiary)' }}>Loading...</span></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="text-h1">{effectiveView === 'overview' ? 'Fee Overview' : effectiveView === 'structures' ? 'Fee Structures' : effectiveView === 'payments' ? 'Payments' : 'Fee Management'}</h2>
            <Badge variant="primary">{school?.academicYear}</Badge>
          </div>
          <p className="text-body-sm">Total Collected: {formatCompactCurrency(totalCollected)}</p>
        </div>
        <div style={{ display:'flex',gap:'var(--space-2)' }}>
          {(effectiveView === 'all' || effectiveView === 'structures') && <Button variant="secondary" onClick={openAddStructure} icon={<PlusIcon size={18} />}>Fee Structure</Button>}
          {(effectiveView === 'all' || effectiveView === 'payments') && <Button variant="primary" onClick={() => setShowPaymentModal(true)} icon={<PlusIcon size={18} color="white" />}>Record Payment</Button>}
        </div>
      </div>

      {/* Summary Cards */}
      {(effectiveView === 'all' || effectiveView === 'overview') && (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'var(--space-4)',marginBottom:'var(--space-4)' }}>
          <div style={{ background:'linear-gradient(135deg,#059669,#10B981)',borderRadius:'var(--radius-lg)',padding:'var(--space-5)',color:'white' }}>
            <div style={{ display:'flex',alignItems:'center',gap:'var(--space-2)',marginBottom:'var(--space-2)',opacity:0.85 }}><CreditCardIcon size={18} /><span style={{ fontSize:'0.85rem',fontWeight:500 }}>Today&apos;s Collection</span></div>
            <div style={{ fontSize:'1.75rem',fontWeight:700 }}>₹{todayTotal.toLocaleString()}</div>
            <div style={{ fontSize:'0.8rem',opacity:0.75,marginTop:4 }}>{todayPayments.length} transaction{todayPayments.length!==1?'s':''}</div>
          </div>
          <div style={{ background:'linear-gradient(135deg,#2563EB,#3B82F6)',borderRadius:'var(--radius-lg)',padding:'var(--space-5)',color:'white' }}>
            <div style={{ display:'flex',alignItems:'center',gap:'var(--space-2)',marginBottom:'var(--space-2)',opacity:0.85 }}><CreditCardIcon size={18} /><span style={{ fontSize:'0.85rem',fontWeight:500 }}>All-Time Collection</span></div>
            <div style={{ fontSize:'1.75rem',fontWeight:700 }}>₹{totalCollected.toLocaleString()}</div>
            <div style={{ fontSize:'0.8rem',opacity:0.75,marginTop:4 }}>{payments.length} total payments</div>
          </div>
          <div style={{ background:'linear-gradient(135deg,#7C3AED,#8B5CF6)',borderRadius:'var(--radius-lg)',padding:'var(--space-5)',color:'white' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--space-2)',marginBottom:'var(--space-2)',opacity:0.9 }}>
              <div style={{ display:'flex',alignItems:'center',gap:'var(--space-2)' }}>
                <CreditCardIcon size={18} />
                <span style={{ fontSize:'0.85rem',fontWeight:500 }}>{isCurrentMonth ? 'This Month' : monthLabel}</span>
              </div>
              <input
                type="month"
                value={monthFilter}
                max={currentMonthKey}
                onChange={e => setMonthFilter(e.target.value || currentMonthKey)}
                title="Pick a month"
                style={{
                  background:'rgba(255,255,255,0.18)', color:'white', border:'1px solid rgba(255,255,255,0.3)',
                  borderRadius:'var(--radius-sm)', padding:'2px 6px', fontSize:'0.72rem', outline:'none',
                  colorScheme:'dark', cursor:'pointer',
                }}
              />
            </div>
            <div style={{ fontSize:'1.75rem',fontWeight:700 }}>₹{monthTotal.toLocaleString()}</div>
            <div style={{ fontSize:'0.8rem',opacity:0.75,marginTop:4 }}>
              {monthPayments.length} payment{monthPayments.length!==1?'s':''}{isCurrentMonth ? '' : ` in ${monthLabel}`}
            </div>
          </div>
        </div>
      )}

      {/* ═══ DETAILED FEE BREAKDOWN ═══ */}
      {(effectiveView === 'all' || effectiveView === 'overview') && feeStructures.length > 0 && (() => {
        let grandTotal = 0, grandCollected = 0;
        const catTotals: Record<string, { expected: number; collected: number }> = {};
        feeStructures.forEach(fs => {
          const classStudents = students.filter(s => s.classId === fs.classId);
          const n = classStudents.length;
          // Base class fee (Terms + Extracurricular + Additional), respecting
          // any per-student overrides (scholarships etc.) instead of a flat
          // `structure * count`.
          const baseExpected = classStudents.reduce((sum, s) => sum + effectiveClassFee(fs, s), 0);
          
          // Calculate total bus fees for this class based on each student's assigned route
          const activeMonths = fs.busMonths || ACADEMIC_MONTHS;
          const busExpected = fs.includeBusFee ? classStudents.reduce((sum, s) => {
            if ((s as any).transportType === 'bus') {
              const route = busRoutes.find(r => r.id === (s as any).routeId);
              return sum + ((route?.fee || 0) * activeMonths.length);
            }
            return sum;
          }, 0) : 0;

          grandTotal += baseExpected + busExpected;

          fs.terms?.forEach(t => { if (!catTotals[t.name]) catTotals[t.name] = { expected: 0, collected: 0 }; catTotals[t.name].expected += t.amount * n; });
          if (fs.extracurricular > 0) { if (!catTotals['Extracurricular']) catTotals['Extracurricular'] = { expected: 0, collected: 0 }; catTotals['Extracurricular'].expected += fs.extracurricular * n; }
          fs.additionalFees?.forEach(a => { if (!catTotals[a.name]) catTotals[a.name] = { expected: 0, collected: 0 }; catTotals[a.name].expected += a.amount * n; });
          
          if (busExpected > 0) {
            if (!catTotals['Bus Fee']) catTotals['Bus Fee'] = { expected: 0, collected: 0 };
            catTotals['Bus Fee'].expected += busExpected;
          }
        });
        payments.forEach(p => { grandCollected += Number(p.amount) || 0; if (catTotals[p.category]) catTotals[p.category].collected += Number(p.amount) || 0; });
        const grandPending = grandTotal - grandCollected;

        if (viewingClassId) return null; // Hide overview when viewing specific class


        return (
          <>
            {/* Grand Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
              <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
                <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--space-2)' }}>Total Expected</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>₹{grandTotal.toLocaleString()}</div>
              </div>
              <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
                <div className="text-caption" style={{ color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--space-2)' }}>Collected</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>₹{grandCollected.toLocaleString()}</div>
              </div>
              <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
                <div className="text-caption" style={{ color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--space-2)' }}>Pending</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#DC2626' }}>₹{grandPending.toLocaleString()}</div>
              </div>
            </div>

            {/* Category-wise Breakdown */}
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
              <div className="text-overline" style={{ marginBottom: 'var(--space-4)' }}>Category-wise Breakdown</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
                {Object.entries(catTotals).map(([name, v]) => (
                  <div key={name} style={{ padding: 'var(--space-3)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)' }}>
                    <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>{name}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>₹{v.expected.toLocaleString()}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-caption" style={{ color: '#059669' }}>Paid: ₹{v.collected.toLocaleString()}</span>
                    </div>
                    {/* Mini progress */}
                    <div style={{ width: '100%', height: 3, borderRadius: 2, background: '#E5E7EB', marginTop: 6 }}>
                      <div style={{ width: `${v.expected > 0 ? Math.min(100, (v.collected / v.expected) * 100) : 0}%`, height: '100%', borderRadius: 2, background: '#059669' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section-wise Class Summary */}
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <div className="text-overline" style={{ marginBottom: 'var(--space-3)' }}>Class-wise Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
                {(() => {
                  const sectionItems: { fs: FeeStructureData; sectionId: string; sectionName: string }[] = [];
                  feeStructures.forEach(fs => {
                    const cls = classes.find(c => c.id === fs.classId);
                    const sections = cls?.sections || [];
                    if (sections.length === 0) {
                      sectionItems.push({ fs, sectionId: '', sectionName: '' });
                    } else {
                      sections.forEach(sec => {
                        sectionItems.push({ fs, sectionId: sec.id, sectionName: sec.name });
                      });
                    }
                  });

                  return sectionItems.map(item => {
                    const { fs, sectionId, sectionName } = item;
                    const sectionStudents = students.filter(s => s.classId === fs.classId && (sectionId ? s.sectionId === sectionId : true));
                    const n = sectionStudents.length;
                    const activeMonths = fs.busMonths || ACADEMIC_MONTHS;
                    const busExpected = fs.includeBusFee ? sectionStudents.reduce((sum, s) => {
                      if ((s as any).transportType === 'bus') {
                        const route = busRoutes.find(r => r.id === (s as any).routeId);
                        return sum + ((route?.fee || 0) * activeMonths.length);
                      }
                      return sum;
                    }, 0) : 0;
                    // Sum per-student — respects scholarship overrides.
                    const sectionBase = sectionStudents.reduce((sum, s) => sum + effectiveClassFee(fs, s), 0);
                    const classExpected = sectionBase + busExpected;
                    const classCollected = payments.filter(p => p.classId === fs.classId && (sectionId ? p.sectionId === sectionId : true)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                    const classPending = classExpected - classCollected;
                    const pct = classExpected > 0 ? Math.min(100, (classCollected / classExpected) * 100) : 0;
                    
                    return (
                      <div key={`${fs.id}-${sectionId}`} onClick={() => { setViewingClassId(fs.classId); setViewingSectionId(sectionId); }}
                        style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-5)', cursor: 'pointer', transition: 'all 200ms' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-500)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none'; }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                          <div>
                            <div style={{ font: 'var(--text-body)', fontWeight: 700, fontSize: '1.05rem' }}>{fs.className}{sectionName ? ` — ${sectionName}` : ''}</div>
                            <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>{n} students • ₹{fs.totalAmount.toLocaleString()}/student</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: classPending > 0 ? '#DC2626' : '#059669', fontSize: '0.9rem' }}>{classPending > 0 ? `₹${classPending.toLocaleString()} pending` : '✓ Fully Paid'}</div>
                          </div>
                        </div>
                        {/* Progress */}
                        <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#E5E7EB', marginBottom: 'var(--space-4)' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: pct >= 100 ? '#059669' : (pct > 0 ? '#F59E0B' : '#3B82F6'), transition: 'width 300ms' }} />
                        </div>
                        {/* Term grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 'var(--space-3)' }}>
                          {fs.terms?.map(t => (
                            <div key={t.name} style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)' }}>
                              <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{t.name}</div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>₹{(t.amount * n).toLocaleString()}</div>
                            </div>
                          ))}
                          {fs.extracurricular > 0 && (
                            <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: '#F5F3FF', borderRadius: 'var(--radius-sm)' }}>
                              <div className="text-caption" style={{ color: '#7C3AED' }}>Extra</div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#7C3AED' }}>₹{(fs.extracurricular * n).toLocaleString()}</div>
                            </div>
                          )}
                          {fs.additionalFees?.map(a => (
                            <div key={a.name} style={{ textAlign: 'center', padding: 'var(--space-2)', background: '#FFFBEB', borderRadius: 'var(--radius-sm)' }}>
                              <div className="text-caption" style={{ color: '#D97706' }}>{a.name}</div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#D97706' }}>₹{(a.amount * n).toLocaleString()}</div>
                            </div>
                          ))}
                          {busExpected > 0 && (
                            <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: '#F0F9FF', borderRadius: 'var(--radius-sm)' }}>
                              <div className="text-caption" style={{ color: '#0369A1' }}>Bus</div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0369A1' }}>₹{busExpected.toLocaleString()}</div>
                            </div>
                          )}
                        </div>
                        {/* Collected row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-divider)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Collected</span>
                            <span style={{ fontWeight: 700, color: '#059669' }}>₹{classCollected.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>{classPending > 0 ? 'Pending' : 'Status'}</span>
                            <span style={{ fontWeight: 700, color: classPending > 0 ? '#DC2626' : '#059669' }}>{classPending > 0 ? `₹${classPending.toLocaleString()}` : '✓ Fully Paid'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </>
        );
      })()}

      {/* ═══ CLASS DRILL-DOWN VIEW ═══ */}
      {viewingClassId && (() => {
        const fs = feeStructures.find(f => f.classId === viewingClassId);
        if (!fs) return null;
        const cls = classes.find(c => c.id === viewingClassId);
        const section = cls?.sections.find(s => s.id === viewingSectionId);
        const classStudents = students.filter(s => s.classId === viewingClassId && (viewingSectionId ? s.sectionId === viewingSectionId : true));
        const filteredStudents = classStudents.filter(s => 
          s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
          s.admissionNumber?.toLowerCase().includes(studentSearch.toLowerCase())
        );

        return (
          <div style={{ background: 'var(--color-surface)', minHeight: '80vh', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', border: '1px solid var(--color-border)', borderBottom: 'none', padding: 'var(--space-6)', marginTop: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <button onClick={() => { setViewingClassId(null); setViewingSectionId(null); setStudentSearch(''); }}
                style={{ padding: 'var(--space-2)', background: 'var(--color-surface-variant)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
              </button>
              <div style={{ flex: 1 }}>
                <h2 className="text-h2" style={{ margin: 0 }}>{fs.className}{section ? ` — ${section.name}` : ''} — Student Fee Status</h2>
                <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>{classStudents.length} Students • Structure: ₹{fs.totalAmount.toLocaleString()}</p>
              </div>
              <div style={{ position: 'relative', width: 250 }}>
                <input 
                  type="text" placeholder="Search student..." value={studentSearch} 
                  onChange={e => setStudentSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 16px', paddingLeft: 40, borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', fontSize: '0.9rem', outline: 'none' }}
                />
                <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-3)' }}>
              {filteredStudents.length === 0 ? (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>No students found matching your search.</div>
              ) : filteredStudents.map(st => {
                const studentPayments = payments.filter(p => p.studentId === st.id);
                const paid = studentPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                const activeMonths = fs.busMonths || ACADEMIC_MONTHS;
                const busFee = (fs.includeBusFee && (st as any).transportType === 'bus')
                  ? (() => { const route = busRoutes.find(r => r.id === (st as any).routeId); return (route?.fee || 0) * activeMonths.length; })()
                  : 0;
                const classFee = effectiveClassFee(fs, st);
                const studentTotal = classFee + busFee;
                const pending = studentTotal - paid;
                const fullyPaid = pending <= 0 && studentTotal > 0;
                const isAdjusted = !!(st.feeAdjustment && typeof st.feeAdjustment.amount === 'number');
                const scholarship = !isAdjusted && st.scholarshipId
                  ? (school.settings?.scholarships || []).find(x => x.id === st.scholarshipId && x.active)
                  : null;
                const scholarshipApplied = !!(scholarship && typeof scholarship.amountsByClass?.[st.classId] === 'number');
                const badgeLabel = isAdjusted
                  ? (st.feeAdjustment?.reason || 'Adjusted')
                  : (scholarshipApplied ? (scholarship!.name || 'Scholarship') : '');
                const showBadge = isAdjusted || scholarshipApplied;

                return (
                  <div key={st.id} onClick={() => {
                    setPaymentForm(p => ({ ...p, studentId: st.id, classId: st.classId, category: '', amount: '' }));
                    setShowPaymentModal(true);
                  }}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', 
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', 
                      cursor: 'pointer', transition: 'all 200ms' 
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-300)'; e.currentTarget.style.background = 'var(--color-surface-variant)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-surface)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <Avatar name={st.name} size={40} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ font: 'var(--text-body)', fontWeight: 600 }}>{st.name}</span>
                          {showBadge && (
                            <span
                              title={isAdjusted ? (st.feeAdjustment?.reason || 'Custom fee amount') : `${scholarship?.name} scholarship`}
                              style={{
                                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                background: isAdjusted ? '#FEF3C7' : '#DBEAFE',
                                color: isAdjusted ? '#B45309' : '#1D4ED8',
                                fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                              }}
                            >
                              {badgeLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                          Adm: {st.admissionNumber || 'N/A'} • Sec: {st.sectionName}
                          {showBadge && ` • Fee ₹${classFee.toLocaleString()} (was ₹${fs.totalAmount.toLocaleString()})`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Collected</div>
                        <div style={{ fontWeight: 700, color: '#059669' }}>₹{paid.toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 100 }}>
                        <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Pending</div>
                        <div style={{ fontWeight: 700, color: fullyPaid ? '#059669' : '#DC2626' }}>
                          {fullyPaid ? '✓ PAID' : `₹${pending.toLocaleString()}`}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFeeEditStudent(st);
                          setFeeEditForm({
                            amount: String(classFee),
                            reason: st.feeAdjustment?.reason || '',
                          });
                        }}
                        title="Adjust this student's fee (scholarship, etc.)"
                        style={{
                          padding: 8, background: 'none',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--color-primary-500)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                        }}
                      >
                        <EditIcon size={16} />
                      </button>
                      <div style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-500)', color: 'white', fontSize: '0.85rem', fontWeight: 600 }}>
                        Pay
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ═══ FEE STRUCTURES (structures subPage — no tabs) ═══ */}
      {effectiveView === 'structures' && (
        <div>
          {feeStructures.length === 0 ? (
            <div style={{ textAlign:'center',padding:'var(--space-8)',background:'var(--color-surface)',borderRadius:'var(--radius-lg)',border:'1px solid var(--color-border)' }}>
              <p className="text-body" style={{ fontWeight:500 }}>No fee structures defined</p>
              <p className="text-body-sm" style={{ color:'var(--color-text-tertiary)' }}>Click &quot;Fee Structure&quot; to set up class-wise term fees.</p>
            </div>
          ) : (
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:'var(--space-4)' }}>
              {feeStructures.map(fs => {
                const terms = fs.terms || [];
                return (
                  <div key={fs.id} style={{ background:'var(--color-surface)',borderRadius:'var(--radius-lg)',border:'1px solid var(--color-border)',overflow:'hidden',boxShadow:'var(--shadow-sm)' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'var(--space-4)',background:'var(--color-surface-variant)',borderBottom:'1px solid var(--color-border)' }}>
                      <div><h3 className="text-h3" style={{ margin:0 }}>{fs.className}</h3><span className="text-caption" style={{ color:'var(--color-text-tertiary)' }}>{fs.academicYear}</span></div>
                      <div style={{ display:'flex',gap:'var(--space-1)' }}>
                        <button onClick={() => openEditStructure(fs)} style={{ padding:6,background:'none',border:'1px solid var(--color-border)',borderRadius:'var(--radius-sm)',cursor:'pointer',color:'var(--color-primary-500)',display:'flex' }}><EditIcon size={14} /></button>
                        <button onClick={() => handleDeleteStructure(fs.id)} style={{ padding:6,background:'none',border:'1px solid var(--color-border)',borderRadius:'var(--radius-sm)',cursor:'pointer',color:'var(--color-error)',display:'flex' }}><TrashIcon size={14} /></button>
                      </div>
                    </div>
                    <div style={{ padding:'var(--space-3) var(--space-4)' }}>
                      {terms.map((t, i) => (<div key={i} style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--color-divider)' }}><span className="text-body-sm" style={{ fontWeight:500 }}>{t.name}</span><span className="text-body-sm" style={{ fontWeight:600 }}>₹{t.amount.toLocaleString()}</span></div>))}
                      {fs.extracurricular > 0 && (<div style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--color-divider)' }}><span className="text-body-sm" style={{ fontWeight:500,color:'#7C3AED' }}>Extracurricular</span><span className="text-body-sm" style={{ fontWeight:600,color:'#7C3AED' }}>₹{fs.extracurricular.toLocaleString()}</span></div>)}
                      {fs.busFee > 0 && (<div style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--color-divider)' }}><span className="text-body-sm" style={{ fontWeight:500,color:'#0EA5E9' }}>Standard Bus Fee</span><span className="text-body-sm" style={{ fontWeight:600,color:'#0EA5E9' }}>₹{fs.busFee.toLocaleString()}</span></div>)}
                      {(fs.additionalFees || []).map((a, i) => (<div key={i} style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--color-divider)' }}><span className="text-body-sm" style={{ fontWeight:500,color:'#D97706' }}>{a.name}</span><span className="text-body-sm" style={{ fontWeight:600,color:'#D97706' }}>₹{a.amount.toLocaleString()}</span></div>))}
                      <div style={{ display:'flex',justifyContent:'space-between',padding:'8px 0',marginTop:4 }}><span className="text-body" style={{ fontWeight:700 }}>Total</span><span className="text-body" style={{ fontWeight:700,color:'#059669' }}>₹{fs.totalAmount.toLocaleString()}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ PAYMENTS (payments subPage — no tabs) ═══ */}
      {effectiveView === 'payments' && (() => {
        const staffCollections = payments.reduce((acc, p) => {
          const staffId = p.collectedBy || 'Admin';
          if (!acc[staffId]) {
            acc[staffId] = {
              id: staffId,
              name: p.collectedByName || 'Admin',
              total: 0,
              payments: []
            };
          }
          acc[staffId].total += Number(p.amount) || 0;
          acc[staffId].payments.push(p);
          return acc;
        }, {} as Record<string, { id: string; name: string; total: number; payments: FeePayment[] }>);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* Staff Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              {Object.values(staffCollections).map(staff => (
                <div key={staff.id} 
                  onClick={() => setSelectedStaffId(selectedStaffId === staff.id ? null : staff.id)}
                  style={{ 
                    background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', 
                    border: `2px solid ${selectedStaffId === staff.id ? 'var(--color-primary-500)' : 'var(--color-border)'}`, 
                    cursor: 'pointer', transition: 'all 200ms', boxShadow: 'var(--shadow-sm)'
                  }}
                  onMouseEnter={e => { if (selectedStaffId !== staff.id) e.currentTarget.style.borderColor = 'var(--color-primary-200)'; }}
                  onMouseLeave={e => { if (selectedStaffId !== staff.id) e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <Avatar name={staff.name} size={44} />
                    <div>
                      <div style={{ font: 'var(--text-body)', fontWeight: 600 }}>{staff.name}</div>
                      <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{staff.payments.length} collections</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Total Collected</span>
                    <span style={{ fontWeight: 700, color: '#059669', fontSize: '1.1rem' }}>₹{staff.total.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Transactions List */}
            <div style={{ background:'var(--color-surface)',borderRadius:'var(--radius-lg)',boxShadow:'var(--shadow-sm)',overflow:'hidden',border:'1px solid var(--color-border)' }}>
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-overline" style={{ color: 'var(--color-text-tertiary)' }}>{selectedStaffId ? `Detailed Records — ${staffCollections[selectedStaffId]?.name}` : 'All Recent Collections'}</span>
                {selectedStaffId && <button onClick={() => setSelectedStaffId(null)} style={{ background: 'var(--color-primary-50)', border: '1px solid var(--color-primary-200)', color: 'var(--color-primary-600)', padding: '2px 10px', borderRadius: 'var(--radius-sm)', font: 'var(--text-caption)', fontWeight: 600, cursor: 'pointer' }}>Show All</button>}
              </div>
              {(() => {
                const displayPayments = selectedStaffId 
                  ? payments.filter(p => (p.collectedBy || 'Admin') === selectedStaffId)
                  : payments;
                
                return displayPayments.length === 0 ? (
                  <div style={{ padding:'var(--space-8)',textAlign:'center' }}><p className="text-body-sm" style={{ color:'var(--color-text-tertiary)' }}>No collections recorded yet.</p></div>
                ) : displayPayments.map(p => (
                  <div key={p.id} style={{ display:'flex',alignItems:'center',gap:'var(--space-3)',padding:'var(--space-3) var(--space-4)',borderBottom:'1px solid var(--color-divider)',transition:'background 100ms' }}
                    onMouseEnter={e => (e.currentTarget.style.background='var(--color-surface-variant)')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    <Avatar name={p.studentName} size={32} />
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ font:'var(--text-body)',fontWeight:500 }}>{p.studentName}</div>
                      <div className="text-caption" style={{ color:'var(--color-text-tertiary)' }}>{p.className} • {p.category} • {p.mode?.toUpperCase()}{p.collectedByName && ` • by ${p.collectedByName}`}</div>
                    </div>
                    <div style={{ textAlign:'right',flexShrink:0 }}>
                      <div style={{ font:'var(--text-body)',fontWeight:600,color:'var(--color-success)' }}>₹{Number(p.amount).toLocaleString()}</div>
                      <div className="text-caption" style={{ color:'var(--color-text-tertiary)' }}>{p.receiptNumber}{p.paidAt && ` • ${new Date(p.paidAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}`}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        );
      })()}

      {/* ═══ ADD/EDIT FEE STRUCTURE MODAL ═══ */}
      <Modal isOpen={showStructureModal} onClose={() => setShowStructureModal(false)} title={editingStructure ? 'Edit Fee Structure' : 'Add Fee Structure'} size="xl">
        <div style={{ display:'flex',flexDirection:'column',gap:'var(--space-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
            {/* Left Column: Base Fees */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Select label="Class" options={[{ value:'',label:'Select Class' },...classes.map(c => ({ value:c.id,label:c.name }))]}
                value={structureForm.classId} onChange={e => setStructureForm(p => ({...p,classId:e.target.value}))} />

              <div style={{ padding:'var(--space-3) var(--space-4)',background:'#F0F9FF',border:'1px solid #BAE6FD',borderRadius:'var(--radius-md)' }}>
                <span className="text-caption" style={{ color:'#0369A1',fontWeight:600 }}>Academic Fees (per year)</span>
              </div>

              <div className="grid-3" style={{ gap:'var(--space-3)' }}>
                <Input label="Term 1 (₹)" type="number" placeholder="5000" value={structureForm.term1} onChange={e => setStructureForm(p => ({...p,term1:e.target.value}))} />
                <Input label="Term 2 (₹)" type="number" placeholder="4500" value={structureForm.term2} onChange={e => setStructureForm(p => ({...p,term2:e.target.value}))} />
                <Input label="Term 3 (₹)" type="number" placeholder="4500" value={structureForm.term3} onChange={e => setStructureForm(p => ({...p,term3:e.target.value}))} />
              </div>

              <Input label="Extracurricular Fee (₹)" type="number" placeholder="2000" value={structureForm.extracurricular} onChange={e => setStructureForm(p => ({...p,extracurricular:e.target.value}))} />

              {/* Additional Fees */}
              <div style={{ marginTop: 'var(--space-2)' }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'var(--space-2)' }}>
                  <span className="text-body-sm" style={{ fontWeight:600 }}>Additional Fees</span>
                  <button onClick={addAdditionalFee} style={{ padding:'4px 12px',borderRadius:'var(--radius-sm)',border:'1px solid var(--color-primary-500)',background:'var(--color-primary-50)',color:'var(--color-primary-500)',cursor:'pointer',font:'var(--text-caption)',fontWeight:600 }}>+ Add</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {structureForm.additionalFees.map((af, i) => (
                    <div key={i} style={{ display:'flex',gap:'var(--space-2)',alignItems:'flex-end' }}>
                      <div style={{ flex:1 }}><Input label={i===0?'Name':''} placeholder="e.g. Diary" value={af.name} onChange={e => { const arr=[...structureForm.additionalFees]; arr[i].name=e.target.value; setStructureForm(p=>({...p,additionalFees:arr})); }} /></div>
                      <div style={{ flex:1 }}><Input label={i===0?'Amount (₹)':''} type="number" placeholder="200" value={af.amount} onChange={e => { const arr=[...structureForm.additionalFees]; arr[i].amount=e.target.value; setStructureForm(p=>({...p,additionalFees:arr})); }} /></div>
                      <button onClick={() => removeAdditionalFee(i)} style={{ padding:8,background:'none',border:'1px solid var(--color-border)',borderRadius:'var(--radius-sm)',cursor:'pointer',color:'var(--color-error)',display:'flex',marginBottom:2 }}><TrashIcon size={14} /></button>
                    </div>
                  ))}
                  {structureForm.additionalFees.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-4)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>
                      No additional fees added
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Bus Fees */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-4)', background: structureForm.includeBusFee ? '#F0FDF4' : 'var(--color-surface-variant)', border: `1.5px solid ${structureForm.includeBusFee ? '#86EFAC' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', transition: 'all 0.2s' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>Include Bus Fee</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      {structureForm.includeBusFee
                        ? 'Fees will be auto-fetched from student routes'
                        : 'Enable to apply route-based bus fees'}
                    </div>
                  </div>
                  <div
                    onClick={() => setStructureForm(p => ({ ...p, includeBusFee: !p.includeBusFee }))}
                    style={{
                      width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                      background: structureForm.includeBusFee ? '#10B981' : '#D1D5DB',
                      position: 'relative', transition: 'background 0.2s', cursor: 'pointer'
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, left: structureForm.includeBusFee ? 22 : 3,
                      width: 18, height: 18, borderRadius: '50%', background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s'
                    }} />
                  </div>
                </label>
              </div>

              {structureForm.includeBusFee ? (
                <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                  <div style={{ padding: 'var(--space-3)', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-4)' }}>
                    <span style={{ fontSize: '0.78rem', color: '#1D4ED8', fontWeight: 500 }}>ℹ️ Individual student route fees are applied automatically based on their assignment.</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                    <label className="text-caption" style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>ACTIVE BUS MONTHS</label>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        type="button"
                        onClick={() => setStructureForm(p => ({ ...p, busMonths: [...ACADEMIC_MONTHS] }))}
                        style={{ padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                      >Select all</button>
                      <button
                        type="button"
                        onClick={() => setStructureForm(p => ({ ...p, busMonths: [] }))}
                        style={{ padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                      >Clear</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {ACADEMIC_MONTHS.map(month => (
                      <label key={month} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--color-surface-variant)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary-300)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}>
                        <input 
                          type="checkbox" 
                          checked={structureForm.busMonths.includes(month)}
                          onChange={e => {
                            const next = e.target.checked 
                              ? [...structureForm.busMonths, month]
                              : structureForm.busMonths.filter(m => m !== month);
                            setStructureForm(p => ({ ...p, busMonths: next }));
                          }}
                        />
                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{month}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center', background: 'var(--color-surface-variant)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ opacity: 0.5, marginBottom: 'var(--space-2)' }}>🚌</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>Toggle to configure bus fee schedule for this class</div>
                </div>
              )}
            </div>
          </div>

          {/* Total preview */}
          <div style={{ padding:'var(--space-3) var(--space-4)',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:'var(--radius-md)',display:'flex',justifyContent:'space-between' }}>
            <span className="text-body" style={{ fontWeight:600 }}>Total</span>
            <span className="text-body" style={{ fontWeight:700,color:'#059669' }}>
              ₹{((parseFloat(structureForm.term1)||0)+(parseFloat(structureForm.term2)||0)+(parseFloat(structureForm.term3)||0)+(parseFloat(structureForm.extracurricular)||0)+structureForm.additionalFees.reduce((s,a)=>s+(parseFloat(a.amount)||0),0)).toLocaleString()}
            </span>
          </div>

          <div style={{ display:'flex',gap:'var(--space-3)',justifyContent:'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowStructureModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveStructure}>{editingStructure ? 'Update' : 'Create'}</Button>
          </div>
        </div>
      </Modal>

      {/* ═══ RECORD PAYMENT MODAL ═══ */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment" size="md">
        <div style={{ display:'flex',flexDirection:'column',gap:'var(--space-4)' }}>
          <Select label="Class" options={[{ value:'',label:'All Classes' },...classes.map(c => ({ value:c.id,label:c.name }))]}
            value={paymentForm.classId} onChange={e => setPaymentForm(p => ({...p,classId:e.target.value,studentId:'',category:'',amount:''}))} />

          <SearchableSelect label="Student" placeholder="Search student by name..." options={filteredStudents.map(s => ({ value:s.id,label:`${s.name}${s.admissionNumber?' ('+s.admissionNumber+')':''}` }))}
            value={paymentForm.studentId} onChange={val => {
              const st = students.find(s => s.id === val);
              setPaymentForm(p => ({...p, studentId: val, classId: st?.classId || p.classId, category: '', amount: '' }));
            }} />

          {/* Fee Status Summary */}
          {paymentForm.studentId && paymentStructure && (() => {
            const categoryPaid = getCategoryPaidMap(paymentForm.studentId);
            return (
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div className="text-caption" style={{ fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>FEE STATUS</div>
                
                {paymentStructure.terms?.map(t => {
                  const totalPaid = categoryPaid[t.name] || 0;
                  const isFullyPaid = totalPaid >= t.amount;
                  const isPartiallyPaid = totalPaid > 0 && totalPaid < t.amount;
                  const status = isFullyPaid ? 'PAID' : isPartiallyPaid ? 'PARTIAL' : 'PENDING';
                  const color = isFullyPaid ? '#059669' : isPartiallyPaid ? '#D97706' : '#DC2626';
                  const bg = isFullyPaid ? '#ECFDF5' : isPartiallyPaid ? '#FFFBEB' : '#FEF2F2';
                  const border = isFullyPaid ? '#A7F3D0' : isPartiallyPaid ? '#FDE68A' : '#FECACA';

                  return (
                    <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-divider)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="text-body-sm" style={{ fontWeight: 600 }}>{t.name}</span>
                        {isPartiallyPaid ? (
                          <span className="text-caption" style={{ color: '#D97706', fontSize: '0.7rem' }}>Paid: ₹{totalPaid.toLocaleString()} • Bal: ₹{(t.amount - totalPaid).toLocaleString()}</span>
                        ) : (
                          <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontSize: '0.7rem' }}>{isFullyPaid ? 'Fully Paid' : 'No payments yet'}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <span className="text-body-sm" style={{ fontWeight: 600 }}>₹{t.amount.toLocaleString()}</span>
                        <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, background: bg, color: color, border: `1px solid ${border}` }}>{status === 'PAID' ? '✓ PAID' : status}</span>
                      </div>
                    </div>
                  );
                })}

                {paymentStructure.extracurricular > 0 && (() => { 
                  const totalPaid = categoryPaid['Extracurricular'] || 0;
                  const isFullyPaid = totalPaid >= paymentStructure.extracurricular;
                  const isPartiallyPaid = totalPaid > 0 && totalPaid < paymentStructure.extracurricular;
                  const status = isFullyPaid ? 'PAID' : isPartiallyPaid ? 'PARTIAL' : 'PENDING';
                  const color = isFullyPaid ? '#059669' : isPartiallyPaid ? '#D97706' : '#DC2626';
                  const bg = isFullyPaid ? '#ECFDF5' : isPartiallyPaid ? '#FFFBEB' : '#FEF2F2';
                  const border = isFullyPaid ? '#A7F3D0' : isPartiallyPaid ? '#FDE68A' : '#FECACA';

                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-divider)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="text-body-sm" style={{ fontWeight: 600, color: '#7C3AED' }}>Extracurricular</span>
                        {isPartiallyPaid ? (
                          <span className="text-caption" style={{ color: '#D97706', fontSize: '0.7rem' }}>Paid: ₹{totalPaid.toLocaleString()} • Bal: ₹{(paymentStructure.extracurricular - totalPaid).toLocaleString()}</span>
                        ) : (
                          <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontSize: '0.7rem' }}>{isFullyPaid ? 'Fully Paid' : 'No payments yet'}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <span className="text-body-sm" style={{ fontWeight: 600, color: '#7C3AED' }}>₹{paymentStructure.extracurricular.toLocaleString()}</span>
                        <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, background: bg, color: color, border: `1px solid ${border}` }}>{status === 'PAID' ? '✓ PAID' : status}</span>
                      </div>
                    </div>
                  ); 
                })()}

                {paymentStructure.additionalFees?.map(a => { 
                  const totalPaid = categoryPaid[a.name] || 0;
                  const isFullyPaid = totalPaid >= a.amount;
                  const isPartiallyPaid = totalPaid > 0 && totalPaid < a.amount;
                  const status = isFullyPaid ? 'PAID' : isPartiallyPaid ? 'PARTIAL' : 'PENDING';
                  const color = isFullyPaid ? '#059669' : isPartiallyPaid ? '#D97706' : '#DC2626';
                  const bg = isFullyPaid ? '#ECFDF5' : isPartiallyPaid ? '#FFFBEB' : '#FEF2F2';
                  const border = isFullyPaid ? '#A7F3D0' : isPartiallyPaid ? '#FDE68A' : '#FECACA';

                  return (
                    <div key={a.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-divider)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="text-body-sm" style={{ fontWeight: 600, color: '#D97706' }}>{a.name}</span>
                        {isPartiallyPaid ? (
                          <span className="text-caption" style={{ color: '#D97706', fontSize: '0.7rem' }}>Paid: ₹{totalPaid.toLocaleString()} • Bal: ₹{(a.amount - totalPaid).toLocaleString()}</span>
                        ) : (
                          <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontSize: '0.7rem' }}>{isFullyPaid ? 'Fully Paid' : 'No payments yet'}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <span className="text-body-sm" style={{ fontWeight: 600, color: '#D97706' }}>₹{a.amount.toLocaleString()}</span>
                        <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, background: bg, color: color, border: `1px solid ${border}` }}>{status === 'PAID' ? '✓ PAID' : status}</span>
                      </div>
                    </div>
                  ); 
                })}

                {paymentForm.studentId && (() => {
                  const student = students.find(s => s.id === paymentForm.studentId);
                  if ((student as any)?.transportType !== 'bus' || !paymentStructure.includeBusFee) return null;
                  
                  const route = busRoutes.find(r => r.id === (student as any)?.routeId);
                  const busFee = route?.fee || 0;
                  const activeMonths = paymentStructure.busMonths || ACADEMIC_MONTHS;
                  if (busFee <= 0) return null;

                  return (
                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: '#F0F9FF', borderRadius: 'var(--radius-md)', border: '1px solid #BAE6FD' }}>
                      <p className="text-caption" style={{ fontWeight: 600, color: '#0369A1', marginBottom: 'var(--space-2)' }}>MONTHLY BUS FEE STATUS</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                        {activeMonths.map(month => {
                          const cat = `Bus Fee - ${month}`;
                          const totalPaid = categoryPaid[cat] || 0;
                          const isFullyPaid = totalPaid >= busFee;
                          
                          return (
                            <div key={month} style={{ 
                              padding: '6px 10px', 
                              borderRadius: 'var(--radius-sm)', 
                              background: isFullyPaid ? '#ECFDF5' : '#FFFBEB',
                              border: `1px solid ${isFullyPaid ? '#A7F3D0' : '#FDE68A'}`,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isFullyPaid ? '#065F46' : '#92400E' }}>{month}</span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isFullyPaid ? '#059669' : '#D97706' }}>{isFullyPaid ? '✓' : `₹${(busFee - totalPaid)}`}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          <div className="grid-2">
            <Select label="Category" options={categoryOptions()}
              value={paymentForm.category} onChange={e => { setPaymentForm(p => ({...p,category:e.target.value})); autoFillAmount(e.target.value); }} />
            <Input label="Amount (₹)" type="number" required value={paymentForm.amount} onChange={e => setPaymentForm(p => ({...p,amount:e.target.value}))} />
          </div>
          <div className="grid-2">
            <Select label="Payment Mode" options={[{value:'cash',label:'Cash'},{value:'upi',label:'UPI'},{value:'cheque',label:'Cheque'},{value:'bank_transfer',label:'Bank Transfer'}]}
              value={paymentForm.mode} onChange={e => setPaymentForm(p => ({...p,mode:e.target.value}))} />
            <Input label="Reference Number" placeholder="Optional" value={paymentForm.referenceNumber} onChange={e => setPaymentForm(p => ({...p,referenceNumber:e.target.value}))} />
          </div>
          <div style={{ display:'flex',gap:'var(--space-3)',justifyContent:'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleRecordPayment}>Record Payment</Button>
          </div>
        </div>
      </Modal>

      {/* ═══ ADJUST FEE MODAL ═══ */}
      <Modal
        isOpen={!!feeEditStudent}
        onClose={() => setFeeEditStudent(null)}
        title={feeEditStudent ? `Adjust Fee — ${feeEditStudent.name}` : ''}
        size="md"
      >
        {feeEditStudent && (() => {
          const fs = feeStructures.find(s => s.classId === feeEditStudent.classId);
          const structureAmount = fs?.totalAmount ?? 0;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{
                padding: 'var(--space-3) var(--space-4)',
                background: '#F0F9FF', border: '1px solid #BAE6FD',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem', color: '#0369A1', lineHeight: 1.5,
              }}>
                Use this for scholarship students or any student whose class fee
                differs from the standard structure. Bus fees stay unchanged
                (they follow the assigned route).
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)',
              }}>
                <div style={{
                  padding: 'var(--space-3)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-variant)',
                }}>
                  <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginBottom: 2 }}>Class default</div>
                  <div style={{ fontWeight: 700 }}>₹{structureAmount.toLocaleString()}</div>
                </div>
                <div style={{
                  padding: 'var(--space-3)',
                  border: '1px solid var(--color-primary-300)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-primary-50)',
                }}>
                  <div className="text-caption" style={{ color: 'var(--color-primary-700)', marginBottom: 2 }}>This student pays</div>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary-700)' }}>
                    ₹{(Number(feeEditForm.amount) || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <Input
                label="Custom class fee (₹)"
                type="number"
                min={0}
                value={feeEditForm.amount}
                onChange={e => setFeeEditForm(p => ({ ...p, amount: e.target.value }))}
              />

              <Input
                label="Reason (optional)"
                placeholder="e.g. Scholarship, Sibling discount"
                value={feeEditForm.reason}
                onChange={e => setFeeEditForm(p => ({ ...p, reason: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  onClick={handleResetFeeAdjustment}
                  disabled={feeEditSaving || !feeEditStudent.feeAdjustment}
                >
                  Reset to default
                </Button>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button variant="secondary" onClick={() => setFeeEditStudent(null)} disabled={feeEditSaving}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleSaveFeeAdjustment} disabled={feeEditSaving}>
                    {feeEditSaving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
