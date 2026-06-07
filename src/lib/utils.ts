import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import type { Timetable, TimetableSlot } from '@/types/models';
import { DayOfWeek } from '@/types/enums';

/* ============================================
   CampusOS — Utility Functions
   ============================================ */

/**
 * Each slot in the 8-class progression is defined by:
 *  - `label`   : the canonical display name shown in the UI
 *  - `aliases` : all lowercase strings that match a class at this slot
 *
 * This dual-style support means schools that named their classes
 * "Class 1", "Class 2" … AND schools that used "First", "Second" …
 * are both handled automatically.
 */
export const CLASS_SLOTS: { label: string; aliases: string[] }[] = [
  { label: 'Pre-KG',  aliases: ['pre-kg', 'prekg', 'pre kg', 'lkg prep', 'nursery'] },
  { label: 'LKG',     aliases: ['lkg', 'lower kg', 'lower kindergarten'] },
  { label: 'UKG',     aliases: ['ukg', 'upper kg', 'upper kindergarten'] },
  { label: 'Class 1', aliases: ['class 1', 'class1', 'std 1', 'std1', 'standard 1', 'grade 1', 'first',  '1st', 'i'] },
  { label: 'Class 2', aliases: ['class 2', 'class2', 'std 2', 'std2', 'standard 2', 'grade 2', 'second', '2nd', 'ii'] },
  { label: 'Class 3', aliases: ['class 3', 'class3', 'std 3', 'std3', 'standard 3', 'grade 3', 'third',  '3rd', 'iii'] },
  { label: 'Class 4', aliases: ['class 4', 'class4', 'std 4', 'std4', 'standard 4', 'grade 4', 'fourth', '4th', 'iv'] },
  { label: 'Class 5', aliases: ['class 5', 'class5', 'std 5', 'std5', 'standard 5', 'grade 5', 'fifth',  '5th', 'v'] },
];

/** Convenience flat list of canonical labels (for legend display). */
export const CLASS_PROGRESSION = CLASS_SLOTS.map(s => s.label) as readonly string[];

/**
 * Returns the 0-based slot index for a class name, or -1 if not recognised.
 * Matching is case-insensitive and alias-aware.
 */
export function getClassSlotIndex(className: string): number {
  const key = className?.trim().toLowerCase();
  return CLASS_SLOTS.findIndex(slot =>
    slot.label.toLowerCase() === key || slot.aliases.includes(key)
  );
}

/**
 * Returns the canonical label of the NEXT class in the progression,
 * or null if the class is already at the last slot (Class 5) or unrecognised.
 */
export function getNextClass(className: string): string | null {
  const idx = getClassSlotIndex(className);
  if (idx === -1 || idx === CLASS_SLOTS.length - 1) return null;
  return CLASS_SLOTS[idx + 1].label;
}

/**
 * Given an array of live class records from Firestore (each with `id` and `name`),
 * returns an auto-populated { sourceClassId → targetClassId } mapping.
 *
 * - Matching uses alias-aware slot resolution, so "Class 1" and "First" are equivalent.
 * - The last class (Class 5 / Fifth) is mapped to 'graduate'.
 * - Classes not recognised in the progression are left unmapped.
 */
export function buildAutoClassMapping(
  classes: { id: string; name: string }[]
): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const cls of classes) {
    const slotIdx = getClassSlotIndex(cls.name);
    if (slotIdx === -1) continue; // unrecognised — leave unmapped

    if (slotIdx === CLASS_SLOTS.length - 1) {
      // Last class → graduated
      mapping[cls.id] = 'graduate';
      continue;
    }

    // Find the Firestore class whose name resolves to the NEXT slot
    const nextSlot = CLASS_SLOTS[slotIdx + 1];
    const targetClass = classes.find(c => {
      const key = c.name.trim().toLowerCase();
      return nextSlot.label.toLowerCase() === key || nextSlot.aliases.includes(key);
    });
    if (targetClass) {
      mapping[cls.id] = targetClass.id;
    }
  }

  return mapping;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Generate admission number with prefix
 */
