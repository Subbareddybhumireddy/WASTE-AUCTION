import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const headers = request.headers;
  const city = headers.get('x-vercel-ip-city') || headers.get('cf-ipcity');
  const country = headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry');
  if (city) return NextResponse.json({ city: decodeURIComponent(city), country, source: 'edge' });

  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headers.get('x-real-ip');
  const ip = forwardedFor || realIp;
  if (!ip || ip === '127.0.0.1' || ip === '::1') {
    return NextResponse.json({ city: null, country: null, source: 'unavailable' });
  }

  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error(`IP geolocation returned ${response.status}`);
    const data = await response.json();
    return NextResponse.json({ city: data.city || null, country: data.country_name || null, source: 'ipapi' });
  } catch (error) {
    console.error('IP geolocation failed:', error);
    return NextResponse.json({ city: null, country: null, source: 'unavailable' });
  }
}
