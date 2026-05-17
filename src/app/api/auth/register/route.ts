import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET ?? 'sge-dev-secret-change-in-prod';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, referralCode } = await req.json();

    if (!email || !password || password.length < 6)
      return NextResponse.json({ error: 'Valid email and password (min 6 chars) required' }, { status: 400 });

    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists)
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    // Find referrer
    let referredBy: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (referrer) referredBy = referrer.id;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name ?? email.split('@')[0],
        email: email.toLowerCase(),
        passwordHash,
        referredBy,
        wallet: { create: { balance: 50 } }, // 50 welcome coins
      },
      include: { wallet: true },
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
        balance: user.wallet?.balance ?? 50,
      },
    }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
