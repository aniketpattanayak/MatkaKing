import { NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export async function GET() {
  try {
    const markets = await prisma.matkaMarket.findMany({
      orderBy: { openTime: 'asc' },
      include: {
        results: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return NextResponse.json({ markets });
  } catch {
    return NextResponse.json({ markets: [] });
  }
}
