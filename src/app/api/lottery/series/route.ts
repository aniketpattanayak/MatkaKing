import { NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const series = await prisma.lotterySeries.findMany({
      where: {
        status: { in: ['OPEN', 'CLOSED'] },
        isActive: true,
      },
      orderBy: { drawAt: 'asc' },
      include: {
        _count: { select: { tickets: true } },
      },
    });
    const res = NextResponse.json({ series });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  } catch (e: any) {
    return NextResponse.json({ series: [], error: e.message });
  }
}
