// /api/admin/lottery-draw — picks 3 winners (1st, 2nd, 3rd), credits each,
// closes the series. Replaces the single-winner flow.

import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

const COMMISSION_PERCENT = 30; // admin keeps 30% on top of total prizes
const DUMMY_USER_EMAIL   = 'dummy@supremegaming.in';

async function isAdmin(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return null;
  const u = await prisma.user.findUnique({ where: { id: p.sub }, select: { role: true, id: true } });
  return (u?.role === 'ADMIN' || u?.role === 'SUPERADMIN') ? p : null;
}

// ── GET: pre-draw eligibility check ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const p = await isAdmin(req);
  if (!p) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const seriesId = searchParams.get('seriesId');
  if (!seriesId) return NextResponse.json({ error: 'seriesId required' }, { status: 400 });

  const series = await prisma.lotterySeries.findUnique({
    where: { id: seriesId },
    include: { _count: { select: { tickets: true } } },
  });
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 });

  const soldTickets = await prisma.lotteryTicket.findMany({
    where: { seriesId, isSold: true },
    select: { id: true, ticketCode: true },
  });

  const totalPrizes      = series.firstPrize + series.secondPrize + series.thirdPrize;
  const totalRevenue     = soldTickets.length * series.ticketPrice;
  const commissionNeeded = Math.ceil(totalPrizes * (1 + COMMISSION_PERCENT / 100));
  const isSafe           = totalRevenue >= commissionNeeded;
  const shortfall        = isSafe ? 0 : commissionNeeded - totalRevenue;
  const adminProfit      = isSafe ? totalRevenue - totalPrizes : 0;

  return NextResponse.json({
    series: {
      id: series.id, name: series.name, prefix: series.prefix,
      firstPrize: series.firstPrize, secondPrize: series.secondPrize, thirdPrize: series.thirdPrize,
      prizePool: totalPrizes, ticketPrice: series.ticketPrice, status: series.status,
    },
    soldCount:         soldTickets.length,
    totalTickets:      series._count.tickets,
    totalRevenue,
    totalPrizes,
    commissionNeeded,
    commissionPercent: COMMISSION_PERCENT,
    isSafe,
    shortfall,
    adminProfit,
    canDraw:           soldTickets.length >= 3,  // need at least 3 sold tickets
    soldTickets:       soldTickets.slice(0, 5),
  });
}

