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

    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists)
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    // Look up referrer if a code was supplied
    let referrer: { id: string } | null = null;
    if (referralCode && String(referralCode).trim() !== '') {
      const code = String(referralCode).trim();
      referrer = await prisma.user.findFirst({ where: { referralCode: code }, select: { id: true } });
      if (!referrer) return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
    }

    // Hash security question answers — safe even if columns don't exist in DB yet
    const hashAnswer = async (ans: string) => bcrypt.hash(ans.toLowerCase().trim(), 10);
    const sq = Array.isArray(securityQuestions) ? securityQuestions : [];
    const secData: any = {};
    try {
      if (sq[0]?.question && sq[0]?.answer) { secData.securityQ1 = sq[0].question; secData.securityA1 = await hashAnswer(sq[0].answer); }
      if (sq[1]?.question && sq[1]?.answer) { secData.securityQ2 = sq[1].question; secData.securityA2 = await hashAnswer(sq[1].answer); }
      if (sq[2]?.question && sq[2]?.answer) { secData.securityQ3 = sq[2].question; secData.securityA3 = await hashAnswer(sq[2].answer); }
    } catch { /* hashing failed — skip security questions */ }

    const initialBalance = SIGNUP_BONUS_COINS + (referrer ? REFEREE_EXTRA_COINS : 0);
    const passwordHash = await bcrypt.hash(password, 12);

    // Try to create user WITH security data first
    // If securityQ columns don't exist in remote DB, fall back without them
    let user: any;
    try {
      user = await prisma.$transaction(async tx => {
        const u = await tx.user.create({
          data: {
            name: name ?? email.split('@')[0],
            email: email.toLowerCase(),
            passwordHash,
            referredBy: referrer?.id,
            ...secData,
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
    } catch (e: any) {
      // If error mentions unknown field (securityQ columns missing in remote DB), retry WITHOUT security data
      if (e?.message?.includes('securityQ') || e?.message?.includes('Unknown field') || e?.code === 'P2009') {
        user = await prisma.$transaction(async tx => {
          const u = await tx.user.create({
            data: {
              name: name ?? email.split('@')[0],
              email: email.toLowerCase(),
              passwordHash,
              referredBy: referrer?.id,
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
      } else {
        throw e; // rethrow unrelated errors
      }
    }

    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, balance: user.wallet?.balance ?? initialBalance, referralCode: user.referralCode },
      referralApplied: !!referrer,
      referrerBonusAwarded: referrer ? REFERRER_BONUS_COINS : 0,
    }, { status: 201 });

  } catch (e) {
    console.error('Register error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
