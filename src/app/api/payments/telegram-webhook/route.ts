import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const BOT_TOKEN  = '8888200645:AAGvhdTQ2N87WDFke-ePT4vPi75Er6SBvOg';
const ADMIN_CHAT = 1438285107;

function parseSMS(text: string): { amountPaise: number; utr: string } | null {
  const amtMatch = text.match(/INR\s+([\d,]+\.?\d*)\s+deposited/i);
  const utrMatch = text.match(/UPI\/CR\/([A-Z0-9]+)\//i);
  if (!amtMatch || !utrMatch) return null;
  const amountPaise = Math.round(parseFloat(amtMatch[1].replace(/,/g, '')) * 100);
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

    if (chatId !== ADMIN_CHAT) return NextResponse.json({ ok: true });
    if (!text.toLowerCase().includes('deposited')) return NextResponse.json({ ok: true });

    const parsed = parseSMS(text);
    if (!parsed) {
      await sendTelegram(`❌ Could not parse SMS.\n\nForward the exact Bandhan Bank UPI credit SMS.`);
      return NextResponse.json({ ok: true });
    }

    const { amountPaise, utr } = parsed;
    const rupees = (amountPaise / 100).toFixed(2);

    // Match by UTR + amount
    let txn = await prisma.transaction.findFirst({
      where: { type: 'deposit', status: 'PENDING', upiRef: utr, amount: amountPaise },
      include: { user: true },
    });

    // Fallback: match by amount only
    if (!txn) {
      txn = await prisma.transaction.findFirst({
        where: { type: 'deposit', status: 'PENDING', amount: amountPaise },
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      });

      if (!txn) {
        await sendTelegram(`⚠️ No pending deposit found\n\n🔑 UTR: <code>${utr}</code>\n💰 Amount: ₹${rupees}\n\nAlready approved or no matching request.`);
        return NextResponse.json({ ok: true });
      }

      await sendTelegram(
        `⚠️ UTR mismatch — matched by amount only:\n\n` +
        `👤 User: ${txn.user?.name || txn.userId}\n` +
        `💰 Amount: ₹${rupees}\n` +
        `🔑 SMS UTR: <code>${utr}</code>\n` +
        `🔑 DB UTR: <code>${txn.upiRef || 'not entered'}</code>\n\n` +
        `Reply <code>APPROVE ${txn.id}</code> to manually approve.`
      );
      return NextResponse.json({ ok: true });
    }

    // Auto approve
    await prisma.transaction.update({
      where: { id: txn.id },
      data: { status: 'APPROVED', upiRef: utr, processedAt: new Date(), coins: amountPaise },
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
    await sendTelegram(`🔴 Error: ${err.message}`);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
