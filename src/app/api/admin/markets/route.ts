import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken, isAdminToken, json } from '@/lib/api-helper';

async function isAdmin(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return false;
  const u = await prisma.user.findUnique({ where: { id: p.sub }, select: { role: true } });
  return u?.role === 'ADMIN' || u?.role === 'SUPERADMIN';
}

export async function GET(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // Live result check - real-time payout calculation
  const check = req.nextUrl?.searchParams?.get('check') ?? new URL(req.url).searchParams.get('check');
  if (check === '1') {
    const url        = new URL(req.url);
    const marketId   = url.searchParams.get('marketId') ?? '';
    const openPatti  = url.searchParams.get('openPatti') ?? '';
    const closePatti = url.searchParams.get('closePatti') ?? '';

    if (!marketId || openPatti.length < 3 || closePatti.length < 3)
      return json({ error: 'marketId, openPatti, closePatti required' }, 400);

    const openAnk  = openPatti.split('').reduce((s:number,d:string)=>s+parseInt(d),0) % 10;
    const closeAnk = closePatti.split('').reduce((s:number,d:string)=>s+parseInt(d),0) % 10;
    const jodi     = `${openAnk}${closeAnk}`;

    const market = await prisma.matkaMarket.findUnique({ where: { id: marketId } });
    const PAYOUT: Record<string,number> = {
      ANK: market?.payoutSingle ?? 90, SINGLE_ANK: market?.payoutSingle ?? 90,
      JODI: market?.payoutJodi ?? 900,
      SINGLE_PATTI: market?.payoutSP ?? 140, SP: market?.payoutSP ?? 140,
      DOUBLE_PATTI: market?.payoutDP ?? 280, DP: market?.payoutDP ?? 280,
      TRIPLE_PATTI: market?.payoutTP ?? 450, TP: market?.payoutTP ?? 450,
      HALF_SANGAM: market?.payoutHalfSangam ?? 1500,
      FULL_SANGAM: market?.payoutFullSangam ?? 11000,
    };

    const bets = await prisma.matkaBet.findMany({
      where: { marketId, status: 'ACTIVE' },
      select: { id:true, betType:true, betValue:true, session:true, amount:true },
    });

    const totalBets = bets.reduce((s:number,b:any)=>s+b.amount,0);
    let totalPayout = 0; let winnerCount = 0;
    for (const bet of bets) {
      const bt = bet.betType?.toUpperCase();
      let won = false;
      if ((bt==='ANK'||bt==='SINGLE_ANK') && (bet.session==='OPEN'?String(openAnk):String(closeAnk))===bet.betValue) won=true;
      if (bt==='JODI' && bet.betValue===jodi) won=true;
      if ((bt==='SINGLE_PATTI'||bt==='SP') && (bet.betValue===openPatti||bet.betValue===closePatti)) won=true;
      if ((bt==='DOUBLE_PATTI'||bt==='DP') && (bet.betValue===openPatti||bet.betValue===closePatti)) won=true;
      if ((bt==='TRIPLE_PATTI'||bt==='TP') && (bet.betValue===openPatti||bet.betValue===closePatti)) won=true;
      if (won) { totalPayout += bet.amount*(PAYOUT[bet.betType??'']??0); winnerCount++; }
    }
    return json({ winnerCount, totalPayout, totalBets, jodi, openAnk, closeAnk, isSafe: totalPayout <= totalBets * 1.3 });
  }

  try {
    const [markets, stats] = await Promise.all([
      prisma.matkaMarket.findMany({
        include: {
          _count: { select: { bets: true } },
          results: { take: 1, orderBy: { createdAt: 'desc' } },
        },
      }),
      // BetStatus enum values: ACTIVE, WON, LOST, REFUNDED
      prisma.matkaBet.aggregate({
        _sum: { amount: true, potentialWin: true },
        where: { status: 'ACTIVE' },  // ✅ correct enum value
      }),
    ]);
    return NextResponse.json({
      markets,
      pendingBets:    stats._sum.amount      ?? 0,
      potentialPayout: stats._sum.potentialWin ?? 0,
    });
  } catch (e: any) {
    console.error('admin/markets GET error:', e.message);
    return NextResponse.json({ markets: [], pendingBets: 0, potentialPayout: 0 });
  }
}

