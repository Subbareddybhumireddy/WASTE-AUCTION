import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { seller: { select: { stripeAccountId: true } } },
  });
  if (!order || order.buyerId !== user.userId || order.paymentStatus !== 'PAID' ||
      !['HELD', 'PAYOUT_PENDING'].includes(order.escrowStatus) || !order.paymentReference) {
    return NextResponse.json({ error: 'Pickup cannot be confirmed for this order.' }, { status: 409 });
  }
  if (!order.seller.stripeAccountId) {
    return NextResponse.json({ error: 'The seller must complete payout setup before funds can be released.' }, { status: 409 });
  }
  try {
    if (order.escrowStatus === 'HELD') {
      const capture = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(order.paymentReference)}/capture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(),
      });
      const captured = await capture.json();
      if (!capture.ok || captured.status !== 'succeeded') {
        console.error('Stripe authorization capture failed:', captured);
        return NextResponse.json({ error: 'Payment could not be captured. Contact support before confirming pickup.' }, { status: 502 });
      }
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PICKUP_CONFIRMED', pickupConfirmedAt: new Date(), escrowStatus: 'PAYOUT_PENDING' },
      });
    }

    const transfer = await fetch('https://api.stripe.com/v1/transfers', {
      method: 'POST',
      body: new URLSearchParams({
        amount: String(Math.round((order.totalAmount - order.platformFee) * 100)),
        currency: 'inr',
        destination: order.seller.stripeAccountId,
        transfer_group: order.id,
      }),
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `seller-payout-${order.id}`,
      },
    });
    const payout = await transfer.json();
    if (!transfer.ok) {
      console.error('Seller payout transfer failed:', payout);
      return NextResponse.json({ error: 'Pickup was confirmed and payment captured, but the seller transfer failed. Retry or contact support.' }, { status: 502 });
    }
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED', completedAt: new Date(), pickupConfirmedAt: new Date(), escrowStatus: 'RELEASED' },
      }),
      prisma.listing.update({ where: { id: order.listingId }, data: { status: 'SOLD' } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pickup confirmation failed:', error);
    return NextResponse.json({ error: 'Could not confirm pickup and release funds.' }, { status: 502 });
  }
}
