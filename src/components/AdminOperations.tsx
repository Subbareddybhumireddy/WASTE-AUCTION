'use client';

import { useEffect, useState } from 'react';

type Data = {
  users: number;
  listings: { id: string; title: string; location: string; status: string }[];
  reports: { id: string; reason: string; status: string; listing: { title: string } | null }[];
  rates: { id: string; itemName: string; minRate: number; maxRate: number; currentRate: number }[];
  categories: { id: string; name: string; co2Factor: number }[];
  completedOrders: number;
  unansweredQuestions: { id: string; question: string; createdAt: string }[];
};

export default function AdminOperations() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const load = () => fetch('/api/admin/operations').then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
  }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Admin data unavailable.'));
  useEffect(() => { void load(); }, []);

  async function update(payload: Record<string, unknown>) {
    const response = await fetch('/api/admin/operations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) return setError(result.error || 'Update failed.');
    setError('');
    await load();
  }
  if (!data) return <p className="mt-6 text-sm text-slate-500">{error || 'Loading operations…'}</p>;
  return <div className="mt-6 space-y-6">
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Registered users', data.users], ['Active listings', data.listings.length], ['Open reports', data.reports.length], ['Completed sales', data.completedOrders]].map(([label, count]) => <div key={String(label)} className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{count}</p></div>)}</section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Listing moderation</h2><div className="mt-3 divide-y">{data.listings.map((listing) => <div key={listing.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{listing.title} · {listing.location} <small className="text-slate-500">({listing.status.replaceAll('_', ' ')})</small></span><div className="flex gap-2">{listing.status === 'PENDING_REVIEW' && <button onClick={() => void update({ type: 'listing', id: listing.id, status: 'ACTIVE' })} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white">Approve</button>}<button onClick={() => void update({ type: 'listing', id: listing.id, status: 'CANCELLED' })} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">Remove</button></div></div>)}{!data.listings.length && <p className="py-3 text-sm text-slate-500">No active listings.</p>}</div></section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Safety reports</h2><div className="mt-3 divide-y">{data.reports.map((report) => <div key={report.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{report.reason} · {report.listing?.title || 'Account report'} <small className="text-slate-500">({report.status})</small></span><div className="flex gap-2"><button onClick={() => void update({ type: 'report', id: report.id, status: 'INVESTIGATING' })} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Investigate</button><button onClick={() => void update({ type: 'report', id: report.id, status: 'RESOLVED' })} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white">Resolve</button></div></div>)}{!data.reports.length && <p className="py-3 text-sm text-slate-500">No open reports.</p>}</div></section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Unanswered WasteBot questions</h2><div className="mt-3 divide-y">{data.unansweredQuestions.map((question) => <div key={question.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"><span className="max-w-3xl">{question.question}</span><button onClick={() => void update({ type: 'chatQuestion', id: question.id, status: 'RESOLVED' })} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Mark resolved</button></div>)}{!data.unansweredQuestions.length && <p className="py-3 text-sm text-slate-500">No unanswered questions.</p>}</div></section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Scrap rates and impact factors</h2><div className="mt-3 space-y-3">{data.rates.map((rate) => <RateEditor key={rate.id} rate={rate} save={update} />)}</div><div className="mt-5 border-t pt-4"><h3 className="text-sm font-bold">CO₂ savings estimate (kg avoided per kg recycled)</h3>{data.categories.map((category) => <label key={category.id} className="mt-2 flex items-center justify-between gap-3 text-sm">{category.name}<input type="number" min="0" max="100" step="0.1" defaultValue={category.co2Factor} onBlur={(event) => void update({ type: 'category', id: category.id, co2Factor: Number(event.target.value) })} className="w-24 rounded border px-2 py-1" /></label>)}</div></section>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </div>;
}

function RateEditor({ rate, save }: { rate: Data['rates'][number]; save: (payload: Record<string, unknown>) => Promise<void> }) {
  const [values, setValues] = useState({ minRate: rate.minRate, maxRate: rate.maxRate, currentRate: rate.currentRate });
  return <div className="grid grid-cols-2 items-center gap-2 border-b pb-3 sm:grid-cols-[1fr_repeat(3,100px)_auto]">
    <span className="col-span-2 text-sm font-semibold sm:col-span-1">{rate.itemName}</span>
    {(['minRate', 'maxRate', 'currentRate'] as const).map((field) => <label key={field} className="text-[10px] text-slate-500">{field.replace('Rate', '')}<input type="number" min="0" value={values[field]} onChange={(event) => setValues({ ...values, [field]: Number(event.target.value) })} className="mt-1 w-full rounded border px-2 py-1 text-sm text-slate-900" /></label>)}
    <button onClick={() => void save({ type: 'rate', id: rate.id, ...values })} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Save</button>
  </div>;
}
