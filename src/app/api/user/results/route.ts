import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  try {
    const p = verifyToken(req);
    if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [matkaBets, lotteryBets, transactions] = await Promise.all([

      // Matka bets — placedAt, wonAmount
      prisma.matkaBet.findMany({
        where:   { userId: p.sub },
        orderBy: { placedAt: 'desc' },   // ✅ correct field
        take:    20,
        include: { market: { select: { name: true } } },
      }),

      // Lottery bets — placedAt, wonAmount
      prisma.lotteryBet.findMany({
        where:   { userId: p.sub },
        orderBy: { placedAt: 'desc' },   // ✅ correct field
        take:    20,
        include: {
          series: { select: { name: true, status: true, drawAt: true } },
          ticket: { select: { ticketCode: true, isWinner: true } },
        },
      }),

      // Win transactions
      prisma.transaction.findMany({
        where:   { userId: p.sub, type: 'WIN_CREDIT' },
        orderBy: { createdAt: 'desc' },
        take:    10,
      }),
    ]);

    return NextResponse.json({ matkaBets, lotteryBets, transactions });
  } catch (e: any) {
    console.error('user results error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
