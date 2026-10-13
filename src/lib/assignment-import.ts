/* ============================================
   Bulk import — match, review, then write
   ============================================
   Takes an allocation list written the way the school writes it ("I-A",
   "Maths", "Swarnalatha") and lines it up against the records that actually
   exist, WITHOUT saving anything. The page shows what matched, what needs a
   human eye, and what collides with an existing allocation; only after the
   Admin confirms does anything reach the database.

   Why the matching is deliberately cautious
   -----------------------------------------
   The handwritten sheets and the database disagree on spelling — the sheet
   says "Murugabekhi" and "Swarnalatha" where the records read
   "Murugalakshmi" and "Sornalatha B". Silently picking the closest name
   would put a real teacher in front of a real class on the strength of a
   guess. So only an EXACT normalised match is treated as certain; anything
   close is offered as a suggestion the Admin must accept.

   Nothing here creates teachers, subjects or classes. A name that matches
   nothing is reported, never invented.
*/

/** One line of the allocation list. */
export interface AllocationRow {
  className: string;
  sectionName: string;
  subjectName: string;
  teacherName: string;
}

export interface NamedRecord {
  id: string;
  name: string;
}

export interface ClassRecord extends NamedRecord {
  sections?: NamedRecord[];
  subjects?: NamedRecord[];
}

/** An existing allocation, so a collision can be reported rather than made. */
export interface ExistingAssignment {
  classId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  teacherName: string;
}

export type MatchStatus = 'matched' | 'review' | 'conflict';

export interface MatchedRow {
  row: AllocationRow;
  status: MatchStatus;
  /** Why it is not `matched`. Empty when it is. */
  problems: string[];
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  subjectId?: string;
  subjectName?: string;
  teacherId?: string;
  teacherName?: string;
  /** Near-miss teachers, best first, for the Admin to choose from. */
  teacherSuggestions?: NamedRecord[];
  /** Who currently holds this class-section-subject, when that differs. */
  conflictWith?: { teacherId: string; teacherName: string };
}

const norm = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

/** Roman and word forms the school writes class names in. */
const CLASS_ALIASES: Record<string, string[]> = {
  '1': ['i', 'one', 'first', 'std1', 'class1'],
  '2': ['ii', 'two', 'second', 'std2', 'class2'],
  '3': ['iii', 'three', 'third', 'std3', 'class3'],
  '4': ['iv', 'four', 'fourth', 'std4', 'class4'],
  '5': ['v', 'five', 'fifth', 'std5', 'class5'],
};

/**
 * Class names as written ("I", "Class I", "1", "UKG") reduced to one token.
 * Anything non-numeric (UKG, LKG, PRE-KG) normalises to itself.
 */
function classKey(name: string): string {
  const cleaned = norm(name).replace(/^class/, '').replace(/^std/, '');
  for (const [digit, aliases] of Object.entries(CLASS_ALIASES)) {
    if (cleaned === digit || aliases.includes(cleaned)) return digit;
  }
  return cleaned;
}

/** Subject names the school shortens. */
const SUBJECT_ALIASES: Record<string, string[]> = {
  physicaleducation: ['phy', 'pe', 'pt', 'physical'],
  science: ['sci'],
  socialscience: ['social', 'socialstudies', 'sst'],
  environmentalscience: ['evs'],
  generalknowledge: ['gk'],
  computerscience: ['computer', 'comp'],
};

function subjectMatches(written: string, candidate: string): boolean {
  const a = norm(written);
  const b = norm(candidate);
  if (a === b) return true;
  // Either side may be the short form of the other.
  for (const [full, shorts] of Object.entries(SUBJECT_ALIASES)) {
    const family = [full, ...shorts];
    if (family.includes(a) && family.includes(b)) return true;
  }
  return false;
}

/** 0–1 similarity, for SUGGESTIONS only — never for an automatic match. */
function similarity(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.startsWith(y) || y.startsWith(x)) return 0.9;
  if (x.includes(y) || y.includes(x)) return 0.8;
  // Shared-character ratio: cheap, and only ever used to order suggestions.
  const shorter = x.length <= y.length ? x : y;
  const longer = shorter === x ? y : x;
  let shared = 0;
  const pool = longer.split('');
  for (const ch of shorter) {
    const at = pool.indexOf(ch);
    if (at >= 0) { shared += 1; pool.splice(at, 1); }
  }
  return shared / longer.length;
}

