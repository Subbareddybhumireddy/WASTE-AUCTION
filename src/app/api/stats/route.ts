import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const revalidate = 60;

export async function GET() {
  try {
    const [completed, liveAuctions, impacts] = await Promise.all([
      prisma.order.findMany({
        where: { status: 'COMPLETED' },
        select: {
          totalAmount: true,
          listing: { select: { quantity: true, location: true, title: true } },
          completedAt: true,
        },
        orderBy: { completedAt: 'desc' },
        take: 10,
      }),
      prisma.listing.count({
        where: { saleType: 'AUCTION', status: 'ACTIVE', endsAt: { gt: new Date() } },
      }),
      prisma.order.findMany({
        where: { status: 'COMPLETED' },
        select: { listing: { select: { quantity: true, category: { select: { co2Factor: true } } } } },
      }),
    ]);

    const totals = await prisma.order.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { totalAmount: true, platformFee: true },
      _count: { _all: true },
    });
    const kgRecycled = impacts.reduce((sum, order) => sum + order.listing.quantity, 0);

    return NextResponse.json({
      productsSold: totals._count._all,
      kgRecycled,
      moneyPaidToSellers: (totals._sum.totalAmount ?? 0) - (totals._sum.platformFee ?? 0),
      liveAuctions,
      co2Saved: Math.round(impacts.reduce((sum, order) => sum + order.listing.quantity * order.listing.category.co2Factor, 0)),
      recentlySold: completed.map((order) => ({
        type: order.listing.title,
        weight: order.listing.quantity,
        price: order.totalAmount,
        city: order.listing.location,
        completedAt: order.completedAt,
      })),
    }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } });
  } catch (error) {
    console.error('Stats fetch failed:', error);
    return NextResponse.json({ error: 'Unable to load marketplace statistics.' }, { status: 500 });
  }
}
