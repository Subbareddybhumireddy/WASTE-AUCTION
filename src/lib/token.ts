import { SignJWT, jwtVerify } from 'jose';
import { JWTPayload } from '@/types';

export const AUTH_COOKIE_NAME = 'w2w_session';

const JWT_SECRET_STRING = process.env.JWT_SECRET || 'fallback-waste2worth-secret-key-32chars';
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING);

export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

