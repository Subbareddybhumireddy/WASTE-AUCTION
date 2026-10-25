import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getCurrentUserFromCookie();
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      images: true,
      seller: { select: { city: true, reviewsReceived: { select: { rating: true } } } },
      bids: { orderBy: { bidAmount: 'desc' }, take: 1, select: { bidAmount: true } },
      _count: { select: { bids: true } },
    },
  });
  if (!listing || (listing.status !== 'ACTIVE' &&
      (!session || (session.role !== 'ADMIN' && (session.role !== 'SELLER' || session.userId !== listing.sellerId))))) {
    return NextResponse.json({ error: 'Listing not found or no longer active.' }, { status: 404 });
  }
  const {
    pickupAddress: _privateAddress,
    pickupSlot: _pickupSlot,
    pincode: _pincode,
    sellerId: _sellerId,
    latitude,
    longitude,
    ...publicListing
  } = listing;
  const ratings = listing.seller.reviewsReceived.map((review) => review.rating);
  return NextResponse.json({
    listing: {
      ...publicListing,
      latitude: latitude == null ? null : Number(latitude.toFixed(2)),
      longitude: longitude == null ? null : Number(longitude.toFixed(2)),
      seller: {
        city: listing.seller.city,
        rating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
        reviewCount: ratings.length,
      },
      currentBid: listing.bids[0]?.bidAmount ?? listing.expectedPrice,
      aiAnalysis: listing.aiAnalysis ? JSON.parse(listing.aiAnalysis) : null,
    },
  });
}
