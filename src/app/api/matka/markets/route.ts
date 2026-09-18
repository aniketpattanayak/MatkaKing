import { NextResponse } from 'next/server';
import { prisma, getCache, setCache } from '@/lib/api-helper';

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
  // Check cache first (30s TTL)
  const cacheKey = 'matka:markets';
  const cached = getCache(cacheKey);
  if (cached) return NextResponse.json(cached);
  try {
    const markets = await prisma.matkaMarket.findMany({
      where: { isActive: true },
      orderBy: { openTime: 'asc' },
      include: {
        results: {
          // ── Fix: use last 72 hours so results remain visible after midnight
          // and for admin/user views the same day the market was drawn.
          // Previously used "today midnight" which caused results to vanish
          // if the market opened+closed on the same calendar day or after midnight.
          where: { createdAt: { gte: new Date(Date.now() - 72 * 60 * 60 * 1000) } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id:true, openPatti:true, closePatti:true, openAnk:true, closeAnk:true, jodi:true, declaredAt:true, totalPayout:true, isDummyResult:true },
        },
      },
    });
    const enriched = markets.map((m: any) => {
      // Market is open if: admin manually opened it OR current time is within window
      const timeOpen = isMarketOpen(m.openTime, m.closeTime);
      const open = m.isOpen || timeOpen; // DB flag OR time-based
      return { ...m, isOpen: open, status: open ? 'OPEN' : 'CLOSED' };
    }).filter((m: any) => {
      // Hide markets that haven't reached their saleDatetime yet
      if (m.saleDatetime) {
        const saleAt = new Date(m.saleDatetime);
        if (new Date() < saleAt) return false; // not yet visible to users
      }
      return true;
    });
    // Sort: OPEN markets first, then by openTime
    const sorted = [...enriched].sort((a:any, b:any) => {
      if (a.isOpen && !b.isOpen) return -1;
      if (!a.isOpen && b.isOpen) return 1;
      return a.openTime.localeCompare(b.openTime);
    });
    const resp = { markets: sorted };
    // 10 s cache — short enough that a freshly declared result appears quickly
    setCache(cacheKey, resp, 10000);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ markets: [], error: e.message });
  }
}
