import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  try {
    const markets = await prisma.matkaMarket.findMany({
      orderBy: { openTime: 'asc' },
      include: { results: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    return NextResponse.json({ markets });
  } catch {
    return NextResponse.json({ markets: [] });
  }
}

export async function POST(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, marketId, betType, betValue, session, amount } = await req.json();

  if (action !== 'place_bet') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  if (!marketId || !betType || !betValue || !amount || amount < 1)
    return NextResponse.json({ error: 'marketId, betType, betValue, amount required' }, { status: 400 });

  const PAYOUT: Record<string, number> = {
    SINGLE_ANK: 90, JODI: 900, SINGLE_PATTI: 140, DOUBLE_PATTI: 280,
    TRIPLE_PATTI: 450, HALF_SANGAM: 1500, FULL_SANGAM: 11000,
  };

  const multiplier = PAYOUT[betType];
  if (!multiplier) return NextResponse.json({ error: 'Invalid bet type' }, { status: 400 });

  try {
    const [market, wallet] = await Promise.all([
      prisma.matkaMarket.findUnique({ where: { id: marketId } }),
      prisma.wallet.findUnique({ where: { userId: p.sub } }),
    ]);

    if (!market || !market.isOpen) return NextResponse.json({ error: 'Market is closed' }, { status: 400 });
    if (!wallet || wallet.balance < amount)
      return NextResponse.json({ error: `Insufficient coins. Need ${amount}, have ${wallet?.balance ?? 0}` }, { status: 402 });

    const bet = await prisma.$transaction(async (tx) => {
      const b = await tx.matkaBet.create({
        data: { userId: p.sub, marketId, betType, betValue, session: session ?? 'OPEN', amount, potentialWin: amount * multiplier, status: 'PENDING' },
      });
      await tx.wallet.update({ where: { userId: p.sub }, data: { balance: { decrement: amount } } });
      await tx.transaction.create({ data: { userId: p.sub, type: 'BET_DEBIT', status: 'SUCCESS', amount, coins: amount, orderId: `MK-${Date.now()}` } });
      return b;
    });

    return NextResponse.json({ success: true, betId: bet.id, potentialWin: bet.potentialWin });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
