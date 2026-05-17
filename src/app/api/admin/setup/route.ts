import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

// This endpoint only works ONCE — when there are zero admins in the system.
// After the first admin is created it permanently stops working.
export async function POST(req: NextRequest) {
  try {
    const adminCount = await prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPERADMIN'] } } });
    if (adminCount > 0) {
      return NextResponse.json({ error: 'Setup already complete. An admin already exists.' }, { status: 403 });
    }

    const p = verifyToken(req);
    if (!p) return NextResponse.json({ error: 'You must be logged in to run setup.' }, { status: 401 });

    await prisma.user.update({ where: { id: p.sub }, data: { role: 'ADMIN' } });

    return NextResponse.json({ ok: true, message: 'You are now ADMIN. Please log out and log back in.' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
