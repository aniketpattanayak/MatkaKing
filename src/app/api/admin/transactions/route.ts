import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const type   = searchParams.get('type') ?? 'ALL';
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);
  const offset = parseInt(searchParams.get('offset') ?? '0');
  try {
    const where: any = {};
    if (type !== 'ALL') where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          user:    { select: { id:true, name:true, email:true } },
          upiPool: { select: { upiId:true, label:true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit, skip: offset,
      }),
      prisma.transaction.count({ where }),
    ]);

    // UPI stats — group successful deposits by upiPoolId
    const upis = await prisma.upiPool.findMany({
      select: { id:true, upiId:true, label:true, isActive:true },
    });

    const upiDeposits = await prisma.transaction.groupBy({
      by: ['upiPoolId'],
      where: { type: 'DEPOSIT', status: 'SUCCESS', upiPoolId: { not: null } },
      _sum: { coins: true, amount: true },
      _count: true,
    });

    const upiMap = Object.fromEntries(upiDeposits.map(d => [d.upiPoolId!, d]));

    const upiStats = upis.map(u => ({
      upiId:       u.upiId,
      label:       u.label,
      isActive:    u.isActive,
      count:       upiMap[u.id]?._count ?? 0,
      totalAmount: upiMap[u.id]?._sum?.amount ?? upiMap[u.id]?._sum?.coins ?? 0,
    }));

    // Overall type stats
    const stats = await prisma.transaction.groupBy({
      by: ['type'],
      _sum: { coins: true, amount: true },
      _count: true,
    });

    return NextResponse.json({ transactions, total, upiStats, stats });
  } catch (e: any) {
    console.error('transactions error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
