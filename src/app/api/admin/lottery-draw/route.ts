import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

const COMMISSION_PERCENT = 30; // admin keeps 30% on top of prize pool
const DUMMY_USER_EMAIL   = 'dummy@supremegaming.in'; // house account

async function isAdmin(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return null;
  const u = await prisma.user.findUnique({ where: { id: p.sub }, select: { role: true, id: true } });
  return (u?.role === 'ADMIN' || u?.role === 'SUPERADMIN') ? p : null;
}

// ── GET: check draw eligibility for a series ──────────────────────────────────
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

  // Count sold tickets and revenue
  const soldTickets = await prisma.lotteryTicket.findMany({
    where: { seriesId, isSold: true },
    select: { id: true, ticketCode: true },
  });

  const totalRevenue    = soldTickets.length * series.ticketPrice;
  const prizePool       = series.prizePool;
  const commissionNeeded= Math.ceil(prizePool * (1 + COMMISSION_PERCENT / 100));
  const isSafe          = totalRevenue >= commissionNeeded;
  const shortfall       = isSafe ? 0 : commissionNeeded - totalRevenue;
  const adminProfit     = isSafe ? totalRevenue - prizePool : 0;

  return NextResponse.json({
    series: {
      id: series.id, name: series.name, prefix: series.prefix,
      prizePool, ticketPrice: series.ticketPrice, status: series.status,
    },
    soldCount:        soldTickets.length,
    totalTickets:     series._count.tickets,
    totalRevenue,
    prizePool,
    commissionNeeded,
    commissionPercent: COMMISSION_PERCENT,
    isSafe,
    shortfall,
    adminProfit,
    soldTickets: soldTickets.slice(0, 5), // preview
  });
}

// ── POST: execute draw ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const p = await isAdmin(req);
  if (!p) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { seriesId, action, forcedTicketCode } = await req.json();
  // action = 'check' | 'real_draw' | 'force_dummy'

  if (!seriesId) return NextResponse.json({ error: 'seriesId required' }, { status: 400 });

  const series = await prisma.lotterySeries.findUnique({ where: { id: seriesId } });
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 });
  if (series.status === 'DRAWN') return NextResponse.json({ error: 'Winner already declared' }, { status: 409 });

  // Calculate revenue
  const soldCount   = await prisma.lotteryTicket.count({ where: { seriesId, isSold: true } });
  const totalRevenue = soldCount * series.ticketPrice;
  const commissionNeeded = Math.ceil(series.prizePool * (1 + COMMISSION_PERCENT / 100));
  const isSafe = totalRevenue >= commissionNeeded;

  // ── REAL DRAW ──────────────────────────────────────────────────────────────
  if (action === 'real_draw') {
    if (!isSafe) {
      return NextResponse.json({
        error: `Cannot do real draw. Revenue ₹${totalRevenue} is less than required ₹${commissionNeeded}. Use Force Dummy instead.`,
      }, { status: 400 });
    }

    // Pick winner ticket
    let winnerTicket;
    if (forcedTicketCode) {
      // Admin manually entered a ticket
      winnerTicket = await prisma.lotteryTicket.findFirst({
        where: { seriesId, ticketCode: forcedTicketCode.toUpperCase(), isSold: true },
        include: { bets: { include: { user: { select: { id: true, name: true, email: true, wallet: true } } } } },
      });
      if (!winnerTicket) return NextResponse.json({ error: `Ticket ${forcedTicketCode} not found or not sold` }, { status: 404 });
    } else {
      // Random pick from sold tickets
      const soldTickets = await prisma.lotteryTicket.findMany({
        where: { seriesId, isSold: true },
        include: { bets: { include: { user: { select: { id: true, name: true, email: true, wallet: true } } } } },
      });
      if (soldTickets.length === 0) return NextResponse.json({ error: 'No sold tickets to draw from' }, { status: 400 });
      winnerTicket = soldTickets[Math.floor(Math.random() * soldTickets.length)];
    }

    const winner = winnerTicket.bets?.[0]?.user;
    if (!winner) return NextResponse.json({ error: 'Could not find ticket buyer' }, { status: 400 });

    // Credit prize pool to winner + close series
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: winner.id },
        data: { balance: { increment: series.prizePool }, totalWon: { increment: series.prizePool } },
      }),
      prisma.transaction.create({
        data: {
          userId: winner.id,
          type: 'WIN_CREDIT',
          status: 'SUCCESS',
          coins: series.prizePool,
          amount: 0,
          orderId: `LT-WIN-${series.id}-${Date.now()}`,
        },
      }),
      prisma.lotterySeries.update({
        where: { id: seriesId },
        data: { status: 'DRAWN', winnerId: winner.id, winnerTicket: winnerTicket.ticketCode },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      type: 'REAL',
      winnerTicket: winnerTicket.ticketCode,
      winner: { name: winner.name, email: winner.email },
      prizeAwarded: series.prizePool,
      adminProfit: totalRevenue - series.prizePool,
    });
  }

  // ── FORCE DUMMY (admin chose dummy manually) ───────────────────────────────
  if (action === 'force_dummy' || (!isSafe && action === 'auto_dummy')) {
    // Find or create dummy account
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

    // Pick a random SOLD ticket (or unsold if none sold — show it's dummy)
    const allTickets  = await prisma.lotteryTicket.findMany({ where: { seriesId }, take: 1000 });
    const soldTickets = allTickets.filter(t => t.isSold);
    const pool        = soldTickets.length > 0 ? soldTickets : allTickets;
    const dummyTicket = pool[Math.floor(Math.random() * pool.length)];

    const isDummyForced = action === 'force_dummy';
    const reason        = isDummyForced ? 'Admin chose dummy draw' : `Revenue ₹${totalRevenue} < required ₹${commissionNeeded}`;

    // Credit prize pool to dummy wallet + close series
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: dummy.id },
        data: { balance: { increment: series.prizePool } },
      }),
      prisma.lotterySeries.update({
        where: { id: seriesId },
        data: {
          status: 'DRAWN',
          winnerId: dummy.id,
          winnerTicket: dummyTicket?.ticketCode ?? 'DUMMY',
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      type: 'DUMMY',
      isDummyForced,
      reason,
      winnerTicket: dummyTicket?.ticketCode ?? 'DUMMY',
      prizePool: series.prizePool,
      totalRevenue,
      shortfall: isSafe ? 0 : commissionNeeded - totalRevenue,
    });
  }

  return NextResponse.json({ error: 'Invalid action. Use real_draw, force_dummy, or auto_dummy' }, { status: 400 });
}
