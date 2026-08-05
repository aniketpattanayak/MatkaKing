import { NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isMarketOpen(openTime: string, closeTime: string): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hm  = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  const cur = ist.getHours()*60 + ist.getMinutes();
  return cur >= hm(openTime) && cur < hm(closeTime);
}

export async function GET() {
  try {
    const markets = await prisma.matkaMarket.findMany({
      where: { isActive: true },
      orderBy: { openTime: 'asc' },
      include: {
        results: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const enriched = markets.map((m: any) => {
      // Market is open if: admin manually opened it OR current time is within window
      const timeOpen = isMarketOpen(m.openTime, m.closeTime);
      const open = m.isOpen || timeOpen; // DB flag OR time-based
      return { ...m, isOpen: open, status: open ? 'OPEN' : 'CLOSED' };
    });
    const res = NextResponse.json({ markets: enriched });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  } catch (e: any) {
    return NextResponse.json({ markets: [], error: e.message });
  }
}
