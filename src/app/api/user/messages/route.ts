import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken, isAdminToken } from '@/lib/api-helper';

// GET - user gets their messages
export async function GET(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error:'Unauthorized' },{ status:401 });
  try {
    const msgs = await prisma.notification.findMany({
      where: { OR: [{ userId: p.sub }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json({ messages: msgs });
  } catch (e:any) {
    return NextResponse.json({ messages:[], error:e.message });
  }
}
