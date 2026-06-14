// /api/cron/matka-autoopen
// Runs every 30 min. Opens matka markets when their openTime has arrived.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error:'Unauthorized' },{ status:401 });

  // Current IST time as HH:MM string
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5*60*60*1000);
  const hhmm = istNow.toISOString().slice(11,16); // "HH:MM"

  const markets = await prisma.matkaMarket.findMany({
    where: { isActive:true, isOpen:false, isResultDeclared:false },
  });

  const opened:string[] = [];
  const closed:string[] = [];

  for (const m of markets) {
    const todayIST = istNow.toISOString().slice(0,10);
    if ((m as any).pausedDates?.includes(todayIST)) continue;

    // Open the market at its openTime
    if (m.openTime && hhmm >= m.openTime && !m.isOpen) {
      await prisma.matkaMarket.update({ where:{id:m.id}, data:{isOpen:true} });
      opened.push(m.name);
    }

    // Close betting at closeTime (don't declare result — admin does that)
    if (m.closeTime && hhmm >= m.closeTime && m.isOpen) {
      await prisma.matkaMarket.update({ where:{id:m.id}, data:{isOpen:false} });
      closed.push(m.name);
    }
  }

  return NextResponse.json({ ok:true, opened, closed, checkedAt: hhmm });
}
