import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  try {
    const p = verifyToken(req);
    if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [matkaBets, lotteryBets, transactions] = await Promise.all([
      prisma.matkaBet.findMany({
        where:   { userId: p.sub },
        orderBy: { placedAt: 'desc' },
        take:    50,
        include: {
          market: { select: { id: true, name: true, openTime: true, closeTime: true } },
          result: { select: { openPatti: true, closePatti: true, jodi: true, openAnk: true, closeAnk: true } },
        },
      }),
      prisma.lotteryBet.findMany({
        where:   { userId: p.sub },
        orderBy: { placedAt: 'desc' },
        take:    50,
        include: {
          series: { select: { id: true, name: true, status: true, drawAt: true, prefix: true, firstPrize: true, secondPrize: true, thirdPrize: true } },
          ticket: { select: { ticketCode: true, isWinner: true } },
        },
      }),
      prisma.transaction.findMany({
        where:   { userId: p.sub, type: 'WIN_CREDIT' },
        orderBy: { createdAt: 'desc' },
        take:    20,
      }),
    ]);

    // Compute total stats
    const totalMatkaWon = matkaBets.filter((b:any) => b.status === 'WON').reduce((s:number, b:any) => s + (b.wonAmount ?? 0), 0);
    const totalLotteryWon = lotteryBets.filter((b:any) => b.status === 'WON').reduce((s:number, b:any) => s + (b.wonAmount ?? 0), 0);

    return NextResponse.json({ matkaBets, lotteryBets, transactions, totalMatkaWon, totalLotteryWon });
  } catch (e: any) {
    console.error('user results error:', e.message);
    return NextResponse.json({ matkaBets: [], lotteryBets: [], transactions: [], totalMatkaWon: 0, totalLotteryWon: 0 });
  }
}
