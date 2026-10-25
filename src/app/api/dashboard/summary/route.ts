import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Sign in to load dashboard metrics.' }, { status: 401 });
  try {
    if (user.role === 'SELLER') {
      const [listingCount, receivedBids, completed] = await Promise.all([
        prisma.listing.count({ where: { sellerId: user.userId, status: { in: ['ACTIVE', 'PENDING_REVIEW'] } } }),
        prisma.bid.count({ where: { listing: { is: { sellerId: user.userId, status: 'ACTIVE' } } } }),
        prisma.order.aggregate({ where: { sellerId: user.userId, status: 'COMPLETED' }, _sum: { totalAmount: true, platformFee: true } }),
      ]);
      return NextResponse.json({
        listingCount,
        receivedBids,
        earnings: (completed._sum.totalAmount || 0) - (completed._sum.platformFee || 0),
      });
    }
    if (user.role === 'BUYER') {
      const [activeBids, completedOrders, purchases] = await Promise.all([
        prisma.bid.count({ where: { buyerId: user.userId, listing: { is: { status: 'ACTIVE' } } } }),
        prisma.order.count({ where: { buyerId: user.userId, status: 'COMPLETED' } }),
        prisma.order.aggregate({ where: { buyerId: user.userId, status: 'COMPLETED' }, _sum: { totalAmount: true } }),
      ]);
      return NextResponse.json({ activeBids, completedOrders, totalSpent: purchases._sum.totalAmount || 0 });
    }
    return NextResponse.json({ error: 'This dashboard has no role summary.' }, { status: 403 });
  } catch (error) {
    console.error('Dashboard summary failed:', error);
    return NextResponse.json({ error: 'Unable to load dashboard metrics.' }, { status: 500 });
  }
}
