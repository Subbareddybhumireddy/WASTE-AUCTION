'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  Recycle, 
  Sparkles, 
  LogOut, 
  User as UserIcon, 
  ShieldCheck, 
  ShoppingBag, 
  TrendingUp, 
  PlusCircle, 
  Menu, 
  X,
  ChevronDown
} from 'lucide-react';

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [city, setCity] = useState('');

  React.useEffect(() => {
    let active = true;
    fetch('/api/location').then((response) => response.json()).then((data) => {
      if (active && data.city) setCity(data.city);
    }).catch((error) => console.error('Unable to detect visitor city:', error));

    const timer = window.setTimeout(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(async ({ coords }) => {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`);
          if (!response.ok) return;
          const data = await response.json();
          const detectedCity = data.address?.city || data.address?.town || data.address?.village;
          if (active && detectedCity) setCity(detectedCity);
        } catch (error) {
          console.error('GPS reverse geocoding failed:', error);
        }
      }, () => {}, { maximumAge: 60000, timeout: 5000 });
    }, 2500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const getDashboardHref = () => {
    if (!user) return '/login';
    if (user.role === 'SELLER') return '/seller/dashboard';
    if (user.role === 'BUYER') return '/buyer/dashboard';
    if (user.role === 'ADMIN') return '/admin/dashboard';
    return '/';
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SELLER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Seller Hub
          </span>
        );
      case 'BUYER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            Buyer Hub
          </span>
        );
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3 h-3 text-purple-600" />
            Admin
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur border-b border-emerald-100 shadow-sm">
      {/* Top Banner Tagline */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-700 text-white text-xs py-1.5 px-4 text-center font-medium flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
        <span>India&apos;s Trusted B2B Scrap & Circular Economy Marketplace</span>
        <span className="hidden sm:inline-block text-emerald-200 font-bold tracking-wide">| Turn your waste into worth</span>
      </div>

      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform duration-200">
                <Recycle className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xl tracking-tight text-gray-900 group-hover:text-emerald-700 transition-colors">
                    Waste<span className="text-emerald-600">2</span>Worth
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">
                  Turn your waste into worth
                </span>
              </div>
            </a>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <a 
              href="/#scrap-rates" 
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-emerald-700 transition"
            >
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Scrap Rates
            </a>
            <a href="/marketplace" className="text-sm font-medium text-gray-700 hover:text-emerald-700 transition">
              Marketplace
            </a>
            {city && <span className="text-xs text-gray-500" aria-live="polite">Near {city}</span>}

            <a 
              href="/#categories" 
              className="text-sm font-medium text-gray-700 hover:text-emerald-700 transition"
            >
              Categories
            </a>

            <a 
              href="/#how-it-works" 
              className="text-sm font-medium text-gray-700 hover:text-emerald-700 transition"
            >
              How It Works
            </a>
          </div>

          {/* User actions */}
          <div className="hidden md:flex items-center gap-3">
            {loading ? (
              <div className="w-20 h-8 bg-gray-100 rounded-lg animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                {getRoleBadge(user.role)}

                <a
                  href={getDashboardHref()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/30 transition-all hover:shadow"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Dashboard
                </a>

                {/* Profile menu */}
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-lg border border-gray-200 hover:border-emerald-300 transition bg-white"
                  >
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-gray-800 max-w-[120px] truncate">
                      {user.name}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                  </button>

                  {dropdownOpen && (
                    <div 
                      className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-xl border border-gray-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500">Signed in as</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-emerald-600 font-medium capitalize">{user.role.toLowerCase()}</p>
                      </div>

                      <a
                        href={getDashboardHref()}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <ShoppingBag className="w-4 h-4 text-emerald-600" />
                        My Dashboard
                      </a>

                      {user.role === 'SELLER' && (
                        <a
                          href="/seller/sell"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          <PlusCircle className="w-4 h-4 text-emerald-600" />
                          Post Scrap Listing
                        </a>
                      )}

                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <a
                  href="/login"
                  className="px-4 py-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50/70 rounded-lg transition"
                >
                  Log in
                </a>
                <a
                  href="/signup"
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm shadow-emerald-600/30 transition-all hover:shadow"
                >
                  Create account
                </a>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 flex flex-col gap-3">
            <a 
              href="/#scrap-rates" 
              className="px-2 py-1.5 text-sm font-medium text-gray-700 hover:text-emerald-600"
              onClick={() => setMenuOpen(false)}
            >
              Scrap Rates
            </a>
            <a 
              href="/#categories" 
              className="px-2 py-1.5 text-sm font-medium text-gray-700 hover:text-emerald-600"
              onClick={() => setMenuOpen(false)}
            >
              Categories
            </a>
            {user ? (
              <>
                <a
                  href={getDashboardHref()}
                  className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold text-center"
                  onClick={() => setMenuOpen(false)}
                >
                  Go to {user.role} Dashboard
                </a>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="px-3 py-2 rounded-lg text-red-600 text-sm font-semibold text-left"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                <a
                  href="/login"
                  className="w-full py-2 text-center text-sm font-semibold text-emerald-700 border border-emerald-300 rounded-lg"
                  onClick={() => setMenuOpen(false)}
                >
                  Log in
                </a>
                <a
                  href="/signup"
                  className="w-full py-2 text-center text-sm font-semibold text-white bg-emerald-600 rounded-lg"
                  onClick={() => setMenuOpen(false)}
                >
                  Create an account
                </a>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
