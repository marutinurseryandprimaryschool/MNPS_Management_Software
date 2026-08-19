'use client';

/* ============================================
   Teacher-wise Register — page key 'principal-teachers'
   ============================================
   One page key, two screens, chosen by capability rather than by role name:

     manageTeacherAssignment  → PRINCIPAL mode: hand students to teachers.
     viewPrincipalRegister    → TEACHER mode: work my own assigned students.

   Both read the same rows through the same hook, so the count a teacher sees
   and the count Sharmi sees next to that teacher's name are the same number.
*/

import React, { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { hasCapability } from '@/lib/permissions';
import { toActor } from './register-shared';
import { ErrorBlock, LoadingBlock, NoticeBanner } from './register-ui';
import { useRegisterData } from './useRegisterData';
import TeacherAssignPanel from './TeacherAssignPanel';
import TeacherOwnRegister from './TeacherOwnRegister';

export default function TeacherWiseSection() {
  const { user, role } = useAuth();
  const { school } = useSchool();
  const data = useRegisterData(school?.academicYear);
  const actor = useMemo(() => toActor(user, role), [user, role]);

  const canView = hasCapability(role, 'viewPrincipalRegister');
  const canManageAssignment = hasCapability(role, 'manageTeacherAssignment');
  const canEditFees = hasCapability(role, 'editOwnStudentFees')
    || hasCapability(role, 'editPrincipalRegister');
  const canRecordPayments = hasCapability(role, 'recordPrincipalPayments');

  if (!canView) {
    return (
      <div className="page-container">
        <NoticeBanner tone="warning">
          You do not have access to the teacher-wise register. If your role changed recently,
          refresh the app.
        </NoticeBanner>
      </div>
    );
  }

  if (data.loading) return <div className="page-container"><LoadingBlock /></div>;

  if (data.error) {
    return (
      <div className="page-container">
        <ErrorBlock
          title="Could not load the teacher-wise register"
          message={data.error}
          onRetry={() => { void data.reload(); }}
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      {canManageAssignment ? (
        <TeacherAssignPanel data={data} actor={actor} />
      ) : (
        <TeacherOwnRegister
          data={data}
          actor={actor}
          academicYear={school?.academicYear}
          canEditFees={canEditFees}
          canRecordPayments={canRecordPayments}
        />
      )}
    </div>
  );
}
