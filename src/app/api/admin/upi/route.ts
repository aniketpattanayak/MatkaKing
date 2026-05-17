import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken, isAdminToken } from '@/lib/api-helper';

function isAdmin(req: NextRequest) {
  return isAdminToken(req) !== null;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const upis = await prisma.upiPool.findMany({ orderBy: { priority: 'asc' } });
  return NextResponse.json({ upis });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { upiId, label, transactionLimit, priority } = await req.json();
  if (!upiId || !label) return NextResponse.json({ error: 'upiId and label required' }, { status: 400 });
  const upi = await prisma.upiPool.create({
    data: { upiId, label, transactionLimit: transactionLimit ?? 100, priority: priority ?? 0 },
  });
  return NextResponse.json({ upi });
}

// EDIT existing UPI
export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, upiId, label, transactionLimit, priority, isActive } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const upi = await prisma.upiPool.update({
    where: { id },
    data: {
      ...(upiId            !== undefined && { upiId }),
      ...(label            !== undefined && { label }),
      ...(transactionLimit !== undefined && { transactionLimit: Number(transactionLimit) }),
      ...(priority         !== undefined && { priority: Number(priority) }),
      ...(isActive         !== undefined && { isActive }),
    },
  });
  return NextResponse.json({ ok: true, upi });
}

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, isActive } = await req.json();
  const upi = await prisma.upiPool.update({ where: { id }, data: { isActive } });
  return NextResponse.json({ upi });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await prisma.upiPool.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
