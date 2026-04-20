'use client';

import React from 'react';
import { DEMO_CHATS } from '@/lib/demo-data';
import { Avatar, Badge } from '@/components/ui/SharedUI';
import { useAuth } from '@/context/AuthContext';
import { formatRelativeDate } from '@/lib/utils';

export default function AdminChat() {
  const { user } = useAuth();
  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Messages</h2>
      </div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {DEMO_CHATS.map(chat => {
          const otherName = Object.entries(chat.participantNames).find(([id]) => id !== user?.id)?.[1] || 'User';
          const unread = chat.unreadCount[user?.id || ''] || 0;
          return (
            <div key={chat.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)', cursor: 'pointer', transition: 'background 100ms' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-variant)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Avatar name={otherName} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ font: 'var(--text-body)', fontWeight: unread > 0 ? 600 : 500 }}>{otherName}</span>
                  <span className="text-caption">{formatRelativeDate(chat.lastMessage.sentAt)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-body-sm truncate" style={{ opacity: unread > 0 ? 1 : 0.7 }}>{chat.lastMessage.text}</span>
                  {unread > 0 && <Badge variant="error">{unread}</Badge>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
