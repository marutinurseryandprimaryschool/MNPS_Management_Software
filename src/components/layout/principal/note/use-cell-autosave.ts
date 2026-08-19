'use client';

/* ============================================
   Fees Note — debounced cell autosave
   ============================================
   Sharmi types across a row the way she writes across her paper note. Every
   committed cell updates the screen immediately (optimistic) and schedules the
   Firestore write ~600ms later, so tabbing through School → ECA → Van costs
   ONE write instead of three.

   Two invariants:
   - A failed write hands back the ORIGINAL values so the caller can revert the
     exact cells it changed — never an intermediate keystroke.
   - Pending writes are flushed on unmount. Navigating away must not silently
     drop an edit the user already saw land on screen.
*/

import { useCallback, useEffect, useRef } from 'react';
import type { NewRegisterRow } from '@/types/principal';

export const AUTOSAVE_DELAY_MS = 600;

export type RowPatch = Partial<NewRegisterRow>;

interface PendingSave {
  timer: ReturnType<typeof setTimeout>;
  patch: RowPatch;
  /** Values as the server last confirmed them, for a clean revert. */
  revert: RowPatch;
}

export interface CellAutosave {
  /** Merge a committed cell into this row's pending write and restart the timer. */
  queue: (rowId: string, patch: RowPatch, revert: RowPatch) => void;
  /** Send this row's pending write now (no-op when nothing is pending). */
  flush: (rowId: string) => void;
}

export interface CellAutosaveOptions {
  save: (rowId: string, patch: RowPatch) => Promise<void>;
  onFailure: (rowId: string, revert: RowPatch, error: unknown) => void;
  delayMs?: number;
}

export function useCellAutosave(options: CellAutosaveOptions): CellAutosave {
  const { delayMs = AUTOSAVE_DELAY_MS } = options;
  const pendingRef = useRef(new Map<string, PendingSave>());

  // Keep the latest callbacks without re-creating queue/flush on every render:
  // a new `queue` identity each render would restart every debounce timer.
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; });

  const flush = useCallback((rowId: string) => {
    const pending = pendingRef.current.get(rowId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current.delete(rowId);
    optionsRef.current.save(rowId, pending.patch).catch(error => {
      console.error('[fees-note] cell autosave failed', { rowId, patch: pending.patch, error });
      optionsRef.current.onFailure(rowId, pending.revert, error);
    });
  }, []);

  const queue = useCallback((rowId: string, patch: RowPatch, revert: RowPatch) => {
    const existing = pendingRef.current.get(rowId);
    if (existing) clearTimeout(existing.timer);
    pendingRef.current.set(rowId, {
      // Newest value wins for the patch; the OLDEST original wins for the
      // revert, so two edits to one cell still roll back to server truth.
      patch: { ...(existing?.patch ?? {}), ...patch },
      revert: { ...revert, ...(existing?.revert ?? {}) },
      timer: setTimeout(() => flush(rowId), delayMs),
    });
  }, [flush, delayMs]);

  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      // Unmount: commit what the user already saw applied, then stop the clocks.
      for (const rowId of Array.from(pending.keys())) flush(rowId);
      for (const entry of pending.values()) clearTimeout(entry.timer);
      pending.clear();
    };
  }, [flush]);

  return { queue, flush };
}
