import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

async function isAdmin(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return false;
  const u = await prisma.user.findUnique({ where: { id: p.sub }, select: { role: true } });
  return u?.role === 'ADMIN' || u?.role === 'SUPERADMIN';
}

const DEFAULT_MARKETS = [
  { name: 'Milan Day',   openTime: '09:30', closeTime: '11:30', resultTime: '12:00', isOpen: true  },
  { name: 'Kalyan',      openTime: '15:45', closeTime: '17:45', resultTime: '18:00', isOpen: true  },
  { name: 'Milan Night', openTime: '21:00', closeTime: '23:00', resultTime: '23:30', isOpen: false },
];

export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const results = [];
  for (const market of DEFAULT_MARKETS) {
    try {
      const existing = await prisma.matkaMarket.findFirst({ where: { name: market.name } });
      if (!existing) {
        const created = await prisma.matkaMarket.create({ data: market });
        results.push({ name: created.name, status: 'created' });
      } else {
        results.push({ name: existing.name, status: 'already_exists' });
      }
    } catch (e: any) {
      results.push({ name: market.name, status: 'error', error: e.message });
    }
  }

  return NextResponse.json({ ok: true, results });
}
