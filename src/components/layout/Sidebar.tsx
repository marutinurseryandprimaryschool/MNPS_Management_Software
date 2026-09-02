'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { UserRole } from '@/types/enums';
import { hasCapability, isTeacherLike, type Capability } from '@/lib/permissions';
import {
  DashboardIcon, GraduationCapIcon, UsersIcon, SchoolIcon,
  CalendarIcon, ClipboardCheckIcon, CreditCardIcon,
  BarChartIcon, SettingsIcon, FileTextIcon,
  BookOpenIcon, ChevronLeftIcon, ClockIcon
} from '@/components/ui/Icons';
import styles from './Sidebar.module.css';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  href: string;
  /** When set, the item is shown only to roles holding this capability. */
  capability?: Capability;
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

  // The legacy fee module (Fee Overview / Fee Structures / Payments / Accounts /
  // Defaulter Report) is RETIRED from navigation. Its components still exist on
  // disk but are unrouted — the Principal Register below replaces them and
  // shares none of their data.
  {
    // Every item is capability-gated, so admin/correspondent (who hold none of
    // the register capabilities) see this whole section disappear.
    title: 'PRINCIPAL REGISTER',
    items: [
      { id: 'principal-note', icon: <FileTextIcon size={20} />, label: 'Fees Note', href: '/admin/principal-note', capability: 'editPrincipalRegister' },
      { id: 'principal-classes', icon: <SchoolIcon size={20} />, label: 'Class-wise', href: '/admin/principal-classes', capability: 'editPrincipalRegister' },
      { id: 'principal-teachers', icon: <UsersIcon size={20} />, label: 'Teacher-wise', href: '/admin/principal-teachers', capability: 'viewPrincipalRegister' },
      { id: 'principal-accounts', icon: <BarChartIcon size={20} />, label: "Today's Billing & Expenses", href: '/admin/principal-accounts', capability: 'viewPrincipalAccounts' },
      { id: 'principal-monthly', icon: <ClockIcon size={20} />, label: 'Accounts (Monthly)', href: '/admin/principal-monthly', capability: 'viewPrincipalAccounts' },
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
      { id: 'class-tests', icon: <FileTextIcon size={20} />, label: 'Class Test Marks', href: '/teacher/class-tests' },
      { id: 'exam-marks', icon: <ClipboardCheckIcon size={20} />, label: 'Exam Marks Entry', href: '/teacher/exam-marks' },
      { id: 'co-scholastic', icon: <FileTextIcon size={20} />, label: 'Co-Scholastic & Remarks', href: '/teacher/co-scholastic' },
      { id: 'report-card', icon: <FileTextIcon size={20} />, label: 'Report Card', href: '/teacher/report-card' },
    ],
  },
  {
    // The teacher's single window into the Principal Register: the rows Sharmi
    // assigned to them. The legacy 'collect-fees' page is retired (unrouted).
    title: 'FEES',
    items: [
      { id: 'principal-teachers', icon: <CreditCardIcon size={20} />, label: "My Students' Fees", href: '/teacher/principal-teachers', capability: 'viewPrincipalRegister' },
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
      { id: 'major-exams', icon: <BarChartIcon size={20} />, label: 'Major Exams', href: '/parent/major-exams' },
      { id: 'weekly-tests', icon: <BarChartIcon size={20} />, label: 'Weekly Tests', href: '/parent/weekly-tests' },
      { id: 'class-tests', icon: <FileTextIcon size={20} />, label: 'Class Tests', href: '/parent/class-tests' },
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

// Drop items whose capability the role lacks; drop sections left empty.
function filterSectionsByCapability(sections: NavSection[], role: UserRole | null): NavSection[] {
  return sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => !item.capability || hasCapability(role, item.capability)),
    }))
    .filter(section => section.items.length > 0);
}

function getSectionsForRole(role: UserRole | null): NavSection[] {
  // Capability filtering applies to EVERY shell now — the teacher shell also
  // carries a gated item ("My Students' Fees").
  if (isTeacherLike(role)) return filterSectionsByCapability(TEACHER_SECTIONS, role);
  if (role === UserRole.PARENT) return filterSectionsByCapability(PARENT_SECTIONS, role);
  // Admin-like roles (and the pre-auth null fallback, unchanged behavior).
  return filterSectionsByCapability(ADMIN_SECTIONS, role);
}

/* Principal focus mode: a small toggle that trims the sidebar to the money
   pages only. Preference persists per browser. */
const PRINCIPAL_FOCUS_IDS = new Set([
  'dashboard',
  'principal-note', 'principal-classes', 'principal-teachers',
  'principal-accounts', 'principal-activity',
]);
const FOCUS_MODE_STORAGE_KEY = 'mnps_principal_view_mode';

function readFocusModePreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return (window.localStorage.getItem(FOCUS_MODE_STORAGE_KEY) ?? 'focus') === 'focus';
  } catch {
    return true;
  }
}

function focusSections(sections: NavSection[]): NavSection[] {
  return sections
    .map(s => ({ ...s, items: s.items.filter(i => PRINCIPAL_FOCUS_IDS.has(i.id)) }))
    .filter(s => s.items.length > 0);
}

/** Flat, capability-filtered nav for a role (every shell goes through the
    same filter, so a hidden item can never leak into a flat list). */
function getNavForRole(role: UserRole | null): NavItem[] {
  return getSectionsForRole(role).flatMap(s => s.items);
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
  const [focusMode, setFocusMode] = useState<boolean>(readFocusModePreference);

  const handleCollapse = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onCollapsedChange?.(newCollapsed);
  };

  // The focus toggle is only offered to the Principal (the sole holder of
  // viewPrincipalAccounts) — it trims the sidebar to the register pages.
  const canFocus = hasCapability(role, 'viewPrincipalAccounts');
  const handleFocusToggle = () => {
    const next = !focusMode;
    setFocusMode(next);
    try {
      window.localStorage.setItem(FOCUS_MODE_STORAGE_KEY, next ? 'focus' : 'full');
    } catch {
      // Preference just won't persist — toggle still works this session.
    }
  };

  const allSections = getSectionsForRole(role);
  const sections = canFocus && focusMode ? focusSections(allSections) : allSections;

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          <img src="/logo.jpeg" alt="Maruti Nursery" className={styles.logoImg} />
        </div>
        {!collapsed && <span className={styles.logoText}>{school.name.split(' ').slice(0, 2).join(' ')}</span>}
      </div>

      {canFocus && !collapsed && (
        <label
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            margin: '4px 14px 6px', padding: '7px 10px', cursor: 'pointer',
            background: 'var(--color-surface-variant)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
          title={focusMode ? 'Showing money pages only — switch off to see everything' : 'Showing everything — switch on for money pages only'}
        >
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em', color: 'var(--color-text-secondary)' }}>
            PRINCIPAL VIEW
          </span>
          <span
            onClick={handleFocusToggle}
            style={{
              width: 34, height: 18, borderRadius: 9, flexShrink: 0, position: 'relative',
              background: focusMode ? '#10B981' : '#D1D5DB', transition: 'background 0.2s', cursor: 'pointer',
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: focusMode ? 18 : 2, width: 14, height: 14,
              borderRadius: '50%', background: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.25)', transition: 'left 0.2s',
            }} />
          </span>
        </label>
      )}

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
