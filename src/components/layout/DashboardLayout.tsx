'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/enums';
import { hasCapability, isAdminLike, isTeacherLike, type Capability } from '@/lib/permissions';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import Header from '@/components/layout/Header';
import {
  UsersIcon, SchoolIcon, ClipboardCheckIcon,
  BarChartIcon, SettingsIcon, FileTextIcon,
  BookOpenIcon, CreditCardIcon, CalendarIcon,
  GraduationCapIcon, ClockIcon
} from '@/components/ui/Icons';
import styles from './DashboardLayout.module.css';

// All sub-pages for each role
import AdminDashboard from './admin/AdminDashboard';
import AdminStudents from './admin/AdminStudents';
import AdminTeachers from './admin/AdminTeachers';
import AdminClasses from './admin/AdminClasses';
import AdminTimetable from './admin/AdminTimetable';
import AdminAttendance from './admin/AdminAttendance';
import AdminExams from './admin/AdminExams';
import AdminExamResults from './admin/AdminExamResults';
import SharedReportCard from './shared/SharedReportCard';
import TeacherCoScholastic from './teacher/TeacherCoScholastic';
import AdminReports from './admin/AdminReports';
import AdminSettings from './admin/AdminSettings';
import AdminBus from './admin/AdminBus';

/* ── Principal Register (standalone; shares no data with the legacy fee
      module, whose screens — AdminFees, TeacherFees, PrincipalDefaulters —
      are deliberately left on disk but UNROUTED). ── */
import PrincipalFeesNote from './principal/note/PrincipalFeesNote';
import ClassWiseSection from './principal/registers/ClassWiseSection';
import TeacherWiseSection from './principal/registers/TeacherWiseSection';
import PrincipalAccounts from './principal/PrincipalAccounts';
import PrincipalActivity from './principal/activity/PrincipalActivity';

import TeacherDashboard from './teacher/TeacherDashboard';
import TeacherTimetable from './teacher/TeacherTimetable';
import TeacherAttendance from './teacher/TeacherAttendance';
import TeacherAssignments from './teacher/TeacherAssignments';
import TeacherClassOverview from './teacher/TeacherClassOverview';
import TeacherWeeklyMarks from './teacher/TeacherWeeklyMarks';
import TeacherClassTests from './teacher/TeacherClassTests';
import TeacherExamMarks from './teacher/TeacherExamMarks';

import ParentDashboard from './parent/ParentDashboard';
import ParentAttendance from './parent/ParentAttendance';
import ParentTimetable from './parent/ParentTimetable';
import ParentMarks from './parent/ParentMarks';
import ParentClassTests from './parent/ParentClassTests';
import ParentAssignments from './parent/ParentAssignments';
import ParentFees from './parent/ParentFees';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  students: 'Students',
  teachers: 'Teachers',
  classes: 'Classes & Sections',
  timetable: 'Timetable',
  attendance: 'Attendance Management',
  // Parent-only key; the admin/teacher fee pages are retired.
  fees: 'Fee Details',
  // Principal Register
  'principal-note': 'Fees Note',
  'principal-classes': 'Class-wise Register',
  'principal-teachers': 'Teacher-wise Register',
  'principal-accounts': "Today's Billing & Expenses",
  'principal-monthly': 'Accounts (Monthly)',
  'principal-activity': 'Activity Log',
  reports: 'Reports',
  settings: 'Settings',
  assignments: 'Assignments',
  'weekly-marks': 'Weekly Test Marks',
  'exam-marks': 'Exam Marks Entry',
  'major-exams': 'Major Exams',
  'weekly-tests': 'Weekly Tests',
  'class-tests': 'Class Tests',
  'exam-results': 'Class Exam Results',
  'exams': 'Academic Calendar',
  'report-card': 'Student Report Card',
  'co-scholastic': 'Co-Scholastic & Remarks',
  'bus-students': 'Bus Commuters List',
  'bus-routes': 'Transportation Routes',
  'my-class': 'My Class Overview',
  'class-students': 'My Students',
  'class-attendance': 'Class Attendance',
  'class-performance': 'Class Performance',
};

