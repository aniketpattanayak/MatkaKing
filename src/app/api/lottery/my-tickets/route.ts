import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  try {
    const p = verifyToken(req);
    if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const bets = await prisma.lotteryBet.findMany({
      where:   { userId: p.sub },
      orderBy: { placedAt: 'desc' },   // ✅ correct field (not createdAt)
      include: {
        series: {
          select: {
            id: true, name: true, prefix: true,
            ticketPrice: true, prizePool: true,
            drawAt: true, status: true,
          },
        },
        ticket: {
          select: { ticketCode: true, isWinner: true },
        },
      },
    });

    return NextResponse.json({ bets });
  } catch (e: any) {
    console.error('my-tickets error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
