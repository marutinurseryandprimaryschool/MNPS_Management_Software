'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { FeePaymentsService, FeeStructuresService, StudentsService, ClassesService, BusRoutesService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Select } from '@/components/ui/Input';
import Input from '@/components/ui/Input';
import Button, { FAB } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/SharedUI';
import { PlusIcon, CreditCardIcon } from '@/components/ui/Icons';
import type { Student, Class, FeePayment } from '@/types/models';

interface FeeStructureData {
  id: string; classId: string; terms: { name: string; amount: number }[];
  extracurricular: number; additionalFees: { name: string; amount: number }[];
  totalAmount: number; includeBusFee?: boolean; busMonths?: string[];
}
interface BusRoute { id: string; routeName: string; fee: number; }
const ACADEMIC_MONTHS = ['June','July','August','September','October','November','December','January','February','March'];

export default function TeacherFees() {
  const { user } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [allPayments, setAllPayments] = useState<FeePayment[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructureData[]>([]);
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation: null = cards, string = classId-sectionId detail
  const [activeView, setActiveView] = useState<string | null>(null);
  // Collecting for specific student
  const [collectingStudent, setCollectingStudent] = useState<Student | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [formData, setFormData] = useState({ amount: '', mode: 'cash', category: '', remarks: '' });

  const fetchData = useCallback(async () => {
    if (!school?.academicYear) return;
    try {
      const [s, c, p, fs, br] = await Promise.all([
        StudentsService.getAll(school.academicYear), 
        ClassesService.getAll(school.academicYear),
        FeePaymentsService.getAll(school.academicYear), 
        FeeStructuresService.getAll(school.academicYear),
        BusRoutesService.getAll(),
      ]);
      setStudents(s as unknown as Student[]);
      setClasses(c as unknown as Class[]);
      setAllPayments((p as unknown as FeePayment[]).sort((a, b) => {
        const dA = a.paidAt ? new Date(a.paidAt).getTime() : 0;
        const dB = b.paidAt ? new Date(b.paidAt).getTime() : 0;
        return dB - dA;
      }));
      setFeeStructures(fs as unknown as FeeStructureData[]);
      setBusRoutes(br as unknown as BusRoute[]);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build class-section list from classes
  const classSections: { key: string; classId: string; className: string; sectionId: string; sectionName: string }[] = [];
  classes.forEach(cls => {
    (cls.sections || []).forEach(sec => {
      classSections.push({ key: `${cls.id}-${sec.id}`, classId: cls.id, className: cls.name, sectionId: sec.id, sectionName: sec.name });
    });
    if (!cls.sections || cls.sections.length === 0) {
      classSections.push({ key: `${cls.id}-`, classId: cls.id, className: cls.name, sectionId: '', sectionName: '' });
    }
  });
  classSections.sort((a, b) => `${a.className}-${a.sectionName}`.localeCompare(`${b.className}-${b.sectionName}`));

  // Get student count and totals per class-section
  const getCSData = (key: string) => {
    const cs = classSections.find(c => c.key === key);
    if (!cs) return { students: 0, collected: 0 };
    const studs = students.filter(s => s.classId === cs.classId && (cs.sectionId ? s.sectionId === cs.sectionId : true));
    const collected = allPayments.filter(p => studs.some(s => s.id === p.studentId)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return { students: studs.length, collected };
  };

  // Active class-section data
  const activeCS = classSections.find(c => c.key === activeView);
  const activeStudents = activeCS ? students.filter(s => s.classId === activeCS.classId && (activeCS.sectionId ? s.sectionId === activeCS.sectionId : true)) : [];
  const activeFeeStructure = activeCS ? feeStructures.find(f => f.classId === activeCS.classId) : null;
  const totalForClass = activeFeeStructure?.totalAmount || 0;

  // Student fee helpers
  const getStudentPaid = (studentId: string) => allPayments.filter(p => p.studentId === studentId);
  const getStudentTotal = (studentId: string) => getStudentPaid(studentId).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  // Returns the actual total owed by a student including their specific bus route fee
  const getStudentActualTotal = (student: Student) => {
    const base = activeFeeStructure?.totalAmount || 0;
    if (activeFeeStructure?.includeBusFee && (student as any).transportType === 'bus') {
      const route = busRoutes.find(r => r.id === (student as any).routeId);
      const activeMonths = activeFeeStructure.busMonths || ACADEMIC_MONTHS;
      return base + (route?.fee || 0) * activeMonths.length;
    }
    return base;
  };
  const getCategoryPaidMap = (studentId: string) => {
    const map: Record<string, number> = {};
    getStudentPaid(studentId).forEach(p => {
      map[p.category] = (map[p.category] || 0) + (Number(p.amount) || 0);
    });
    return map;
  };

  // Collect fee
  const handleCollect = async () => {
    if (!collectingStudent || !formData.amount) { showToast('Enter amount'); return; }
    try {
      await FeePaymentsService.create({
        type: 'payment', studentId: collectingStudent.id, studentName: collectingStudent.name,
        classId: collectingStudent.classId, className: collectingStudent.className || '',
        sectionId: collectingStudent.sectionId || '', sectionName: collectingStudent.sectionName || '',
        amount: parseFloat(formData.amount), mode: formData.mode, category: formData.category,
        remarks: formData.remarks, receiptNumber: `RCP-${Date.now().toString(36).toUpperCase()}`,
        collectedBy: user?.id || user?.uid || '', collectedByName: user?.name || '',
        collectedByEmail: user?.email || '', paidAt: new Date(),
        academicYear: school.academicYear,
      });
      showToast(`₹${parseFloat(formData.amount).toLocaleString()} collected from ${collectingStudent.name}!`);
      setCollectingStudent(null);
      setFormData({ amount: '', mode: 'cash', category: '', remarks: '' });
      await fetchData();
    } catch (e) { console.error(e); showToast('Failed to record fee collection. Please try again.'); }
  };

  // Category options — exclude already-paid categories
  const getBusRoute = (student: Student | null) => {
    if (!student || (student as any).transportType !== 'bus') return null;
    return busRoutes.find(r => r.id === (student as any).routeId) || null;
  };

  const catOptions = () => {
    const opts = [{ value: '', label: 'Select Category' }];
    if (activeFeeStructure) {
      const categoryPaid = collectingStudent ? getCategoryPaidMap(collectingStudent.id) : {};
      
      activeFeeStructure.terms?.forEach(t => {
        const paid = categoryPaid[t.name] || 0;
        if (paid < t.amount) opts.push({ value: t.name, label: `${t.name} — ${paid > 0 ? `Bal: ₹${(t.amount - paid).toLocaleString()}` : `₹${t.amount.toLocaleString()}`}` });
      });
      
      if (activeFeeStructure.extracurricular) {
        const paid = categoryPaid['Extracurricular'] || 0;
        if (paid < activeFeeStructure.extracurricular) opts.push({ value: 'Extracurricular', label: `Extracurricular — ${paid > 0 ? `Bal: ₹${(activeFeeStructure.extracurricular - paid).toLocaleString()}` : `₹${activeFeeStructure.extracurricular.toLocaleString()}`}` });
      }
      
      activeFeeStructure.additionalFees?.forEach(a => {
        const paid = categoryPaid[a.name] || 0;
        if (paid < a.amount) opts.push({ value: a.name, label: `${a.name} — ${paid > 0 ? `Bal: ₹${(a.amount - paid).toLocaleString()}` : `₹${a.amount.toLocaleString()}`}` });
      });

      // Bus Fee monthly options — only for bus students when includeBusFee is enabled
      if (activeFeeStructure.includeBusFee && collectingStudent) {
        const route = getBusRoute(collectingStudent);
        if (route && route.fee > 0) {
          const activeMonths = activeFeeStructure.busMonths || ACADEMIC_MONTHS;
          activeMonths.forEach(month => {
            const cat = `Bus Fee - ${month}`;
            const paid = categoryPaid[cat] || 0;
            if (paid < route.fee) {
              opts.push({ value: cat, label: `${cat} — ${paid > 0 ? `Bal: ₹${(route.fee - paid).toLocaleString()}` : `₹${route.fee.toLocaleString()}`}` });
            }
          });
        }
      }
    }
    opts.push({ value: 'Other', label: 'Other' });
    return opts;
  };
  const autoFill = (cat: string) => {
    if (!activeFeeStructure || !collectingStudent) return;
    const categoryPaid = getCategoryPaidMap(collectingStudent.id);
    const alreadyPaid = categoryPaid[cat] || 0;

    const t = activeFeeStructure.terms?.find(x => x.name === cat);
    if (t) { setFormData(p => ({ ...p, category: cat, amount: String(Math.max(0, t.amount - alreadyPaid)) })); return; }
    
    if (cat === 'Extracurricular') { setFormData(p => ({ ...p, category: cat, amount: String(Math.max(0, activeFeeStructure.extracurricular - alreadyPaid)) })); return; }
    
    const a = activeFeeStructure.additionalFees?.find(x => x.name === cat);
    if (a) { setFormData(p => ({ ...p, category: cat, amount: String(Math.max(0, a.amount - alreadyPaid)) })); return; }

    if (cat.startsWith('Bus Fee -')) {
      const route = getBusRoute(collectingStudent);
      if (route) { setFormData(p => ({ ...p, category: cat, amount: String(Math.max(0, route.fee - alreadyPaid)) })); return; }
    }
    
    setFormData(p => ({ ...p, category: cat }));
  };

  // Stats
  const myCollections = allPayments.filter(p => p.collectedBy === user?.id || p.collectedBy === user?.uid);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayPayments = myCollections.filter(p => p.paidAt && new Date(p.paidAt).toISOString().split('T')[0] === todayStr);
  const todayTotal = todayPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const allTimeTotal = myCollections.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  if (loading) return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;

  // ═══════════════════════════════════════════════
  // VIEW 3: COLLECTING FROM A SPECIFIC STUDENT
  // ═══════════════════════════════════════════════
  if (collectingStudent && activeCS) {
    const categoryPaid = getCategoryPaidMap(collectingStudent.id);
    return (
      <div className="page-container">
        <button onClick={() => { setCollectingStudent(null); setFormData({ amount: '', mode: 'cash', category: '', remarks: '' }); }}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-500)', font: 'var(--text-body-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back to {activeCS.className}-{activeCS.sectionName}
        </button>

        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
          <h3 className="text-h2" style={{ marginBottom: 'var(--space-1)' }}>Collect Fee — {collectingStudent.name}</h3>
          <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>{collectingStudent.className}-{collectingStudent.sectionName} • {collectingStudent.admissionNumber}</p>

          {/* Fee status */}
          {activeFeeStructure && (
            <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
              <div className="text-caption" style={{ fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>FEE STATUS</div>
              {activeFeeStructure.terms?.map(t => {
                const totalPaid = categoryPaid[t.name] || 0;
                const isFullyPaid = totalPaid >= t.amount;
                const isPartiallyPaid = totalPaid > 0 && totalPaid < t.amount;
                const status = isFullyPaid ? 'PAID' : isPartiallyPaid ? 'PARTIAL' : 'PENDING';
                const color = isFullyPaid ? '#059669' : isPartiallyPaid ? '#D97706' : '#DC2626';
                const bg = isFullyPaid ? '#ECFDF5' : isPartiallyPaid ? '#FFFBEB' : '#FEF2F2';
                const border = isFullyPaid ? '#A7F3D0' : isPartiallyPaid ? '#FDE68A' : '#FECACA';

                return (<div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-body-sm" style={{ fontWeight: 500 }}>{t.name}</span>
                    {isPartiallyPaid && <span className="text-caption" style={{ color: '#D97706', fontSize: '0.65rem' }}>Paid: ₹{totalPaid.toLocaleString()} • Bal: ₹{(t.amount - totalPaid).toLocaleString()}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className="text-caption" style={{ fontWeight: 600 }}>₹{t.amount.toLocaleString()}</span>
                    <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, background: bg, color: color, border: `1px solid ${border}` }}>{status === 'PAID' ? '✓ PAID' : status === 'PARTIAL' ? 'PARTIAL' : 'PENDING'}</span>
                  </div>
                </div>);
              })}
              {activeFeeStructure.extracurricular > 0 && (() => { 
                const totalPaid = categoryPaid['Extracurricular'] || 0;
                const isFullyPaid = totalPaid >= activeFeeStructure.extracurricular;
                const isPartiallyPaid = totalPaid > 0 && totalPaid < activeFeeStructure.extracurricular;
                const status = isFullyPaid ? 'PAID' : isPartiallyPaid ? 'PARTIAL' : 'PENDING';
                const color = isFullyPaid ? '#059669' : isPartiallyPaid ? '#D97706' : '#DC2626';
                const bg = isFullyPaid ? '#ECFDF5' : isPartiallyPaid ? '#FFFBEB' : '#FEF2F2';
                const border = isFullyPaid ? '#A7F3D0' : isPartiallyPaid ? '#FDE68A' : '#FECACA';
                return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-body-sm" style={{ fontWeight: 500, color: '#7C3AED' }}>Extracurricular</span>
                    {isPartiallyPaid && <span className="text-caption" style={{ color: '#D97706', fontSize: '0.65rem' }}>Paid: ₹{totalPaid.toLocaleString()} • Bal: ₹{(activeFeeStructure.extracurricular - totalPaid).toLocaleString()}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className="text-caption" style={{ fontWeight: 600 }}>₹{activeFeeStructure.extracurricular.toLocaleString()}</span>
                    <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, background: bg, color: color, border: `1px solid ${border}` }}>{status === 'PAID' ? '✓ PAID' : status === 'PARTIAL' ? 'PARTIAL' : 'PENDING'}</span>
                  </div>
                </div>); })()}
              {activeFeeStructure.additionalFees?.map(a => { 
                const totalPaid = categoryPaid[a.name] || 0;
                const isFullyPaid = totalPaid >= a.amount;
                const isPartiallyPaid = totalPaid > 0 && totalPaid < a.amount;
                const status = isFullyPaid ? 'PAID' : isPartiallyPaid ? 'PARTIAL' : 'PENDING';
                const color = isFullyPaid ? '#059669' : isPartiallyPaid ? '#D97706' : '#DC2626';
                const bg = isFullyPaid ? '#ECFDF5' : isPartiallyPaid ? '#FFFBEB' : '#FEF2F2';
                const border = isFullyPaid ? '#A7F3D0' : isPartiallyPaid ? '#FDE68A' : '#FECACA';
                return (
                <div key={a.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-body-sm" style={{ fontWeight: 500, color: '#D97706' }}>{a.name}</span>
                    {isPartiallyPaid && <span className="text-caption" style={{ color: '#D97706', fontSize: '0.65rem' }}>Paid: ₹{totalPaid.toLocaleString()} • Bal: ₹{(a.amount - totalPaid).toLocaleString()}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className="text-caption" style={{ fontWeight: 600 }}>₹{a.amount.toLocaleString()}</span>
                    <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, background: bg, color: color, border: `1px solid ${border}` }}>{status === 'PAID' ? '✓ PAID' : status === 'PARTIAL' ? 'PARTIAL' : 'PENDING'}</span>
                  </div>
                </div>); })}

              {/* Bus Fee monthly rows */}
              {activeFeeStructure.includeBusFee && (() => {
                const route = getBusRoute(collectingStudent);
                if (!route || route.fee <= 0) return null;
                const activeMonths = activeFeeStructure.busMonths || ACADEMIC_MONTHS;
                return (
                  <>
                    <div style={{ borderTop: '1px dashed #E5E7EB', marginTop: 6, paddingTop: 6 }}>
                      <div className="text-caption" style={{ fontWeight: 700, color: '#0369A1', marginBottom: 4 }}>BUS FEE — {route.routeName} (₹{route.fee}/month)</div>
                      {activeMonths.map(month => {
                        const cat = `Bus Fee - ${month}`;
                        const totalPaid = categoryPaid[cat] || 0;
                        const isFullyPaid = totalPaid >= route.fee;
                        const isPartiallyPaid = totalPaid > 0 && totalPaid < route.fee;
                        const color = isFullyPaid ? '#059669' : isPartiallyPaid ? '#D97706' : '#DC2626';
                        const bg = isFullyPaid ? '#ECFDF5' : isPartiallyPaid ? '#FFFBEB' : '#FEF2F2';
                        const border = isFullyPaid ? '#A7F3D0' : isPartiallyPaid ? '#FDE68A' : '#FECACA';
                        return (
                          <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                            <span className="text-body-sm" style={{ fontWeight: 500, color: '#0369A1' }}>{month}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <span className="text-caption" style={{ fontWeight: 600 }}>₹{route.fee.toLocaleString()}</span>
                              <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, background: bg, color, border: `1px solid ${border}` }}>
                                {isFullyPaid ? '✓ PAID' : isPartiallyPaid ? `Bal: ₹${route.fee - totalPaid}` : 'PENDING'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Select label="Category to Pay" options={catOptions()} value={formData.category}
              onChange={e => { autoFill(e.target.value); }} />
            <div className="grid-2" style={{ gap: 'var(--space-3)' }}>
              <Input label="Amount (₹)" type="number" value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))} />
              <Select label="Payment Mode" options={[{ value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'cheque', label: 'Cheque' }, { value: 'bank_transfer', label: 'Bank Transfer' }]}
                value={formData.mode} onChange={e => setFormData(p => ({ ...p, mode: e.target.value }))} />
            </div>
            <Input label="Remarks (optional)" value={formData.remarks} onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))} />
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => { setCollectingStudent(null); setFormData({ amount: '', mode: 'cash', category: '', remarks: '' }); }}>Cancel</Button>
              <Button variant="primary" onClick={handleCollect} disabled={!formData.amount || !formData.category}>
                Collect ₹{formData.amount ? parseFloat(formData.amount).toLocaleString() : '0'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // VIEW 2: STUDENTS LIST INSIDE A CLASS-SECTION
  // ═══════════════════════════════════════════════
  if (activeView && activeCS) {
    return (
      <div className="page-container">
        <button onClick={() => { setActiveView(null); setStudentSearch(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-500)', font: 'var(--text-body-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back to All Classes
        </button>

        {(() => {
          const n = activeStudents.length;
          // Sum actual totals per student (base + bus fee where applicable)
          const totalAll = activeStudents.reduce((sum, st) => sum + getStudentActualTotal(st), 0);
          const totalCollected = activeStudents.reduce((s, st) => s + getStudentTotal(st.id), 0);
          return (
            <div style={{ background: 'linear-gradient(135deg, #1E40AF, #3B82F6)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', color: 'white', marginBottom: 'var(--space-4)' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-3)' }}>{activeCS.className}{activeCS.sectionName ? `-${activeCS.sectionName}` : ''}</div>
              {/* Row 1: Students, Total Fee, Collected */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                <div><div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Students</div><div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{n}</div></div>
                <div><div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Amount</div><div style={{ fontSize: '1.3rem', fontWeight: 700 }}>₹{totalAll.toLocaleString()}</div></div>
                <div><div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Collected</div><div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#86EFAC' }}>₹{totalCollected.toLocaleString()}</div></div>
                <div><div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending</div><div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FCA5A5' }}>₹{(totalAll - totalCollected).toLocaleString()}</div></div>
              </div>
              {/* Row 2: Term-wise breakdown */}
              {activeFeeStructure && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 'var(--space-3)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3) var(--space-5)' }}>
                  {activeFeeStructure.terms?.map(t => (
                    <div key={t.name}><div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{t.name}</div><div style={{ fontSize: '1rem', fontWeight: 600 }}>₹{(t.amount * n).toLocaleString()}</div></div>
                  ))}
                  {activeFeeStructure.extracurricular > 0 && (
                    <div><div style={{ fontSize: '0.7rem', opacity: 0.7 }}>Extracurricular</div><div style={{ fontSize: '1rem', fontWeight: 600 }}>₹{(activeFeeStructure.extracurricular * n).toLocaleString()}</div></div>
                  )}
                  {activeFeeStructure.additionalFees?.map(a => (
                    <div key={a.name}><div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{a.name}</div><div style={{ fontSize: '1rem', fontWeight: 600 }}>₹{(a.amount * n).toLocaleString()}</div></div>
                  ))}
                  {activeFeeStructure.includeBusFee && (() => {
                    const busTotal = activeStudents.reduce((sum, st) => {
                      if ((st as any).transportType === 'bus') {
                        const route = getBusRoute(st);
                        const activeMonths = activeFeeStructure.busMonths || ACADEMIC_MONTHS;
                        return sum + (route?.fee || 0) * activeMonths.length;
                      }
                      return sum;
                    }, 0);
                    if (busTotal > 0) return <div><div style={{ fontSize: '0.7rem', opacity: 0.7 }}>Bus Fees</div><div style={{ fontSize: '1rem', fontWeight: 600 }}>₹{busTotal.toLocaleString()}</div></div>;
                    return null;
                  })()}
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span className="text-overline">Students</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, maxWidth: 280 }}>
              <input
                type="text" placeholder="Search student..." value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', outline: 'none', background: 'var(--color-surface)' }}
              />
            </div>
            <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{activeStudents.length} students</span>
          </div>
          {(() => {
            const displayStudents = studentSearch
              ? activeStudents.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()))
              : activeStudents;
            return displayStudents.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}><p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>{studentSearch ? 'No students match your search.' : 'No students in this class-section.'}</p></div>
          ) : displayStudents.map(st => {
            const paid = getStudentTotal(st.id);
            const studentActualTotal = getStudentActualTotal(st);
            const pending = studentActualTotal - paid;
            const paidPct = studentActualTotal > 0 ? Math.min(100, (paid / studentActualTotal) * 100) : 0;
            const fullyPaid = pending <= 0 && studentActualTotal > 0;
            return (
              <div key={st.id} onClick={() => setCollectingStudent(st)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)', cursor: 'pointer', transition: 'background 100ms' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-variant)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: 'var(--text-body)', fontWeight: 500 }}>{st.name}</div>
                  <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{st.admissionNumber}</div>
                  {totalForClass > 0 && (
                    <div style={{ width: '100%', maxWidth: 200, height: 4, borderRadius: 2, background: '#E5E7EB', marginTop: 4 }}>
                      <div style={{ width: `${paidPct}%`, height: '100%', borderRadius: 2, background: fullyPaid ? '#059669' : '#F59E0B', transition: 'width 300ms' }} />
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {studentActualTotal > 0 ? (
                    <>
                      <div style={{ font: 'var(--text-body-sm)', fontWeight: 600, color: fullyPaid ? '#059669' : '#DC2626' }}>
                        {fullyPaid ? '✓ Fully Paid' : `₹${pending.toLocaleString()} pending`}
                      </div>
                      <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Paid: ₹{paid.toLocaleString()}</div>
                    </>
                  ) : (
                    <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>No fee structure</div>
                  )}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'var(--space-2)', flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
              </div>
            );
          });
          })()}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // VIEW 1: CLASS-SECTION CARDS
  // ═══════════════════════════════════════════════
  return (
    <div className="page-container">
      <div className="page-header">
        <div><h2 className="text-h1">Collect Fees</h2><p className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>Select a class to view students and collect fees</p></div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div style={{ background: 'linear-gradient(135deg, #059669, #10B981)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', opacity: 0.85 }}><CreditCardIcon size={18} /><span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Today&apos;s Collection</span></div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>₹{todayTotal.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 4 }}>{todayPayments.length} transaction{todayPayments.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', opacity: 0.85 }}><CreditCardIcon size={18} /><span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Total Collected</span></div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>₹{allTimeTotal.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 4 }}>{myCollections.length} transaction{myCollections.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Class-Section Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
        {classSections.map(cs => {
          const data = getCSData(cs.key);
          return (
            <div key={cs.key} onClick={() => setActiveView(cs.key)}
              style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-4)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', transition: 'all 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-300)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ font: 'var(--text-body)', fontWeight: 600 }}>{cs.className}{cs.sectionName ? `-${cs.sectionName}` : ''}</div>
                  <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>{data.students} students</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: 'var(--text-body)', fontWeight: 700, color: data.collected > 0 ? '#059669' : 'var(--color-text-tertiary)' }}>₹{data.collected.toLocaleString()}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-primary-500)', marginTop: 2 }}>View →</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mobile-only"><FAB icon={<PlusIcon size={24} color="white" />} onClick={() => {}} label="Collect Fee" /></div>
    </div>
  );
}
