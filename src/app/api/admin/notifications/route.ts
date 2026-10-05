import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const notifications = await prisma.notification.findMany({
    where: { isActive: true },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    include: { _count: { select: { reads: true } } },
  });
  return NextResponse.json({ notifications });
}

export async function POST(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { action } = body;

  if (action === 'create') {
    const { title, message, type, icon, color, isPinned, userId, expiresAt } = body;
    if (!title || !message) return NextResponse.json({ error: 'title and message required' }, { status: 400 });
    const n = await prisma.notification.create({
      data: {
        title, message,
        type: type ?? 'GENERAL',
        icon: icon ?? '🔔',
        color: color ?? '#fe8c45',
        isPinned: !!isPinned,
        userId: userId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    return NextResponse.json({ ok: true, notification: n });
  }

  if (action === 'update') {
    const { id, title, message, type, icon, color, isPinned, expiresAt } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const n = await prisma.notification.update({
      where: { id },
      data: {
        ...(title     !== undefined && { title }),
        ...(message   !== undefined && { message }),
        ...(type      !== undefined && { type }),
        ...(icon      !== undefined && { icon }),
        ...(color     !== undefined && { color }),
        ...(isPinned  !== undefined && { isPinned: !!isPinned }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
    });
    return NextResponse.json({ ok: true, notification: n });
  }

  if (action === 'delete') {
    const { id } = body;
    // Hard delete — removes permanently so it never reappears
    await prisma.notification.delete({ where: { id } }).catch(async () => {
      // Fallback: if related reads exist, soft-delete instead
      await prisma.notification.update({ where: { id }, data: { isActive: false } });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'pin') {
    const { id, isPinned } = body;
    await prisma.notification.update({ where: { id }, data: { isPinned } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