// ── POST: execute draw — picks 3 winners ────────────────────────────────────
export async function POST(req: NextRequest) {
  const p = await isAdmin(req);
  if (!p) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { seriesId, action, forcedTickets } = await req.json();
  // action = 'real_draw' | 'force_dummy'
  // forcedTickets (optional): { first?: 'KH0001', second?: 'KH0050', third?: 'KH0099' }

  if (!seriesId) return NextResponse.json({ error: 'seriesId required' }, { status: 400 });

  const series = await prisma.lotterySeries.findUnique({ where: { id: seriesId } });
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 });
  if (series.status === 'DRAWN') return NextResponse.json({ error: 'Winners already declared' }, { status: 409 });

  const totalPrizes      = series.firstPrize + series.secondPrize + series.thirdPrize;
  const soldCount        = await prisma.lotteryTicket.count({ where: { seriesId, isSold: true } });
  const totalRevenue     = soldCount * series.ticketPrice;
  const commissionNeeded = Math.ceil(totalPrizes * (1 + COMMISSION_PERCENT / 100));
  const isSafe           = totalRevenue >= commissionNeeded;

  if (soldCount < 3 && action === 'real_draw') {
    return NextResponse.json({ error: `Need at least 3 sold tickets to pick 3 winners. Only ${soldCount} sold.` }, { status: 400 });
  }

  // ── REAL DRAW: pick 3 sold tickets, credit each ──────────────────────────
  if (action === 'real_draw') {
    if (!isSafe) {
      return NextResponse.json({
        error: `Revenue ₹${totalRevenue} < required ₹${commissionNeeded}. Use Force Dummy.`,
      }, { status: 400 });
    }

    // Load all sold tickets with their buyer info
    const soldTickets = await prisma.lotteryTicket.findMany({
      where: { seriesId, isSold: true },
      include: { bets: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });

    // Pick 3 distinct winning tickets
    const codes = forcedTickets ?? {};
    const picked: any[] = [];
    const pickedIds = new Set<string>();

    for (const tier of ['first','second','third'] as const) {
      let ticket: any = null;
      const code = codes[tier];
      if (code) {
        // Admin forced this ticket
        ticket = soldTickets.find(t => t.ticketCode.toUpperCase() === String(code).toUpperCase() && !pickedIds.has(t.id));
        if (!ticket) return NextResponse.json({ error: `${tier} prize ticket ${code} not found or already picked` }, { status: 404 });
      } else {
        // Random pick from remaining
        const remaining = soldTickets.filter(t => !pickedIds.has(t.id));
        if (remaining.length === 0) return NextResponse.json({ error: 'Not enough sold tickets' }, { status: 400 });
        ticket = remaining[Math.floor(Math.random() * remaining.length)];
      }
      pickedIds.add(ticket.id);
      const winner = ticket.bets?.[0]?.user;
      if (!winner) return NextResponse.json({ error: `Ticket ${ticket.ticketCode} has no buyer record` }, { status: 400 });
      picked.push({ tier, ticket, winner });
    }

    const PRIZE_BY_TIER: Record<string, number> = {
      first:  series.firstPrize,
      second: series.secondPrize,
      third:  series.thirdPrize,
    };

    // Credit each winner + close series in one transaction
    await prisma.$transaction(async tx => {
      for (const { tier, ticket, winner } of picked) {
        const prize = PRIZE_BY_TIER[tier];
        if (prize <= 0) continue;

        await tx.wallet.update({
          where: { userId: winner.id },
          data: { balance: { increment: prize }, totalWon: { increment: prize } },
        });

        await tx.transaction.create({
          data: {
            userId: winner.id,
            type: 'WIN_CREDIT',
            status: 'SUCCESS',
            coins: prize,
            amount: 0,
            orderId: `LT-${tier.toUpperCase()}-${series.id.slice(-4)}-${Date.now()}`,
          },
        });

        // Mark each winning bet as WON
        await tx.lotteryBet.updateMany({
          where: { ticketId: ticket.id, status: 'ACTIVE' },
          data: { status: 'WON', wonAmount: prize },
        });

        // Mark the ticket itself as a winner
        await tx.lotteryTicket.update({
          where: { id: ticket.id },
          data: { isWinner: true },
        });
      }

      // Mark all non-winning bets as LOST
      await tx.lotteryBet.updateMany({
        where: { seriesId, status: 'ACTIVE' },
        data: { status: 'LOST' },
      });

      // Update series record with 3 winners + close it
      await tx.lotterySeries.update({
        where: { id: seriesId },
        data: {
          status:          'DRAWN',
          isActive:        false,
          drawnAt:         new Date(),
          firstWinnerId:   picked[0].winner.id,
          firstTicket:     picked[0].ticket.ticketCode,
          secondWinnerId:  picked[1].winner.id,
          secondTicket:    picked[1].ticket.ticketCode,
          thirdWinnerId:   picked[2].winner.id,
          thirdTicket:     picked[2].ticket.ticketCode,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      type: 'REAL',
      winners: picked.map(({ tier, ticket, winner }) => ({
        tier,
        ticketCode: ticket.ticketCode,
        winnerName: winner.name,
        prize: PRIZE_BY_TIER[tier],
      })),
      totalPaid:   totalPrizes,
      totalRevenue,
      adminProfit: totalRevenue - totalPrizes,
    });
  }

  // ── FORCE DUMMY: house wins all 3 prizes (revenue too low) ──────────────
  if (action === 'force_dummy') {
    let dummy = await prisma.user.findFirst({ where: { email: DUMMY_USER_EMAIL } });
    if (!dummy) {
      const bcrypt = await import('bcryptjs');
      dummy = await prisma.user.create({
        data: {
          name: 'House Account',
          email: DUMMY_USER_EMAIL,
          passwordHash: await bcrypt.hash('dummy-house-' + Math.random(), 10),
          role: 'USER',
          wallet: { create: { balance: 0 } },
        },
      });
    }

    // Pick 3 random tickets (sold preferred) for cosmetic record
    const allTickets   = await prisma.lotteryTicket.findMany({ where: { seriesId } });
    const soldTickets  = allTickets.filter(t => t.isSold);
    const pool         = soldTickets.length >= 3 ? soldTickets : allTickets;
    const shuffled     = [...pool].sort(() => Math.random() - 0.5);
    const dummyTickets = shuffled.slice(0, 3);

    await prisma.$transaction(async tx => {
      // Credit total prize pool to dummy account
      await tx.wallet.update({
        where: { userId: dummy!.id },
        data: { balance: { increment: totalPrizes } },
      });

      // Mark all bets as LOST
      await tx.lotteryBet.updateMany({
        where: { seriesId, status: 'ACTIVE' },
        data: { status: 'LOST' },
      });

      await tx.lotterySeries.update({
        where: { id: seriesId },
        data: {
          status:         'DRAWN',
          isActive:       false,
          drawnAt:        new Date(),
          firstWinnerId:  dummy!.id,
          firstTicket:    dummyTickets[0]?.ticketCode ?? 'DUMMY-1',
          secondWinnerId: dummy!.id,
          secondTicket:   dummyTickets[1]?.ticketCode ?? 'DUMMY-2',
          thirdWinnerId:  dummy!.id,
          thirdTicket:    dummyTickets[2]?.ticketCode ?? 'DUMMY-3',
        },
      });
    });

    return NextResponse.json({
      ok: true,
      type: 'DUMMY',
      reason: `Revenue ₹${totalRevenue} < required ₹${commissionNeeded}`,
      winners: [
        { tier: 'first',  ticketCode: dummyTickets[0]?.ticketCode ?? 'DUMMY-1', prize: series.firstPrize },
        { tier: 'second', ticketCode: dummyTickets[1]?.ticketCode ?? 'DUMMY-2', prize: series.secondPrize },
        { tier: 'third',  ticketCode: dummyTickets[2]?.ticketCode ?? 'DUMMY-3', prize: series.thirdPrize },
      ],
      totalPrizes, totalRevenue,
      shortfall: isSafe ? 0 : commissionNeeded - totalRevenue,
    });
  }

  return NextResponse.json({ error: 'Invalid action. Use real_draw or force_dummy' }, { status: 400 });
}
