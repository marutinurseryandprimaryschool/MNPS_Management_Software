'use client';

/* Opening-balances settings card (accounts/settings doc — Principal only).
   Cash in Hand / Bank Balance start from these openings; transactions dated
   ON or BEFORE `openingAsOf` are considered part of the openings, not flows
   (docs/designs/principal-role-fees-accounts.md, scope item 5). */

import React, { useEffect, useState } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { AccountsSettings } from '@/types/models';
import { describeWriteError, saveAccountsSettings } from './principal-shared';

interface OpeningBalancesCardProps {
  settings: AccountsSettings | null;
  onSaved: () => Promise<void> | void;
}

export default function OpeningBalancesCard({ settings, onSaved }: OpeningBalancesCardProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ openingCash: '', openingBank: '', openingAsOf: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      openingCash: settings ? String(settings.openingCash) : '',
      openingBank: settings ? String(settings.openingBank) : '',
      openingAsOf: settings?.openingAsOf || '',
    });
  }, [settings]);

  const handleSave = async () => {
    if (saving) return;
    const openingCash = Number(form.openingCash);
    const openingBank = Number(form.openingBank);
    if (!Number.isFinite(openingCash) || openingCash < 0) { showToast('Enter a valid opening cash amount', 'error'); return; }
    if (!Number.isFinite(openingBank) || openingBank < 0) { showToast('Enter a valid opening bank amount', 'error'); return; }
    if (!form.openingAsOf) { showToast('Pick the "as of" date for the opening balances', 'error'); return; }

    setSaving(true);
    try {
      await saveAccountsSettings({ openingCash, openingBank, openingAsOf: form.openingAsOf });
      showToast('Opening balances saved');
      await onSaved();
    } catch (e) {
      console.error('Opening balances save failed', { form, error: e });
      showToast(describeWriteError(e, 'set opening balances', 'Opening balances'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border)', padding: 'var(--space-5)',
    }}>
      <div className="text-overline" style={{ marginBottom: 'var(--space-2)' }}>Opening Balances</div>
      <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
        Balances start from these amounts. Collections and expenses dated on or before the
        &quot;as of&quot; date are treated as already included in them.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
        <Input
          label="Opening Cash (₹)"
          type="number"
          min={0}
          value={form.openingCash}
          onChange={e => setForm(p => ({ ...p, openingCash: e.target.value }))}
        />
        <Input
          label="Opening Bank (₹)"
          type="number"
          min={0}
          value={form.openingBank}
          onChange={e => setForm(p => ({ ...p, openingBank: e.target.value }))}
        />
        <Input
          label="As of date"
          type="date"
          value={form.openingAsOf}
          onChange={e => setForm(p => ({ ...p, openingAsOf: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
        <Button variant="secondary" onClick={handleSave} loading={saving}>Save Opening Balances</Button>
      </div>
    </div>
  );
}
