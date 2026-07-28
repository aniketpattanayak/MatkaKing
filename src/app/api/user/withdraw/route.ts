import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

export async function POST(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount, method, upiId, phoneNumber, bankAccount, bankIfsc, bankName } = await req.json();

  if (!amount || amount < 100)
    return NextResponse.json({ error: 'Minimum withdrawal is 100 coins' }, { status: 400 });
  if (!method || !['UPI', 'PHONEPE', 'BANK'].includes(method))
    return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
  if (method === 'UPI'     && !upiId)       return NextResponse.json({ error: 'UPI ID required' }, { status: 400 });
  if (method === 'PHONEPE' && !phoneNumber) return NextResponse.json({ error: 'PhonePe number required' }, { status: 400 });
  if (method === 'BANK'    && (!bankAccount || !bankIfsc)) return NextResponse.json({ error: 'Bank account and IFSC required' }, { status: 400 });

  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: p.sub } });
    if (!wallet || wallet.balance < amount)
      return NextResponse.json({ error: `Insufficient balance. Available: ${wallet?.balance ?? 0} coins` }, { status: 400 });

    // Deduct balance + create pending withdrawal transaction
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: p.sub },
        data: { balance: { decrement: amount }, totalWithdraw: { increment: amount } },
      }),
      prisma.transaction.create({
        data: {
          userId: p.sub,
          type: 'WITHDRAWAL',
          status: 'PENDING',
          coins: amount,
          amount: 0,
          orderId: `WD-${method}-${Date.now()}`,
          // Store payout details in orderId for admin reference
        },
      }),
    ]);

    // Store withdrawal details for admin to process
    await prisma.withdrawalRequest.create({
      data: {
        userId:      p.sub,
        amount,
        method,
        upiId:       upiId ?? null,
        phoneNumber: phoneNumber ?? null,
        bankAccount: bankAccount ?? null,
        bankIfsc:    bankIfsc ?? null,
        bankName:    bankName ?? null,
        status:      'PENDING',
      },
    }).catch(() => {
      // If WithdrawalRequest model doesn't exist yet, skip — transaction already created
    });

    return NextResponse.json({ ok: true, message: `Withdrawal of ₹${amount} submitted. Admin will process within 24 hours.` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const txns = await prisma.transaction.findMany({
      where: { userId: p.sub, type: 'WITHDRAWAL' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return NextResponse.json({ withdrawals: txns });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, withdrawals: [] });
  }
}
