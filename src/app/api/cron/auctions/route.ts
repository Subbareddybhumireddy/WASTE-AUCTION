import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

async function endAuctions() {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'Auction scheduler is not configured.' }, { status: 503 });
  const now = new Date();
  const staleOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      paymentStatus: 'PENDING',
      createdAt: { lte: new Date(now.getTime() - 15 * 60 * 1000) },
      listing: { status: 'RESERVED' },
    },
    select: { id: true, listingId: true, listing: { select: { saleType: true } } },
    take: 100,
  });
  for (const order of staleOrders) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (!current || current.status !== 'PENDING' || current.paymentStatus !== 'PENDING') return;
      await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
      await tx.listing.updateMany({
        where: { id: order.listingId, status: 'RESERVED' },
        data: { status: order.listing.saleType === 'AUCTION' ? 'EXPIRED' : 'ACTIVE' },
      });
    });
  }
  const expired = await prisma.listing.findMany({
    where: { saleType: 'AUCTION', status: 'ACTIVE', endsAt: { lte: now } },
    select: { id: true, sellerId: true, expectedPrice: true, reservePrice: true },
    take: 100,
  });
  let winners = 0;
  for (const listing of expired) {
    await prisma.$transaction(async (tx) => {
      const latest = await tx.listing.findUnique({ where: { id: listing.id } });
      if (!latest || latest.status !== 'ACTIVE') return;
      const topBid = await tx.bid.findFirst({
        where: { listingId: listing.id },
        orderBy: { bidAmount: 'desc' },
        select: { id: true, buyerId: true, bidAmount: true },
      });
      if (topBid && (latest.reservePrice == null || topBid.bidAmount >= latest.reservePrice)) {
        const existing = await tx.order.findFirst({ where: { listingId: listing.id } });
        if (!existing) {
          await tx.order.create({
            data: {
              listingId: listing.id,
              bidId: topBid.id,
              buyerId: topBid.buyerId,
              sellerId: listing.sellerId,
              totalAmount: topBid.bidAmount,
              platformFee: Math.round(topBid.bidAmount * 0.05 * 100) / 100,
              status: 'PENDING',
              paymentStatus: 'PENDING',
            },
          });
        }
        await tx.listing.update({ where: { id: listing.id }, data: { status: 'RESERVED' } });
        winners += 1;
      } else {
        await tx.listing.update({ where: { id: listing.id }, data: { status: 'EXPIRED' } });
      }
    });
  }
  return NextResponse.json({ auctionsProcessed: expired.length, winners, staleReservationsReleased: staleOrders.length });
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return endAuctions();
}