/**
 * Header title for a page key. The teacher-wise register is the one page two
 * roles reach from opposite directions, so it is named for whoever is looking:
 * the Principal sees every teacher's list, a teacher sees only her own.
 */
function pageTitle(page: string, role: UserRole | null): string {
  if (page === 'principal-teachers' && isTeacherLike(role)) return "My Students' Fees";
  return PAGE_TITLES[page] || 'Maruti School';
}

export default function DashboardLayout() {
  const { role } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [showMore, setShowMore] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleNavigate = useCallback((id: string) => {
    setActivePage(id);
    setShowMore(false);
  }, []);

  const handleSidebarNavigate = useCallback((id: string) => {
    setActivePage(id);
  }, []);

  const renderPage = () => {
    if (isAdminLike(role)) {
      const adminHome = <AdminDashboard onNavigate={handleNavigate} />;
      const guard = (capability: Capability, page: React.ReactNode): React.ReactNode =>
        hasCapability(role, capability) ? page : adminHome;

      switch (activePage) {
        case 'dashboard': return <AdminDashboard onNavigate={handleNavigate} />;
        case 'students': return <AdminStudents />;
        case 'teachers': return <AdminTeachers />;
        case 'classes': return <AdminClasses />;
        case 'timetable': return <AdminTimetable />;
        case 'attendance': return <AdminAttendance />;
        case 'exams': return <AdminExams />;
        case 'exam-results': return <AdminExamResults />;
        case 'report-card': return <SharedReportCard view="admin" />;

        /* ── Principal Register. Every page is capability-gated: a role that
              lost the capability mid-session lands on the dashboard rather
              than on a screen whose writes firestore.rules would reject.
              The legacy 'fees' / 'fee-overview' / 'fee-structures' /
              'fee-payments' / 'accounts' / 'defaulters' routes are removed. ── */
        case 'principal-note': return guard('editPrincipalRegister', <PrincipalFeesNote />);
        case 'principal-classes': return guard('editPrincipalRegister', <ClassWiseSection />);
        case 'principal-teachers': return guard('viewPrincipalRegister', <TeacherWiseSection />);
        case 'principal-accounts': return guard('viewPrincipalAccounts', <PrincipalAccounts initialView="daily" />);
        case 'principal-monthly': return guard('viewPrincipalAccounts', <PrincipalAccounts initialView="monthly" />);
        // Off the nav by request, but the audit surface stays reachable —
        // removing the LOG would gut the accountability the rules promise.
        case 'principal-activity': return guard('viewPrincipalAccounts', <PrincipalActivity />);

        case 'reports': return <AdminReports />;
        case 'settings': return <AdminSettings />;
        case 'bus-students': return <AdminBus subPage="students" />;
        case 'bus-routes': return <AdminBus subPage="routes" />;
        default: return <AdminDashboard onNavigate={handleNavigate} />;
      }
    }
    
    if (isTeacherLike(role)) {
      const teacherHome = <TeacherDashboard onNavigate={handleNavigate} />;
      const guard = (capability: Capability, page: React.ReactNode): React.ReactNode =>
        hasCapability(role, capability) ? page : teacherHome;

      switch (activePage) {
        case 'dashboard': return <TeacherDashboard onNavigate={handleNavigate} />;
        case 'timetable': return <TeacherTimetable />;
        case 'attendance': return <TeacherAttendance />;
        case 'weekly-marks': return <TeacherWeeklyMarks />;
        case 'class-tests': return <TeacherClassTests />;
        case 'exam-marks': return <TeacherExamMarks />;
        case 'co-scholastic': return <TeacherCoScholastic />;
        case 'report-card': return <SharedReportCard view="teacher" />;
        case 'assignments': return <TeacherAssignments />;
        /* The teacher's only money page: the Principal Register rows assigned
           to them ("My Students' Fees"). The legacy 'collect-fees' route is
           removed; TeacherFees.tsx stays on disk, unrouted. */
        case 'principal-teachers': return guard('viewPrincipalRegister', <TeacherWiseSection />);
        case 'my-class': return <TeacherClassOverview view="dashboard" />;
        case 'class-students': return <TeacherClassOverview view="students" />;
        case 'class-attendance': return <TeacherClassOverview view="attendance" />;
        case 'class-performance': return <TeacherClassOverview view="performance" />;

        default: return <TeacherDashboard onNavigate={handleNavigate} />;
      }
    }

    // Parent
    switch (activePage) {
      case 'dashboard': return <ParentDashboard onNavigate={handleNavigate} />;
      case 'attendance': return <ParentAttendance />;
      case 'timetable': return <ParentTimetable />;
      case 'major-exams': return <ParentMarks defaultTab="major" />;
      case 'weekly-tests': return <ParentMarks defaultTab="weekly" />;
      case 'class-tests': return <ParentClassTests />;
      case 'assignments': return <ParentAssignments />;
      case 'fees': return <ParentFees />;
      case 'report-card': return <SharedReportCard view="parent" />;
      default: return <ParentDashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className={styles.layout}>
      <Sidebar activePage={activePage} onNavigate={handleSidebarNavigate} onCollapsedChange={setSidebarCollapsed} />

      <div className={`${styles.main} ${sidebarCollapsed ? styles.mainCollapsed : ''}`}>
        <Header title={pageTitle(activePage, role)} />
        
        <main className={styles.content}>
          {renderPage()}
        </main>

        {/* More Menu (mobile) */}
        {showMore && (
          <MoreMenu role={role!} activePage={activePage} onNavigate={handleNavigate} onClose={() => setShowMore(false)} />
        )}
      </div>

      <BottomNav activePage={activePage} onNavigate={handleNavigate} onMore={() => setShowMore(true)} />
    </div>
  );
}

function MoreMenu({
  role,
  activePage,
  onNavigate,
  onClose,
}: {
  role: UserRole;
  activePage: string;
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  const allItems: { id: string; icon: React.ReactNode; label: string }[] = isAdminLike(role)
    ? [
        // The Principal's bottom bar is taken up by the register pages, so the
        // two tabs it displaced — plus the register pages that did not fit —
        // live here. Everything stays capability-gated.
        ...(hasCapability(role, 'viewPrincipalAccounts')
          ? [
              { id: 'principal-teachers', icon: <UsersIcon size={22} />, label: 'Teacher-wise' },
              { id: 'principal-monthly', icon: <ClockIcon size={22} />, label: 'Monthly' },
              { id: 'students', icon: <GraduationCapIcon size={22} />, label: 'Students' },
              { id: 'timetable', icon: <CalendarIcon size={22} />, label: 'Timetable' },
            ]
          : []),
        { id: 'teachers', icon: <UsersIcon size={22} />, label: 'Teachers' },
        { id: 'classes', icon: <SchoolIcon size={22} />, label: 'Classes' },
        { id: 'attendance', icon: <ClipboardCheckIcon size={22} />, label: 'Attendance' },
        { id: 'reports', icon: <BarChartIcon size={22} />, label: 'Reports' },
        { id: 'settings', icon: <SettingsIcon size={22} />, label: 'Settings' },
      ]
    : isTeacherLike(role)
    ? [
        { id: 'class-tests', icon: <FileTextIcon size={22} />, label: 'Class Tests' },
        { id: 'assignments', icon: <BookOpenIcon size={22} />, label: 'Assignments' },
      ]
    : [
        { id: 'timetable', icon: <CalendarIcon size={22} />, label: 'Timetable' },
        { id: 'class-tests', icon: <FileTextIcon size={22} />, label: 'Class Tests' },
        { id: 'report-card', icon: <FileTextIcon size={22} />, label: 'Report Card' },
        { id: 'assignments', icon: <BookOpenIcon size={22} />, label: 'Assignments' },
        { id: 'fees', icon: <CreditCardIcon size={22} />, label: 'Fees' },
      ];

  return (
    <div className={styles.moreOverlay} onClick={onClose}>
      <div className={styles.moreMenu} onClick={e => e.stopPropagation()}>
        <div className={styles.moreHandle} />
        <h3 className={styles.moreTitle}>More</h3>
        <div className={styles.moreGrid}>
          {allItems.map(item => (
            <button
              key={item.id}
              className={`${styles.moreItem} ${activePage === item.id ? styles.moreActive : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className={styles.moreIcon}>{item.icon}</span>
              <span className={styles.moreLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
