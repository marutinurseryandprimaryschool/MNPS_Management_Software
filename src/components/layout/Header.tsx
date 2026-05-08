'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/enums';
import { Avatar } from '@/components/ui/SharedUI';
import { NotificationsService } from '@/lib/firestore-service';
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
  [UserRole.STAFF]: <BriefcaseIcon size={14} />,
};

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  'fee_reminder': <CreditCardIcon size={16} />,
  'attendance_alert': <ClipboardCheckIcon size={16} />,
  'timetable_change': <CalendarIcon size={16} />,
  'announcement': <MegaphoneIcon size={16} />,
  'assignment_due': <FileTextIcon size={16} />,
  'new_message': <FileTextIcon size={16} />,
};

interface NotifData {
  id: string;
  type: string;
  title: string;
  body: string;
  readBy: string[];
}

export default function Header({
  title,
  onBack,
}: {
  title?: string;
  onBack?: () => void;
}) {
  const { user, logout, role } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<NotifData[]>([]);

  const notifRef = React.useRef<HTMLDivElement>(null);
  const userRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !role) return;
    NotificationsService.getForUser(user.id, role).then(data => {
      setNotifications(data as unknown as NotifData[]);
    }).catch(console.error);
  }, [user, role]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNotif && notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotif(false);
      }
      if (showMenu && userRef.current && !userRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotif, showMenu]);

  const unreadCount = notifications.filter(n => !n.readBy?.includes(user?.id || '')).length;

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
        <div className={styles.notifWrapper} ref={notifRef}>
          <button className={styles.iconBtn} onClick={() => { setShowNotif(!showNotif); setShowMenu(false); }}>
            <BellIcon size={18} />
            {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
          </button>
          {showNotif && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
                <span style={{ font: 'var(--text-body)', fontWeight: 600 }}>Notifications</span>
                <span style={{ font: 'var(--text-caption)', color: 'var(--color-primary-600)', background: 'var(--color-primary-50)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>{unreadCount} unread</span>
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <BellIcon size={28} color="var(--color-text-tertiary)" style={{ opacity: 0.5 }} />
                  <span style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-tertiary)' }}>No notifications yet</span>
                </div>
              ) : (
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {notifications.slice(0, 5).map(n => (
                    <div key={n.id} className={styles.notifItem}>
                      <span className={styles.notifIcon}>
                        {NOTIF_ICONS[n.type] || <FileTextIcon size={16} />}
                      </span>
                      <div>
                        <div style={{ font: 'var(--text-body-sm)', fontWeight: 500 }}>{n.title}</div>
                        <div style={{ font: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>{n.body?.slice(0, 60)}{n.body?.length > 60 ? '...' : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className={styles.userWrapper} ref={userRef}>
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
              <div style={{ padding: 'var(--space-2) var(--space-4)', font: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>{user?.email}</div>
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
