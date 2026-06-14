import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const [lotteryResults, matkaResults, spinResults] = await Promise.all([
      prisma.lotterySeries.findMany({
        where: { status: 'DRAWN' },
        orderBy: { drawnAt: 'desc' },
        take: 20,
        include: { _count: { select: { tickets: true } } },
      }),
      prisma.matkaResult.findMany({
        where: { declaredAt: { not: null } },
        orderBy: { declaredAt: 'desc' },
        take: 30,
        include: {
          market: { select: { id: true, name: true } },
          bets: { where: { status: 'WON' }, take: 10, include: { user: { select: { id: true, name: true } } } },
        },
      }),
      prisma.spinResult.findMany({
        where: { coinsWon: { gt: 0 } },
        orderBy: { spunAt: 'desc' },
        take: 50,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    // Enrich lottery with winner names
    const enrichedLottery = await Promise.all(
      (lotteryResults as any[]).map(async (s: any) => {
        const ids = [s.firstWinnerId, s.secondWinnerId, s.thirdWinnerId].filter(Boolean);
        const winners: any[] = [];
        if (ids.length > 0) {
          const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
          const map = Object.fromEntries(users.map(u => [u.id, u]));
          if (s.firstWinnerId)  winners.push({ tier:'1st', prize: s.firstPrize??0,  ticket: s.firstTicket,  user: map[s.firstWinnerId] });
          if (s.secondWinnerId) winners.push({ tier:'2nd', prize: s.secondPrize??0, ticket: s.secondTicket, user: map[s.secondWinnerId] });
          if (s.thirdWinnerId)  winners.push({ tier:'3rd', prize: s.thirdPrize??0,  ticket: s.thirdTicket,  user: map[s.thirdWinnerId] });
        }
        const isDummy = winners.every(w => w.user?.email === 'dummy@supremegaming.in');
        return { ...s, winners, isDummy };
      })
    );

    const spinWins = (spinResults as any[]).map((r: any) => ({
      id: r.id, userName: r.user?.name ?? 'Unknown', userEmail: r.user?.email,
      coinsWon: r.coinsWon, isFree: r.isFreeSpinUsed ?? r.usedFreeSpins, spunAt: r.spunAt,
    }));

    const spinStats = spinWins.reduce((a: any, r: any) => ({ totalWon: a.totalWon + r.coinsWon, totalSpins: a.totalSpins + 1 }), { totalWon: 0, totalSpins: 0 });

    return NextResponse.json({ lottery: enrichedLottery, matka: matkaResults, spin: spinWins, spinStats });
  } catch (e: any) {
    console.error('admin/results error:', e);
    return NextResponse.json({ error: e.message, lottery: [], matka: [], spin: [] }, { status: 500 });
  }
}
