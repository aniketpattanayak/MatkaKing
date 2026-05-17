import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken, isAdminToken } from '@/lib/api-helper';

function isAdmin(req: NextRequest) {
  return isAdminToken(req) !== null;
}

const DEFAULT_SEGMENTS = [
  { label: '₹5,000',    coinsReward: 5000, probability: 0.02, color: '#FFD700' },
  { label: '₹2,000',    coinsReward: 2000, probability: 0.05, color: '#FF6B35' },
  { label: '₹1,000',    coinsReward: 1000, probability: 0.08, color: '#9B59B6' },
  { label: '₹500',      coinsReward: 500,  probability: 0.10, color: '#3498DB' },
  { label: '₹200',      coinsReward: 200,  probability: 0.15, color: '#2ECC71' },
  { label: '₹100',      coinsReward: 100,  probability: 0.20, color: '#E74C3C' },
  { label: '₹50',       coinsReward: 50,   probability: 0.20, color: '#F39C12' },
  { label: 'Try Again', coinsReward: 0,    probability: 0.20, color: '#4A5568' },
];

async function getOrCreateConfig() {
  // Find existing active config
  let config = await prisma.spinConfig.findFirst({ where: { isActive: true } });
  if (!config) {
    // Create default config using correct field names from schema
    config = await prisma.spinConfig.create({
      data: {
        name: 'Default Spin',
        pricePerSpin: 10,   // ← correct field name
        buyXGetY_buy: 5,    // buy 5
        buyXGetY_get: 1,    // get 1 free
        isActive: true,
      },
    });
  }
  return config;
}

export async function GET(req: NextRequest) {
  try {
    const config = await getOrCreateConfig();

    let rewards = await prisma.spinReward.findMany({
      where: { spinConfigId: config.id },
      orderBy: { probability: 'desc' },
    });

    // Auto-seed defaults if empty
    if (rewards.length === 0) {
      await prisma.spinReward.createMany({
        data: DEFAULT_SEGMENTS.map(s => ({ ...s, spinConfigId: config.id })),
      });
      rewards = await prisma.spinReward.findMany({
        where: { spinConfigId: config.id },
        orderBy: { probability: 'desc' },
      });
    }

    // Convert probability 0–1 → % for frontend display
    const formatted = rewards.map(r => ({
      ...r,
      coins:       r.coinsReward,
      probability: Math.round(r.probability * 100),
    }));

    const total = formatted.reduce((s, r) => s + r.probability, 0);
    return NextResponse.json({ rewards: formatted, totalProbability: total, config });
  } catch (e: any) {
    console.error('spin-segments GET error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { action, id, label, coins, probability, color } = body;

  const config = await getOrCreateConfig();

  if (action === 'add') {
    if (!label || probability == null || coins == null || !color)
      return NextResponse.json({ error: 'label, coins, probability, color required' }, { status: 400 });

    const existing = await prisma.spinReward.aggregate({
      _sum: { probability: true },
      where: { spinConfigId: config.id },
    });
    const currentTotal = Math.round((existing._sum.probability ?? 0) * 100);
    if (currentTotal + Number(probability) > 100)
      return NextResponse.json({ error: `Total would be ${currentTotal + Number(probability)}% — must be ≤ 100%` }, { status: 400 });

    const reward = await prisma.spinReward.create({
      data: {
        label,
        coinsReward:  Number(coins),
        probability:  Number(probability) / 100,
        color,
        spinConfigId: config.id,
      },
    });
    return NextResponse.json({ ok: true, reward: { ...reward, coins: reward.coinsReward, probability: Math.round(reward.probability * 100) } });
  }

  if (action === 'update') {
    // Update label, coins, probability, color
    const updated = await prisma.spinReward.update({
      where: { id },
      data: {
        ...(label       !== undefined && { label }),
        ...(coins       !== undefined && { coinsReward: Number(coins) }),
        ...(probability !== undefined && { probability: Number(probability) / 100 }),
        ...(color       !== undefined && { color }),
      },
    });
    return NextResponse.json({ ok: true, reward: { ...updated, coins: updated.coinsReward, probability: Math.round(updated.probability * 100) } });
  }

  if (action === 'delete') {
    await prisma.spinReward.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reset_defaults') {
    await prisma.spinReward.deleteMany({ where: { spinConfigId: config.id } });
    await prisma.spinReward.createMany({
      data: DEFAULT_SEGMENTS.map(s => ({ ...s, spinConfigId: config.id })),
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
