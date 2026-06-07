'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { UserRole } from '@/types/enums';
import {
  DashboardIcon, GraduationCapIcon, UsersIcon, SchoolIcon,
  CalendarIcon, ClipboardCheckIcon, CreditCardIcon,
  BarChartIcon, SettingsIcon, FileTextIcon,
  BookOpenIcon, ChevronLeftIcon
} from '@/components/ui/Icons';
import styles from './Sidebar.module.css';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  href: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// ── Admin / Principal / Correspondent ──
const ADMIN_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', icon: <DashboardIcon size={20} />, label: 'Dashboard', href: '/admin' },
    ],
  },
  {
    title: 'People',
    items: [
      { id: 'students', icon: <GraduationCapIcon size={20} />, label: 'Students', href: '/admin/students' },
      { id: 'teachers', icon: <UsersIcon size={20} />, label: 'Teachers', href: '/admin/teachers' },
    ],
  },
  {
    title: 'Academics',
    items: [
      { id: 'classes', icon: <SchoolIcon size={20} />, label: 'Classes', href: '/admin/classes' },
      { id: 'timetable', icon: <CalendarIcon size={20} />, label: 'Timetable', href: '/admin/timetable' },
      { id: 'attendance', icon: <ClipboardCheckIcon size={20} />, label: 'Attendance', href: '/admin/attendance' },
      { id: 'exams', icon: <CalendarIcon size={20} />, label: 'Academic Calendar', href: '/admin/exams' },
      { id: 'exam-results', icon: <FileTextIcon size={20} />, label: 'Exam Results', href: '/admin/exam-results' },
      { id: 'report-card', icon: <FileTextIcon size={20} />, label: 'Report Card', href: '/admin/report-card' },
    ],
  },

  {
    title: 'Finance',
    items: [
      { id: 'fee-overview', icon: <CreditCardIcon size={20} />, label: 'Fee Overview', href: '/admin/fee-overview' },
      { id: 'fee-structures', icon: <SettingsIcon size={20} />, label: 'Fee Structures', href: '/admin/fee-structures' },
      { id: 'fee-payments', icon: <FileTextIcon size={20} />, label: 'Payments', href: '/admin/fee-payments' },
    ],
  },
  {
    title: 'Transportation',
    items: [
      { id: 'bus-students', icon: <UsersIcon size={20} />, label: 'Bus Students', href: '/admin/bus-students' },
      { id: 'bus-routes', icon: <SchoolIcon size={20} />, label: 'Bus Routes', href: '/admin/bus-routes' },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'reports', icon: <BarChartIcon size={20} />, label: 'Reports', href: '/admin/reports' },
      { id: 'settings', icon: <SettingsIcon size={20} />, label: 'Settings', href: '/admin/settings' },
    ],
  },
];

// ── Teacher ──
const TEACHER_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', icon: <DashboardIcon size={20} />, label: 'Dashboard', href: '/teacher' },
    ],
  },
  {
    title: 'MY CLASS',
    items: [
      { id: 'class-students', icon: <UsersIcon size={20} />, label: 'My Students', href: '/teacher/class-students' },
      { id: 'class-performance', icon: <BarChartIcon size={20} />, label: 'Class Performance', href: '/teacher/class-performance' },
    ],
  },
  {
    title: 'Teaching',
    items: [
      { id: 'timetable', icon: <CalendarIcon size={20} />, label: 'Timetable', href: '/teacher/timetable' },
      { id: 'attendance', icon: <ClipboardCheckIcon size={20} />, label: 'Attendance', href: '/teacher/attendance' },
    ],
  },

  {
    title: 'RESOURCES',
    items: [
      { id: 'assignments', icon: <BookOpenIcon size={20} />, label: 'Assignments', href: '/teacher/assignments' },
    ],
  },
  {
    title: 'MARKS',
    items: [
      { id: 'weekly-marks', icon: <FileTextIcon size={20} />, label: 'Weekly Marks', href: '/teacher/weekly-marks' },
      { id: 'exam-marks', icon: <ClipboardCheckIcon size={20} />, label: 'Exam Marks Entry', href: '/teacher/exam-marks' },
      { id: 'co-scholastic', icon: <FileTextIcon size={20} />, label: 'Co-Scholastic & Remarks', href: '/teacher/co-scholastic' },
      { id: 'report-card', icon: <FileTextIcon size={20} />, label: 'Report Card', href: '/teacher/report-card' },
    ],
  },
  {
    title: 'Other',
    items: [
      { id: 'collect-fees', icon: <CreditCardIcon size={20} />, label: 'Collect Fees', href: '/teacher/collect-fees' },
    ],
  },
];

