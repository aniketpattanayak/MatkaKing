// /api/admin/lottery-draw — picks 3 winners (1st, 2nd, 3rd), credits each,
// closes the series. Returns the real error message on failure for diagnosis.

import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

const COMMISSION_PERCENT = 30;
const DUMMY_USER_EMAIL   = 'dummy@supremegaming.in';

async function isAdmin(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return null;
  const u = await prisma.user.findUnique({ where: { id: p.sub }, select: { role: true, id: true } });
  return (u?.role === 'ADMIN' || u?.role === 'SUPERADMIN') ? p : null;
}

// ── GET: pre-draw eligibility check ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
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

    const soldCount = await prisma.lotteryTicket.count({ where: { seriesId, isSold: true } });

    const firstPrize  = (series as any).firstPrize  ?? Math.floor(series.prizePool * 0.6);
    const secondPrize = (series as any).secondPrize ?? Math.floor(series.prizePool * 0.3);
    const thirdPrize  = (series as any).thirdPrize  ?? (series.prizePool - Math.floor(series.prizePool * 0.6) - Math.floor(series.prizePool * 0.3));

    const totalPrizes      = firstPrize + secondPrize + thirdPrize;
    const totalRevenue     = soldCount * series.ticketPrice;
    const commissionNeeded = Math.ceil(totalPrizes * (1 + COMMISSION_PERCENT / 100));
    const isSafe           = totalRevenue >= commissionNeeded;

    return NextResponse.json({
      series: {
        id: series.id, name: series.name, prefix: series.prefix,
        firstPrize, secondPrize, thirdPrize,
        prizePool: totalPrizes, ticketPrice: series.ticketPrice, status: series.status,
      },
      soldCount,
      totalTickets:      series._count.tickets,
      totalRevenue,
      totalPrizes,
      prizePool:         totalPrizes,
      commissionNeeded,
      commissionPercent: COMMISSION_PERCENT,
      isSafe,
      shortfall:         isSafe ? 0 : commissionNeeded - totalRevenue,
      adminProfit:       isSafe ? totalRevenue - totalPrizes : 0,
      canDraw:           soldCount >= 1,
    });
  } catch (e: any) {
    console.error('lottery-draw GET error:', e);
    return NextResponse.json({ error: e.message ?? 'Server error', detail: String(e) }, { status: 500 });
  }
}

