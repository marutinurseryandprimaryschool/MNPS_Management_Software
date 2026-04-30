import React, { useState, useEffect } from 'react';
import { FeePaymentsService, StudentsService, FeeStructuresService, BusRoutesService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import type { FeePayment, Student, FeeStructure } from '@/types/models';

const ACADEMIC_MONTHS = [
  'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'
];

export default function ParentFees() {
  const { user } = useAuth();
  const { school } = useSchool();
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [child, setChild] = useState<Student | null>(null);
  const [structure, setStructure] = useState<FeeStructure | null>(null);
  const [busRouteFee, setBusRouteFee] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        if (!user || !school?.academicYear) return;
        const [allStudents, allStructures] = await Promise.all([
          StudentsService.getAll(school.academicYear),
          FeeStructuresService.getAll(school.academicYear)
        ]);

        const myChild = (allStudents as unknown as Student[]).find(s =>
          s.email?.toLowerCase() === user.email?.toLowerCase()
        );
        setChild(myChild || null);

        if (myChild) {
          const [myPayments, myStructure] = await Promise.all([
            FeePaymentsService.getByStudent(myChild.id, school.academicYear),
            (allStructures as unknown as FeeStructure[]).find(fs => fs.classId === myChild.classId)
          ]);
          setPayments(myPayments as unknown as FeePayment[]);
          setStructure(myStructure || null);

          // Fetch bus route fee if student is a bus commuter
          if ((myChild as any).transportType === 'bus' && (myChild as any).routeId && (myStructure as any)?.includeBusFee) {
            const allRoutes = await BusRoutesService.getAll();
            const route = (allRoutes as any[]).find(r => r.id === (myChild as any).routeId);
            setBusRouteFee(route?.fee || 0);
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, school?.academicYear]);

  const activeMonths = (structure as any)?.busMonths || ACADEMIC_MONTHS;
  // Bus fee comes from the student's assigned route, not a static fee on the structure
  const busFeeMonthly = ((child as any)?.transportType === 'bus' && (structure as any)?.includeBusFee) ? busRouteFee : 0;
  const totalBusFees = busFeeMonthly * activeMonths.length;
  const totalFees = (structure?.totalAmount || 0) + totalBusFees;
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const balance = totalFees - totalPaid;

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Fee Details</h2>
      </div>

      {child && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Total Fees</div>
              <div className="text-h2">₹{totalFees.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Total Paid</div>
              <div className="text-h2" style={{ color: 'var(--color-success)' }}>₹{totalPaid.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Remaining Balance</div>
              <div className="text-h2" style={{ color: balance > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>₹{balance.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
            {/* Fee Breakdown */}
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-overline">Fee Structure Breakdown</span>
              </div>
              {!structure ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No fee structure found for Class {child.className}.</p>
                </div>
              ) : (
                <div style={{ padding: 'var(--space-2)' }}>
                  {(structure as any).terms?.map((term: any, idx: number) => (
                    <div key={`term-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-divider)' }}>
                      <span className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>{term.name}</span>
                      <span className="text-body-sm" style={{ fontWeight: 600 }}>₹{Number(term.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  {(structure as any).extracurricular > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-divider)' }}>
                      <span className="text-body-sm" style={{ color: '#7C3AED' }}>Extracurricular</span>
                      <span className="text-body-sm" style={{ fontWeight: 600, color: '#7C3AED' }}>₹{Number((structure as any).extracurricular).toLocaleString()}</span>
                    </div>
                  )}
                  {(structure as any).additionalFees?.map((fee: any, idx: number) => (
                    <div key={`add-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-divider)' }}>
                      <span className="text-body-sm" style={{ color: '#D97706' }}>{fee.name}</span>
                      <span className="text-body-sm" style={{ fontWeight: 600, color: '#D97706' }}>₹{Number(fee.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-body-sm" style={{ fontWeight: 700 }}>Total</span>
                    <span className="text-body-sm" style={{ fontWeight: 700 }}>₹{totalFees.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment History */}
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-overline">Payment History</span>
              </div>
              {payments.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No payment records found.</p>
                </div>
              ) : (
                <div style={{ padding: 'var(--space-2)' }}>
                  {payments.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
                      <div>
                        <div style={{ font: 'var(--text-body-sm)', fontWeight: 600 }}>{p.category || 'Payment'}</div>
                        <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontSize: '0.7rem' }}>{p.mode?.toUpperCase()} • {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'N/A'}</div>
                      </div>
                      <div style={{ font: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--color-success)' }}>₹{Number(p.amount).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {busFeeMonthly > 0 && (
            <div style={{ marginTop: 'var(--space-6)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#F0F9FF', borderBottom: '1px solid #BAE6FD' }}>
                <span className="text-overline" style={{ color: '#0369A1' }}>Monthly Bus Fee Status (₹{busFeeMonthly}/month)</span>
              </div>
              <div style={{ padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                {activeMonths.map((month: string) => {
                  const cat = `Bus Fee - ${month}`;
                  const paidInMonth = payments.filter(p => p.category === cat).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                  const isPaid = paidInMonth >= busFeeMonthly;
                  
                  return (
                    <div key={month} style={{ 
                      padding: 'var(--space-3)', 
                      borderRadius: 'var(--radius-md)', 
                      background: isPaid ? 'var(--color-success-bg)' : 'var(--color-surface-variant)',
                      border: `1px solid ${isPaid ? 'var(--color-success)' : 'var(--color-border)'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontWeight: 600 }}>{month}</span>
                      {isPaid ? (
                        <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '0.8rem' }}>✓ PAID</span>
                      ) : (
                        <span style={{ color: 'var(--color-error)', fontWeight: 700, fontSize: '0.8rem' }}>PENDING</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
