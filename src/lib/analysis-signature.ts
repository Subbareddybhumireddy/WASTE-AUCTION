import { createHmac, timingSafeEqual } from 'crypto';

function payloadFor(userId: string, imageUrls: string[], analysis: unknown) {
  return JSON.stringify({ userId, imageUrls, analysis });
}

export function signAnalysis(userId: string, imageUrls: string[], analysis: unknown, expiresAt: number) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to sign AI listing analysis.');
  const payload = `${expiresAt}.${payloadFor(userId, imageUrls, analysis)}`;
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

export function verifyAnalysis(token: string, userId: string, imageUrls: string[], analysis: unknown) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  const [encodedPayload, signature, ...rest] = token.split('.');
  if (!encodedPayload || !signature || rest.length) return false;
  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return false;
  }
  const dot = payload.indexOf('.');
  const expiresAt = Number(payload.slice(0, dot));
  if (dot < 1 || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  const expectedPayload = payload.slice(dot + 1);
  if (expectedPayload !== payloadFor(userId, imageUrls, analysis)) return false;
  const expected = createHmac('sha256', secret).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
