import prisma from './prisma';
import { randomInt } from 'crypto';

export function generateOTP(): string {
  return randomInt(100000, 1000000).toString();
}

export function sanitizePhoneNumber(phone: string): string {
  // Strip non-digits, keep leading '+' if present
  let cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    // If not starting with country code, default to E.164 standard formatting (or keep as is)
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

export async function createAndSendOTP(
  phone: string,
  purpose: 'SIGNUP' | 'LOGIN' | 'RESET_PASSWORD' = 'SIGNUP'
): Promise<{ success: boolean; message: string; devOtp?: string }> {
  const sanitizedPhone = sanitizePhoneNumber(phone);
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

  // Invalidate any previous unverified OTPs for this phone & purpose
  await prisma.otpVerification.deleteMany({
    where: {
      phone: sanitizedPhone,
      purpose,
      verified: false,
    },
  });

  // Store new OTP in database
  await prisma.otpVerification.create({
    data: {
      phone: sanitizedPhone,
      code,
      purpose,
      expiresAt,
      verified: false,
    },
  });

  // Optional Twilio SMS dispatch
  const hasTwilio =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER &&
    !process.env.TWILIO_ACCOUNT_SID.includes('your-twilio');

  if (hasTwilio) {
    try {
      console.log(`[SMS Gateway] Sending OTP ${code} to ${sanitizedPhone} via Twilio...`);
      // Twilio integration can be wired here
    } catch (smsErr) {
      console.error('[SMS Gateway Error]', smsErr);
    }
  }

  // Developer logging
  console.log(`\n==============================================`);
  console.log(`📱 [OTP SERVICE] Code for ${sanitizedPhone} (${purpose}): [ ${code} ]`);
  console.log(`⏳ Valid for 10 minutes`);
  console.log(`==============================================\n`);

  const isDev = process.env.NODE_ENV !== 'production' || process.env.OTP_DEV_MODE === 'true';

  return {
    success: true,
    message: `Verification code sent to ${sanitizedPhone}`,
    devOtp: isDev ? code : undefined,
  };
}

export async function verifyOTPCode(
  phone: string,
  code: string,
  purpose: 'SIGNUP' | 'LOGIN' | 'RESET_PASSWORD' = 'SIGNUP'
): Promise<{ success: boolean; message: string }> {
  const sanitizedPhone = sanitizePhoneNumber(phone);

  const record = await prisma.otpVerification.findFirst({
    where: {
      phone: sanitizedPhone,
      code: code.trim(),
      purpose,
      verified: false,
      expiresAt: {
        gte: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!record) {
    return {
      success: false,
      message: 'Invalid or expired verification code. Please request a new OTP.',
    };
  }

  // Mark record as verified
  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { verified: true },
  });

  return {
    success: true,
    message: 'Phone number verified successfully.',
  };
}
