import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, setAuthCookie, signJWT } from '@/lib/auth';
import { sanitizePhoneNumber } from '@/lib/otp';
import { UserRole } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, password, role, otpCode } = body;

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const assignedRole: UserRole = role === 'SELLER' ? 'SELLER' : 'BUYER';
    const sanitizedPhone = sanitizePhoneNumber(phone);

    // Check if phone or email already registered
    const existingPhone = await prisma.user.findUnique({
      where: { phone: sanitizedPhone },
    });
    if (existingPhone) {
      return NextResponse.json(
        { error: 'An account with this phone number already exists. Please log in.' },
        { status: 400 }
      );
    }

    const trimmedEmail = email?.trim()?.toLowerCase() || null;
    if (trimmedEmail) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: trimmedEmail },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: 'An account with this email address already exists. Please log in.' },
          { status: 400 }
        );
      }
    }

    // Verify OTP code if provided or check if recently verified OTP exists
    let isPhoneVerified = false;
    if (otpCode) {
      const verification = await prisma.otpVerification.findFirst({
        where: {
          phone: sanitizedPhone,
          code: otpCode.trim(),
          purpose: 'SIGNUP',
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!verification) {
        return NextResponse.json({ error: 'Invalid or expired verification code.' }, { status: 400 });
      }
      if (!verification.verified) await prisma.otpVerification.update({ where: { id: verification.id }, data: { verified: true } });
      isPhoneVerified = true;
    } else {
      // Check if phone was already verified in otp_verifications within last 30 mins
      const recentVerification = await prisma.otpVerification.findFirst({
        where: {
          phone: sanitizedPhone,
          purpose: 'SIGNUP',
          verified: true,
          createdAt: {
            gte: new Date(Date.now() - 30 * 60 * 1000),
          },
        },
      });

      if (!recentVerification) {
        return NextResponse.json(
          { error: 'Phone number has not been verified yet. Please request and verify OTP.' },
          { status: 400 }
        );
      }
      isPhoneVerified = true;
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        phone: sanitizedPhone,
        email: trimmedEmail,
        passwordHash,
        role: assignedRole,
        isPhoneVerified,
        isEmailVerified: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isPhoneVerified: true,
        avatarUrl: true,
      },
    });
    await prisma.otpVerification.deleteMany({ where: { phone: sanitizedPhone, purpose: 'SIGNUP' } });

    // Generate JWT and set secure cookie
    const token = await signJWT({
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role as UserRole,
    });

    setAuthCookie(token);

    return NextResponse.json({
      success: true,
      message: 'Account created successfully! Welcome to Waste to Worth.',
      user: newUser,
    });
  } catch (error: any) {
    console.error('Registration Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to complete registration' },
      { status: 500 }
    );
  }
}