// ── Parent ──
const PARENT_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', icon: <DashboardIcon size={20} />, label: 'Dashboard', href: '/parent' },
    ],
  },
  {
    title: 'Academics',
    items: [
      { id: 'attendance', icon: <ClipboardCheckIcon size={20} />, label: 'Attendance', href: '/parent/attendance' },
      { id: 'timetable', icon: <CalendarIcon size={20} />, label: 'Timetable', href: '/parent/timetable' },
      { id: 'report-card', icon: <FileTextIcon size={20} />, label: 'Report Card', href: '/parent/report-card' },
      { id: 'assignments', icon: <BookOpenIcon size={20} />, label: 'Assignments', href: '/parent/assignments' },
    ],
  },
  {
    title: 'Other',
    items: [
      { id: 'fees', icon: <CreditCardIcon size={20} />, label: 'Fees', href: '/parent/fees' },
    ],
  },
];

// Flat nav arrays for backward compatibility (used by DashboardLayout)
const ADMIN_NAV: NavItem[] = ADMIN_SECTIONS.flatMap(s => s.items);
const TEACHER_NAV: NavItem[] = TEACHER_SECTIONS.flatMap(s => s.items);
const PARENT_NAV: NavItem[] = PARENT_SECTIONS.flatMap(s => s.items);

function getSectionsForRole(role: UserRole | null): NavSection[] {
  switch (role) {
    case UserRole.ADMIN:
    case UserRole.PRINCIPAL:
    case UserRole.CORRESPONDENT:
      return ADMIN_SECTIONS;
    case UserRole.TEACHER:
    case UserRole.STAFF:
      return TEACHER_SECTIONS;
    case UserRole.PARENT:
      return PARENT_SECTIONS;
    default:
      return ADMIN_SECTIONS;
  }
}

function getNavForRole(role: UserRole | null): NavItem[] {
  switch (role) {
    case UserRole.ADMIN:
    case UserRole.PRINCIPAL:
    case UserRole.CORRESPONDENT:
      return ADMIN_NAV;
    case UserRole.TEACHER:
    case UserRole.STAFF:
      return TEACHER_NAV;
    case UserRole.PARENT:
      return PARENT_NAV;
    default:
      return ADMIN_NAV;
  }
}

export default function Sidebar({
  activePage,
  onNavigate,
  onCollapsedChange,
}: {
  activePage: string;
  onNavigate: (id: string, href: string) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const { role } = useAuth();
  const { school } = useSchool();
  const [collapsed, setCollapsed] = useState(false);

  const handleCollapse = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onCollapsedChange?.(newCollapsed);
  };

  const sections = getSectionsForRole(role);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          <img src="/logo.jpeg" alt="Maruti Nursery" className={styles.logoImg} />
        </div>
        {!collapsed && <span className={styles.logoText}>{school.name.split(' ').slice(0, 2).join(' ')}</span>}
      </div>

      <nav className={styles.nav}>
        {sections.map((section, sIdx) => (
          <div key={section.title} className={styles.section}>
            {/* Section divider (not on first section) */}
            {sIdx > 0 && <div className={styles.sectionDivider} />}
            
            {/* Section title */}
            {!collapsed && (
              <span className={styles.sectionTitle}>{section.title}</span>
            )}
            {collapsed && sIdx > 0 && <div style={{ height: 4 }} />}

            {section.items.map(item => (
              <button
                key={item.id}
                className={`${styles.navItem} ${activePage === item.id ? styles.active : ''}`}
                onClick={() => onNavigate(item.id, item.href)}
                title={collapsed ? item.label : undefined}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                {activePage === item.id && <span className={styles.activeIndicator} />}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <button className={styles.collapseBtn} onClick={handleCollapse}>
        <span className={`${styles.collapseIcon} ${collapsed ? styles.collapseIconFlipped : ''}`}>
          <ChevronLeftIcon size={18} />
        </span>
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}

export { ADMIN_NAV, TEACHER_NAV, PARENT_NAV, getNavForRole };
