import { NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export async function GET() {
  try {
    const series = await prisma.lotterySeries.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { tickets: true } },
      },
    });
    return NextResponse.json({ series });
  } catch {
    return NextResponse.json({ series: [] });
  }
}
