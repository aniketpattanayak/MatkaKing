
import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

export const maxDuration = 60;

// Generate tickets in batches - call multiple times for large counts
export async function POST(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error:'Forbidden' },{ status:403 });
  const { seriesId, fromNum, toNum } = await req.json();
  if (!seriesId || !fromNum || !toNum) return NextResponse.json({ error:'seriesId, fromNum, toNum required' },{ status:400 });

  const series = await prisma.lotterySeries.findUnique({ where:{ id:seriesId } });
  if (!series) return NextResponse.json({ error:'Series not found' },{ status:404 });

  const padLen = Math.max(4, String(toNum).length);
  const BATCH = 5000;
  let created = 0;

  for (let i = fromNum; i <= toNum; i += BATCH) {
    const batch = [];
    for (let j = i; j <= Math.min(i + BATCH - 1, toNum); j++) {
      batch.push({
        seriesId,
        ticketCode: series.prefix + String(j).padStart(padLen, '0'),
        isSold: false,
        isWinner: false,
      });
    }
    await prisma.lotteryTicket.createMany({ data: batch, skipDuplicates: true });
    created += batch.length;
  }

  // Update series endNumber
  await prisma.lotterySeries.update({ where:{ id:seriesId }, data:{ endNumber: toNum } });

  return NextResponse.json({ ok:true, created, from:fromNum, to:toNum });
}
