'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type HistoryData = {
  role: string;
  total: number;
  page: number;
  pages: number;
  totalAmount: number;
  monthly: Record<string, number>;
  orders: { id: string; status: string; totalAmount: number; completedAt: string | null; createdAt: string; listing: { title: string; quantity: number; location: string } }[];
};

export default function SalesHistoryPage() {
  const { user } = useAuth();
  const [data, setData] = useState<HistoryData | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [includePending, setIncludePending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), q: query, completed: String(!includePending) });
    fetch(`/api/sales-history?${params}`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'History unavailable.'));
  }, [page, query, includePending]);

  function exportCsv() {
    if (!data) return;
    const rows = [['Reference', 'Material', 'Weight (kg)', 'Amount', 'Status', 'Date', 'Approx area'], ...data.orders.map((order) => [
      order.id, order.listing.title, String(order.listing.quantity), String(order.totalAmount), order.status,
      new Date(order.completedAt || order.createdAt).toLocaleDateString(), order.listing.location,
    ])];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'waste-to-worth-sales-history.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!user) return <div className="p-12 text-center">Please sign in to view sales history.</div>;
  const sellerView = user.role === 'SELLER';
  const maxValue = Math.max(1, ...Object.values(data?.monthly || {}));
  return <div className="mx-auto w-full max-w-6xl px-4 py-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase text-emerald-700">Account activity</p><h1 className="text-3xl font-black">{sellerView ? 'Sales history' : 'Purchase history'}</h1></div><button onClick={exportCsv} disabled={!data?.orders.length} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-50"><Download size={16} /> Export CSV</button></div>
    <section className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">{sellerView ? 'Completed earnings' : 'Total spent'}</p><p className="mt-1 text-2xl font-black text-emerald-800">₹{(data?.totalAmount || 0).toLocaleString('en-IN')}</p><p className="mt-1 text-xs text-slate-500">Completed orders only</p></div>
      {sellerView && <div className="rounded-xl border bg-white p-5"><p className="font-bold">Monthly earnings (last 6 months)</p><div className="mt-4 flex h-28 items-end gap-2">{Object.entries(data?.monthly || {}).slice(-6).map(([month, amount]) => <div key={month} className="flex flex-1 flex-col items-center gap-1"><div title={`₹${amount}`} className="w-full rounded-t bg-emerald-600" style={{ height: `${Math.max(4, amount / maxValue * 82)}px` }} /><span className="text-[10px] text-slate-500">{month.slice(5)}</span></div>)}</div></div>}</section>
    <section className="mt-6 rounded-2xl border bg-white p-4 sm:p-6"><div className="flex flex-wrap gap-3"><label className="flex flex-1 items-center gap-2 rounded-lg border px-3"><Search size={16} className="text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search material" className="w-full py-2 outline-none" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includePending} onChange={(event) => setIncludePending(event.target.checked)} /> Include pending orders</label></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Material</th><th>Weight</th><th>Amount</th><th>Status</th><th>Date</th><th /></tr></thead><tbody className="divide-y">{(data?.orders || []).map((order) => <tr key={order.id}><td className="py-3 font-semibold">{order.listing.title}</td><td>{order.listing.quantity} kg</td><td>₹{order.totalAmount.toLocaleString('en-IN')}</td><td>{order.status.replaceAll('_', ' ')}</td><td>{new Date(order.completedAt || order.createdAt).toLocaleDateString()}</td><td><Link className="text-emerald-700 underline" href={`/orders/${order.id}`}>Details</Link></td></tr>)}</tbody></table>{!data?.orders.length && <p className="py-8 text-center text-sm text-slate-500">{error || 'No matching orders yet.'}</p>}</div>
      <div className="mt-4 flex justify-between text-sm"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Previous</button><span>Page {data?.page || page} of {data?.pages || 1}</span><button disabled={!data || page >= data.pages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Next</button></div>
    </section>
  </div>;
}
