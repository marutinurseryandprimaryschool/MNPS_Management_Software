import { db } from './firebase';
import {
  collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, Timestamp,
  type DocumentData, type QueryConstraint,
} from 'firebase/firestore';
import { TeacherAssignment } from '@/types/models';

// ── Helpers ──

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return new Date();
}

function serializeForFirestore(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Date) {
      result[key] = Timestamp.fromDate(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = serializeForFirestore(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function processDoc<T>(docSnap: DocumentData, id: string): T {
  const data = docSnap;
  // Convert Firestore Timestamps to Dates
  if (data.createdAt) data.createdAt = toDate(data.createdAt);
  if (data.updatedAt) data.updatedAt = toDate(data.updatedAt);
  if (data.dob) data.dob = toDate(data.dob);
  if (data.dueDate) data.dueDate = toDate(data.dueDate);
  if (data.effectiveFrom) data.effectiveFrom = toDate(data.effectiveFrom);
  if (data.submittedAt) data.submittedAt = toDate(data.submittedAt);
  if (data.paidAt) data.paidAt = toDate(data.paidAt);
  if (data.dateOfJoining) data.dateOfJoining = toDate(data.dateOfJoining);
  if (data.publishedAt) data.publishedAt = toDate(data.publishedAt);
  return { ...data, id } as T;
}

// ── Generic Collection Helpers ──

async function getAll<T>(collectionName: string, ...constraints: QueryConstraint[]): Promise<T[]> {
  const ref = collection(db, collectionName);
  const q = constraints.length > 0 ? query(ref, ...constraints) : ref;
  const snap = await getDocs(q);
  return snap.docs.map(d => processDoc<T>(d.data(), d.id));
}

async function getById<T>(collectionName: string, id: string): Promise<T | null> {
  const docSnap = await getDoc(doc(db, collectionName, id));
  if (!docSnap.exists()) return null;
  return processDoc<T>(docSnap.data(), docSnap.id);
}

async function create(collectionName: string, data: Record<string, unknown>, customId?: string): Promise<string> {
  const payload = {
    ...serializeForFirestore(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (customId) {
    await setDoc(doc(db, collectionName, customId), payload);
    return customId;
  }
  const docRef = await addDoc(collection(db, collectionName), payload);
  return docRef.id;
}

async function update(collectionName: string, id: string, data: Record<string, unknown>): Promise<void> {
  const payload = {
    ...serializeForFirestore(data),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, collectionName, id), payload);
}

async function remove(collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(db, collectionName, id));
}

// ── Users ──

export const UsersService = {
  getAll: () => getAll<DocumentData>('users'),
  getById: (id: string) => getById<DocumentData>('users', id),
  create: (data: Record<string, unknown>, id?: string) => create('users', data, id),
  update: (id: string, data: Record<string, unknown>) => update('users', id, data),
  delete: (id: string) => remove('users', id),
  getByEmail: async (email: string) => {
    const results = await getAll<DocumentData>('users', where('email', '==', email));
    return results[0] || null;
  },
  getPending: () => getAll<DocumentData>('users', where('status', '==', 'pending')),
};

// ── School ──

export const SchoolService = {
  get: async () => {
    const docSnap = await getDoc(doc(db, 'school', 'main'));
    if (!docSnap.exists()) return null;
    return processDoc<DocumentData>(docSnap.data(), 'main');
  },
  // Upsert — Firestore's updateDoc errors when the doc doesn't exist yet
  // (e.g. fresh project where no admin has logged in to seed it). The school
  // is a singleton, so merge-write is the right semantic.
  update: async (data: Record<string, unknown>) => {
    await setDoc(doc(db, 'school', 'main'), {
      ...serializeForFirestore(data),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },
  create: (data: Record<string, unknown>) => create('school', data, 'main'),
};

// ── Students ──

export const StudentsService = {
  getAll: (year?: string) => 
    year ? getAll<DocumentData>('students', where('academicYear', '==', year)) : getAll<DocumentData>('students'),
  getById: (id: string) => getById<DocumentData>('students', id),
  create: (data: Record<string, unknown>) => create('students', data),
  update: (id: string, data: Record<string, unknown>) => update('students', id, data),
  delete: (id: string) => remove('students', id),
  getByClass: (classId: string, year?: string) => {
    const constraints = [where('classId', '==', classId)];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('students', ...constraints);
  },
  getByClassSection: (classId: string, sectionId: string, year?: string) => {
    const constraints = [where('classId', '==', classId), where('sectionId', '==', sectionId)];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('students', ...constraints);
  },
  getByEmail: (email: string, year?: string) => {
    const constraints = [where('email', '==', email)];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('students', ...constraints);
  },
  getByPhone: (phone: string, year?: string) => {
    const constraints = [where('phone', '==', phone)];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('students', ...constraints);
  },
};

// ── Teachers ──

export const TeachersService = {
  getAll: () => getAll<DocumentData>('teachers'),
  getById: (id: string) => getById<DocumentData>('teachers', id),
  create: (data: Record<string, unknown>) => create('teachers', data),
  update: (id: string, data: Record<string, unknown>) => update('teachers', id, data),
  delete: (id: string) => remove('teachers', id),
  getByUserId: async (userId: string, year?: string) => {
    // Try by userId first
    const results = await getAll<DocumentData>('teachers', where('userId', '==', userId));
    const teacher = results[0] || null;
    if (!teacher) {
      // Fallback: try by uid field
      const results2 = await getAll<DocumentData>('teachers', where('uid', '==', userId));
      if (results2[0]) {
        const t = results2[0];
        if (year) {
          const assignments = await TeachersService.getAssignments(t.id, year);
          return { ...t, assignedClasses: assignments };
        }
        return t;
      }
      return null;
    }
    if (year) {
      const assignments = await TeachersService.getAssignments(teacher.id, year);
      return { ...teacher, assignedClasses: assignments };
    }
    return teacher;
  },
  getByEmail: async (email: string, year?: string) => {
    const results = await getAll<DocumentData>('teachers', where('email', '==', email));
    const teacher = results[0] || null;
    if (teacher && year) {
      const assignments = await TeachersService.getAssignments(teacher.id, year);
      return { ...teacher, assignedClasses: assignments };
    }
    return teacher;
  },
  getAssignments: async (teacherId: string, year: string) => {
    const docId = `${teacherId}_${year}`;
    const doc = await getById<DocumentData>('teacherAssignments', docId);
    return doc?.assignments || [];
  },
  updateAssignments: async (teacherId: string, year: string, assignments: TeacherAssignment[]) => {
    const docId = `${teacherId}_${year}`;
    const existingDoc = await getById<DocumentData>('teacherAssignments', docId);
    const data = { teacherId, academicYear: year, assignments };
    if (existingDoc) {
      await update('teacherAssignments', docId, data);
    } else {
      await setDoc(doc(db, 'teacherAssignments', docId), serializeForFirestore({
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
    }
  },
  getAllAssignments: (year: string) => 
    getAll<DocumentData>('teacherAssignments', where('academicYear', '==', year)),
};

// ── Classes ──

export const ClassesService = {
  getAll: (year?: string) => {
    const constraints = year ? [where('academicYear', '==', year)] : [];
    return getAll<DocumentData>('classes', ...constraints).then(results => 
      results.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))
    );
  },
  getById: (id: string) => getById<DocumentData>('classes', id),
  create: (data: Record<string, unknown>) => create('classes', data),
  update: (id: string, data: Record<string, unknown>) => update('classes', id, data),
  delete: (id: string) => remove('classes', id),
};

// ── Timetables ──

export const TimetablesService = {
  getAll: (year?: string) => 
    year ? getAll<DocumentData>('timetables', where('academicYear', '==', year)) : getAll<DocumentData>('timetables'),
  getById: (id: string) => getById<DocumentData>('timetables', id),
  create: (data: Record<string, unknown>) => create('timetables', data),
  update: (id: string, data: Record<string, unknown>) => update('timetables', id, data),
  getByClassSection: async (classId: string, sectionId: string, year?: string) => {
    const constraints = [
      where('classId', '==', classId),
      where('sectionId', '==', sectionId)
    ];
    if (year) constraints.push(where('academicYear', '==', year));
    const results = await getAll<DocumentData>('timetables', ...constraints);
    return results[0] || null;
  },
};

// ── Attendance ──

export const AttendanceService = {
  getAll: (year?: string) => 
    year ? getAll<DocumentData>('attendance', where('academicYear', '==', year)) : getAll<DocumentData>('attendance'),
  getById: (id: string) => getById<DocumentData>('attendance', id),
  create: (data: Record<string, unknown>) => create('attendance', data),
  update: (id: string, data: Record<string, unknown>) => update('attendance', id, data),
  getByDate: (date: Date | string, year?: string) => {
    const d = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const constraints = [where('date', '==', d)];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('attendance', ...constraints);
  },
  getByDateClass: (date: Date | string, classId: string, sectionId: string, year?: string) => {
    const d = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const constraints = [where('date', '==', d), where('classId', '==', classId), where('sectionId', '==', sectionId)];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('attendance', ...constraints);
  },
  // Fetch the attendance record for a specific (date, section, session).
  // Filtering by session is done in-code so legacy docs (no `session` field,
  // treated as morning) still resolve correctly.
  getRecord: async (
    classId: string,
    sectionId: string,
    date: Date | string,
    session?: string,
    year?: string,
  ) => {
    const d = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const constraints = [where('classId', '==', classId), where('sectionId', '==', sectionId), where('date', '==', d)];
    if (year) constraints.push(where('academicYear', '==', year));
    const results = await getAll<DocumentData>('attendance', ...constraints);
    const wanted = session || 'morning';
    return results.find(r => ((r as DocumentData).session || 'morning') === wanted) || null;
  },
  getByTeacher: (teacherId: string, year?: string) => {
    const constraints = [where('teacherId', '==', teacherId)];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('attendance', ...constraints);
  },
};

// ── Marks ──

export const MarksService = {
  getAll: (year?: string) => 
    year ? getAll<DocumentData>('marks', where('academicYear', '==', year)) : getAll<DocumentData>('marks'),
  getById: (id: string) => getById<DocumentData>('marks', id),
  create: (data: Record<string, unknown>) => create('marks', data),
  update: (id: string, data: Record<string, unknown>) => update('marks', id, data),
  getByClassSubject: (classId: string, subjectId: string, year?: string) => {
    const constraints = [where('classId', '==', classId), where('subjectId', '==', subjectId)];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('marks', ...constraints);
  },
};

// ── Assignments ──

export const AssignmentsService = {
  getAll: () => getAll<DocumentData>('assignments'),
  getById: (id: string) => getById<DocumentData>('assignments', id),
  create: (data: Record<string, unknown>) => create('assignments', data),
  update: (id: string, data: Record<string, unknown>) => update('assignments', id, data),
  delete: (id: string) => remove('assignments', id),
  getByTeacher: (teacherId: string) =>
    getAll<DocumentData>('assignments', where('teacherId', '==', teacherId)),
  getByClass: (classId: string) =>
    getAll<DocumentData>('assignments', where('classId', '==', classId)),
};

// ── Fee Structures ──

export const FeeStructuresService = {
  getAll: (year?: string) =>
    year ? getAll<DocumentData>('feeStructures', where('academicYear', '==', year)) : getAll<DocumentData>('feeStructures'),
  // Scoped fetch for class-level views (teacher fee register) — avoids
  // loading every structure school-wide.
  getByClass: async (classId: string, year?: string) => {
    const constraints = [where('classId', '==', classId)];
    if (year) constraints.push(where('academicYear', '==', year));
    const results = await getAll<DocumentData>('feeStructures', ...constraints);
    return results[0] || null;
  },
  getById: (id: string) => getById<DocumentData>('feeStructures', id),
  create: (data: Record<string, unknown>) => create('feeStructures', data),
  update: (id: string, data: Record<string, unknown>) => update('feeStructures', id, data),
  delete: (id: string) => remove('feeStructures', id),
};

// ── Fee Payments ──

export const FeePaymentsService = {
  getAll: (year?: string) => 
    year ? getAll<DocumentData>('feePayments', where('academicYear', '==', year)) : getAll<DocumentData>('feePayments'),
  getById: (id: string) => getById<DocumentData>('feePayments', id),
  create: (data: Record<string, unknown>) => create('feePayments', data),
  update: (id: string, data: Record<string, unknown>) => update('feePayments', id, data),
  getByStudent: (studentId: string, year?: string) => {
    const constraints = [where('studentId', '==', studentId)];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('feePayments', ...constraints);
  },
  // Scoped fetch for class-level views (teacher fee register) — avoids
  // loading every payment school-wide.
  getByClass: (classId: string, year?: string) => {
    const constraints = [where('classId', '==', classId)];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('feePayments', ...constraints);
  },
};

// ── Notifications ──

export const NotificationsService = {
  getAll: () => getAll<DocumentData>('notifications'),
  create: (data: Record<string, unknown>) => create('notifications', data),
  markRead: async (id: string, userId: string) => {
    const docRef = doc(db, 'notifications', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const readBy: string[] = docSnap.data().readBy || [];
      if (!readBy.includes(userId)) {
        await updateDoc(docRef, { readBy: [...readBy, userId] });
      }
    }
  },
  getForUser: async (userId: string, role: string) => {
    // Get notifications targeted to this user's role or 'all'
    const allNotifs = await getAll<DocumentData>('notifications');
    return allNotifs.filter((n: DocumentData) =>
      n.targetRole === 'all' ||
      n.targetRole === role ||
      (n.targetUsers && n.targetUsers.includes(userId))
    );
  },
};

// ── Report Cards ──

export const ReportCardService = {
  getAll: () => getAll<DocumentData>('reportCards'),
  getById: (id: string) => getById<DocumentData>('reportCards', id),
  create: (data: Record<string, unknown>) => create('reportCards', data),
  update: (id: string, data: Record<string, unknown>) => update('reportCards', id, data),
  delete: (id: string) => remove('reportCards', id),
  getByStudent: (studentId: string) =>
    getAll<DocumentData>('reportCards', where('studentId', '==', studentId)),
  getByClassSection: (classId: string, sectionId: string) =>
    getAll<DocumentData>('reportCards',
      where('classId', '==', classId),
      where('sectionId', '==', sectionId)
    ),
  getByClassSectionYear: async (classId: string, sectionId: string, academicYear: string) => {
    const results = await getAll<DocumentData>('reportCards',
      where('classId', '==', classId),
      where('sectionId', '==', sectionId),
      where('academicYear', '==', academicYear)
    );
    return results;
  },
};

// ── Assessment Sessions ──

export const AssessmentService = {
  getAll: (year?: string) => 
    year ? getAll<DocumentData>('assessmentSessions', where('academicYear', '==', year)) : getAll<DocumentData>('assessmentSessions'),
  getById: (id: string) => getById<DocumentData>('assessmentSessions', id),
  create: (data: Record<string, unknown>) => create('assessmentSessions', data),
  update: (id: string, data: Record<string, unknown>) => update('assessmentSessions', id, data),
  delete: (id: string) => remove('assessmentSessions', id),
  getOpenByTeacher: (teacherId: string, year?: string) => {
    const constraints = [where('status', '==', 'open')];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('assessmentSessions', ...constraints);
  },
  getByClassSection: (classId: string, sectionId: string, year?: string) => {
    const constraints = [where('classId', '==', classId), where('sectionId', '==', sectionId)];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('assessmentSessions', ...constraints);
  },
};

// ── Weekly Tests ──

export const WeeklyTestsService = {
  getAll: () => getAll<DocumentData>('weeklyTests'),
  getById: (id: string) => getById<DocumentData>('weeklyTests', id),
  create: (data: Record<string, unknown>) => create('weeklyTests', data),
  update: (id: string, data: Record<string, unknown>) => update('weeklyTests', id, data),
  getByStudentSubjectMonth: async (studentId: string, subjectId: string, month: string, year: string) => {
    const results = await getAll<DocumentData>('weeklyTests',
      where('studentId', '==', studentId),
      where('subjectId', '==', subjectId),
      where('month', '==', month.toLowerCase()),
      where('academicYear', '==', year)
    );
    return results[0] || null;
  },
  getByClassSubjectMonth: (classId: string, sectionId: string, subjectId: string, month: string, year: string) => {
    return getAll<DocumentData>('weeklyTests',
      where('classId', '==', classId),
      where('sectionId', '==', sectionId),
      where('subjectId', '==', subjectId),
      where('month', '==', month.toLowerCase()),
      where('academicYear', '==', year)
    );
  },
};
// ── Expenses ──
export const ExpensesService = {
  getAll: (year?: string) =>
    year ? getAll<DocumentData>('expenses', where('academicYear', '==', year)) : getAll<DocumentData>('expenses'),
  getById: (id: string) => getById<DocumentData>('expenses', id),
  create: (data: Record<string, unknown>) => create('expenses', data),
  update: (id: string, data: Record<string, unknown>) => update('expenses', id, data),
  delete: (id: string) => remove('expenses', id),
};

// ── Class Tests ──
// One doc per (test name, class/section/subject) — multiple tests per subject
// across the year. Records hold each student's mark for that single test.
export const ClassTestsService = {
  getAll: (year?: string) =>
    year ? getAll<DocumentData>('classTests', where('academicYear', '==', year)) : getAll<DocumentData>('classTests'),
  getById: (id: string) => getById<DocumentData>('classTests', id),
  create: (data: Record<string, unknown>) => create('classTests', data),
  update: (id: string, data: Record<string, unknown>) => update('classTests', id, data),
  delete: (id: string) => remove('classTests', id),
  getByClassSectionSubject: (classId: string, sectionId: string, subjectId: string, year?: string) => {
    const constraints = [
      where('classId', '==', classId),
      where('sectionId', '==', sectionId),
      where('subjectId', '==', subjectId),
    ];
    if (year) constraints.push(where('academicYear', '==', year));
    return getAll<DocumentData>('classTests', ...constraints);
  },
};

// -- Co-Scholastic & Remarks --
export const CoScholasticService = {
  getAll: () => getAll<DocumentData>('coScholasticRecords'),
  getById: (id: string) => getById<DocumentData>('coScholasticRecords', id),
  create: (data: Record<string, unknown>) => create('coScholasticRecords', data),
  update: (id: string, data: Record<string, unknown>) => update('coScholasticRecords', id, data),
  getByClassSectionExam: async (classId: string, sectionId: string, examId: string, year?: string) => {
    const constraints = [
      where('classId', '==', classId),
      where('sectionId', '==', sectionId),
      where('examId', '==', examId)
    ];
    if (year) constraints.push(where('academicYear', '==', year));
    const results = await getAll<DocumentData>('coScholasticRecords', ...constraints);
    return results[0] || null;
  },
};
export const AttendanceAggregationService = {
  getClassAttendanceSummary: async (classId: string, sectionId: string, startDate?: string, endDate?: string) => {
    const constraints = [
      where('classId', '==', classId),
      where('sectionId', '==', sectionId)
    ];

    if (startDate) constraints.push(where('date', '>=', startDate));
    if (endDate) constraints.push(where('date', '<=', endDate));

    const results = await getAll<DocumentData>('attendance', ...constraints);
    
    // Total working days = number of unique dates attendance was taken in this period
    const workingDays = results.length;
    
    const studentStats: Record<string, number> = {};
    results.forEach(doc => {
      ((doc.records as unknown[]) || []).forEach((r: unknown) => {
        const record = r as { status: string; studentId: string };
        // Status is 'present' (string) as per TeacherAttendance.tsx
        if (record.status === 'present' || record.status === 'Present') {
          studentStats[record.studentId] = (studentStats[record.studentId] || 0) + 1;
        }
      });
    });
    
    return {
      workingDays,
      studentStats
    };
  }
};
export const SettingsService = {
  getExamCalendar: async (year: string) => {
    const doc = await getById<DocumentData>('academicCalendars', year);
    return doc || null;
  },
  updateExamCalendar: async (year: string, data: Record<string, unknown>) => {
    const existingDoc = await getById('academicCalendars', year);
    if (existingDoc) {
      await update('academicCalendars', year, data);
    } else {
      await setDoc(doc(db, 'academicCalendars', year), serializeForFirestore({
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
    }
  },
};

// -- Bus Routes --

export const BusRoutesService = {
  getAll: () => getAll<DocumentData>('busRoutes'),
  getById: (id: string) => getById<DocumentData>('busRoutes', id),
  create: (data: Record<string, unknown>) => create('busRoutes', data),
  update: (id: string, data: Record<string, unknown>) => update('busRoutes', id, data),
  delete: (id: string) => remove('busRoutes', id),
};

// -- Master Reset Utility --
export const MasterResetService = {
  wipeAllData: async () => {
    // NOTE: 'feePayments' is intentionally NOT wiped here. Firestore rules
    // forbid deleting payment records from the client (delete: if false —
    // audit trail, docs/designs/principal-role-fees-accounts.md). If payments
    // ever truly need clearing, do it from the Firebase console, which
    // bypasses rules.
    const collectionsToWipe = [
      'students', 'classes', 'attendance', 'marks',
      'feeStructures', 'teacherAssignments', 'timetables',
      'assessmentSessions', 'weeklyTests', 'coScholasticRecords',
      'academicCalendars'
    ];

    for (const collectionName of collectionsToWipe) {
      const ref = collection(db, collectionName);
      const snapshot = await getDocs(ref);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    }
  }
};
