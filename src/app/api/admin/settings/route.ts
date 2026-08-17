
import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

const DEFAULTS: Record<string,string> = {
  minWithdraw: '100', maxWithdraw: '50000', withdrawPerDay: '1',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key') ?? '';
  try {
    const s = await prisma.setting.findUnique({ where: { key } });
    return NextResponse.json({ key, value: s?.value ?? DEFAULTS[key] ?? null });
  } catch {
    return NextResponse.json({ key, value: DEFAULTS[key] ?? null });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error:'Forbidden' },{ status:403 });
  const { key, value } = await req.json();
  try {
    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
    return NextResponse.json({ ok:true, key, value });
  } catch (e:any) {
    return NextResponse.json({ error:e.message },{ status:500 });
  }
}
