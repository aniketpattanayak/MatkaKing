import { NextRequest } from 'next/server';
import { prisma, verifyToken, json } from '@/lib/api-helper';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return json({ error: 'Unauthorized' }, 401);

  // Parallel fetch — both queries fire simultaneously
  const [wallet, transactions] = await Promise.all([
    prisma.wallet.findUnique({
      where:  { userId: p.sub },
      select: {
        balance:      true,
        totalDeposit: true,
        totalWon:     true,
      },
    }),
    prisma.transaction.findMany({
      where:   { userId: p.sub },
      orderBy: { createdAt: 'desc' },
      take:    20,                          // reduced from 30 — less data, faster
      select: {
        id:        true,
        type:      true,
        status:    true,
        coins:     true,
        amount:    true,
        createdAt: true,
        orderId:   true,
      },
    }),
  ]);

  return json({ wallet, transactions });
}
