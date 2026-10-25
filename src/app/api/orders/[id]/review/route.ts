import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Sign in to leave a review.' }, { status: 401 });
  const { rating, comment } = await request.json();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || (comment != null && (typeof comment !== 'string' || comment.length > 2000))) {
    return NextResponse.json({ error: 'Choose a rating from 1 to 5 and keep comments under 2,000 characters.' }, { status: 400 });
  }
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.status !== 'COMPLETED') return NextResponse.json({ error: 'Reviews are available after order completion.' }, { status: 409 });
  const revieweeId = order.buyerId === user.userId ? order.sellerId : order.sellerId === user.userId ? order.buyerId : null;
  if (!revieweeId) return NextResponse.json({ error: 'You are not a participant in this order.' }, { status: 403 });
  try {
    const existing = await prisma.review.findFirst({ where: { orderId: order.id, reviewerId: user.userId } });
    if (existing) return NextResponse.json({ error: 'You have already reviewed this order.' }, { status: 409 });
    const review = await prisma.review.create({
      data: { orderId: order.id, reviewerId: user.userId, revieweeId, rating, comment: comment?.trim() || null },
    });
    return NextResponse.json({ success: true, review }, { status: 201 });
  } catch (error) {
    console.error('Review creation failed:', error);
    return NextResponse.json({ error: 'Could not save the review.' }, { status: 500 });
  }
}
