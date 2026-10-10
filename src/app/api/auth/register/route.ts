import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

function genReferralCode() {
  return randomBytes(5).toString('hex').toUpperCase();
}
const JWT_SECRET = process.env.JWT_SECRET ?? 'sge-dev-secret-change-in-prod';

const SIGNUP_BONUS_COINS = 50;
const REFERRER_BONUS_COINS = 20;
const REFEREE_EXTRA_COINS = 10;

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, referralCode, securityQuestions } = await req.json();

    if (!email || !password || password.length < 6)
      return NextResponse.json({ error: 'Valid email and password (min 6 chars) required' }, { status: 400 });

    const exists = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    if (exists) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    // Check username uniqueness via JS (LibSQL does not support mode: insensitive)
    if (name && name.trim()) {
      const nameLower = name.trim().toLowerCase();
      const allWithName = await prisma.user.findMany({
        where: { name: { not: null } },
        select: { id: true, name: true },
      });
      const nameExists = allWithName.some(u => (u.name ?? '').toLowerCase() === nameLower);
      if (nameExists) return NextResponse.json({ error: 'Username already taken. Please choose a different name.' }, { status: 409 });
    }

    let referrer: { id: string } | null = null;
    if (referralCode && String(referralCode).trim()) {
      // Normalize: trim, remove spaces/dashes, uppercase
      const raw = String(referralCode).trim().replace(/[\s\-]/g, '').toUpperCase();
      const allUsers = await prisma.user.findMany({ select: { id: true, referralCode: true } });
      const match = allUsers.find(u => {
        if (!u.referralCode) return false;
        const stored = u.referralCode.replace(/[\s\-]/g, '').toUpperCase();
        return stored === raw ||
               stored.slice(0, 10) === raw.slice(0, 10) ||
               stored.startsWith(raw) ||
               raw.startsWith(stored);
      });
      referrer = match ? { id: match.id } : null;
      if (!referrer) return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
    }

    const initialBalance = SIGNUP_BONUS_COINS + (referrer ? REFEREE_EXTRA_COINS : 0); // New user gets +10 bonus coins for using a referral code
    const passwordHash = await bcrypt.hash(password, 12);
    const displayName = (name ?? email.split('@')[0]) as string;

    const sq = Array.isArray(securityQuestions) ? securityQuestions : [];
    const secData: Record<string, string> = {};
    for (let i = 0; i < Math.min(sq.length, 3); i++) {
      const q = sq[i];
      if (q?.question && q?.answer) {
        const key = i + 1;
        secData[`securityQ${key}`] = String(q.question);
        secData[`securityA${key}`] = await bcrypt.hash(String(q.answer).toLowerCase().trim(), 10);
      }
    }

    let user: any;
    for (const extra of [secData, {}]) {
      try {
        user = await prisma.$transaction(async tx => {
          const u = await tx.user.create({
            data: {
              name: displayName,
              email: email.toLowerCase(),
              passwordHash,
              referralCode: genReferralCode(),
              referredBy: referrer?.id,
              ...extra,
              wallet: { create: { balance: initialBalance } },
            },
            include: { wallet: true },
          });
          if (referrer) {
            await tx.wallet.update({ where: { userId: referrer.id }, data: { balance: { increment: REFERRER_BONUS_COINS + REFEREE_EXTRA_COINS } } });
            await tx.transaction.create({ data: { userId: referrer.id, type: 'WIN_CREDIT', status: 'SUCCESS', coins: REFERRER_BONUS_COINS + REFEREE_EXTRA_COINS, amount: 0, orderId: `REF-${u.id.slice(-6)}-${Date.now()}` } });
            // +10 bonus coins for new user who used a referral code (already included in initialBalance)
            await tx.transaction.create({ data: { userId: u.id, type: 'REFERRAL', status: 'SUCCESS', coins: REFEREE_EXTRA_COINS, amount: 0, orderId: `REF-BONUS-${u.id.slice(-6)}-${Date.now()}` } });
          }
          return u;
        });
        break;
      } catch (e: any) {
        if (Object.keys(extra).length === 0) throw e;
        console.warn('Register: security columns missing, retrying without them');
      }
    }

    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, balance: user.wallet?.balance ?? initialBalance, referralCode: user.referralCode },
      referralApplied: !!referrer,
    }, { status: 201 });

  } catch (e: any) {
    console.error('Register error:', e?.message ?? e);
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
