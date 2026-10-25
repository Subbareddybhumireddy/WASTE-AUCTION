'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Search, MapPin, Gavel, PackageSearch } from 'lucide-react';

const ListingsMap = dynamic(() => import('@/components/ListingsMap'), { ssr: false });

type Listing = {
  id: string;
  title: string;
  quantity: number;
  expectedPrice: number | null;
  saleType: string;
  endsAt: string | null;
  location: string;
  latitude: number | null;
  longitude: number | null;
  images: { imageUrl: string }[];
  category: { name: string };
  _count: { bids: number };
  currentBid?: number;
};

const categories = ['All', 'Metal', 'Plastic', 'Paper', 'E-waste'];

function kmBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [radius, setRadius] = useState('50');
  const [kind, setKind] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapView, setMapView] = useState(false);

  useEffect(() => {
    fetch('/api/listings').then((response) => response.json()).then((data) => setListings(data.listings || []))
      .catch((error) => console.error('Marketplace listings failed to load:', error))
      .finally(() => setLoading(false));
    const timer = window.setTimeout(() => {
      navigator.geolocation?.getCurrentPosition(({ coords }) => setPosition({ latitude: coords.latitude, longitude: coords.longitude }), () => {}, { timeout: 5000, maximumAge: 60000 });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const visibleListings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = listings.filter((listing) => {
      const categoryName = listing.category?.name.toLowerCase() || '';
      if (category !== 'All' && !(category.toLowerCase() === 'e-waste'
        ? categoryName.includes('e-waste') || categoryName.includes('electronic')
        : categoryName.includes(category.toLowerCase()))) return false;
      if (needle && !`${listing.title} ${listing.category?.name} ${listing.location}`.toLowerCase().includes(needle)) return false;
      if (kind !== 'ALL' && listing.saleType !== kind) return false;
      const latitude = listing.latitude;
      const longitude = listing.longitude;
      if (position && latitude != null && longitude != null &&
          kmBetween(position.latitude, position.longitude, latitude, longitude) > Number(radius)) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === 'ending' && a.endsAt && b.endsAt) return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
      if (sort === 'price') return (a.expectedPrice || 0) - (b.expectedPrice || 0);
      if (sort === 'nearest' && position && a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null) {
        return kmBetween(position.latitude, position.longitude, a.latitude, a.longitude) - kmBetween(position.latitude, position.longitude, b.latitude, b.longitude);
      }
      return 0;
    });
  }, [listings, query, category, radius, kind, sort, position]);

  return <div className="mx-auto w-full max-w-7xl px-4 py-8">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Waste to Worth</p><h1 className="text-3xl font-black text-slate-900">Explore materials nearby</h1></div>
      <Link href="/seller/sell" className="rounded-lg bg-emerald-700 px-4 py-2.5 text-center text-sm font-bold text-white">Sell your materials</Link>
    </div>
    <div className="mt-6 grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[1fr_auto_auto_auto]">
      <label className="flex items-center gap-2 rounded-lg border px-3"><Search size={18} className="text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search metal, paper, plastics…" className="w-full py-2 outline-none" /></label>
      <select aria-label="Distance radius" value={radius} onChange={(event) => setRadius(event.target.value)} className="rounded-lg border px-3 py-2"><option value="5">Within 5 km</option><option value="10">Within 10 km</option><option value="25">Within 25 km</option><option value="50">Within 50 km</option></select>
      <select aria-label="Sale type" value={kind} onChange={(event) => setKind(event.target.value)} className="rounded-lg border px-3 py-2"><option value="ALL">All listings</option><option value="AUCTION">Auction</option><option value="FIXED">Buy now</option></select>
      <select aria-label="Sort listings" value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border px-3 py-2"><option value="newest">Newest</option><option value="nearest">Nearest</option><option value="ending">Ending soon</option><option value="price">Lowest price</option></select>
    </div>
    <div className="my-4 flex flex-wrap items-center gap-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`rounded-full px-4 py-2 text-sm font-semibold ${category === item ? 'bg-emerald-700 text-white' : 'border bg-white text-slate-700'}`}>{item}</button>)}<button onClick={() => setMapView(!mapView)} className="ml-auto rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">{mapView ? 'Show listings' : 'Map view'}</button></div>
    {mapView && <div className="mb-5 overflow-hidden rounded-2xl border"><ListingsMap listings={visibleListings} position={position} /></div>}
    {!mapView && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {visibleListings.map((listing) => {
        const distance = position && listing.latitude != null && listing.longitude != null
          ? kmBetween(position.latitude, position.longitude, listing.latitude, listing.longitude).toFixed(1)
          : null;
        return <Link href={`/listings/${listing.id}`} key={listing.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          {listing.images[0] ? <img src={listing.images[0].imageUrl} alt="" className="h-48 w-full object-cover" /> : <div className="flex h-48 items-center justify-center bg-emerald-50 text-emerald-700"><PackageSearch size={44} /></div>}
          <div className="p-4">
            <div className="flex items-start justify-between gap-3"><h2 className="font-bold text-slate-900">{listing.title}</h2><span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800">{listing.saleType === 'AUCTION' ? 'AUCTION' : 'BUY NOW'}</span></div>
            <p className="mt-1 text-sm text-slate-500">{listing.quantity} kg · {listing.category?.name}</p>
            <div className="mt-3 flex items-center justify-between"><p className="text-lg font-black text-emerald-800">₹{(listing.currentBid ?? listing.expectedPrice ?? 0).toLocaleString('en-IN')} {listing.saleType === 'AUCTION' && <span className="text-xs font-medium">current bid</span>}</p>{listing.saleType === 'AUCTION' && <Gavel size={18} className="text-emerald-700" />}</div>
            <div className="mt-3 flex justify-between text-xs text-slate-500"><span className="flex items-center gap-1"><MapPin size={14} />{distance ? `${distance} km away` : listing.location}</span>{listing.endsAt && <span>{timeLeft(listing.endsAt)}</span>}</div>
          </div>
        </Link>;
      })}
    </div>}
    {!mapView && !loading && !visibleListings.length && <p className="py-16 text-center text-slate-500">No matching active listings. Try a wider radius or a different search.</p>}
    {loading && <p className="py-16 text-center text-emerald-800">Loading marketplace…</p>}
  </div>;
}

function timeLeft(endsAt: string) {
  const seconds = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
  if (!seconds) return 'Ended';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m left`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h left`;
  return `${Math.floor(seconds / 86400)}d left`;
}
