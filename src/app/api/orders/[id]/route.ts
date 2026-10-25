import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      listing: { include: { images: true } },
      buyer: { select: { id: true } },
      seller: { select: { id: true, name: true, stripeAccountId: true } },
    },
  });
  if (!order || (user.role !== 'ADMIN' && order.buyerId !== user.userId && order.sellerId !== user.userId)) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }
  const unlockAddress = order.paymentStatus === 'PAID';
  const { paymentReference: _paymentReference, ...safeOrder } = order;
  return NextResponse.json({
    order: {
      ...safeOrder,
      pickupAddress: unlockAddress ? order.pickupAddress : null,
      listing: { ...order.listing, pickupAddress: unlockAddress ? order.listing.pickupAddress : null },
      seller: { id: order.seller.id, name: order.seller.name },
    },
  });
}
