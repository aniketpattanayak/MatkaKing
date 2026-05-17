import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

async function isAdmin(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return null;
  const u = await prisma.user.findUnique({ where: { id: p.sub }, select: { role: true } });
  return (u?.role === 'ADMIN' || u?.role === 'SUPERADMIN') ? p : null;
}

export async function GET(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const config = await prisma.spinConfig.findFirst({ where: { id: 'default' } });
  const rewards = await prisma.spinReward.findMany({ orderBy: { probability: 'desc' } });
  return NextResponse.json({ config, rewards });
}

export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { costPerSpin, freeSpinInterval } = await req.json();

  const config = await prisma.spinConfig.upsert({
    where: { id: 'default' },
    update: { costPerSpin: Number(costPerSpin), freeSpinInterval: Number(freeSpinInterval) },
    create: { id: 'default', name: 'Default Spin', costPerSpin: Number(costPerSpin), freeSpinInterval: Number(freeSpinInterval), isActive: true },
  });
  return NextResponse.json({ ok: true, config });
}
