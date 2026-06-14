// /api/admin/results — returns recent results for all 3 games
import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const game = searchParams.get('game') ?? 'all'; // lottery | matka | spin | all

  try {
    const [lotteryResults, matkaResults, spinResults] = await Promise.all([
      // ── Lottery: drawn series with winner info ──────────────────────────
      (game === 'all' || game === 'lottery') ? prisma.lotterySeries.findMany({
        where: { status: 'DRAWN' },
        orderBy: { drawnAt: 'desc' },
        take: 20,
        include: {
          _count: { select: { tickets: true } },
          bets: {
            where: { status: 'WON' },
            take: 3,
            include: {
              user: { select: { id: true, name: true, email: true } },
              ticket: { select: { ticketCode: true } },
            },
            orderBy: { wonAmount: 'desc' },
          },
        },
      }) : [],

      // ── Matka: recent declared results with bet winners ─────────────────
      (game === 'all' || game === 'matka') ? prisma.matkaResult.findMany({
        where: { declaredAt: { not: null } },
        orderBy: { declaredAt: 'desc' },
        take: 30,
        include: {
          market: { select: { id: true, name: true } },
          bets: {
            where: { status: 'WON' },
            take: 10,
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }) : [],

      // ── Spin: recent wins ───────────────────────────────────────────────
      (game === 'all' || game === 'spin') ? prisma.spinResult.findMany({
        where: { coinsWon: { gt: 0 } },
        orderBy: { spunAt: 'desc' },
        take: 50,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }) : [],
    ]);

    // Enrich lottery results with winner names from firstWinnerId etc.
    const enrichedLottery = await Promise.all(
      (lotteryResults as any[]).map(async (s: any) => {
        const winnerIds = [s.firstWinnerId, s.secondWinnerId, s.thirdWinnerId].filter(Boolean);
        const winners: any[] = [];
        if (winnerIds.length > 0) {
          const users = await prisma.user.findMany({
            where: { id: { in: winnerIds } },
            select: { id: true, name: true, email: true },
          });
          const userMap = Object.fromEntries(users.map(u => [u.id, u]));
          if (s.firstWinnerId)  winners.push({ tier: '1st', prize: s.firstPrize  ?? 0, ticket: s.firstTicket,  user: userMap[s.firstWinnerId]  });
          if (s.secondWinnerId) winners.push({ tier: '2nd', prize: s.secondPrize ?? 0, ticket: s.secondTicket, user: userMap[s.secondWinnerId] });
          if (s.thirdWinnerId)  winners.push({ tier: '3rd', prize: s.thirdPrize  ?? 0, ticket: s.thirdTicket,  user: userMap[s.thirdWinnerId]  });
        }
        const isDummy = winners.length > 0 && winners.every(w => w.user?.email === 'dummy@supremegaming.in');
        return { ...s, winners, isDummy };
      })
    );

    // Spin: group into recent wins list
    const spinWins = (spinResults as any[]).map((r: any) => ({
      id: r.id,
      userName: r.user?.name ?? 'Unknown',
      userEmail: r.user?.email,
      coinsWon: r.coinsWon,
      isFree: r.isFreeSpinUsed,
      spunAt: r.spunAt,
    }));

    // Spin stats
    const spinStats = spinWins.reduce((acc: any, r: any) => {
      acc.totalWon += r.coinsWon;
      acc.totalSpins++;
      return acc;
    }, { totalWon: 0, totalSpins: 0 });

    return NextResponse.json({
      lottery: enrichedLottery,
      matka:   matkaResults,
      spin:    spinWins,
      spinStats,
    });
  } catch (e: any) {
    console.error('admin/results error:', e);
    return NextResponse.json({ error: e.message, lottery: [], matka: [], spin: [] }, { status: 500 });
  }
}
