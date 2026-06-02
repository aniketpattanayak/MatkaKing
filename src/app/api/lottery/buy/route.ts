import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

export async function POST(req: NextRequest) {
  try {
    const p = verifyToken(req);
    if (!p) return NextResponse.json({ error: 'Please login first' }, { status: 401 });

    const { seriesId, ticketCodes, quantity } = await req.json();
    if (!seriesId) return NextResponse.json({ error: 'seriesId required' }, { status: 400 });

    const userId = p.sub;

    // Get series
    const series = await prisma.lotterySeries.findUnique({ where: { id: seriesId } });
    if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    if (series.status !== 'OPEN') return NextResponse.json({ error: 'Series is closed' }, { status: 400 });

    // Get tickets to buy
    let ticketsToBook;
    if (ticketCodes?.length > 0) {
      // User selected specific tickets by code (e.g. BT0029)
      ticketsToBook = await prisma.lotteryTicket.findMany({
        where: { ticketCode: { in: ticketCodes }, seriesId, isSold: false },
      });
      if (ticketsToBook.length === 0)
        return NextResponse.json({ error: 'These tickets are already sold or not found' }, { status: 409 });
      if (ticketsToBook.length !== ticketCodes.length) {
        const foundCodes = ticketsToBook.map((t: any) => t.ticketCode);
        const alreadySold = ticketCodes.filter((c: string) => !foundCodes.includes(c));
        return NextResponse.json({ error: `Tickets already sold: ${alreadySold.join(', ')}` }, { status: 409 });
      }
    } else {
      // Quick buy — pick random available tickets
      const qty = Math.min(Math.max(Number(quantity) || 1, 1), 10000);
      ticketsToBook = await prisma.lotteryTicket.findMany({
        where: { seriesId, isSold: false },
        take: qty,
      });
      if (ticketsToBook.length === 0)
        return NextResponse.json({ error: 'No tickets available in this series' }, { status: 404 });
    }

    const totalCost = ticketsToBook.length * series.ticketPrice;

    // Check wallet balance
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < totalCost)
      return NextResponse.json({
        error: `Insufficient coins. Need ${totalCost}, have ${wallet?.balance ?? 0}`,
        required: totalCost,
        current: wallet?.balance ?? 0,
      }, { status: 402 });

    const ticketIdList = ticketsToBook.map((t: any) => t.id);

    // Atomic transaction
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId },
        data: { balance: { decrement: totalCost } },
      }),
      prisma.lotteryTicket.updateMany({
        where: { id: { in: ticketIdList } },
        data: { isSold: true },
      }),
      ...ticketsToBook.map((t: any) =>
        prisma.lotteryBet.create({
          data: {
            userId,
            seriesId,
            ticketId:   t.id,
            amountPaid: series.ticketPrice,
            status:     'ACTIVE',
          },
        })
      ),
      prisma.transaction.create({
        data: {
          userId,
          type:    'BET_DEBIT',
          status:  'SUCCESS',
          amount:  totalCost,
          coins:   totalCost,
          orderId: `LT-${seriesId.slice(-6)}-${Date.now()}`,
        },
      }),
    ]);

    return NextResponse.json({
      ok:            true,
      tickets:       ticketsToBook.map((t: any) => t.ticketCode),
      count:         ticketsToBook.length,
      totalCost,
      coinsDeducted: totalCost,
      newBalance:    wallet.balance - totalCost,
    });

  } catch (e: any) {
    console.error('lottery buy error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
