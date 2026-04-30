'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/enums';
import {
  DashboardIcon, GraduationCapIcon, CalendarIcon,
  CreditCardIcon, ClipboardCheckIcon,
  GridIcon, FileTextIcon, BookOpenIcon
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
  { id: 'timetable', icon: <CalendarIcon size={22} />, label: 'Timetable' },
  { id: 'assignments', icon: <BookOpenIcon size={22} />, label: 'Assign.' },
  { id: 'more', icon: <GridIcon size={22} />, label: 'More' },
];

function getTabsForRole(role: UserRole | null): TabItem[] {
  switch (role) {
    case UserRole.ADMIN:
    case UserRole.PRINCIPAL:
    case UserRole.CORRESPONDENT:
      return ADMIN_TABS;
    case UserRole.TEACHER:
    case UserRole.STAFF:
      return TEACHER_TABS;
    case UserRole.PARENT:
      return PARENT_TABS;
    default:
      return ADMIN_TABS;
  }
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
