import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromCookie } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Sign in to report a listing.' }, { status: 401 });
  const { reason, details } = await request.json();
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 120 ||
      (details != null && (typeof details !== 'string' || details.length > 2000))) {
    return NextResponse.json({ error: 'Provide a reason and optional details (up to 2,000 characters).' }, { status: 400 });
  }
  const listing = await prisma.listing.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!listing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
  const recent = await prisma.report.count({
    where: { reporterId: user.userId, listingId: params.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= 3) return NextResponse.json({ error: 'Report limit reached for this listing. Try again later.' }, { status: 429 });
  await prisma.report.create({
    data: { reporterId: user.userId, listingId: params.id, reason: reason.trim(), details: details?.trim() || null },
  });
  return NextResponse.json({ success: true }, { status: 201 });
}
