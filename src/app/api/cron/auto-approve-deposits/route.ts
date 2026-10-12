import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? 'kh-cron-2026'}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const pending = await prisma.transaction.findMany({
    where: {
      type:      'DEPOSIT',
      status:    'PENDING',
      orderId:   { contains: 'UTR:' },
      createdAt: { lte: twoMinutesAgo },
    },
    take: 50,
  });

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, approved: 0, message: 'No pending UTR deposits' });
  }

  let approved = 0;
  for (const txn of pending) {
    try {
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: txn.id },
          data:  { status: 'SUCCESS', coins: txn.amount },
        }),
        prisma.wallet.update({
          where: { userId: txn.userId },
          data: {
            balance:      { increment: txn.amount },
            totalDeposit: { increment: txn.amount },
          },
        }),
      ]);
      approved++;
      console.log(`[auto-approve] Approved txn ${txn.id} for user ${txn.userId}`);
    } catch (e: any) {
      console.error(`[auto-approve] Failed txn ${txn.id}:`, e.message);
    }
  }

  return NextResponse.json({ ok: true, approved, total: pending.length });
}
