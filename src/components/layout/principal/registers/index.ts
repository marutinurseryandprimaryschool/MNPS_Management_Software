/* ============================================
   Principal Register — screen barrel
   ============================================
   What DashboardLayout wires to the page keys:
     'principal-classes'  → ClassWiseSection
     'principal-teachers' → TeacherWiseSection   (principal OR teacher mode)
   The arrears report keeps its existing entry point, PrincipalDefaulters.
*/

export { default as ClassWiseSection } from './ClassWiseSection';
export { default as TeacherWiseSection } from './TeacherWiseSection';
export { default as StudentRegisterList } from './StudentRegisterList';
export { default as StudentDetailSheet } from './StudentDetailSheet';
export { default as RecordPaymentModal } from './RecordPaymentModal';
export { default as EditStudentFeesSheet } from './EditStudentFeesSheet';
export { useRegisterData, type RegisterData } from './useRegisterData';
export { useIsNarrow, MOBILE_BREAKPOINT } from './register-ui';
export { compareClassNames, groupRowsByClass, inr, toActor } from './register-shared';
