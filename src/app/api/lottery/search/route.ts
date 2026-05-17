import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seriesId = searchParams.get('seriesId') ?? '';
  const q = searchParams.get('q') ?? '';
  const limit = parseInt(searchParams.get('limit') ?? '60');

  try {
    const tickets = await prisma.lotteryTicket.findMany({
      where: {
        seriesId,
        ...(q ? { ticketCode: { contains: q.toUpperCase() } } : {}),
      },
      take: limit,
      orderBy: { ticketCode: 'asc' },
      select: { id: true, ticketCode: true, isSold: true, price: true },
    });
    return NextResponse.json({ tickets: tickets.map(t => ({ ticketId: t.id, ticketCode: t.ticketCode, isSold: t.isSold, price: t.price })) });
  } catch {
    return NextResponse.json({ tickets: [] });
  }
}

export async function POST(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { seriesId, ticketIds, quantity } = await req.json();

  try {
    const series = await prisma.lotterySeries.findUnique({ where: { id: seriesId } });
    if (!series || series.status !== 'OPEN') return NextResponse.json({ error: 'Series not open' }, { status: 400 });

    const wallet = await prisma.wallet.findUnique({ where: { userId: p.sub } });
    const qty = quantity ?? ticketIds?.length ?? 0;
    const cost = qty * series.ticketPrice;

    if (!wallet || wallet.balance < cost)
      return NextResponse.json({ error: `Insufficient coins. Need ${cost}, have ${wallet?.balance ?? 0}` }, { status: 402 });

    // Buy tickets atomically
    const result = await prisma.$transaction(async (tx) => {
      const available = await tx.lotteryTicket.findMany({
        where: { seriesId, isSold: false, ...(ticketIds ? { id: { in: ticketIds } } : {}) },
        take: qty,
      });

      if (available.length < qty) throw new Error('Not enough tickets available');

      await tx.lotteryTicket.updateMany({ where: { id: { in: available.map(t => t.id) } }, data: { isSold: true, soldAt: new Date() } });
      await tx.lotteryBet.createMany({ data: available.map(t => ({ userId: p.sub, ticketId: t.id, amount: series.ticketPrice })) });
      await tx.wallet.update({ where: { userId: p.sub }, data: { balance: { decrement: cost } } });
      await tx.transaction.create({ data: { userId: p.sub, type: 'BET_DEBIT', status: 'SUCCESS', amount: cost, coins: cost, orderId: `LT-${Date.now()}` } });

      return available;
    });

    return NextResponse.json({ success: true, tickets: result.map(t => t.ticketCode), cost });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
