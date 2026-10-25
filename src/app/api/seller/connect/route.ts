import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromCookie();
  if (!user || (user.role !== 'SELLER' && user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Seller sign-in is required.' }, { status: 403 });
  }
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Stripe test mode is not configured.' }, { status: 503 });
  try {
    const profile = await prisma.user.findUnique({ where: { id: user.userId }, select: { stripeAccountId: true } });
    let accountId = profile?.stripeAccountId;
    if (!accountId) {
      const accountForm = new URLSearchParams({ type: 'express', country: 'IN', 'capabilities[transfers][requested]': 'true' });
      const createResponse = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: accountForm,
      });
      const account = await createResponse.json();
      if (!createResponse.ok) {
        console.error('Stripe Connect account setup failed:', account);
        return NextResponse.json({ error: 'Unable to create seller payout profile.' }, { status: 502 });
      }
      accountId = account.id;
      await prisma.user.update({ where: { id: user.userId }, data: { stripeAccountId: accountId } });
    }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const linkForm = new URLSearchParams({
      account: accountId as string,
      type: 'account_onboarding',
      return_url: `${baseUrl}/seller/dashboard?connect=complete`,
      refresh_url: `${baseUrl}/seller/dashboard?connect=retry`,
    });
    const linkResponse = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: linkForm,
    });
    const link = await linkResponse.json();
    if (!linkResponse.ok || !link.url) {
      console.error('Stripe Connect onboarding link failed:', link);
      return NextResponse.json({ error: 'Unable to create seller payout onboarding link.' }, { status: 502 });
    }
    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error('Seller payout onboarding failed:', error);
    return NextResponse.json({ error: 'Unable to set up seller payouts.' }, { status: 502 });
  }
}
