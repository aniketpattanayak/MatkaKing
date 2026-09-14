import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const period = new URL(req.url).searchParams.get('period') ?? 'daily';

  try {
    const result = [];

    if (period === 'daily') {
      // Last 10 days, one bar per day
      for (let i = 9; i >= 0; i--) {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        dayStart.setDate(dayStart.getDate() - i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const label = dayStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const [lotteryAmt, matkaAmt, matkaWon] = await Promise.all([
          prisma.lotteryBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd } }, _sum: { amountPaid: true } }),
          prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd } }, _sum: { amount: true } }),
          prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' }, _sum: { wonAmount: true } }),
        ]);
        result.push({ date: label, lotteryRevenue: lotteryAmt._sum.amountPaid ?? 0, matkaCollected: matkaAmt._sum.amount ?? 0, matkaPaid: matkaWon._sum.wonAmount ?? 0, matkaProfit: (matkaAmt._sum.amount ?? 0) - (matkaWon._sum.wonAmount ?? 0) });
      }

    } else if (period === 'weekly') {
      // Last 7 days grouped by day (1 week)
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        dayStart.setDate(dayStart.getDate() - i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const label = dayStart.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
        const [lotteryAmt, matkaAmt, matkaWon] = await Promise.all([
          prisma.lotteryBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd } }, _sum: { amountPaid: true } }),
          prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd } }, _sum: { amount: true } }),
          prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' }, _sum: { wonAmount: true } }),
        ]);
        result.push({ date: label, lotteryRevenue: lotteryAmt._sum.amountPaid ?? 0, matkaCollected: matkaAmt._sum.amount ?? 0, matkaPaid: matkaWon._sum.wonAmount ?? 0, matkaProfit: (matkaAmt._sum.amount ?? 0) - (matkaWon._sum.wonAmount ?? 0) });
      }

    } else {
      // Last 30 days grouped into 4 weeks
      for (let w = 3; w >= 0; w--) {
        const weekEnd = new Date();
        weekEnd.setHours(0, 0, 0, 0);
        weekEnd.setDate(weekEnd.getDate() - w * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 7);
        const label = `${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
        const [lotteryAmt, matkaAmt, matkaWon] = await Promise.all([
          prisma.lotteryBet.aggregate({ where: { placedAt: { gte: weekStart, lt: weekEnd } }, _sum: { amountPaid: true } }),
          prisma.matkaBet.aggregate({ where: { placedAt: { gte: weekStart, lt: weekEnd } }, _sum: { amount: true } }),
          prisma.matkaBet.aggregate({ where: { placedAt: { gte: weekStart, lt: weekEnd }, status: 'WON' }, _sum: { wonAmount: true } }),
        ]);
        result.push({ date: label, lotteryRevenue: lotteryAmt._sum.amountPaid ?? 0, matkaCollected: matkaAmt._sum.amount ?? 0, matkaPaid: matkaWon._sum.wonAmount ?? 0, matkaProfit: (matkaAmt._sum.amount ?? 0) - (matkaWon._sum.wonAmount ?? 0) });
      }
    }

    return NextResponse.json({ days: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
