import { NextRequest, NextResponse } from 'next/server';

// ── In-memory rate limiter (per IP, resets every minute) ─────────────────────
// For multi-instance production use Redis instead
const rateMap = new Map<string, { count: number; reset: number }>();

function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + windowMs });
    return true; // allowed
  }
  if (entry.count >= limit) return false; // blocked
  entry.count++;
  return true;
}

// Clean up old entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateMap.entries()) {
    if (now > val.reset) rateMap.delete(key);
  }
}, 5 * 60 * 1000);

// ── Security headers (OWASP recommended) ─────────────────────────────────────
const SECURITY_HEADERS = {
  'X-Content-Type-Options':    'nosniff',
  'X-Frame-Options':           'DENY',
  'X-XSS-Protection':          '1; mode=block',
  'Referrer-Policy':           'strict-origin-when-cross-origin',
  'Permissions-Policy':        'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';

  const res = NextResponse.next();

  // ── Apply security headers to every response ─────────────────────────────
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => res.headers.set(k, v));

  // ── Rate limiting rules ──────────────────────────────────────────────────

  // Auth routes — strict: 10 attempts per minute per IP
  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/register')) {
    if (!rateLimit(ip, 10, 60_000)) {
      return new NextResponse(JSON.stringify({ error: 'Too many requests. Try again in 1 minute.' }), {
        status: 429,
        headers: {
          'Content-Type':   'application/json',
          'Retry-After':    '60',
          'X-RateLimit-Limit': '10',
        },
      });
    }
  }

  // Payment routes — 20 per minute (prevent payment spamming)
  if (pathname.startsWith('/api/payment')) {
    if (!rateLimit(`pay:${ip}`, 20, 60_000)) {
      return new NextResponse(JSON.stringify({ error: 'Payment rate limit exceeded. Wait 1 minute.' }), {
        status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }
  }

  // General API — 120 per minute (generous for normal use)
  if (pathname.startsWith('/api/')) {
    if (!rateLimit(`api:${ip}`, 120, 60_000)) {
      return new NextResponse(JSON.stringify({ error: 'Too many requests.' }), {
        status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
      });
    }
  }

  // ── Block suspicious bot patterns ─────────────────────────────────────────
  const ua = req.headers.get('user-agent') ?? '';
  const botPatterns = /sqlmap|nikto|nmap|masscan|zgrab|python-requests\/2\.[0-3]/i;
  if (botPatterns.test(ua) && pathname.startsWith('/api/')) {
    return new NextResponse(null, { status: 403 });
  }

  return res;
}

export const config = {
  matcher: [
    // Apply to all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|media|css|images).*)',
  ],
};
