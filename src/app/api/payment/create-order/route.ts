import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

async function getActiveUpi() {
  return prisma.upiPool.findFirst({
    where: { isActive: true },
    orderBy: [{ priority: 'asc' }, { currentTxnCount: 'asc' }],
  });
}

// POST — user starts a deposit
export async function POST(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amountInr } = await req.json();
  if (!amountInr || amountInr < 10)
    return NextResponse.json({ error: 'Minimum deposit is ₹10' }, { status: 400 });

  const upi = await getActiveUpi();
  if (!upi) return NextResponse.json({ error: 'No active UPI. Contact support.' }, { status: 503 });

  const orderId = `SGE-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // Create pending transaction
  await prisma.transaction.create({
    data: {
      userId:  p.sub,
      type:    'DEPOSIT',
      status:  'PENDING',
      amount:  amountInr,
      coins:   0,
      orderId,
    },
  });

  // Increment UPI transaction count
  await prisma.upiPool.update({
    where: { id: upi.id },
    data: { currentTxnCount: { increment: 1 } },
  });

  // Auto-rotate UPI when limit reached
  if (upi.currentTxnCount + 1 >= upi.transactionLimit) {
    await prisma.upiPool.update({ where: { id: upi.id }, data: { isActive: false } });
  }

  const qrString = `upi://pay?pa=${upi.upiId}&pn=SupremeGaming&am=${amountInr}&cu=INR&tn=${orderId}`;

  return NextResponse.json({
    orderId,
    upiId:    upi.upiId,
    amount:   amountInr,
    qrString,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    message:  `Pay exactly ₹${amountInr} to ${upi.upiId}`,
  });
}

// PUT — user submits UTR after paying (improves matching accuracy)
export async function PUT(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderId, utr } = await req.json();
  if (!orderId || !utr) return NextResponse.json({ error: 'orderId and utr required' }, { status: 400 });

  const txn = await prisma.transaction.findFirst({
    where: { orderId, userId: p.sub, status: 'PENDING' },
  });
  if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

  // Save UTR in orderId for webhook matching
  await prisma.transaction.update({
    where: { id: txn.id },
    data: { orderId: `${orderId}|UTR:${utr}` },
  });

  return NextResponse.json({ ok: true, message: 'UTR saved. Coins will be credited automatically once payment is detected.' });
}

// GET — check payment status
export async function GET(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const txn = await prisma.transaction.findFirst({
    where: { userId: p.sub, orderId: { contains: orderId } },
    select: { status: true, coins: true, updatedAt: true },
  });

  return NextResponse.json({
    status: txn?.status ?? 'NOT_FOUND',
    coins:  txn?.coins  ?? 0,
  });
}
