import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

const COMMISSION_PCT = 30;
const DUMMY_EMAIL    = 'dummy@supremegaming.in';

async function isAdmin(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return null;
  const u = await prisma.user.findUnique({ where: { id: p.sub }, select: { role: true } });
  return (u?.role === 'ADMIN' || u?.role === 'SUPERADMIN') ? p : null;
}

async function getDummyUser() {
  let dummy = await prisma.user.findFirst({ where: { email: DUMMY_EMAIL } });
  if (!dummy) {
    const bcrypt = await import('bcryptjs');
    dummy = await prisma.user.create({
      data: { name:'House Account', email:DUMMY_EMAIL, passwordHash: await bcrypt.hash('house-'+Date.now(),10), role:'USER', wallet:{create:{balance:0}} },
    });
  }
  const w = await prisma.wallet.findUnique({ where: { userId: dummy.id } });
  if (!w) await prisma.wallet.create({ data: { userId: dummy.id, balance: 0 } });
  return dummy;
}

// GET — eligibility check
export async function GET(req: NextRequest) {
  try {
    if (!await isAdmin(req)) return NextResponse.json({ error:'Forbidden' }, { status:403 });
    const { searchParams } = new URL(req.url);
    const seriesId = searchParams.get('seriesId');
    if (!seriesId) return NextResponse.json({ error:'seriesId required' }, { status:400 });

    const series = await prisma.lotterySeries.findUnique({
      where: { id: seriesId },
      include: { _count: { select: { tickets: true } } },
    });
    if (!series) return NextResponse.json({ error:'Series not found' }, { status:404 });

    const s          = series as any;
    const fp         = s.firstPrize  || Math.floor(s.prizePool * 0.6);
    const sp         = s.secondPrize || Math.floor(s.prizePool * 0.3);
    const tp         = s.thirdPrize  || (s.prizePool - Math.floor(s.prizePool*0.6) - Math.floor(s.prizePool*0.3));
    const totalPrizes = fp + sp + tp;

    const soldCount    = await prisma.lotteryTicket.count({ where: { seriesId, isSold: true } });
    const totalRevenue = soldCount * series.ticketPrice;
    const needed       = Math.ceil(totalPrizes * (1 + COMMISSION_PCT/100));
    const isSafe       = totalRevenue >= needed;

    return NextResponse.json({
      series: { id:series.id, name:series.name, prefix:series.prefix, firstPrize:fp, secondPrize:sp, thirdPrize:tp, ticketPrice:series.ticketPrice, status:series.status },
      soldCount, totalTickets: series._count.tickets,
      totalRevenue, totalPrizes, prizePool: totalPrizes,
      commissionNeeded: needed, commissionPercent: COMMISSION_PCT,
      isSafe, shortfall: isSafe ? 0 : needed - totalRevenue,
      adminProfit: isSafe ? totalRevenue - totalPrizes : 0,
      canDraw: soldCount >= 1,
    });
  } catch(e:any) {
    return NextResponse.json({ error: e.message }, { status:500 });
  }
}

