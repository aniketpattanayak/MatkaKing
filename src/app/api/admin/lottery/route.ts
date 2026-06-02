import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken, isAdminToken, json } from '@/lib/api-helper';

function isAdmin(req: NextRequest) { return isAdminToken(req); }

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const series = await prisma.lotterySeries.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { tickets: true } } },
    });
    return NextResponse.json({ series });
  } catch (e: any) {
    console.error('lottery GET error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const p = isAdmin(req);
    if (!p) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { action, seriesId, name, prefix, ticketPrice, prizePool, firstPrize, secondPrize, thirdPrize, totalTickets, drawAt, status } = body;

    // ── Create series ────────────────────────────────────────────────────────
    if (action === 'create_series') {
      // Compute prizes — accept either explicit 3-tier values or legacy prizePool (then split 60/30/10)
      let p1 = Number(firstPrize ?? 0);
      let p2 = Number(secondPrize ?? 0);
      let p3 = Number(thirdPrize ?? 0);
      if (p1 + p2 + p3 === 0 && prizePool) {
        const pool = Number(prizePool);
        p1 = Math.floor(pool * 0.6);
        p2 = Math.floor(pool * 0.3);
        p3 = pool - p1 - p2;
      }
      const totalPrize = p1 + p2 + p3;

      if (!name || !prefix || !ticketPrice || !totalTickets || !drawAt || totalPrize <= 0)
        return NextResponse.json({ error: 'All fields required (name, prefix, ticketPrice, prizes, totalTickets, drawAt)' }, { status: 400 });

      const cleanPrefix = prefix.toUpperCase();
      const total       = Number(totalTickets);
      const startNum    = 1;
      const endNum      = total;

      // Check prefix not already used
      const existing = await prisma.lotterySeries.findFirst({ where: { prefix: cleanPrefix } });
      if (existing) return NextResponse.json({ error: `Prefix "${cleanPrefix}" already used by "${existing.name}"` }, { status: 409 });

      // Create series — using correct schema fields
      const series = await prisma.lotterySeries.create({
        data: {
          name,
          prefix:      cleanPrefix,
          startNumber: startNum,
          endNumber:   endNum,
          ticketPrice: Number(ticketPrice),
          prizePool:   totalPrize,
          firstPrize:  p1,
          secondPrize: p2,
          thirdPrize:  p3,
          drawAt:      new Date(drawAt),
          status:      'OPEN',
          isActive:    true,
        },
      });

      // Generate tickets in batches of 500
      // LotteryTicket has: seriesId, ticketCode, isSold, isWinner — NO price field
      const BATCH = 500;
      let created = 0;
      for (let i = startNum; i <= endNum; i += BATCH) {
        const batch = [];
        for (let j = i; j <= Math.min(i + BATCH - 1, endNum); j++) {
          batch.push({
            seriesId:   series.id,
            ticketCode: `${cleanPrefix}${String(j).padStart(4, '0')}`,
            isSold:     false,
            isWinner:   false,
          });
        }
        await prisma.lotteryTicket.createMany({ data: batch, skipDuplicates: true });
        created += batch.length;
      }

      return NextResponse.json({ ok: true, series, ticketsGenerated: created });
    }

    // ── Update status ────────────────────────────────────────────────────────
    if (action === 'update_status') {
      if (!seriesId || !status) return NextResponse.json({ error: 'seriesId and status required' }, { status: 400 });
      const updated = await prisma.lotterySeries.update({ where: { id: seriesId }, data: { status } });
      return NextResponse.json({ ok: true, series: updated });
    }

    // ── Delete series ────────────────────────────────────────────────────────
    if (action === 'delete_series') {
      if (!seriesId) return NextResponse.json({ error: 'seriesId required' }, { status: 400 });
      await prisma.lotteryTicket.deleteMany({ where: { seriesId } });
      await prisma.lotterySeries.delete({ where: { id: seriesId } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (e: any) {
    console.error('lottery POST error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
