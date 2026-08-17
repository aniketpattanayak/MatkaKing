import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken, verifyToken } from '@/lib/api-helper';

// Admin sends message to specific user or all users
export async function POST(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error:'Forbidden' },{ status:403 });
  const { userId, title, message, type } = await req.json();
  if (!title || !message) return NextResponse.json({ error:'title and message required' },{ status:400 });
  try {
    if (userId) {
      // Message to specific user
      await prisma.notification.create({
        data: { userId, title, message, type: type ?? 'GENERAL', icon: '💬', color: '#3498DB', isPinned: false },
      });
    } else {
      // Broadcast to all users
      const users = await prisma.user.findMany({ select: { id: true } });
      await Promise.all(users.map(u =>
        prisma.notification.create({
          data: { userId: u.id, title, message, type: type ?? 'GENERAL', icon: '📢', color: '#fe8c45', isPinned: false },
        })
      ));
    }
    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ error:e.message },{ status:500 });
  }
}

// GET - admin views messages sent
export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error:'Forbidden' },{ status:403 });
  try {
    const msgs = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { id:true, name:true, email:true } } },
    });
    return NextResponse.json({ messages: msgs });
  } catch (e:any) {
    return NextResponse.json({ error:e.message, messages:[] });
  }
}