// ── POST: execute draw ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const p = await isAdmin(req);
    if (!p) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { seriesId, action, forcedTickets } = body;

    if (!seriesId) return NextResponse.json({ error: 'seriesId required' }, { status: 400 });

    const series = await prisma.lotterySeries.findUnique({ where: { id: seriesId } });
    if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    if (series.status === 'DRAWN') return NextResponse.json({ error: 'Winners already declared' }, { status: 409 });

    const firstPrize  = (series as any).firstPrize  ?? Math.floor(series.prizePool * 0.6);
    const secondPrize = (series as any).secondPrize ?? Math.floor(series.prizePool * 0.3);
    const thirdPrize  = (series as any).thirdPrize  ?? (series.prizePool - Math.floor(series.prizePool * 0.6) - Math.floor(series.prizePool * 0.3));
    const totalPrizes = firstPrize + secondPrize + thirdPrize;

    const soldCount        = await prisma.lotteryTicket.count({ where: { seriesId, isSold: true } });
    const totalRevenue     = soldCount * series.ticketPrice;
    const commissionNeeded = Math.ceil(totalPrizes * (1 + COMMISSION_PERCENT / 100));
    const isSafe           = totalRevenue >= commissionNeeded;

    const PRIZE_BY_TIER: Record<string, number> = { first: firstPrize, second: secondPrize, third: thirdPrize };

    // ── REAL DRAW ───────────────────────────────────────────────────────────
    if (action === 'real_draw') {
      if (soldCount < 1) return NextResponse.json({ error: 'No tickets sold yet' }, { status: 400 });
      if (!isSafe) {
        return NextResponse.json({
          error: `Revenue ₹${totalRevenue} is below required ₹${commissionNeeded}. Use Force Dummy instead.`,
        }, { status: 400 });
      }

      const soldTickets = await prisma.lotteryTicket.findMany({
        where: { seriesId, isSold: true },
        include: { bets: { include: { user: { select: { id: true, name: true } } }, orderBy: { placedAt: 'asc' }, take: 1 } },
      });

      if (soldTickets.length === 0) return NextResponse.json({ error: 'No sold tickets found' }, { status: 400 });

      // Pick up to 3 distinct winning tickets
      const codes = forcedTickets ?? {};
      const picked: { tier: string; ticket: any; winner: any }[] = [];
      const pickedIds = new Set<string>();
      const tiers = ['first', 'second', 'third'] as const;

      for (const tier of tiers) {
        if (PRIZE_BY_TIER[tier] <= 0) continue; // skip zero-value tiers
        let ticket: any = null;
        const code = codes[tier];
        if (code) {
          ticket = soldTickets.find(t => t.ticketCode.toUpperCase() === String(code).toUpperCase() && !pickedIds.has(t.id));
          if (!ticket) return NextResponse.json({ error: `Ticket ${code} for ${tier} prize not found or already used` }, { status: 404 });
        } else {
          const remaining = soldTickets.filter(t => !pickedIds.has(t.id));
          if (remaining.length === 0) break; // not enough distinct tickets — stop
          ticket = remaining[Math.floor(Math.random() * remaining.length)];
        }
        pickedIds.add(ticket.id);
        const winner = ticket.bets?.[0]?.user;
        if (!winner) return NextResponse.json({ error: `Ticket ${ticket.ticketCode} has no buyer` }, { status: 400 });
        picked.push({ tier, ticket, winner });
      }

      if (picked.length === 0) return NextResponse.json({ error: 'Could not pick any winners' }, { status: 400 });

      await prisma.$transaction(async tx => {
        for (const { tier, ticket, winner } of picked) {
          const prize = PRIZE_BY_TIER[tier];
          await tx.wallet.update({
            where: { userId: winner.id },
            data: { balance: { increment: prize }, totalWon: { increment: prize } },
          });
          await tx.transaction.create({
            data: {
              userId: winner.id, type: 'WIN_CREDIT', status: 'SUCCESS',
              coins: prize, amount: 0,
              orderId: `LT-${tier.slice(0,1).toUpperCase()}-${series.id.slice(-4)}-${Date.now()}`,
            },
          });
          await tx.lotteryBet.updateMany({
            where: { ticketId: ticket.id, status: 'ACTIVE' },
            data: { status: 'WON', wonAmount: prize },
          });
          await tx.lotteryTicket.update({ where: { id: ticket.id }, data: { isWinner: true } });
        }

        await tx.lotteryBet.updateMany({
          where: { seriesId, status: 'ACTIVE' },
          data: { status: 'LOST' },
        });

        // Build winner-column update defensively (only set columns that exist)
        const winnerData: any = { status: 'DRAWN', isActive: false };
        if (picked[0]) { winnerData.firstWinnerId  = picked[0].winner.id; winnerData.firstTicket  = picked[0].ticket.ticketCode; }
        if (picked[1]) { winnerData.secondWinnerId = picked[1].winner.id; winnerData.secondTicket = picked[1].ticket.ticketCode; }
        if (picked[2]) { winnerData.thirdWinnerId  = picked[2].winner.id; winnerData.thirdTicket  = picked[2].ticket.ticketCode; }
        try { winnerData.drawnAt = new Date(); } catch {}

        await tx.lotterySeries.update({ where: { id: seriesId }, data: winnerData });
      });

      return NextResponse.json({
        ok: true, type: 'REAL',
        winners: picked.map(({ tier, ticket, winner }) => ({
          tier, ticketCode: ticket.ticketCode, winnerName: winner.name, prize: PRIZE_BY_TIER[tier],
        })),
        totalPaid: picked.reduce((s, x) => s + PRIZE_BY_TIER[x.tier], 0),
        totalRevenue,
        adminProfit: totalRevenue - totalPrizes,
      });
    }

    // ── FORCE DUMMY ─────────────────────────────────────────────────────────
    if (action === 'force_dummy') {
      let dummy = await prisma.user.findFirst({ where: { email: DUMMY_USER_EMAIL } });
      if (!dummy) {
        const bcrypt = await import('bcryptjs');
        const hash = await bcrypt.hash('house-' + Date.now(), 10);
        dummy = await prisma.user.create({
          data: {
            name: 'House Account',
            email: DUMMY_USER_EMAIL,
            passwordHash: hash,
            role: 'USER',
            wallet: { create: { balance: 0 } },
          },
        });
      }
      // ensure dummy has a wallet
      const dwallet = await prisma.wallet.findUnique({ where: { userId: dummy.id } });
      if (!dwallet) await prisma.wallet.create({ data: { userId: dummy.id, balance: 0 } });

      const allTickets   = await prisma.lotteryTicket.findMany({ where: { seriesId } });
      const sold         = allTickets.filter(t => t.isSold);
      const pool         = sold.length >= 3 ? sold : allTickets;
      const shuffled     = [...pool].sort(() => Math.random() - 0.5);
      const dummyTickets = shuffled.slice(0, 3);

      await prisma.$transaction(async tx => {
        await tx.wallet.update({ where: { userId: dummy!.id }, data: { balance: { increment: totalPrizes } } });
        await tx.lotteryBet.updateMany({ where: { seriesId, status: 'ACTIVE' }, data: { status: 'LOST' } });

        const winnerData: any = { status: 'DRAWN', isActive: false };
        winnerData.firstWinnerId  = dummy!.id; winnerData.firstTicket  = dummyTickets[0]?.ticketCode ?? 'DUMMY-1';
        winnerData.secondWinnerId = dummy!.id; winnerData.secondTicket = dummyTickets[1]?.ticketCode ?? 'DUMMY-2';
        winnerData.thirdWinnerId  = dummy!.id; winnerData.thirdTicket  = dummyTickets[2]?.ticketCode ?? 'DUMMY-3';
        try { winnerData.drawnAt = new Date(); } catch {}

        await tx.lotterySeries.update({ where: { id: seriesId }, data: winnerData });
      });

      return NextResponse.json({
        ok: true, type: 'DUMMY',
        reason: `Revenue ₹${totalRevenue} < required ₹${commissionNeeded}`,
        winners: [
          { tier: 'first',  ticketCode: dummyTickets[0]?.ticketCode ?? 'DUMMY-1', prize: firstPrize },
          { tier: 'second', ticketCode: dummyTickets[1]?.ticketCode ?? 'DUMMY-2', prize: secondPrize },
          { tier: 'third',  ticketCode: dummyTickets[2]?.ticketCode ?? 'DUMMY-3', prize: thirdPrize },
        ],
        totalPrizes, totalRevenue,
        shortfall: isSafe ? 0 : commissionNeeded - totalRevenue,
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use real_draw or force_dummy' }, { status: 400 });
  } catch (e: any) {
    console.error('lottery-draw POST error:', e);
    return NextResponse.json({ error: e.message ?? 'Draw failed', detail: String(e) }, { status: 500 });
  }
}
