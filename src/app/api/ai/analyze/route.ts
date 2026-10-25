import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromCookie } from '@/lib/auth';
import { signAnalysis } from '@/lib/analysis-signature';

const ANALYSIS_SCHEMA = `{
  "waste_type": "string",
  "sub_category": "string",
  "condition": "string",
  "price_per_kg_range": { "min": number, "max": number },
  "suggested_total_price": number,
  "recyclability_note": "string",
  "hazardous_flag": boolean,
  "confidence": number
}`;

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromCookie();
  if (!user || (user.role !== 'SELLER' && user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Only sellers can analyze listing photos.' }, { status: 403 });
  }

  const { imageUrls, weightKg = 1 } = await request.json();
  if (!Array.isArray(imageUrls) || imageUrls.length < 1 || imageUrls.length > 5 ||
      imageUrls.some((url) => typeof url !== 'string' || !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(url))) {
    return NextResponse.json({ error: 'Provide between 1 and 5 valid Cloudinary image URLs.' }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI analysis is not configured. Set ANTHROPIC_API_KEY on the server.' }, { status: 503 });
  }

  try {
    const images = await Promise.all(imageUrls.map(async (url: string) => {
      const imageResponse = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!imageResponse.ok) throw new Error('A listing image could not be retrieved.');
      const mimeType = imageResponse.headers.get('content-type') || '';
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) {
        throw new Error('Listing photos must be JPEG, PNG, WebP, or GIF images.');
      }
      const bytes = Buffer.from(await imageResponse.arrayBuffer());
      if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('Each listing photo must be under 8 MB.');
      return { type: 'image', source: { type: 'base64', media_type: mimeType, data: bytes.toString('base64') } };
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
        max_tokens: 700,
        system: `Analyze recyclable waste for a marketplace. Reply with only valid JSON matching exactly this schema: ${ANALYSIS_SCHEMA}. Treat medical, chemical, radioactive, and asbestos-containing items as hazardous. Do not infer certainty from an image; price values are estimates in INR per kg. Confidence must be between 0 and 1.`,
        messages: [{ role: 'user', content: [...images, { type: 'text', text: `Analyze this waste. Estimated weight: ${Math.max(0.1, Number(weightKg) || 1)} kg. Return JSON only.` }] }],
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('Claude analysis failed:', result);
      return NextResponse.json({ error: 'The AI analysis service could not process these photos.' }, { status: 502 });
    }
    const text = result.content?.find((part: { type: string }) => part.type === 'text')?.text;
    const jsonText = typeof text === 'string' ? text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '') : '';
    const analysis = JSON.parse(jsonText);
    if (
      typeof analysis.waste_type !== 'string' ||
      typeof analysis.sub_category !== 'string' ||
      typeof analysis.condition !== 'string' ||
      typeof analysis.price_per_kg_range?.min !== 'number' ||
      typeof analysis.price_per_kg_range?.max !== 'number' ||
      typeof analysis.suggested_total_price !== 'number' ||
      typeof analysis.recyclability_note !== 'string' ||
      typeof analysis.hazardous_flag !== 'boolean' ||
      typeof analysis.confidence !== 'number'
    ) throw new Error('The AI response did not match the required analysis format.');

    const expiresAt = Date.now() + 15 * 60 * 1000;
    const analysisToken = signAnalysis(user.userId, imageUrls, analysis, expiresAt);
    return NextResponse.json({ analysis, analysisToken });
  } catch (error) {
    console.error('Listing analysis error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Could not analyze listing photos.',
    }, { status: 502 });
  }
}
