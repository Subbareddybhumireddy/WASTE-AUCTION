import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Please log in before checkout.' }, { status: 401 });
  if (user.role !== 'BUYER' && user.role !== 'ADMIN') return NextResponse.json({ error: 'Only buyers can purchase listings.' }, { status: 403 });
  const { listingId } = await request.json();
  if (typeof listingId !== 'string' || !listingId) return NextResponse.json({ error: 'A listing is required.' }, { status: 400 });
  try {
    const order = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: listingId } });
      if (!listing || listing.status !== 'ACTIVE' || listing.saleType !== 'FIXED' || !listing.expectedPrice) {
        throw new Error('This fixed-price listing is no longer available.');
      }
      const alreadyReserved = await tx.order.findFirst({
        where: { listingId, paymentStatus: { in: ['PENDING', 'PAID'] }, status: { not: 'CANCELLED' } },
      });
      if (alreadyReserved) throw new Error('Checkout is already in progress for this listing.');
      const amount = listing.expectedPrice;
      const created = await tx.order.create({
        data: {
          listingId,
          buyerId: user.userId,
          sellerId: listing.sellerId,
          totalAmount: amount,
          platformFee: Math.round(amount * 0.05 * 100) / 100,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      });
      await tx.listing.update({ where: { id: listingId }, data: { status: 'RESERVED' } });
      return created;
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create order.' }, { status: 400 });
  }
}
