import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET ?? 'sge-dev-secret-change-in-prod';

const SIGNUP_BONUS_COINS = 50;          // existing
const REFERRER_BONUS_COINS = 20;        // referrer gets 20 coins
const REFEREE_EXTRA_COINS = 10;         // new user who used a code gets 10 extra

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, referralCode } = await req.json();

    if (!email || !password || password.length < 6)
      return NextResponse.json({ error: 'Valid email and password (min 6 chars) required' }, { status: 400 });

    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists)
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    // Look up referrer if a code was supplied
    let referrer: { id: string } | null = null;
    if (referralCode && String(referralCode).trim() !== '') {
      referrer = await prisma.user.findUnique({
        where: { referralCode: String(referralCode).trim() },
        select: { id: true },
      });
      if (!referrer) {
        return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
      }
    }

    const initialBalance = SIGNUP_BONUS_COINS + (referrer ? REFEREE_EXTRA_COINS : 0);
    const passwordHash = await bcrypt.hash(password, 12);

    // Create the user + wallet, and credit the referrer if applicable
    const user = await prisma.$transaction(async tx => {
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
        // Credit referrer with bonus coins
        await tx.wallet.update({
          where: { userId: referrer.id },
          data: { balance: { increment: REFERRER_BONUS_COINS } },
        });
        // Audit trail for the referrer
        await tx.transaction.create({
          data: {
            userId: referrer.id,
            type: 'WIN_CREDIT',
            status: 'SUCCESS',
            coins: REFERRER_BONUS_COINS,
            amount: 0,
            orderId: `REF-${u.id.slice(-6)}-${Date.now()}`,
          },
        });
        // Audit trail for the new user's bonus
        await tx.transaction.create({
          data: {
            userId: u.id,
            type: 'WIN_CREDIT',
            status: 'SUCCESS',
            coins: REFEREE_EXTRA_COINS,
            amount: 0,
            orderId: `REF-NEW-${u.id.slice(-6)}-${Date.now()}`,
          },
        });
      }

      return u;
    });

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        balance: user.wallet?.balance ?? initialBalance,
        referralCode: user.referralCode,
      },
      referralApplied: !!referrer,
      referrerBonusAwarded: referrer ? REFERRER_BONUS_COINS : 0,
    }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
