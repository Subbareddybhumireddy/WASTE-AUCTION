import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!['SELLER', 'BUYER', 'ADMIN'].includes(user.role)) return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1);
  const search = request.nextUrl.searchParams.get('q')?.trim() || '';
  const completedOnly = request.nextUrl.searchParams.get('completed') !== 'false';
  const role = user.role === 'ADMIN' ? (request.nextUrl.searchParams.get('role') === 'seller' ? 'seller' : 'buyer') : user.role.toLowerCase();
  const where = {
    ...(role === 'seller' ? { sellerId: user.userId } : { buyerId: user.userId }),
    ...(completedOnly ? { status: 'COMPLETED' } : {}),
    ...(search ? { listing: { title: { contains: search } } } : {}),
  };
  try {
    const [orders, total, aggregate, monthly] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { listing: { select: { title: true, quantity: true, location: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 10,
        take: 10,
      }),
      prisma.order.count({ where }),
      prisma.order.aggregate({ where: { ...where, status: 'COMPLETED' }, _sum: { totalAmount: true } }),
      prisma.order.findMany({
        where: { ...where, status: 'COMPLETED', completedAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } },
        select: { totalAmount: true, completedAt: true },
      }),
    ]);
    return NextResponse.json({
      role, total, page, pages: Math.max(1, Math.ceil(total / 10)),
      totalAmount: aggregate._sum.totalAmount || 0,
      monthly: monthly.reduce((result: Record<string, number>, order) => {
        if (order.completedAt) {
          const month = `${order.completedAt.getFullYear()}-${String(order.completedAt.getMonth() + 1).padStart(2, '0')}`;
          result[month] = (result[month] || 0) + order.totalAmount;
        }
        return result;
      }, {}),
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        totalAmount: order.totalAmount,
        completedAt: order.completedAt,
        createdAt: order.createdAt,
        listing: order.listing,
      })),
    });
  } catch (error) {
    console.error('Sales history request failed:', error);
    return NextResponse.json({ error: 'Unable to load sales history.' }, { status: 500 });
  }
}
