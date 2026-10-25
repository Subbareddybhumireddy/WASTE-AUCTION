'use client';

import { useState } from 'react';
import { WalletCards } from 'lucide-react';

export default function SellerPayoutSetup() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function setup() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/seller/connect', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not set up seller payouts.');
      window.location.assign(data.url);
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'Could not set up seller payouts.');
      setBusy(false);
    }
  }
  return <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="font-bold text-slate-900">Seller payouts</p><p className="text-xs text-slate-500">Complete Stripe Connect onboarding before releasing order funds.</p></div>
      <button type="button" disabled={busy} onClick={setup} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50"><WalletCards size={16} />{busy ? 'Opening…' : 'Set up payouts'}</button>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </div>;
}
