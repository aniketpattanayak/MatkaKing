import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET ?? 'sge-dev-secret-change-in-prod';

const SIGNUP_BONUS_COINS = 50;
const REFERRER_BONUS_COINS = 20;
const REFEREE_EXTRA_COINS = 10;

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, referralCode, securityQuestions } = await req.json();

    if (!email || !password || password.length < 6)
      return NextResponse.json({ error: 'Valid email and password (min 6 chars) required' }, { status: 400 });

    // Only select columns that definitely exist in the DB
    const exists = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    if (exists) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    let referrer: { id: string } | null = null;
    if (referralCode && String(referralCode).trim()) {
      const code = String(referralCode).trim().toLowerCase();
      // SQLite doesn't support mode:'insensitive' — fetch by lowercase match
      referrer = await prisma.user.findFirst({
        where: { referralCode: code },
        select: { id: true },
      });
      // Also try uppercase in case code was stored differently
      if (!referrer) {
        referrer = await prisma.user.findFirst({
          where: { referralCode: code.toUpperCase() },
          select: { id: true },
        });
      }
      if (!referrer) return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
    }

    const initialBalance = SIGNUP_BONUS_COINS + (referrer ? REFEREE_EXTRA_COINS : 0);
    const passwordHash = await bcrypt.hash(password, 12);
    const displayName = (name ?? email.split('@')[0]) as string;

    // Hash security answers — only include if columns exist in DB
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

    // Attempt 1: create user with security data (works after migration)
    // Attempt 2: create user without security data (works before migration)
    let user: any;
    for (const extra of [secData, {}]) {
      try {
        user = await prisma.$transaction(async tx => {
          const u = await tx.user.create({
            data: {
              name: displayName,
              email: email.toLowerCase(),
              passwordHash,
              referredBy: referrer?.id,
              ...extra,
              wallet: { create: { balance: initialBalance } },
            },
            include: { wallet: true },
          });
          if (referrer) {
            await tx.wallet.update({ where: { userId: referrer.id }, data: { balance: { increment: REFERRER_BONUS_COINS } } });
            await tx.transaction.create({ data: { userId: referrer.id, type: 'WIN_CREDIT', status: 'SUCCESS', coins: REFERRER_BONUS_COINS, amount: 0, orderId: `REF-${u.id.slice(-6)}-${Date.now()}` } });
            await tx.transaction.create({ data: { userId: u.id, type: 'WIN_CREDIT', status: 'SUCCESS', coins: REFEREE_EXTRA_COINS, amount: 0, orderId: `REF-NEW-${u.id.slice(-6)}-${Date.now()}` } });
          }
          return u;
        });
        break; // success — stop trying
      } catch (e: any) {
        if (Object.keys(extra).length === 0) throw e; // both attempts failed — rethrow
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
