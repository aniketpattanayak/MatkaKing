import { getCache, setCache } from '@/lib/api-helper';
import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

async function buildRow(dayStart: Date, dayEnd: Date, label: string) {
  const [
    depositAgg, withdrawAgg,
    lotteryBetAgg, lotteryWonAgg,
    matkaBetAgg, matkaWonAgg,
  ] = await Promise.all([
    prisma.transaction.aggregate({ where: { type: 'DEPOSIT',    status: 'SUCCESS', createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { coins: true } }),
    prisma.transaction.aggregate({ where: { type: 'WITHDRAWAL', status: 'SUCCESS', createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { coins: true } }),
    prisma.lotteryBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd } }, _sum: { amountPaid: true } }),
    prisma.lotteryBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' }, _sum: { wonAmount: true } }),
    prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd } }, _sum: { amount: true } }),
    prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' }, _sum: { wonAmount: true } }),
  ]);

  const deposit  = depositAgg._sum.coins  ?? 0;
  const withdraw = withdrawAgg._sum.coins ?? 0;
  const matkaPaid = matkaWonAgg._sum.wonAmount ?? 0;
  const profit   = deposit - withdraw - matkaPaid;

  return { date: label, deposit, lotteryTickets, matkaBets, lotteryWinners, matkaWinners, withdraw, profit };
}

export async function GET(req: NextRequest) {
  const cached = getCache('admin:history-stats');
  if (cached) return NextResponse.json(cached);
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const period = new URL(req.url).searchParams.get('period') ?? 'daily';

  try {
    const result = [];

    if (period === 'daily') {
      for (let i = 9; i >= 0; i--) {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        dayStart.setDate(dayStart.getDate() - i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const label = dayStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        result.push(await buildRow(dayStart, dayEnd, label));
      }

    } else if (period === 'weekly') {
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        dayStart.setDate(dayStart.getDate() - i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const label = dayStart.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
        result.push(await buildRow(dayStart, dayEnd, label));
      }

    } else {
      for (let w = 3; w >= 0; w--) {
        const weekEnd = new Date();
        weekEnd.setHours(0, 0, 0, 0);
        weekEnd.setDate(weekEnd.getDate() - w * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 7);
        const label = `${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
        result.push(await buildRow(weekStart, weekEnd, label));
      }
    }

    const resp = { days: result };
    setCache('admin:history-stats', resp, 600000);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
