import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const cur = ist.getHours() * 60 + ist.getMinutes();
    const hm  = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };

    const markets = await prisma.matkaMarket.findMany({ where: { isActive: true } });
    const results = [];

    for (const m of markets) {
      const open  = hm(m.openTime);
      const close = hm(m.closeTime);
      const isInWindow = cur >= open && cur < close;

      // Find today's result
      const today = new Date();
      today.setHours(0,0,0,0);
      const todayResult = await prisma.matkaResult.findFirst({
        where: { marketId: m.id, createdAt: { gte: today } },
        orderBy: { createdAt: 'desc' },
      });

      if (isInWindow && !todayResult) {
        // Create open result record for today
        await prisma.matkaResult.create({
          data: { marketId: m.id, openPatti: null, closePatti: null, jodi: null },
        }).catch(() => {}); // skip if already exists
        results.push({ market: m.name, action: 'OPENED' });
      } else if (!isInWindow && cur >= close && todayResult && !todayResult.declaredAt) {
        results.push({ market: m.name, action: 'AWAITING_DECLARE' });
      }
    }

    return NextResponse.json({ ok: true, time: ist.toTimeString(), results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
