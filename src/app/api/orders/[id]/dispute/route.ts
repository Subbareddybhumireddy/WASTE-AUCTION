import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Sign in to report an order dispute.' }, { status: 401 });
  const { details } = await request.json();
  if (typeof details !== 'string' || details.trim().length < 5 || details.length > 2000) {
    return NextResponse.json({ error: 'Describe the dispute in 5 to 2,000 characters.' }, { status: 400 });
  }
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || (order.buyerId !== user.userId && order.sellerId !== user.userId)) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }
  const reportedUserId = user.userId === order.buyerId ? order.sellerId : order.buyerId;
  await prisma.report.create({
    data: {
      reporterId: user.userId,
      reportedUserId,
      listingId: order.listingId,
      reason: 'ORDER_DISPUTE',
      details: details.trim(),
    },
  });
  await prisma.order.update({ where: { id: order.id }, data: { status: 'DISPUTED' } });
  return NextResponse.json({ success: true }, { status: 201 });
}
