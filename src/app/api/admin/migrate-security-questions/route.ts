import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

// One-time migration: adds securityQ1-3 / securityA1-3 columns to User table in Turso
export async function POST(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const results: string[] = [];
  const cols = ['securityQ1','securityA1','securityQ2','securityA2','securityQ3','securityA3'];
  for (const col of cols) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "${col}" TEXT`);
      results.push(`✓ Added ${col}`);
    } catch (e: any) {
      results.push(`skip ${col}: ${e?.message?.slice(0,60)}`);
    }
  }
  return NextResponse.json({ ok: true, results });
}
