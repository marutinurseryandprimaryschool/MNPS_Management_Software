/* ============================================
   CampusOS — Enumerations
   ============================================ */

export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  PARENT = 'parent',
  PRINCIPAL = 'principal',
  CORRESPONDENT = 'correspondent',
}

export enum StudentStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum TeacherStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum TimetableStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
}

export enum MarksStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export enum PaymentMode {
  CASH = 'cash',
  UPI = 'upi',
  CHEQUE = 'cheque',
  BANK_TRANSFER = 'bank_transfer',
}

export enum FeeType {
  STRUCTURE = 'structure',
  PAYMENT = 'payment',
}

export enum NotificationType {
  FEE_REMINDER = 'fee_reminder',
  ATTENDANCE_ALERT = 'attendance_alert',
  TIMETABLE_CHANGE = 'timetable_change',
  ANNOUNCEMENT = 'announcement',
  NEW_MESSAGE = 'new_message',
  ASSIGNMENT_DUE = 'assignment_due',
}

export enum ConflictSeverity {
  ERROR = 'error',
  WARNING = 'warning',
}

export enum ConflictType {
  TEACHER_UNAVAILABLE = 'TEACHER_UNAVAILABLE',
  TEACHER_DOUBLE_BOOKED = 'TEACHER_DOUBLE_BOOKED',
  EMPTY_SLOT = 'EMPTY_SLOT',
  SUBJECT_OVERLOAD = 'SUBJECT_OVERLOAD',
}

export enum SchoolPlan {
  FREE = 'free',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
}

export enum AssignmentStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export const DAYS_OF_WEEK = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
] as const;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  [DayOfWeek.MONDAY]: 'Monday',
  [DayOfWeek.TUESDAY]: 'Tuesday',
  [DayOfWeek.WEDNESDAY]: 'Wednesday',
  [DayOfWeek.THURSDAY]: 'Thursday',
  [DayOfWeek.FRIDAY]: 'Friday',
  [DayOfWeek.SATURDAY]: 'Saturday',
};

export const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  [DayOfWeek.MONDAY]: 'Mon',
  [DayOfWeek.TUESDAY]: 'Tue',
  [DayOfWeek.WEDNESDAY]: 'Wed',
  [DayOfWeek.THURSDAY]: 'Thu',
  [DayOfWeek.FRIDAY]: 'Fri',
  [DayOfWeek.SATURDAY]: 'Sat',
};
