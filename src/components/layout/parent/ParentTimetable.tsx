'use client';

import React from 'react';
import AdminTimetable from '../admin/AdminTimetable';

// Parent timetable view reuses admin timetable (read-only)
export default function ParentTimetable() {
  return <AdminTimetable />;
}
