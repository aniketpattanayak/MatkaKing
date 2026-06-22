// /api/cron/lottery-autodraw
// Runs daily. Finds any OPEN lottery series whose drawAt has passed,
// then auto-draws (real if profitable, dummy if not, closes if 0 tickets sold).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

const COMMISSION_PCT  = 30;
const DUMMY_EMAIL     = 'dummy@supremegaming.in';
const CLOSE_IF_MINS   = 5; // draw if drawAt was at least 5 mins ago

async function getDummyUser() {
  let dummy = await prisma.user.findFirst({ where: { email: DUMMY_EMAIL } });
  if (!dummy) {
    const bcrypt = await import('bcryptjs');
    dummy = await prisma.user.create({
      data: {
        name: 'House Account', email: DUMMY_EMAIL,
        passwordHash: await bcrypt.hash('house-' + Date.now(), 10),
        role: 'USER',
        wallet: { create: { balance: 0 } },
      },
    });
  }
  const w = await prisma.wallet.findUnique({ where: { userId: dummy.id } });
  if (!w) await prisma.wallet.create({ data: { userId: dummy.id, balance: 0 } });
  return dummy;
}

export async function GET(req: NextRequest) {
  // Allow Vercel cron + manual trigger with secret
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now       = new Date();
  const threshold = new Date(now.getTime() - CLOSE_IF_MINS * 60 * 1000);

  // Find OPEN series whose draw time has passed by at least CLOSE_IF_MINS
  const dueSeries = await prisma.lotterySeries.findMany({
    where: { status: 'OPEN', isActive: true, drawAt: { lte: threshold } },
  });

  if (dueSeries.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No overdue series' });
  }

  const results = [];

  for (const series of dueSeries) {
    try {
      const s = series as any;
      const fp = s.firstPrize  ?? Math.floor(s.prizePool * 0.6);
      const sp = s.secondPrize ?? Math.floor(s.prizePool * 0.3);
      const tp = s.thirdPrize  ?? (s.prizePool - Math.floor(s.prizePool * 0.6) - Math.floor(s.prizePool * 0.3));
      const totalPrizes   = fp + sp + tp;
      const soldCount     = await prisma.lotteryTicket.count({ where: { seriesId: s.id, isSold: true } });
      const totalRevenue  = soldCount * s.ticketPrice;
      const needed        = Math.ceil(totalPrizes * (1 + COMMISSION_PCT / 100));
      const isSafe        = totalRevenue >= needed;

      // No tickets sold — just close silently
      if (soldCount === 0) {
        await prisma.lotterySeries.update({ where: { id: s.id }, data: { status: 'DRAWN', isActive: false, drawnAt: now } });
        results.push({ series: s.name, action: 'CLOSED_NO_SALES' });
        continue;
      }

      if (isSafe) {
        // REAL DRAW
        const soldTickets = await prisma.lotteryTicket.findMany({
          where: { seriesId: s.id, isSold: true },
          include: { bets: { include: { user: { select: { id: true, name: true } } }, orderBy: { placedAt: 'asc' }, take: 1 } },
        });

        const prizes  = [{ tier: 'first', prize: fp }, { tier: 'second', prize: sp }, { tier: 'third', prize: tp }];
        const picked: any[] = [];
        const usedIds = new Set<string>();

        for (const { tier, prize } of prizes) {
          if (prize <= 0) continue;
          const rem = soldTickets.filter(t => !usedIds.has(t.id));
          if (rem.length === 0) break;
          const ticket = rem[Math.floor(Math.random() * rem.length)];
          const winner = (ticket as any).bets?.[0]?.user;
          if (!winner) continue;
          usedIds.add(ticket.id);
          picked.push({ tier, ticket, winner, prize });
        }

        await prisma.$transaction(async tx => {
          for (const { ticket, winner, prize, tier } of picked) {
            await tx.wallet.update({ where: { userId: winner.id }, data: { balance: { increment: prize }, totalWon: { increment: prize } } });
            await tx.transaction.create({ data: { userId: winner.id, type: 'WIN_CREDIT', status: 'SUCCESS', coins: prize, amount: 0, orderId: `LT-AUTO-${tier.slice(0,1).toUpperCase()}-${Date.now()}` } });
            await tx.lotteryBet.updateMany({ where: { ticketId: ticket.id, status: 'ACTIVE' }, data: { status: 'WON', wonAmount: prize } });
            await tx.lotteryTicket.update({ where: { id: ticket.id }, data: { isWinner: true } });
          }
          await tx.lotteryBet.updateMany({ where: { seriesId: s.id, status: 'ACTIVE' }, data: { status: 'LOST' } });
          const wd: any = { status: 'DRAWN', isActive: false, drawnAt: now };
          if (picked[0]) { wd.firstWinnerId = picked[0].winner.id;  wd.firstTicket  = picked[0].ticket.ticketCode; }
          if (picked[1]) { wd.secondWinnerId = picked[1].winner.id; wd.secondTicket = picked[1].ticket.ticketCode; }
          if (picked[2]) { wd.thirdWinnerId = picked[2].winner.id;  wd.thirdTicket  = picked[2].ticket.ticketCode; }
          await tx.lotterySeries.update({ where: { id: s.id }, data: wd });
        });

        results.push({ series: s.name, action: 'REAL_DRAW', winners: picked.map(p => p.ticket.ticketCode) });
      } else {
        // DUMMY DRAW
        const dummy   = await getDummyUser();
        const allTix  = await prisma.lotteryTicket.findMany({ where: { seriesId: s.id } });
        const sold    = allTix.filter(t => t.isSold);
        const pool    = sold.length >= 3 ? sold : allTix;
        const dummyTix = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);

        await prisma.$transaction(async tx => {
          await tx.wallet.update({ where: { userId: dummy.id }, data: { balance: { increment: totalPrizes } } });
          await tx.lotteryBet.updateMany({ where: { seriesId: s.id, status: 'ACTIVE' }, data: { status: 'LOST' } });
          await tx.lotterySeries.update({ where: { id: s.id }, data: {
            status: 'DRAWN', isActive: false, drawnAt: now,
            firstWinnerId: dummy.id,  firstTicket:  dummyTix[0]?.ticketCode ?? 'DUMMY-1',
            secondWinnerId: dummy.id, secondTicket: dummyTix[1]?.ticketCode ?? 'DUMMY-2',
            thirdWinnerId: dummy.id,  thirdTicket:  dummyTix[2]?.ticketCode ?? 'DUMMY-3',
          }});
        });

        results.push({ series: s.name, action: 'DUMMY_DRAW', reason: `Revenue ₹${totalRevenue} < needed ₹${needed}` });
      }
    } catch (e: any) {
      results.push({ series: series.name, action: 'ERROR', error: e.message });
    }
  }

  return NextResponse.json({ ok: true, processed: dueSeries.length, results });
}
