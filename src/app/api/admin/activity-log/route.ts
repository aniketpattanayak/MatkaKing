import { NextRequest } from 'next/server';
import { prisma, isAdminToken, verifyToken, json } from '@/lib/api-helper';

// GET — fetch activity log
export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return json({ error: 'Forbidden' }, 403);

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const limit = Math.min(50,  parseInt(searchParams.get('limit') ?? '20'));
  const type  = searchParams.get('type'); // filter by action type

  try {
    // Use transaction table as activity log (already has all actions)
    const [transactions, payments, bets, total] = await Promise.all([
      // Recent deposits
      prisma.transaction.findMany({
        where:   { ...(type ? { type } : {}) },
        orderBy: { createdAt: 'desc' },
        take:    limit,
        skip:    (page - 1) * limit,
        select: {
          id: true, type: true, status: true,
          coins: true, amount: true, createdAt: true,
          orderId: true,
          user: { select: { name: true, email: true } },
        },
      }),
      // Recent matka bets
      prisma.matkaBet.findMany({
        orderBy: { placedAt: 'desc' }, take: 10,
        select: {
          id: true, betType: true, betValue: true,
          amount: true, status: true, placedAt: true,
          user: { select: { name: true, email: true } },
          market: { select: { name: true } },
        },
      }),
      // Recent lottery purchases
      prisma.lotteryBet.findMany({
        orderBy: { placedAt: 'desc' }, take: 10,
        select: {
          id: true, amountPaid: true, status: true, placedAt: true,
          user: { select: { name: true, email: true } },
          series: { select: { name: true } },
          ticket: { select: { ticketCode: true } },
        },
      }),
      prisma.transaction.count({ where: type ? { type } : {} }),
    ]);

    return json({ transactions, payments: bets, lotteryBets: bets, total, page, limit });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}
