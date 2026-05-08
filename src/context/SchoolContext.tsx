'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { School } from '@/types/models';
import { SchoolService } from '@/lib/firestore-service';
import { SchoolPlan, DayOfWeek } from '@/types/enums';

/* ============================================
   School Context
   ============================================ */

const DEFAULT_TIMINGS = [
  { period: 1, start: '09:00', end: '09:40' },
  { period: 2, start: '09:40', end: '10:20' },
  { type: 'break', label: 'Morning Break', start: '10:20', end: '10:35' },
  { period: 3, start: '10:35', end: '11:15' },
  { period: 4, start: '11:15', end: '11:55' },
  { period: 5, start: '11:55', end: '12:35' },
  { type: 'lunch', label: 'Lunch Break', start: '12:35', end: '13:15' },
  { period: 6, start: '13:15', end: '13:55' },
  { period: 7, start: '13:55', end: '14:35' },
  { period: 8, start: '14:35', end: '15:15' },
];

const DEFAULT_SCHOOL: School = {
  id: 'main',
  name: 'Maruti Nursery & Primary School',
  address: '',
  phone: '',
  email: '',
  logo: '/MARUTI.png.bv.webp',
  academicYear: '2026-27',
  plan: SchoolPlan.STANDARD,
  settings: {
    admissionPrefix: 'MNS',
    periodsPerDay: 8,
    schoolDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY],
    periodTimings: DEFAULT_TIMINGS,
    gradeScale: [],
    maxPeriodsPerTeacherPerDay: 6,
    maxConsecutivePeriods: 3,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

interface SchoolContextType {
  school: School;
  loading: boolean;
  updateSchool: (updates: Partial<School>) => Promise<void>;
  refreshSchool: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const [school, setSchool] = useState<School>(DEFAULT_SCHOOL);
  const [loading, setLoading] = useState(true);

  const fetchSchool = useCallback(async () => {
    try {
      const data = await SchoolService.get();
      if (data) {
        const fetchedSchool = data as unknown as School;
        if (!fetchedSchool.settings?.periodTimings?.length) {
          if (!fetchedSchool.settings) fetchedSchool.settings = {} as any;
          fetchedSchool.settings.periodTimings = DEFAULT_TIMINGS;
        }
        setSchool(fetchedSchool);
      }
    } catch (error) {
      console.error('Error fetching school:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchool();
  }, [fetchSchool]);

  const updateSchool = useCallback(async (updates: Partial<School>) => {
    try {
      await SchoolService.update(updates as Record<string, unknown>);
      setSchool(prev => ({ ...prev, ...updates }));
    } catch (error) {
      console.error('Error updating school:', error);
      throw error;
    }
  }, []);

  const refreshSchool = useCallback(async () => {
    setLoading(true);
    await fetchSchool();
  }, [fetchSchool]);

  return (
    <SchoolContext.Provider value={{ school, loading, updateSchool, refreshSchool }}>
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
