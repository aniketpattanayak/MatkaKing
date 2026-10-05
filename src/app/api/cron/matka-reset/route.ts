import { NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Reset isResultDeclared at midnight IST so markets accept bets for new day
    // Markets and their history are NEVER deleted here
    // IMPORTANT: Only reset recurring markets (closeDatetime IS NULL) or one-time
    // markets whose close window hasn't arrived yet. One-time dated markets that
    // have already passed their closeDatetime must NOT be reset — they are
    // permanently closed and should never reopen.
    const now = new Date();
    await prisma.matkaMarket.updateMany({
      where: {
        OR: [
          { closeDatetime: null },           // recurring daily markets (no specific date)
          { closeDatetime: { gt: now } },    // one-time markets not yet closed
        ],
      },
      data: { isResultDeclared: false, isOpen: false },
    });
    return NextResponse.json({ ok: true, message: 'Markets ready for new day' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
