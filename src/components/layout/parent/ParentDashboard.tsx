'use client';

import React, { useState, useEffect } from 'react';
import { DataCard } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { StudentsService, AssignmentsService, FeePaymentsService } from '@/lib/firestore-service';
import { getGreeting } from '@/lib/utils';
import { GraduationCapIcon, BookOpenIcon, CreditCardIcon, ClipboardCheckIcon } from '@/components/ui/Icons';
import type { Student, Assignment } from '@/types/models';

export default function ParentDashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { user } = useAuth();
  const { school } = useSchool();
  const [children, setChildren] = useState<Student[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        if (!user || !school?.academicYear) return;
        
        // Use optimized query to fetch only this parent's children
        let myChildren: Student[] = [];
        
        if (user.email) {
          const results = await StudentsService.getByEmail(user.email, school.academicYear);
          myChildren = results as unknown as Student[];
        }
        
        // Fallback for parents who logged in with code/dob (might not have email in user object)
        if (myChildren.length === 0 && user.phone) {
          const results = await StudentsService.getByPhone(user.phone, school.academicYear);
          myChildren = results as unknown as Student[];
        }

        setChildren(myChildren);

        if (myChildren.length > 0) {
          const defaultChildId = myChildren[0].id;
          setActiveChildId(defaultChildId);
          const classAssignments = await AssignmentsService.getByClass(myChildren[0].classId);
          setAssignments(classAssignments as unknown as Assignment[]);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, school?.academicYear]);

  const activeChild = children.find(c => c.id === activeChildId) || children[0];

  useEffect(() => {
    if (activeChild && school?.academicYear) {
      AssignmentsService.getByClass(activeChild.classId).then(data => {
        setAssignments(data as unknown as Assignment[]);
      });
    }
  }, [activeChildId, school?.academicYear]);

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="text-h1">{getGreeting()}, {user?.name?.split(' ')[0]}</h2>
          <p className="text-body-sm" style={{ marginTop: 'var(--space-1)', color: 'var(--color-text-tertiary)' }}>
            {activeChild ? `Viewing records for ${activeChild.name}` : 'No children linked to your account yet.'}
          </p>
        </div>
        {children.length > 1 && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {children.map(c => (
              <button 
                key={c.id} 
                onClick={() => setActiveChildId(c.id)}
                style={{ 
                  padding: 'var(--space-2) var(--space-4)', 
                  borderRadius: 'var(--radius-full)', 
                  border: '1px solid var(--color-border)', 
                  fontSize: '0.85rem', 
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeChildId === c.id ? 'var(--color-primary-500)' : 'var(--color-surface)',
                  color: activeChildId === c.id ? 'white' : 'var(--color-text-primary)',
                  transition: 'all 200ms'
                }}
              >
                {c.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        <DataCard icon={<GraduationCapIcon size={22} />} value={children.length} label="Children" color="var(--color-primary-500)" />
        <DataCard icon={<ClipboardCheckIcon size={22} />} value="—" label="Attendance" color="var(--color-success)" onClick={() => onNavigate('attendance')} />
        <DataCard icon={<BookOpenIcon size={22} />} value={assignments.length} label="Assignments" color="var(--color-warning)" onClick={() => onNavigate('assignments')} />
        <DataCard icon={<CreditCardIcon size={22} />} value="—" label="Fee Status" color="var(--color-info)" onClick={() => onNavigate('fees')} />
      </div>

      {activeChild && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-5)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-full)', background: 'var(--color-primary-50)', color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700 }}>
              {activeChild.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-h3" style={{ margin: 0 }}>{activeChild.name}</h3>
              <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{activeChild.className} • Section {activeChild.sectionName}</p>
            </div>
          </div>
          <div className="grid-2">
            <div><span className="text-caption">Admission Number</span><p className="text-body">{activeChild.admissionNumber}</p></div>
            <div><span className="text-caption">Date of Birth</span><p className="text-body">{activeChild.dob ? new Date(activeChild.dob).toLocaleDateString('en-IN') : '—'}</p></div>
            <div><span className="text-caption">Gender</span><p className="text-body" style={{ textTransform: 'capitalize' }}>{activeChild.gender}</p></div>
            <div><span className="text-caption">Blood Group</span><p className="text-body">{activeChild.bloodGroup || '—'}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
