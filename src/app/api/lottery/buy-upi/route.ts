// /api/lottery/buy-upi
// Allows buying lottery tickets by paying directly via UPI (no wallet required).
// Flow:
//   POST → reserves tickets + creates pending UPI order → returns QR code
//   GET  → check order status (PENDING | SUCCESS | EXPIRED)
// Admin confirms via /api/admin/transactions (existing flow) → webhook issues tickets.

import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

function generateOrderId() {
  return `LT-UPI-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

async function getActiveUpi() {
  return prisma.upiPool.findFirst({
    where: { isActive: true },
    orderBy: [{ priority: 'asc' }, { currentTxnCount: 'asc' }],
  });
}

// POST — reserve tickets + create pending UPI order
export async function POST(req: NextRequest) {
  try {
    const p = verifyToken(req);
    if (!p) return NextResponse.json({ error: 'Please login first' }, { status: 401 });

    const { seriesId, ticketCodes, quantity } = await req.json();
    if (!seriesId) return NextResponse.json({ error: 'seriesId required' }, { status: 400 });

    const series = await prisma.lotterySeries.findUnique({ where: { id: seriesId } });
    if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    if (series.status !== 'OPEN') return NextResponse.json({ error: 'Series is closed' }, { status: 400 });

    // Minimum ticket price check (allow ₹2 and above)
    if (series.ticketPrice < 1)
      return NextResponse.json({ error: 'Invalid ticket price' }, { status: 400 });

    // Find the tickets to reserve
    let ticketsToBook;
    if (ticketCodes?.length > 0) {
      ticketsToBook = await prisma.lotteryTicket.findMany({
        where: { ticketCode: { in: ticketCodes }, seriesId, isSold: false },
      });
      if (ticketsToBook.length === 0)
        return NextResponse.json({ error: 'These tickets are already sold or not found' }, { status: 409 });
    } else {
      const qty = Math.min(Math.max(Number(quantity) || 1, 1), 100);
      ticketsToBook = await prisma.lotteryTicket.findMany({
        where: { seriesId, isSold: false },
        take: qty,
      });
      if (ticketsToBook.length === 0)
        return NextResponse.json({ error: 'No tickets available' }, { status: 404 });
    }

    const totalAmountInr = ticketsToBook.length * series.ticketPrice;

    // Get UPI pool
    const upi = await getActiveUpi();
    if (!upi) return NextResponse.json({ error: 'Payment unavailable. Try again shortly.' }, { status: 503 });

    const orderId = generateOrderId();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reservation in Transaction.webhookPayload as JSON
    const reservationMeta = JSON.stringify({
      type: 'LOTTERY_UPI',
      seriesId,
      seriesName: series.name,
      ticketIds: ticketsToBook.map((t: any) => t.id),
      ticketCodes: ticketsToBook.map((t: any) => t.ticketCode),
      amountPerTicket: series.ticketPrice,
      expiresAt: expiresAt.toISOString(),
    });

    await prisma.transaction.create({
      data: {
        userId: p.sub,
        upiPoolId: upi.id,
        type: 'DEPOSIT',
        status: 'PENDING',
        amount: totalAmountInr,
        coins: 0,
        orderId,
        webhookPayload: reservationMeta,
      },
    });

    const qrString = `upi://pay?pa=${upi.upiId}&pn=MatkaKing&am=${totalAmountInr}&cu=INR&tn=${orderId}`;

    return NextResponse.json({
      ok: true,
      orderId,
      upiId: upi.upiId,
      amount: totalAmountInr,
      qrString,
      expiresAt: expiresAt.toISOString(),
      ticketCount: ticketsToBook.length,
      ticketCodes: ticketsToBook.map((t: any) => t.ticketCode),
      message: `Pay ₹${totalAmountInr} to ${upi.upiId} for ${ticketsToBook.length} ticket(s)`,
    });
  } catch (e: any) {
    console.error('buy-upi error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET — check order status and issue tickets if confirmed
export async function GET(req: NextRequest) {
  try {
    const p = verifyToken(req);
    if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    const txn = await prisma.transaction.findFirst({
      where: { orderId, userId: p.sub },
    });
    if (!txn) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Parse the reservation metadata
    let meta: any = {};
    try { meta = JSON.parse(txn.webhookPayload ?? '{}'); } catch {}

    if (txn.status === 'SUCCESS') {
      // Check if tickets were actually issued (bet records exist)
      const issuedBets = await prisma.lotteryBet.findMany({
        where: { userId: p.sub, ticketId: { in: meta.ticketIds ?? [] } },
        select: { id: true },
      });
      return NextResponse.json({
        status: 'SUCCESS',
        ticketsIssued: issuedBets.length > 0,
        ticketCodes: meta.ticketCodes ?? [],
        amount: txn.amount,
      });
    }

    if (txn.status === 'PENDING') {
      // Check if expired
      const expiresAt = meta.expiresAt ? new Date(meta.expiresAt) : null;
      if (expiresAt && new Date() > expiresAt) {
        // Mark expired
        await prisma.transaction.update({
          where: { id: txn.id },
          data: { status: 'FAILED', failureReason: 'Payment expired' },
        });
        return NextResponse.json({ status: 'EXPIRED', message: 'Payment window expired. Please try again.' });
      }
      return NextResponse.json({
        status: 'PENDING',
        orderId,
        amount: txn.amount,
        ticketCodes: meta.ticketCodes ?? [],
        expiresAt: meta.expiresAt,
        message: 'Waiting for payment confirmation',
      });
    }

    return NextResponse.json({ status: txn.status ?? 'UNKNOWN' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