/** Teachers whose names are close enough to be worth offering, best first. */
function suggestTeachers(name: string, teachers: NamedRecord[]): NamedRecord[] {
  return teachers
    .map(teacher => ({ teacher, score: similarity(name, teacher.name) }))
    .filter(entry => entry.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(entry => entry.teacher);
}

export interface MatchInput {
  rows: AllocationRow[];
  classes: ClassRecord[];
  teachers: NamedRecord[];
  existing: ExistingAssignment[];
}

/**
 * Lines every allocation row up against the real records. Pure: it writes
 * nothing and decides nothing the Admin cannot see and change.
 */
export function matchAllocations(input: MatchInput): MatchedRow[] {
  const { rows, classes, teachers, existing } = input;

  return rows.map<MatchedRow>(row => {
    const problems: string[] = [];

    const cls = classes.find(c => classKey(c.name) === classKey(row.className));
    if (!cls) {
      return {
        row,
        status: 'review',
        problems: [`No class named "${row.className}" exists.`],
      };
    }

    const sections = cls.sections ?? [];
    // A sheet may omit the section for a single-section class.
    const section = row.sectionName
      ? sections.find(s => norm(s.name) === norm(row.sectionName))
      : sections[0];
    if (!section) {
      problems.push(`${cls.name} has no section "${row.sectionName}".`);
    }

    const subject = (cls.subjects ?? []).find(s => subjectMatches(row.subjectName, s.name));
    if (!subject) {
      problems.push(`"${row.subjectName}" is not a subject of ${cls.name}.`);
    }

    // Only an exact normalised name is trusted; near misses are suggested.
    const teacher = teachers.find(t => norm(t.name) === norm(row.teacherName));
    let suggestions: NamedRecord[] | undefined;
    if (!teacher) {
      suggestions = suggestTeachers(row.teacherName, teachers);
      problems.push(suggestions.length > 0
        ? `No teacher is named exactly "${row.teacherName}" — choose the right one.`
        : `No teacher named "${row.teacherName}" was found.`);
    }

    const base: MatchedRow = {
      row,
      status: 'review',
      problems,
      classId: cls.id,
      className: cls.name,
      sectionId: section?.id,
      sectionName: section?.name,
      subjectId: subject?.id,
      subjectName: subject?.name,
      teacherId: teacher?.id,
      teacherName: teacher?.name,
      teacherSuggestions: suggestions,
    };

    if (problems.length > 0) return base;

    // Everything resolved — does it collide with an allocation already made?
    const held = existing.find(a =>
      a.classId === cls.id && a.sectionId === section!.id && a.subjectId === subject!.id);
    if (held && held.teacherId !== teacher!.id) {
      return {
        ...base,
        status: 'conflict',
        problems: [`Already assigned to ${held.teacherName}.`],
        conflictWith: { teacherId: held.teacherId, teacherName: held.teacherName },
      };
    }

    return { ...base, status: 'matched', problems: [] };
  });
}

/** A row is importable once every part resolves — conflicts included, since
    importing one deliberately replaces the current holder. */
export function isImportable(row: MatchedRow): boolean {
  return Boolean(row.classId && row.sectionId && row.subjectId && row.teacherId);
}

export interface MatchSummary {
  matched: number;
  review: number;
  conflict: number;
  importable: number;
}

export function summarise(rows: MatchedRow[]): MatchSummary {
  return {
    matched: rows.filter(r => r.status === 'matched').length,
    review: rows.filter(r => r.status === 'review').length,
    conflict: rows.filter(r => r.status === 'conflict').length,
    importable: rows.filter(isImportable).length,
  };
}

/* ── Parsing ──────────────────────────────────────────────────────────── */

/**
 * Reads the allocation as the school writes it: a class heading, then
 * "Subject → Teacher" lines beneath it.
 *
 *     CLASS I-A
 *     English -> Uma
 *     Maths -> Swarnalatha
 *
 * Accepts '->', '→', ':' or '=' as the separator, and takes the section from
 * the heading ("I-A", "UKG - A", "Class II B").
 */
export function parseAllocationText(text: string): AllocationRow[] {
  const rows: AllocationRow[] = [];
  let className = '';
  let sectionName = '';

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const separator = line.match(/\s*(?:->|→|=>|:|=)\s*/);
    if (separator && separator.index !== undefined && separator.index > 0) {
      const subjectName = line.slice(0, separator.index).trim();
      const teacherName = line.slice(separator.index + separator[0].length).trim();
      if (className && subjectName && teacherName) {
        rows.push({ className, sectionName, subjectName, teacherName });
      }
      continue;
    }

    // A heading: "CLASS I-A", "UKG-A", "PRE-KG".
    const heading = line.replace(/^class\s+/i, '').trim();
    const parts = heading.split(/\s*[-–—]\s*/);
    // "PRE-KG" is one name, not a class and a section.
    if (parts.length >= 2 && /^[A-Za-z]$/.test(parts[parts.length - 1].trim())) {
      sectionName = parts.pop()!.trim();
      className = parts.join('-').trim();
    } else {
      className = heading;
      sectionName = '';
    }
  }

  return rows;
}

/* ── Corrections made on the review screen ───────────────────────────── */

/**
 * Records the Admin's choice of teacher for a row the matcher would not
 * guess at, and re-decides the row's status from there. The choice is a
 * person's decision about a person's name — the matcher only ever offered
 * candidates, so this is where a suggestion becomes an answer.
 */
export function applyTeacherChoice(
  row: MatchedRow,
  teacher: NamedRecord,
  existing: ExistingAssignment[],
): MatchedRow {
  // Keep problems this choice does not answer (a missing subject or section).
  const problems = row.problems.filter(p => !/teacher/i.test(p));
  const resolved: MatchedRow = {
    ...row,
    teacherId: teacher.id,
    teacherName: teacher.name,
    teacherSuggestions: undefined,
    problems,
    conflictWith: undefined,
    status: 'review',
  };

  if (problems.length > 0 || !isImportable(resolved)) return resolved;

  const held = existing.find(a =>
    a.classId === row.classId && a.sectionId === row.sectionId && a.subjectId === row.subjectId);
  if (held && held.teacherId !== teacher.id) {
    return {
      ...resolved,
      status: 'conflict',
      problems: [`Already assigned to ${held.teacherName}.`],
      conflictWith: { teacherId: held.teacherId, teacherName: held.teacherName },
    };
  }

  return { ...resolved, status: 'matched' };
}
