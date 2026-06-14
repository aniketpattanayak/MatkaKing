import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seriesId = searchParams.get('seriesId') ?? '';
  const q        = searchParams.get('q') ?? '';
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);

  if (!seriesId) return NextResponse.json({ tickets: [], totalAvailable: 0, totalInSeries: 0 });

  try {
    const where = { seriesId, ...(q ? { ticketCode: { contains: q.toUpperCase() } } : {}) };

    const [tickets, totalAvailable, totalInSeries] = await Promise.all([
      prisma.lotteryTicket.findMany({
        where, take: limit, orderBy: { ticketCode: 'asc' },
        select: { id: true, ticketCode: true, isSold: true },
      }),
      prisma.lotteryTicket.count({ where: { seriesId, isSold: false } }),
      prisma.lotteryTicket.count({ where: { seriesId } }),
    ]);

    return NextResponse.json({
      tickets: tickets.map(t => ({ ticketId: t.id, ticketCode: t.ticketCode, isSold: t.isSold })),
      totalAvailable,
      totalInSeries,
    });
  } catch (e: any) {
    console.error('lottery search error:', e.message);
    return NextResponse.json({ tickets: [], totalAvailable: 0, totalInSeries: 0, error: e.message });
  }
}
