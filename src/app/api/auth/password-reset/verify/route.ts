import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { sanitizePhoneNumber, verifyOTPCode } from '@/lib/otp';

export async function POST(request: NextRequest) {
  const { identifier, code, password } = await request.json();
  if (typeof identifier !== 'string' || typeof code !== 'string' ||
      typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: 'Provide your account phone/email, verification code, and a password of at least 8 characters.' }, { status: 400 });
  }
  const value = identifier.trim();
  const phone = sanitizePhoneNumber(value);
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: value.toLowerCase() }, { phone }, { phone: value }] },
  });
  if (!user?.phone) return NextResponse.json({ error: 'The verification code is invalid or expired.' }, { status: 400 });
  const verified = await verifyOTPCode(user.phone, code, 'RESET_PASSWORD');
  if (!verified.success) return NextResponse.json({ error: verified.message }, { status: 400 });
  try {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password reset failed after OTP verification:', error);
    return NextResponse.json({ error: 'Could not update the password. Request a new verification code and try again.' }, { status: 500 });
  }
}
