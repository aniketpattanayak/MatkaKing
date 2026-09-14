import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

export async function POST(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount, method, upiId, phoneNumber, bankAccount, bankIfsc, bankName } = await req.json();

  // ── Load admin-configured settings ──────────────────────────────────────
  const [minSetting, maxSetting, perDaySetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'minWithdraw' } }),
    prisma.setting.findUnique({ where: { key: 'maxWithdraw' } }),
    prisma.setting.findUnique({ where: { key: 'withdrawPerDay' } }),
  ]);
  const MIN_WITHDRAW   = parseInt(minSetting?.value   ?? '100');
  const MAX_WITHDRAW   = parseInt(maxSetting?.value   ?? '50000');
  const MAX_PER_DAY    = parseInt(perDaySetting?.value ?? '1');

  // ── Basic validation ──────────────────────────────────────────────────────
  if (!amount || amount < MIN_WITHDRAW)
    return NextResponse.json({ error: `Minimum withdrawal is ₹${MIN_WITHDRAW}` }, { status: 400 });
  if (amount > MAX_WITHDRAW)
    return NextResponse.json({ error: `Maximum withdrawal is ₹${MAX_WITHDRAW}` }, { status: 400 });
  if (!method || !['UPI','PHONEPE','BANK'].includes(method))
    return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
  if (method === 'UPI'     && !upiId)       return NextResponse.json({ error: 'UPI ID required' }, { status: 400 });
  if (method === 'PHONEPE' && !phoneNumber) return NextResponse.json({ error: 'PhonePe number required' }, { status: 400 });
  if (method === 'BANK'    && (!bankAccount || !bankIfsc))
    return NextResponse.json({ error: 'Bank account and IFSC required' }, { status: 400 });

  try {
    // ── Check daily withdrawal count ──────────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.transaction.count({
      where: {
        userId:    p.sub,
        type:      'WITHDRAWAL',
        createdAt: { gte: todayStart },
      },
    });
    if (todayCount >= MAX_PER_DAY) {
      return NextResponse.json({
        error: `You have reached your daily withdrawal limit (${MAX_PER_DAY} per day). Please try again tomorrow.`,
        limitReached: true,
        usedToday: todayCount,
        limitPerDay: MAX_PER_DAY,
      }, { status: 429 });
    }

    // ── Check balance ─────────────────────────────────────────────────────
    const wallet = await prisma.wallet.findUnique({ where: { userId: p.sub } });
    if (!wallet || wallet.balance < amount)
      return NextResponse.json({
        error: `Insufficient balance. Available: ₹${wallet?.balance ?? 0}`,
      }, { status: 400 });

    // Build payout details string for orderId
    const details = method === 'UPI'     ? `UPI:${upiId}`
                  : method === 'PHONEPE' ? `PHONEPE:${phoneNumber}`
                  : `BANK:${bankAccount}:${bankIfsc}`;

    // ── Atomic: deduct balance + record withdrawal ─────────────────────────
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: p.sub },
        data: { balance: { decrement: amount }, totalWithdraw: { increment: amount } },
      }),
      prisma.transaction.create({
        data: {
          userId:  p.sub,
          type:    'WITHDRAWAL',
          status:  'PENDING',
          coins:   amount,
          amount:  0,
          orderId: `WD-${method}-${details}-${Date.now()}`,
        },
      }),
    ]);

    const remaining = MAX_PER_DAY - todayCount - 1;
    return NextResponse.json({
      ok: true,
      message: `Withdrawal of ₹${amount} submitted! Admin will process within 24 hours.`,
      remainingToday: remaining,
      limitPerDay: MAX_PER_DAY,
    });
  } catch (e: any) {
    console.error('withdraw error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    // Also return today's count and limit so frontend can show remaining
    const [txns, perDaySetting] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: p.sub, type: 'WITHDRAWAL' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.setting.findUnique({ where: { key: 'withdrawPerDay' } }),
    ]);
    const MAX_PER_DAY = parseInt(perDaySetting?.value ?? '1');
    const todayStart  = new Date(); todayStart.setHours(0, 0, 0, 0);
    const usedToday   = txns.filter(t => new Date(t.createdAt) >= todayStart).length;
    return NextResponse.json({
      withdrawals: txns,
      usedToday,
      limitPerDay: MAX_PER_DAY,
      remainingToday: Math.max(0, MAX_PER_DAY - usedToday),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, withdrawals: [] });
  }
}

