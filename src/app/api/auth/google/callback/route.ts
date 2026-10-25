import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { setAuthCookie, signJWT } from '@/lib/auth';
import { UserRole } from '@/types';

const cookieNames = ['w2w_google_state', 'w2w_google_role', 'w2w_google_redirect'] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const state = searchParams.get('state');
  const code = searchParams.get('code');
  const response = NextResponse.redirect(new URL('/login?error=google', request.url));
  const storedState = request.cookies.get(cookieNames[0])?.value;
  if (!state || !storedState || state !== storedState || !code) {
    cookieNames.forEach((name) => response.cookies.delete(name));
    return response;
  }

  try {
    const callback = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/auth/google/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: callback,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.id_token) throw new Error('Google token exchange failed.');
    const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenData.id_token)}`, { cache: 'no-store' });
    const claims = await verifyResponse.json();
    if (!verifyResponse.ok || claims.aud !== process.env.GOOGLE_CLIENT_ID || claims.email_verified !== 'true' || !claims.email) {
      throw new Error('Google identity verification failed.');
    }
    const email = String(claims.email).toLowerCase();
    const requestedRole = request.cookies.get(cookieNames[1])?.value === 'SELLER' ? 'SELLER' : 'BUYER';
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: typeof claims.name === 'string' ? claims.name : email.split('@')[0],
          role: requestedRole as UserRole,
          isEmailVerified: true,
        },
      });
    }
    const token = await signJWT({ userId: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role as UserRole });
    const destination = request.cookies.get(cookieNames[2])?.value || (
      user.role === 'ADMIN' ? '/admin/dashboard' : user.role === 'SELLER' ? '/seller/dashboard' : '/buyer/dashboard'
    );
    const success = NextResponse.redirect(new URL(destination, request.url));
    setAuthCookie(token);
    cookieNames.forEach((name) => success.cookies.delete(name));
    return success;
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    cookieNames.forEach((name) => response.cookies.delete(name));
    return response;
  }
}
