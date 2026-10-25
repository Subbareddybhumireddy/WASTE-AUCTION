'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, ArrowRight } from 'lucide-react';

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, logout } = useAuth();

  const requiredRole = searchParams.get('required') || 'Authorized Role';
  const currentRole = searchParams.get('current') || (user?.role || 'Guest');

  const getTargetDashboard = () => {
    if (!user) return '/login';
    if (user.role === 'SELLER') return '/seller/dashboard';
    if (user.role === 'BUYER') return '/buyer/dashboard';
    if (user.role === 'ADMIN') return '/admin/dashboard';
    return '/';
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-9 h-9" />
        </div>

        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Access Restricted</h1>
        <p className="mt-2 text-sm text-gray-600">
          This portal requires <span className="font-bold text-red-600">{requiredRole}</span> permissions.
        </p>

        <div className="my-5 p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700">
          You are currently signed in as{' '}
          <span className="font-bold text-gray-900 capitalize">{currentRole.toLowerCase()}</span>.
        </div>

        <div className="flex flex-col gap-2.5">
          <a
            href={getTargetDashboard()}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center justify-center gap-2"
          >
            <span>Go to your {user?.role || ''} Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <button
            onClick={() => logout()}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
          >
            Sign out / Switch account
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <UnauthorizedContent />
    </Suspense>
  );
}

