/* ============================================
   CampusOS — Enumerations
   ============================================ */

export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STAFF = 'staff',
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

export enum AttendanceSession {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
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

export enum ExamTerm {
  I_MID_TERM = 'i_mid_term',
  QUARTERLY = 'quarterly',
  II_MID_TERM = 'ii_mid_term',
  HALF_YEARLY = 'half_yearly',
  III_MID_TERM = 'iii_mid_term',
  ANNUAL = 'annual',
}

export enum MonthlyExam {
  JUNE = 'june',
  JULY = 'july',
  AUGUST = 'august',
  SEPTEMBER = 'september',
  OCTOBER = 'october',
  NOVEMBER = 'november',
  DECEMBER = 'december',
  JANUARY = 'january',
  FEBRUARY = 'february',
  MARCH = 'march',
}

export const EXAM_TERM_LABELS: Record<ExamTerm, string> = {
  [ExamTerm.I_MID_TERM]: 'I Mid Term',
  [ExamTerm.QUARTERLY]: 'Quarterly',
  [ExamTerm.II_MID_TERM]: 'II Mid Term',
  [ExamTerm.HALF_YEARLY]: 'Half Yearly',
  [ExamTerm.III_MID_TERM]: 'III Mid Term',
  [ExamTerm.ANNUAL]: 'Annual',
};

export const EXAM_TERMS_ORDER: ExamTerm[] = [
  ExamTerm.I_MID_TERM,
  ExamTerm.QUARTERLY,
  ExamTerm.II_MID_TERM,
  ExamTerm.HALF_YEARLY,
  ExamTerm.III_MID_TERM,
  ExamTerm.ANNUAL,
];

export enum CoScholasticArea {
  NEATNESS = 'neatness',
  LIFE_SKILLS = 'life_skills',
  ATTITUDES_VALUES = 'attitudes_values',
  YOGA_HEALTH_WELLNESS = 'yoga_health_wellness',
  CO_CURRICULAR = 'co_curricular',
}

export const CO_SCHOLASTIC_LABELS: Record<CoScholasticArea, string> = {
  [CoScholasticArea.NEATNESS]: 'Neatness',
  [CoScholasticArea.LIFE_SKILLS]: 'Life Skills',
  [CoScholasticArea.ATTITUDES_VALUES]: 'Attitudes and Values',
  [CoScholasticArea.YOGA_HEALTH_WELLNESS]: 'Yoga, Health and Wellness',
  [CoScholasticArea.CO_CURRICULAR]: 'Co-Curricular Activities',
};

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
