// src/app/api/cron/rollover/route.ts
//
// Vercel scheduled function — runs daily at 00:00 IST (18:30 UTC).
// For every MatkaMarket with isRecurring=true:
//   - If today's date is NOT in pausedDates, reset isResultDeclared=false and isOpen=false.
//   - This makes the market eligible to accept new bets again.
// Yesterday's MatkaResult row stays untouched in history.
//
// Vercel automatically protects this URL via CRON_SECRET (set in env vars).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Only allow Vercel cron or someone with the secret
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Today's date in IST (YYYY-MM-DD)
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  const todayIST = istNow.toISOString().slice(0, 10); // "2026-05-29"

  const markets = await prisma.matkaMarket.findMany({
    where: { isRecurring: true, isActive: true },
  });

  const result = {
    todayIST,
    totalRecurring: markets.length,
    reset: [] as string[],
    skipped: [] as { name: string; reason: string }[],
  };

  for (const m of markets) {
    if (m.pausedDates.includes(todayIST)) {
      result.skipped.push({ name: m.name, reason: `paused for ${todayIST}` });
      continue;
    }
    await prisma.matkaMarket.update({
      where: { id: m.id },
      data: { isResultDeclared: false, isOpen: false },
    });
    result.reset.push(m.name);
  }

  return NextResponse.json({ ok: true, ...result });
}
