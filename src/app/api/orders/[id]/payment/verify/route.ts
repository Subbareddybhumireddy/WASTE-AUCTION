import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  const { sessionId } = await request.json();
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.buyerId !== user.userId || order.paymentReference !== sessionId) {
    return NextResponse.json({ error: 'Payment session does not match this order.' }, { status: 403 });
  }
  try {
    const sessionResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      cache: 'no-store',
    });
    const session = await sessionResponse.json();
    const intent = session.payment_intent;
    if (!sessionResponse.ok || session.status !== 'complete' || !intent || intent.status !== 'requires_capture') {
      return NextResponse.json({ error: 'Payment authorization has not been confirmed yet.' }, { status: 409 });
    }
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        escrowStatus: 'HELD',
        status: 'PICKUP_SCHEDULED',
        paymentReference: intent.id,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Payment authorization verification failed:', error);
    return NextResponse.json({ error: 'Could not verify payment with Stripe.' }, { status: 502 });
  }
}
