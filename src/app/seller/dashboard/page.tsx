'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  PlusCircle, 
  Package, 
  TrendingUp, 
  Tag, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  DollarSign, 
  Sparkles,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { ScrapRateItem } from '@/types';
import SellerPayoutSetup from '@/components/SellerPayoutSetup';
import { useRouter } from 'next/navigation';

export default function SellerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<any[]>([]);
  const [scrapRates, setScrapRates] = useState<ScrapRateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New listing form state
  const [newListing, setNewListing] = useState({
    categoryId: '',
    title: '',
    description: '',
    quantity: '',
    unit: 'kg',
    expectedPrice: '',
    condition: 'Standard Scrap',
    location: user?.city || 'Industrial Yard A, Sector 4',
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
  });
  const [creating, setCreating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ receivedBids: number; earnings: number } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [listingsRes, ratesRes] = await Promise.all([
        fetch(`/api/listings?sellerId=${encodeURIComponent(user?.id || '')}`),
        fetch('/api/scrap-rates'),
      ]);
      const listingsData = await listingsRes.json();
      const ratesData = await ratesRes.json();

      if (listingsData.success) {
        setListings(listingsData.listings || []);
      }
      if (ratesData.success) {
        setScrapRates(ratesData.rates || []);
        if (ratesData.rates?.length > 0 && !newListing.categoryId) {
          setNewListing((prev) => ({ ...prev, categoryId: ratesData.rates[0].categoryId }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetch('/api/dashboard/summary').then((response) => response.json()).then(setSummary)
        .catch((error) => console.error('Seller dashboard summary failed:', error));
    }
  }, [user?.id]);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newListing),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackMsg(`❌ ${data.error || 'Failed to create listing'}`);
      } else {
        setFeedbackMsg('✅ Scrap listing published to marketplace!');
        setShowModal(false);
        fetchData();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Seller Portal
            </span>
            <span className="text-xs text-gray-500">• Verified Supplier</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
            Welcome, {user?.name || 'Seller'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Manage your scrap inventory, track incoming buyer bids, and monetize industrial waste.
          </p>
        </div>

        <button
          onClick={() => router.push('/seller/sell')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-700/20 transition-all"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Post Scrap Listing</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
          {feedbackMsg}
        </div>
      )}
      <SellerPayoutSetup />
      <a href="/sales-history" className="mt-3 inline-block text-sm font-semibold text-emerald-700 underline">View completed sales history</a>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">My Listings</p>
            <p className="text-2xl font-black text-gray-900">{listings.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Live Bids Received</p>
            <p className="text-2xl font-black text-gray-900">
              {summary?.receivedBids ?? listings.reduce((acc, curr) => acc + (curr._count?.bids || 0), 0)}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Estimated Stock Value</p>
            <p className="text-2xl font-black text-emerald-700">₹{(summary?.earnings ?? 0).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column: Active Listings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              My Scrap Listings
            </h2>
            <span className="text-xs font-semibold text-gray-500">{listings.length} items</span>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-gray-200">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-gray-500 mt-2">Loading your listings...</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-300">
              <Package className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-gray-900">No listings yet</h3>
              <p className="text-xs text-gray-500 mt-1 mb-4">Post your first scrap or recyclable lot to start receiving buyer bids.</p>
              <button
                onClick={() => router.push('/seller/sell')}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
              >
                Create Listing
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {listings.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:border-emerald-300 transition-all flex flex-col sm:flex-row gap-4 justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {item.category?.name || 'Recyclable'}
                      </span>
                      <span className="text-xs font-medium text-gray-400">•</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {item.location}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-gray-900">{item.title}</h3>
                    <p className="text-xs text-gray-600 line-clamp-2 mt-1">{item.description}</p>

                    <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-gray-700">
                      <div>
                        Quantity: <span className="text-emerald-700 font-extrabold">{item.quantity} {item.unit}</span>
                      </div>
                      {item.expectedPrice && (
                        <div>
                          Expected: <span className="text-gray-900 font-bold">₹{item.expectedPrice}/{item.unit}</span>
                        </div>
                      )}
                      <div className="text-emerald-600 font-bold">
                        {item._count?.bids || 0} Bids Received
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col justify-end items-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      ● {item.status === 'PENDING_REVIEW' ? 'Under review' : item.status}
                    </span>
                    <button
                      onClick={() => alert(`Reviewing bids for: ${item.title}`)}
                      className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                    >
                      View Bids
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: Live Market Scrap Rates */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Live Scrap Benchmarks
            </h2>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
            <p className="text-xs text-gray-500">
              Reference daily benchmark rates across industrial mills to price your lot competitively.
            </p>

            <div className="divide-y divide-gray-100">
              {scrapRates.slice(0, 6).map((rate) => (
                <div key={rate.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-gray-900">{rate.itemName}</p>
                    <p className="text-[11px] text-gray-400">{rate.category?.name || 'Metals'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-gray-900">₹{rate.currentRate}/{rate.unit}</p>
                    <p className={`text-[10px] font-bold ${
                      (rate.priceChange || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {(rate.priceChange || 0) >= 0 ? '▲ +' : '▼ '}{rate.priceChange}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Post Listing Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                List Scrap for Sale
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateListing} className="space-y-4 mt-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Scrap Title</label>
                <input
                  type="text"
                  required
                  value={newListing.title}
                  onChange={(e) => setNewListing({ ...newListing, title: e.target.value })}
                  placeholder="e.g. 500 kg Industrial Clean Copper Scrap Wire"
                  className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newListing.quantity}
                    onChange={(e) => setNewListing({ ...newListing, quantity: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Unit</label>
                  <select
                    value={newListing.unit}
                    onChange={(e) => setNewListing({ ...newListing, unit: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="ton">Metric Tons</option>
                    <option value="quintal">Quintals</option>
                    <option value="piece">Pieces / Units</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Expected Price (₹/unit)</label>
                  <input
                    type="number"
                    value={newListing.expectedPrice}
                    onChange={(e) => setNewListing({ ...newListing, expectedPrice: e.target.value })}
                    placeholder="e.g. 710"
                    className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Condition</label>
                  <input
                    type="text"
                    value={newListing.condition}
                    onChange={(e) => setNewListing({ ...newListing, condition: e.target.value })}
                    placeholder="e.g. Sorted, Stripped, Baled"
                    className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Pickup Location / City</label>
                <input
                  type="text"
                  required
                  value={newListing.location}
                  onChange={(e) => setNewListing({ ...newListing, location: e.target.value })}
                  placeholder="e.g. Yard 4, Industrial Area, Sector 12"
                  className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Detailed Description</label>
                <textarea
                  rows={3}
                  required
                  value={newListing.description}
                  onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                  placeholder="Mention purity, contamination level, packaging, weighing method, etc."
                  className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
                >
                  {creating ? 'Publishing...' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
