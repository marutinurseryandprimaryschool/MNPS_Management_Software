/* Category dropdown options for payment entry/edit, built from the fee
   engine's allocated buckets — the ONLY source of pending amounts.
   Bucket order comes from the engine: Previous Balance, terms, ECA months,
   additional fees, bus months. "Other" (Unallocated) is always offered. */

import { OTHER_CATEGORY, type StudentFeeSummary } from '@/lib/fee-utils';

export interface CategoryOption {
  value: string;
  label: string;
}

/**
 * Builds the dropdown options from the student's engine summary: every
 * bucket with a pending balance, labelled with its balance and due state.
 * `ensureCategory` keeps the current category selectable in the edit
 * dialog even when its bucket is fully paid or gone.
 */
export function buildCategoryOptions(
  summary: StudentFeeSummary | null,
  ensureCategory?: string,
): CategoryOption[] {
  const options: CategoryOption[] = [{ value: '', label: 'Select Category' }];
  for (const bucket of summary?.buckets || []) {
    if (bucket.pending <= 0) continue;
    const balance = bucket.paid > 0
      ? `Bal: ₹${bucket.pending.toLocaleString()}`
      : `₹${bucket.pending.toLocaleString()}`;
    const due = bucket.isDue ? ' • due' : '';
    options.push({ value: bucket.category, label: `${bucket.category} — ${balance}${due}` });
  }
  if (
    ensureCategory &&
    ensureCategory !== OTHER_CATEGORY &&
    !options.some(o => o.value === ensureCategory)
  ) {
    options.push({ value: ensureCategory, label: ensureCategory });
  }
  options.push({ value: OTHER_CATEGORY, label: 'Other' });
  return options;
}

/** Pending amount for a category's bucket, or null when it has no bucket. */
export function pendingAmountFor(
  summary: StudentFeeSummary | null,
  category: string,
): number | null {
  const bucket = summary?.buckets.find(b => b.category === category);
  return bucket ? bucket.pending : null;
}
