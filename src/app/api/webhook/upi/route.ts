import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/api-helper';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('x-webhook-signature') ?? '';
  const secret = process.env.WEBHOOK_SECRET ?? '';

  // Verify HMAC signature
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  if (sig !== expected) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  const payload = JSON.parse(body);
  const { orderId, status, amount } = payload;

  if (status !== 'SUCCESS') return NextResponse.json({ ok: true });

  const txn = await prisma.transaction.findFirst({ where: { orderId, status: 'PENDING' } });
  if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.transaction.update({ where: { id: txn.id }, data: { status: 'SUCCESS', coins: amount } }),
    prisma.wallet.update({ where: { userId: txn.userId }, data: { balance: { increment: amount }, totalDeposit: { increment: amount } } }),
  ]);

  return NextResponse.json({ ok: true, coins: amount });
}
