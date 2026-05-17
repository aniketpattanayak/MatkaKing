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
    const { action, seriesId, name, prefix, ticketPrice, prizePool, totalTickets, drawAt, status } = body;

    // ── Create series ────────────────────────────────────────────────────────
    if (action === 'create_series') {
      if (!name || !prefix || !ticketPrice || !prizePool || !totalTickets || !drawAt)
        return NextResponse.json({ error: 'All fields required' }, { status: 400 });

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
          startNumber: startNum,      // ✅ correct field
          endNumber:   endNum,        // ✅ correct field
          ticketPrice: Number(ticketPrice),
          prizePool:   Number(prizePool),
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
