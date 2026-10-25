import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { setAuthCookie, signJWT, verifyPassword } from '@/lib/auth';
import { sanitizePhoneNumber } from '@/lib/otp';
import { UserRole } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password, roleToggle } = body;

    if (!identifier || !identifier.trim()) {
      return NextResponse.json(
        { error: 'Please enter your phone number or email address.' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Please enter your password.' },
        { status: 400 }
      );
    }

    const trimmedInput = identifier.trim();
    const isEmail = trimmedInput.includes('@');

    // Search user by email or by sanitized phone
    let user;
    if (isEmail) {
      user = await prisma.user.findUnique({
        where: { email: trimmedInput.toLowerCase() },
      });
    } else {
      const sanitizedPhone = sanitizePhoneNumber(trimmedInput);
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: sanitizedPhone },
            { phone: trimmedInput },
          ],
        },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email or phone. Please sign up or check your credentials.' },
        { status: 401 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'This account does not have a password set. Please log in using Phone OTP.' },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid password. Please check your password and try again.' },
        { status: 401 }
      );
    }

    // Role check / informative advisory if user role differs from toggle
    // Note: Admins can access everything; if user selected "I want to sell" but is registered as "BUYER",
    // we allow login and can either adapt or guide them.
    const userRole = user.role as UserRole;

    const token = await signJWT({
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: userRole,
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
        isPhoneVerified: user.isPhoneVerified,
        avatarUrl: user.avatarUrl,
        city: user.city,
      },
      preferredRole: roleToggle || user.role,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error?.message || 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}

