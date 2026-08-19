'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/enums';
import { hasCapability, isAdminLike, isTeacherLike, type Capability } from '@/lib/permissions';
import {
  DashboardIcon, GraduationCapIcon, CalendarIcon,
  CreditCardIcon, ClipboardCheckIcon, SchoolIcon,
  GridIcon, FileTextIcon, BookOpenIcon, BarChartIcon
} from '@/components/ui/Icons';
import styles from './BottomNav.module.css';

interface TabItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  /** When set, the tab is dropped for roles lacking this capability. */
  capability?: Capability;
}

// Admin / Correspondent hold no Principal Register capability, and the legacy
// fee module is retired — so they get no money tab at all.
const ADMIN_TABS: TabItem[] = [
  { id: 'dashboard', icon: <DashboardIcon size={22} />, label: 'Home' },
  { id: 'students', icon: <GraduationCapIcon size={22} />, label: 'Students' },
  { id: 'timetable', icon: <CalendarIcon size={22} />, label: 'Timetable' },
  { id: 'attendance', icon: <ClipboardCheckIcon size={22} />, label: 'Attend.' },
  { id: 'more', icon: <GridIcon size={22} />, label: 'More' },
];

// Principal: the register pages she actually types into. Teacher-wise and the
// Activity Log live in the More menu (five tabs is the hard ceiling here).
const PRINCIPAL_TABS: TabItem[] = [
  { id: 'dashboard', icon: <DashboardIcon size={22} />, label: 'Home' },
  { id: 'principal-note', icon: <FileTextIcon size={22} />, label: 'Note', capability: 'editPrincipalRegister' },
  { id: 'principal-classes', icon: <SchoolIcon size={22} />, label: 'Classes', capability: 'editPrincipalRegister' },
  { id: 'principal-accounts', icon: <BarChartIcon size={22} />, label: 'Accounts', capability: 'viewPrincipalAccounts' },
  { id: 'more', icon: <GridIcon size={22} />, label: 'More' },
];

const TEACHER_TABS: TabItem[] = [
  { id: 'dashboard', icon: <DashboardIcon size={22} />, label: 'Home' },
  { id: 'attendance', icon: <ClipboardCheckIcon size={22} />, label: 'Attend.' },
  { id: 'principal-teachers', icon: <CreditCardIcon size={22} />, label: 'Fees', capability: 'viewPrincipalRegister' },
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

/** Drop tabs whose capability the role lacks — a tab must never dead-end. */
const allowed = (tabs: TabItem[], role: UserRole | null): TabItem[] =>
  tabs.filter(tab => !tab.capability || hasCapability(role, tab.capability));

function getTabsForRole(role: UserRole | null): TabItem[] {
  if (isAdminLike(role)) {
    // Only the Principal holds viewPrincipalAccounts, so only she gets the
    // register tab bar; admin/correspondent keep the plain admin one.
    return hasCapability(role, 'viewPrincipalAccounts')
      ? allowed(PRINCIPAL_TABS, role)
      : ADMIN_TABS;
  }
  if (isTeacherLike(role)) return allowed(TEACHER_TABS, role);
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
