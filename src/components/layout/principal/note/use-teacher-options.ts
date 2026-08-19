'use client';
/* Teachers offered in the Add/Edit Student forms.

   Only teachers with a linked auth uid are offered: firestore.rules compares
   `teacherUid` to `request.auth.uid`, so assigning a teacher who has never
   signed in would create a row nobody can open. The Teacher-wise panel shows
   those teachers with a "no login linked" note; here they are simply absent,
   because a dropdown option that cannot work is worse than a missing one. */

import { useEffect, useState } from 'react';
import { TeachersService } from '@/lib/firestore-service';
import { teacherAuthUid } from '../registers/register-shared';
import type { TeacherOption } from './StudentFormFields';

export function useTeacherOptions(enabled: boolean): TeacherOption[] {
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const docs = await TeachersService.getAll();
        if (cancelled) return;
        setTeachers(docs
          .map(doc => ({
            uid: teacherAuthUid(doc as { userId?: string; uid?: string; id?: string }),
            name: String(doc.name ?? 'Unnamed teacher'),
          }))
          .filter(t => t.uid)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
      } catch (e) {
        // Non-fatal: the form still saves, just without an assignment field.
        console.error('[fees-note] could not load teachers for assignment', e);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  return teachers;
}
