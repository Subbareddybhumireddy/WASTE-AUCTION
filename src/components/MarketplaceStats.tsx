'use client';

import { useEffect, useState } from 'react';

type Stats = {
  productsSold: number;
  kgRecycled: number;
  moneyPaidToSellers: number;
  liveAuctions: number;
  co2Saved: number;
  recentlySold: { type: string; weight: number; price: number; city: string; completedAt: string | null }[];
};

export default function MarketplaceStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    fetch('/api/stats').then((response) => response.json()).then(setStats)
      .catch((error) => console.error('Marketplace statistics failed to load:', error));
  }, []);
  useEffect(() => {
    if (!stats) return;
    let frame = 0;
    const started = performance.now();
    const animate = (now: number) => {
      const value = Math.min(1, (now - started) / 900);
      setProgress(value);
      if (value < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [stats]);
  if (!stats) return null;
  const values = [
    ['Products sold', Math.round(stats.productsSold * progress).toLocaleString('en-IN')],
    ['Kg recycled', `${Math.round(stats.kgRecycled * progress).toLocaleString('en-IN')} kg`],
    ['Paid to sellers', `₹${Math.round(stats.moneyPaidToSellers * progress).toLocaleString('en-IN')}`],
    ['Live auctions', Math.round(stats.liveAuctions * progress).toLocaleString('en-IN')],
    ['CO₂ saved (est.)', `${Math.round(stats.co2Saved * progress).toLocaleString('en-IN')} kg`],
  ];
  return <section aria-label="Marketplace impact" className="border-y border-emerald-100 bg-white px-4 py-7">
    <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 text-center sm:grid-cols-3 lg:grid-cols-5">
      {values.map(([label, value]) => <div key={label}><p className="text-xl font-black text-emerald-800 sm:text-2xl">{value}</p><p className="mt-1 text-xs font-medium text-slate-500">{label}</p></div>)}
    </div>
    {!!stats.recentlySold.length && <div className="mx-auto mt-6 max-w-7xl overflow-hidden border-t border-emerald-50 pt-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Recently completed sales</p>
      <div className="flex gap-6 overflow-x-auto pb-1">
        {stats.recentlySold.map((sale, index) => <div key={`${sale.type}-${index}`} className="min-w-[220px] rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <p className="font-bold text-slate-800">{sale.type} · {sale.weight} kg</p>
          <p className="mt-1 text-slate-500">₹{sale.price.toLocaleString('en-IN')} · {sale.city} · {sale.completedAt ? timeAgo(sale.completedAt) : 'recently'}</p>
        </div>)}
      </div>
    </div>}
  </section>;
}

function timeAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
