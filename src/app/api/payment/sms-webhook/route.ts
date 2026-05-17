import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';
import crypto from 'crypto';

const SMS_WEBHOOK_SECRET = process.env.SMS_WEBHOOK_SECRET ?? 'sge-sms-secret';

// UPI SMS patterns from Indian banks
// PhonePe:  "Rs.500.00 credited to VPA yourname@ybl on 15-05-26. Ref 423156789012"
// GPay:     "INR 500 received from +91XXXXXXXXXX. UPI Ref: 423156789012"
// Paytm:    "Rs 500 received from XXXXXXXXXX@paytm. Txn ID: 423156789012"
// HDFC:     "Rs.500.00 deposited in A/c...1234 by UPI Ref 423156789012"
// SBI:      "Your A/C...1234 credited with INR 500.00 on 15/05/26 UPI Ref 423156789012"
// ICICI:    "ICICI Bank Acct ...1234 credited Rs 500.00 on 15-05-26 by NEFT/UPI Ref 423156789012"

function parseUpiSMS(smsText: string): { amount: number; utr: string } | null {
  const text = smsText.toLowerCase();

  // Must be a credit SMS
  const isCredited = text.includes('credited') || text.includes('received') ||
    text.includes('deposited') || text.includes('credit');
  if (!isCredited) return null;

  // Extract amount — try multiple patterns
  const amountPatterns = [
    /(?:rs\.?|inr\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:rs\.?|inr\.?|₹)/i,
  ];
  let amount = 0;
  for (const pattern of amountPatterns) {
    const m = smsText.match(pattern);
    if (m) { amount = parseFloat(m[1].replace(/,/g, '')); break; }
  }
  if (!amount) return null;

  // Extract UTR/Ref number — 12 digits
  const utrPatterns = [
    /(?:upi\s*ref(?:erence)?[\s:.#]*|ref(?:erence)?[\s:.#]*|txn\s*id[\s:.#]*|transaction\s*id[\s:.#]*)([0-9]{12})/i,
    /\b([0-9]{12})\b/,
  ];
  let utr = '';
  for (const pattern of utrPatterns) {
    const m = smsText.match(pattern);
    if (m) { utr = m[1]; break; }
  }
  if (!utr) return null;

  return { amount: Math.floor(amount), utr };
}

// POST — called by Android SMS Gateway app when new SMS arrives
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sms, from, timestamp, secret } = body;

    // Verify secret key (set in Android app settings)
    if (secret !== SMS_WEBHOOK_SECRET) {
      console.error('SMS webhook: invalid secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`SMS from ${from}: ${sms}`);

    // Only process UPI/bank SMS
    const isUpiSMS = /upi|imps|neft|credited|received|deposited/i.test(sms);
    if (!isUpiSMS) return NextResponse.json({ ok: true, skipped: 'not a UPI SMS' });

    const parsed = parseUpiSMS(sms);
    if (!parsed) return NextResponse.json({ ok: true, skipped: 'could not parse amount/UTR' });

    const { amount, utr } = parsed;
    console.log(`Parsed UPI SMS: amount=₹${amount} utr=${utr}`);

    // Find pending transaction matching this amount
    // User submitted UTR when initiating payment
    const txn = await prisma.transaction.findFirst({
      where: {
        type: 'DEPOSIT',
        status: 'PENDING',
        amount: { gte: amount - 1, lte: amount + 1 }, // ±1 for paise rounding
        orderId: { contains: utr },       // UTR stored in orderId after user submits
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also try matching by amount only (if UTR not yet submitted)
    const txnByAmount = !txn ? await prisma.transaction.findFirst({
      where: {
        type: 'DEPOSIT',
        status: 'PENDING',
        amount: { gte: amount - 1, lte: amount + 1 },
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // within 30 mins
      },
      orderBy: { createdAt: 'desc' },
    }) : null;

    const matchedTxn = txn ?? txnByAmount;

    if (!matchedTxn) {
      console.log(`No pending transaction found for ₹${amount} UTR ${utr}`);
      return NextResponse.json({ ok: true, skipped: 'no matching pending transaction' });
    }

    // Prevent double-crediting
    const alreadyProcessed = await prisma.transaction.findFirst({
      where: { orderId: { contains: `UTR:${utr}` } },
    });
    if (alreadyProcessed) return NextResponse.json({ ok: true, skipped: 'already processed' });

    // ✅ Credit coins automatically
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: matchedTxn.id },
        data: {
          status: 'SUCCESS',
          coins: amount,
          orderId: `${matchedTxn.orderId ?? ''}|UTR:${utr}`,
        },
      }),
      prisma.wallet.update({
        where: { userId: matchedTxn.userId },
        data: {
          balance:      { increment: amount },
          totalDeposit: { increment: amount },
        },
      }),
    ]);

    console.log(`✅ Auto-credited ₹${amount} coins to user ${matchedTxn.userId} via SMS UTR ${utr}`);
    return NextResponse.json({ ok: true, credited: amount, userId: matchedTxn.userId });

  } catch (e: any) {
    console.error('SMS webhook error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