export function generateAdmissionNumber(prefix: string, count: number): string {
  const year = new Date().getFullYear();
  const padded = String(count + 1).padStart(4, '0');
  return `${prefix}-${year}-${padded}`;
}

/**
 * Generate receipt number
 */
export function generateReceiptNumber(): string {
  const date = format(new Date(), 'yyyyMMdd');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `RCP-${date}-${random}`;
}

/**
 * Format currency (INR)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format compact currency (₹2.4L)
 */
export function formatCompactCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount}`;
}

/**
 * Format date
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM dd, yyyy');
}

/**
 * Format date relative
 */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Returns the upcoming Saturday from `from` (or `from` itself when it is Saturday).
 */
export function getUpcomingSaturday(from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const daysUntilSat = (6 - d.getDay() + 7) % 7; // 6 = Saturday
  d.setDate(d.getDate() + daysUntilSat);
  return d;
}

/**
 * ISO-style YYYY-MM-DD key used to index per-Saturday overrides.
 */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Resolves which Saturday slots to show for a given date — explicit override
 * if saved, otherwise the recurring weekly Saturday slots from the timetable.
 */
export function getEffectiveSaturdaySlots(
  timetable: Pick<Timetable, 'slots' | 'saturdayOverrides'> | null | undefined,
  dateKey: string
): { slots: TimetableSlot[]; mode: 'recurring' | 'custom' | 'holiday' } {
  const override = timetable?.saturdayOverrides?.[dateKey];
  if (override) {
    return {
      slots: override.status === 'holiday' ? [] : (override.slots || []),
      mode: override.status,
    };
  }
  const recurring = (timetable?.slots || []).filter(s => s.day === DayOfWeek.SATURDAY);
  return { slots: recurring, mode: 'recurring' };
}

/**
 * Format time
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Get current period based on time
 */
export function getCurrentPeriod(timings: { period?: number; start: string; end: string }[]): number | null {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  for (const timing of timings) {
    if (timing.period && currentTime >= timing.start && currentTime < timing.end) {
      return timing.period;
    }
  }
  return null;
}

/**
 * Get today's day of week
 */
export function getTodayDayOfWeek(): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()];
}

/**
 * Calculate attendance percentage
 */
export function calculateAttendancePercentage(present: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
}

/**
 * Calculate grade from marks
 */
export function calculateGrade(
  marks: number,
  maxMarks: number,
  gradeScale: { grade: string; min: number; max: number }[]
): string {
  const percentage = (marks / maxMarks) * 100;
  for (const scale of gradeScale) {
    if (percentage >= scale.min && percentage <= scale.max) {
      return scale.grade;
    }
  }
  return 'N/A';
}

/**
 * Get subject color
 */
export function getSubjectColor(subjectName: string): { color: string; bg: string } {
  const name = subjectName.toLowerCase();
  const colorMap: Record<string, { color: string; bg: string }> = {
    math: { color: '#6366F1', bg: '#EEF2FF' },
    mathematics: { color: '#6366F1', bg: '#EEF2FF' },
    english: { color: '#EC4899', bg: '#FDF2F8' },
    science: { color: '#10B981', bg: '#ECFDF5' },
    hindi: { color: '#F59E0B', bg: '#FFFBEB' },
    social: { color: '#8B5CF6', bg: '#F5F3FF' },
    'social studies': { color: '#8B5CF6', bg: '#F5F3FF' },
    pe: { color: '#14B8A6', bg: '#F0FDFA' },
    'physical education': { color: '#14B8A6', bg: '#F0FDFA' },
    computer: { color: '#3B82F6', bg: '#EFF6FF' },
    'computer science': { color: '#3B82F6', bg: '#EFF6FF' },
    art: { color: '#F97316', bg: '#FFF7ED' },
  };
  
  for (const [key, value] of Object.entries(colorMap)) {
    if (name.includes(key)) return value;
  }
  
  // Default color
  return { color: '#64748B', bg: '#F1F5F9' };
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Classnames helper
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Truncate text
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Get greeting based on time of day
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
