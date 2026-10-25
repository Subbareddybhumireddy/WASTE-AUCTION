'use client';

import React, { useState, useEffect } from 'react';
import { 
  Recycle, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight, 
  Store, 
  Factory, 
  Truck, 
  Scale, 
  CheckCircle2, 
  DollarSign, 
  Layers 
} from 'lucide-react';
import { ScrapRateItem } from '@/types';
import { useAuth } from '@/context/AuthContext';
import MarketplaceStats from '@/components/MarketplaceStats';

export default function HomePage() {
  const { user } = useAuth();
  const [scrapRates, setScrapRates] = useState<ScrapRateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/scrap-rates')
      .then((res) => res.json())
      .then((data) => {
        if (data.rates) setScrapRates(data.rates);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-900 via-emerald-800 to-green-900 text-white py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-emerald-200 text-xs font-bold mb-6">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span>India&apos;s Certified B2B Recyclables Marketplace</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight text-white">
            Turn your waste <span className="text-emerald-400">into worth</span>
          </h1>

          <p className="mt-4 sm:mt-6 text-base sm:text-xl text-emerald-100 max-w-2xl mx-auto font-normal">
            Connect industrial scrap sellers with verified recycling mills. 
            Real-time market rates, guaranteed weighbridge accuracy, and secure digital settlements.
          </p>

          {/* DUAL ROLE CTAS */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={user?.role === 'SELLER' ? '/seller/dashboard' : '/login?role=seller'}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30 hover:scale-105 transition-all duration-200"
            >
              <Store className="w-4 h-4" />
              <span>I Want to Sell Scrap</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href={user?.role === 'BUYER' ? '/buyer/dashboard' : '/login?role=buyer'}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur hover:scale-105 transition-all duration-200"
            >
              <Factory className="w-4 h-4" />
              <span>I Want to Buy Scrap</span>
              <ArrowRight className="w-4 h-4 text-emerald-300" />
            </a>
          </div>

          {/* Quick trust badges */}
          <div className="mt-10 pt-8 border-t border-emerald-700/50 flex flex-wrap items-center justify-center gap-6 text-xs text-emerald-200">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Phone OTP Verified Users
            </span>
            <span className="flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-emerald-400" /> Certified Weighbridge Slips
            </span>
            <span className="flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-emerald-400" /> End-to-End Logistics Tracking
            </span>
          </div>
        </div>
      </section>

      <MarketplaceStats />

      {/* LIVE SCRAP RATES TICKER / TABLE */}
      <section id="scrap-rates" className="py-12 bg-slate-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
                <TrendingUp className="w-4 h-4" />
                Live Market Commodity Index
              </div>
              <h2 className="text-2xl font-black text-gray-900">
                Today&apos;s Scrap Market Benchmark Rates
              </h2>
            </div>
            <p className="text-xs text-gray-500">
              Updated hourly based on certified secondary metal & recycling mill prices.
            </p>
          </div>

          {loading ? (
            <div className="p-8 bg-white rounded-2xl border border-gray-200 text-center">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {scrapRates.map((rate) => (
                <div
                  key={rate.id}
                  className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-emerald-300 transition-all flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {rate.category?.name || 'Recyclable'}
                    </span>
                    <h3 className="text-sm font-bold text-gray-900 mt-1">{rate.itemName}</h3>
                    <p className="text-xs text-gray-400">Range: ₹{rate.minRate} - ₹{rate.maxRate} / {rate.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-emerald-800">₹{rate.currentRate}</p>
                    <span className="text-[11px] font-semibold text-gray-500">/{rate.unit}</span>
                    <p className={`text-[10px] font-bold ${
                      (rate.priceChange || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {(rate.priceChange || 0) >= 0 ? '▲ +' : '▼ '}{rate.priceChange}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            How Waste to Worth Powers Circular Trade
          </h2>
          <p className="mt-2 text-sm text-gray-600 max-w-xl mx-auto">
            Zero hassle. Verified counterparties. Complete transparency from weighment to payout.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 text-left">
            <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-4">
                  1
                </div>
                <h3 className="text-base font-bold text-gray-900">List Scrap in Seconds</h3>
                <p className="text-xs text-gray-600 mt-2">
                  Take photos of copper, cardboard cartons, plastics, or machinery. Input estimated tonnage and your expected price.
                </p>
              </div>
              <div className="mt-6 text-xs font-semibold text-emerald-700">
                For Industrial & Retail Sellers →
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
                  2
                </div>
                <h3 className="text-base font-bold text-gray-900">Receive Direct Mill Bids</h3>
                <p className="text-xs text-gray-600 mt-2">
                  Verified recyclers, foundries, and paper mills compete with live price offers. Accept the highest or best logistics bid.
                </p>
              </div>
              <div className="mt-6 text-xs font-semibold text-blue-700">
                Transparent Counteroffers →
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-bold mb-4">
                  3
                </div>
                <h3 className="text-base font-bold text-gray-900">Weighbridge & Instant Pay</h3>
                <p className="text-xs text-gray-600 mt-2">
                  Truck arrives with digital weighbridge slip verification. Confirm weight and receive immediate payment.
                </p>
              </div>
              <div className="mt-6 text-xs font-semibold text-green-700">
                100% Guaranteed Settlement →
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
