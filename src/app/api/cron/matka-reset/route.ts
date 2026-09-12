import { NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Reset isResultDeclared at midnight IST so markets accept bets for new day
    // Markets and their history are NEVER deleted here
    await prisma.matkaMarket.updateMany({
      data: { isResultDeclared: false, isOpen: false }
    });
    return NextResponse.json({ ok: true, message: 'Markets ready for new day' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
