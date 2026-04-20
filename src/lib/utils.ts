import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

/* ============================================
   CampusOS — Utility Functions
   ============================================ */

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
