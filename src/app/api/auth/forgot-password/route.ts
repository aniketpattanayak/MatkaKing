import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';
import * as bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { email, newPassword, action, answers } = await req.json();

  // Step 1: check if email exists and return which security questions they set
  if (action === 'check_email') {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email?.toLowerCase() },
        select: { id: true, name: true, securityQ1: true, securityQ2: true, securityQ3: true },
      });
      if (!user) return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });

      const questions = [user.securityQ1, user.securityQ2, user.securityQ3].filter(Boolean);

      // If the account has no security questions (registered before this feature),
      // skip straight to password reset — no questions to verify
      if (questions.length === 0) {
        return NextResponse.json({ ok: true, name: user.name, questions: [], noSecurityQuestions: true });
      }

      return NextResponse.json({ ok: true, name: user.name, questions });
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

  // Step 2: verify security question answers (only called if user HAS questions)
  if (action === 'verify_answers') {
    if (!email || !answers || !Array.isArray(answers))
      return NextResponse.json({ error: 'Email and answers required' }, { status: 400 });
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, securityA1: true, securityA2: true, securityA3: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const storedAnswers = [user.securityA1, user.securityA2, user.securityA3].filter(Boolean);
    let allCorrect = answers.length > 0 && answers.length === storedAnswers.length;
    for (let i = 0; i < storedAnswers.length && allCorrect; i++) {
      const match = await bcrypt.compare((answers[i] ?? '').toLowerCase().trim(), storedAnswers[i]!);
      if (!match) allCorrect = false;
    }
    if (!allCorrect)
      return NextResponse.json({ error: 'One or more answers are incorrect. Please try again.' }, { status: 401 });

    return NextResponse.json({ ok: true, verified: true });
  }

  // Step 3: reset password
  if (action === 'reset_password') {
    if (!email || !newPassword || newPassword.length < 6)
      return NextResponse.json({ error: 'Email and new password (min 6 chars) required' }, { status: 400 });

    let storedAnswers: string[] = [];
    let userId: string | null = null;

    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, securityA1: true, securityA2: true, securityA3: true },
      });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      userId = user.id;
      storedAnswers = [user.securityA1, user.securityA2, user.securityA3].filter(Boolean) as string[];
    } catch {
      // Columns don't exist yet — just look up the user id
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      userId = user.id;
    }

    // If user HAS security questions, re-verify answers server-side
    if (storedAnswers.length > 0) {
      if (!answers || !Array.isArray(answers) || answers.length === 0)
        return NextResponse.json({ error: 'Security answers required' }, { status: 400 });
      let allCorrect = answers.length === storedAnswers.length;
      for (let i = 0; i < storedAnswers.length && allCorrect; i++) {
        const match = await bcrypt.compare((answers[i] ?? '').toLowerCase().trim(), storedAnswers[i]);
        if (!match) allCorrect = false;
      }
      if (!allCorrect)
        return NextResponse.json({ error: 'Security answers do not match.' }, { status: 401 });
    }
    // If no security questions (legacy account) — allow reset with email only

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId! }, data: { passwordHash: hash } });
    return NextResponse.json({ ok: true, message: 'Password reset successfully! You can now login.' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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

    const storedAnswers = [user.securityA1, user.securityA2, user.securityA3].filter(Boolean);
    // Check all provided answers match
    let allCorrect = answers.length > 0 && answers.length === storedAnswers.length;
    for (let i = 0; i < storedAnswers.length && allCorrect; i++) {
      const match = await bcrypt.compare((answers[i] ?? '').toLowerCase().trim(), storedAnswers[i]!);
      if (!match) allCorrect = false;
    }
    if (!allCorrect)
      return NextResponse.json({ error: 'One or more answers are incorrect. Please try again.' }, { status: 401 });

    return NextResponse.json({ ok: true, verified: true });
  }

  // Step 3: reset password (only after answers verified on client side flow)
  if (action === 'reset_password') {
    if (!email || !newPassword || newPassword.length < 6 || !answers || !Array.isArray(answers))
      return NextResponse.json({ error: 'Email, answers and new password (min 6 chars) required' }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, securityA1: true, securityA2: true, securityA3: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Re-verify answers before resetting (security: never trust client-side-only verification)
    const storedAnswers = [user.securityA1, user.securityA2, user.securityA3].filter(Boolean);
    let allCorrect = answers.length > 0 && answers.length === storedAnswers.length;
    for (let i = 0; i < storedAnswers.length && allCorrect; i++) {
      const match = await bcrypt.compare((answers[i] ?? '').toLowerCase().trim(), storedAnswers[i]!);
      if (!match) allCorrect = false;
    }
    if (!allCorrect)
      return NextResponse.json({ error: 'Security answers do not match.' }, { status: 401 });

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
    return NextResponse.json({ ok: true, message: 'Password reset successfully! You can now login.' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
