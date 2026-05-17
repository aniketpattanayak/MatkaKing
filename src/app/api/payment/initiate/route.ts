import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

function generateOrderId() { return `SGE-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`; }

async function getActiveUpi() {
  return prisma.upiPool.findFirst({ where: { isActive: true }, orderBy: [{ priority: 'asc' }, { currentTxnCount: 'asc' }] });
}

export async function POST(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amountInr } = await req.json();
  if (!amountInr || amountInr < 10) return NextResponse.json({ error: 'Minimum deposit is ₹10' }, { status: 400 });

  const upi = await getActiveUpi();
  if (!upi) return NextResponse.json({ error: 'Payment unavailable. Try again shortly.' }, { status: 503 });

  const orderId = generateOrderId();
  await prisma.transaction.create({
    data: { userId: p.sub, upiPoolId: upi.id, type: 'DEPOSIT', status: 'PENDING', amount: amountInr, coins: 0, orderId },
  });

  const qrString = `upi://pay?pa=${upi.upiId}&pn=SupremeGaming&am=${amountInr}&cu=INR&tn=${orderId}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return NextResponse.json({ orderId, upiId: upi.upiId, amount: amountInr, qrString, expiresAt, message: `Pay ₹${amountInr} to ${upi.upiId}` });
}

export async function GET(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  const txn = await prisma.transaction.findFirst({ where: { orderId, userId: p.sub } });
  return NextResponse.json({ status: txn?.status ?? 'NOT_FOUND', coins: txn?.coins ?? 0 });
}
