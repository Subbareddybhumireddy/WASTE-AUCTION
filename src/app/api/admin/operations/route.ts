import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

async function isAdmin() {
  const user = await getCurrentUserFromCookie();
  return user?.role === 'ADMIN';
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const [users, listings, reports, rates, categories, orders, unansweredQuestions] = await Promise.all([
      prisma.user.count(),
      prisma.listing.findMany({ where: { status: { in: ['ACTIVE', 'PENDING_REVIEW'] } }, include: { images: { take: 1 }, category: true }, take: 50, orderBy: { createdAt: 'desc' } }),
      prisma.report.findMany({ where: { status: { in: ['OPEN', 'INVESTIGATING'] } }, include: { listing: { select: { id: true, title: true } } }, take: 50, orderBy: { createdAt: 'desc' } }),
      prisma.scrapRate.findMany({ include: { category: true }, orderBy: { itemName: 'asc' } }),
      prisma.category.findMany({ select: { id: true, name: true, co2Factor: true } }),
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.chatQuestion.findMany({ where: { status: 'UNANSWERED' }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return NextResponse.json({ users, listings, reports, rates, categories, completedOrders: orders, unansweredQuestions });
  } catch (error) {
    console.error('Admin dashboard data failed:', error);
    return NextResponse.json({ error: 'Unable to load admin operations.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const { type, id, status, minRate, maxRate, currentRate, co2Factor } = await request.json();
  try {
    if (type === 'listing' && ['ACTIVE', 'CANCELLED'].includes(status)) {
      await prisma.listing.update({ where: { id }, data: { status } });
    } else if (type === 'report' && ['INVESTIGATING', 'RESOLVED', 'DISMISSED'].includes(status)) {
      await prisma.report.update({ where: { id }, data: { status } });
    } else if (type === 'rate') {
      const values = [Number(minRate), Number(maxRate), Number(currentRate)];
      if (values.some((value) => !Number.isFinite(value) || value < 0) || values[0] > values[1]) {
        return NextResponse.json({ error: 'Rate values must be non-negative and minimum cannot exceed maximum.' }, { status: 400 });
      }
      await prisma.scrapRate.update({ where: { id }, data: { minRate: values[0], maxRate: values[1], currentRate: values[2] } });
    } else if (type === 'category') {
      const factor = Number(co2Factor);
      if (!Number.isFinite(factor) || factor < 0 || factor > 100) return NextResponse.json({ error: 'CO₂ factor must be between 0 and 100.' }, { status: 400 });
      await prisma.category.update({ where: { id }, data: { co2Factor: factor } });
    } else if (type === 'chatQuestion' && status === 'RESOLVED') {
      await prisma.chatQuestion.update({ where: { id }, data: { status, resolvedAt: new Date() } });
    } else {
      return NextResponse.json({ error: 'Unsupported admin operation.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin update failed:', error);
    return NextResponse.json({ error: 'The requested admin update could not be saved.' }, { status: 500 });
  }
}
