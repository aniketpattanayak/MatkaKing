import { getCache, setCache } from '@/lib/api-helper';
import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istDayStart(daysAgo = 0): Date {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();
  const base = new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
  base.setUTCDate(base.getUTCDate() - daysAgo);
  return base;
}

async function buildRow(dayStart: Date, dayEnd: Date, label: string) {
  const [depositAgg, withdrawAgg, lotteryTicketsAgg, lotteryWinnersAgg, matkaBetsAgg, matkaWinnersAgg] = await Promise.all([
    prisma.transaction.aggregate({ where: { type: 'DEPOSIT',    status: 'SUCCESS', createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { coins: true } }),
    prisma.transaction.aggregate({ where: { type: 'WITHDRAWAL', status: 'SUCCESS', createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { coins: true } }),
    prisma.lotteryBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd } }, _sum: { amountPaid: true } }),
    prisma.lotteryBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' }, _sum: { wonAmount: true } }),
    prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd } }, _sum: { amount: true } }),
    prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' }, _sum: { wonAmount: true } }),
  ]);
  const deposit        = depositAgg._sum.coins           ?? 0;
  const withdraw       = withdrawAgg._sum.coins          ?? 0;
  const lotteryTickets = lotteryTicketsAgg._sum.amountPaid ?? 0;
  const lotteryWinners = lotteryWinnersAgg._sum.wonAmount  ?? 0;
  const matkaBets      = matkaBetsAgg._sum.amount          ?? 0;
  const matkaWinners   = matkaWinnersAgg._sum.wonAmount    ?? 0;
  const profit         = deposit - withdraw - lotteryWinners - matkaWinners;
  return { date: label, deposit, lotteryTickets, matkaBets, lotteryWinners, matkaWinners, withdraw, profit };
}

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const period = new URL(req.url).searchParams.get('period') ?? '7days';
  const cacheKey = `admin:history-stats:${period}`;
  const cached = getCache(cacheKey);
  if (cached) return NextResponse.json(cached);
  try {
    const result = [];
    const days = period === '30days' ? 30 : period === '15days' ? 15 : 7;
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = istDayStart(i);
      const dayEnd   = istDayStart(i - 1);
      const istLabel = new Date(dayStart.getTime() + IST_OFFSET_MS);
      const label = istLabel.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      result.push(await buildRow(dayStart, dayEnd, label));
    }
    const resp = { days: result };
    setCache(cacheKey, resp, 300000);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
