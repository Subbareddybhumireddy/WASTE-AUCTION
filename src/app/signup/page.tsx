'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Recycle, 
  Sparkles, 
  CheckCircle2, 
  Phone, 
  User as UserIcon, 
  Mail, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  Store, 
  Factory 
} from 'lucide-react';
import { UserRole } from '@/types';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, sendOtp, verifyOtp, user } = useAuth();

  const initialRoleParam = searchParams.get('role');

  const [role, setRole] = useState<UserRole>(
    initialRoleParam?.toUpperCase() === 'SELLER' ? 'SELLER' : 'BUYER'
  );

  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      if (user.role === 'SELLER') router.push('/seller/dashboard');
      else if (user.role === 'ADMIN') router.push('/admin/dashboard');
      else router.push('/buyer/dashboard');
    }
  }, [user, router]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle Send OTP
  const handleSendOtp = async () => {
    if (!phone.trim()) {
      setErrorMessage('Please enter your mobile phone number.');
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const res = await sendOtp(phone, 'SIGNUP');
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to dispatch verification code.');
      } else {
        setOtpSent(true);
        setResendCooldown(60);
        if (res.devOtp) {
          setDevOtpCode(res.devOtp);
        }
        setSuccessMessage('6-digit verification code sent to ' + phone);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.length < 6) {
      setErrorMessage('Please enter the complete 6-digit OTP code.');
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const res = await verifyOtp(phone, otpCode, 'SIGNUP');
      if (!res.success) {
        setErrorMessage(res.error || 'Invalid or expired OTP code.');
      } else {
        setIsPhoneVerified(true);
        setSuccessMessage('Phone number verified successfully! Please complete your profile.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Final Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isPhoneVerified) {
      setErrorMessage('Please verify your phone number with OTP first.');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Please enter your full name or company name.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await signup({
        name,
        phone,
        email: email ? email.trim() : undefined,
        password,
        role,
        otpCode,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Registration failed.');
      } else {
        setSuccessMessage('Account registered! Welcoming you to your dashboard...');
        const target = role === 'SELLER' ? '/seller/dashboard' : '/buyer/dashboard';
        router.push(target);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden">
          
          {/* Green Branding Header */}
          <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-600 px-8 pt-7 pb-6 text-white text-center relative overflow-hidden">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center text-white mb-2 shadow-inner">
                <Recycle className="w-7 h-7 stroke-[2.2]" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                Create Your Account
              </h1>
              <p className="mt-1 text-xs font-medium tracking-wide text-emerald-100 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300 inline" />
                Join India&apos;s leading waste-to-worth ecosystem
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {/* STEP 1: ROLE CHOICE */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                1. Select Your Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('SELLER')}
                  className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                    role === 'SELLER'
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Store className="w-4 h-4" />
                    </div>
                    {role === 'SELLER' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Scrap Seller</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Turn surplus, metal, plastic, or cartons into liquid cash
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('BUYER')}
                  className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                    role === 'BUYER'
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Factory className="w-4 h-4" />
                    </div>
                    {role === 'BUYER' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Scrap Buyer</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Procure industrial recyclables & raw materials at verified market rates
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Error & Success Alerts */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs sm:text-sm animate-in fade-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-emerald-800 text-xs sm:text-sm animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                <div className="flex-1 font-medium">{successMessage}</div>
              </div>
            )}

            {/* Dev Mode OTP Banner */}
            {devOtpCode && !isPhoneVerified && (
              <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs">
                <p className="font-bold flex items-center gap-1 text-amber-800">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Dev Mode Phone OTP:
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-base font-extrabold tracking-widest text-emerald-800 bg-white px-2 py-0.5 rounded border border-amber-200">
                    {devOtpCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOtpCode(devOtpCode)}
                    className="text-xs font-semibold text-emerald-700 underline hover:text-emerald-800"
                  >
                    Auto-fill Code
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PHONE OTP VERIFICATION */}
            <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>2. Phone OTP Verification</span>
                {isPhoneVerified && (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1 text-xs lowercase">
                    <CheckCircle2 className="w-3.5 h-3.5" /> verified
                  </span>
                )}
              </label>

              {!isPhoneVerified ? (
                <div className="space-y-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+19876543210 (or 10-digit mobile)"
                      disabled={otpSent}
                      className="block w-full pl-10 pr-24 py-2.5 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 disabled:bg-gray-100"
                    />
                    {!otpSent ? (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={submitting || !phone.trim()}
                        className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        {submitting ? 'Sending...' : 'Send OTP'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode('');
                          setDevOtpCode(null);
                        }}
                        className="absolute right-2 top-2.5 text-xs font-medium text-gray-500 hover:text-emerald-700"
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {otpSent && (
                    <div className="space-y-2 pt-1 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Enter the 6-digit OTP:</span>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={resendCooldown > 0 || submitting}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:text-gray-400"
                        >
                          {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend'}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="6-digit code"
                          className="flex-1 px-3.5 py-2 text-center font-mono tracking-[0.25em] text-base font-bold bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={submitting || otpCode.length < 6}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition"
                        >
                          Verify OTP
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-900">{phone}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPhoneVerified(false);
                      setOtpSent(false);
                      setOtpCode('');
                    }}
                    className="text-[11px] text-gray-500 hover:text-red-600 underline"
                  >
                    Change Phone
                  </button>
                </div>
              )}
            </div>

            {/* STEP 3: ACCOUNT CREDENTIALS */}
            <form onSubmit={handleRegister} className="space-y-4">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider -mb-1">
                3. Your Account Details
              </label>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Name / Enterprise Name
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Acme Recyclers or John Doe"
                    required
                    className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Email Address <span className="text-gray-400 font-normal">(Optional for notifications)</span>
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 chars"
                      required
                      className="block w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      required
                      className="block w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !isPhoneVerified}
                className="w-full mt-3 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-md shadow-emerald-700/20 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Complete {role === 'SELLER' ? 'Seller' : 'Buyer'} Registration</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-gray-600">
              Already have an account?{' '}
              <a
                href={`/login?role=${role.toLowerCase()}`}
                className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                Log in here
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}

