import { NextRequest, NextResponse } from 'next/server';

function isMarketOpen(openTime: string, closeTime: string): boolean {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const cur = ist.getHours()*60 + ist.getMinutes();
  const hm  = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  return cur >= hm(openTime) && cur < hm(closeTime);
}
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

    const marketOpen = market.isOpen || isMarketOpen(market.openTime, market.closeTime);
    if (!market || !marketOpen) return NextResponse.json({ error: 'Market is closed. Please wait for market to open.' }, { status: 400 });
    // Block Jodi and Full Sangam after open is declared
    const todayResult = await prisma.matkaResult.findFirst({
      where: { marketId, openPatti: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    if (todayResult?.openPatti) {
      // After open declared: block Jodi, Full Sangam, and open-session patti bets
      if (['JODI','FULL_SANGAM'].includes(norm.enum)) {
        return NextResponse.json({ error: 'Jodi and Full Sangam not allowed after Open is declared.' }, { status: 400 });
      }
      const openSideBets = ['SINGLE_ANK','SINGLE_PATTI','DOUBLE_PATTI','TRIPLE_PATTI'];
      const finalSession = session ?? 'OPEN';
      if (openSideBets.includes(norm.enum) && finalSession === 'OPEN') {
        return NextResponse.json({ error: 'Open-side bets not allowed after Open result is declared. Place Close-side bets only.' }, { status: 400 });
      }
    }
    if (market.isResultDeclared) return NextResponse.json({ error: 'Result already declared' }, { status: 400 });
    if (!wallet || wallet.balance < amount)
      return NextResponse.json({ error: `Insufficient coins. Need ${amount}, have ${wallet?.balance ?? 0}` }, { status: 402 });

    // Use the market's per-rate (admin-configurable) instead of hardcoded
    const multiplier = (market as any)[norm.rateField] ?? 0;
    if (multiplier <= 0) return NextResponse.json({ error: 'Bet type not enabled for this market' }, { status: 400 });

    // Jodi and Full Sangam are OPEN only, Half Sangam keeps its session
    const isOpenOnly = ['JODI','FULL_SANGAM'].includes(norm.enum);
    const finalSession = isOpenOnly ? 'OPEN' : (session ?? 'OPEN');

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
