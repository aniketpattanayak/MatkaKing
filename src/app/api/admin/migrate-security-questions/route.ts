import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export async function POST(req: NextRequest) {
  // Use raw ADMIN_SECRET header check — no JWT needed for this one-time migration
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const cols = ['securityQ1','securityA1','securityQ2','securityA2','securityQ3','securityA3'];
  const results: string[] = [];

  for (const col of cols) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "${col}" TEXT`);
      results.push(`✓ Added ${col}`);
    } catch (e: any) {
      results.push(`skip ${col}: ${e?.message?.slice(0, 80)}`);
    }
  }

  return NextResponse.json({ ok: true, results });
}
