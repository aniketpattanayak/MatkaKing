import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken, json, verifyToken } from '@/lib/api-helper';

// ── GET — fetch all notifications + festivals ─────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const [notifications, festivals] = await Promise.all([
      prisma.notification.findMany({
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        include: { _count: { select: { reads: true } } },
        take: 50,
      }),
      prisma.festivalEvent.findMany({
        orderBy: { date: 'asc' },
        where:   { date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, // past 7 days + future
      }),
    ]);
    return json({ notifications, festivals });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}

// ── POST — create notification or festival event or festival game ──────────────
export async function POST(req: NextRequest) {
  const p = isAdminToken(req);
  if (!p) return json({ error: 'Forbidden' }, 403);

  try {
    const body = await req.json();
    const { action } = body;

    // ── Create notification ──────────────────────────────────────────────────
    if (action === 'create_notification') {
      const { title, message, type, icon, color, isPinned, expiresAt, festivalId } = body;
      if (!title || !message) return json({ error: 'title and message required' }, 400);

      const notif = await prisma.notification.create({
        data: {
          title, message,
          type:      type ?? 'GENERAL',
          icon:      icon ?? '🔔',
          color:     color ?? '#fe8c45',
          isPinned:  isPinned ?? false,
          isActive:  true,
          festivalId: festivalId ?? null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });
      return json({ ok: true, notification: notif });
    }

    // ── Toggle notification active ───────────────────────────────────────────
    if (action === 'toggle_notification') {
      const { id } = body;
      const notif = await prisma.notification.findUnique({ where: { id }, select: { isActive: true } });
      if (!notif) return json({ error: 'Not found' }, 404);
      await prisma.notification.update({ where: { id }, data: { isActive: !notif.isActive } });
      return json({ ok: true });
    }

    // ── Pin/unpin notification ───────────────────────────────────────────────
    if (action === 'pin_notification') {
      const { id } = body;
      const notif = await prisma.notification.findUnique({ where: { id }, select: { isPinned: true } });
      if (!notif) return json({ error: 'Not found' }, 404);
      await prisma.notification.update({ where: { id }, data: { isPinned: !notif.isPinned } });
      return json({ ok: true });
    }

    // ── Delete notification ──────────────────────────────────────────────────
    if (action === 'delete_notification') {
      const { id } = body;
      await prisma.notificationRead.deleteMany({ where: { notificationId: id } });
      await prisma.notification.delete({ where: { id } });
      return json({ ok: true });
    }

    // ── Create festival event ────────────────────────────────────────────────
    if (action === 'create_festival') {
      const { name, emoji, date, gameType, description, bonusMultiplier } = body;
      if (!name || !date) return json({ error: 'name and date required' }, 400);

      const festival = await prisma.festivalEvent.create({
        data: {
          name, emoji:  emoji ?? '🎉',
          date:         new Date(date),
          gameType:     gameType ?? 'ALL',
          description:  description ?? '',
          bonusMultiplier: Number(bonusMultiplier) || 1.0,
          isActive:     true,
        },
      });

      // Auto-create announcement notification
      await prisma.notification.create({
        data: {
          title:     `${emoji ?? '🎉'} ${name} Special!`,
          message:   description || `Special ${gameType} games and bonus rewards for ${name}! Don't miss out!`,
          type:      'FESTIVAL',
          icon:      emoji ?? '🎉',
          color:     '#FFD700',
          isPinned:  true,
          festivalId: festival.id,
          expiresAt: new Date(new Date(date).getTime() + 2 * 24 * 60 * 60 * 1000), // expires 2 days after festival
        },
      });

      return json({ ok: true, festival });
    }

    // ── Create festival lottery series ───────────────────────────────────────
    if (action === 'create_festival_lottery') {
      const { festivalId, name, prefix, ticketPrice, prizePool, totalTickets, drawAt } = body;
      if (!name || !prefix || !ticketPrice || !prizePool || !totalTickets || !drawAt)
        return json({ error: 'All fields required' }, 400);

      const cleanPrefix = prefix.toUpperCase();
      const total = Number(totalTickets);

      const existing = await prisma.lotterySeries.findFirst({ where: { prefix: cleanPrefix } });
      if (existing) return json({ error: `Prefix "${cleanPrefix}" already used` }, 409);

      const series = await prisma.lotterySeries.create({
        data: {
          name, prefix: cleanPrefix,
          startNumber: 1, endNumber: total,
          ticketPrice: Number(ticketPrice),
          prizePool:   Number(prizePool),
          drawAt:      new Date(drawAt),
          status:      'OPEN', isActive: true,
        },
      });

      // Generate tickets in batches
      const BATCH = 500;
      for (let i = 1; i <= total; i += BATCH) {
        const batch = [];
        for (let j = i; j <= Math.min(i + BATCH - 1, total); j++) {
          batch.push({ seriesId: series.id, ticketCode: `${cleanPrefix}${String(j).padStart(4,'0')}`, isSold: false, isWinner: false });
        }
        await prisma.lotteryTicket.createMany({ data: batch, skipDuplicates: true });
      }

      // Auto-notify users
      const festival = festivalId ? await prisma.festivalEvent.findUnique({ where: { id: festivalId }, select: { name: true, emoji: true } }) : null;
      await prisma.notification.create({
        data: {
          title:   `${festival?.emoji ?? '🎟️'} ${festival?.name ?? ''} Lottery is LIVE!`,
          message: `"${name}" lottery series is now open! ${total} tickets at ₹${ticketPrice} each. Prize pool: ₹${Number(prizePool).toLocaleString()}. Draw on ${new Date(drawAt).toLocaleDateString('en-IN')}.`,
          type:    'FESTIVAL',
          icon:    '🎟️',
          color:   '#3498DB',
          isPinned: false,
          festivalId: festivalId ?? null,
        },
      });

      return json({ ok: true, series, ticketsGenerated: total });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    console.error('notifications error:', e.message);
    return json({ error: e.message }, 500);
  }
}
