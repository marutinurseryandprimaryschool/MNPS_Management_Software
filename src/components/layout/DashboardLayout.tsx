'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/enums';
import { hasCapability, isAdminLike, isTeacherLike } from '@/lib/permissions';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import Header from '@/components/layout/Header';
import {
  UsersIcon, SchoolIcon, ClipboardCheckIcon,
  BarChartIcon, SettingsIcon, FileTextIcon,
  BookOpenIcon, CreditCardIcon, CalendarIcon,
  GraduationCapIcon
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
import AdminFees from './admin/AdminFees';
import AdminReports from './admin/AdminReports';
import AdminSettings from './admin/AdminSettings';
import AdminBus from './admin/AdminBus';
import PrincipalAccounts from './principal/PrincipalAccounts';
import PrincipalDefaulters from './principal/PrincipalDefaulters';

import TeacherDashboard from './teacher/TeacherDashboard';
import TeacherTimetable from './teacher/TeacherTimetable';
import TeacherAttendance from './teacher/TeacherAttendance';
import TeacherMarks from './teacher/TeacherMarks';
import TeacherAssignments from './teacher/TeacherAssignments';
import TeacherFees from './teacher/TeacherFees';
import TeacherReportCard from './teacher/TeacherReportCard';
import TeacherFormative from './teacher/TeacherFormative';
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
  'fee-overview': 'Fee Overview',
  'fee-structures': 'Fee Structures',
  'fee-payments': 'Payments',
  fees: 'Fee Management',
  reports: 'Reports',
  settings: 'Settings',
  assignments: 'Assignments',
  'weekly-marks': 'Weekly Test Marks',
  'exam-marks': 'Exam Marks Entry',
  'major-exams': 'Major Exams',
  'weekly-tests': 'Weekly Tests',
  'class-tests': 'Class Tests',
  'accounts': 'Accounts',
  'defaulters': 'Defaulter Report',
  'exam-results': 'Class Exam Results',
  'exams': 'Academic Calendar',
  'report-card': 'Student Report Card',
  'co-scholastic': 'Co-Scholastic & Remarks',
  'collect-fees': 'Fee Register',
  'bus-students': 'Bus Commuters List',
  'bus-routes': 'Transportation Routes',
  'my-class': 'My Class Overview',
  'class-students': 'My Students',
  'class-attendance': 'Class Attendance',
  'class-performance': 'Class Performance',
};

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

        case 'fees': return <AdminFees />;
        case 'fee-overview': return <AdminFees subPage="overview" />;
        case 'fee-structures': return <AdminFees subPage="structures" />;
        case 'fee-payments': return <AdminFees subPage="payments" />;
        // The standalone Expenses page is retired (doc D9): expense entry now
        // lives inside the Principal Accounts module. Both principal pages are
        // strictly viewAccounts-gated (principal only).
        case 'accounts': return hasCapability(role, 'viewAccounts')
          ? <PrincipalAccounts />
          : <AdminDashboard onNavigate={handleNavigate} />;
        case 'defaulters': return hasCapability(role, 'viewAccounts')
          ? <PrincipalDefaulters />
          : <AdminDashboard onNavigate={handleNavigate} />;
        case 'reports': return <AdminReports />;
        case 'settings': return <AdminSettings />;
        case 'bus-students': return <AdminBus subPage="students" />;
        case 'bus-routes': return <AdminBus subPage="routes" />;
        default: return <AdminDashboard onNavigate={handleNavigate} />;
      }
    }
    
    if (isTeacherLike(role)) {
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
        case 'collect-fees': return <TeacherFees />;
        // 'expenses' route removed for teacher/staff — expense entry is
        // principal-only (doc D9); rules deny the write regardless.
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
        <Header title={PAGE_TITLES[activePage] || 'Maruti School'} />
        
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
        // Principal bottom tabs swap Students/Timetable for Accounts/Defaulters,
        // so those two move into More for viewAccounts holders.
        ...(hasCapability(role, 'viewAccounts')
          ? [
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
