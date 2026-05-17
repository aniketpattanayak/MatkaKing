import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken } from '@/lib/api-helper';

const SEGMENTS = [
  { label: '₹5,000', coins: 5000, probability: 0.02 },
  { label: '₹2,000', coins: 2000, probability: 0.05 },
  { label: '₹1,000', coins: 1000, probability: 0.08 },
  { label: '₹500',   coins: 500,  probability: 0.10 },
  { label: '₹200',   coins: 200,  probability: 0.15 },
  { label: '₹100',   coins: 100,  probability: 0.20 },
  { label: '₹50',    coins: 50,   probability: 0.20 },
  { label: 'Try Again', coins: 0, probability: 0.20 },
];

const SPIN_COST = 10;
const FREE_EVERY = 6; // every 6th spin is free

function weightedRandom() {
  const r = Math.random();
  let cum = 0;
  for (const seg of SEGMENTS) { cum += seg.probability; if (r <= cum) return seg; }
  return SEGMENTS[SEGMENTS.length - 1];
}

export async function POST(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Count today's spins for free spin logic
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const spinCount = await prisma.spinResult.count({ where: { userId: p.sub, createdAt: { gte: today } } });
    const isFree = (spinCount + 1) % FREE_EVERY === 0;
    const cost = isFree ? 0 : SPIN_COST;

    const wallet = await prisma.wallet.findUnique({ where: { userId: p.sub } });
    if (!wallet || wallet.balance < cost)
      return NextResponse.json({ error: `Need ${cost} coins. Have ${wallet?.balance ?? 0}` }, { status: 402 });

    const reward = weightedRandom();

    const result = await prisma.$transaction(async (tx) => {
      // Deduct spin cost
      if (cost > 0) await tx.wallet.update({ where: { userId: p.sub }, data: { balance: { decrement: cost } } });
      // Credit winnings
      if (reward.coins > 0) {
        await tx.wallet.update({ where: { userId: p.sub }, data: { balance: { increment: reward.coins }, totalWon: { increment: reward.coins } } });
        await tx.transaction.create({ data: { userId: p.sub, type: 'SPIN_WIN', status: 'SUCCESS', coins: reward.coins, amount: 0, orderId: `SP-${Date.now()}` } });
      } else if (cost > 0) {
        await tx.transaction.create({ data: { userId: p.sub, type: 'BET_DEBIT', status: 'SUCCESS', coins: cost, amount: cost, orderId: `SP-${Date.now()}` } });
      }
      // Record spin
      const spinRecord = await tx.spinResult.create({ data: { userId: p.sub, spinConfigId: 'default', rewardId: reward.label, coinsWon: reward.coins, usedFreeSpins: isFree } });
      const newWallet = await tx.wallet.findUnique({ where: { userId: p.sub } });
      return { spinRecord, newBalance: newWallet?.balance ?? 0 };
    });

    return NextResponse.json({ reward, isFree, cost, newBalance: result.newBalance, spinCount: spinCount + 1 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [spinCount, history] = await Promise.all([
    prisma.spinResult.count({ where: { userId: p.sub, createdAt: { gte: today } } }),
    prisma.spinResult.findMany({ where: { userId: p.sub }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  return NextResponse.json({ spinCount, history });
}
