import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '@/lib/api-helper';
import { prisma, isAdminToken } from '@/lib/api-helper';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const cached = getCache('admin:daily-stats');
  if (cached) return NextResponse.json(cached);
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const now = new Date();
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const y = istNow.getUTCFullYear();
    const m = istNow.getUTCMonth();
    const d = istNow.getUTCDate();
    const today = new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
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
    const matkaBetAmt = await prisma.matkaBet.aggregate({
      where: { placedAt: { gte: today } },
      _sum: { amount: true },
    });
    let matkaWinAmt: any = { _sum: { wonAmount: 0 } };
    try {
      matkaWinAmt = await prisma.matkaBet.aggregate({
        where: { placedAt: { gte: today }, status: 'WON' },
        _sum: { wonAmount: true },
      });
    } catch(e) {}
    const istDate = new Date(today.getTime() + IST_OFFSET_MS);
    const statsData = {
      date: istDate.toLocaleDateString('en-IN'),
      lotteryTicketsSoldToday: lotteryTicketsSold,
      matkaBetsToday,
      totalUsers,
      activeUsersToday: activeUsers,
      depositToday: depositToday._sum.coins ?? 0,
      withdrawToday: withdrawToday._sum.coins ?? 0,
      matkaCollectedToday: matkaBetAmt._sum.amount ?? 0,
      matkaPaidToday: matkaWinAmt._sum.wonAmount ?? 0,
    };
    setCache('admin:daily-stats', statsData, 300000);
    return NextResponse.json(statsData);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
