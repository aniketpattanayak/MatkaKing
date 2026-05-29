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

  // Normalize betType — client may send the display label, enum key, or aliased key
  const RAW = String(betType).toUpperCase().replace(/[\s-]+/g, '_');
  const NORMALIZE: Record<string, { enum: string; rateField: string }> = {
    ANK:              { enum: 'SINGLE_ANK',   rateField: 'payoutSingle' },
    SINGLE_ANK:       { enum: 'SINGLE_ANK',   rateField: 'payoutSingle' },
    JODI:             { enum: 'JODI',         rateField: 'payoutJodi' },
    SP:               { enum: 'SINGLE_PATTI', rateField: 'payoutSP' },
    SINGLE_PATTI:     { enum: 'SINGLE_PATTI', rateField: 'payoutSP' },
    DP:               { enum: 'DOUBLE_PATTI', rateField: 'payoutDP' },
    DOUBLE_PATTI:     { enum: 'DOUBLE_PATTI', rateField: 'payoutDP' },
    TP:               { enum: 'TRIPLE_PATTI', rateField: 'payoutTP' },
    TRIPLE_PATTI:     { enum: 'TRIPLE_PATTI', rateField: 'payoutTP' },
    HALF_SANGAM:      { enum: 'HALF_SANGAM',  rateField: 'payoutHalfSangam' },
    HALF_SANGAM_A:    { enum: 'HALF_SANGAM',  rateField: 'payoutHalfSangam' },
    HALF_SANGAM_B:    { enum: 'HALF_SANGAM',  rateField: 'payoutHalfSangam' },
    FULL_SANGAM:      { enum: 'FULL_SANGAM',  rateField: 'payoutFullSangam' },
  };
  const norm = NORMALIZE[RAW];
  if (!norm) return NextResponse.json({ error: `Invalid bet type: ${betType}` }, { status: 400 });

  try {
    const [market, wallet] = await Promise.all([
      prisma.matkaMarket.findUnique({ where: { id: marketId } }),
      prisma.wallet.findUnique({ where: { userId: p.sub } }),
    ]);

    if (!market || !market.isOpen) return NextResponse.json({ error: 'Market is closed' }, { status: 400 });
    if (market.isResultDeclared) return NextResponse.json({ error: 'Result already declared' }, { status: 400 });
    if (!wallet || wallet.balance < amount)
      return NextResponse.json({ error: `Insufficient coins. Need ${amount}, have ${wallet?.balance ?? 0}` }, { status: 402 });

    // Use the market's per-rate (admin-configurable) instead of hardcoded
    const multiplier = (market as any)[norm.rateField] ?? 0;
    if (multiplier <= 0) return NextResponse.json({ error: 'Bet type not enabled for this market' }, { status: 400 });

    // Sangam + Jodi are not session-bound — force session to OPEN for consistency
    const isSangamOrJodi = ['JODI','HALF_SANGAM','FULL_SANGAM'].includes(norm.enum);
    const finalSession = isSangamOrJodi ? 'OPEN' : (session ?? 'OPEN');

    const bet = await prisma.$transaction(async (tx) => {
      const b = await tx.matkaBet.create({
        data: {
          userId: p.sub, marketId,
          betType: norm.enum as any,
          betValue,
          session: finalSession as any,
          amount,
          potentialWin: amount * multiplier,
          status: 'ACTIVE',
        },
      });
      await tx.wallet.update({ where: { userId: p.sub }, data: { balance: { decrement: amount } } });
      await tx.transaction.create({ data: { userId: p.sub, type: 'BET_DEBIT', status: 'SUCCESS', amount, coins: amount, orderId: `MK-${Date.now()}-${b.id.slice(-4)}` } });
      return b;
    });

    return NextResponse.json({ success: true, betId: bet.id, potentialWin: bet.potentialWin });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
