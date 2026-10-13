/* ============================================
   /api/parent-data — handler logic with injected dependencies
   ============================================
   Every response is scoped to ONE student that the caller's token claims
   list. The store interface below returns raw class-wide documents; this
   module trims them to the child before anything is serialised, so the
   browser never holds a classmate's record. */

import {
  isParentClaims, isParentDataView, restrictRecordsToStudent, sanitizeStudentForParent,
  findRowForChild, type ParentClaims, type ParentDataView,
} from '../../src/lib/parent-portal/core';

export type Doc = Record<string, unknown> & { id: string };

export interface ParentDataStore {
  academicYear: () => Promise<string>;
  studentsByIds: (ids: string[]) => Promise<Doc[]>;
  classById: (classId: string) => Promise<Doc | null>;
  attendanceForClass: (classId: string, sectionId: string, year: string) => Promise<Doc[]>;
  marksForClass: (classId: string, sectionId: string, year: string) => Promise<Doc[]>;
  classTestsForClass: (classId: string, sectionId: string, year: string) => Promise<Doc[]>;
  coScholasticForClass: (classId: string, sectionId: string, year: string) => Promise<Doc[]>;
  weeklyTestsForStudent: (studentId: string, year: string) => Promise<Doc[]>;
  assignmentsForClass: (classId: string) => Promise<Doc[]>;
  timetableForClass: (classId: string, sectionId: string, year: string) => Promise<Doc | null>;
  registerRows: (year: string) => Promise<Doc[]>;
  paymentsForRow: (rowId: string) => Promise<Doc[]>;
}

export interface ParentDataDeps {
  verifyIdToken: (idToken: string) => Promise<{ uid: string; claims: Record<string, unknown> }>;
  store: ParentDataStore;
  log: (event: string, detail?: Record<string, unknown>) => void;
}

export interface DataRequest {
  method: string;
  authorization?: string;
  query: Record<string, string | string[] | undefined>;
}

export interface DataResponse {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

const one = (v: string | string[] | undefined): string | undefined => Array.isArray(v) ? v[0] : v;

export function createParentDataHandler(deps: ParentDataDeps) {
  return async function handle(req: DataRequest): Promise<DataResponse> {
    if (req.method !== 'GET') {
      return { status: 405, headers: { Allow: 'GET' }, body: { error: 'method_not_allowed' } };
    }
    const bearer = /^Bearer\s+(.+)$/i.exec(req.authorization || '');
    if (!bearer) return { status: 401, body: { error: 'unauthenticated' } };

    let uid: string;
    let claims: Record<string, unknown>;
    try {
      ({ uid, claims } = await deps.verifyIdToken(bearer[1]));
    } catch {
      return { status: 401, body: { error: 'unauthenticated' } };
    }
    if (!isParentClaims(claims)) {
      deps.log('parent_data.forbidden_role', { uid });
      return { status: 403, body: { error: 'forbidden' } };
    }

    const view = one(req.query.view);
    if (!isParentDataView(view)) return { status: 400, body: { error: 'bad_view' } };

    const year = await deps.store.academicYear();
    if (view === 'me') {
      const students = (await deps.store.studentsByIds(claims.studentIds))
        .filter(s => !s.status || s.status === 'active');
      return ok({ academicYear: year, children: students.map(sanitizeStudentForParent) });
    }

    const studentId = one(req.query.studentId) || claims.studentIds[0];
    if (!claims.studentIds.includes(studentId)) {
      // The single most important branch in this file.
      deps.log('parent_data.cross_student_blocked', { uid, studentId });
      return { status: 403, body: { error: 'forbidden' } };
    }
    const [student] = await deps.store.studentsByIds([studentId]);
    // An archived/left student is invisible even to a token that still names
    // them: claims live until the next login, this check does not.
    if (!student || (student.status && student.status !== 'active')) {
      return { status: 404, body: { error: 'not_found' } };
    }

    const data = await buildView(deps.store, view, student, year, claims);
    return ok(data);
  };
}

const ok = (data: Record<string, unknown>): DataResponse => ({
  status: 200,
  headers: { 'Cache-Control': 'private, no-store' },
  body: { data },
});

async function buildView(
  store: ParentDataStore,
  view: Exclude<ParentDataView, 'me'>,
  student: Doc,
  year: string,
  claims: ParentClaims,
): Promise<Record<string, unknown>> {
  void claims;
  const classId = String(student.classId || '');
  const sectionId = String(student.sectionId || '');
  const sid = student.id;

  switch (view) {
    case 'class':
      return { class: await store.classById(classId) };
    case 'attendance':
      return { attendance: restrictRecordsToStudent(await store.attendanceForClass(classId, sectionId, year), sid) };
    case 'marks':
      return {
        class: await store.classById(classId),
        marks: restrictRecordsToStudent(await store.marksForClass(classId, sectionId, year), sid),
      };
    case 'weekly':
      return {
        class: await store.classById(classId),
        weekly: (await store.weeklyTestsForStudent(sid, year)).filter(w => w.studentId === sid),
      };
    case 'classTests':
      return {
        class: await store.classById(classId),
        classTests: restrictRecordsToStudent(await store.classTestsForClass(classId, sectionId, year), sid),
      };
    case 'reportCard':
      return {
        class: await store.classById(classId),
        marks: restrictRecordsToStudent(await store.marksForClass(classId, sectionId, year), sid),
        coScholastic: restrictRecordsToStudent(await store.coScholasticForClass(classId, sectionId, year), sid),
      };
    case 'assignments':
      return { assignments: await store.assignmentsForClass(classId) };
    case 'timetable':
      return { timetable: await store.timetableForClass(classId, sectionId, year) };
    case 'fees': {
      const rows = await store.registerRows(year);
      const row = findRowForChild(
        rows as Array<Doc & { name: string; className?: string | null; deleted?: boolean }>,
        { name: String(student.name || ''), className: (student.className as string) || null },
      );
      const payments = row ? (await store.paymentsForRow(row.id)).filter(p => !p.deleted) : [];
      return { row, payments };
    }
  }
}
