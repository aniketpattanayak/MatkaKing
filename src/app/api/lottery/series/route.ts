import { NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export async function GET() {
  try {
    const series = await prisma.lotterySeries.findMany({
      where: {
        status: { in: ['OPEN', 'CLOSED'] }, // show both open and closed (not yet drawn)
        isActive: true,
      },
      orderBy: { drawAt: 'asc' }, // nearest draw date first
      include: {
        _count: { select: { tickets: true } },
      },
    });
    return NextResponse.json({ series });
  } catch (e: any) {
    return NextResponse.json({ series: [], error: e.message });
  }
}