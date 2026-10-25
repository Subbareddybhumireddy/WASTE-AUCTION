import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Please log in before payment.' }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe test mode is not configured. Add STRIPE_SECRET_KEY to the server environment.' }, { status: 503 });
  }
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.buyerId !== user.userId || order.paymentStatus !== 'PENDING') {
    return NextResponse.json({ error: 'This order cannot be paid.' }, { status: 404 });
  }
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${siteUrl}/orders/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/orders/${order.id}?payment=cancelled`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'inr',
    'line_items[0][price_data][unit_amount]': String(Math.round(order.totalAmount * 100)),
    'line_items[0][price_data][product_data][name]': 'Waste marketplace order',
    'line_items[0][price_data][product_data][description]': `Order ${order.id}`,
    'payment_intent_data[capture_method]': 'manual',
    'payment_intent_data[metadata][orderId]': order.id,
    'payment_intent_data[transfer_group]': order.id,
  });
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });
    const session = await response.json();
    if (!response.ok || !session.url) {
      console.error('Stripe Checkout session creation failed:', session);
      return NextResponse.json({ error: 'Unable to start secure payment. Please try again.' }, { status: 502 });
    }
    await prisma.order.update({ where: { id: order.id }, data: { paymentReference: session.id } });
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('Stripe Checkout request failed:', error);
    return NextResponse.json({ error: 'Unable to connect to secure payment.' }, { status: 502 });
  }
}
