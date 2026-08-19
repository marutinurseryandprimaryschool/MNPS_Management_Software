/* ============================================
   Principal Register — shared helpers (pure, no React)
   ============================================
   Presentation-only helpers for the class-wise and teacher-wise registers.
   All money math lives in src/lib/principal-fees.ts; nothing here computes a
   due, a split or a balance.
*/

import { getClassSlotIndex } from '@/lib/utils';
import type { UserRole } from '@/types/enums';
import type { User } from '@/types/models';
import type { PrincipalActor, RegisterRow } from '@/types/principal';

/** Rupees, Indian digit grouping. The one money formatter these screens use. */
export const inr = (value: number): string =>
  `\u20B9${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

/** Compact column/chip label for a month ('September' → 'Sep'). */
export const monthShort = (month: string): string => month.slice(0, 3);

/* ── Class ordering ───────────────────────────────────────────────────── */

/**
 * Pre-KG → Class 5, using the alias-aware progression in lib/utils so
 * "First"/"Class 1"/"Std 1" all land in the same slot. Names outside the
 * progression sort after it, alphabetically with numeric collation, so a
 * stray class is still visible rather than dropped.
 */
export function compareClassNames(a: string, b: string): number {
  const indexA = getClassSlotIndex(a);
  const indexB = getClassSlotIndex(b);
  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Section + roll + name, so a class list reads the way the paper note does. */
export function compareStudents(a: RegisterRow, b: RegisterRow): number {
  return (a.sectionName || '').localeCompare(b.sectionName || '', undefined, { sensitivity: 'base' })
    || (a.rollNo || '').localeCompare(b.rollNo || '', undefined, { numeric: true })
    || (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
}

export const UNASSIGNED_CLASS = 'Unassigned';

/** Rows bucketed by class, groups in progression order, students sorted inside. */
export function groupRowsByClass(rows: RegisterRow[]): { className: string; rows: RegisterRow[] }[] {
  const byClass = new Map<string, RegisterRow[]>();
  for (const row of rows) {
    const key = row.className || UNASSIGNED_CLASS;
    byClass.set(key, [...(byClass.get(key) ?? []), row]);
  }
  return Array.from(byClass.entries())
    .map(([className, list]) => ({ className, rows: [...list].sort(compareStudents) }))
    .sort((a, b) => compareClassNames(a.className, b.className));
}

/* ── Teacher load ─────────────────────────────────────────────────────── */

/** Sharmi's own target: roughly one class-worth of students per teacher. */
export const TARGET_STUDENTS_PER_TEACHER = 21;
/** How far off target is still "fine" — beyond this the UI warns. */
export const TEACHER_LOAD_TOLERANCE = 6;

export type TeacherLoadStatus = 'ok' | 'light' | 'heavy';

export function teacherLoadStatus(count: number): TeacherLoadStatus {
  if (count < TARGET_STUDENTS_PER_TEACHER - TEACHER_LOAD_TOLERANCE) return 'light';
  if (count > TARGET_STUDENTS_PER_TEACHER + TEACHER_LOAD_TOLERANCE) return 'heavy';
  return 'ok';
}

/* ── Actor ────────────────────────────────────────────────────────────── */

/**
 * The `{ uid, name, role }` stamp every service mutation needs. Returns null
 * when the session has no usable uid — callers must refuse to write rather
 * than send an unattributable change into the audit log.
 */
export function toActor(user: User | null, role: UserRole | null): PrincipalActor | null {
  const uid = user?.uid || user?.id || '';
  if (!uid || !role) return null;
  return { uid, name: user?.name || user?.email || 'Unknown user', role };
}

/** The uid a register row's `teacherUid` must carry (auth uid, not the teacher doc id). */
export function teacherAuthUid(teacher: { userId?: string; uid?: string; id?: string }): string {
  return teacher.userId || teacher.uid || '';
}

/* ── Errors ───────────────────────────────────────────────────────────── */

/** Service errors already carry a user-safe message; anything else is generic. */
export function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
