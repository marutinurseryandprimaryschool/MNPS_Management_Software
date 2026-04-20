import { UserRole, StudentStatus, TeacherStatus, TimetableStatus, AttendanceStatus, MarksStatus, PaymentMode, FeeType, DayOfWeek, SchoolPlan, AssignmentStatus, NotificationType } from '@/types/enums';
import { User, School, Student, Teacher, Class, Timetable, Attendance, Marks, Assignment, Material, FeeStructure, FeePayment, Chat, Notification, AdminDashboardStats } from '@/types/models';

/* ============================================
   CampusOS — Demo Data
   Comprehensive seed data for all modules
   ============================================ */

// ── Demo Users ──
export const DEMO_USERS: Record<UserRole, User> = {
  [UserRole.ADMIN]: {
    id: 'user_admin_001',
    uid: 'auth_admin_001',
    role: UserRole.ADMIN,
    name: 'Priya Sharma',
    email: 'admin@campusos.demo',
    phone: '+91 98765 43210',
    photo: '',
    status: 'active',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-04-01'),
  },
  [UserRole.PRINCIPAL]: {
    id: 'user_principal_001',
    uid: 'auth_principal_001',
    role: UserRole.PRINCIPAL,
    name: 'Dr. Aravind Swamy',
    email: 'principal@campusos.demo',
    phone: '+91 98765 43208',
    photo: '',
    status: 'active',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-04-01'),
  },
  [UserRole.CORRESPONDENT]: {
    id: 'user_correspondent_001',
    uid: 'auth_correspondent_001',
    role: UserRole.CORRESPONDENT,
    name: 'Mrs. Lakshmi Rajan',
    email: 'correspondent@campusos.demo',
    phone: '+91 98765 43209',
    photo: '',
    status: 'active',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-04-01'),
  },
  [UserRole.TEACHER]: {
    id: 'user_teacher_001',
    uid: 'auth_teacher_001',
    role: UserRole.TEACHER,
    name: 'Rajesh Kumar',
    email: 'teacher@campusos.demo',
    phone: '+91 98765 43211',
    photo: '',
    status: 'active',
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-04-01'),
  },
  [UserRole.PARENT]: {
    id: 'user_parent_001',
    uid: 'auth_parent_001',
    role: UserRole.PARENT,
    name: 'Meena Devi',
    email: 'parent@campusos.demo',
    phone: '+91 98765 43212',
    photo: '',
    status: 'active',
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-04-01'),
  },
};

// ── Demo School ──
export const DEMO_SCHOOL: School = {
  id: 'school_demo_001',
  name: 'AJK School',
  address: '123 Education Lane, Bangalore, Karnataka 560001',
  phone: '+91 80 2345 6789',
  email: 'info@ajkschool.edu.in',
  logo: '',
  academicYear: '2026-27',
  plan: SchoolPlan.STANDARD,
  settings: {
    admissionPrefix: 'GIS',
    periodsPerDay: 8,
    schoolDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY],
    periodTimings: [
      { period: 1, start: '08:30', end: '09:15' },
      { period: 2, start: '09:15', end: '10:00' },
      { type: 'break', label: 'Short Break', start: '10:00', end: '10:20' },
      { period: 3, start: '10:20', end: '11:05' },
      { period: 4, start: '11:05', end: '11:50' },
      { type: 'lunch', label: 'Lunch Break', start: '11:50', end: '12:30' },
      { period: 5, start: '12:30', end: '13:15' },
      { period: 6, start: '13:15', end: '14:00' },
      { period: 7, start: '14:00', end: '14:45' },
      { period: 8, start: '14:45', end: '15:30' },
    ],
    gradeScale: [
      { grade: 'A+', min: 90, max: 100 },
      { grade: 'A', min: 80, max: 89 },
      { grade: 'B+', min: 70, max: 79 },
      { grade: 'B', min: 60, max: 69 },
      { grade: 'C+', min: 50, max: 59 },
      { grade: 'C', min: 40, max: 49 },
      { grade: 'D', min: 30, max: 39 },
      { grade: 'F', min: 0, max: 29 },
    ],
    maxPeriodsPerTeacherPerDay: 6,
    maxConsecutivePeriods: 3,
  },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-04-01'),
};

