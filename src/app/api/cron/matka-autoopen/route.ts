import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const cur = ist.getHours() * 60 + ist.getMinutes();
    const hm  = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };

    // Only handle recurring markets (closeDatetime IS NULL) in this cron.
    // One-time dated markets (closeDatetime set) are fully managed by matka-autodeclare.
    // Also skip one-time markets whose closeDatetime has already passed — they are
    // permanently closed and must never be touched again.
    const markets = await prisma.matkaMarket.findMany({
      where: {
        isActive: true,
        OR: [
          { closeDatetime: null },          // recurring daily markets
          { closeDatetime: { gt: now } },   // one-time markets not yet closed
        ],
      },
    });
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

    // Reset isResultDeclared for recurring markets at midnight (between 12am-1am IST)
    // One-time dated markets whose closeDatetime has already passed are excluded —
    // they stay permanently closed and must never reopen.
    if (ist.getHours() < 1) {
      const nowReset = new Date();
      await prisma.matkaMarket.updateMany({
        where: {
          OR: [
            { closeDatetime: null },          // recurring daily markets
            { closeDatetime: { gt: nowReset } },   // one-time markets not yet closed
          ],
        },
        data: { isResultDeclared: false },
      });
      results.push({ action: 'RESET_ALL_DECLARED' });
    }
    return NextResponse.json({ ok: true, time: ist.toTimeString(), results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
