import {
  UserRole,
  StudentStatus,
  TeacherStatus,
  TimetableStatus,
  AttendanceStatus,
  MarksStatus,
  PaymentMode,
  FeeType,
  NotificationType,
  ConflictSeverity,
  ConflictType,
  SchoolPlan,
  DayOfWeek,
  AssignmentStatus,
} from './enums';

/* ============================================
   CampusOS — TypeScript Interfaces
   ============================================ */

// ── Timestamps ──
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

// ── Period Timing ──
export interface PeriodTiming {
  period?: number;
  type?: 'break' | 'lunch';
  label?: string;
  start: string;   // HH:MM
  end: string;      // HH:MM
}

// ── Grade Scale ──
export interface GradeScale {
  grade: string;
  min: number;
  max: number;
}

// ── School Settings ──
export interface SchoolSettings {
  admissionPrefix: string;
  periodsPerDay: number;
  schoolDays: DayOfWeek[];
  periodTimings: PeriodTiming[];
  gradeScale: GradeScale[];
  maxPeriodsPerTeacherPerDay: number;
  maxConsecutivePeriods: number;
}

// ── School ──
export interface School extends Timestamps {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
  academicYear: string;
  plan: SchoolPlan;
  settings: SchoolSettings;
}

// ── User ──
export interface User extends Timestamps {
  id: string;
  uid: string;
  role: UserRole;
  name: string;
  email: string;
  phone: string;
  photo: string;
  status: 'active' | 'inactive' | 'archived';
}

// ── Subject ──
export interface Subject {
  id: string;
  name: string;
  code: string;
  weeklyPeriods: number;
}

// ── Section ──
export interface Section {
  id: string;
  name: string;
  classTeacherId: string;
  maxCapacity: number;
}

// ── Class ──
export interface Class {
  id: string;
  name: string;
  order: number;
  sections: Section[];
  subjects: Subject[];
  academicYear: string;
}

// ── Student ──
export interface Student extends Timestamps {
  id: string;
  admissionNumber: string;
  name: string;
  dob: Date;
  gender: 'male' | 'female' | 'other';
  bloodGroup: string;
  address: string;
  photo: string;
  classId: string;
  sectionId: string;
  parentIds: string[];
  status: StudentStatus;
  archiveReason?: string;
  // denormalized
  className?: string;
  sectionName?: string;
}

// ── Teacher Assigned Class ──
export interface TeacherAssignment {
  classId: string;
  sectionId: string;
  subjectId: string;
  isClassTeacher: boolean;
  // denormalized
  className?: string;
  sectionName?: string;
  subjectName?: string;
}

// ── Teacher Availability ──
export type TeacherAvailability = Record<DayOfWeek, Record<number, boolean>>;

// ── Teacher ──
export interface Teacher extends Timestamps {
  id: string;
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  photo: string;
  subjects: string[];          // subject IDs they can teach
  subjectNames?: string[];     // denormalized
  assignedClasses: TeacherAssignment[];
  availability: TeacherAvailability;
  status: TeacherStatus;
}

// ── Timetable Slot ──
export interface TimetableSlot {
  day: DayOfWeek;
  period: number;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  roomId?: string;
}

// ── Timetable ──
export interface Timetable extends Timestamps {
  id: string;
  classId: string;
  sectionId: string;
  academicYear: string;
  version: number;
  status: TimetableStatus;
  effectiveFrom: Date;
  slots: TimetableSlot[];
  createdBy: string;
  // denormalized
  className?: string;
  sectionName?: string;
}

// ── Attendance Record ──
export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
}

// ── Attendance ──
export interface Attendance {
  id: string;
  date: string;               // YYYY-MM-DD
  classId: string;
  sectionId: string;
  period: number;
  subjectId: string;
  teacherId: string;
  records: AttendanceRecord[];
  submittedAt: Date;
  editedAt?: Date;
  // denormalized
  className?: string;
  sectionName?: string;
  subjectName?: string;
  teacherName?: string;
}

// ── Marks Record ──
export interface MarksRecord {
  studentId: string;
  studentName: string;
  marksObtained: number;
  grade: string;
  remarks?: string;
}

// ── Marks ──
export interface Marks {
  id: string;
  examType: string;
  examName: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  maxMarks: number;
  records: MarksRecord[];
  status: MarksStatus;
  createdAt: Date;
  publishedAt?: Date;
  // denormalized
  className?: string;
  sectionName?: string;
  subjectName?: string;
}

// ── File Attachment ──
export interface FileAttachment {
  name: string;
  url: string;
  size: number;
  type?: string;
}

// ── Assignment ──
export interface Assignment extends Timestamps {
  id: string;
  title: string;
  description: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  dueDate: Date;
  attachments: FileAttachment[];
  status: AssignmentStatus;
  // denormalized
  className?: string;
  sectionName?: string;
  subjectName?: string;
  teacherName?: string;
}

// ── Material ──
export interface Material extends Timestamps {
  id: string;
  title: string;
  description: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  files: FileAttachment[];
  // denormalized
  className?: string;
  sectionName?: string;
  subjectName?: string;
  teacherName?: string;
}

// ── Fee Category ──
export interface FeeCategory {
  name: string;
  amount: number;
  installments?: FeeInstallment[];
}

export interface FeeInstallment {
  dueDate: Date;
  amount: number;
}

// ── Fee Structure ──
export interface FeeStructure {
  id: string;
  type: FeeType.STRUCTURE;
  classId: string;
  academicYear: string;
  categories: FeeCategory[];
  totalAmount: number;
  createdAt: Date;
  // denormalized
  className?: string;
}

// ── Fee Payment ──
export interface FeePayment {
  id: string;
  type: FeeType.PAYMENT;
  studentId: string;
  studentName: string;
  classId: string;
  amount: number;
  mode: PaymentMode;
  referenceNumber: string;
  receiptNumber: string;
  category: string;
  receivedBy: string;
  paidAt: Date;
  createdAt: Date;
  // denormalized
  className?: string;
}

// ── Chat ──
export interface Chat extends Timestamps {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantRoles: Record<string, 'teacher' | 'parent'>;
  lastMessage: {
    text: string;
    senderId: string;
    sentAt: Date;
  };
  unreadCount: Record<string, number>;
}

// ── Message ──
export interface Message {
  id: string;
  senderId: string;
  text: string;
  attachments: FileAttachment[];
  readBy: string[];
  sentAt: Date;
  readAt?: Date;
}

// ── Notification ──
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  targetRole: 'all' | UserRole;
  targetUsers: string[];
  targetClass?: string;
  data: Record<string, string>;
  createdBy: string;
  createdAt: Date;
  readBy: string[];
}

// ── Scheduling Conflict ──
export interface ScheduleConflict {
  type: ConflictType;
  severity: ConflictSeverity;
  slot?: TimetableSlot;
  teacher?: string;
  message: string;
  fix: string;
  day?: DayOfWeek;
  period?: number;
}

// ── Dashboard Stats ──
export interface AdminDashboardStats {
  totalStudents: number;
  totalTeachers: number;
  avgAttendance: number;
  totalFeeCollected: number;
  pendingFees: number;
  totalClasses: number;
}

export interface TeacherDashboardData {
  todayClasses: TimetableSlot[];
  currentPeriod: TimetableSlot | null;
  nextPeriod: TimetableSlot | null;
  pendingAttendances: number;
  unreadMessages: number;
}

export interface ParentDashboardData {
  child: Student;
  todayAttendance: AttendanceRecord[];
  attendancePercentage: number;
  avgGrade: string;
  pendingAssignments: Assignment[];
  pendingFees: number;
  unreadMessages: number;
}
