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
  | 'manageSettings';

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
  ],
  [UserRole.CORRESPONDENT]: [...ADMIN_LIKE_CAPS, 'manageUsers', 'manageSettings'],
  [UserRole.TEACHER]: ['viewOwnClassFees'],
  [UserRole.STAFF]: ['viewOwnClassFees'],
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
