/* ============================================
   CampusOS — Class progression slots
   ============================================
   Dependency-free on purpose: this file is imported by the browser bundle
   (via src/lib/utils.ts) AND by the Vercel functions under /api, which
   cannot resolve the `@/` alias. Keep it free of any import. */

export const CLASS_SLOTS: { label: string; aliases: string[] }[] = [
  { label: 'Pre-KG',  aliases: ['pre-kg', 'prekg', 'pre kg', 'lkg prep', 'nursery'] },
  { label: 'LKG',     aliases: ['lkg', 'lower kg', 'lower kindergarten'] },
  { label: 'UKG',     aliases: ['ukg', 'upper kg', 'upper kindergarten'] },
  { label: 'Class 1', aliases: ['class 1', 'class1', 'std 1', 'std1', 'standard 1', 'grade 1', 'first',  '1st', 'i'] },
  { label: 'Class 2', aliases: ['class 2', 'class2', 'std 2', 'std2', 'standard 2', 'grade 2', 'second', '2nd', 'ii'] },
  { label: 'Class 3', aliases: ['class 3', 'class3', 'std 3', 'std3', 'standard 3', 'grade 3', 'third',  '3rd', 'iii'] },
  { label: 'Class 4', aliases: ['class 4', 'class4', 'std 4', 'std4', 'standard 4', 'grade 4', 'fourth', '4th', 'iv'] },
  { label: 'Class 5', aliases: ['class 5', 'class5', 'std 5', 'std5', 'standard 5', 'grade 5', 'fifth',  '5th', 'v'] },
];

/** Convenience flat list of canonical labels (for legend display). */
export const CLASS_PROGRESSION = CLASS_SLOTS.map(s => s.label) as readonly string[];

/**
 * Returns the 0-based slot index for a class name, or -1 if not recognised.
 * Matching is case-insensitive and alias-aware.
 */
export function getClassSlotIndex(className: string): number {
  const key = className?.trim().toLowerCase();
  return CLASS_SLOTS.findIndex(slot =>
    slot.label.toLowerCase() === key || slot.aliases.includes(key)
  );
}
