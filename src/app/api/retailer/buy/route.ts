import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

function json(data: any, status = 200) { return NextResponse.json(data, { status }); }

export async function POST(req: NextRequest) {
  try {
    const p = verifyToken(req);
    if (!p) return json({ error: 'Unauthorized' }, 401);
    const retailerUser = await prisma.user.findUnique({ where: { id: p.sub }, include: { retailer: true } });
    if (!retailerUser || retailerUser.role !== 'RETAILER' || !retailerUser.retailer)
      return json({ error: 'Only retailers can use this endpoint' }, 403);
    if (!retailerUser.retailer.isActive)
      return json({ error: 'Your retailer account is inactive. Contact admin.' }, 403);
    const retailer = retailerUser.retailer;
    const { seriesId, ticketCodes, quantity, customerPhone } = await req.json();
    if (!seriesId || !customerPhone) return json({ error: 'seriesId and customerPhone required' }, 400);
    const customer = await prisma.user.findFirst({ where: { phone: customerPhone } });
    if (!customer) return json({ error: `No user found with phone ${customerPhone}` }, 404);
    const series = await prisma.lotterySeries.findUnique({ where: { id: seriesId } });
    if (!series) return json({ error: 'Series not found' }, 404);
    if (series.status !== 'OPEN') return json({ error: 'Series is closed' }, 400);
    let ticketsToBook;
    if (ticketCodes?.length > 0) {
      ticketsToBook = await prisma.lotteryTicket.findMany({ where: { ticketCode: { in: ticketCodes }, seriesId, isSold: false } });
      if (ticketsToBook.length !== ticketCodes.length) return json({ error: 'Some tickets already sold' }, 409);
    } else {
      const qty = Math.min(Math.max(Number(quantity) || 1, 1), 500);
      ticketsToBook = await prisma.lotteryTicket.findMany({ where: { seriesId, isSold: false }, take: qty });
      if (ticketsToBook.length === 0) return json({ error: 'No tickets available' }, 404);
    }
    const totalCost = ticketsToBook.length * series.ticketPrice;
    const commission = Math.floor(totalCost * retailer.commissionPct / 100);
    const retailerWallet = await prisma.wallet.findUnique({ where: { userId: retailerUser.id } });
    if (!retailerWallet || retailerWallet.balance < totalCost)
      return json({ error: `Insufficient balance. Need Rs.${totalCost}, have Rs.${retailerWallet?.balance ?? 0}` }, 402);
    const ticketIdList = ticketsToBook.map((t: any) => t.id);
    await Promise.all([
      prisma.wallet.update({ where: { userId: retailerUser.id }, data: { balance: { decrement: totalCost } } }),
      prisma.lotteryTicket.updateMany({ where: { id: { in: ticketIdList } }, data: { isSold: true } }),
      ...ticketsToBook.map((t: any) =>
        prisma.lotteryBet.create({ data: { userId: customer.id, seriesId, ticketId: t.id, retailerId: retailer.id, amountPaid: series.ticketPrice, status: 'ACTIVE' } })
      ),
      prisma.transaction.create({ data: { userId: retailerUser.id, type: 'BET_DEBIT', status: 'SUCCESS', amount: totalCost, coins: totalCost, orderId: `RT-${seriesId.slice(-6)}-${Date.now()}` } }),
    ]);
    if (commission > 0) {
      await prisma.wallet.update({ where: { userId: retailerUser.id }, data: { balance: { increment: commission }, totalWon: { increment: commission } } });
      await prisma.transaction.create({ data: { userId: retailerUser.id, type: 'WIN_CREDIT', status: 'SUCCESS', amount: 0, coins: commission, orderId: `RC-${Date.now()}-${Math.random().toString(36).slice(2,5)}` } });
    }
    await prisma.retailer.update({ where: { id: retailer.id }, data: { totalSales: { increment: ticketsToBook.length }, totalCommission: { increment: commission } } });
    return json({ ok: true, tickets: ticketsToBook.map((t: any) => t.ticketCode), count: ticketsToBook.length, totalCost, commission, customer: { name: customer.name, phone: customer.phone }, newBalance: (retailerWallet.balance - totalCost) + commission });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}

export async function GET(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return json({ error: 'Unauthorized' }, 401);
  const retailerUser = await prisma.user.findUnique({ where: { id: p.sub }, include: { retailer: true } });
  if (!retailerUser?.retailer) return json({ error: 'Not a retailer' }, 403);
  const retailer = retailerUser.retailer;
  const [recentSales, wallet] = await Promise.all([
    prisma.lotteryBet.findMany({
      where: { retailerId: retailer.id },
      orderBy: { placedAt: 'desc' },
      take: 50,
      include: {
        ticket: { select: { ticketCode: true } },
        series: { select: { name: true, drawAt: true, status: true } },
        user: { select: { name: true, phone: true } },
      },
    }),
    prisma.wallet.findUnique({ where: { userId: p.sub }, select: { balance: true } }),
  ]);
  return json({ retailer: { name: retailer.name, code: retailer.code, commissionPct: retailer.commissionPct, totalSales: retailer.totalSales, totalCommission: retailer.totalCommission }, walletBalance: wallet?.balance ?? 0, recentSales });
}
