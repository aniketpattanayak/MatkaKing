import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// ── Singleton Prisma (prevents connection pool exhaustion on hot-reload) ───────
const g = globalThis as unknown as { _prisma?: PrismaClient };
export const prisma: PrismaClient = g._prisma ?? (g._prisma = new PrismaClient({ log: [] }));

export const JWT_SECRET = process.env.JWT_SECRET ?? 'sge-dev-secret-change-in-prod';

export interface TokenPayload { sub: string; email: string; role: string; iat?: number; exp?: number; }

// ── Verify JWT token ──────────────────────────────────────────────────────────
export function verifyToken(req: NextRequest): TokenPayload | null {
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    return jwt.verify(auth.slice(7), JWT_SECRET) as TokenPayload;
  } catch { return null; }
}

// ── Admin check from JWT (NO extra DB query) ──────────────────────────────────
export function isAdminToken(req: NextRequest): TokenPayload | null {
  const p = verifyToken(req);
  if (!p) return null;
  if (p.role !== 'ADMIN' && p.role !== 'SUPERADMIN') return null;
  return p;
}

// ── Quick JSON response helper ────────────────────────────────────────────────
export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
