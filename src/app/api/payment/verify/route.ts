import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

// ── User submits UTR after paying ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderId, utrNumber } = await req.json();
  if (!orderId || !utrNumber)
    return NextResponse.json({ error: 'orderId and utrNumber required' }, { status: 400 });

  // Find pending transaction
  const txn = await prisma.transaction.findFirst({
    where: { orderId, userId: p.sub, status: 'PENDING' },
  });
  if (!txn) return NextResponse.json({ error: 'Transaction not found or already processed' }, { status: 404 });

  // Save UTR and mark as AWAITING_VERIFICATION
  await prisma.transaction.update({
    where: { id: txn.id },
    data: { status: 'PENDING', orderId: `${orderId}|UTR:${utrNumber}` },
  });

  return NextResponse.json({ ok: true, message: 'UTR submitted. Admin will verify and credit coins within 15 minutes.' });
}

// ── Admin: get all pending verifications ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: p.sub }, select: { role: true } });
  if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const pending = await prisma.transaction.findMany({
    where: { type: 'DEPOSIT', status: 'PENDING' },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ pending });
}

// ── Admin: approve or reject a deposit ────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: p.sub }, select: { role: true } });
  if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { txnId, action } = await req.json(); // action: 'approve' | 'reject'
  if (!txnId || !action) return NextResponse.json({ error: 'txnId and action required' }, { status: 400 });

  const txn = await prisma.transaction.findUnique({ where: { id: txnId } });
  if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

  if (action === 'approve') {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: txnId },
        data: { status: 'SUCCESS', coins: txn.amount },
      }),
      prisma.wallet.update({
        where: { userId: txn.userId },
        data: { balance: { increment: txn.amount }, totalDeposit: { increment: txn.amount } },
      }),
    ]);
    return NextResponse.json({ ok: true, message: `₹${txn.amount} credited to user` });
  }

  if (action === 'reject') {
    await prisma.transaction.update({
      where: { id: txnId },
      data: { status: 'FAILED' },
    });
    return NextResponse.json({ ok: true, message: 'Transaction rejected' });
  }

  return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
}