// ── Demo Classes ──
export const DEMO_CLASSES: Class[] = [
  {
    id: 'class_001', name: 'Class 1', order: 1, academicYear: '2026-27',
    sections: [
      { id: 'sec_1a', name: 'A', classTeacherId: 'teacher_003', maxCapacity: 40 },
      { id: 'sec_1b', name: 'B', classTeacherId: 'teacher_004', maxCapacity: 40 },
    ],
    subjects: [
      { id: 'sub_eng', name: 'English', code: 'ENG', weeklyPeriods: 6 },
      { id: 'sub_math', name: 'Mathematics', code: 'MATH', weeklyPeriods: 6 },
      { id: 'sub_evs', name: 'EVS', code: 'EVS', weeklyPeriods: 4 },
      { id: 'sub_hindi', name: 'Hindi', code: 'HIN', weeklyPeriods: 5 },
    ],
  },
  {
    id: 'class_005', name: 'Class 5', order: 5, academicYear: '2026-27',
    sections: [
      { id: 'sec_5a', name: 'A', classTeacherId: 'teacher_001', maxCapacity: 45 },
      { id: 'sec_5b', name: 'B', classTeacherId: 'teacher_005', maxCapacity: 45 },
    ],
    subjects: [
      { id: 'sub_eng', name: 'English', code: 'ENG', weeklyPeriods: 6 },
      { id: 'sub_math', name: 'Mathematics', code: 'MATH', weeklyPeriods: 6 },
      { id: 'sub_sci', name: 'Science', code: 'SCI', weeklyPeriods: 5 },
      { id: 'sub_social', name: 'Social Studies', code: 'SST', weeklyPeriods: 4 },
      { id: 'sub_hindi', name: 'Hindi', code: 'HIN', weeklyPeriods: 5 },
      { id: 'sub_cs', name: 'Computer Science', code: 'CS', weeklyPeriods: 2 },
      { id: 'sub_pe', name: 'Physical Education', code: 'PE', weeklyPeriods: 2 },
      { id: 'sub_art', name: 'Art', code: 'ART', weeklyPeriods: 2 },
    ],
  },
  {
    id: 'class_008', name: 'Class 8', order: 8, academicYear: '2026-27',
    sections: [
      { id: 'sec_8a', name: 'A', classTeacherId: 'teacher_002', maxCapacity: 45 },
      { id: 'sec_8b', name: 'B', classTeacherId: 'teacher_006', maxCapacity: 45 },
    ],
    subjects: [
      { id: 'sub_eng', name: 'English', code: 'ENG', weeklyPeriods: 5 },
      { id: 'sub_math', name: 'Mathematics', code: 'MATH', weeklyPeriods: 6 },
      { id: 'sub_sci', name: 'Science', code: 'SCI', weeklyPeriods: 6 },
      { id: 'sub_social', name: 'Social Studies', code: 'SST', weeklyPeriods: 4 },
      { id: 'sub_hindi', name: 'Hindi', code: 'HIN', weeklyPeriods: 4 },
      { id: 'sub_cs', name: 'Computer Science', code: 'CS', weeklyPeriods: 3 },
      { id: 'sub_pe', name: 'Physical Education', code: 'PE', weeklyPeriods: 2 },
    ],
  },
  {
    id: 'class_010', name: 'Class 10', order: 10, academicYear: '2026-27',
    sections: [
      { id: 'sec_10a', name: 'A', classTeacherId: 'teacher_001', maxCapacity: 40 },
      { id: 'sec_10b', name: 'B', classTeacherId: 'teacher_007', maxCapacity: 40 },
    ],
    subjects: [
      { id: 'sub_eng', name: 'English', code: 'ENG', weeklyPeriods: 5 },
      { id: 'sub_math', name: 'Mathematics', code: 'MATH', weeklyPeriods: 6 },
      { id: 'sub_sci', name: 'Science', code: 'SCI', weeklyPeriods: 7 },
      { id: 'sub_social', name: 'Social Studies', code: 'SST', weeklyPeriods: 5 },
      { id: 'sub_hindi', name: 'Hindi', code: 'HIN', weeklyPeriods: 4 },
      { id: 'sub_cs', name: 'Computer Science', code: 'CS', weeklyPeriods: 3 },
    ],
  },
];

// ── Demo Students ──
const studentNames = [
  'Arun Kumar', 'Divya Sharma', 'Karthik R.', 'Lakshmi S.', 'Mohammed Irfan',
  'Priya Patel', 'Rahul Mehta', 'Sneha Reddy', 'Vikram Singh', 'Ananya Nair',
  'Arjun Menon', 'Deepa Krishnan', 'Gopal Verma', 'Ishita Gupta', 'Jai Prakash',
  'Kavitha M.', 'Manoj T.', 'Neha Joshi', 'Om Prakash', 'Pooja Yadav',
  'Ravi Shankar', 'Sita Devi', 'Tanvi Agarwal', 'Uma Mahesh', 'Varun Kapoor',
  'Waseema K.', 'Yash Pandey', 'Zara Khan', 'Aarav Jain', 'Bhavya Srinivasan',
  'Chirag Malhotra', 'Disha Banerjee', 'Eshan Roy', 'Fatima Begum', 'Gaurav Tiwari',
  'Harini N.', 'Ishan Desai', 'Jaya Lakshmi', 'Krishna P.', 'Lavanya M.',
];

