'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/enums';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import Header from '@/components/layout/Header';
import {
  UsersIcon, SchoolIcon, ClipboardCheckIcon, MessageCircleIcon,
  BarChartIcon, SettingsIcon, FileTextIcon, FolderIcon,
  BookOpenIcon, CreditCardIcon
} from '@/components/ui/Icons';
import styles from './DashboardLayout.module.css';

// All sub-pages for each role
import AdminDashboard from './admin/AdminDashboard';
import AdminStudents from './admin/AdminStudents';
import AdminTeachers from './admin/AdminTeachers';
import AdminClasses from './admin/AdminClasses';
import AdminTimetable from './admin/AdminTimetable';
import AdminAttendance from './admin/AdminAttendance';
import AdminFees from './admin/AdminFees';
import AdminChat from './admin/AdminChat';
import AdminReports from './admin/AdminReports';
import AdminSettings from './admin/AdminSettings';

import TeacherDashboard from './teacher/TeacherDashboard';
import TeacherTimetable from './teacher/TeacherTimetable';
import TeacherAttendance from './teacher/TeacherAttendance';
import TeacherMarks from './teacher/TeacherMarks';
import TeacherAssignments from './teacher/TeacherAssignments';
import TeacherMaterials from './teacher/TeacherMaterials';
import TeacherChat from './teacher/TeacherChat';

import ParentDashboard from './parent/ParentDashboard';
import ParentAttendance from './parent/ParentAttendance';
import ParentTimetable from './parent/ParentTimetable';
import ParentMarks from './parent/ParentMarks';
import ParentAssignments from './parent/ParentAssignments';
import ParentFees from './parent/ParentFees';
import ParentChat from './parent/ParentChat';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  students: 'Students',
  teachers: 'Teachers',
  classes: 'Classes & Sections',
  timetable: 'Timetable',
  attendance: 'Attendance',
  fees: 'Fee Management',
  chat: 'Messages',
  reports: 'Reports',
  settings: 'Settings',
  marks: 'Marks & Grades',
  assignments: 'Assignments',
  materials: 'Study Materials',
};

export default function DashboardLayout() {
  const { role } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [showMore, setShowMore] = useState(false);

  const handleNavigate = useCallback((id: string) => {
    setActivePage(id);
    setShowMore(false);
  }, []);

  const handleSidebarNavigate = useCallback((id: string) => {
    setActivePage(id);
  }, []);

  const isAdminLike = role === UserRole.ADMIN || role === UserRole.PRINCIPAL || role === UserRole.CORRESPONDENT;

  const renderPage = () => {
    if (isAdminLike) {
      switch (activePage) {
        case 'dashboard': return <AdminDashboard onNavigate={handleNavigate} />;
        case 'students': return <AdminStudents />;
        case 'teachers': return <AdminTeachers />;
        case 'classes': return <AdminClasses />;
        case 'timetable': return <AdminTimetable />;
        case 'attendance': return <AdminAttendance />;
        case 'fees': return <AdminFees />;
        case 'chat': return <AdminChat />;
        case 'reports': return <AdminReports />;
        case 'settings': return <AdminSettings />;
        default: return <AdminDashboard onNavigate={handleNavigate} />;
      }
    }
    
    if (role === UserRole.TEACHER) {
      switch (activePage) {
        case 'dashboard': return <TeacherDashboard onNavigate={handleNavigate} />;
        case 'timetable': return <TeacherTimetable />;
        case 'attendance': return <TeacherAttendance />;
        case 'marks': return <TeacherMarks />;
        case 'assignments': return <TeacherAssignments />;
        case 'materials': return <TeacherMaterials />;
        case 'chat': return <TeacherChat />;
        default: return <TeacherDashboard onNavigate={handleNavigate} />;
      }
    }

    // Parent
    switch (activePage) {
      case 'dashboard': return <ParentDashboard onNavigate={handleNavigate} />;
      case 'attendance': return <ParentAttendance />;
      case 'timetable': return <ParentTimetable />;
      case 'marks': return <ParentMarks />;
      case 'assignments': return <ParentAssignments />;
      case 'fees': return <ParentFees />;
      case 'chat': return <ParentChat />;
      default: return <ParentDashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className={styles.layout}>
      <Sidebar activePage={activePage} onNavigate={handleSidebarNavigate} />
      
      <div className={styles.main}>
        <Header title={PAGE_TITLES[activePage] || 'CampusOS'} />
        
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
  const isAdminLike = role === UserRole.ADMIN || role === UserRole.PRINCIPAL || role === UserRole.CORRESPONDENT;
  
  const allItems: { id: string; icon: React.ReactNode; label: string }[] = isAdminLike
    ? [
        { id: 'teachers', icon: <UsersIcon size={22} />, label: 'Teachers' },
        { id: 'classes', icon: <SchoolIcon size={22} />, label: 'Classes' },
        { id: 'attendance', icon: <ClipboardCheckIcon size={22} />, label: 'Attendance' },
        { id: 'chat', icon: <MessageCircleIcon size={22} />, label: 'Messages' },
        { id: 'reports', icon: <BarChartIcon size={22} />, label: 'Reports' },
        { id: 'settings', icon: <SettingsIcon size={22} />, label: 'Settings' },
      ]
    : role === UserRole.TEACHER
    ? [
        { id: 'marks', icon: <FileTextIcon size={22} />, label: 'Marks' },
        { id: 'assignments', icon: <BookOpenIcon size={22} />, label: 'Assignments' },
        { id: 'materials', icon: <FolderIcon size={22} />, label: 'Materials' },
      ]
    : [
        { id: 'marks', icon: <FileTextIcon size={22} />, label: 'Marks' },
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
