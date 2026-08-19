/* ============================================
   CampusOS — Role Capability Map
   ============================================
   Single source of truth for role → capability mapping
   (docs/designs/principal-role-fees-accounts.md, scope item 2).

   UI gating only — the actual enforcement surface is firestore.rules.
   Every role check in layout/nav/screens must go through this module
   instead of comparing UserRole values inline. */

import { UserRole } from '@/types/enums';

export type Capability =
  | 'enterFeePayments'   // record new fee payments (principal)
  | 'editFeePayments'    // edit / soft-delete payments, run payment migrations (principal)
  | 'manageFeeStructures'
  | 'manageScholarships'
  | 'viewAllFees'        // school-wide fee visibility (admin-like)
  | 'viewOwnClassFees'   // read-only fee register scoped to own class (teacher)
  | 'viewAccounts'       // Principal Accounts module (balance sheet, defaulters)
  | 'addExpenses'
  | 'manageUsers'
  | 'manageSettings'
  /* ── Principal Register (standalone module; see src/types/principal.ts) ──
     These gate Sharmi's fees note / class-wise / teacher-wise registers and
     the income-vs-expense book. They are SEPARATE from the legacy fee caps
     above on purpose: the two modules share no data and no permissions. */
  | 'viewPrincipalRegister'   // see the register (principal + teachers)
  | 'editPrincipalRegister'   // add/edit/remove register rows (principal)
  | 'editOwnStudentFees'      // edit fee amounts for OWN assigned students (teacher)
  | 'recordPrincipalPayments' // record a receipt against a register row
  | 'viewPrincipalAccounts'   // the daily/monthly income-vs-expense book (principal)
  | 'manageTeacherAssignment';// assign students to responsible teachers (principal)

const ADMIN_LIKE_CAPS: readonly Capability[] = [
  'manageFeeStructures',
  'manageScholarships',
  'viewAllFees',
];

// Staff members share the teacher UI shell (nav, routes) throughout the app,
// so they carry the same read-only fee capability; scoping to an actual class
// still requires an isClassTeacher assignment.
const ROLE_CAPABILITIES: Record<UserRole, readonly Capability[]> = {
  [UserRole.ADMIN]: [...ADMIN_LIKE_CAPS, 'manageUsers', 'manageSettings'],
  [UserRole.PRINCIPAL]: [
    ...ADMIN_LIKE_CAPS,
    'enterFeePayments',
    'editFeePayments',
    'viewAccounts',
    'addExpenses',
    'viewPrincipalRegister',
    'editPrincipalRegister',
    'recordPrincipalPayments',
    'viewPrincipalAccounts',
    'manageTeacherAssignment',
  ],
  [UserRole.CORRESPONDENT]: [...ADMIN_LIKE_CAPS, 'manageUsers', 'manageSettings'],
  // Teachers see and work ONLY the register rows assigned to them; the row
  // filter is client-side, the real boundary is ownsRegisterRow in firestore.rules.
  [UserRole.TEACHER]: [
    'viewOwnClassFees',
    'viewPrincipalRegister',
    'editOwnStudentFees',
    'recordPrincipalPayments',
  ],
  [UserRole.STAFF]: [
    'viewOwnClassFees',
    'viewPrincipalRegister',
    'editOwnStudentFees',
    'recordPrincipalPayments',
  ],
  [UserRole.PARENT]: [],
};

export function hasCapability(role: UserRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/* ── Convenience helpers (replace duplicated inline role lists) ── */

/** Admin / Principal / Correspondent — the admin UI shell (routes, sidebar, tabs). */
export function isAdminLike(role: UserRole | null | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.PRINCIPAL || role === UserRole.CORRESPONDENT;
}

/** Teacher / Staff — the teacher UI shell. */
export function isTeacherLike(role: UserRole | null | undefined): boolean {
  return role === UserRole.TEACHER || role === UserRole.STAFF;
}

export { ROLE_CAPABILITIES };
