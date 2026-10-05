import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN  || '8888200645:AAGvhdTQ2N87WDFke-ePT4vPi75Er6SBvOg';
const ADMIN_CHAT = parseInt(process.env.TELEGRAM_ADMIN_CHAT || '1438285107', 10);

async function sendTelegram(text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_CHAT, text, parse_mode: 'HTML' }),
    });
  } catch (e) { console.error('sendTelegram failed', e); }
}

// Bandhan Bank SMS: "INR 500 deposited to your A/c XX1234 by UPI/CR/423156789012/ on 06-10-2026"
function parseBandhanSMS(text: string): { amountInr: number; utr: string } | null {
  const amtMatch = text.match(/INR\s+([\d,]+\.?\d*)\s+deposited/i);
  const utrMatch = text.match(/UPI\/CR\/([A-Z0-9]+)\//i);
  if (!amtMatch || !utrMatch) return null;
  const amountInr = Math.round(parseFloat(amtMatch[1].replace(/,/g, '')));
  return { amountInr, utr: utrMatch[1] };
}

async function approveTransaction(txnId: string, utr: string): Promise<{ ok: boolean; txn?: any; err?: string }> {
  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: txnId },
      include: { user: { include: { wallet: true } } },
    });
    if (!txn) return { ok: false, err: 'Transaction not found' };
    if (txn.status !== 'PENDING') return { ok: false, err: `Already ${txn.status}` };

    const coins = txn.amount; // 1 INR = 1 Coin

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: txnId },
        data: { status: 'SUCCESS', coins, upiRef: utr, processedAt: new Date() },
      }),
      prisma.wallet.upsert({
        where: { userId: txn.userId },
        create: { userId: txn.userId, balance: coins, totalDeposit: coins },
        update: { balance: { increment: coins }, totalDeposit: { increment: coins } },
      }),
    ]);

    // Try in-app notification (ignore if table doesn't exist)
    try {
      await (prisma as any).notification.create({
        data: { userId: txn.userId, title: '💰 Deposit Approved', message: `₹${txn.amount} (${coins} coins) credited. UTR: ${utr}`, type: 'DEPOSIT' },
      });
    } catch (_) {}

    return { ok: true, txn };
  } catch (e: any) {
    return { ok: false, err: e.message };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const msg = body?.message;
    if (!msg) return NextResponse.json({ ok: true });

    const text = (msg?.text || '').trim() as string;
    const chatId = msg?.chat?.id;
    if (chatId !== ADMIN_CHAT) return NextResponse.json({ ok: true });

    // Manual APPROVE command
    const approveMatch = text.match(/^APPROVE\s+([a-z0-9]+)$/i);
    if (approveMatch) {
      const txnId = approveMatch[1];
      const txn = await prisma.transaction.findUnique({ where: { id: txnId }, include: { user: true } });
      if (!txn) {
        await sendTelegram(`❌ No transaction found with ID <code>${txnId}</code>`);
        return NextResponse.json({ ok: true });
      }
      const result = await approveTransaction(txnId, txn.upiRef || 'MANUAL');
      await sendTelegram(result.ok
        ? `✅ <b>Manually Approved</b>\n\n👤 ${txn.user?.name || txn.userId}\n📧 ${txn.user?.email || '-'}\n💰 ₹${txn.amount} → ${txn.amount} coins credited`
        : `❌ Approval failed: ${result.err}`
      );
      return NextResponse.json({ ok: true });
    }

    // Must contain "deposited" to be a credit SMS
    if (!text.toLowerCase().includes('deposited')) return NextResponse.json({ ok: true });

    const parsed = parseBandhanSMS(text);
    if (!parsed) {
      await sendTelegram(`❌ <b>Could not parse SMS</b>\n\nExpected:\n<code>INR 500 deposited to your A/c... UPI/CR/423156789012/</code>`);
      return NextResponse.json({ ok: true });
    }

    const { amountInr, utr } = parsed;

    // Try UTR match first (user entered UTR on site → stored in upiRef or orderId)
    let txn = await prisma.transaction.findFirst({
      where: {
        type: 'DEPOSIT', status: 'PENDING',
        OR: [{ upiRef: utr }, { orderId: { contains: `UTR:${utr}` } }],
      },
      include: { user: true },
    });

    if (txn) {
      if (Math.abs(txn.amount - amountInr) > 1) {
        await sendTelegram(`⚠️ <b>UTR matched but amount mismatch</b>\n\n👤 ${txn.user?.name}\n💰 SMS: ₹${amountInr}  DB: ₹${txn.amount}\n🔑 <code>${utr}</code>\n\nReply <code>APPROVE ${txn.id}</code> to approve anyway.`);
        return NextResponse.json({ ok: true });
      }
      const result = await approveTransaction(txn.id, utr);
      await sendTelegram(result.ok
        ? `✅ <b>Auto-Approved!</b>\n\n👤 ${txn.user?.name || txn.userId}\n📧 ${txn.user?.email || '-'}\n💰 ₹${amountInr} → ${amountInr} coins credited\n🔑 UTR: <code>${utr}</code>`
        : `❌ DB error: ${result.err}`
      );
      return NextResponse.json({ ok: true });
    }

    // Fallback: match by amount only
    const candidates = await prisma.transaction.findMany({
      where: { type: 'DEPOSIT', status: 'PENDING', amount: amountInr },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    if (candidates.length === 0) {
      await sendTelegram(`⚠️ <b>No pending deposit found</b>\n\n🔑 UTR: <code>${utr}</code>\n💰 Amount: ₹${amountInr}\n\nAlready approved or no matching request.`);
    } else if (candidates.length === 1) {
      const c = candidates[0];
      await sendTelegram(`⚠️ <b>Matched by amount only (UTR not found)</b>\n\n👤 ${c.user?.name}\n📧 ${c.user?.email}\n�� ₹${amountInr}\n🔑 SMS UTR: <code>${utr}</code>\n🔑 User entered: <code>${c.upiRef || c.orderId?.split('UTR:')[1] || 'none'}</code>\n\nReply <code>APPROVE ${c.id}</code>`);
    } else {
      const list = candidates.map((c: any, i: number) => `${i+1}. ${c.user?.name} (${c.user?.email})\n   <code>APPROVE ${c.id}</code>`).join('\n\n');
      await sendTelegram(`⚠️ <b>${candidates.length} pending deposits for ₹${amountInr}</b>\n🔑 SMS UTR: <code>${utr}</code>\n\n${list}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Telegram webhook error:', err);
    await sendTelegram(`🔴 Webhook error: ${err.message}`);
    return NextResponse.json({ ok: false }, { status: 200 }); // always 200 to Telegram
  }
}
