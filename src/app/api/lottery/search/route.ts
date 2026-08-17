import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seriesId = searchParams.get('seriesId') ?? '';
  const q        = searchParams.get('q') ?? '';
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50000'), 50000);

  if (!seriesId) return NextResponse.json({ tickets: [], totalAvailable: 0, totalInSeries: 0 });

  try {
    const where = { seriesId, ...(q ? { ticketCode: { contains: q.toUpperCase() } } : {}) };

    // Check if series is drawn - don't show tickets for buying
    const series = await prisma.lotterySeries.findUnique({ where: { id: seriesId }, select: { status: true } });
    const isDrawn = series?.status === 'DRAWN';

    const [tickets, totalAvailable, totalInSeries] = await Promise.all([
      prisma.lotteryTicket.findMany({
        where, take: limit, orderBy: { ticketCode: 'asc' },
        select: { id: true, ticketCode: true, isSold: true, isWinner: true },
      }),
      prisma.lotteryTicket.count({ where: { seriesId, isSold: false } }),
      prisma.lotteryTicket.count({ where: { seriesId } }),
    ]);

    return NextResponse.json({
      tickets: isDrawn 
        ? tickets.map(t => ({ ticketId: t.id, ticketCode: t.ticketCode, isSold: true, isWinner: t.isWinner })) // mark all as "sold" so can't buy
        : tickets.map(t => ({ ticketId: t.id, ticketCode: t.ticketCode, isSold: t.isSold })),
      totalAvailable: isDrawn ? 0 : totalAvailable,
      totalInSeries,
      isDrawn,
      status: series?.status,
    });
  } catch (e: any) {
    console.error('lottery search error:', e.message);
    return NextResponse.json({ tickets: [], totalAvailable: 0, totalInSeries: 0, error: e.message });
  }
}
