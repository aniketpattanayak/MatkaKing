import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';
import * as bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { email, newPassword, action, answers } = await req.json();

  // Step 1: find account and return security questions (if any)
  if (action === 'check_email') {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email?.toLowerCase() },
        select: { id: true, name: true, securityQ1: true, securityQ2: true, securityQ3: true },
      });
      if (!user) return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
      const questions = [user.securityQ1, user.securityQ2, user.securityQ3].filter(Boolean);
      // Legacy accounts (no security questions) → skip straight to reset
      return NextResponse.json({ ok: true, name: user.name, questions, noSecurityQuestions: questions.length === 0 });
    } catch {
      // securityQ columns may not exist in remote DB yet — fall back to email-only reset
      const user = await prisma.user.findUnique({
        where: { email: email?.toLowerCase() },
        select: { id: true, name: true },
      });
      if (!user) return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
      return NextResponse.json({ ok: true, name: user.name, questions: [], noSecurityQuestions: true });
    }
  }

  // Step 2: verify security question answers
  if (action === 'verify_answers') {
    if (!email || !answers || !Array.isArray(answers))
      return NextResponse.json({ error: 'Email and answers required' }, { status: 400 });
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, securityA1: true, securityA2: true, securityA3: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const stored = [user.securityA1, user.securityA2, user.securityA3].filter(Boolean) as string[];
    let ok = answers.length > 0 && answers.length === stored.length;
    for (let i = 0; i < stored.length && ok; i++) {
      const match = await bcrypt.compare((answers[i] ?? '').toLowerCase().trim(), stored[i]);
      if (!match) ok = false;
    }
    if (!ok) return NextResponse.json({ error: 'One or more answers are incorrect. Please try again.' }, { status: 401 });
    return NextResponse.json({ ok: true, verified: true });
  }

  // Step 3: reset password
  if (action === 'reset_password') {
    if (!email || !newPassword || newPassword.length < 6)
      return NextResponse.json({ error: 'Email and new password (min 6 chars) required' }, { status: 400 });

    let userId: string | null = null;
    let stored: string[] = [];

    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, securityA1: true, securityA2: true, securityA3: true },
      });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      userId = user.id;
      stored = [user.securityA1, user.securityA2, user.securityA3].filter(Boolean) as string[];
    } catch {
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      userId = user.id;
    }

    // Re-verify answers if the account has security questions
    if (stored.length > 0) {
      if (!answers || !Array.isArray(answers) || answers.length === 0)
        return NextResponse.json({ error: 'Security answers required' }, { status: 400 });
      let ok = answers.length === stored.length;
      for (let i = 0; i < stored.length && ok; i++) {
        const match = await bcrypt.compare((answers[i] ?? '').toLowerCase().trim(), stored[i]);
        if (!match) ok = false;
      }
      if (!ok) return NextResponse.json({ error: 'Security answers do not match.' }, { status: 401 });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId! }, data: { passwordHash: hash } });
    return NextResponse.json({ ok: true, message: 'Password reset successfully! You can now login.' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
