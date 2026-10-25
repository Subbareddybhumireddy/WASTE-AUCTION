'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Recycle, 
  Sparkles, 
  Mail, 
  Lock, 
  Phone, 
  ArrowRight, 
  KeyRound, 
  AlertCircle, 
  CheckCircle2, 
} from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, sendOtp, verifyOtp, user } = useAuth();

  const redirectUrl = searchParams.get('redirect') || '';
  const initialRoleParam = searchParams.get('role');

  // Role toggle: 'SELLER' | 'BUYER'
  const [roleToggle, setRoleToggle] = useState<'SELLER' | 'BUYER'>(
    initialRoleParam?.toLowerCase() === 'buyer' ? 'BUYER' : 'SELLER'
  );

  // Login Mode: 'PASSWORD' or 'OTP'
  const [isOtpMode, setIsOtpMode] = useState(false);

  // Form State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // UI State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotDevOtp, setForgotDevOtp] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotComplete, setForgotComplete] = useState(false);

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError === 'google-config') setErrorMessage('Google sign-in is not configured on this server.');
    else if (oauthError === 'google') setErrorMessage('Google sign-in failed. Please try again or use phone/email login.');
  }, [searchParams]);

  // If already logged in, redirect to appropriate dashboard
  useEffect(() => {
    if (user) {
      if (redirectUrl) {
        router.push(redirectUrl);
      } else if (user.role === 'SELLER') {
        router.push('/seller/dashboard');
      } else if (user.role === 'BUYER') {
        router.push('/buyer/dashboard');
      } else if (user.role === 'ADMIN') {
        router.push('/admin/dashboard');
      }
    }
  }, [user, redirectUrl, router]);

  // Resend timer countdown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // 1. Password Login Handler
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('Please enter your phone number or email.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await login(identifier, password, roleToggle);
      if (!res.success) {
        setErrorMessage(res.error || 'Login failed. Please check your credentials.');
      } else {
        setSuccessMessage('Login successful! Redirecting to dashboard...');
        const target = redirectUrl
          ? redirectUrl
          : res.user?.role === 'SELLER'
          ? '/seller/dashboard'
          : res.user?.role === 'ADMIN'
          ? '/admin/dashboard'
          : '/buyer/dashboard';
        router.push(target);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 2. OTP Request Handler
  const handleSendOtp = async () => {
    if (!otpPhone.trim()) {
      setErrorMessage('Please enter your phone number to receive an OTP.');
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const res = await sendOtp(otpPhone, 'LOGIN');
      if (!res.success) {
        setErrorMessage(res.error || 'Could not send verification code.');
      } else {
        setOtpSent(true);
        setResendCooldown(60);
        if (res.devOtp) {
          setDevOtpCode(res.devOtp);
        }
        setSuccessMessage(res.message || 'Verification code sent to your phone.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 3. OTP Login Handler
  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!otpSent) {
      await handleSendOtp();
      return;
    }

    if (!otpCode.trim()) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await verifyOtp(otpPhone, otpCode, 'LOGIN');
      if (!res.success) {
        setErrorMessage(res.error || 'Invalid or expired OTP code.');
      } else {
        setSuccessMessage('Phone verified! Logging you in...');
        const target = redirectUrl
          ? redirectUrl
          : res.user?.role === 'SELLER'
          ? '/seller/dashboard'
          : res.user?.role === 'ADMIN'
          ? '/admin/dashboard'
          : '/buyer/dashboard';
        router.push(target);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    const params = new URLSearchParams({ role: roleToggle.toLowerCase() });
    if (redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) params.set('redirect', redirectUrl);
    window.location.assign(`/api/auth/google?${params.toString()}`);
  };

  const handleSendResetCode = async () => {
    setForgotBusy(true);
    setForgotError('');
    try {
      const response = await fetch('/api/auth/password-reset/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotInput }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send reset code.');
      setForgotSent(true);
      setForgotDevOtp(data.devOtp || null);
    } catch (resetError) {
      setForgotError(resetError instanceof Error ? resetError.message : 'Could not send reset code.');
    } finally {
      setForgotBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    setForgotBusy(true);
    setForgotError('');
    try {
      const response = await fetch('/api/auth/password-reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotInput, code: forgotCode, password: forgotPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not reset password.');
      setForgotComplete(true);
    } catch (resetError) {
      setForgotError(resetError instanceof Error ? resetError.message : 'Could not reset password.');
    } finally {
      setForgotBusy(false);
    }
  };

  // Quick Demo Autofill Helper
  const fillDemoAccount = (role: 'SELLER' | 'BUYER' | 'ADMIN') => {
    setIsOtpMode(false);
    setErrorMessage(null);
    if (role === 'SELLER') {
      setRoleToggle('SELLER');
      setIdentifier('seller@waste2worth.com');
      setPassword('Password123!');
    } else if (role === 'BUYER') {
      setRoleToggle('BUYER');
      setIdentifier('buyer@waste2worth.com');
      setPassword('Password123!');
    } else {
      setIdentifier('admin@waste2worth.com');
      setPassword('Admin123!');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Main Card with Green Header */}
        <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden">
          
          {/* GREEN HEADER WITH LOGO AND TAGLINE */}
          <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-600 px-8 pt-8 pb-7 text-white text-center relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-emerald-950/20 blur-md pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center text-white mb-3 shadow-inner">
                <Recycle className="w-9 h-9 stroke-[2.2] animate-[spin_12s_linear_infinite]" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
                Waste<span className="text-green-300">2</span>Worth
              </h1>
              {/* TAGLINE: "Turn your waste into worth" */}
              <p className="mt-1 text-sm font-semibold tracking-wide text-emerald-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-yellow-300 inline" />
                Turn your waste into worth
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {/* ROLE TOGGLE: "I want to sell / I want to buy" */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center">
                Select your market intent
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100/90 rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setRoleToggle('SELLER')}
                  className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    roleToggle === 'SELLER'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-700/30'
                      : 'text-gray-600 hover:text-emerald-700 hover:bg-white/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-white hidden sm:inline-block" />
                  I want to sell
                </button>
                <button
                  type="button"
                  onClick={() => setRoleToggle('BUYER')}
                  className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    roleToggle === 'BUYER'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-700/30'
                      : 'text-gray-600 hover:text-emerald-700 hover:bg-white/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-white hidden sm:inline-block" />
                  I want to buy
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5 text-center">
                {roleToggle === 'SELLER'
                  ? '🏭 List factory scrap, industrial surplus, or household recyclables'
                  : '♻️ Bid & purchase bulk scrap, metals, polymers, and raw recyclables'}
              </p>
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
            {devOtpCode && isOtpMode && (
              <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs">
                <p className="font-bold flex items-center gap-1 text-amber-800">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Demo Mode OTP Code:
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

            {/* LOGIN FORM: PASSWORD MODE OR OTP MODE */}
            {!isOtpMode ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                {/* PHONE OR EMAIL FIELD */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Phone number or Email address
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="+19876543210 or seller@waste2worth.com"
                      required
                      className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* PASSWORD FIELD */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* "Login with OTP instead" TOGGLE */}
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtpMode(true);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      if (identifier && !identifier.includes('@')) {
                        setOtpPhone(identifier);
                      }
                    }}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Login with OTP instead
                  </button>
                </div>

                {/* "LOG IN" BUTTON */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-md shadow-emerald-700/20 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Log in</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* OTP MODE FORM */
              <form onSubmit={handleOtpLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Registered Mobile Phone Number
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      value={otpPhone}
                      onChange={(e) => setOtpPhone(e.target.value)}
                      placeholder="+19876543210"
                      disabled={otpSent}
                      required
                      className="block w-full pl-10 pr-20 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900 disabled:opacity-60"
                    />
                    {!otpSent ? (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={submitting || !otpPhone}
                        className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        Send OTP
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
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {otpSent && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-700">
                        6-Digit Verification Code
                      </label>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={resendCooldown > 0 || submitting}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:text-gray-400"
                      >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit OTP"
                      autoFocus
                      required
                      className="block w-full px-3.5 py-2.5 text-center font-mono tracking-[0.3em] text-lg font-bold bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    />
                  </div>
                )}

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtpMode(false);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Login with Password instead
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-md shadow-emerald-700/20 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : otpSent ? (
                    <>
                      <span>Verify & Log in</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <span>Send Verification Code</span>
                  )}
                </button>
              </form>
            )}

            {/* DIVIDER */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-gray-400 font-semibold tracking-wider">
                  Or continue with
                </span>
              </div>
            </div>

            {/* "CONTINUE WITH GOOGLE" BUTTON */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-3 shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* "CREATE AN ACCOUNT" LINK */}
            <div className="mt-6 text-center text-xs text-gray-600">
              New to Waste to Worth?{' '}
              <a
                href={`/signup?role=${roleToggle.toLowerCase()}`}
                className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                Create an account
              </a>
            </div>
          </div>
        </div>

        {/* DEMO LOGINS */}
        <div className="mt-6 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
          <p className="text-xs font-bold text-emerald-900 mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Quick 1-Click Demo Logins:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillDemoAccount('SELLER')}
              className="py-1.5 px-2 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-[11px] font-bold hover:bg-emerald-100 transition shadow-sm text-center"
            >
              Demo Seller
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('BUYER')}
              className="py-1.5 px-2 rounded-lg bg-white border border-blue-300 text-blue-800 text-[11px] font-bold hover:bg-blue-100 transition shadow-sm text-center"
            >
              Demo Buyer
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('ADMIN')}
              className="py-1.5 px-2 rounded-lg bg-white border border-purple-300 text-purple-800 text-[11px] font-bold hover:bg-purple-100 transition shadow-sm text-center"
            >
              Demo Admin
            </button>
          </div>
        </div>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-2">Reset Password</h3>
            <p className="text-xs text-gray-600 mb-4">
              Enter your registered phone or email. We’ll send a verification code to the account phone.
            </p>

            {forgotComplete ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium mb-4">
                Password reset successfully. You can now log in.
              </div>
            ) : (
              <div className="mb-4">
                <input
                  type="text"
                  value={forgotInput}
                  onChange={(e) => setForgotInput(e.target.value)}
                  disabled={forgotSent}
                  placeholder="Enter phone or email"
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500"
                />
                {forgotSent && <>
                  {forgotDevOtp && <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">Development OTP: {forgotDevOtp}</p>}
                  <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={forgotCode} onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit verification code" className="mt-3 w-full text-xs p-2.5 rounded-lg border border-gray-300" />
                  <input type="password" autoComplete="new-password" maxLength={128} value={forgotPassword} onChange={(e) => setForgotPassword(e.target.value)} placeholder="New password (8+ characters)" className="mt-3 w-full text-xs p-2.5 rounded-lg border border-gray-300" />
                </>}
                {forgotError && <p role="alert" className="mt-2 text-xs text-red-700">{forgotError}</p>}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotSent(false);
                  setForgotInput('');
                  setForgotCode('');
                  setForgotPassword('');
                  setForgotDevOtp(null);
                  setForgotComplete(false);
                  setForgotError('');
                }}
                disabled={forgotBusy}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
              {forgotComplete ? null : forgotSent ? (
                <button type="button" disabled={forgotBusy} onClick={handlePasswordReset} className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
                  {forgotBusy ? 'Updating…' : 'Reset password'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={forgotBusy || !forgotInput.trim()}
                  onClick={handleSendResetCode}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  {forgotBusy ? 'Sending…' : 'Send reset code'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
