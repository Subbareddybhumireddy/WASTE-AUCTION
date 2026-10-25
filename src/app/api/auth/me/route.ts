import { NextResponse } from 'next/server';
import { clearAuthCookie, getCurrentUserFromCookie } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getCurrentUserFromCookie();
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isPhoneVerified: true,
        isEmailVerified: true,
        avatarUrl: true,
        city: true,
        address: true,
      },
    });

    if (!user) {
      clearAuthCookie();
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user,
    });
  } catch (error: any) {
    console.error('Auth check error:', error);
    return NextResponse.json({ authenticated: false, error: error?.message }, { status: 500 });
  }
}

