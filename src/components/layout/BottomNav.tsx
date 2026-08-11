'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/enums';
import { hasCapability, isAdminLike, isTeacherLike } from '@/lib/permissions';
import {
  DashboardIcon, GraduationCapIcon, CalendarIcon,
  CreditCardIcon, ClipboardCheckIcon,
  GridIcon, FileTextIcon, BookOpenIcon, BarChartIcon
} from '@/components/ui/Icons';
import styles from './BottomNav.module.css';

interface TabItem {
  id: string;
  icon: React.ReactNode;
  label: string;
}

const ADMIN_TABS: TabItem[] = [
  { id: 'dashboard', icon: <DashboardIcon size={22} />, label: 'Home' },
  { id: 'students', icon: <GraduationCapIcon size={22} />, label: 'Students' },
  { id: 'timetable', icon: <CalendarIcon size={22} />, label: 'Timetable' },
  { id: 'fees', icon: <CreditCardIcon size={22} />, label: 'Fees' },
  { id: 'more', icon: <GridIcon size={22} />, label: 'More' },
];

// Principal (viewAccounts): Accounts + Defaulters replace Students/Timetable,
// which move into the More menu (doc D10/D13).
const PRINCIPAL_TABS: TabItem[] = [
  { id: 'dashboard', icon: <DashboardIcon size={22} />, label: 'Home' },
  { id: 'fees', icon: <CreditCardIcon size={22} />, label: 'Fees' },
  { id: 'accounts', icon: <BarChartIcon size={22} />, label: 'Accounts' },
  { id: 'defaulters', icon: <FileTextIcon size={22} />, label: 'Dues' },
  { id: 'more', icon: <GridIcon size={22} />, label: 'More' },
];

const TEACHER_TABS: TabItem[] = [
  { id: 'dashboard', icon: <DashboardIcon size={22} />, label: 'Home' },
  { id: 'attendance', icon: <ClipboardCheckIcon size={22} />, label: 'Attend.' },
  { id: 'collect-fees', icon: <CreditCardIcon size={22} />, label: 'Fees' },
  { id: 'assignments', icon: <BookOpenIcon size={22} />, label: 'Assign.' },
  { id: 'more', icon: <GridIcon size={22} />, label: 'More' },
];

const PARENT_TABS: TabItem[] = [
  { id: 'dashboard', icon: <DashboardIcon size={22} />, label: 'Home' },
  { id: 'attendance', icon: <ClipboardCheckIcon size={22} />, label: 'Attend.' },
  { id: 'major-exams', icon: <BarChartIcon size={22} />, label: 'Major' },
  { id: 'weekly-tests', icon: <BarChartIcon size={22} />, label: 'Weekly' },
  { id: 'more', icon: <GridIcon size={22} />, label: 'More' },
];

function getTabsForRole(role: UserRole | null): TabItem[] {
  if (isAdminLike(role)) {
    return hasCapability(role, 'viewAccounts') ? PRINCIPAL_TABS : ADMIN_TABS;
  }
  if (isTeacherLike(role)) return TEACHER_TABS;
  if (role === UserRole.PARENT) return PARENT_TABS;
  return ADMIN_TABS;
}

export default function BottomNav({
  activePage,
  onNavigate,
  onMore,
}: {
  activePage: string;
  onNavigate: (id: string) => void;
  onMore?: () => void;
}) {
  const { role } = useAuth();
  const tabs = getTabsForRole(role);

  return (
    <nav className={styles.bottomNav}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activePage === tab.id ? styles.active : ''}`}
          onClick={() => tab.id === 'more' ? onMore?.() : onNavigate(tab.id)}
          aria-label={tab.label}
        >
          <span className={styles.tabIcon}>{tab.icon}</span>
          <span className={styles.tabLabel}>{tab.label}</span>
          {activePage === tab.id && <span className={styles.activeDot} />}
        </button>
      ))}
    </nav>
  );
}
