import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  // Get current user if logged in (to highlight their wins)
  const p = verifyToken(req);
  const currentUserId = p?.sub;

  try {
    const drawnSeries = await prisma.lotterySeries.findMany({
      where: { status: 'DRAWN' },
      orderBy: { drawnAt: 'desc' },
      take: 20,
    });

    const enriched = await Promise.all(drawnSeries.map(async (s: any) => {
      const winnerIds = [s.firstWinnerId, s.secondWinnerId, s.thirdWinnerId].filter(Boolean);
      const winners: any[] = [];

      if (winnerIds.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: winnerIds } },
          select: { id: true, name: true },
        });
        const userMap = Object.fromEntries(users.map(u => [u.id, u]));
        const isDummy = (id: string) => users.find(u => u.id === id)?.name === 'House Account';

        if (s.firstWinnerId)  winners.push({ tier: '1st', prize: s.firstPrize??0,  ticket: s.firstTicket,  userName: isDummy(s.firstWinnerId)?'House':userMap[s.firstWinnerId]?.name,  isCurrentUser: s.firstWinnerId===currentUserId });
        if (s.secondWinnerId) winners.push({ tier: '2nd', prize: s.secondPrize??0, ticket: s.secondTicket, userName: isDummy(s.secondWinnerId)?'House':userMap[s.secondWinnerId]?.name, isCurrentUser: s.secondWinnerId===currentUserId });
        if (s.thirdWinnerId)  winners.push({ tier: '3rd', prize: s.thirdPrize??0,  ticket: s.thirdTicket,  userName: isDummy(s.thirdWinnerId)?'House':userMap[s.thirdWinnerId]?.name,  isCurrentUser: s.thirdWinnerId===currentUserId });
      }

      return { id: s.id, name: s.name, prefix: s.prefix, prizePool: s.prizePool, endNumber: s.endNumber, drawnAt: s.drawnAt, winners };
    }));

    return NextResponse.json({ series: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, series: [] }, { status: 500 });
  }
}
