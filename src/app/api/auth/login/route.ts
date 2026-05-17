import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, JWT_SECRET, json } from '@/lib/api-helper';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return json({ error: 'Email and password required' }, 400);

    // Select only fields we actually need — skip heavy columns
    const user = await prisma.user.findUnique({
      where:  { email: email.toLowerCase().trim() },
      select: {
        id:           true,
        name:         true,
        email:        true,
        role:         true,
        passwordHash: true,
        isActive:     true,
        referralCode: true,
        wallet:       { select: { balance: true } },
      },
    });

    // Compare password in parallel with response preparation
    // bcrypt.compare is CPU-bound — await it only after finding the user
    if (!user || !await bcrypt.compare(password, user.passwordHash))
      return json({ error: 'Invalid email or password' }, 401);

    if (!user.isActive) return json({ error: 'Account suspended' }, 403);

    // Sign token — role embedded so future requests skip DB lookup
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return json({
      token,
      user: {
        id:           user.id,
        name:         user.name ?? 'Player',
        email:        user.email,
        role:         user.role,
        balance:      user.wallet?.balance ?? 0,
        referralCode: user.referralCode,
      },
    });
  } catch (e) {
    console.error('login error:', e);
    return json({ error: 'Server error' }, 500);
  }
}
