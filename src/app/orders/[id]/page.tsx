'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type Order = {
  id: string;
  totalAmount: number;
  platformFee: number;
  status: string;
  paymentStatus: string;
  escrowStatus: string;
  listing: { title: string; pickupAddress: string | null };
  seller: { name: string };
};

const milestones = ['Paid', 'Pickup scheduled', 'Pickup confirmed', 'Seller gets paid'];

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const response = await fetch(`/api/orders/${id}`, { cache: 'no-store' });
    const data = await response.json();
    if (response.ok) setOrder(data.order);
    else setError(data.error || 'Could not load order.');
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const sessionId = search.get('session_id');
    if (!sessionId) return;
    fetch(`/api/orders/${id}/payment/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) setError(data.error || 'Could not verify payment.');
      else await load();
    }).catch((verifyError) => setError(verifyError instanceof Error ? verifyError.message : 'Could not verify payment.'));
  }, [id, search, load]);

  async function startPayment() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/orders/${id}/payment`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Payment could not be started.');
      window.location.assign(data.checkoutUrl);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Payment could not be started.');
      setBusy(false);
    }
  }

  async function confirmPickup() {
    if (!window.confirm('Confirm that you received the listed material? This releases the held payment to the seller.')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/orders/${id}/pickup`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not confirm pickup.');
      await load();
    } catch (pickupError) {
      setError(pickupError instanceof Error ? pickupError.message : 'Could not confirm pickup.');
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/orders/${id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: review }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not submit review.');
      setNotice('Thank you. Your review was submitted.');
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not submit review.');
    } finally {
      setBusy(false);
    }
  }

  async function openDispute() {
    const details = window.prompt('Describe the order issue (at least 5 characters):');
    if (!details) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/orders/${id}/dispute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not submit dispute.');
      setNotice('Your dispute was sent to the safety team.');
      await load();
    } catch (disputeError) {
      setError(disputeError instanceof Error ? disputeError.message : 'Could not submit dispute.');
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <div className="mx-auto p-10">Loading order…</div>;
  const step = order.status === 'COMPLETED' ? 3 : order.status === 'PICKUP_CONFIRMED' ? 2 : order.paymentStatus === 'PAID' ? 1 : 0;
  return <div className="mx-auto w-full max-w-3xl px-4 py-10">
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">{order.paymentStatus === 'PAID' ? 'You won / order confirmed' : 'Checkout'}</p>
      <h1 className="mt-1 text-3xl font-black">{order.listing.title}</h1>
      <div className="mt-6 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
        <p className="flex justify-between"><span>Order amount</span><strong>₹{order.totalAmount.toLocaleString('en-IN')}</strong></p>
        <p className="flex justify-between"><span>Platform fee (included)</span><strong>₹{order.platformFee.toLocaleString('en-IN')}</strong></p>
        <p className="flex justify-between border-t pt-3 text-base"><span>Total</span><strong>₹{order.totalAmount.toLocaleString('en-IN')}</strong></p>
      </div>
      {order.paymentStatus !== 'PAID' && <button disabled={busy} onClick={startPayment} className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Starting secure checkout…' : 'Pay securely (Stripe test mode)'}</button>}
      {order.paymentStatus === 'PAID' && <div className="mt-6">
        <ol className="grid gap-3 sm:grid-cols-4">{milestones.map((label, index) => <li key={label} className="flex items-center gap-2 text-sm"><span className={index <= step ? 'text-emerald-700' : 'text-slate-300'}>{index <= step ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span>{label}</li>)}</ol>
        <p className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Payment authorization is held until pickup confirmation. The exact pickup address and seller contact details are available below.</p>
        {order.listing.pickupAddress && <div className="mt-4 rounded-lg border p-4"><p className="text-xs font-bold uppercase text-slate-500">Private pickup address</p><p className="mt-1">{order.listing.pickupAddress}</p><p className="mt-2 text-sm">Seller: {order.seller.name}</p></div>}
        {user?.role === 'BUYER' && order.status !== 'COMPLETED' && <button disabled={busy} onClick={confirmPickup} className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">Confirm pickup and release payment</button>}
      </div>}
      {order.status === 'COMPLETED' && <section className="mt-6 border-t pt-5"><h2 className="font-bold">Rate your experience</h2><div className="mt-3 flex items-center gap-3"><label htmlFor="rating" className="text-sm">Rating</label><select id="rating" value={rating} onChange={(event) => setRating(Number(event.target.value))} className="rounded border px-2 py-1">{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}</select></div><textarea value={review} onChange={(event) => setReview(event.target.value)} maxLength={2000} placeholder="Optional review" className="mt-3 w-full rounded-lg border p-3 text-sm" rows={3} /><button disabled={busy} onClick={submitReview} className="mt-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Submit review</button></section>}
      {order.status !== 'COMPLETED' && <button disabled={busy || order.status === 'DISPUTED'} onClick={openDispute} className="mt-5 text-sm font-semibold text-red-700 underline disabled:opacity-50">{order.status === 'DISPUTED' ? 'Dispute submitted' : 'Report a dispute'}</button>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    </div>
  </div>;
}
