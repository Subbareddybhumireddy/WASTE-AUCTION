import { NextRequest, NextResponse } from 'next/server';
import { createAndSendOTP, sanitizePhoneNumber } from '@/lib/otp';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, purpose = 'SIGNUP' } = body;

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 });
    }

    const sanitized = sanitizePhoneNumber(phone);

    // If purpose is LOGIN, check if an account exists with this phone
    if (purpose === 'LOGIN') {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ phone: sanitized }, { phone: phone.trim() }],
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'No account registered with this phone number. Please sign up first.' },
          { status: 404 }
        );
      }
    }

    // If purpose is SIGNUP, check if user already exists
    if (purpose === 'SIGNUP') {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ phone: sanitized }, { phone: phone.trim() }],
        },
      });

      if (user) {
        return NextResponse.json(
          { error: 'This phone number is already registered. Please log in instead.' },
          { status: 400 }
        );
      }
    }

    const result = await createAndSendOTP(phone, purpose);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Send OTP Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to dispatch verification code.' },
      { status: 500 }
    );
  }
}