// POST — execute draw
export async function POST(req: NextRequest) {
  try {
    if (!await isAdmin(req)) return NextResponse.json({ error:'Forbidden' }, { status:403 });

    const body = await req.json();
    const { seriesId, action, forcedTickets } = body;
    // forcedTickets = { first?: string, second?: string, third?: string }

    if (!seriesId) return NextResponse.json({ error:'seriesId required' }, { status:400 });

    const series = await prisma.lotterySeries.findUnique({ where: { id: seriesId } });
    if (!series) return NextResponse.json({ error:'Series not found' }, { status:404 });
    if (series.status === 'DRAWN') return NextResponse.json({ error:'Already drawn' }, { status:409 });

    const s          = series as any;
    const fp         = s.firstPrize  || Math.floor(s.prizePool * 0.6);
    const sp         = s.secondPrize || Math.floor(s.prizePool * 0.3);
    const tp         = s.thirdPrize  || (s.prizePool - Math.floor(s.prizePool*0.6) - Math.floor(s.prizePool*0.3));
    const totalPrizes = fp + sp + tp;

    const soldCount    = await prisma.lotteryTicket.count({ where: { seriesId, isSold: true } });
    const totalRevenue = soldCount * series.ticketPrice;
    const needed       = Math.ceil(totalPrizes * (1 + COMMISSION_PCT/100));
    const isSafe       = totalRevenue >= needed;

    const PRIZES = { first: fp, second: sp, third: tp };

    // ── REAL DRAW ────────────────────────────────────────────────────────────
    if (action === 'real_draw') {
      if (soldCount < 1) return NextResponse.json({ error:'No tickets sold' }, { status:400 });
      if (!isSafe) return NextResponse.json({ error:`Revenue ₹${totalRevenue} is below required ₹${needed}. Use Force Dummy.` }, { status:400 });

      const soldTickets = await prisma.lotteryTicket.findMany({
        where: { seriesId, isSold: true },
        include: { bets: { include: { user: { select: { id:true, name:true } } }, orderBy: { placedAt:'asc' }, take:1 } },
      });

      const picked: any[] = [];
      const usedIds       = new Set<string>();

      for (const tier of ['first','second','third'] as const) {
        const prize = PRIZES[tier];
        if (prize <= 0) continue;

        let ticket: any = null;
        const code = forcedTickets?.[tier];

        if (code) {
          // Admin manually specified a ticket — search by code (with or without prefix)
          const searchCode = code.toUpperCase();
          ticket = soldTickets.find(t =>
            t.ticketCode.toUpperCase() === searchCode && !usedIds.has(t.id)
          );
          if (!ticket) {
            // Try with prefix prepended
            const withPrefix = `${series.prefix}${searchCode}`.toUpperCase();
            ticket = soldTickets.find(t =>
              t.ticketCode.toUpperCase() === withPrefix && !usedIds.has(t.id)
            );
          }
          if (!ticket) {
            return NextResponse.json({
              error: `Ticket "${code}" for ${tier} prize not found among sold tickets. Check the ticket code and try again.`,
            }, { status:404 });
          }
        } else {
          // Random pick
          const remaining = soldTickets.filter(t => !usedIds.has(t.id));
          if (remaining.length === 0) break;
          ticket = remaining[Math.floor(Math.random() * remaining.length)];
        }

        usedIds.add(ticket.id);
        const winner = (ticket as any).bets?.[0]?.user;
        if (!winner) return NextResponse.json({ error:`Ticket ${ticket.ticketCode} has no buyer` }, { status:400 });
        picked.push({ tier, ticket, winner, prize });
      }

      if (picked.length === 0) return NextResponse.json({ error:'Could not pick any winners' }, { status:400 });

      await prisma.$transaction(async tx => {
        for (const { ticket, winner, prize, tier } of picked) {
          await tx.wallet.update({ where:{userId:winner.id}, data:{balance:{increment:prize},totalWon:{increment:prize}} });
          await tx.transaction.create({ data:{userId:winner.id,type:'WIN_CREDIT',status:'SUCCESS',coins:prize,amount:0,orderId:`LT-${tier.slice(0,1).toUpperCase()}-${seriesId.slice(-4)}-${Date.now()}`} });
          await tx.lotteryBet.updateMany({ where:{ticketId:ticket.id,status:'ACTIVE'}, data:{status:'WON',wonAmount:prize} });
          await tx.lotteryTicket.update({ where:{id:ticket.id}, data:{isWinner:true} });
        }
        await tx.lotteryBet.updateMany({ where:{seriesId,status:'ACTIVE'}, data:{status:'LOST'} });
        const wd:any = { status:'DRAWN', isActive:false, drawnAt:new Date() };
        if (picked[0]) { wd.firstWinnerId=picked[0].winner.id;  wd.firstTicket=picked[0].ticket.ticketCode; }
        if (picked[1]) { wd.secondWinnerId=picked[1].winner.id; wd.secondTicket=picked[1].ticket.ticketCode; }
        if (picked[2]) { wd.thirdWinnerId=picked[2].winner.id;  wd.thirdTicket=picked[2].ticket.ticketCode; }
        await tx.lotterySeries.update({ where:{id:seriesId}, data:wd });
      });

      return NextResponse.json({
        ok:true, type:'REAL',
        winners: picked.map(({ tier, ticket, winner, prize }) => ({
          tier, ticketCode: ticket.ticketCode, winnerName: winner.name, prize,
        })),
        totalPaid:   picked.reduce((s,x) => s+x.prize, 0),
        totalRevenue,
        adminProfit: totalRevenue - totalPrizes,
      });
    }

    // ── FORCE DUMMY ──────────────────────────────────────────────────────────
    if (action === 'force_dummy') {
      const dummy   = await getDummyUser();
      const allTix  = await prisma.lotteryTicket.findMany({ where: { seriesId } });
      const sold    = allTix.filter(t => t.isSold);
      const pool    = sold.length >= 3 ? sold : allTix;
      const dummyTix = [...pool].sort(() => Math.random()-0.5).slice(0,3);

      await prisma.$transaction(async tx => {
        if (totalPrizes > 0) await tx.wallet.update({ where:{userId:dummy.id}, data:{balance:{increment:totalPrizes}} });
        await tx.lotteryBet.updateMany({ where:{seriesId,status:'ACTIVE'}, data:{status:'LOST'} });
        await tx.lotterySeries.update({ where:{id:seriesId}, data:{
          status:'DRAWN', isActive:false, drawnAt:new Date(),
          firstWinnerId:dummy.id,  firstTicket:dummyTix[0]?.ticketCode??'DUMMY-1',
          secondWinnerId:dummy.id, secondTicket:dummyTix[1]?.ticketCode??'DUMMY-2',
          thirdWinnerId:dummy.id,  thirdTicket:dummyTix[2]?.ticketCode??'DUMMY-3',
        }});
      });

      return NextResponse.json({
        ok:true, type:'DUMMY',
        reason: `Revenue ₹${totalRevenue} < required ₹${needed}`,
        winners: [
          { tier:'1st', ticketCode:dummyTix[0]?.ticketCode??'DUMMY-1', prize:fp },
          { tier:'2nd', ticketCode:dummyTix[1]?.ticketCode??'DUMMY-2', prize:sp },
          { tier:'3rd', ticketCode:dummyTix[2]?.ticketCode??'DUMMY-3', prize:tp },
        ],
        totalPrizes, totalRevenue,
      });
    }

    return NextResponse.json({ error:'Invalid action. Use real_draw or force_dummy' }, { status:400 });
  } catch(e:any) {
    console.error('lottery-draw error:', e);
    return NextResponse.json({ error: e.message, detail: String(e) }, { status:500 });
  }
}