export const DEMO_STUDENTS: Student[] = studentNames.map((name, i) => ({
  id: `student_${String(i + 1).padStart(3, '0')}`,
  admissionNumber: `GIS-2026-${String(i + 1).padStart(4, '0')}`,
  name,
  dob: new Date(2014 + Math.floor(i / 10), (i * 3) % 12, (i * 7 + 5) % 28 + 1),
  gender: i % 3 === 0 ? 'female' : 'male' as const,
  bloodGroup: ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-'][i % 6],
  address: `${100 + i} MG Road, Bangalore, Karnataka`,
  photo: '',
  classId: i < 10 ? 'class_005' : i < 20 ? 'class_008' : i < 30 ? 'class_010' : 'class_001',
  sectionId: i % 2 === 0
    ? (i < 10 ? 'sec_5a' : i < 20 ? 'sec_8a' : i < 30 ? 'sec_10a' : 'sec_1a')
    : (i < 10 ? 'sec_5b' : i < 20 ? 'sec_8b' : i < 30 ? 'sec_10b' : 'sec_1b'),
  parentIds: [`user_parent_${String(i + 1).padStart(3, '0')}`],
  status: StudentStatus.ACTIVE,
  className: i < 10 ? 'Class 5' : i < 20 ? 'Class 8' : i < 30 ? 'Class 10' : 'Class 1',
  sectionName: i % 2 === 0 ? 'A' : 'B',
  createdAt: new Date('2026-03-15'),
  updatedAt: new Date('2026-04-01'),
}));