export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { action, marketId, openPatti, closePatti, name, openTime, closeTime, resultTime } = body;

  // ── Create market ─────────────────────────────────────────────────────────
  if (action === 'create_market') {
    if (!name || !openTime || !closeTime || !resultTime)
      return NextResponse.json({ error: 'name, openTime, closeTime, resultTime required' }, { status: 400 });
    const market = await prisma.matkaMarket.create({
      data: { name, openTime, closeTime, resultTime, isOpen: false },
    });
    return NextResponse.json({ ok: true, market });
  }

  // ── Toggle market open/closed ─────────────────────────────────────────────
  if (action === 'toggle_market') {
    const market = await prisma.matkaMarket.findUnique({ where: { id: marketId } });
    if (!market) return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    await prisma.matkaMarket.update({ where: { id: marketId }, data: { isOpen: !market.isOpen } });
    return NextResponse.json({ ok: true });
  }

  // ── Delete market ─────────────────────────────────────────────────────────
  if (action === 'delete_market') {
    await prisma.matkaBet.deleteMany({ where: { marketId } });
    await prisma.matkaResult.deleteMany({ where: { marketId } });
    await prisma.matkaMarket.delete({ where: { id: marketId } });
    return NextResponse.json({ ok: true });
  }

  // ── Declare result & settle bets ──────────────────────────────────────────
  if (action === 'declare_result') {
    const market = await prisma.matkaMarket.findUnique({ where: { id: marketId } });
    if (!market) return NextResponse.json({ error: 'Market not found' }, { status: 404 });

    const openAnk  = openPatti.split('').reduce((s: number, d: string) => s + parseInt(d), 0) % 10;
    const closeAnk = closePatti.split('').reduce((s: number, d: string) => s + parseInt(d), 0) % 10;
    const jodi     = `${openAnk}${closeAnk}`;

    const PAYOUT: Record<string, number> = {
      ANK: 90, SINGLE_ANK: 90, JODI: 900,
      SINGLE_PATTI: 140, SP: 140,
      DOUBLE_PATTI: 280, DP: 280,
      TRIPLE_PATTI: 450, TP: 450,
      HALF_SANGAM: 1500, FULL_SANGAM: 11000,
    };

    // Get all ACTIVE bets for this market
    const bets = await prisma.matkaBet.findMany({
      where: { marketId, status: 'ACTIVE' },
    });

    let totalPayout = 0;

    await prisma.$transaction(async tx => {
      for (const bet of bets) {
        let won = false;
        const bv = bet.betValue;
        const bt = bet.betType?.toUpperCase();

        if ((bt === 'ANK' || bt === 'SINGLE_ANK') &&
          (bet.session === 'OPEN' ? bv === String(openAnk) : bv === String(closeAnk))) won = true;
        if (bt === 'JODI' && bv === jodi) won = true;
        if ((bt === 'SINGLE_PATTI' || bt === 'SP') && (bv === openPatti || bv === closePatti)) won = true;
        if ((bt === 'DOUBLE_PATTI' || bt === 'DP') && (bv === openPatti || bv === closePatti)) won = true;
        if ((bt === 'TRIPLE_PATTI' || bt === 'TP') && (bv === openPatti || bv === closePatti)) won = true;

        const winAmount = won ? bet.amount * (PAYOUT[bet.betType ?? ''] ?? 0) : 0;

        // BetStatus: WON or LOST
        await tx.matkaBet.update({
          where: { id: bet.id },
          data: { status: won ? 'WON' : 'LOST', winAmount },
        });

        if (won && winAmount > 0) {
          totalPayout += winAmount;
          await tx.wallet.update({
            where: { userId: bet.userId },
            data: { balance: { increment: winAmount }, totalWon: { increment: winAmount } },
          });
          await tx.transaction.create({
            data: {
              userId: bet.userId, type: 'WIN_CREDIT', status: 'SUCCESS',
              coins: winAmount, amount: 0,
              orderId: `MKW-${Date.now()}-${bet.id.slice(-4)}`,
            },
          });
        }
      }

      await tx.matkaResult.create({
        data: { marketId, openPatti, closePatti, openAnk, closeAnk, jodi, declaredAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true, settled: bets.length, totalPayout, jodi });
  }

  // ── Update game rates ────────────────────────────────────────────────────
  if (action === 'update_rates') {
    const { marketId, payoutSingle, payoutJodi, payoutSP, payoutDP, payoutTP, payoutHalfSangam, payoutFullSangam } = body;
    if (!marketId) return json({ error: 'marketId required' }, 400);
    const updated = await prisma.matkaMarket.update({
      where: { id: marketId },
      data: {
        ...(payoutSingle      !== undefined && { payoutSingle:      Number(payoutSingle) }),
        ...(payoutJodi        !== undefined && { payoutJodi:        Number(payoutJodi) }),
        ...(payoutSP          !== undefined && { payoutSP:          Number(payoutSP) }),
        ...(payoutDP          !== undefined && { payoutDP:          Number(payoutDP) }),
        ...(payoutTP          !== undefined && { payoutTP:          Number(payoutTP) }),
        ...(payoutHalfSangam  !== undefined && { payoutHalfSangam:  Number(payoutHalfSangam) }),
        ...(payoutFullSangam  !== undefined && { payoutFullSangam:  Number(payoutFullSangam) }),
      },
    });
    return json({ ok: true, market: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
