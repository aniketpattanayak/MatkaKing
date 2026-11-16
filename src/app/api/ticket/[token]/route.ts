import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

// Public route — no auth required
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { token } = params;
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const bet = await prisma.lotteryBet.findUnique({
      where: { shareToken: token },
      include: {
        ticket:  { select: { ticketCode: true, isWinner: true } },
        series:  { select: { name: true, drawAt: true, status: true, prizePool: true, firstPrize: true, secondPrize: true, thirdPrize: true, firstTicket: true, secondTicket: true, thirdTicket: true } },
        retailer:{ select: { name: true, code: true } },
      },
    });

    if (!bet) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const ticketCode = bet.ticket?.ticketCode ?? '';
    const isWinner   = bet.ticket?.isWinner ?? false;
    const series     = bet.series;
    const drawn      = series?.status === 'DRAWN';

    let prizeRank: number | null = null;
    if (drawn && ticketCode) {
      if (series.firstTicket  === ticketCode) prizeRank = 1;
      else if (series.secondTicket === ticketCode) prizeRank = 2;
      else if (series.thirdTicket  === ticketCode) prizeRank = 3;
    }

    return NextResponse.json({
      ok: true,
      ticket: {
        ticketCode,
        status:    bet.status,
        wonAmount: bet.wonAmount,
        amountPaid: bet.amountPaid,
        placedAt:  bet.placedAt,
        isWinner,
        prizeRank,
        series: {
          name:       series?.name,
          drawAt:     series?.drawAt,
          status:     series?.status,
          prizePool:  series?.prizePool,
          firstPrize: series?.firstPrize,
          secondPrize:series?.secondPrize,
          thirdPrize: series?.thirdPrize,
        },
        retailer: bet.retailer ? {
          name: bet.retailer.name,
          code: bet.retailer.code,
        } : null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
