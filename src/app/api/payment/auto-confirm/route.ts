import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

// Must match PaytmNotificationListener.java APP_SECRET constant
const NOTIF_APP_SECRET = process.env.NOTIF_APP_SECRET ?? 'kh-notif-2026-secret';

/**
 * Called by the KismatHub Android app when it detects a Paytm
 * "money received" notification on the admin's phone.
 *
 * Body: { amount: number, utr: string | null, rawText: string }
 *
 * Matching priority:
 *  1. Exact UTR match  — orderId contains "UTR:<utr>"
 *  2. Amount match     — most recent PENDING DEPOSIT with coins == amount
 *                        (only if there is exactly ONE such transaction in the last 2 hours)
 */
export async function POST(req: NextRequest) {
  // ── Auth: only our Android app can call this ─────────────────────────────
  const secret = req.headers.get('X-Notif-Secret');
  if (secret !== NOTIF_APP_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { amount, utr, rawText } = await req.json();

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'amount required' }, { status: 400 });
  }

  const roundedAmount = Math.round(amount);

  // ── 1. Try exact UTR match ────────────────────────────────────────────────
  let txn = null;

  if (utr && /^\d{12}$/.test(utr)) {
    txn = await prisma.transaction.findFirst({
      where: {
        type:   'DEPOSIT',
        status: 'PENDING',
        orderId: { contains: `UTR:${utr}` },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── 2. Fallback: amount match (last 2 hours, must be unambiguous) ─────────
  if (!txn) {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const candidates = await prisma.transaction.findMany({
      where: {
        type:      'DEPOSIT',
        status:    'PENDING',
        amount:    roundedAmount,
        createdAt: { gte: twoHoursAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (candidates.length === 1) {
      txn = candidates[0];
    } else if (candidates.length > 1) {
      // Ambiguous — log it and let admin confirm manually
      console.warn(`[auto-confirm] Ambiguous: ${candidates.length} PENDING deposits for ₹${roundedAmount}. Raw: ${rawText}`);
      return NextResponse.json({
        ok: false,
        reason: 'ambiguous',
        message: `${candidates.length} pending deposits match ₹${roundedAmount}. Please confirm manually.`,
      });
    }
  }

  if (!txn) {
    console.log(`[auto-confirm] No match for ₹${roundedAmount} UTR:${utr ?? 'none'}`);
    return NextResponse.json({
      ok: false,
      reason: 'no_match',
      message: 'No matching pending deposit found.',
    });
  }

  // ── 3. Approve the transaction ────────────────────────────────────────────
  try {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: txn.id },
        data:  { status: 'SUCCESS', coins: txn.amount },
      }),
      prisma.wallet.update({
        where: { userId: txn.userId },
        data:  {
          balance:      { increment: txn.amount },
          totalDeposit: { increment: txn.amount },
        },
      }),
    ]);

    console.log(`[auto-confirm] ✅ Confirmed txn ${txn.id} — ₹${txn.amount} for user ${txn.userId} (UTR: ${utr ?? 'amount-match'})`);

    return NextResponse.json({
      ok:        true,
      txnId:     txn.id,
      userId:    txn.userId,
      coins:     txn.amount,
      matchedBy: utr ? 'utr' : 'amount',
      message:   `₹${txn.amount} auto-credited to user`,
    });
  } catch (e: any) {
    console.error('[auto-confirm] DB error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
