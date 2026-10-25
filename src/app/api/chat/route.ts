import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const requestCounts = new Map<string, { count: number; resetAt: number }>();

async function recordUnanswered(question: string) {
  if (!question.trim()) return;
  try {
    await prisma.chatQuestion.create({ data: { question: question.slice(0, 4000) } });
  } catch (error) {
    console.error('Could not save unanswered chatbot question:', error);
  }
}

const toolDefinitions = [
  {
    name: 'get_scrap_rates',
    description: 'Get current indicative scrap rates for a material.',
    input_schema: { type: 'object', properties: { material: { type: 'string' } }, required: ['material'] },
  },
  {
    name: 'search_listings',
    description: 'Search active marketplace listings by material and optional location or max price.',
    input_schema: { type: 'object', properties: { material: { type: 'string' }, location: { type: 'string' }, max_price: { type: 'number' } }, required: ['material'] },
  },
  { name: 'get_prohibited_items', description: 'List waste types that cannot be sold on the marketplace.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_platform_stats', description: 'Get completed sales and recycling impact statistics.', input_schema: { type: 'object', properties: {} } },
];

async function executeTool(name: string, input: Record<string, unknown>) {
  if (name === 'get_scrap_rates') {
    return prisma.scrapRate.findMany({
      where: { itemName: { contains: String(input.material || '') } },
      select: { itemName: true, minRate: true, maxRate: true, currentRate: true, unit: true },
      take: 10,
    });
  }
  if (name === 'search_listings') {
    return prisma.listing.findMany({
      where: {
        status: 'ACTIVE',
        title: { contains: String(input.material || '') },
        ...(input.location ? { location: { contains: String(input.location) } } : {}),
        ...(typeof input.max_price === 'number' ? { expectedPrice: { lte: input.max_price } } : {}),
      },
      select: { id: true, title: true, quantity: true, expectedPrice: true, location: true, saleType: true },
      take: 5,
    });
  }
  if (name === 'get_prohibited_items') {
    return { items: ['medical waste', 'chemicals', 'radioactive materials', 'asbestos'], guidance: 'Contact your local hazardous-waste authority for safe disposal.' };
  }
  if (name === 'get_platform_stats') {
    const [sales, payouts] = await Promise.all([
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.aggregate({ where: { status: 'COMPLETED' }, _sum: { totalAmount: true, platformFee: true } }),
    ]);
    return { completedSales: sales, totalSellerPayouts: (payouts._sum.totalAmount || 0) - (payouts._sum.platformFee || 0) };
  }
  throw new Error('Unknown chatbot tool.');
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  if (requestCounts.size > 10000) {
    requestCounts.forEach((value, key) => {
      if (value.resetAt <= now) requestCounts.delete(key);
    });
    if (requestCounts.size > 10000) return NextResponse.json({ error: 'Chat is temporarily busy. Try again shortly.' }, { status: 429 });
  }
  const rate = requestCounts.get(ip);
  if (rate && rate.resetAt > now && rate.count >= 20) {
    return NextResponse.json({ error: 'Too many messages. Please try again in a minute.' }, { status: 429 });
  }
  requestCounts.set(ip, { count: rate && rate.resetAt > now ? rate.count + 1 : 1, resetAt: now + 60_000 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'WasteBot is not configured. Set ANTHROPIC_API_KEY on the server.' }, { status: 503 });
  }
  const { messages } = await request.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Send at least one chat message.' }, { status: 400 });
  }
  const recentMessages = messages.slice(-10) as { role: string; content: string; image?: { mediaType: string; data: string } }[];
  const invalidPhoto = recentMessages.some((message) => message.image && (
    !['image/jpeg', 'image/png', 'image/webp'].includes(message.image.mediaType) ||
    !/^[A-Za-z0-9+/]+=*$/.test(message.image.data) ||
    message.image.data.length > 7_000_000
  ));
  if (invalidPhoto) return NextResponse.json({ error: 'Chat photos must be JPEG, PNG, or WebP and under 5 MB.' }, { status: 400 });
  const history = recentMessages.map((message) => {
    const content = String(message.content || '').slice(0, 4000);
    if (message.role === 'user' && message.image) {
      return {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: message.image.mediaType, data: message.image.data } },
          { type: 'text', text: content },
        ],
      };
    }
    return { role: message.role === 'assistant' ? 'assistant' : 'user', content };
  });
  try {
    const body = {
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: 600,
      stream: true,
      system: 'You are WasteBot, the concise waste expert for Waste Auction. Reply in the user’s language. Give prices only as estimates and use tools for rates. Never encourage selling hazardous waste; explain safe disposal. Keep answers short and politely steer unrelated questions back to recycling. When search_listings returns results, link each relevant listing using the exact format [listing title](/listings/LISTING_ID).',
      tools: toolDefinitions,
      messages: history,
    };
    const headers = {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    };
    let first = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers, body: JSON.stringify({ ...body, stream: false }),
    });
    let result = await first.json();
    if (!first.ok) {
      console.error('WasteBot provider error:', result);
      await recordUnanswered(String(messages[messages.length - 1]?.content || ''));
      return NextResponse.json({ error: 'WasteBot could not answer right now.' }, { status: 502 });
    }
    const toolUses = result.content?.filter((part: { type: string }) => part.type === 'tool_use') || [];
    if (toolUses.length) {
      const toolResults = await Promise.all(toolUses.map(async (tool: { id: string; name: string; input: Record<string, unknown> }) => ({
        type: 'tool_result',
        tool_use_id: tool.id,
        content: JSON.stringify(await executeTool(tool.name, tool.input)),
      })));
      history.push({ role: 'assistant', content: result.content } as never);
      history.push({ role: 'user', content: toolResults } as never);
      first = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers, body: JSON.stringify({ ...body, messages: history }),
      });
      if (!first.ok || !first.body) {
        console.error('WasteBot streaming provider error:', await first.text());
        await recordUnanswered(String(messages[messages.length - 1]?.content || ''));
        return NextResponse.json({ error: 'WasteBot could not answer right now.' }, { status: 502 });
      }
      return new Response(first.body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'connection': 'keep-alive' } });
    }
    const answer = result.content?.filter((part: { type: string }) => part.type === 'text').map((part: { text: string }) => part.text).join('') || '';
    if (!answer) {
      await recordUnanswered(String(messages[messages.length - 1]?.content || ''));
      return NextResponse.json({ error: 'WasteBot did not produce an answer.' }, { status: 502 });
    }
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: answer } })}\n\n`));
        controller.enqueue(new TextEncoder().encode('event: message_stop\ndata: {"type":"message_stop"}\n\n'));
        controller.close();
      },
    });
    return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
  } catch (error) {
    console.error('WasteBot request failed:', error);
    await recordUnanswered(String(messages[messages.length - 1]?.content || ''));
    return NextResponse.json({ error: 'WasteBot could not answer right now.' }, { status: 502 });
  }
}
