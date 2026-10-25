import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyJWT } from './lib/token';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Identify role-protected routes
  const isSellerRoute = pathname.startsWith('/seller');
  const isBuyerRoute = pathname.startsWith('/buyer');
  const isAdminRoute = pathname.startsWith('/admin');

  if (!isSellerRoute && !isBuyerRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    let targetRole = 'seller';
    if (isBuyerRoute) targetRole = 'buyer';
    if (isAdminRoute) targetRole = 'admin';

    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    loginUrl.searchParams.set('role', targetRole);
    return NextResponse.redirect(loginUrl);
  }

  const user = await verifyJWT(token);
  if (!user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  // Check Role Authorization
  if (isSellerRoute) {
    if (user.role !== 'SELLER' && user.role !== 'ADMIN') {
      const unauthorizedUrl = new URL('/unauthorized', req.url);
      unauthorizedUrl.searchParams.set('required', 'Seller');
      unauthorizedUrl.searchParams.set('current', user.role);
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  if (isBuyerRoute) {
    if (user.role !== 'BUYER' && user.role !== 'ADMIN') {
      const unauthorizedUrl = new URL('/unauthorized', req.url);
      unauthorizedUrl.searchParams.set('required', 'Buyer');
      unauthorizedUrl.searchParams.set('current', user.role);
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  if (isAdminRoute) {
    if (user.role !== 'ADMIN') {
      const unauthorizedUrl = new URL('/unauthorized', req.url);
      unauthorizedUrl.searchParams.set('required', 'Admin');
      unauthorizedUrl.searchParams.set('current', user.role);
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  // Role is valid, proceed
  return NextResponse.next();
}

export const config = {
  matcher: ['/seller/:path*', '/buyer/:path*', '/admin/:path*'],
};

