'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Gavel, MapPin, ShieldCheck, Star } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type Listing = {
  id: string;
  title: string;
  description: string;
  quantity: number;
  condition: string;
  expectedPrice: number | null;
  currentBid: number | null;
  saleType: string;
  status: string;
  endsAt: string | null;
  location: string;
  images: { imageUrl: string }[];
  category: { name: string };
  seller: { rating: number | null; reviewCount: number };
  aiAnalysis: {
    waste_type: string;
    sub_category: string;
    price_per_kg_range: { min: number; max: number };
    recyclability_note: string;
    confidence: number;
  } | null;
};
type Bid = { amount: number; bidder: string; createdAt: string };

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [bidAmount, setBidAmount] = useState('');
  const [remaining, setRemaining] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reported, setReported] = useState(false);

  const refresh = useCallback(async () => {
    const [listingResponse, bidsResponse] = await Promise.all([
      fetch(`/api/listings/${id}`, { cache: 'no-store' }),
      fetch(`/api/listings/${id}/bids`, { cache: 'no-store' }),
    ]);
    if (listingResponse.ok) {
      const data = await listingResponse.json();
      setListing(data.listing);
      setBidAmount(String((data.listing.currentBid || 0) + 1));
    }
    if (bidsResponse.ok) setBids((await bidsResponse.json()).bids);
  }, [id]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (!listing?.endsAt) return;
    const tick = () => {
      const seconds = Math.max(0, Math.floor((new Date(listing.endsAt as string).getTime() - Date.now()) / 1000));
      setRemaining(seconds ? `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s` : 'Auction ended');
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [listing?.endsAt]);

  async function placeBid(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    const response = await fetch(`/api/listings/${id}/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(bidAmount) }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Could not place bid.');
    setNotice('Your bid is live.');
    await refresh();
  }

  async function buyNow() {
    if (!user) return router.push(`/login?role=buyer&redirect=${encodeURIComponent(`/listings/${id}`)}`);
    setError('');
    setNotice('');
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: id }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Could not start checkout.');
    router.push(`/orders/${data.order.id}`);
  }

  async function reportListing() {
    const reason = window.prompt('Why are you reporting this listing?');
    if (!reason) return;
    const details = window.prompt('Optional details (avoid sharing sensitive information):') || '';
    const response = await fetch(`/api/listings/${id}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, details }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Could not submit report.');
    else setReported(true);
  }

  if (!listing) return <div className="mx-auto max-w-5xl p-10 text-center">Loading listing…</div>;
  const images = listing.images || [];

  return <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.3fr_1fr]">
    <section>
      <div className="overflow-hidden rounded-2xl bg-slate-100">
        {images[imageIndex] ? <img src={images[imageIndex].imageUrl} alt={listing.title} className="h-[360px] w-full object-cover sm:h-[500px]" /> : <div className="flex h-[360px] items-center justify-center text-slate-400">No photos</div>}
      </div>
      {images.length > 1 && <div className="mt-3 flex gap-2">{images.map((image, index) => <button key={image.imageUrl} onClick={() => setImageIndex(index)} className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${imageIndex === index ? 'border-emerald-600' : 'border-transparent'}`}><img src={image.imageUrl} alt="" className="h-full w-full object-cover" /></button>)}</div>}
      <div className="mt-6 rounded-xl border bg-white p-4"><h2 className="font-bold">About this material</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{listing.description}</p></div>
      {listing.aiAnalysis && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h2 className="font-bold text-emerald-900">AI fair-price estimate</h2><p className="mt-1 text-sm">{listing.aiAnalysis.waste_type} · {listing.aiAnalysis.sub_category}</p><p className="mt-1 text-sm font-semibold">₹{listing.aiAnalysis.price_per_kg_range.min}–₹{listing.aiAnalysis.price_per_kg_range.max} per kg <span className="font-normal text-slate-500">(estimate)</span></p><p className="mt-2 text-sm text-slate-600">{listing.aiAnalysis.recyclability_note}</p><p className="mt-2 text-xs text-slate-500">AI guidance only; actual value depends on quality and local rates.</p></div>}
    </section>
    <section>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{listing.category?.name} · {listing.saleType === 'AUCTION' ? 'Auction' : 'Fixed price'}</span>
      <h1 className="mt-3 text-3xl font-black text-slate-900">{listing.title}</h1>
      {listing.status === 'PENDING_REVIEW' && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This listing is awaiting admin review and is not yet visible to buyers.</p>}
      <p className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600"><span>{listing.quantity} kg</span><span>· {listing.condition}</span><span className="flex items-center gap-1"><MapPin size={15} />{listing.location} area</span></p>
      <p className="mt-2 flex items-center gap-1 text-sm text-emerald-700"><Star size={15} fill="currentColor" /> {listing.seller.rating ? `${listing.seller.rating.toFixed(1)} (${listing.seller.reviewCount} reviews)` : 'New seller'} <ShieldCheck size={15} /></p>
      {listing.status !== 'ACTIVE' ? null : listing.saleType === 'AUCTION' ? <>
        <div className="mt-6 rounded-2xl border bg-white p-5">
          <p className="text-sm text-slate-500">Current bid</p>
          <p className="mt-1 text-3xl font-black text-emerald-800">₹{(listing.currentBid || 0).toLocaleString('en-IN')}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Gavel size={16} /> {remaining}</p>
          <form onSubmit={placeBid} className="mt-5 flex gap-2"><label className="sr-only" htmlFor="bid">Your bid amount</label><input id="bid" type="number" min={(listing.currentBid || 0) + 1} required value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} className="min-w-0 flex-1 rounded-lg border px-3 py-2" /><button className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white">Place bid</button></form>
          <p className="mt-2 text-xs text-slate-500">A bid within the last minute extends the auction by two minutes.</p>
        </div>
        <div className="mt-4 rounded-xl border bg-white p-4"><h2 className="font-bold">Bid history</h2><div className="mt-3 space-y-2">{bids.map((bid, index) => <div key={`${bid.createdAt}-${index}`} className="flex justify-between text-sm"><span>{bid.bidder}</span><span className="font-semibold">₹{bid.amount.toLocaleString('en-IN')}</span></div>)}{!bids.length && <p className="text-sm text-slate-500">No bids yet.</p>}</div></div>
      </> : <div className="mt-6 rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Buy now price</p><p className="mt-1 text-3xl font-black text-emerald-800">₹{(listing.expectedPrice || 0).toLocaleString('en-IN')}</p><button onClick={buyNow} className="mt-5 w-full rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white">Buy now</button></div>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <p className="mt-4 text-xs text-slate-500">Only an approximate area is displayed. The seller’s exact pickup address stays private until payment.</p>
      <button onClick={reportListing} disabled={reported} className="mt-4 text-xs font-semibold text-slate-500 underline disabled:no-underline">{reported ? 'Report submitted' : 'Report this listing'}</button>
    </section>
  </div>;
}
