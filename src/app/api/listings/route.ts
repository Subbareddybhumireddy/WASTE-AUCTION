import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';
import { verifyAnalysis } from '@/lib/analysis-signature';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const sellerId = searchParams.get('sellerId');
    const session = await getCurrentUserFromCookie();

    const where: any = { status: 'ACTIVE' };
    if (categoryId) where.categoryId = categoryId;
    if (sellerId) {
      if (!session || (session.role !== 'ADMIN' && (session.role !== 'SELLER' || session.userId !== sellerId))) {
        return NextResponse.json({ error: 'You may only view your own seller listings.' }, { status: 403 });
      }
      where.sellerId = sellerId;
      delete where.status;
    }
    const query = searchParams.get('q')?.trim();
    const saleType = searchParams.get('saleType');
    if (saleType === 'AUCTION' || saleType === 'FIXED') where.saleType = saleType;
    if (query) where.OR = [
      { title: { contains: query } },
      { description: { contains: query } },
      { category: { name: { contains: query } } },
    ];

    const listings = await prisma.listing.findMany({
      where,
      include: {
        images: true,
        category: true,
        bids: { orderBy: { bidAmount: 'desc' }, take: 1, select: { bidAmount: true } },
        seller: {
          select: {
            city: true,
          },
        },
        _count: {
          select: { bids: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      listings: listings.map((listing) => {
        const {
          pickupAddress: _pickupAddress,
          pickupSlot: _pickupSlot,
          pincode: _pincode,
          sellerId: _sellerId,
          latitude,
          longitude,
          ...publicListing
        } = listing;
        return {
          ...publicListing,
          latitude: latitude == null ? null : Number(latitude.toFixed(2)),
          longitude: longitude == null ? null : Number(longitude.toFixed(2)),
          currentBid: listing.bids[0]?.bidAmount ?? listing.expectedPrice,
        };
      }),
    });
  } catch (error: any) {
    console.error('Fetch listings error:', error);
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUserFromCookie();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    if (session.role !== 'SELLER' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only registered sellers can create scrap listings.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      categoryId, title, description, quantity, unit = 'kg', expectedPrice, condition,
      location, pickupAddress, imageUrl, imageUrls, saleType = 'FIXED',
      reservePrice, endsAt, aiAnalysis, analysisToken, latitude, longitude, pickupSlot,
    } = body;

    const weight = Number(quantity);
    const images: string[] = Array.isArray(imageUrls) ? imageUrls : imageUrl ? [imageUrl] : [];
    if (!categoryId || !title?.trim() || !description?.trim() || !Number.isFinite(weight) || weight <= 0 || !location?.trim()) {
      return NextResponse.json({ error: 'Please provide all required listing details.' }, { status: 400 });
    }
    if (!['FIXED', 'AUCTION'].includes(saleType) || images.length > 5 ||
        images.some((url) => typeof url !== 'string' || !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(url))) {
      return NextResponse.json({ error: 'Please provide a valid sale type and up to 5 Cloudinary photo URLs.' }, { status: 400 });
    }
    if (!images.length || typeof analysisToken !== 'string' ||
        !verifyAnalysis(analysisToken, session.userId, images, aiAnalysis)) {
      return NextResponse.json({ error: 'Analyze the current listing photos before submitting this listing.' }, { status: 400 });
    }
    if (saleType === 'AUCTION' && (!Number.isFinite(Number(expectedPrice)) || !endsAt || new Date(endsAt) <= new Date())) {
      return NextResponse.json({ error: 'Auctions require a start price and an end time in the future.' }, { status: 400 });
    }
    const hazardousTerms = /\b(medical waste|clinical waste|biohazard|radioactive|asbestos|pesticide|industrial chemical|toxic chemical|solvent waste)\b/i;
    if (aiAnalysis?.hazardous_flag || hazardousTerms.test(`${title} ${description}`)) {
      return NextResponse.json({
        error: 'This item may be hazardous and cannot be listed. Contact your local hazardous-waste authority for safe disposal guidance.',
      }, { status: 400 });
    }

    const listing = await prisma.listing.create({
      data: {
        sellerId: session.userId,
        categoryId,
        title,
        description,
        quantity: weight,
        unit,
        expectedPrice: expectedPrice !== '' && expectedPrice != null ? Number(expectedPrice) : null,
        saleType,
        reservePrice: reservePrice !== '' && reservePrice != null ? Number(reservePrice) : null,
        endsAt: saleType === 'AUCTION' ? new Date(endsAt) : null,
        hazardousFlag: false,
        aiAnalysis: aiAnalysis ? JSON.stringify(aiAnalysis) : null,
        condition: condition || 'Standard Scrap',
        location,
        pickupAddress: pickupAddress || null,
        pickupSlot: pickupSlot || null,
        latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
        longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
        status: 'PENDING_REVIEW',
        images: images.length
          ? {
              create: images.map((url, index) => ({ imageUrl: url, isPrimary: index === 0 })),
            }
          : undefined,
      },
      include: {
        category: true,
        images: true,
      },
    });

    return NextResponse.json({ success: true, listing });
  } catch (error: any) {
    console.error('Create listing error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create listing' }, { status: 500 });
  }
}
