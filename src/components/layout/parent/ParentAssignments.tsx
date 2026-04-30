'use client';

import React, { useState, useEffect } from 'react';
import { AssignmentsService, StudentsService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Badge } from '@/components/ui/SharedUI';
import type { Assignment, Student } from '@/types/models';

export default function ParentAssignments() {
  const { user } = useAuth();
  const { school } = useSchool();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [child, setChild] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        if (!user || !school?.academicYear) return;
        const allStudents = await StudentsService.getAll(school.academicYear);
        const myChild = (allStudents as unknown as Student[]).find(s =>
          s.email?.toLowerCase() === user.email?.toLowerCase()
        );
        setChild(myChild || null);
        if (myChild) {
          const classAssignments = await AssignmentsService.getByClass(myChild.classId);
          setAssignments(classAssignments as unknown as Assignment[]);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, school?.academicYear]);

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Assignments</h2>
      </div>

      {assignments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No assignments yet{child ? ` for ${child.name}` : ''}.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {assignments.map(a => (
            <div key={a.id} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 className="text-h3">{a.title}</h3>
                  <p className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{a.subjectName} • Due: {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'N/A'}</p>
                </div>
                <Badge variant={a.status === 'active' ? 'warning' : 'success'}>{a.status === 'active' ? 'Pending' : 'Done'}</Badge>
              </div>
              {a.description && <p className="text-body-sm" style={{ marginTop: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>{a.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
