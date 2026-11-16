import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';
import bcrypt from 'bcryptjs';

function json(data: any, status = 200) { return NextResponse.json(data, { status }); }

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return json({ error: 'Forbidden' }, 403);
  const retailers = await prisma.retailer.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { bets: true } } },
  });
  return json({ retailers });
}

export async function POST(req: NextRequest) {
  if (!isAdminToken(req)) return json({ error: 'Forbidden' }, 403);
  const { name, phone, commissionPct } = await req.json();
  if (!name || !phone) return json({ error: 'name and phone required' }, 400);
  const code = `RET${phone.slice(-4)}${Date.now().toString(36).slice(-3).toUpperCase()}`;
  let userId: string | null = null;
  const existing = await prisma.user.findFirst({ where: { phone } });
  if (existing) {
    userId = existing.id;
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'RETAILER' } });
  } else {
    const passwordHash = await bcrypt.hash(phone, 10);
    const newUser = await prisma.user.create({
      data: { email: `${code.toLowerCase()}@retailer.internal`, phone, name, passwordHash, role: 'RETAILER', referralCode: code },
    });
    await prisma.wallet.create({ data: { userId: newUser.id } });
    userId = newUser.id;
  }
  const retailer = await prisma.retailer.create({ data: { name, phone, code, commissionPct: commissionPct ?? 10, userId } });
  return json({ ok: true, retailer, loginCode: code, defaultPassword: phone });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminToken(req)) return json({ error: 'Forbidden' }, 403);
  const { retailerId, commissionPct, isActive } = await req.json();
  if (!retailerId) return json({ error: 'retailerId required' }, 400);
  const updated = await prisma.retailer.update({
    where: { id: retailerId },
    data: {
      ...(commissionPct !== undefined && { commissionPct: Math.min(100, Math.max(0, Number(commissionPct))) }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    },
  });
  return json({ ok: true, retailer: updated });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminToken(req)) return json({ error: 'Forbidden' }, 403);
  const { retailerId } = await req.json();
  if (!retailerId) return json({ error: 'retailerId required' }, 400);
  await prisma.retailer.delete({ where: { id: retailerId } });
  return json({ ok: true });
}
