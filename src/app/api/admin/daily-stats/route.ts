import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [lotteryTicketsSold, matkaBetsToday, totalUsers, activeUsers] = await Promise.all([
      prisma.lotteryTicket.count({ where: { isSold: true, updatedAt: { gte: today } } }),
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
    return NextResponse.json({
      date: today.toLocaleDateString('en-IN'),
      lotteryTicketsSoldToday: lotteryTicketsSold,
      matkaBetsToday,
      totalUsers,
      activeUsersToday: activeUsers,
      depositToday: depositToday._sum.coins ?? 0,
      withdrawToday: withdrawToday._sum.coins ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
