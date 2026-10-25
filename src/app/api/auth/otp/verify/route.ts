import { NextRequest, NextResponse } from 'next/server';
import { sanitizePhoneNumber, verifyOTPCode } from '@/lib/otp';
import prisma from '@/lib/prisma';
import { setAuthCookie, signJWT } from '@/lib/auth';
import { UserRole } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, code, purpose = 'SIGNUP' } = body;

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 });
    }

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'Verification code is required.' }, { status: 400 });
    }

    const sanitized = sanitizePhoneNumber(phone);
    const verification = await verifyOTPCode(sanitized, code, purpose);

    if (!verification.success) {
      return NextResponse.json({ error: verification.message }, { status: 400 });
    }

    // If purpose is LOGIN, log the user in directly!
    if (purpose === 'LOGIN') {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ phone: sanitized }, { phone: phone.trim() }],
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'User account not found.' },
          { status: 404 }
        );
      }

      // Mark user's phone verified if not yet
      if (!user.isPhoneVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isPhoneVerified: true },
        });
      }

      const token = await signJWT({
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role as UserRole,
      });

      setAuthCookie(token);

      return NextResponse.json({
        success: true,
        message: `Welcome back, ${user.name}!`,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isPhoneVerified: true,
          avatarUrl: user.avatarUrl,
        },
      });
    }

    // For SIGNUP, mark verified and return confirmation
    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully! You may now complete your registration.',
      sanitizedPhone: sanitized,
    });
  } catch (error: any) {
    console.error('Verify OTP Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}

