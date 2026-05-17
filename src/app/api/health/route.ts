import { NextRequest } from 'next/server';
import { prisma } from '@/lib/api-helper';

export const runtime = 'nodejs';
export const dynamic  = 'force-dynamic';

export async function GET(req: NextRequest) {
  const start = Date.now();
  const checks: Record<string, any> = {};

  // ── DB check ──────────────────────────────────────────────────────────────
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latency: `${Date.now() - start}ms` };
  } catch (e: any) {
    checks.database = { status: 'error', error: e.message };
  }

  // ── Environment check ─────────────────────────────────────────────────────
  const requiredEnvs = ['DATABASE_URL', 'JWT_SECRET'];
  const missingEnvs  = requiredEnvs.filter(k => !process.env[k]);
  checks.environment = {
    status: missingEnvs.length === 0 ? 'ok' : 'error',
    missing: missingEnvs,
  };

  // ── Memory check ──────────────────────────────────────────────────────────
  const mem = process.memoryUsage();
  checks.memory = {
    status: 'ok',
    heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    rssMB:       Math.round(mem.rss       / 1024 / 1024),
  };

  const allOk      = Object.values(checks).every((c: any) => c.status === 'ok');
  const httpStatus = allOk ? 200 : 503;

  return new Response(JSON.stringify({
    status:    allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version:   process.env.npm_package_version ?? '1.0.0',
    uptime:    `${Math.round(process.uptime())}s`,
    checks,
    totalLatency: `${Date.now() - start}ms`,
  }), {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
