import { NextRequest } from 'next/server';
import { prisma, verifyToken, json } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return json({ error: 'Unauthorized' }, 401);

  try {
    const now = new Date();
    const notifications = await prisma.notification.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: now } },
        ],
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 20,
      select: {
        id: true, title: true, message: true,
        type: true, icon: true, color: true,
        isPinned: true, createdAt: true, expiresAt: true,
        reads: {
          where: { userId: p.sub },
          select: { id: true },
        },
      },
    });

    return json({
      notifications: notifications.map(n => ({
        ...n,
        isRead: n.reads.length > 0,
        reads:  undefined,
      })),
      unreadCount: notifications.filter(n => n.reads.length === 0).length,
    });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}

// Mark notification as read
export async function POST(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return json({ error: 'Unauthorized' }, 401);
  try {
    const { notificationId } = await req.json();
    await prisma.notificationRead.upsert({
      where:  { userId_notificationId: { userId: p.sub, notificationId } },
      create: { userId: p.sub, notificationId },
      update: {},
    });
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}
