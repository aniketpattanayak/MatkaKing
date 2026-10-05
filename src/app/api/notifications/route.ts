import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  const user = await verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const notifications = await prisma.notification.findMany({
    where: {
      isActive: true,
      OR: [
        { userId: null,     expiresAt: null },
        { userId: null,     expiresAt: { gt: now } },
        { userId: user.sub, expiresAt: null },
        { userId: user.sub, expiresAt: { gt: now } },
      ],
    },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    take: 30,
    include: {
      reads: { where: { userId: user.sub }, select: { id: true } },
    },
  });

  const result = notifications.map(n => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    icon: n.icon,
    color: n.color,
    isPinned: n.isPinned,
    createdAt: n.createdAt,
    isRead: n.reads.length > 0,
  }));

  return NextResponse.json({ notifications: result });
}

export async function POST(req: NextRequest) {
  const user = await verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { notificationId, markAll } = await req.json();

  if (markAll) {
    const now = new Date();
    const all = await prisma.notification.findMany({
      where: {
        isActive: true,
        OR: [{ userId: null }, { userId: user.sub }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
      select: { id: true },
    });
    for (const n of all) {
      await prisma.notificationRead.upsert({
        where: { userId_notificationId: { userId: user.sub, notificationId: n.id } },
        create: { userId: user.sub, notificationId: n.id },
        update: {},
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (notificationId) {
    await prisma.notificationRead.upsert({
      where: { userId_notificationId: { userId: user.sub, notificationId } },
      create: { userId: user.sub, notificationId },
      update: {},
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'notificationId or markAll required' }, { status: 400 });
}
