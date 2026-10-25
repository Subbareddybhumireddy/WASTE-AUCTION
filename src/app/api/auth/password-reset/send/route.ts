import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createAndSendOTP, sanitizePhoneNumber } from '@/lib/otp';

const attempts = new Map<string, number[]>();

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((time) => time > now - 15 * 60 * 1000);
  if (recent.length >= 5) return NextResponse.json({ error: 'Too many reset requests. Please try again later.' }, { status: 429 });
  recent.push(now);
  attempts.set(ip, recent);

  const { identifier } = await request.json();
  if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 254) {
    return NextResponse.json({ error: 'Enter the phone number or email on the account.' }, { status: 400 });
  }
  const value = identifier.trim();
  const phone = sanitizePhoneNumber(value);
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: value.toLowerCase() }, { phone }, { phone: value }] },
    select: { phone: true },
  });
  let devOtp: string | undefined;
  if (user?.phone) {
    const result = await createAndSendOTP(user.phone, 'RESET_PASSWORD');
    devOtp = result.devOtp;
  }
  return NextResponse.json({
    success: true,
    message: 'If that account supports phone recovery, a verification code has been sent.',
    ...(devOtp ? { devOtp } : {}),
  });
}
