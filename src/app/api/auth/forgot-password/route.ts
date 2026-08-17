import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';
import * as bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { email, newPassword, action } = await req.json();

  if (action === 'check_email') {
    // Step 1: check if email exists
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
    if (!user) return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
    return NextResponse.json({ ok: true, name: user.name });
  }

  if (action === 'reset_password') {
    if (!email || !newPassword || newPassword.length < 6)
      return NextResponse.json({ error: 'Email and new password (min 6 chars) required' }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
    return NextResponse.json({ ok: true, message: 'Password reset successfully! You can now login.' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
