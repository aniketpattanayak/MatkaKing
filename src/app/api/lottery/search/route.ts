import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seriesId = searchParams.get('seriesId') ?? '';
  const q        = searchParams.get('q') ?? '';
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '120'), 500);
  const offset   = parseInt(searchParams.get('offset') ?? '0');

  if (!seriesId) return NextResponse.json({ tickets: [], total: 0 });

  try {
    const where = {
      seriesId,
      ...(q ? { ticketCode: { contains: q.toUpperCase() } } : {}),
    };

    const [tickets, total] = await Promise.all([
      prisma.lotteryTicket.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { ticketCode: 'asc' },
        select: { id: true, ticketCode: true, isSold: true },
      }),
      prisma.lotteryTicket.count({ where }),
    ]);

    return NextResponse.json({
      tickets: tickets.map(t => ({
        ticketId:   t.id,
        ticketCode: t.ticketCode,
        isSold:     t.isSold,
      })),
      total,
      offset,
      limit,
    });
  } catch (e: any) {
    console.error('lottery search error:', e.message);
    return NextResponse.json({ tickets: [], total: 0, error: e.message });
  }
}
