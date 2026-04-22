'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/enums';
import { Avatar } from '@/components/ui/SharedUI';
import { DEMO_NOTIFICATIONS } from '@/lib/demo-data';
import {
  BellIcon, ArrowLeftIcon, LogOutIcon,
  ChevronDownIcon, CreditCardIcon, ClipboardCheckIcon,
  CalendarIcon, MegaphoneIcon, FileTextIcon,
  UserIcon, GraduationCapIcon, UsersIcon, BriefcaseIcon, AwardIcon
} from '@/components/ui/Icons';
import styles from './Header.module.css';

const ROLE_ICONS: Record<string, React.ReactNode> = {
  [UserRole.ADMIN]: <UserIcon size={14} />,
  [UserRole.PRINCIPAL]: <AwardIcon size={14} />,
  [UserRole.CORRESPONDENT]: <BriefcaseIcon size={14} />,
  [UserRole.TEACHER]: <GraduationCapIcon size={14} />,
  [UserRole.PARENT]: <UsersIcon size={14} />,
};

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  'fee_reminder': <CreditCardIcon size={16} />,
  'attendance_alert': <ClipboardCheckIcon size={16} />,
  'timetable_change': <CalendarIcon size={16} />,
  'announcement': <MegaphoneIcon size={16} />,
  'assignment_due': <FileTextIcon size={16} />,
  'new_message': <FileTextIcon size={16} />,
};

export default function Header({
  title,
  onBack,
}: {
  title?: string;
  onBack?: () => void;
}) {
  const { user, logout, switchRole, role } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);

  const unreadCount = DEMO_NOTIFICATIONS.filter(n => !n.readBy.includes(user?.id || '')).length;

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {onBack && (
          <button className={styles.backBtn} onClick={onBack}>
            <ArrowLeftIcon size={20} />
          </button>
        )}
        <h1 className={styles.title}>{title || 'Maruti School'}</h1>
      </div>

      <div className={styles.right}>
        {/* Notifications */}
        <div className={styles.notifWrapper}>
          <button className={styles.iconBtn} onClick={() => { setShowNotif(!showNotif); setShowMenu(false); }}>
            <BellIcon size={18} />
            {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
          </button>
          {showNotif && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <span style={{ fontWeight: 600 }}>Notifications</span>
                <span style={{ font: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>{unreadCount} unread</span>
              </div>
              {DEMO_NOTIFICATIONS.slice(0, 5).map(n => (
                <div key={n.id} className={styles.notifItem}>
                  <span className={styles.notifIcon}>
                    {NOTIF_ICONS[n.type] || <FileTextIcon size={16} />}
                  </span>
                  <div>
                    <div style={{ font: 'var(--text-body-sm)', fontWeight: 500 }}>{n.title}</div>
                    <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>{n.body.slice(0, 60)}...</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className={styles.userWrapper}>
          <button className={styles.userBtn} onClick={() => { setShowMenu(!showMenu); setShowNotif(false); }}>
            <Avatar name={user?.name || 'User'} size={32} />
            <span className={styles.userName}>{user?.name?.split(' ')[0]}</span>
            <ChevronDownIcon size={14} />
          </button>
          {showMenu && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <div>
                  <div style={{ fontWeight: 600 }}>{user?.name}</div>
                  <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-tertiary)', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {role && ROLE_ICONS[role]} {role}
                  </div>
                </div>
              </div>
              <div className={styles.divider} />
              <div className={styles.dropdownLabel}>Switch Role (Demo)</div>
              {Object.values(UserRole).map(r => (
                <button key={r} className={`${styles.dropdownItem} ${r === role ? styles.activeItem : ''}`}
                  onClick={() => { switchRole(r); setShowMenu(false); }}>
                  <span className={styles.roleIcon}>{ROLE_ICONS[r]}</span>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
              <div className={styles.divider} />
              <button className={`${styles.dropdownItem} ${styles.logoutItem}`} onClick={logout}>
                <LogOutIcon size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
