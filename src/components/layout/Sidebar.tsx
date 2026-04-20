'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { UserRole } from '@/types/enums';
import {
  DashboardIcon, GraduationCapIcon, UsersIcon, SchoolIcon,
  CalendarIcon, ClipboardCheckIcon, CreditCardIcon, MessageCircleIcon,
  BarChartIcon, SettingsIcon, FileTextIcon, FolderIcon,
  BookOpenIcon, ChevronLeftIcon
} from '@/components/ui/Icons';
import styles from './Sidebar.module.css';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  href: string;
}

const ADMIN_NAV: NavItem[] = [
  { id: 'dashboard', icon: <DashboardIcon size={20} />, label: 'Dashboard', href: '/admin' },
  { id: 'students', icon: <GraduationCapIcon size={20} />, label: 'Students', href: '/admin/students' },
  { id: 'teachers', icon: <UsersIcon size={20} />, label: 'Teachers', href: '/admin/teachers' },
  { id: 'classes', icon: <SchoolIcon size={20} />, label: 'Classes', href: '/admin/classes' },
  { id: 'timetable', icon: <CalendarIcon size={20} />, label: 'Timetable', href: '/admin/timetable' },
  { id: 'attendance', icon: <ClipboardCheckIcon size={20} />, label: 'Attendance', href: '/admin/attendance' },
  { id: 'fees', icon: <CreditCardIcon size={20} />, label: 'Fees', href: '/admin/fees' },
  { id: 'chat', icon: <MessageCircleIcon size={20} />, label: 'Messages', href: '/admin/chat' },
  { id: 'reports', icon: <BarChartIcon size={20} />, label: 'Reports', href: '/admin/reports' },
  { id: 'settings', icon: <SettingsIcon size={20} />, label: 'Settings', href: '/admin/settings' },
];

const TEACHER_NAV: NavItem[] = [
  { id: 'dashboard', icon: <DashboardIcon size={20} />, label: 'Dashboard', href: '/teacher' },
  { id: 'timetable', icon: <CalendarIcon size={20} />, label: 'Timetable', href: '/teacher/timetable' },
  { id: 'attendance', icon: <ClipboardCheckIcon size={20} />, label: 'Attendance', href: '/teacher/attendance' },
  { id: 'marks', icon: <FileTextIcon size={20} />, label: 'Marks', href: '/teacher/marks' },
  { id: 'assignments', icon: <BookOpenIcon size={20} />, label: 'Assignments', href: '/teacher/assignments' },
  { id: 'materials', icon: <FolderIcon size={20} />, label: 'Materials', href: '/teacher/materials' },
  { id: 'chat', icon: <MessageCircleIcon size={20} />, label: 'Messages', href: '/teacher/chat' },
];

const PARENT_NAV: NavItem[] = [
  { id: 'dashboard', icon: <DashboardIcon size={20} />, label: 'Dashboard', href: '/parent' },
  { id: 'attendance', icon: <ClipboardCheckIcon size={20} />, label: 'Attendance', href: '/parent/attendance' },
  { id: 'timetable', icon: <CalendarIcon size={20} />, label: 'Timetable', href: '/parent/timetable' },
  { id: 'marks', icon: <FileTextIcon size={20} />, label: 'Marks', href: '/parent/marks' },
  { id: 'assignments', icon: <BookOpenIcon size={20} />, label: 'Assignments', href: '/parent/assignments' },
  { id: 'fees', icon: <CreditCardIcon size={20} />, label: 'Fees', href: '/parent/fees' },
  { id: 'chat', icon: <MessageCircleIcon size={20} />, label: 'Messages', href: '/parent/chat' },
];

function getNavForRole(role: UserRole | null): NavItem[] {
  switch (role) {
    case UserRole.ADMIN:
    case UserRole.PRINCIPAL:
    case UserRole.CORRESPONDENT:
      return ADMIN_NAV;
    case UserRole.TEACHER:
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
}: {
  activePage: string;
  onNavigate: (id: string, href: string) => void;
}) {
  const { role } = useAuth();
  const { school } = useSchool();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = getNavForRole(role);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          <SchoolIcon size={22} color="white" />
        </div>
        {!collapsed && <span className={styles.logoText}>{school.name.split(' ').slice(0, 2).join(' ')}</span>}
      </div>

      <nav className={styles.nav}>
        {navItems.map(item => (
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
      </nav>

      <button className={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)}>
        <span className={`${styles.collapseIcon} ${collapsed ? styles.collapseIconFlipped : ''}`}>
          <ChevronLeftIcon size={18} />
        </span>
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}

export { ADMIN_NAV, TEACHER_NAV, PARENT_NAV, getNavForRole };
