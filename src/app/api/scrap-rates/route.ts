import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const rates = await prisma.scrapRate.findMany({
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        currentRate: 'desc',
      },
    });

    return NextResponse.json({ success: true, rates });
  } catch (error: any) {
    console.error('Fetch scrap rates error:', error);
    return NextResponse.json({ error: 'Failed to fetch scrap rates' }, { status: 500 });
  }
}

