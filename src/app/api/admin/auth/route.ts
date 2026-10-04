import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const admin = isAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { action, newEmail, newPassword, currentPassword } = await req.json();

  const user = await prisma.user.findUnique({ where: { id: admin.sub }, select: { id:true, passwordHash:true, email:true } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Verify current password first
  const valid = await bcrypt.compare(currentPassword || '', user.passwordHash);
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

  try {
    if (action === 'changeEmail') {
      const exists = await prisma.user.findUnique({ where: { email: newEmail.toLowerCase() } });
      if (exists && exists.id !== user.id) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      await prisma.user.update({ where: { id: user.id }, data: { email: newEmail.toLowerCase() } });
      return NextResponse.json({ ok: true, message: 'Email updated successfully' });
    }
    if (action === 'changePassword') {
      if (!newPassword || newPassword.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      const hash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
      return NextResponse.json({ ok: true, message: 'Password updated successfully' });
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
