import { NextResponse } from 'next/server';
import { prisma, getCache, setCache } from '@/lib/api-helper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const cached = getCache('lottery:series');
  if (cached) return NextResponse.json(cached);
  try {
    // Close series automatically 30 mins before draw time
    // Only close if: drawAt is within 30 mins AND series was created at least 2 hours ago
    const now = new Date();
    const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    // Get all OPEN series and filter in JS to avoid SQLite datetime issues
    const openSeries = await prisma.lotterySeries.findMany({
      where: { status: 'OPEN', isActive: true },
      select: { id: true, drawAt: true, createdAt: true },
    });
    const toClose = openSeries.filter(s => 
      new Date(s.drawAt) <= thirtyMinsFromNow && 
      new Date(s.createdAt) <= twoHoursAgo
    ).map(s => s.id);
    if (toClose.length > 0) {
      await prisma.lotterySeries.updateMany({
        where: { id: { in: toClose } },
        data: { status: 'CLOSED' },
      });
    }

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
    // Filter out series not yet on sale
    const now2 = new Date();
    const onSale = series.filter((s: any) => {
      if (!s.saleStartAt) return true;
      return new Date(s.saleStartAt) <= now2;
    });
    const resp = { series: onSale };
    setCache('lottery:series', resp, 20000);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ series: [], error: e.message });
  }
}
