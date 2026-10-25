import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const bids = await prisma.bid.findMany({
    where: { listingId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { bidAmount: true, createdAt: true, buyer: { select: { phone: true } } },
  });
  return NextResponse.json({
    bids: bids.map((bid) => ({
      amount: bid.bidAmount,
      createdAt: bid.createdAt,
      bidder: `Bidder ****${(bid.buyer.phone || '').replace(/\D/g, '').slice(-2).padStart(2, '0')}`,
    })),
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Please log in to place a bid.' }, { status: 401 });
  if (user.role !== 'BUYER' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only buyers can place bids.' }, { status: 403 });
  }
  const { amount } = await request.json();
  const bidAmount = Number(amount);
  if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
    return NextResponse.json({ error: 'Enter a valid bid amount.' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: params.id },
        include: { bids: { orderBy: { bidAmount: 'desc' }, take: 1 } },
      });
      if (!listing || listing.status !== 'ACTIVE' || listing.saleType !== 'AUCTION') {
        throw new Error('This auction is no longer available.');
      }
      if (listing.sellerId === user.userId) throw new Error('You cannot bid on your own listing.');
      if (listing.endsAt && listing.endsAt <= new Date()) throw new Error('This auction has ended.');
      const currentBid = listing.bids[0]?.bidAmount ?? listing.expectedPrice ?? 0;
      if (bidAmount <= currentBid) throw new Error(`Your bid must be greater than ₹${currentBid}.`);
      const bid = await tx.bid.create({
        data: { listingId: listing.id, buyerId: user.userId, bidAmount },
      });
      const endsAt = listing.endsAt && listing.endsAt.getTime() - Date.now() <= 60_000
        ? new Date(listing.endsAt.getTime() + 120_000)
        : listing.endsAt;
      if (endsAt !== listing.endsAt) await tx.listing.update({ where: { id: listing.id }, data: { endsAt } });
      return { bid, endsAt };
    });
    return NextResponse.json({ success: true, bid: result.bid, endsAt: result.endsAt }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not place your bid.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
