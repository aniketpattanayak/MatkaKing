import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const BOT_TOKEN   = '8888200645:AAGvhdTQ2N87WDFke-ePT4vPi75Er6SBvOg';
const ADMIN_CHAT  = 1438285107;

// Parse Bandhan Bank UPI credit SMS
// "INR 1.00 deposited to A/c XXXXXXXXXX7784 towards UPI/CR/C653397209140/ANIKET P on 30-SEP-2026"
function parseSMS(text: string): { amountPaise: number; utr: string } | null {
  const amtMatch = text.match(/INR\s+([\d,]+\.?\d*)\s+deposited/i);
  const utrMatch = text.match(/UPI\/CR\/([A-Z0-9]+)\//i);
  if (!amtMatch || !utrMatch) return null;
  const rupees     = parseFloat(amtMatch[1].replace(/,/g, ''));
  const amountPaise = Math.round(rupees * 100);
  return { amountPaise, utr: utrMatch[1] };
}

async function sendTelegram(text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: ADMIN_CHAT, text, parse_mode: 'HTML' }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const msg    = body?.message;
    const text   = (msg?.text || '') as string;
    const chatId = msg?.chat?.id;

    // Only from admin
    if (chatId !== ADMIN_CHAT) return NextResponse.json({ ok: true });

    // Must look like a bank credit SMS
    if (!text.toLowerCase().includes('deposited')) return NextResponse.json({ ok: true });

    const parsed = parseSMS(text);
    if (!parsed) {
      await sendTelegram(`❌ Could not parse SMS.\n\nMake sure it's a Bandhan Bank UPI credit message.`);
      return NextResponse.json({ ok: true });
    }

    const { amountPaise, utr } = parsed;
    const rupees = amountPaise / 100;

    // Find pending deposit — match by upiRef + amount
    let txn = await prisma.transaction.findFirst({
      where: { type: 'deposit', status: 'PENDING', upiRef: utr, amount: amountPaise },
      include: { user: true },
    });

    // Fallback: match by amount only (user entered wrong UTR)
    if (!txn) {
      txn = await prisma.transaction.findFirst({
        where: { type: 'deposit', status: 'PENDING', amount: amountPaise },
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      });

      if (!txn) {
        await sendTelegram(
          `⚠️ No pending deposit found\n\n🔑 UTR: <code>${utr}</code>\n💰 Amount: ₹${rupees}\n\nMay already be approved or no matching request.`
        );
        return NextResponse.json({ ok: true });
      }

      // Found by amount — notify admin, don't auto-approve
      await sendTelegram(
        `⚠️ UTR mismatch — found deposit by amount only:\n\n` +
        `👤 User: ${txn.user?.name || txn.userId}\n` +
        `💰 Amount: ₹${rupees}\n` +
        `🔑 SMS UTR: <code>${utr}</code>\n` +
        `🔑 DB UTR: <code>${txn.upiRef || 'not entered'}</code>\n\n` +
        `Reply: <code>APPROVE ${txn.id}</code> to manually approve.`
      );
      return NextResponse.json({ ok: true });
    }

    // Auto approve — update transaction status + add coins
    const coinsToAdd = amountPaise; // 1 paise = 1 coin (adjust if different)

    await prisma.transaction.update({
      where: { id: txn.id },
      data: {
        status: 'APPROVED',
        upiRef: utr,
        processedAt: new Date(),
        coins: coinsToAdd,
      },
    });

    // Credit coins to user via a credit transaction
    await prisma.transaction.create({
      data: {
        userId: txn.userId,
        type: 'credit',
        status: 'APPROVED',
        amount: amountPaise,
        coins: coinsToAdd,
        processedAt: new Date(),
      },
    });

    await sendTelegram(
      `✅ <b>Auto-Approved!</b>\n\n` +
      `👤 User: ${txn.user?.name || txn.userId}\n` +
      `📧 Email: ${txn.user?.email || '-'}\n` +
      `💰 Amount: ₹${rupees}\n` +
      `🔑 UTR: <code>${utr}</code>\n\n` +
      `Wallet credited ✅`
    );

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error('Telegram webhook error:', err);
    await sendTelegram(`🔴 Server error: ${err.message}`);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
