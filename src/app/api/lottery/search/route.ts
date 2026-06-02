import { NextRequest, NextResponse } from 'next/server';

import { prisma, verifyToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seriesId = searchParams.get('seriesId') ?? '';
  const q        = searchParams.get('q') ?? '';
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);

  if (!seriesId) return NextResponse.json({ tickets: [] });

  try {
    const tickets = await prisma.lotteryTicket.findMany({
      where: {
        seriesId,
        ...(q ? { ticketCode: { contains: q.toUpperCase() } } : {}),
      },
      take: limit,
      orderBy: { ticketCode: 'asc' },
      select: { id: true, ticketCode: true, isSold: true },
    });

    return NextResponse.json({
      tickets: tickets.map(t => ({
        ticketId:   t.id,
        ticketCode: t.ticketCode,
        isSold:     t.isSold,
      })),
    });
  } catch (e: any) {
    console.error('lottery search error:', e.message);
    return NextResponse.json({ tickets: [], error: e.message });
  }
}
