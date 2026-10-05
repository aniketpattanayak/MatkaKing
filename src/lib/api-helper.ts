import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const g = globalThis as unknown as { _prisma?: PrismaClient };
// Connection pool optimization
function makePrisma(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (url && authToken) {
    const libsql = createClient({ url, authToken });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter } as any);
  }
  return new PrismaClient({ log: [] });
}
export const prisma: PrismaClient = g._prisma ?? (g._prisma = makePrisma());


// ── Simple in-memory cache to reduce DB calls ─────────────────────────────
const cache = new Map<string, {data:any, exp:number}>();
export function getCache(key:string) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.exp) { cache.delete(key); return null; }
  return item.data;
}
export function setCache(key:string, data:any, ttlMs=30000) {
  cache.set(key, {data, exp: Date.now()+ttlMs});
}
export function clearCache(key?:string) {
  if (key) cache.delete(key);
  else cache.clear();
}
// ─────────────────────────────────────────────────────────────────────────────

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
