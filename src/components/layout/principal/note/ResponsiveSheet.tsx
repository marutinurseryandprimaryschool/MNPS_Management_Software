'use client';

/* ============================================
   Fees Note — responsive dialog shell
   ============================================
   One form, two presentations: a centred modal on a PC, a bottom sheet on a
   phone (thumb-reachable, fields stacked). Every dialog on this screen goes
   through here so the two layouts can never drift apart.
*/

import React from 'react';
import Modal, { BottomSheet } from '@/components/ui/Modal';

interface ResponsiveSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  isMobile: boolean;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export default function ResponsiveSheet({
  isOpen, onClose, title, isMobile, size = 'md', children,
}: ResponsiveSheetProps) {
  if (isMobile) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
        {children}
      </BottomSheet>
    );
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
      {children}
    </Modal>
  );
}

/** Standard footer: Cancel on the left, the saving-guarded primary on the right. */
export function SheetActions({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 'var(--space-2)',
      marginTop: 'var(--space-4)',
      flexWrap: 'wrap',
    }}>
      {children}
    </div>
  );
}
