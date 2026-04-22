(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/types/enums.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* ============================================
   CampusOS — Enumerations
   ============================================ */ __turbopack_context__.s([
    "AssignmentStatus",
    ()=>AssignmentStatus,
    "AttendanceStatus",
    ()=>AttendanceStatus,
    "ConflictSeverity",
    ()=>ConflictSeverity,
    "ConflictType",
    ()=>ConflictType,
    "DAYS_OF_WEEK",
    ()=>DAYS_OF_WEEK,
    "DAY_LABELS",
    ()=>DAY_LABELS,
    "DAY_SHORT_LABELS",
    ()=>DAY_SHORT_LABELS,
    "DayOfWeek",
    ()=>DayOfWeek,
    "FeeType",
    ()=>FeeType,
    "MarksStatus",
    ()=>MarksStatus,
    "NotificationType",
    ()=>NotificationType,
    "PaymentMode",
    ()=>PaymentMode,
    "SchoolPlan",
    ()=>SchoolPlan,
    "StudentStatus",
    ()=>StudentStatus,
    "TeacherStatus",
    ()=>TeacherStatus,
    "TimetableStatus",
    ()=>TimetableStatus,
    "UserRole",
    ()=>UserRole
]);
var UserRole = /*#__PURE__*/ function(UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["TEACHER"] = "teacher";
    UserRole["PARENT"] = "parent";
    UserRole["PRINCIPAL"] = "principal";
    UserRole["CORRESPONDENT"] = "correspondent";
    return UserRole;
}({});
var StudentStatus = /*#__PURE__*/ function(StudentStatus) {
    StudentStatus["ACTIVE"] = "active";
    StudentStatus["ARCHIVED"] = "archived";
    return StudentStatus;
}({});
var TeacherStatus = /*#__PURE__*/ function(TeacherStatus) {
    TeacherStatus["ACTIVE"] = "active";
    TeacherStatus["ARCHIVED"] = "archived";
    return TeacherStatus;
}({});
var TimetableStatus = /*#__PURE__*/ function(TimetableStatus) {
    TimetableStatus["DRAFT"] = "draft";
    TimetableStatus["PUBLISHED"] = "published";
    TimetableStatus["ARCHIVED"] = "archived";
    return TimetableStatus;
}({});
var AttendanceStatus = /*#__PURE__*/ function(AttendanceStatus) {
    AttendanceStatus["PRESENT"] = "present";
    AttendanceStatus["ABSENT"] = "absent";
    AttendanceStatus["LATE"] = "late";
    return AttendanceStatus;
}({});
var MarksStatus = /*#__PURE__*/ function(MarksStatus) {
    MarksStatus["DRAFT"] = "draft";
    MarksStatus["PUBLISHED"] = "published";
    return MarksStatus;
}({});
var PaymentMode = /*#__PURE__*/ function(PaymentMode) {
    PaymentMode["CASH"] = "cash";
    PaymentMode["UPI"] = "upi";
    PaymentMode["CHEQUE"] = "cheque";
    PaymentMode["BANK_TRANSFER"] = "bank_transfer";
    return PaymentMode;
}({});
var FeeType = /*#__PURE__*/ function(FeeType) {
    FeeType["STRUCTURE"] = "structure";
    FeeType["PAYMENT"] = "payment";
    return FeeType;
}({});
var NotificationType = /*#__PURE__*/ function(NotificationType) {
    NotificationType["FEE_REMINDER"] = "fee_reminder";
    NotificationType["ATTENDANCE_ALERT"] = "attendance_alert";
    NotificationType["TIMETABLE_CHANGE"] = "timetable_change";
    NotificationType["ANNOUNCEMENT"] = "announcement";
    NotificationType["NEW_MESSAGE"] = "new_message";
    NotificationType["ASSIGNMENT_DUE"] = "assignment_due";
    return NotificationType;
}({});
var ConflictSeverity = /*#__PURE__*/ function(ConflictSeverity) {
    ConflictSeverity["ERROR"] = "error";
    ConflictSeverity["WARNING"] = "warning";
    return ConflictSeverity;
}({});
var ConflictType = /*#__PURE__*/ function(ConflictType) {
    ConflictType["TEACHER_UNAVAILABLE"] = "TEACHER_UNAVAILABLE";
    ConflictType["TEACHER_DOUBLE_BOOKED"] = "TEACHER_DOUBLE_BOOKED";
    ConflictType["EMPTY_SLOT"] = "EMPTY_SLOT";
    ConflictType["SUBJECT_OVERLOAD"] = "SUBJECT_OVERLOAD";
    return ConflictType;
}({});
var SchoolPlan = /*#__PURE__*/ function(SchoolPlan) {
    SchoolPlan["FREE"] = "free";
    SchoolPlan["STANDARD"] = "standard";
    SchoolPlan["PREMIUM"] = "premium";
    SchoolPlan["ENTERPRISE"] = "enterprise";
    return SchoolPlan;
}({});
var DayOfWeek = /*#__PURE__*/ function(DayOfWeek) {
    DayOfWeek["MONDAY"] = "monday";
    DayOfWeek["TUESDAY"] = "tuesday";
    DayOfWeek["WEDNESDAY"] = "wednesday";
    DayOfWeek["THURSDAY"] = "thursday";
    DayOfWeek["FRIDAY"] = "friday";
    DayOfWeek["SATURDAY"] = "saturday";
    return DayOfWeek;
}({});
var AssignmentStatus = /*#__PURE__*/ function(AssignmentStatus) {
    AssignmentStatus["ACTIVE"] = "active";
    AssignmentStatus["ARCHIVED"] = "archived";
    return AssignmentStatus;
}({});
const DAYS_OF_WEEK = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
];
const DAY_LABELS = {
    ["monday"]: 'Monday',
    ["tuesday"]: 'Tuesday',
    ["wednesday"]: 'Wednesday',
    ["thursday"]: 'Thursday',
    ["friday"]: 'Friday',
    ["saturday"]: 'Saturday'
};
const DAY_SHORT_LABELS = {
    ["monday"]: 'Mon',
    ["tuesday"]: 'Tue',
    ["wednesday"]: 'Wed',
    ["thursday"]: 'Thu',
    ["friday"]: 'Fri',
    ["saturday"]: 'Sat'
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/demo-data.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEMO_ADMIN_STATS",
    ()=>DEMO_ADMIN_STATS,
    "DEMO_ASSIGNMENTS",
    ()=>DEMO_ASSIGNMENTS,
    "DEMO_ATTENDANCE",
    ()=>DEMO_ATTENDANCE,
    "DEMO_ATTENDANCE_TREND",
    ()=>DEMO_ATTENDANCE_TREND,
    "DEMO_CHATS",
    ()=>DEMO_CHATS,
    "DEMO_CLASSES",
    ()=>DEMO_CLASSES,
    "DEMO_FEE_BY_CLASS",
    ()=>DEMO_FEE_BY_CLASS,
    "DEMO_FEE_STRUCTURES",
    ()=>DEMO_FEE_STRUCTURES,
    "DEMO_MARKS",
    ()=>DEMO_MARKS,
    "DEMO_MATERIALS",
    ()=>DEMO_MATERIALS,
    "DEMO_NOTIFICATIONS",
    ()=>DEMO_NOTIFICATIONS,
    "DEMO_PAYMENTS",
    ()=>DEMO_PAYMENTS,
    "DEMO_RECENT_ACTIVITY",
    ()=>DEMO_RECENT_ACTIVITY,
    "DEMO_SCHOOL",
    ()=>DEMO_SCHOOL,
    "DEMO_STUDENTS",
    ()=>DEMO_STUDENTS,
    "DEMO_TEACHERS",
    ()=>DEMO_TEACHERS,
    "DEMO_TIMETABLE",
    ()=>DEMO_TIMETABLE,
    "DEMO_USERS",
    ()=>DEMO_USERS
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/types/enums.ts [app-client] (ecmascript)");
;
const DEMO_USERS = {
    [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].ADMIN]: {
        id: 'user_admin_001',
        uid: 'auth_admin_001',
        role: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].ADMIN,
        name: 'Priya Sharma',
        email: 'admin@marutischool.edu',
        phone: '+91 98765 43210',
        photo: '',
        status: 'active',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-04-01')
    },
    [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].PRINCIPAL]: {
        id: 'user_principal_001',
        uid: 'auth_principal_001',
        role: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].PRINCIPAL,
        name: 'Dr. Aravind Swamy',
        email: 'principal@marutischool.edu',
        phone: '+91 98765 43208',
        photo: '',
        status: 'active',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-04-01')
    },
    [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].CORRESPONDENT]: {
        id: 'user_correspondent_001',
        uid: 'auth_correspondent_001',
        role: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].CORRESPONDENT,
        name: 'Mrs. Lakshmi Rajan',
        email: 'correspondent@marutischool.edu',
        phone: '+91 98765 43209',
        photo: '',
        status: 'active',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-04-01')
    },
    [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].TEACHER]: {
        id: 'user_teacher_001',
        uid: 'auth_teacher_001',
        role: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].TEACHER,
        name: 'Rajesh Kumar',
        email: 'teacher@marutischool.edu',
        phone: '+91 98765 43211',
        photo: '',
        status: 'active',
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-04-01')
    },
    [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].PARENT]: {
        id: 'user_parent_001',
        uid: 'auth_parent_001',
        role: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].PARENT,
        name: 'Meena Devi',
        email: 'parent@marutischool.edu',
        phone: '+91 98765 43212',
        photo: '',
        status: 'active',
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-04-01')
    }
};
const DEMO_SCHOOL = {
    id: 'school_demo_001',
    name: 'Maruti Nursery & Primary School',
    address: '123 Education Lane, Bangalore, Karnataka 560001',
    phone: '+91 80 2345 6789',
    email: 'info@marutischool.edu.in',
    logo: '/MARUTI.png.bv.webp',
    academicYear: '2026-27',
    plan: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SchoolPlan"].STANDARD,
    settings: {
        admissionPrefix: 'MNS',
        periodsPerDay: 8,
        schoolDays: [
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY,
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY,
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY,
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY,
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY,
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].SATURDAY
        ],
        periodTimings: [
            {
                period: 1,
                start: '08:30',
                end: '09:15'
            },
            {
                period: 2,
                start: '09:15',
                end: '10:00'
            },
            {
                type: 'break',
                label: 'Short Break',
                start: '10:00',
                end: '10:20'
            },
            {
                period: 3,
                start: '10:20',
                end: '11:05'
            },
            {
                period: 4,
                start: '11:05',
                end: '11:50'
            },
            {
                type: 'lunch',
                label: 'Lunch Break',
                start: '11:50',
                end: '12:30'
            },
            {
                period: 5,
                start: '12:30',
                end: '13:15'
            },
            {
                period: 6,
                start: '13:15',
                end: '14:00'
            },
            {
                period: 7,
                start: '14:00',
                end: '14:45'
            },
            {
                period: 8,
                start: '14:45',
                end: '15:30'
            }
        ],
        gradeScale: [
            {
                grade: 'A+',
                min: 90,
                max: 100
            },
            {
                grade: 'A',
                min: 80,
                max: 89
            },
            {
                grade: 'B+',
                min: 70,
                max: 79
            },
            {
                grade: 'B',
                min: 60,
                max: 69
            },
            {
                grade: 'C+',
                min: 50,
                max: 59
            },
            {
                grade: 'C',
                min: 40,
                max: 49
            },
            {
                grade: 'D',
                min: 30,
                max: 39
            },
            {
                grade: 'F',
                min: 0,
                max: 29
            }
        ],
        maxPeriodsPerTeacherPerDay: 6,
        maxConsecutivePeriods: 3
    },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-04-01')
};
const DEMO_CLASSES = [
    {
        id: 'class_001',
        name: 'Class 1',
        order: 1,
        academicYear: '2026-27',
        sections: [
            {
                id: 'sec_1a',
                name: 'A',
                classTeacherId: 'teacher_003',
                maxCapacity: 40
            },
            {
                id: 'sec_1b',
                name: 'B',
                classTeacherId: 'teacher_004',
                maxCapacity: 40
            }
        ],
        subjects: [
            {
                id: 'sub_eng',
                name: 'English',
                code: 'ENG',
                weeklyPeriods: 6
            },
            {
                id: 'sub_math',
                name: 'Mathematics',
                code: 'MATH',
                weeklyPeriods: 6
            },
            {
                id: 'sub_evs',
                name: 'EVS',
                code: 'EVS',
                weeklyPeriods: 4
            },
            {
                id: 'sub_hindi',
                name: 'Hindi',
                code: 'HIN',
                weeklyPeriods: 5
            }
        ]
    },
    {
        id: 'class_005',
        name: 'Class 5',
        order: 5,
        academicYear: '2026-27',
        sections: [
            {
                id: 'sec_5a',
                name: 'A',
                classTeacherId: 'teacher_001',
                maxCapacity: 45
            },
            {
                id: 'sec_5b',
                name: 'B',
                classTeacherId: 'teacher_005',
                maxCapacity: 45
            }
        ],
        subjects: [
            {
                id: 'sub_eng',
                name: 'English',
                code: 'ENG',
                weeklyPeriods: 6
            },
            {
                id: 'sub_math',
                name: 'Mathematics',
                code: 'MATH',
                weeklyPeriods: 6
            },
            {
                id: 'sub_sci',
                name: 'Science',
                code: 'SCI',
                weeklyPeriods: 5
            },
            {
                id: 'sub_social',
                name: 'Social Studies',
                code: 'SST',
                weeklyPeriods: 4
            },
            {
                id: 'sub_hindi',
                name: 'Hindi',
                code: 'HIN',
                weeklyPeriods: 5
            },
            {
                id: 'sub_cs',
                name: 'Computer Science',
                code: 'CS',
                weeklyPeriods: 2
            },
            {
                id: 'sub_pe',
                name: 'Physical Education',
                code: 'PE',
                weeklyPeriods: 2
            },
            {
                id: 'sub_art',
                name: 'Art',
                code: 'ART',
                weeklyPeriods: 2
            }
        ]
    },
    {
        id: 'class_008',
        name: 'Class 8',
        order: 8,
        academicYear: '2026-27',
        sections: [
            {
                id: 'sec_8a',
                name: 'A',
                classTeacherId: 'teacher_002',
                maxCapacity: 45
            },
            {
                id: 'sec_8b',
                name: 'B',
                classTeacherId: 'teacher_006',
                maxCapacity: 45
            }
        ],
        subjects: [
            {
                id: 'sub_eng',
                name: 'English',
                code: 'ENG',
                weeklyPeriods: 5
            },
            {
                id: 'sub_math',
                name: 'Mathematics',
                code: 'MATH',
                weeklyPeriods: 6
            },
            {
                id: 'sub_sci',
                name: 'Science',
                code: 'SCI',
                weeklyPeriods: 6
            },
            {
                id: 'sub_social',
                name: 'Social Studies',
                code: 'SST',
                weeklyPeriods: 4
            },
            {
                id: 'sub_hindi',
                name: 'Hindi',
                code: 'HIN',
                weeklyPeriods: 4
            },
            {
                id: 'sub_cs',
                name: 'Computer Science',
                code: 'CS',
                weeklyPeriods: 3
            },
            {
                id: 'sub_pe',
                name: 'Physical Education',
                code: 'PE',
                weeklyPeriods: 2
            }
        ]
    },
    {
        id: 'class_010',
        name: 'Class 10',
        order: 10,
        academicYear: '2026-27',
        sections: [
            {
                id: 'sec_10a',
                name: 'A',
                classTeacherId: 'teacher_001',
                maxCapacity: 40
            },
            {
                id: 'sec_10b',
                name: 'B',
                classTeacherId: 'teacher_007',
                maxCapacity: 40
            }
        ],
        subjects: [
            {
                id: 'sub_eng',
                name: 'English',
                code: 'ENG',
                weeklyPeriods: 5
            },
            {
                id: 'sub_math',
                name: 'Mathematics',
                code: 'MATH',
                weeklyPeriods: 6
            },
            {
                id: 'sub_sci',
                name: 'Science',
                code: 'SCI',
                weeklyPeriods: 7
            },
            {
                id: 'sub_social',
                name: 'Social Studies',
                code: 'SST',
                weeklyPeriods: 5
            },
            {
                id: 'sub_hindi',
                name: 'Hindi',
                code: 'HIN',
                weeklyPeriods: 4
            },
            {
                id: 'sub_cs',
                name: 'Computer Science',
                code: 'CS',
                weeklyPeriods: 3
            }
        ]
    }
];
// ── Demo Students ──
const studentNames = [
    'Arun Kumar',
    'Divya Sharma',
    'Karthik R.',
    'Lakshmi S.',
    'Mohammed Irfan',
    'Priya Patel',
    'Rahul Mehta',
    'Sneha Reddy',
    'Vikram Singh',
    'Ananya Nair',
    'Arjun Menon',
    'Deepa Krishnan',
    'Gopal Verma',
    'Ishita Gupta',
    'Jai Prakash',
    'Kavitha M.',
    'Manoj T.',
    'Neha Joshi',
    'Om Prakash',
    'Pooja Yadav',
    'Ravi Shankar',
    'Sita Devi',
    'Tanvi Agarwal',
    'Uma Mahesh',
    'Varun Kapoor',
    'Waseema K.',
    'Yash Pandey',
    'Zara Khan',
    'Aarav Jain',
    'Bhavya Srinivasan',
    'Chirag Malhotra',
    'Disha Banerjee',
    'Eshan Roy',
    'Fatima Begum',
    'Gaurav Tiwari',
    'Harini N.',
    'Ishan Desai',
    'Jaya Lakshmi',
    'Krishna P.',
    'Lavanya M.'
];
const DEMO_STUDENTS = studentNames.map(_c = (name, i)=>({
        id: `student_${String(i + 1).padStart(3, '0')}`,
        admissionNumber: `MNS-2026-${String(i + 1).padStart(4, '0')}`,
        name,
        dob: new Date(2014 + Math.floor(i / 10), i * 3 % 12, (i * 7 + 5) % 28 + 1),
        gender: i % 3 === 0 ? 'female' : 'male',
        bloodGroup: [
            'A+',
            'B+',
            'O+',
            'AB+',
            'A-',
            'B-'
        ][i % 6],
        address: `${100 + i} MG Road, Bangalore, Karnataka`,
        photo: '',
        classId: i < 10 ? 'class_005' : i < 20 ? 'class_008' : i < 30 ? 'class_010' : 'class_001',
        sectionId: i % 2 === 0 ? i < 10 ? 'sec_5a' : i < 20 ? 'sec_8a' : i < 30 ? 'sec_10a' : 'sec_1a' : i < 10 ? 'sec_5b' : i < 20 ? 'sec_8b' : i < 30 ? 'sec_10b' : 'sec_1b',
        parentIds: [
            `user_parent_${String(i + 1).padStart(3, '0')}`
        ],
        status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StudentStatus"].ACTIVE,
        className: i < 10 ? 'Class 5' : i < 20 ? 'Class 8' : i < 30 ? 'Class 10' : 'Class 1',
        sectionName: i % 2 === 0 ? 'A' : 'B',
        createdAt: new Date('2026-03-15'),
        updatedAt: new Date('2026-04-01')
    }));
