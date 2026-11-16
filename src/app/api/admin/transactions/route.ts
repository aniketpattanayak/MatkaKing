import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const type   = searchParams.get('type') ?? 'ALL';
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);
  const offset = parseInt(searchParams.get('offset') ?? '0');
  try {
    const where: any = {};
    if (type !== 'ALL') where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          user:    { select: { id:true, name:true, email:true } },
          upiPool: { select: { upiId:true, label:true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit, skip: offset,
      }),
      prisma.transaction.count({ where }),
    ]);

    const upis = await prisma.upiPool.findMany({
      select: { id:true, upiId:true, label:true, isActive:true },
    });

    const upiDeposits = await prisma.transaction.groupBy({
      by: ['upiPoolId'],
      where: { type: 'DEPOSIT', status: 'SUCCESS', upiPoolId: { not: null } },
      _sum: { coins: true, amount: true },
      _count: true,
    });

    const upiMap = Object.fromEntries(upiDeposits.map(d => [d.upiPoolId!, d]));
    const upiStats = upis.map(u => ({
      upiId:       u.upiId,
      label:       u.label,
      isActive:    u.isActive,
      count:       upiMap[u.id]?._count ?? 0,
      totalAmount: upiMap[u.id]?._sum?.amount ?? upiMap[u.id]?._sum?.coins ?? 0,
    }));

    const stats = await prisma.transaction.groupBy({
      by: ['type'],
      _sum: { coins: true, amount: true },
      _count: true,
    });

    return NextResponse.json({ transactions, total, upiStats, stats });
  } catch (e: any) {
    console.error('transactions error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Admin confirms a transaction (deposit, lottery UPI, etc.)
export async function PATCH(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { txnId, status } = await req.json();
  if (!txnId) return NextResponse.json({ error: 'txnId required' }, { status: 400 });
  try {
    const txn = await prisma.transaction.findUnique({ where: { id: txnId } });
    if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

    const finalStatus = status ?? 'SUCCESS';

    // Check if this is a Lottery UPI order (direct ticket purchase, not wallet top-up)
    let lotteryMeta: any = null;
    try {
      const parsed = JSON.parse(txn.webhookPayload ?? '{}');
      if (parsed.type === 'LOTTERY_UPI') lotteryMeta = parsed;
    } catch {}

    if (lotteryMeta && finalStatus === 'SUCCESS') {
      // Issue lottery tickets — do NOT credit wallet
      const { seriesId, ticketIds, ticketCodes, amountPerTicket } = lotteryMeta;

      // Check tickets are still available
      const availableTickets = await prisma.lotteryTicket.findMany({
        where: { id: { in: ticketIds }, isSold: false },
      });

      if (availableTickets.length === 0) {
        // All tickets sold — refund by crediting wallet instead
        await Promise.all([
          prisma.transaction.update({ where: { id: txnId }, data: { status: 'REFUNDED', failureReason: 'Tickets already sold' } }),
          prisma.wallet.update({ where: { userId: txn.userId }, data: { balance: { increment: txn.amount }, totalDeposit: { increment: txn.amount } } }),
        ]);
        return NextResponse.json({ ok: true, refunded: true, reason: 'Tickets already sold — amount credited to wallet' });
      }

      // Issue available tickets
      const issuedTicketIds = availableTickets.map((t: any) => t.id);
      await prisma.$transaction([
        prisma.transaction.update({ where: { id: txnId }, data: { status: 'SUCCESS', coins: txn.amount, processedAt: new Date() } }),
        prisma.lotteryTicket.updateMany({ where: { id: { in: issuedTicketIds } }, data: { isSold: true } }),
        ...availableTickets.map((t: any) =>
          prisma.lotteryBet.create({
            data: { userId: txn.userId, seriesId, ticketId: t.id, amountPaid: amountPerTicket, status: 'ACTIVE' },
          })
        ),
      ]);

      const issuedCodes = availableTickets.map((t: any) => t.ticketCode);
      return NextResponse.json({ ok: true, lotteryIssued: true, ticketCodes: issuedCodes, count: issuedCodes.length });
    }

    // Standard: mark transaction status (deposit, withdrawal, etc.)
    // If confirming a wallet deposit, also credit the coins
    if (txn.type === 'DEPOSIT' && txn.status === 'PENDING' && finalStatus === 'SUCCESS' && !lotteryMeta) {
      await Promise.all([
        prisma.transaction.update({ where: { id: txnId }, data: { status: finalStatus, coins: txn.amount, processedAt: new Date() } }),
        prisma.wallet.update({ where: { userId: txn.userId }, data: { balance: { increment: txn.amount }, totalDeposit: { increment: txn.amount } } }),
      ]);
      return NextResponse.json({ ok: true, walletCredited: txn.amount });
    }

    await prisma.transaction.update({ where: { id: txnId }, data: { status: finalStatus } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
