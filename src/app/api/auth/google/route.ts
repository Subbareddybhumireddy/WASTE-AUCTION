import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const stateCookie = 'w2w_google_state';
const roleCookie = 'w2w_google_role';
const redirectCookie = 'w2w_google_redirect';

function safeRedirect(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '';
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/login?error=google-config', request.url));
  }
  const roleParam = request.nextUrl.searchParams.get('role')?.toUpperCase();
  const role = roleParam === 'SELLER' ? 'SELLER' : 'BUYER';
  const state = randomBytes(32).toString('hex');
  const callback = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/auth/google/callback`;
  const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', callback);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'openid email profile');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('prompt', 'select_account');
  const response = NextResponse.redirect(authorize);
  for (const [name, value] of [[stateCookie, state], [roleCookie, role], [redirectCookie, safeRedirect(request.nextUrl.searchParams.get('redirect'))]] as const) {
    response.cookies.set(name, value, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
      path: '/', maxAge: 600,
    });
  }
  return response;
}
