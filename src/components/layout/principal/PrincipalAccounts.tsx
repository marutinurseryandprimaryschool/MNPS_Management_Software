'use client';

/* Renamed: the Income & Expense screen now lives at
   ./accounts/AccountsSection.tsx alongside the day/month views it composes.
   This module is kept only so an older import path still resolves — it holds
   no logic, and (like the rest of the Principal Register) it never touches
   the legacy feePayments / expenses collections. */

export { default } from './accounts/AccountsSection';
