import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0');
  try {
    const where: any = search ? { OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ]} : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, take: limit, skip: offset, orderBy: { createdAt: 'desc' },
        select: {
          id:true, name:true, email:true, phone:true, role:true,
          isActive:true, createdAt:true, referralCode:true,
          wallet: { select: { balance:true, totalWon:true, totalDeposit:true, totalWithdraw:true } },
          _count: { select: { lotteryBets:true, matkaBets:true, transactions:true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return NextResponse.json({ users, total });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Block/unblock + adjust balance
export async function PATCH(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId, action, amount, reason } = await req.json();
  try {
    if (action === 'toggle_block') {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { isActive:true } });
      await prisma.user.update({ where: { id: userId }, data: { isActive: !u?.isActive } });
      return NextResponse.json({ ok: true, isActive: !u?.isActive });
    }
    if (action === 'adjust_balance') {
      const adj = parseInt(amount);
      if (!adj) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      await prisma.wallet.update({ where: { userId }, data: { balance: { increment: adj } } });
      await prisma.transaction.create({ data: {
        userId, type: adj > 0 ? 'BONUS' : 'WITHDRAWAL', status: 'SUCCESS',
        coins: Math.abs(adj), amount: 0, orderId: `ADMIN-ADJ-${Date.now()}`,
      }});
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Get single user activity
export async function POST(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId } = await req.json();
  try {
    const [user, transactions, lotteryBets, matkaBets, spinResults] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, include: { wallet: true } }),
      prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.lotteryBet.findMany({ where: { userId }, orderBy: { placedAt: 'desc' }, take: 10, include: { ticket: true } }),
      prisma.matkaBet.findMany({ where: { userId }, orderBy: { placedAt: 'desc' }, take: 10 }),
      prisma.spinResult.findMany({ where: { userId }, orderBy: { spunAt: 'desc' }, take: 10 }),
    ]);
    return NextResponse.json({ user, transactions, lotteryBets, matkaBets, spinResults });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