// ── Demo Teachers ──
export const DEMO_TEACHERS: Teacher[] = [
  {
    id: 'teacher_001', userId: 'user_teacher_001', employeeId: 'EMP001',
    name: 'Rajesh Kumar', email: 'rajesh@ajkschool.edu.in', phone: '+91 98765 43211', photo: '',
    subjects: ['sub_math'], subjectNames: ['Mathematics'],
    assignedClasses: [
      { classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_math', isClassTeacher: true, className: 'Class 5', sectionName: 'A', subjectName: 'Mathematics' },
      { classId: 'class_008', sectionId: 'sec_8a', subjectId: 'sub_math', isClassTeacher: false, className: 'Class 8', sectionName: 'A', subjectName: 'Mathematics' },
      { classId: 'class_010', sectionId: 'sec_10a', subjectId: 'sub_math', isClassTeacher: false, className: 'Class 10', sectionName: 'A', subjectName: 'Mathematics' },
    ],
    availability: {
      [DayOfWeek.MONDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: false },
      [DayOfWeek.TUESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.WEDNESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: false, 8: false },
      [DayOfWeek.THURSDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.FRIDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.SATURDAY]: { 1: true, 2: true, 3: true, 4: true, 5: false, 6: false, 7: false, 8: false },
    },
    status: TeacherStatus.ACTIVE, createdAt: new Date('2026-01-15'), updatedAt: new Date('2026-04-01'),
  },
  {
    id: 'teacher_002', userId: 'user_teacher_002', employeeId: 'EMP002',
    name: 'Preeti Nair', email: 'preeti@ajkschool.edu.in', phone: '+91 98765 43213', photo: '',
    subjects: ['sub_eng'], subjectNames: ['English'],
    assignedClasses: [
      { classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_eng', isClassTeacher: false, className: 'Class 5', sectionName: 'A', subjectName: 'English' },
      { classId: 'class_008', sectionId: 'sec_8a', subjectId: 'sub_eng', isClassTeacher: true, className: 'Class 8', sectionName: 'A', subjectName: 'English' },
    ],
    availability: {
      [DayOfWeek.MONDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.TUESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.WEDNESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.THURSDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.FRIDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.SATURDAY]: { 1: true, 2: true, 3: true, 4: false, 5: false, 6: false, 7: false, 8: false },
    },
    status: TeacherStatus.ACTIVE, createdAt: new Date('2026-01-15'), updatedAt: new Date('2026-04-01'),
  },
  {
    id: 'teacher_003', userId: 'user_teacher_003', employeeId: 'EMP003',
    name: 'Rajan M.', email: 'rajan@ajkschool.edu.in', phone: '+91 98765 43214', photo: '',
    subjects: ['sub_sci'], subjectNames: ['Science'],
    assignedClasses: [
      { classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_sci', isClassTeacher: false, className: 'Class 5', sectionName: 'A', subjectName: 'Science' },
      { classId: 'class_008', sectionId: 'sec_8a', subjectId: 'sub_sci', isClassTeacher: false, className: 'Class 8', sectionName: 'A', subjectName: 'Science' },
      { classId: 'class_010', sectionId: 'sec_10a', subjectId: 'sub_sci', isClassTeacher: false, className: 'Class 10', sectionName: 'A', subjectName: 'Science' },
    ],
    availability: {
      [DayOfWeek.MONDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.TUESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.WEDNESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.THURSDAY]: { 1: false, 2: false, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.FRIDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.SATURDAY]: { 1: true, 2: true, 3: true, 4: true, 5: false, 6: false, 7: false, 8: false },
    },
    status: TeacherStatus.ACTIVE, createdAt: new Date('2026-01-15'), updatedAt: new Date('2026-04-01'),
  },
  {
    id: 'teacher_004', userId: 'user_teacher_004', employeeId: 'EMP004',
    name: 'Deepa Menon', email: 'deepa@ajkschool.edu.in', phone: '+91 98765 43215', photo: '',
    subjects: ['sub_hindi'], subjectNames: ['Hindi'],
    assignedClasses: [
      { classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_hindi', isClassTeacher: false, className: 'Class 5', sectionName: 'A', subjectName: 'Hindi' },
      { classId: 'class_008', sectionId: 'sec_8a', subjectId: 'sub_hindi', isClassTeacher: false, className: 'Class 8', sectionName: 'A', subjectName: 'Hindi' },
    ],
    availability: {
      [DayOfWeek.MONDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.TUESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.WEDNESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.THURSDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.FRIDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.SATURDAY]: { 1: true, 2: true, 3: true, 4: true, 5: false, 6: false, 7: false, 8: false },
    },
    status: TeacherStatus.ACTIVE, createdAt: new Date('2026-02-01'), updatedAt: new Date('2026-04-01'),
  },
  {
    id: 'teacher_005', userId: 'user_teacher_005', employeeId: 'EMP005',
    name: 'Suresh Babu', email: 'suresh@ajkschool.edu.in', phone: '+91 98765 43216', photo: '',
    subjects: ['sub_social'], subjectNames: ['Social Studies'],
    assignedClasses: [
      { classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_social', isClassTeacher: false, className: 'Class 5', sectionName: 'A', subjectName: 'Social Studies' },
      { classId: 'class_010', sectionId: 'sec_10a', subjectId: 'sub_social', isClassTeacher: false, className: 'Class 10', sectionName: 'A', subjectName: 'Social Studies' },
    ],
    availability: {
      [DayOfWeek.MONDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.TUESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.WEDNESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.THURSDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.FRIDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.SATURDAY]: { 1: true, 2: true, 3: true, 4: true, 5: false, 6: false, 7: false, 8: false },
    },
    status: TeacherStatus.ACTIVE, createdAt: new Date('2026-02-01'), updatedAt: new Date('2026-04-01'),
  },
  {
    id: 'teacher_006', userId: 'user_teacher_006', employeeId: 'EMP006',
    name: 'Anitha R.', email: 'anitha@ajkschool.edu.in', phone: '+91 98765 43217', photo: '',
    subjects: ['sub_cs'], subjectNames: ['Computer Science'],
    assignedClasses: [
      { classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_cs', isClassTeacher: false, className: 'Class 5', sectionName: 'A', subjectName: 'Computer Science' },
      { classId: 'class_008', sectionId: 'sec_8a', subjectId: 'sub_cs', isClassTeacher: false, className: 'Class 8', sectionName: 'A', subjectName: 'Computer Science' },
    ],
    availability: {
      [DayOfWeek.MONDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.TUESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.WEDNESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.THURSDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.FRIDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.SATURDAY]: { 1: true, 2: true, 3: true, 4: true, 5: false, 6: false, 7: false, 8: false },
    },
    status: TeacherStatus.ACTIVE, createdAt: new Date('2026-02-01'), updatedAt: new Date('2026-04-01'),
  },
  {
    id: 'teacher_007', userId: 'user_teacher_007', employeeId: 'EMP007',
    name: 'Vijay S.', email: 'vijay@ajkschool.edu.in', phone: '+91 98765 43218', photo: '',
    subjects: ['sub_pe', 'sub_art'], subjectNames: ['Physical Education', 'Art'],
    assignedClasses: [
      { classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_pe', isClassTeacher: false, className: 'Class 5', sectionName: 'A', subjectName: 'Physical Education' },
      { classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_art', isClassTeacher: false, className: 'Class 5', sectionName: 'A', subjectName: 'Art' },
    ],
    availability: {
      [DayOfWeek.MONDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.TUESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.WEDNESDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.THURSDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.FRIDAY]: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      [DayOfWeek.SATURDAY]: { 1: true, 2: true, 3: true, 4: true, 5: false, 6: false, 7: false, 8: false },
    },
    status: TeacherStatus.ACTIVE, createdAt: new Date('2026-02-01'), updatedAt: new Date('2026-04-01'),
  },
];

// ── Demo Timetable (Class 5-A) ──
export const DEMO_TIMETABLE: Timetable = {
  id: 'tt_001',
  classId: 'class_005',
  sectionId: 'sec_5a',
  className: 'Class 5',
  sectionName: 'A',
  academicYear: '2026-27',
  version: 1,
  status: TimetableStatus.PUBLISHED,
  effectiveFrom: new Date('2026-04-01'),
  createdBy: 'user_admin_001',
  slots: [
    // Monday
    { day: DayOfWeek.MONDAY, period: 1, subjectId: 'sub_math', subjectName: 'Mathematics', teacherId: 'teacher_001', teacherName: 'Rajesh Kumar' },
    { day: DayOfWeek.MONDAY, period: 2, subjectId: 'sub_eng', subjectName: 'English', teacherId: 'teacher_002', teacherName: 'Preeti Nair' },
    { day: DayOfWeek.MONDAY, period: 3, subjectId: 'sub_sci', subjectName: 'Science', teacherId: 'teacher_003', teacherName: 'Rajan M.' },
    { day: DayOfWeek.MONDAY, period: 4, subjectId: 'sub_hindi', subjectName: 'Hindi', teacherId: 'teacher_004', teacherName: 'Deepa Menon' },
    { day: DayOfWeek.MONDAY, period: 5, subjectId: 'sub_social', subjectName: 'Social Studies', teacherId: 'teacher_005', teacherName: 'Suresh Babu' },
    { day: DayOfWeek.MONDAY, period: 6, subjectId: 'sub_cs', subjectName: 'Computer Science', teacherId: 'teacher_006', teacherName: 'Anitha R.' },
    { day: DayOfWeek.MONDAY, period: 7, subjectId: 'sub_pe', subjectName: 'Physical Education', teacherId: 'teacher_007', teacherName: 'Vijay S.' },
    { day: DayOfWeek.MONDAY, period: 8, subjectId: 'sub_art', subjectName: 'Art', teacherId: 'teacher_007', teacherName: 'Vijay S.' },
    // Tuesday
    { day: DayOfWeek.TUESDAY, period: 1, subjectId: 'sub_eng', subjectName: 'English', teacherId: 'teacher_002', teacherName: 'Preeti Nair' },
    { day: DayOfWeek.TUESDAY, period: 2, subjectId: 'sub_math', subjectName: 'Mathematics', teacherId: 'teacher_001', teacherName: 'Rajesh Kumar' },
    { day: DayOfWeek.TUESDAY, period: 3, subjectId: 'sub_hindi', subjectName: 'Hindi', teacherId: 'teacher_004', teacherName: 'Deepa Menon' },
    { day: DayOfWeek.TUESDAY, period: 4, subjectId: 'sub_sci', subjectName: 'Science', teacherId: 'teacher_003', teacherName: 'Rajan M.' },
    { day: DayOfWeek.TUESDAY, period: 5, subjectId: 'sub_math', subjectName: 'Mathematics', teacherId: 'teacher_001', teacherName: 'Rajesh Kumar' },
    { day: DayOfWeek.TUESDAY, period: 6, subjectId: 'sub_social', subjectName: 'Social Studies', teacherId: 'teacher_005', teacherName: 'Suresh Babu' },
    { day: DayOfWeek.TUESDAY, period: 7, subjectId: 'sub_eng', subjectName: 'English', teacherId: 'teacher_002', teacherName: 'Preeti Nair' },
    { day: DayOfWeek.TUESDAY, period: 8, subjectId: 'sub_hindi', subjectName: 'Hindi', teacherId: 'teacher_004', teacherName: 'Deepa Menon' },
    // Wednesday
    { day: DayOfWeek.WEDNESDAY, period: 1, subjectId: 'sub_sci', subjectName: 'Science', teacherId: 'teacher_003', teacherName: 'Rajan M.' },
    { day: DayOfWeek.WEDNESDAY, period: 2, subjectId: 'sub_math', subjectName: 'Mathematics', teacherId: 'teacher_001', teacherName: 'Rajesh Kumar' },
    { day: DayOfWeek.WEDNESDAY, period: 3, subjectId: 'sub_eng', subjectName: 'English', teacherId: 'teacher_002', teacherName: 'Preeti Nair' },
    { day: DayOfWeek.WEDNESDAY, period: 4, subjectId: 'sub_social', subjectName: 'Social Studies', teacherId: 'teacher_005', teacherName: 'Suresh Babu' },
    { day: DayOfWeek.WEDNESDAY, period: 5, subjectId: 'sub_hindi', subjectName: 'Hindi', teacherId: 'teacher_004', teacherName: 'Deepa Menon' },
    { day: DayOfWeek.WEDNESDAY, period: 6, subjectId: 'sub_sci', subjectName: 'Science', teacherId: 'teacher_003', teacherName: 'Rajan M.' },
    { day: DayOfWeek.WEDNESDAY, period: 7, subjectId: 'sub_pe', subjectName: 'Physical Education', teacherId: 'teacher_007', teacherName: 'Vijay S.' },
    { day: DayOfWeek.WEDNESDAY, period: 8, subjectId: 'sub_cs', subjectName: 'Computer Science', teacherId: 'teacher_006', teacherName: 'Anitha R.' },
    // Thursday
    { day: DayOfWeek.THURSDAY, period: 1, subjectId: 'sub_math', subjectName: 'Mathematics', teacherId: 'teacher_001', teacherName: 'Rajesh Kumar' },
    { day: DayOfWeek.THURSDAY, period: 2, subjectId: 'sub_eng', subjectName: 'English', teacherId: 'teacher_002', teacherName: 'Preeti Nair' },
    { day: DayOfWeek.THURSDAY, period: 3, subjectId: 'sub_sci', subjectName: 'Science', teacherId: 'teacher_003', teacherName: 'Rajan M.' },
    { day: DayOfWeek.THURSDAY, period: 4, subjectId: 'sub_hindi', subjectName: 'Hindi', teacherId: 'teacher_004', teacherName: 'Deepa Menon' },
    { day: DayOfWeek.THURSDAY, period: 5, subjectId: 'sub_math', subjectName: 'Mathematics', teacherId: 'teacher_001', teacherName: 'Rajesh Kumar' },
    { day: DayOfWeek.THURSDAY, period: 6, subjectId: 'sub_eng', subjectName: 'English', teacherId: 'teacher_002', teacherName: 'Preeti Nair' },
    { day: DayOfWeek.THURSDAY, period: 7, subjectId: 'sub_social', subjectName: 'Social Studies', teacherId: 'teacher_005', teacherName: 'Suresh Babu' },
    { day: DayOfWeek.THURSDAY, period: 8, subjectId: 'sub_art', subjectName: 'Art', teacherId: 'teacher_007', teacherName: 'Vijay S.' },
    // Friday
    { day: DayOfWeek.FRIDAY, period: 1, subjectId: 'sub_hindi', subjectName: 'Hindi', teacherId: 'teacher_004', teacherName: 'Deepa Menon' },
    { day: DayOfWeek.FRIDAY, period: 2, subjectId: 'sub_math', subjectName: 'Mathematics', teacherId: 'teacher_001', teacherName: 'Rajesh Kumar' },
    { day: DayOfWeek.FRIDAY, period: 3, subjectId: 'sub_eng', subjectName: 'English', teacherId: 'teacher_002', teacherName: 'Preeti Nair' },
    { day: DayOfWeek.FRIDAY, period: 4, subjectId: 'sub_sci', subjectName: 'Science', teacherId: 'teacher_003', teacherName: 'Rajan M.' },
    { day: DayOfWeek.FRIDAY, period: 5, subjectId: 'sub_social', subjectName: 'Social Studies', teacherId: 'teacher_005', teacherName: 'Suresh Babu' },
    { day: DayOfWeek.FRIDAY, period: 6, subjectId: 'sub_math', subjectName: 'Mathematics', teacherId: 'teacher_001', teacherName: 'Rajesh Kumar' },
    { day: DayOfWeek.FRIDAY, period: 7, subjectId: 'sub_hindi', subjectName: 'Hindi', teacherId: 'teacher_004', teacherName: 'Deepa Menon' },
    { day: DayOfWeek.FRIDAY, period: 8, subjectId: 'sub_cs', subjectName: 'Computer Science', teacherId: 'teacher_006', teacherName: 'Anitha R.' },
    // Saturday (half day)
    { day: DayOfWeek.SATURDAY, period: 1, subjectId: 'sub_eng', subjectName: 'English', teacherId: 'teacher_002', teacherName: 'Preeti Nair' },
    { day: DayOfWeek.SATURDAY, period: 2, subjectId: 'sub_sci', subjectName: 'Science', teacherId: 'teacher_003', teacherName: 'Rajan M.' },
    { day: DayOfWeek.SATURDAY, period: 3, subjectId: 'sub_math', subjectName: 'Mathematics', teacherId: 'teacher_001', teacherName: 'Rajesh Kumar' },
    { day: DayOfWeek.SATURDAY, period: 4, subjectId: 'sub_hindi', subjectName: 'Hindi', teacherId: 'teacher_004', teacherName: 'Deepa Menon' },
  ],
  createdAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-01'),
};

// ── Demo Attendance (Today, Class 5-A, Period 1) ──
export const DEMO_ATTENDANCE: Attendance[] = [
  {
    id: 'att_001',
    date: new Date().toISOString().split('T')[0],
    classId: 'class_005', sectionId: 'sec_5a', period: 1,
    subjectId: 'sub_math', teacherId: 'teacher_001',
    className: 'Class 5', sectionName: 'A', subjectName: 'Mathematics', teacherName: 'Rajesh Kumar',
    records: DEMO_STUDENTS.filter(s => s.classId === 'class_005' && s.sectionId === 'sec_5a').map((s, i) => ({
      studentId: s.id, studentName: s.name,
      status: i === 2 || i === 4 ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT,
    })),
    submittedAt: new Date(),
  },
];

// ── Demo Marks ──
export const DEMO_MARKS: Marks[] = [
  {
    id: 'marks_001',
    examType: 'midterm', examName: 'Mid-Term Examination 2026',
    classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_math', teacherId: 'teacher_001',
    maxMarks: 100,
    className: 'Class 5', sectionName: 'A', subjectName: 'Mathematics',
    records: DEMO_STUDENTS.filter(s => s.classId === 'class_005' && s.sectionId === 'sec_5a').map(s => {
      const marks = Math.floor(Math.random() * 40) + 60;
      return {
        studentId: s.id, studentName: s.name,
        marksObtained: marks,
        grade: marks >= 90 ? 'A+' : marks >= 80 ? 'A' : marks >= 70 ? 'B+' : marks >= 60 ? 'B' : 'C+',
      };
    }),
    status: MarksStatus.PUBLISHED,
    createdAt: new Date('2026-03-15'),
    publishedAt: new Date('2026-03-20'),
  },
];

// ── Demo Assignments ──
export const DEMO_ASSIGNMENTS: Assignment[] = [
  {
    id: 'assign_001', title: 'Mathematics Worksheet — Fractions', description: 'Complete exercises 1-20 from chapter 5. Show all working steps.',
    classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_math', teacherId: 'teacher_001',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    attachments: [],
    status: AssignmentStatus.ACTIVE,
    className: 'Class 5', sectionName: 'A', subjectName: 'Mathematics', teacherName: 'Rajesh Kumar',
    createdAt: new Date('2026-04-11'), updatedAt: new Date('2026-04-11'),
  },
  {
    id: 'assign_002', title: 'English Essay — My Favorite Season', description: 'Write a 300-word essay on your favorite season. Include descriptive language.',
    classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_eng', teacherId: 'teacher_002',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    attachments: [],
    status: AssignmentStatus.ACTIVE,
    className: 'Class 5', sectionName: 'A', subjectName: 'English', teacherName: 'Preeti Nair',
    createdAt: new Date('2026-04-10'), updatedAt: new Date('2026-04-10'),
  },
  {
    id: 'assign_003', title: 'Science Project — Solar System Model', description: 'Create a 3D model of the solar system using household materials.',
    classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_sci', teacherId: 'teacher_003',
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    attachments: [],
    status: AssignmentStatus.ACTIVE,
    className: 'Class 5', sectionName: 'A', subjectName: 'Science', teacherName: 'Rajan M.',
    createdAt: new Date('2026-04-08'), updatedAt: new Date('2026-04-08'),
  },
];

// ── Demo Materials ──
export const DEMO_MATERIALS: Material[] = [
  {
    id: 'mat_001', title: 'Chapter 5 — Fractions Notes', description: 'Comprehensive notes on fractions, practice problems included.',
    classId: 'class_005', sectionId: 'sec_5a', subjectId: 'sub_math', teacherId: 'teacher_001',
    files: [{ name: 'Fractions_Notes.pdf', url: '#', size: 2500000 }],
    className: 'Class 5', sectionName: 'A', subjectName: 'Mathematics', teacherName: 'Rajesh Kumar',
    createdAt: new Date('2026-04-05'), updatedAt: new Date('2026-04-05'),
  },
];

// ── Demo Fee Structure ──
export const DEMO_FEE_STRUCTURES: FeeStructure[] = [
  {
    id: 'fee_struct_001', type: FeeType.STRUCTURE,
    classId: 'class_005', academicYear: '2026-27', className: 'Class 5',
    categories: [
      { name: 'Tuition Fee', amount: 30000, installments: [
        { dueDate: new Date('2026-04-30'), amount: 10000 },
        { dueDate: new Date('2026-08-31'), amount: 10000 },
        { dueDate: new Date('2026-12-31'), amount: 10000 },
      ]},
      { name: 'Transport Fee', amount: 12000, installments: [
        { dueDate: new Date('2026-04-30'), amount: 4000 },
        { dueDate: new Date('2026-08-31'), amount: 4000 },
        { dueDate: new Date('2026-12-31'), amount: 4000 },
      ]},
      { name: 'Lab Fee', amount: 3000 },
      { name: 'Library Fee', amount: 1500 },
      { name: 'Activity Fee', amount: 2000 },
    ],
    totalAmount: 48500,
    createdAt: new Date('2026-03-01'),
  },
];

// ── Demo Payments ──
export const DEMO_PAYMENTS: FeePayment[] = [
  {
    id: 'pay_001', type: FeeType.PAYMENT,
    studentId: 'student_001', studentName: 'Arun Kumar', classId: 'class_005', className: 'Class 5',
    amount: 14000, mode: PaymentMode.UPI, referenceNumber: 'UPI-20260401-001',
    receiptNumber: 'RCP-20260401-A1B2', category: 'Tuition Fee + Lab Fee',
    receivedBy: 'user_admin_001', paidAt: new Date('2026-04-01'), createdAt: new Date('2026-04-01'),
  },
  {
    id: 'pay_002', type: FeeType.PAYMENT,
    studentId: 'student_003', studentName: 'Karthik R.', classId: 'class_005', className: 'Class 5',
    amount: 10000, mode: PaymentMode.CASH, referenceNumber: '',
    receiptNumber: 'RCP-20260405-C3D4', category: 'Tuition Fee',
    receivedBy: 'user_admin_001', paidAt: new Date('2026-04-05'), createdAt: new Date('2026-04-05'),
  },
  {
    id: 'pay_003', type: FeeType.PAYMENT,
    studentId: 'student_005', studentName: 'Mohammed Irfan', classId: 'class_005', className: 'Class 5',
    amount: 48500, mode: PaymentMode.BANK_TRANSFER, referenceNumber: 'NEFT-20260408-1234',
    receiptNumber: 'RCP-20260408-E5F6', category: 'Full Year',
    receivedBy: 'user_admin_001', paidAt: new Date('2026-04-08'), createdAt: new Date('2026-04-08'),
  },
];

// ── Demo Chats ──
export const DEMO_CHATS: Chat[] = [
  {
    id: 'chat_001',
    participants: ['user_teacher_001', 'user_parent_001'],
    participantNames: { 'user_teacher_001': 'Rajesh Kumar', 'user_parent_001': 'Meena Devi' },
    participantRoles: { 'user_teacher_001': 'teacher', 'user_parent_001': 'parent' },
    lastMessage: {
      text: 'Arjun is doing well in Mathematics. Keep up the practice at home.',
      senderId: 'user_teacher_001',
      sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    unreadCount: { 'user_teacher_001': 0, 'user_parent_001': 1 },
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'chat_002',
    participants: ['user_teacher_002', 'user_parent_001'],
    participantNames: { 'user_teacher_002': 'Preeti Nair', 'user_parent_001': 'Meena Devi' },
    participantRoles: { 'user_teacher_002': 'teacher', 'user_parent_001': 'parent' },
    lastMessage: {
      text: 'Could you share the reading list for this month?',
      senderId: 'user_parent_001',
      sentAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    },
    unreadCount: { 'user_teacher_002': 1, 'user_parent_001': 0 },
    createdAt: new Date('2026-04-05'),
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
];

// ── Demo Notifications ──
export const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif_001', type: NotificationType.FEE_REMINDER,
    title: 'Fee Reminder', body: 'Term 1 fee of ₹10,000 is due on April 30. Please pay before the deadline.',
    targetRole: UserRole.PARENT, targetUsers: [], targetClass: 'class_005',
    data: { screen: 'fees' }, createdBy: 'system', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), readBy: [],
  },
  {
    id: 'notif_002', type: NotificationType.TIMETABLE_CHANGE,
    title: 'Timetable Updated', body: 'Class 5-A timetable has been updated. Please check the new schedule.',
    targetRole: 'all', targetUsers: [], targetClass: 'class_005',
    data: { screen: 'timetable' }, createdBy: 'user_admin_001', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), readBy: ['user_admin_001'],
  },
  {
    id: 'notif_003', type: NotificationType.ATTENDANCE_ALERT,
    title: 'Attendance Alert', body: 'Karthik R. was marked absent in Period 1 (Mathematics) today.',
    targetRole: UserRole.PARENT, targetUsers: ['user_parent_003'], targetClass: 'class_005',
    data: { screen: 'attendance', studentId: 'student_003' }, createdBy: 'system', createdAt: new Date(), readBy: [],
  },
  {
    id: 'notif_004', type: NotificationType.ANNOUNCEMENT,
    title: 'Annual Sports Day', body: 'Annual Sports Day is scheduled for May 15, 2026. All parents are invited to attend.',
    targetRole: 'all', targetUsers: [],
    data: {}, createdBy: 'user_admin_001', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), readBy: [],
  },
  {
    id: 'notif_005', type: NotificationType.ASSIGNMENT_DUE,
    title: 'Assignment Due Soon', body: 'Mathematics Worksheet — Fractions is due in 2 days.',
    targetRole: UserRole.PARENT, targetUsers: [], targetClass: 'class_005',
    data: { screen: 'assignments', assignmentId: 'assign_001' }, createdBy: 'system', createdAt: new Date(), readBy: [],
  },
];

// ── Admin Dashboard Stats ──
export const DEMO_ADMIN_STATS: AdminDashboardStats = {
  totalStudents: 420,
  totalTeachers: 32,
  avgAttendance: 92.3,
  totalFeeCollected: 1840000,
  pendingFees: 560000,
  totalClasses: 12,
};

// ── Attendance Trend Data (last 7 days) ──
export const DEMO_ATTENDANCE_TREND = [
  { day: 'Mon', percentage: 94 },
  { day: 'Tue', percentage: 91 },
  { day: 'Wed', percentage: 93 },
  { day: 'Thu', percentage: 89 },
  { day: 'Fri', percentage: 95 },
  { day: 'Sat', percentage: 88 },
  { day: 'Today', percentage: 92 },
];

// ── Fee Collection by Class ──
export const DEMO_FEE_BY_CLASS = [
  { class: 'Class 1', collected: 280000, target: 350000 },
  { class: 'Class 5', collected: 320000, target: 400000 },
  { class: 'Class 8', collected: 410000, target: 500000 },
  { class: 'Class 10', collected: 380000, target: 420000 },
];

// ── Recent Activity ──
export const DEMO_RECENT_ACTIVITY = [
  { id: 'act_1', text: 'New student Bhavya S. enrolled in Class 5-A', time: '2 hours ago', icon: 'user-plus', color: 'var(--color-success)' },
  { id: 'act_2', text: 'Timetable published for Class 8-A', time: '4 hours ago', icon: 'calendar', color: 'var(--color-primary-500)' },
  { id: 'act_3', text: 'Fee payment of ₹48,500 received from Mohammed Irfan', time: 'Yesterday', icon: 'credit-card', color: 'var(--color-success)' },
  { id: 'act_4', text: 'Rajan M. marked leave for Thursday P1-P2', time: 'Yesterday', icon: 'clock', color: 'var(--color-warning)' },
  { id: 'act_5', text: 'Mid-term marks published for Class 5-A Mathematics', time: '3 days ago', icon: 'bar-chart', color: 'var(--color-info)' },
];
