'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  ShoppingBag, 
  Search, 
  MapPin, 
  Tag, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  Filter,
  Package,
  ArrowRight
} from 'lucide-react';
import { ScrapRateItem } from '@/types';

export default function BuyerDashboard() {
  const { user } = useAuth();
  const [listings, setListings] = useState<any[]>([]);
  const [scrapRates, setScrapRates] = useState<ScrapRateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Place bid modal state
  const [biddingListing, setBiddingListing] = useState<any | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidNote, setBidNote] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);
  const [bidError, setBidError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ activeBids: number; completedOrders: number; totalSpent: number } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [listingsRes, ratesRes] = await Promise.all([
        fetch('/api/listings'),
        fetch('/api/scrap-rates'),
      ]);
      const listingsData = await listingsRes.json();
      const ratesData = await ratesRes.json();

      if (listingsData.success) {
        setListings(listingsData.listings || []);
      }
      if (ratesData.success) {
        setScrapRates(ratesData.rates || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetch('/api/dashboard/summary').then((response) => response.json()).then(setSummary)
        .catch((error) => console.error('Buyer dashboard summary failed:', error));
    }
  }, [user?.id]);

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biddingListing) return;
    setSubmittingBid(true);
    setBidError(null);
    try {
      const response = await fetch(`/api/listings/${biddingListing.id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(bidAmount), note: bidNote }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not place bid.');
      setBidSuccess(`Your bid of ₹${Number(bidAmount).toLocaleString('en-IN')} is live.`);
      await fetchData();
      window.setTimeout(() => {
        setBiddingListing(null);
        setBidSuccess(null);
        setBidAmount('');
        setBidNote('');
      }, 1500);
    } catch (error) {
      setBidError(error instanceof Error ? error.message : 'Could not place bid.');
    } finally {
      setSubmittingBid(false);
    }
  };

  const filteredListings = listings.filter((item) => {
    if (selectedCategory === 'ALL') return true;
    return item.categoryId === selectedCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              Buyer Portal
            </span>
            <span className="text-xs text-gray-500">• Authorized Industrial Buyer</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
            Welcome, {user?.name || 'Buyer'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Procure verified scrap lots, submit competitive bids, and coordinate seamless weighbridge pickups.
          </p>
        </div>

        <a
          href="/#scrap-rates"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all"
        >
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>Scrap Rate Index</span>
        </a>
      </div>

      {/* KPI Cards */}
      <a href="/sales-history" className="mt-4 inline-block text-sm font-semibold text-emerald-700 underline">View purchase history</a>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Available Scrap Lots</p>
            <p className="text-2xl font-black text-gray-900">{listings.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">My Active Bids</p>
            <p className="text-2xl font-black text-emerald-700">{summary?.activeBids ?? 0}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Completed Orders</p>
            <p className="text-2xl font-black text-gray-900">{summary?.completedOrders ?? 0}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center"><DollarSign className="w-6 h-6" /></div>
          <div><p className="text-xs font-medium text-gray-500">Total Spent</p><p className="text-2xl font-black text-gray-900">₹{(summary?.totalSpent ?? 0).toLocaleString('en-IN')}</p></div>
        </div>
      </div>

      {/* Marketplace Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Verified Scrap Lots Available for Bidding
          </h2>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs p-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Scrap Categories</option>
              {scrapRates.map((rate) => (
                <option key={rate.categoryId} value={rate.categoryId}>
                  {rate.category?.name || rate.itemName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-gray-200">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-500 mt-2">Loading scrap marketplace...</p>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-sm font-semibold text-gray-600">No scrap lots currently found for this filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredListings.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {item.category?.name || 'Recyclable'}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {item.location}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-gray-900">{item.title}</h3>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.description}</p>

                  <div className="mt-4 p-3 bg-gray-50 rounded-xl grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Available Quantity</p>
                      <p className="font-extrabold text-emerald-800 text-sm">
                        {item.quantity} {item.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Asking price (total)</p>
                      <p className="font-extrabold text-gray-900 text-sm">
                        {item.expectedPrice ? `₹${item.expectedPrice}` : 'Open to offers'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Seller: <span className="font-semibold text-gray-800">Marketplace seller</span>
                  </div>
                  <button
                    onClick={() => {
                      if (item.saleType === 'AUCTION') {
                        setBiddingListing(item);
                        setBidAmount(String((item.currentBid || 0) + 1));
                      } else {
                        window.location.assign(`/listings/${item.id}`);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition"
                  >
                    <span>{item.saleType === 'AUCTION' ? 'Place Bid' : 'Buy now'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Place Bid Modal */}
      {biddingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Submit Bid for {biddingListing.title}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Lot quantity: {biddingListing.quantity} {biddingListing.unit} • Location: {biddingListing.location}
            </p>

            {bidSuccess ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold text-center">
                {bidSuccess}
              </div>
            ) : (
              <form onSubmit={handlePlaceBid} className="space-y-3 text-xs">
                {bidError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{bidError}</p>}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Your bid price (₹ total)
                  </label>
                  <input
                    type="number"
                    required
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="Enter price per unit"
                    className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Logistics / Payment Note (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={bidNote}
                    onChange={(e) => setBidNote(e.target.value)}
                    placeholder="e.g. Prompt payment, our truck will arrive within 24 hours."
                    className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBiddingListing(null)}
                    className="px-3 py-1.5 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingBid || !bidAmount}
                    className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                  >
                    {submittingBid ? 'Submitting...' : 'Confirm Bid'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
