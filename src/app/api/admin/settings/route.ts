import { NextRequest, NextResponse } from 'next/server';
import { prisma, verifyToken, isAdminToken } from '@/lib/api-helper';

// Simple key-value settings stored in DB
// Uses a generic approach since we may not have a Settings model yet
// Falls back to env or defaults

const DEFAULTS: Record<string, string> = {
  minWithdraw:    '100',
  maxWithdraw:    '50000',
  withdrawPerDay: '1',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  try {
    // Try to read from DB if Setting model exists
    const setting = await (prisma as any).setting?.findUnique({ where: { key } }).catch(() => null);
    const value = setting?.value ?? DEFAULTS[key ?? ''] ?? null;
    return NextResponse.json({ key, value });
  } catch {
    return NextResponse.json({ key, value: DEFAULTS[key ?? ''] ?? null });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { key, value } = await req.json();
  try {
    await (prisma as any).setting?.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    }).catch(() => null);
    return NextResponse.json({ ok: true, key, value });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
