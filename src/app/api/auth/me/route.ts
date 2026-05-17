import { NextRequest } from 'next/server';
import { prisma, verifyToken, json } from '@/lib/api-helper';

export const runtime = 'nodejs';

// Most user data never changes between requests — cache for 60s
export const revalidate = 60;

export async function GET(req: NextRequest) {
  const p = verifyToken(req);
  if (!p) return json({ error: 'Unauthorized' }, 401);

  // Select ONLY required fields — avoid pulling passwordHash, createdAt etc.
  const user = await prisma.user.findUnique({
    where:  { id: p.sub },
    select: {
      id:           true,
      name:         true,
      email:        true,
      role:         true,
      referralCode: true,
      wallet:       { select: { balance: true } },
    },
  });

  if (!user) return json({ error: 'Not found' }, 404);

  return new Response(JSON.stringify({
    user: {
      id:           user.id,
      name:         user.name ?? 'Player',
      email:        user.email,
      role:         user.role,
      balance:      user.wallet?.balance ?? 0,
      referralCode: user.referralCode,
    }
  }), {
    headers: {
      'Content-Type':  'application/json',
      // Private cache — browser reuses this for 30s before re-fetching
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    },
  });
}
