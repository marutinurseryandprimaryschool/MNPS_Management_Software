'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { School } from '@/types/models';
import { DEMO_SCHOOL } from '@/lib/demo-data';

/* ============================================
   School Context
   ============================================ */

interface SchoolContextType {
  school: School;
  updateSchool: (updates: Partial<School>) => void;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const [school, setSchool] = useState<School>(DEMO_SCHOOL);

  const updateSchool = useCallback((updates: Partial<School>) => {
    setSchool(prev => ({ ...prev, ...updates }));
  }, []);

  return (
    <SchoolContext.Provider value={{ school, updateSchool }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
}

export default SchoolContext;
