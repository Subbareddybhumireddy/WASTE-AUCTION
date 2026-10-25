'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  ShieldCheck, 
  Users, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  FileText,
  DollarSign,
  TrendingUp,
  Database
} from 'lucide-react';
import { ScrapRateItem } from '@/types';
import AdminOperations from '@/components/AdminOperations';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [scrapRates, setScrapRates] = useState<ScrapRateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/scrap-rates')
      .then((res) => res.json())
      .then((data) => {
        if (data.rates) setScrapRates(data.rates);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Platform Administration
            </span>
            <span className="text-xs text-gray-500">• Superadmin Clearance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
            System & Operations Hub
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Monitor circular economy metrics, manage scrap rate benchmarks, and review compliance reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Database Healthy (SQLite/Prisma)
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
            <span>Total Registered Users</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">Live metrics below</p>
          <p className="text-[11px] text-gray-500 mt-1">Loaded from the database</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
            <span>Active Listings</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">See live operations</p>
          <p className="text-[11px] text-emerald-600 mt-1">Current listings are listed below</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
            <span>Market Scrap Rates</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">{scrapRates.length} Tracked</p>
          <p className="text-[11px] text-blue-600 mt-1">Updated real-time</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
            <span>Platform Reports</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-gray-900">See live operations</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Review current safety reports below</p>
        </div>
      </div>

      {/* Database Tables Overview */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-6">
        <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-600" />
          Configured Prisma Database Schema Tables
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
          {[
            { name: 'users', count: 'Configured', desc: 'seller / buyer / admin' },
            { name: 'listings', count: 'Configured', desc: 'scrap inventory' },
            { name: 'listing_images', count: 'Configured', desc: 'lot photos' },
            { name: 'bids', count: 'Configured', desc: 'buyer offers' },
            { name: 'orders', count: 'Configured', desc: 'pickup and payment' },
            { name: 'reviews', count: 'Configured', desc: 'feedback & ratings' },
            { name: 'reports', count: 'Configured', desc: 'dispute audits' },
            { name: 'categories', count: 'Configured', desc: 'scrap taxonomies' },
            { name: 'scrap_rates', count: 'Configured', desc: 'daily benchmark rates' },
            { name: 'otp_verifications', count: 'Configured', desc: 'phone SMS verification' },
          ].map((table) => (
            <div key={table.name} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="font-mono font-bold text-emerald-800">{table.name}</p>
              <p className="text-[11px] font-semibold text-gray-700 mt-0.5">{table.count}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{table.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scrap Rate Benchmark Management */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Live Scrap Commodity Benchmark Matrix
          </h2>
          <span className="text-xs font-semibold text-gray-500">Updated Daily</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Commodity</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Min Rate</th>
                <th className="px-4 py-3">Max Rate</th>
                <th className="px-4 py-3">Current Benchmark</th>
                <th className="px-4 py-3 rounded-r-lg">24h Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scrapRates.map((rate) => (
                <tr key={rate.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-bold text-gray-900">{rate.itemName}</td>
                  <td className="px-4 py-3">{rate.category?.name || 'Metals'}</td>
                  <td className="px-4 py-3 font-mono">{rate.unit}</td>
                  <td className="px-4 py-3 font-semibold">₹{rate.minRate}</td>
                  <td className="px-4 py-3 font-semibold">₹{rate.maxRate}</td>
                  <td className="px-4 py-3 font-black text-emerald-800 text-sm">₹{rate.currentRate}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${
                      (rate.priceChange || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {(rate.priceChange || 0) >= 0 ? '▲ +' : '▼ '}{rate.priceChange}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AdminOperations />
    </div>
  );
}
