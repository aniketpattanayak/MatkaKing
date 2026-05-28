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

  // ── Declare OPEN patti (Step 1) ───────────────────────────────────────────
  // Settles only: SINGLE_ANK (session=OPEN), SP/DP/TP (session=OPEN)
  // Leaves ACTIVE: JODI, close-side bets, Half Sangam, Full Sangam
  if (action === 'declare_open') {
    const { openPatti } = body;
    if (!marketId || !openPatti || openPatti.length !== 3)
      return NextResponse.json({ error: 'marketId and 3-digit openPatti required' }, { status: 400 });

    const market = await prisma.matkaMarket.findUnique({ where: { id: marketId } });
    if (!market) return NextResponse.json({ error: 'Market not found' }, { status: 404 });

    const openAnk = openPatti.split('').reduce((s: number, d: string) => s + parseInt(d), 0) % 10;

    const RATES: Record<string, number> = {
      SINGLE_ANK: market.payoutSingle, ANK: market.payoutSingle,
      SINGLE_PATTI: market.payoutSP,   SP: market.payoutSP,
      DOUBLE_PATTI: market.payoutDP,   DP: market.payoutDP,
      TRIPLE_PATTI: market.payoutTP,   TP: market.payoutTP,
    };

    // Find or create result row for today
    let result = await prisma.matkaResult.findFirst({
      where: { marketId, declaredAt: { gte: new Date(new Date().setHours(0,0,0,0)) } },
      orderBy: { createdAt: 'desc' },
    });
    if (!result) {
      result = await prisma.matkaResult.create({
        data: { marketId, openPatti, openAnk, declaredAt: new Date() },
      });
    } else {
      result = await prisma.matkaResult.update({
        where: { id: result.id },
        data: { openPatti, openAnk, declaredAt: new Date() },
      });
    }

    // Settle only open-side bets
    const openBets = await prisma.matkaBet.findMany({
      where: {
        marketId, status: 'ACTIVE', session: 'OPEN',
        betType: { in: ['SINGLE_ANK', 'SINGLE_PATTI', 'DOUBLE_PATTI', 'TRIPLE_PATTI'] },
      },
    });

    let totalPayout = 0;

    await prisma.$transaction(async tx => {
      for (const bet of openBets) {
        let won = false;
        const bv = bet.betValue;
        const bt = bet.betType;

        if (bt === 'SINGLE_ANK' && bv === String(openAnk)) won = true;
        if ((bt === 'SINGLE_PATTI' || bt === 'DOUBLE_PATTI' || bt === 'TRIPLE_PATTI') && bv === openPatti) won = true;

        const wonAmount = won ? bet.amount * (RATES[bt] ?? 0) : 0;

        await tx.matkaBet.update({
          where: { id: bet.id },
          data: { status: won ? 'WON' : 'LOST', wonAmount, resultId: result!.id },
        });

        if (won && wonAmount > 0) {
          totalPayout += wonAmount;
          await tx.wallet.update({
            where: { userId: bet.userId },
            data: { balance: { increment: wonAmount }, totalWon: { increment: wonAmount } },
          });
          await tx.transaction.create({
            data: {
              userId: bet.userId, type: 'WIN_CREDIT', status: 'SUCCESS',
              coins: wonAmount, amount: 0,
              orderId: `MKW-O-${Date.now()}-${bet.id.slice(-4)}`,
            },
          });
        }
      }

      await tx.matkaResult.update({
        where: { id: result!.id },
        data: { totalPayout: { increment: totalPayout } },
      });
    });

    return NextResponse.json({ ok: true, settled: openBets.length, totalPayout, openAnk, openPatti });
  }

  // ── Declare CLOSE patti (Step 2) ──────────────────────────────────────────
  // Settles: JODI, close-side SINGLE_ANK/SP/DP/TP, HALF_SANGAM, FULL_SANGAM
  if (action === 'declare_close') {
    const { closePatti } = body;
    if (!marketId || !closePatti || closePatti.length !== 3)
      return NextResponse.json({ error: 'marketId and 3-digit closePatti required' }, { status: 400 });

    const market = await prisma.matkaMarket.findUnique({ where: { id: marketId } });
    if (!market) return NextResponse.json({ error: 'Market not found' }, { status: 404 });

    // Find today's result row (must exist with openPatti already)
    const result = await prisma.matkaResult.findFirst({
      where: { marketId, declaredAt: { gte: new Date(new Date().setHours(0,0,0,0)) } },
      orderBy: { createdAt: 'desc' },
    });
    if (!result || !result.openPatti || result.openAnk === null) {
      return NextResponse.json({ error: 'Declare Open Patti first' }, { status: 400 });
    }

    const closeAnk = closePatti.split('').reduce((s: number, d: string) => s + parseInt(d), 0) % 10;
    const jodi = `${result.openAnk}${closeAnk}`;
    const openPatti = result.openPatti;
    const openAnk = result.openAnk;

    const RATES: Record<string, number> = {
      SINGLE_ANK: market.payoutSingle, ANK: market.payoutSingle,
      JODI: market.payoutJodi,
      SINGLE_PATTI: market.payoutSP,   SP: market.payoutSP,
      DOUBLE_PATTI: market.payoutDP,   DP: market.payoutDP,
      TRIPLE_PATTI: market.payoutTP,   TP: market.payoutTP,
      HALF_SANGAM: market.payoutHalfSangam,
      FULL_SANGAM: market.payoutFullSangam,
    };

    // Settle everything still ACTIVE for this market
    const remaining = await prisma.matkaBet.findMany({
      where: { marketId, status: 'ACTIVE' },
    });

    let totalPayout = 0;

    await prisma.$transaction(async tx => {
      for (const bet of remaining) {
        let won = false;
        const bv = bet.betValue;
        const bt = bet.betType;

        if (bt === 'SINGLE_ANK' && bet.session === 'CLOSE' && bv === String(closeAnk)) won = true;
        if (bt === 'JODI' && bv === jodi) won = true;
        if ((bt === 'SINGLE_PATTI' || bt === 'DOUBLE_PATTI' || bt === 'TRIPLE_PATTI') && bet.session === 'CLOSE' && bv === closePatti) won = true;

        // Half Sangam variants: bet value stored as either "openAnk-closePatti" or "openPatti-closeAnk"
        if (bt === 'HALF_SANGAM') {
          const [a, b] = bv.split('-');
          if (a && b) {
            // Variant A: open ank + close patti
            if (a === String(openAnk) && b === closePatti) won = true;
            // Variant B: open patti + close ank
            if (a === openPatti && b === String(closeAnk)) won = true;
          }
        }

        // Full Sangam: "openPatti-closePatti"
        if (bt === 'FULL_SANGAM') {
          const [a, b] = bv.split('-');
          if (a === openPatti && b === closePatti) won = true;
        }

        const wonAmount = won ? bet.amount * (RATES[bt] ?? 0) : 0;

        await tx.matkaBet.update({
          where: { id: bet.id },
          data: { status: won ? 'WON' : 'LOST', wonAmount, resultId: result.id },
        });

        if (won && wonAmount > 0) {
          totalPayout += wonAmount;
          await tx.wallet.update({
            where: { userId: bet.userId },
            data: { balance: { increment: wonAmount }, totalWon: { increment: wonAmount } },
          });
          await tx.transaction.create({
            data: {
              userId: bet.userId, type: 'WIN_CREDIT', status: 'SUCCESS',
              coins: wonAmount, amount: 0,
              orderId: `MKW-C-${Date.now()}-${bet.id.slice(-4)}`,
            },
          });
        }
      }

      await tx.matkaResult.update({
        where: { id: result.id },
        data: {
          closePatti, closeAnk, jodi,
          totalPayout: { increment: totalPayout },
          declaredAt: new Date(),
        },
      });

      await tx.matkaMarket.update({
        where: { id: marketId },
        data: { isResultDeclared: true, isOpen: false },
      });
    });

    return NextResponse.json({ ok: true, settled: remaining.length, totalPayout, jodi, openAnk, closeAnk });
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

  // ── Toggle isRecurring flag ──────────────────────────────────────────────
  if (action === 'update_recurring') {
    const { marketId, isRecurring } = body;
    if (!marketId) return json({ error: 'marketId required' }, 400);
    const updated = await prisma.matkaMarket.update({
      where: { id: marketId },
      data: { isRecurring: Boolean(isRecurring) },
    });
    return json({ ok: true, market: updated });
  }

  // ── Add a date to pausedDates (skip auto-rollover on that day) ───────────
  if (action === 'pause_date') {
    const { marketId, date } = body;  // date format: "YYYY-MM-DD"
    if (!marketId || !date) return json({ error: 'marketId and date required' }, 400);
    const m = await prisma.matkaMarket.findUnique({ where: { id: marketId } });
    if (!m) return json({ error: 'Market not found' }, 404);
    if (!m.pausedDates.includes(date)) {
      await prisma.matkaMarket.update({
        where: { id: marketId },
        data: { pausedDates: { push: date } },
      });
    }
    return json({ ok: true });
  }

  // ── Remove a date from pausedDates ───────────────────────────────────────
  if (action === 'unpause_date') {
    const { marketId, date } = body;
    if (!marketId || !date) return json({ error: 'marketId and date required' }, 400);
    const m = await prisma.matkaMarket.findUnique({ where: { id: marketId } });
    if (!m) return json({ error: 'Market not found' }, 404);
    await prisma.matkaMarket.update({
      where: { id: marketId },
      data: { pausedDates: m.pausedDates.filter((d: string) => d !== date) },
    });
    return json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
