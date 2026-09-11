import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [lotteryTicketsSold, matkaBetsToday, totalUsers, activeUsers] = await Promise.all([
      prisma.lotteryTicket.count({ where: { isSold: true, createdAt: { gte: today } } }),
      prisma.matkaBet.count({ where: { placedAt: { gte: today } } }),
      prisma.user.count(),
      prisma.user.count({ where: { transactions: { some: { createdAt: { gte: today } } } } }),
    ]);
    const depositToday = await prisma.transaction.aggregate({
      where: { type: 'DEPOSIT', status: 'SUCCESS', createdAt: { gte: today } },
      _sum: { coins: true },
    });
    const withdrawToday = await prisma.transaction.aggregate({
      where: { type: 'WITHDRAWAL', createdAt: { gte: today } },
      _sum: { coins: true },
    });
    // Matka collection vs payout today
    const matkaBetAmt = await prisma.matkaBet.aggregate({
      where: { placedAt: { gte: today } },
      _sum: { amount: true },
    });
    let matkaWinAmt = { _sum: { wonAmount: 0 } };
    try {
      matkaWinAmt = await prisma.matkaBet.aggregate({
        where: { placedAt: { gte: today }, status: 'WON' },
        _sum: { wonAmount: true },
      }) as any;
    } catch(e) { /* wonAmount field may not exist */ }
    return NextResponse.json({
      date: today.toLocaleDateString('en-IN'),
      lotteryTicketsSoldToday: lotteryTicketsSold,
      matkaBetsToday,
      totalUsers,
      activeUsersToday: activeUsers,
      depositToday: depositToday._sum.coins ?? 0,
      withdrawToday: withdrawToday._sum.coins ?? 0,
      matkaCollectedToday: matkaBetAmt._sum.amount ?? 0,
      matkaPaidToday: matkaWinAmt._sum.wonAmount ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
