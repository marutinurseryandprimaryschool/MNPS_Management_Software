'use client';

/* Opening balances for the Principal Register ledger (principalSettings/main).
   Cash in Hand and Bank Balance are rolled forward from these amounts — the
   engine counts ONLY transactions dated on or after `openingAsOf`. */

import React, { useEffect, useState } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { PrincipalSettingsService } from '@/lib/principal-service';
import {
  DEFAULT_EXPENSE_CATEGORIES, principalWriteError, refreshFailedMessage,
  surfaceCardStyle, todayKey, usePrincipalActor,
} from './principal-shared';
import type { PrincipalSettings } from '@/types/principal';

interface OpeningBalancesCardProps {
  settings: PrincipalSettings | null;
  academicYear: string;
  /** Principal only — the card renders read-only for anyone else. */
  canEdit: boolean;
  /** Refetch after a COMMITTED save. A failure here is never "not saved". */
  onSaved: () => Promise<void>;
}

interface FormState {
  openingCash: string;
  openingBank: string;
  openingAsOf: string;
}

const toForm = (settings: PrincipalSettings | null): FormState => ({
  openingCash: settings ? String(settings.openingCash ?? 0) : '',
  openingBank: settings ? String(settings.openingBank ?? 0) : '',
  openingAsOf: settings?.openingAsOf || '',
});

export default function OpeningBalancesCard({
  settings, academicYear, canEdit, onSaved,
}: OpeningBalancesCardProps) {
  const { showToast } = useToast();
  const actor = usePrincipalActor();
  const [form, setForm] = useState<FormState>(() => toForm(settings));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(toForm(settings)); }, [settings]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(previous => ({ ...previous, [key]: value }));

  const handleSave = async () => {
    if (saving || !canEdit) return;
    const openingCash = Number(form.openingCash);
    const openingBank = Number(form.openingBank);
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      showToast('Enter a valid opening cash amount', 'error'); return;
    }
    if (!Number.isFinite(openingBank) || openingBank < 0) {
      showToast('Enter a valid opening bank amount', 'error'); return;
    }
    if (!form.openingAsOf) {
      showToast('Pick the date these balances are correct as of', 'error'); return;
    }

    setSaving(true);
    try {
      await PrincipalSettingsService.save({
        academicYear: settings?.academicYear || academicYear,
        openingCash: Math.round(openingCash),
        openingBank: Math.round(openingBank),
        openingAsOf: form.openingAsOf,
        // Seeded once so the expense form always has categories to offer.
        expenseCategories: settings?.expenseCategories?.length
          ? settings.expenseCategories
          : [...DEFAULT_EXPENSE_CATEGORIES],
      }, actor);
    } catch (error) {
      console.error('Opening balances save failed', { form, error });
      showToast(principalWriteError(error, 'Only the Principal can set the opening balances.'), 'error');
      setSaving(false);
      return;
    }

    // Committed. A refetch failure below must NEVER read as "not saved".
    try {
      await onSaved();
      showToast('Opening balances saved');
    } catch (error) {
      console.error('Post-save refresh failed', error);
      showToast(refreshFailedMessage('Opening balances saved'), 'warning');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...surfaceCardStyle, padding: 'var(--space-5)' }}>
      <div className="text-overline" style={{ marginBottom: 'var(--space-2)' }}>Opening Balances</div>
      <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
        Cash in Hand and Bank Balance start from these amounts — only money received or spent
        <strong> on or after the &quot;as of&quot; date</strong> changes them.
        {settings?.openingAsOf ? '' : ' Not set yet, so balances currently count everything from ₹0.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
        <Input
          label="Opening Cash (₹)"
          type="number"
          min={0}
          inputMode="numeric"
          disabled={!canEdit}
          value={form.openingCash}
          onChange={e => setField('openingCash', e.target.value)}
        />
        <Input
          label="Opening Bank (₹)"
          type="number"
          min={0}
          inputMode="numeric"
          disabled={!canEdit}
          value={form.openingBank}
          onChange={e => setField('openingBank', e.target.value)}
        />
        <Input
          label="As of date"
          type="date"
          max={todayKey()}
          disabled={!canEdit}
          value={form.openingAsOf}
          onChange={e => setField('openingAsOf', e.target.value)}
        />
      </div>

      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
          <Button variant="secondary" onClick={handleSave} loading={saving}>Save Opening Balances</Button>
        </div>
      )}
    </div>
  );
}
