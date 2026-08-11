import {
  UserRole,
  StudentStatus,
  TeacherStatus,
  TimetableStatus,
  AttendanceStatus,
  AttendanceSession,
  MarksStatus,
  PaymentMode,
  FeeType,
  NotificationType,
  ConflictSeverity,
  ConflictType,
  SchoolPlan,
  DayOfWeek,
  AssignmentStatus,
  ExamTerm,
  MonthlyExam,
  CoScholasticArea,
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

// ── Scholarship (defined in Settings, referenced by Students) ──
export interface Scholarship {
  id: string;
  name: string;                          // e.g. "RTE"
  active: boolean;                       // uncheck to hide from student dropdown
  amountsByClass: Record<string, number>; // classId → fixed total fee for the year
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
  scholarships?: Scholarship[];
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
  // 'pending' = staff invite doc awaiting first login (auto-ID doc, consumed
  // by the AuthContext migration batch on first sign-in).
  status: 'active' | 'inactive' | 'archived' | 'pending';
  // Set on parent users when the phone+DOB login matches a student record.
  // This is the most reliable parent ↔ child link in the current system.
  studentId?: string;
  // Set by AuthContext on staff first-login migration: the pending doc id the
  // UID-keyed doc was migrated from (firestore.rules verifies it via get()).
  migratedFrom?: string;
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
  emisId?: string;
  name: string;
  nameTamil?: string;
  previousBalance?: number;
  dob: Date;
  gender: 'male' | 'female' | 'other';
  bloodGroup: string;
  address: string;
  pinCode?: string;
  photo: string;
  classId: string;
  sectionId: string;
  parentIds: string[];
  status: StudentStatus;
  archiveReason?: string;
  // Contact
  phone?: string;
  phoneVerifyStatus?: string;
  email?: string;
  dateOfJoining?: Date;
  // Father details
  fatherName?: string;
  fatherOccupation?: string;
  fatherEducation?: string;
  // Mother details
  motherName?: string;
  motherOccupation?: string;
  motherEducation?: string;
  // Guardian details
  guardianName?: string;
  guardianOccupation?: string;
  // Identity
  aadhaarNumber?: string;
  // Academic
  religion?: string;
  mediumOfInstruction?: string;
  community?: string;
  disabilityGroupName?: string;
  groupCode?: string;
  motherTongue?: string;
  // Transportation
  transportType?: 'out' | 'bus';
  routeId?: string;
  routeName?: string;
  academicYear: string;
  // Optional per-student fee override — e.g. scholarship recipients.
  // When set, `amount` replaces the class fee structure's totalAmount for
  // this student. Bus fees are still added on top (they're route-based).
  feeAdjustment?: {
    amount: number;
    reason?: string;
  };
  // Optional school-wide scholarship (e.g. RTE) — resolved via
  // school.settings.scholarships → amountsByClass[student.classId].
  // feeAdjustment (if set) takes precedence over this.
  scholarshipId?: string;
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

// ── Saturday Override ──
// Per-date plan for a specific Saturday. When absent, the recurring weekly
// Saturday slots from `Timetable.slots` are used as the fallback.
export interface SaturdayOverride {
  status: 'custom' | 'holiday';
  slots: TimetableSlot[]; // empty when status === 'holiday'
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
  saturdayOverrides?: Record<string, SaturdayOverride>; // key: ISO date YYYY-MM-DD
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
  session: AttendanceSession; // morning | afternoon
  subjectId: string;
  teacherId: string;
  academicYear: string;
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
  academicYear: string;
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

// ── Fee Category (legacy shape, kept for old documents) ──
export interface FeeCategory {
  name: string;
  amount: number;
  installments?: FeeInstallment[];
}

export interface FeeInstallment {
  dueDate: Date;
  amount: number;
}

// ── Fee Structure components (runtime shape) ──
export interface TermFee {
  name: string;   // e.g. "Term 1"
  amount: number;
}

export interface AdditionalFee {
  name: string;   // e.g. "Books", "Uniform"
  amount: number;
}

// ── Fee Structure ──
// Trued to the actual runtime document shape written by AdminFees.
// Legacy fields (`type`, `categories`) are optional for old documents.
export interface FeeStructure {
  id: string;
  classId: string;
  academicYear: string;
  terms: TermFee[];
  // Annual extracurricular (ECA) amount, split into monthly slices by the
  // fee engine across `ecaMonths` (default: June–March).
  extracurricular: number;
  // Capitalized month labels (e.g. "June") over which ECA is sliced.
  ecaMonths?: string[];
  // Term-name → due date key ('yyyy-MM-dd'). A term with no due date is
  // NOT yet due (defaulters invisible until the date is set).
  termDueDates?: Record<string, string>;
  additionalFees: AdditionalFee[];
  // Legacy flat bus fee — new pricing comes from the student's bus route.
  busFee: number;
  // Capitalized month labels for which bus fee is charged. May include any
  // calendar month (e.g. April/May).
  busMonths: string[];
  includeBusFee?: boolean;
  totalAmount: number;
  createdAt: Date;
  // denormalized
  className?: string;
  // legacy (pre-redesign documents)
  type?: FeeType.STRUCTURE;
  categories?: FeeCategory[];
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
  receivedBy?: string;
  paidAt: Date;
  academicYear: string;
  createdAt: Date;
  // Local collection-date key ('yyyy-MM-dd'). Stored on every NEW payment;
  // derived from `paidAt` for historical documents. ALL daily/monthly
  // aggregation buckets on this key.
  dateKey?: string;
  // Soft delete — hard deletes are denied by rules. Every aggregate must
  // exclude deleted payments.
  deleted?: boolean;
  // denormalized
  className?: string;
  sectionId?: string;
  sectionName?: string;
  admissionNumber?: string;
  remarks?: string;
  // teacher attribution
  collectedBy?: string;
  collectedByName?: string;
  collectedByEmail?: string;
}

// ── Audit-trail history entry (feePayments/{id}/history, expenses/{id}/history) ──
// Write-once entries paired with each mutation in the same writeBatch.
export interface HistoryEntry<T> {
  action: 'created' | 'edited' | 'deleted';
  // Snapshot of the document BEFORE the mutation (null on create).
  before: Partial<T> | null;
  actorId: string;
  actorName: string;
  at: Date;
}

export type PaymentHistoryEntry = HistoryEntry<FeePayment>;
export type ExpenseHistoryEntry = HistoryEntry<Expense>;

// ── Accounts settings (accounts/settings doc — Principal only) ──
export interface AccountsSettings {
  openingCash: number;
  openingBank: number;
  // Date key ('yyyy-MM-dd'). Balances sum transactions STRICTLY AFTER this day.
  openingAsOf: string;
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
}

export interface ParentDashboardData {
  child: Student;
  todayAttendance: AttendanceRecord[];
  attendancePercentage: number;
  avgGrade: string;
  pendingAssignments: Assignment[];
  pendingFees: number;
}

// ── Report Card: Subject Term Score ──
export interface SubjectTermScore {
  subjectId: string;
  subjectName: string;
  fa: number;           // out of 40
  sa: number;           // raw SA score (input by staff)
  saMax: number;        // SA maximum marks (default 60, flexible)
  saNormalized: number; // SA normalized to 60
  total: number;        // FA + SA_normalized (out of 100)
  grade: string;        // auto-calculated
}

// ── Report Card: Term Summary ──
export interface TermSummary {
  term: ExamTerm;
  subjectScores: SubjectTermScore[];
  termTotal: number;        // sum of all subject totals
  maxTotal: number;         // subjects * 100
  average: number;          // percentage
  grade: string;            // overall term grade
  rank?: number;            // class rank
}

// ── Report Card: Co-Scholastic Record ──
export interface CoScholasticRecord {
  area: CoScholasticArea;
  grades: Partial<Record<ExamTerm, string>>; // grade per term (A/B/C/D/E)
}

// ── Report Card: Attendance per Term ──
export interface AttendanceTermRecord {
  term: ExamTerm;
  daysPresent: number;
  totalWorkingDays: number;
}

// ── Report Card: Signature ──
export interface SignatureRecord {
  classTeacher: string;
  principal: string;
  parent: string;
}

// ── Bus Route ──
export interface BusRoute extends Timestamps {
  id: string;
  routeName: string;
  fee: number;
  stops?: string[];
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
}

// ── Report Card (per student per academic year) ──
export interface ReportCard extends Timestamps {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  sectionId: string;
  academicYear: string;
  // Term data
  terms: Partial<Record<ExamTerm, TermSummary>>;
  // Co-scholastic
  coScholastic: CoScholasticRecord[];
  // Attendance
  attendance: AttendanceTermRecord[];
  // Remarks per term
  remarks: Partial<Record<ExamTerm, string>>;
  // Signatures
  signatures: Partial<Record<ExamTerm, SignatureRecord>>;
  // Status
  status: 'draft' | 'published';
  // Denormalized
  className?: string;
  sectionName?: string;
}

export interface AssessmentSession {
  id: string;
  schoolId: string;
  type: 'weekly' | 'monthly' | 'term';
  name: string;
  month?: MonthlyExam;
  week?: string;
  term?: ExamTerm;
  academicTerm?: string;
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  status: 'open' | 'closed' | 'published';
  maxMarks: number;
  subjects: { id: string; name: string }[];
  academicYear: string;
  createdBy: string;
  // Firestore Timestamp at rest; normalized to Date by firestore-service reads.
  createdAt: unknown;
}

// ── Expense (school-side outflows — entry is Principal-only) ──
export interface Expense extends Timestamps {
  id: string;
  amount: number;
  category: string;      // free text e.g. "Stationery", "Repairs", "Utilities"
  description: string;
  date: string;          // YYYY-MM-DD
  addedById: string;
  addedByName: string;
  addedByRole: string;   // 'admin' | 'teacher' | 'principal' | 'correspondent'
  academicYear: string;
  // Required on new entries; historical expenses without it default to 'cash'.
  paymentMode?: 'cash' | 'bank';
  // Local date key ('yyyy-MM-dd') for daily/monthly bucketing; derived from
  // `date` for historical documents.
  dateKey?: string;
  // Soft delete — balance sheet excludes deleted expenses.
  deleted?: boolean;
}

// ── Class Test ──
// A single test created by a teacher for one class/section/subject.
// Multiple tests can exist per subject (e.g. "Spelling Test 1", "Chapter 3 Test").
export interface ClassTestRecord {
  studentId: string;
  studentName: string;
  marksObtained: number | null; // null when not yet entered or absent
  remarks?: string;
}

export interface ClassTest extends Timestamps {
  id: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  testName: string;
  testDate: string;          // YYYY-MM-DD
  maxMarks: number;
  academicYear: string;
  records: ClassTestRecord[];
  // denormalized
  className?: string;
  sectionName?: string;
}

export interface WeeklyTest {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  month: string; // e.g., "june"
  academicYear: string;
  weeks: {
    W1?: number;
    W2?: number;
    W3?: number;
    W4?: number;
  };
  // Firestore Timestamp at rest; normalized to Date by firestore-service reads.
  updatedAt: unknown;
}