_c1 = DEMO_STUDENTS;
const DEMO_TEACHERS = [
    {
        id: 'teacher_001',
        userId: 'user_teacher_001',
        employeeId: 'EMP001',
        name: 'Rajesh Kumar',
        email: 'rajesh@marutischool.edu.in',
        phone: '+91 98765 43211',
        photo: '',
        subjects: [
            'sub_math'
        ],
        subjectNames: [
            'Mathematics'
        ],
        assignedClasses: [
            {
                classId: 'class_005',
                sectionId: 'sec_5a',
                subjectId: 'sub_math',
                isClassTeacher: true,
                className: 'Class 5',
                sectionName: 'A',
                subjectName: 'Mathematics'
            },
            {
                classId: 'class_008',
                sectionId: 'sec_8a',
                subjectId: 'sub_math',
                isClassTeacher: false,
                className: 'Class 8',
                sectionName: 'A',
                subjectName: 'Mathematics'
            },
            {
                classId: 'class_010',
                sectionId: 'sec_10a',
                subjectId: 'sub_math',
                isClassTeacher: false,
                className: 'Class 10',
                sectionName: 'A',
                subjectName: 'Mathematics'
            }
        ],
        availability: {
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: false
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: false,
                8: false
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].SATURDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: false,
                6: false,
                7: false,
                8: false
            }
        },
        status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TeacherStatus"].ACTIVE,
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-04-01')
    },
    {
        id: 'teacher_002',
        userId: 'user_teacher_002',
        employeeId: 'EMP002',
        name: 'Preeti Nair',
        email: 'preeti@marutischool.edu.in',
        phone: '+91 98765 43213',
        photo: '',
        subjects: [
            'sub_eng'
        ],
        subjectNames: [
            'English'
        ],
        assignedClasses: [
            {
                classId: 'class_005',
                sectionId: 'sec_5a',
                subjectId: 'sub_eng',
                isClassTeacher: false,
                className: 'Class 5',
                sectionName: 'A',
                subjectName: 'English'
            },
            {
                classId: 'class_008',
                sectionId: 'sec_8a',
                subjectId: 'sub_eng',
                isClassTeacher: true,
                className: 'Class 8',
                sectionName: 'A',
                subjectName: 'English'
            }
        ],
        availability: {
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].SATURDAY]: {
                1: true,
                2: true,
                3: true,
                4: false,
                5: false,
                6: false,
                7: false,
                8: false
            }
        },
        status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TeacherStatus"].ACTIVE,
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-04-01')
    },
    {
        id: 'teacher_003',
        userId: 'user_teacher_003',
        employeeId: 'EMP003',
        name: 'Rajan M.',
        email: 'rajan@marutischool.edu.in',
        phone: '+91 98765 43214',
        photo: '',
        subjects: [
            'sub_sci'
        ],
        subjectNames: [
            'Science'
        ],
        assignedClasses: [
            {
                classId: 'class_005',
                sectionId: 'sec_5a',
                subjectId: 'sub_sci',
                isClassTeacher: false,
                className: 'Class 5',
                sectionName: 'A',
                subjectName: 'Science'
            },
            {
                classId: 'class_008',
                sectionId: 'sec_8a',
                subjectId: 'sub_sci',
                isClassTeacher: false,
                className: 'Class 8',
                sectionName: 'A',
                subjectName: 'Science'
            },
            {
                classId: 'class_010',
                sectionId: 'sec_10a',
                subjectId: 'sub_sci',
                isClassTeacher: false,
                className: 'Class 10',
                sectionName: 'A',
                subjectName: 'Science'
            }
        ],
        availability: {
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY]: {
                1: false,
                2: false,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].SATURDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: false,
                6: false,
                7: false,
                8: false
            }
        },
        status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TeacherStatus"].ACTIVE,
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-04-01')
    },
    {
        id: 'teacher_004',
        userId: 'user_teacher_004',
        employeeId: 'EMP004',
        name: 'Deepa Menon',
        email: 'deepa@marutischool.edu.in',
        phone: '+91 98765 43215',
        photo: '',
        subjects: [
            'sub_hindi'
        ],
        subjectNames: [
            'Hindi'
        ],
        assignedClasses: [
            {
                classId: 'class_005',
                sectionId: 'sec_5a',
                subjectId: 'sub_hindi',
                isClassTeacher: false,
                className: 'Class 5',
                sectionName: 'A',
                subjectName: 'Hindi'
            },
            {
                classId: 'class_008',
                sectionId: 'sec_8a',
                subjectId: 'sub_hindi',
                isClassTeacher: false,
                className: 'Class 8',
                sectionName: 'A',
                subjectName: 'Hindi'
            }
        ],
        availability: {
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].SATURDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: false,
                6: false,
                7: false,
                8: false
            }
        },
        status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TeacherStatus"].ACTIVE,
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-04-01')
    },
    {
        id: 'teacher_005',
        userId: 'user_teacher_005',
        employeeId: 'EMP005',
        name: 'Suresh Babu',
        email: 'suresh@marutischool.edu.in',
        phone: '+91 98765 43216',
        photo: '',
        subjects: [
            'sub_social'
        ],
        subjectNames: [
            'Social Studies'
        ],
        assignedClasses: [
            {
                classId: 'class_005',
                sectionId: 'sec_5a',
                subjectId: 'sub_social',
                isClassTeacher: false,
                className: 'Class 5',
                sectionName: 'A',
                subjectName: 'Social Studies'
            },
            {
                classId: 'class_010',
                sectionId: 'sec_10a',
                subjectId: 'sub_social',
                isClassTeacher: false,
                className: 'Class 10',
                sectionName: 'A',
                subjectName: 'Social Studies'
            }
        ],
        availability: {
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].SATURDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: false,
                6: false,
                7: false,
                8: false
            }
        },
        status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TeacherStatus"].ACTIVE,
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-04-01')
    },
    {
        id: 'teacher_006',
        userId: 'user_teacher_006',
        employeeId: 'EMP006',
        name: 'Anitha R.',
        email: 'anitha@marutischool.edu.in',
        phone: '+91 98765 43217',
        photo: '',
        subjects: [
            'sub_cs'
        ],
        subjectNames: [
            'Computer Science'
        ],
        assignedClasses: [
            {
                classId: 'class_005',
                sectionId: 'sec_5a',
                subjectId: 'sub_cs',
                isClassTeacher: false,
                className: 'Class 5',
                sectionName: 'A',
                subjectName: 'Computer Science'
            },
            {
                classId: 'class_008',
                sectionId: 'sec_8a',
                subjectId: 'sub_cs',
                isClassTeacher: false,
                className: 'Class 8',
                sectionName: 'A',
                subjectName: 'Computer Science'
            }
        ],
        availability: {
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].SATURDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: false,
                6: false,
                7: false,
                8: false
            }
        },
        status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TeacherStatus"].ACTIVE,
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-04-01')
    },
    {
        id: 'teacher_007',
        userId: 'user_teacher_007',
        employeeId: 'EMP007',
        name: 'Vijay S.',
        email: 'vijay@marutischool.edu.in',
        phone: '+91 98765 43218',
        photo: '',
        subjects: [
            'sub_pe',
            'sub_art'
        ],
        subjectNames: [
            'Physical Education',
            'Art'
        ],
        assignedClasses: [
            {
                classId: 'class_005',
                sectionId: 'sec_5a',
                subjectId: 'sub_pe',
                isClassTeacher: false,
                className: 'Class 5',
                sectionName: 'A',
                subjectName: 'Physical Education'
            },
            {
                classId: 'class_005',
                sectionId: 'sec_5a',
                subjectId: 'sub_art',
                isClassTeacher: false,
                className: 'Class 5',
                sectionName: 'A',
                subjectName: 'Art'
            }
        ],
        availability: {
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: true,
                6: true,
                7: true,
                8: true
            },
            [__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].SATURDAY]: {
                1: true,
                2: true,
                3: true,
                4: true,
                5: false,
                6: false,
                7: false,
                8: false
            }
        },
        status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TeacherStatus"].ACTIVE,
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-04-01')
    }
];
const DEMO_TIMETABLE = {
    id: 'tt_001',
    classId: 'class_005',
    sectionId: 'sec_5a',
    className: 'Class 5',
    sectionName: 'A',
    academicYear: '2026-27',
    version: 1,
    status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TimetableStatus"].PUBLISHED,
    effectiveFrom: new Date('2026-04-01'),
    createdBy: 'user_admin_001',
    slots: [
        // Monday
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY,
            period: 1,
            subjectId: 'sub_math',
            subjectName: 'Mathematics',
            teacherId: 'teacher_001',
            teacherName: 'Rajesh Kumar'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY,
            period: 2,
            subjectId: 'sub_eng',
            subjectName: 'English',
            teacherId: 'teacher_002',
            teacherName: 'Preeti Nair'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY,
            period: 3,
            subjectId: 'sub_sci',
            subjectName: 'Science',
            teacherId: 'teacher_003',
            teacherName: 'Rajan M.'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY,
            period: 4,
            subjectId: 'sub_hindi',
            subjectName: 'Hindi',
            teacherId: 'teacher_004',
            teacherName: 'Deepa Menon'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY,
            period: 5,
            subjectId: 'sub_social',
            subjectName: 'Social Studies',
            teacherId: 'teacher_005',
            teacherName: 'Suresh Babu'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY,
            period: 6,
            subjectId: 'sub_cs',
            subjectName: 'Computer Science',
            teacherId: 'teacher_006',
            teacherName: 'Anitha R.'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY,
            period: 7,
            subjectId: 'sub_pe',
            subjectName: 'Physical Education',
            teacherId: 'teacher_007',
            teacherName: 'Vijay S.'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].MONDAY,
            period: 8,
            subjectId: 'sub_art',
            subjectName: 'Art',
            teacherId: 'teacher_007',
            teacherName: 'Vijay S.'
        },
        // Tuesday
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY,
            period: 1,
            subjectId: 'sub_eng',
            subjectName: 'English',
            teacherId: 'teacher_002',
            teacherName: 'Preeti Nair'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY,
            period: 2,
            subjectId: 'sub_math',
            subjectName: 'Mathematics',
            teacherId: 'teacher_001',
            teacherName: 'Rajesh Kumar'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY,
            period: 3,
            subjectId: 'sub_hindi',
            subjectName: 'Hindi',
            teacherId: 'teacher_004',
            teacherName: 'Deepa Menon'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY,
            period: 4,
            subjectId: 'sub_sci',
            subjectName: 'Science',
            teacherId: 'teacher_003',
            teacherName: 'Rajan M.'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY,
            period: 5,
            subjectId: 'sub_math',
            subjectName: 'Mathematics',
            teacherId: 'teacher_001',
            teacherName: 'Rajesh Kumar'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY,
            period: 6,
            subjectId: 'sub_social',
            subjectName: 'Social Studies',
            teacherId: 'teacher_005',
            teacherName: 'Suresh Babu'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY,
            period: 7,
            subjectId: 'sub_eng',
            subjectName: 'English',
            teacherId: 'teacher_002',
            teacherName: 'Preeti Nair'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].TUESDAY,
            period: 8,
            subjectId: 'sub_hindi',
            subjectName: 'Hindi',
            teacherId: 'teacher_004',
            teacherName: 'Deepa Menon'
        },
        // Wednesday
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY,
            period: 1,
            subjectId: 'sub_sci',
            subjectName: 'Science',
            teacherId: 'teacher_003',
            teacherName: 'Rajan M.'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY,
            period: 2,
            subjectId: 'sub_math',
            subjectName: 'Mathematics',
            teacherId: 'teacher_001',
            teacherName: 'Rajesh Kumar'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY,
            period: 3,
            subjectId: 'sub_eng',
            subjectName: 'English',
            teacherId: 'teacher_002',
            teacherName: 'Preeti Nair'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY,
            period: 4,
            subjectId: 'sub_social',
            subjectName: 'Social Studies',
            teacherId: 'teacher_005',
            teacherName: 'Suresh Babu'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY,
            period: 5,
            subjectId: 'sub_hindi',
            subjectName: 'Hindi',
            teacherId: 'teacher_004',
            teacherName: 'Deepa Menon'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY,
            period: 6,
            subjectId: 'sub_sci',
            subjectName: 'Science',
            teacherId: 'teacher_003',
            teacherName: 'Rajan M.'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY,
            period: 7,
            subjectId: 'sub_pe',
            subjectName: 'Physical Education',
            teacherId: 'teacher_007',
            teacherName: 'Vijay S.'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].WEDNESDAY,
            period: 8,
            subjectId: 'sub_cs',
            subjectName: 'Computer Science',
            teacherId: 'teacher_006',
            teacherName: 'Anitha R.'
        },
        // Thursday
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY,
            period: 1,
            subjectId: 'sub_math',
            subjectName: 'Mathematics',
            teacherId: 'teacher_001',
            teacherName: 'Rajesh Kumar'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY,
            period: 2,
            subjectId: 'sub_eng',
            subjectName: 'English',
            teacherId: 'teacher_002',
            teacherName: 'Preeti Nair'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY,
            period: 3,
            subjectId: 'sub_sci',
            subjectName: 'Science',
            teacherId: 'teacher_003',
            teacherName: 'Rajan M.'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY,
            period: 4,
            subjectId: 'sub_hindi',
            subjectName: 'Hindi',
            teacherId: 'teacher_004',
            teacherName: 'Deepa Menon'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY,
            period: 5,
            subjectId: 'sub_math',
            subjectName: 'Mathematics',
            teacherId: 'teacher_001',
            teacherName: 'Rajesh Kumar'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY,
            period: 6,
            subjectId: 'sub_eng',
            subjectName: 'English',
            teacherId: 'teacher_002',
            teacherName: 'Preeti Nair'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY,
            period: 7,
            subjectId: 'sub_social',
            subjectName: 'Social Studies',
            teacherId: 'teacher_005',
            teacherName: 'Suresh Babu'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].THURSDAY,
            period: 8,
            subjectId: 'sub_art',
            subjectName: 'Art',
            teacherId: 'teacher_007',
            teacherName: 'Vijay S.'
        },
        // Friday
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY,
            period: 1,
            subjectId: 'sub_hindi',
            subjectName: 'Hindi',
            teacherId: 'teacher_004',
            teacherName: 'Deepa Menon'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY,
            period: 2,
            subjectId: 'sub_math',
            subjectName: 'Mathematics',
            teacherId: 'teacher_001',
            teacherName: 'Rajesh Kumar'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY,
            period: 3,
            subjectId: 'sub_eng',
            subjectName: 'English',
            teacherId: 'teacher_002',
            teacherName: 'Preeti Nair'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY,
            period: 4,
            subjectId: 'sub_sci',
            subjectName: 'Science',
            teacherId: 'teacher_003',
            teacherName: 'Rajan M.'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY,
            period: 5,
            subjectId: 'sub_social',
            subjectName: 'Social Studies',
            teacherId: 'teacher_005',
            teacherName: 'Suresh Babu'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY,
            period: 6,
            subjectId: 'sub_math',
            subjectName: 'Mathematics',
            teacherId: 'teacher_001',
            teacherName: 'Rajesh Kumar'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY,
            period: 7,
            subjectId: 'sub_hindi',
            subjectName: 'Hindi',
            teacherId: 'teacher_004',
            teacherName: 'Deepa Menon'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].FRIDAY,
            period: 8,
            subjectId: 'sub_cs',
            subjectName: 'Computer Science',
            teacherId: 'teacher_006',
            teacherName: 'Anitha R.'
        },
        // Saturday (half day)
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].SATURDAY,
            period: 1,
            subjectId: 'sub_eng',
            subjectName: 'English',
            teacherId: 'teacher_002',
            teacherName: 'Preeti Nair'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].SATURDAY,
            period: 2,
            subjectId: 'sub_sci',
            subjectName: 'Science',
            teacherId: 'teacher_003',
            teacherName: 'Rajan M.'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].SATURDAY,
            period: 3,
            subjectId: 'sub_math',
            subjectName: 'Mathematics',
            teacherId: 'teacher_001',
            teacherName: 'Rajesh Kumar'
        },
        {
            day: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DayOfWeek"].SATURDAY,
            period: 4,
            subjectId: 'sub_hindi',
            subjectName: 'Hindi',
            teacherId: 'teacher_004',
            teacherName: 'Deepa Menon'
        }
    ],
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01')
};
const DEMO_ATTENDANCE = [
    {
        id: 'att_001',
        date: new Date().toISOString().split('T')[0],
        classId: 'class_005',
        sectionId: 'sec_5a',
        period: 1,
        subjectId: 'sub_math',
        teacherId: 'teacher_001',
        className: 'Class 5',
        sectionName: 'A',
        subjectName: 'Mathematics',
        teacherName: 'Rajesh Kumar',
        records: DEMO_STUDENTS.filter((s)=>s.classId === 'class_005' && s.sectionId === 'sec_5a').map((s, i)=>({
                studentId: s.id,
                studentName: s.name,
                status: i === 2 || i === 4 ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AttendanceStatus"].ABSENT : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AttendanceStatus"].PRESENT
            })),
        submittedAt: new Date()
    }
];
const DEMO_MARKS = [
    {
        id: 'marks_001',
        examType: 'midterm',
        examName: 'Mid-Term Examination 2026',
        classId: 'class_005',
        sectionId: 'sec_5a',
        subjectId: 'sub_math',
        teacherId: 'teacher_001',
        maxMarks: 100,
        className: 'Class 5',
        sectionName: 'A',
        subjectName: 'Mathematics',
        records: DEMO_STUDENTS.filter((s)=>s.classId === 'class_005' && s.sectionId === 'sec_5a').map((s)=>{
            const marks = Math.floor(Math.random() * 40) + 60;
            return {
                studentId: s.id,
                studentName: s.name,
                marksObtained: marks,
                grade: marks >= 90 ? 'A+' : marks >= 80 ? 'A' : marks >= 70 ? 'B+' : marks >= 60 ? 'B' : 'C+'
            };
        }),
        status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MarksStatus"].PUBLISHED,
        createdAt: new Date('2026-03-15'),
        publishedAt: new Date('2026-03-20')
    }
];
const DEMO_ASSIGNMENTS = [
    {
        id: 'assign_001',
        title: 'Mathematics Worksheet — Fractions',
        description: 'Complete exercises 1-20 from chapter 5. Show all working steps.',
        classId: 'class_005',
        sectionId: 'sec_5a',
        subjectId: 'sub_math',
        teacherId: 'teacher_001',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        attachments: [],
        status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AssignmentStatus"].ACTIVE,
        className: 'Class 5',
        sectionName: 'A',
        subjectName: 'Mathematics',
        teacherName: 'Rajesh Kumar',
        createdAt: new Date('2026-04-11'),
        updatedAt: new Date('2026-04-11')
    },
    {
        id: 'assign_002',
        title: 'English Essay — My Favorite Season',
        description: 'Write a 300-word essay on your favorite season. Include descriptive language.',
        classId: 'class_005',
        sectionId: 'sec_5a',
        subjectId: 'sub_eng',
        teacherId: 'teacher_002',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        attachments: [],
        status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AssignmentStatus"].ACTIVE,
        className: 'Class 5',
        sectionName: 'A',
        subjectName: 'English',
        teacherName: 'Preeti Nair',
        createdAt: new Date('2026-04-10'),
        updatedAt: new Date('2026-04-10')
    },
    {
        id: 'assign_003',
        title: 'Science Project — Solar System Model',
        description: 'Create a 3D model of the solar system using household materials.',
        classId: 'class_005',
        sectionId: 'sec_5a',
        subjectId: 'sub_sci',
        teacherId: 'teacher_003',
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        attachments: [],
        status: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AssignmentStatus"].ACTIVE,
        className: 'Class 5',
        sectionName: 'A',
        subjectName: 'Science',
        teacherName: 'Rajan M.',
        createdAt: new Date('2026-04-08'),
        updatedAt: new Date('2026-04-08')
    }
];
const DEMO_MATERIALS = [
    {
        id: 'mat_001',
        title: 'Chapter 5 — Fractions Notes',
        description: 'Comprehensive notes on fractions, practice problems included.',
        classId: 'class_005',
        sectionId: 'sec_5a',
        subjectId: 'sub_math',
        teacherId: 'teacher_001',
        files: [
            {
                name: 'Fractions_Notes.pdf',
                url: '#',
                size: 2500000
            }
        ],
        className: 'Class 5',
        sectionName: 'A',
        subjectName: 'Mathematics',
        teacherName: 'Rajesh Kumar',
        createdAt: new Date('2026-04-05'),
        updatedAt: new Date('2026-04-05')
    }
];
const DEMO_FEE_STRUCTURES = [
    {
        id: 'fee_struct_001',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FeeType"].STRUCTURE,
        classId: 'class_005',
        academicYear: '2026-27',
        className: 'Class 5',
        categories: [
            {
                name: 'Tuition Fee',
                amount: 30000,
                installments: [
                    {
                        dueDate: new Date('2026-04-30'),
                        amount: 10000
                    },
                    {
                        dueDate: new Date('2026-08-31'),
                        amount: 10000
                    },
                    {
                        dueDate: new Date('2026-12-31'),
                        amount: 10000
                    }
                ]
            },
            {
                name: 'Transport Fee',
                amount: 12000,
                installments: [
                    {
                        dueDate: new Date('2026-04-30'),
                        amount: 4000
                    },
                    {
                        dueDate: new Date('2026-08-31'),
                        amount: 4000
                    },
                    {
                        dueDate: new Date('2026-12-31'),
                        amount: 4000
                    }
                ]
            },
            {
                name: 'Lab Fee',
                amount: 3000
            },
            {
                name: 'Library Fee',
                amount: 1500
            },
            {
                name: 'Activity Fee',
                amount: 2000
            }
        ],
        totalAmount: 48500,
        createdAt: new Date('2026-03-01')
    }
];
const DEMO_PAYMENTS = [
    {
        id: 'pay_001',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FeeType"].PAYMENT,
        studentId: 'student_001',
        studentName: 'Arun Kumar',
        classId: 'class_005',
        className: 'Class 5',
        amount: 14000,
        mode: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PaymentMode"].UPI,
        referenceNumber: 'UPI-20260401-001',
        receiptNumber: 'RCP-20260401-A1B2',
        category: 'Tuition Fee + Lab Fee',
        receivedBy: 'user_admin_001',
        paidAt: new Date('2026-04-01'),
        createdAt: new Date('2026-04-01')
    },
    {
        id: 'pay_002',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FeeType"].PAYMENT,
        studentId: 'student_003',
        studentName: 'Karthik R.',
        classId: 'class_005',
        className: 'Class 5',
        amount: 10000,
        mode: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PaymentMode"].CASH,
        referenceNumber: '',
        receiptNumber: 'RCP-20260405-C3D4',
        category: 'Tuition Fee',
        receivedBy: 'user_admin_001',
        paidAt: new Date('2026-04-05'),
        createdAt: new Date('2026-04-05')
    },
    {
        id: 'pay_003',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FeeType"].PAYMENT,
        studentId: 'student_005',
        studentName: 'Mohammed Irfan',
        classId: 'class_005',
        className: 'Class 5',
        amount: 48500,
        mode: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PaymentMode"].BANK_TRANSFER,
        referenceNumber: 'NEFT-20260408-1234',
        receiptNumber: 'RCP-20260408-E5F6',
        category: 'Full Year',
        receivedBy: 'user_admin_001',
        paidAt: new Date('2026-04-08'),
        createdAt: new Date('2026-04-08')
    }
];
const DEMO_CHATS = [
    {
        id: 'chat_001',
        participants: [
            'user_teacher_001',
            'user_parent_001'
        ],
        participantNames: {
            'user_teacher_001': 'Rajesh Kumar',
            'user_parent_001': 'Meena Devi'
        },
        participantRoles: {
            'user_teacher_001': 'teacher',
            'user_parent_001': 'parent'
        },
        lastMessage: {
            text: 'Arjun is doing well in Mathematics. Keep up the practice at home.',
            senderId: 'user_teacher_001',
            sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        unreadCount: {
            'user_teacher_001': 0,
            'user_parent_001': 1
        },
        createdAt: new Date('2026-04-01'),
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    },
    {
        id: 'chat_002',
        participants: [
            'user_teacher_002',
            'user_parent_001'
        ],
        participantNames: {
            'user_teacher_002': 'Preeti Nair',
            'user_parent_001': 'Meena Devi'
        },
        participantRoles: {
            'user_teacher_002': 'teacher',
            'user_parent_001': 'parent'
        },
        lastMessage: {
            text: 'Could you share the reading list for this month?',
            senderId: 'user_parent_001',
            sentAt: new Date(Date.now() - 5 * 60 * 60 * 1000)
        },
        unreadCount: {
            'user_teacher_002': 1,
            'user_parent_001': 0
        },
        createdAt: new Date('2026-04-05'),
        updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000)
    }
];
const DEMO_NOTIFICATIONS = [
    {
        id: 'notif_001',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NotificationType"].FEE_REMINDER,
        title: 'Fee Reminder',
        body: 'Term 1 fee of ₹10,000 is due on April 30. Please pay before the deadline.',
        targetRole: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].PARENT,
        targetUsers: [],
        targetClass: 'class_005',
        data: {
            screen: 'fees'
        },
        createdBy: 'system',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        readBy: []
    },
    {
        id: 'notif_002',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NotificationType"].TIMETABLE_CHANGE,
        title: 'Timetable Updated',
        body: 'Class 5-A timetable has been updated. Please check the new schedule.',
        targetRole: 'all',
        targetUsers: [],
        targetClass: 'class_005',
        data: {
            screen: 'timetable'
        },
        createdBy: 'user_admin_001',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        readBy: [
            'user_admin_001'
        ]
    },
    {
        id: 'notif_003',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NotificationType"].ATTENDANCE_ALERT,
        title: 'Attendance Alert',
        body: 'Karthik R. was marked absent in Period 1 (Mathematics) today.',
        targetRole: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].PARENT,
        targetUsers: [
            'user_parent_003'
        ],
        targetClass: 'class_005',
        data: {
            screen: 'attendance',
            studentId: 'student_003'
        },
        createdBy: 'system',
        createdAt: new Date(),
        readBy: []
    },
    {
        id: 'notif_004',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NotificationType"].ANNOUNCEMENT,
        title: 'Annual Sports Day',
        body: 'Annual Sports Day is scheduled for May 15, 2026. All parents are invited to attend.',
        targetRole: 'all',
        targetUsers: [],
        data: {},
        createdBy: 'user_admin_001',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        readBy: []
    },
    {
        id: 'notif_005',
        type: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NotificationType"].ASSIGNMENT_DUE,
        title: 'Assignment Due Soon',
        body: 'Mathematics Worksheet — Fractions is due in 2 days.',
        targetRole: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].PARENT,
        targetUsers: [],
        targetClass: 'class_005',
        data: {
            screen: 'assignments',
            assignmentId: 'assign_001'
        },
        createdBy: 'system',
        createdAt: new Date(),
        readBy: []
    }
];
const DEMO_ADMIN_STATS = {
    totalStudents: 420,
    totalTeachers: 32,
    avgAttendance: 92.3,
    totalFeeCollected: 1840000,
    pendingFees: 560000,
    totalClasses: 12
};
const DEMO_ATTENDANCE_TREND = [
    {
        day: 'Mon',
        percentage: 94
    },
    {
        day: 'Tue',
        percentage: 91
    },
    {
        day: 'Wed',
        percentage: 93
    },
    {
        day: 'Thu',
        percentage: 89
    },
    {
        day: 'Fri',
        percentage: 95
    },
    {
        day: 'Sat',
        percentage: 88
    },
    {
        day: 'Today',
        percentage: 92
    }
];
const DEMO_FEE_BY_CLASS = [
    {
        class: 'Class 1',
        collected: 280000,
        target: 350000
    },
    {
        class: 'Class 5',
        collected: 320000,
        target: 400000
    },
    {
        class: 'Class 8',
        collected: 410000,
        target: 500000
    },
    {
        class: 'Class 10',
        collected: 380000,
        target: 420000
    }
];
const DEMO_RECENT_ACTIVITY = [
    {
        id: 'act_1',
        text: 'New student Bhavya S. enrolled in Class 5-A',
        time: '2 hours ago',
        icon: 'user-plus',
        color: 'var(--color-success)'
    },
    {
        id: 'act_2',
        text: 'Timetable published for Class 8-A',
        time: '4 hours ago',
        icon: 'calendar',
        color: 'var(--color-primary-500)'
    },
    {
        id: 'act_3',
        text: 'Fee payment of ₹48,500 received from Mohammed Irfan',
        time: 'Yesterday',
        icon: 'credit-card',
        color: 'var(--color-success)'
    },
    {
        id: 'act_4',
        text: 'Rajan M. marked leave for Thursday P1-P2',
        time: 'Yesterday',
        icon: 'clock',
        color: 'var(--color-warning)'
    },
    {
        id: 'act_5',
        text: 'Mid-term marks published for Class 5-A Mathematics',
        time: '3 days ago',
        icon: 'bar-chart',
        color: 'var(--color-info)'
    }
];
var _c, _c1;
__turbopack_context__.k.register(_c, "DEMO_STUDENTS$studentNames.map");
__turbopack_context__.k.register(_c1, "DEMO_STUDENTS");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/firebase.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "app",
    ()=>app,
    "auth",
    ()=>auth,
    "db",
    ()=>db,
    "storage",
    ()=>storage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$app$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/app/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$app$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@firebase/app/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$auth$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/auth/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$auth$2f$dist$2f$esm$2f$index$2d$568d0403$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__p__as__getAuth$3e$__ = __turbopack_context__.i("[project]/node_modules/@firebase/auth/dist/esm/index-568d0403.js [app-client] (ecmascript) <export p as getAuth>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/firestore/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$common$2d$fe7037b3$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__aX__as__getFirestore$3e$__ = __turbopack_context__.i("[project]/node_modules/@firebase/firestore/dist/common-fe7037b3.esm.js [app-client] (ecmascript) <export aX as getFirestore>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$storage$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/storage/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$storage$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@firebase/storage/dist/index.esm.js [app-client] (ecmascript)");
;
;
;
;
const firebaseConfig = {
    apiKey: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDBAGMZcRz8-2In_S2evmMTKZudsg5c10w",
    authDomain: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "zschool-e0f43.firebaseapp.com",
    projectId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "zschool-e0f43",
    storageBucket: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "zschool-e0f43.firebasestorage.app",
    messagingSenderId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "245257336248",
    appId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:245257336248:web:dd20bf2c9a913cc4eb4b4d"
};
// Initialize Firebase
const app = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$app$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getApps"])().length === 0 ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$app$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["initializeApp"])(firebaseConfig) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$app$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getApp"])();
const auth = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$auth$2f$dist$2f$esm$2f$index$2d$568d0403$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__p__as__getAuth$3e$__["getAuth"])(app);
const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$common$2d$fe7037b3$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__aX__as__getFirestore$3e$__["getFirestore"])(app);
const storage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$storage$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getStorage"])(app);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "calculateAttendancePercentage",
    ()=>calculateAttendancePercentage,
    "calculateGrade",
    ()=>calculateGrade,
    "cn",
    ()=>cn,
    "debounce",
    ()=>debounce,
    "formatCompactCurrency",
    ()=>formatCompactCurrency,
    "formatCurrency",
    ()=>formatCurrency,
    "formatDate",
    ()=>formatDate,
    "formatFileSize",
    ()=>formatFileSize,
    "formatRelativeDate",
    ()=>formatRelativeDate,
    "formatTime",
    ()=>formatTime,
    "generateAdmissionNumber",
    ()=>generateAdmissionNumber,
    "generateId",
    ()=>generateId,
    "generateReceiptNumber",
    ()=>generateReceiptNumber,
    "getCurrentPeriod",
    ()=>getCurrentPeriod,
    "getGreeting",
    ()=>getGreeting,
    "getInitials",
    ()=>getInitials,
    "getSubjectColor",
    ()=>getSubjectColor,
    "getTodayDayOfWeek",
    ()=>getTodayDayOfWeek,
    "truncate",
    ()=>truncate
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/date-fns/format.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$formatDistanceToNow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/formatDistanceToNow.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isToday$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/isToday.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isYesterday$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/isYesterday.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/parseISO.js [app-client] (ecmascript)");
;
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
function generateAdmissionNumber(prefix, count) {
    const year = new Date().getFullYear();
    const padded = String(count + 1).padStart(4, '0');
    return `${prefix}-${year}-${padded}`;
}
function generateReceiptNumber() {
    const date = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(new Date(), 'yyyyMMdd');
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `RCP-${date}-${random}`;
}
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}
function formatCompactCurrency(amount) {
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
function formatDate(date) {
    const d = typeof date === 'string' ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(date) : date;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(d, 'MMM dd, yyyy');
}
function formatRelativeDate(date) {
    const d = typeof date === 'string' ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseISO"])(date) : date;
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isToday$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isToday"])(d)) return 'Today';
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$isYesterday$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isYesterday"])(d)) return 'Yesterday';
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$formatDistanceToNow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatDistanceToNow"])(d, {
        addSuffix: true
    });
}
function formatTime(time) {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    return `${h}:${String(minutes).padStart(2, '0')} ${period}`;
}
function getCurrentPeriod(timings) {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    for (const timing of timings){
        if (timing.period && currentTime >= timing.start && currentTime < timing.end) {
            return timing.period;
        }
    }
    return null;
}
function getTodayDayOfWeek() {
    const days = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday'
    ];
    return days[new Date().getDay()];
}
function calculateAttendancePercentage(present, total) {
    if (total === 0) return 0;
    return Math.round(present / total * 100);
}
function calculateGrade(marks, maxMarks, gradeScale) {
    const percentage = marks / maxMarks * 100;
    for (const scale of gradeScale){
        if (percentage >= scale.min && percentage <= scale.max) {
            return scale.grade;
        }
    }
    return 'N/A';
}
function getSubjectColor(subjectName) {
    const name = subjectName.toLowerCase();
    const colorMap = {
        math: {
            color: '#6366F1',
            bg: '#EEF2FF'
        },
        mathematics: {
            color: '#6366F1',
            bg: '#EEF2FF'
        },
        english: {
            color: '#EC4899',
            bg: '#FDF2F8'
        },
        science: {
            color: '#10B981',
            bg: '#ECFDF5'
        },
        hindi: {
            color: '#F59E0B',
            bg: '#FFFBEB'
        },
        social: {
            color: '#8B5CF6',
            bg: '#F5F3FF'
        },
        'social studies': {
            color: '#8B5CF6',
            bg: '#F5F3FF'
        },
        pe: {
            color: '#14B8A6',
            bg: '#F0FDFA'
        },
        'physical education': {
            color: '#14B8A6',
            bg: '#F0FDFA'
        },
        computer: {
            color: '#3B82F6',
            bg: '#EFF6FF'
        },
        'computer science': {
            color: '#3B82F6',
            bg: '#EFF6FF'
        },
        art: {
            color: '#F97316',
            bg: '#FFF7ED'
        }
    };
    for (const [key, value] of Object.entries(colorMap)){
        if (name.includes(key)) return value;
    }
    // Default color
    return {
        color: '#64748B',
        bg: '#F1F5F9'
    };
}
function debounce(func, wait) {
    let timeout;
    return (...args)=>{
        clearTimeout(timeout);
        timeout = setTimeout(()=>func(...args), wait);
    };
}
function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}
function getInitials(name) {
    return name.split(' ').map((n)=>n[0]).join('').toUpperCase().slice(0, 2);
}
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/context/AuthContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthProvider",
    ()=>AuthProvider,
    "default",
    ()=>__TURBOPACK__default__export__,
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/types/enums.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$demo$2d$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/demo-data.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/firebase.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$auth$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/auth/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$auth$2f$dist$2f$esm$2f$index$2d$568d0403$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__ac__as__signInWithEmailAndPassword$3e$__ = __turbopack_context__.i("[project]/node_modules/@firebase/auth/dist/esm/index-568d0403.js [app-client] (ecmascript) <export ac as signInWithEmailAndPassword>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$auth$2f$dist$2f$esm$2f$index$2d$568d0403$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__ab__as__createUserWithEmailAndPassword$3e$__ = __turbopack_context__.i("[project]/node_modules/@firebase/auth/dist/esm/index-568d0403.js [app-client] (ecmascript) <export ab as createUserWithEmailAndPassword>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$auth$2f$dist$2f$esm$2f$index$2d$568d0403$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__z__as__onAuthStateChanged$3e$__ = __turbopack_context__.i("[project]/node_modules/@firebase/auth/dist/esm/index-568d0403.js [app-client] (ecmascript) <export z as onAuthStateChanged>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$auth$2f$dist$2f$esm$2f$index$2d$568d0403$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__D__as__signOut$3e$__ = __turbopack_context__.i("[project]/node_modules/@firebase/auth/dist/esm/index-568d0403.js [app-client] (ecmascript) <export D as signOut>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/firestore/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$common$2d$fe7037b3$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a6__as__doc$3e$__ = __turbopack_context__.i("[project]/node_modules/@firebase/firestore/dist/common-fe7037b3.esm.js [app-client] (ecmascript) <export a6 as doc>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@firebase/firestore/dist/index.esm.js [app-client] (ecmascript) <locals>");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
const AuthContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function AuthProvider({ children }) {
    _s();
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        user: null,
        role: null,
        schoolId: 'school_demo_001',
        loading: true,
        error: null
    });
    // Listen to Firebase Auth state changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            const unsubscribe = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$auth$2f$dist$2f$esm$2f$index$2d$568d0403$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__z__as__onAuthStateChanged$3e$__["onAuthStateChanged"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["auth"], {
                "AuthProvider.useEffect.unsubscribe": async (firebaseUser)=>{
                    if (firebaseUser) {
                        try {
                            const userDoc = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getDoc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$common$2d$fe7037b3$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a6__as__doc$3e$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', firebaseUser.uid));
                            if (userDoc.exists()) {
                                const userData = userDoc.data();
                                // Convert timestamps back to Date objects if needed because Firestore stores them as Timestamps
                                // But relying on our naive User type, this suffices for demo functionality.
                                setState({
                                    user: userData,
                                    role: userData.role,
                                    schoolId: 'school_demo_001',
                                    loading: false,
                                    error: null
                                });
                                return;
                            }
                        } catch (error) {
                            console.error('Error fetching user data:', error);
                        }
                    }
                    setState({
                        user: null,
                        role: null,
                        schoolId: 'school_demo_001',
                        loading: false,
                        error: null
                    });
                }
            }["AuthProvider.useEffect.unsubscribe"]);
            return ({
                "AuthProvider.useEffect": ()=>unsubscribe()
            })["AuthProvider.useEffect"];
        }
    }["AuthProvider.useEffect"], []);
    const login = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[login]": async (email, password)=>{
            setState({
                "AuthProvider.useCallback[login]": (prev)=>({
                        ...prev,
                        loading: true,
                        error: null
                    })
            }["AuthProvider.useCallback[login]"]);
            try {
                // 1. Try to login
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$auth$2f$dist$2f$esm$2f$index$2d$568d0403$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__ac__as__signInWithEmailAndPassword$3e$__["signInWithEmailAndPassword"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["auth"], email, password);
            } catch (err) {
                // 2. If user doesn't exist, try to auto-seed them (for demo purposes only)
                if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                    try {
                        // Identify which demo user this might be
                        let mappedRole = null;
                        if (email.includes('admin')) mappedRole = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].ADMIN;
                        else if (email.includes('principal')) mappedRole = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].PRINCIPAL;
                        else if (email.includes('correspondent')) mappedRole = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].CORRESPONDENT;
                        else if (email.includes('teacher')) mappedRole = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].TEACHER;
                        else if (email.includes('parent')) mappedRole = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2f$enums$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UserRole"].PARENT;
                        if (mappedRole) {
                            // If they are explicitly trying to seed but used the old 'demo' password which is too short, suggest the right one
                            if (password.length < 6) {
                                setState({
                                    "AuthProvider.useCallback[login]": (prev)=>({
                                            ...prev,
                                            loading: false,
                                            error: 'Firebase requires 6+ character passwords. Please use "demo1234" instead of "demo".'
                                        })
                                }["AuthProvider.useCallback[login]"]);
                                return;
                            }
                            // Auto register
                            const userCredential = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$auth$2f$dist$2f$esm$2f$index$2d$568d0403$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__ab__as__createUserWithEmailAndPassword$3e$__["createUserWithEmailAndPassword"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["auth"], email, password);
                            const user = userCredential.user;
                            // Get seed data
                            const seedUser = {
                                ...__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$demo$2d$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_USERS"][mappedRole]
                            };
                            seedUser.uid = user.uid; // Update to actual firebase uid
                            // Convert Dates to ISO strings before saving to Firestore so they don't break
                            const dataToSave = JSON.parse(JSON.stringify(seedUser));
                            // Seed to Firestore
                            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["setDoc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$common$2d$fe7037b3$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__a6__as__doc$3e$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], 'users', user.uid), dataToSave);
                            // Login succeeds after registration because auth state changes
                            return;
                        }
                    } catch (seedErr) {
                        console.error("Auto-seeding failed", seedErr);
                        if (seedErr.code === 'auth/weak-password') {
                            setState({
                                "AuthProvider.useCallback[login]": (prev)=>({
                                        ...prev,
                                        loading: false,
                                        error: 'Password is too weak. Demo accounts require "demo1234".'
                                    })
                            }["AuthProvider.useCallback[login]"]);
                            return;
                        }
                    }
                }
                setState({
                    "AuthProvider.useCallback[login]": (prev)=>({
                            ...prev,
                            loading: false,
                            error: 'Invalid credentials. Please try again.'
                        })
                }["AuthProvider.useCallback[login]"]);
                return; // Do not throw so we don't trigger Next.js error overlays
            }
        }
    }["AuthProvider.useCallback[login]"], []);
    const logout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[logout]": async ()=>{
            setState({
                "AuthProvider.useCallback[logout]": (prev)=>({
                        ...prev,
                        loading: true
                    })
            }["AuthProvider.useCallback[logout]"]);
            try {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$auth$2f$dist$2f$esm$2f$index$2d$568d0403$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__D__as__signOut$3e$__["signOut"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["auth"]);
            } catch (error) {
                console.error('Logout error:', error);
                setState({
                    "AuthProvider.useCallback[logout]": (prev)=>({
                            ...prev,
                            loading: false
                        })
                }["AuthProvider.useCallback[logout]"]);
            }
        }
    }["AuthProvider.useCallback[logout]"], []);
    const switchRole = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[switchRole]": (role)=>{
            const user = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$demo$2d$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_USERS"][role];
            setState({
                "AuthProvider.useCallback[switchRole]": (prev)=>({
                        ...prev,
                        user,
                        role
                    })
            }["AuthProvider.useCallback[switchRole]"]);
        }
    }["AuthProvider.useCallback[switchRole]"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthContext.Provider, {
        value: {
            ...state,
            login,
            logout,
            switchRole
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/context/AuthContext.tsx",
        lineNumber: 161,
        columnNumber: 5
    }, this);
}
_s(AuthProvider, "tRzu4d9RJDP4lb4Y/y7mJGJeSOs=");
_c = AuthProvider;
function useAuth() {
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
_s1(useAuth, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
const __TURBOPACK__default__export__ = AuthContext;
var _c;
__turbopack_context__.k.register(_c, "AuthProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/context/SchoolContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SchoolProvider",
    ()=>SchoolProvider,
    "default",
    ()=>__TURBOPACK__default__export__,
    "useSchool",
    ()=>useSchool
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$demo$2d$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/demo-data.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
const SchoolContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function SchoolProvider({ children }) {
    _s();
    const [school, setSchool] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$demo$2d$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_SCHOOL"]);
    const updateSchool = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SchoolProvider.useCallback[updateSchool]": (updates)=>{
            setSchool({
                "SchoolProvider.useCallback[updateSchool]": (prev)=>({
                        ...prev,
                        ...updates
                    })
            }["SchoolProvider.useCallback[updateSchool]"]);
        }
    }["SchoolProvider.useCallback[updateSchool]"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SchoolContext.Provider, {
        value: {
            school,
            updateSchool
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/context/SchoolContext.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
_s(SchoolProvider, "QhWPZTtC3wO/cgktJbOo77dZAa8=");
_c = SchoolProvider;
function useSchool() {
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(SchoolContext);
    if (context === undefined) {
        throw new Error('useSchool must be used within a SchoolProvider');
    }
    return context;
}
_s1(useSchool, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
const __TURBOPACK__default__export__ = SchoolContext;
var _c;
__turbopack_context__.k.register(_c, "SchoolProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/context/ThemeContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeProvider",
    ()=>ThemeProvider,
    "default",
    ()=>__TURBOPACK__default__export__,
    "useTheme",
    ()=>useTheme
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
const ThemeContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function ThemeProvider({ children }) {
    // Light mode only - no theme switching
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ThemeContext.Provider, {
        value: {
            theme: 'light'
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/context/ThemeContext.tsx",
        lineNumber: 18,
        columnNumber: 5
    }, this);
}
_c = ThemeProvider;
function useTheme() {
    _s();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
_s(useTheme, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
const __TURBOPACK__default__export__ = ThemeContext;
var _c;
__turbopack_context__.k.register(_c, "ThemeProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>HomePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/context/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$SchoolContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/context/SchoolContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$ThemeContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/context/ThemeContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Toast.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$LoginPage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/LoginPage.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$layout$2f$DashboardLayout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/layout/DashboardLayout.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
function AppContent() {
    _s();
    const { user, loading } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            style: {
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-surface-dim)'
            },
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-4)'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            width: 48,
                            height: 48,
                            border: '3px solid var(--color-border)',
                            borderTopColor: 'var(--color-primary-500)',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite'
                        }
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 29,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        style: {
                            font: 'var(--text-body-sm)',
                            color: 'var(--color-text-tertiary)'
                        },
                        children: "Loading Maruti School..."
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 37,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 23,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/app/page.tsx",
            lineNumber: 16,
            columnNumber: 7
        }, this);
    }
    if (!user) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$LoginPage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
            fileName: "[project]/src/app/page.tsx",
            lineNumber: 44,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$layout$2f$DashboardLayout$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
        fileName: "[project]/src/app/page.tsx",
        lineNumber: 47,
        columnNumber: 10
    }, this);
}
_s(AppContent, "EmJkapf7qiLC5Br5eCoEq4veZes=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = AppContent;
function HomePage() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$ThemeContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ThemeProvider"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AuthProvider"], {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$SchoolContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SchoolProvider"], {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ToastProvider"], {
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AppContent, {}, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 56,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/app/page.tsx",
                    lineNumber: 55,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 54,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/app/page.tsx",
            lineNumber: 53,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/page.tsx",
        lineNumber: 52,
        columnNumber: 5
    }, this);
}
_c1 = HomePage;
var _c, _c1;
__turbopack_context__.k.register(_c, "AppContent");
__turbopack_context__.k.register(_c1, "HomePage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_0t-6p07._.js.map