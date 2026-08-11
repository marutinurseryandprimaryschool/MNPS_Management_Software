'use client';

import React, { useState, useEffect } from 'react';
import { SettingsService } from '@/lib/firestore-service';
import { useSchool } from '@/context/SchoolContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/SharedUI';
import { RefreshIcon, CalendarIcon } from '@/components/ui/Icons';
import { ExamTerm, EXAM_TERM_LABELS } from '@/types/enums';

// The specific 6 exams required by the user
const TARGET_EXAMS = [
  ExamTerm.I_MID_TERM,
  ExamTerm.QUARTERLY,
  ExamTerm.II_MID_TERM,
  ExamTerm.HALF_YEARLY,
  ExamTerm.III_MID_TERM,
  ExamTerm.ANNUAL
];

export default function AdminExams() {
  const { school } = useSchool();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [examCalendar, setExamCalendar] = useState<Record<string, {start: string, end: string}>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchData = async () => {
    try {
      if (!school?.academicYear) return;
      const calendarData = await SettingsService.getExamCalendar(school.academicYear);
      if (calendarData) setExamCalendar(calendarData.terms || {});
      else setExamCalendar({}); // Reset if no data for this year
    } catch (error) {
      console.error('Error fetching academic calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, [school?.academicYear]);

  const handleSaveCalendar = async () => {
    setIsSavingSettings(true);
    try {
      if (!school?.academicYear) return;
      await SettingsService.updateExamCalendar(school.academicYear, { terms: examCalendar });
      showToast('Academic Calendar updated successfully!');
    } catch (error) {
      showToast('Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const updateTermDate = (term: string, field: 'start' | 'end', value: string) => {
    setExamCalendar(prev => ({
      ...prev,
      [term]: {
        ...(prev[term] || { start: '', end: '' }),
        [field]: value
      }
    }));
  };

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <h1 className="text-h1">Academic Calendar</h1>
             <Badge variant="primary">{school?.academicYear}</Badge>
           </div>
           <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Set term boundaries for the {school?.academicYear} academic year.</p>
        </div>
        <Button variant="primary" icon={<RefreshIcon size={18} />} onClick={handleSaveCalendar} loading={isSavingSettings}>Save Calendar</Button>
      </div>

      <div className="card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <CalendarIcon size={24} color="var(--color-primary-600)" />
          <h2 className="text-h3" style={{ margin: 0 }}>Exam Term Durations</h2>
        </div>

        <div style={{ display: 'grid', gap: '20px' }}>
          {TARGET_EXAMS.map((term) => (
            <div key={term} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '24px', alignItems: 'center', padding: '20px', border: '1px solid var(--color-border)', borderRadius: '16px', background: 'var(--color-surface)' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-text-primary)' }}>{EXAM_TERM_LABELS[term]}</span>
                <p className="text-caption" style={{ margin: '4px 0 0 0', color: 'var(--color-text-tertiary)' }}>Attendance for this term will be calculated between these dates.</p>
              </div>
              <Input type="date" label="Start Date" value={examCalendar[term]?.start || ''} onChange={e => updateTermDate(term, 'start', e.target.value)} />
              <Input type="date" label="End Date" value={examCalendar[term]?.end || ''} onChange={e => updateTermDate(term, 'end', e.target.value)} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: '32px', padding: '16px', background: 'var(--color-primary-50)', borderRadius: '12px', border: '1px solid var(--color-primary-100)' }}>
          <p className="text-body-sm" style={{ margin: 0, color: 'var(--color-primary-800)', fontWeight: 500 }}>
            <strong>Note:</strong> These dates are used by teachers in the &quot;Co-Scholastic&quot; section to automatically sync student attendance counts. Ensure the dates are accurate before the report card generation period.
          </p>
        </div>
      </div>
    </div>
  );
}
