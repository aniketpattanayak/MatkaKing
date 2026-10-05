#!/usr/bin/env python3
"""
apply_all_fixes.py  —  run from the project root: python3 apply_all_fixes.py
Applies all pending changes:
  1. admin/daily-stats/route.ts   — already correct (IST timezone)
  2. admin/history-stats/route.ts — already correct (aggregate amounts + IST)
  3. admin/page.tsx               — 2 IST date fixes  (git restore first!)
  4. Header.tsx                  — refresh button
  5. games/matka/page.tsx        — drum picker overflow-x fix
"""

import sys, os, pathlib

ROOT = pathlib.Path(__file__).parent

def patch(rel, old, new, label=""):
    p = ROOT / rel
    if not p.exists():
        print(f"  ✗  NOT FOUND: {rel}")
        return False
    txt = p.read_text(encoding="utf-8")
    if old not in txt:
        print(f"  ✗  Pattern not found in {rel}{' — '+label if label else ''}")
        print(f"     (already applied or file differs)")
        return False
    if txt.count(old) > 1:
        print(f"  ✗  Pattern matches >1 time in {rel} — aborting that patch")
        return False
    p.write_text(txt.replace(old, new, 1), encoding="utf-8")
    print(f"  ✓  Patched: {rel}{' — '+label if label else ''}")
    return True

def write_full(rel, content, label=""):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    print(f"  ✓  Written: {rel}{' — '+label if label else ''}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 1. admin/page.tsx — IST date fix (line ~57) ===")
patch(
    "src/app/admin/page.tsx",
    "const todayDate = new Date().toISOString().slice(0, 10);",
    "const todayDate = new Date(Date.now() + 5.5*60*60*1000).toISOString().slice(0, 10); // IST \"YYYY-MM-DD\"",
    "todayDate IST"
)

print("\n=== 2. admin/page.tsx — IST date fix (line ~384) ===")
patch(
    "src/app/admin/page.tsx",
    "const td = new Date().toISOString().slice(0, 10);",
    "const td = new Date(Date.now() + 5.5*60*60*1000).toISOString().slice(0, 10); // IST date",
    "td IST"
)

# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 3. Header.tsx — add RefreshCw import + button ===")
patch(
    "src/components/layout/Header.tsx",
    "Gamepad2, Ticket, LayoutDashboard, Wallet, Settings,\n  LogOut, User, ChevronDown, X, Menu, Coins, Sun, Moon, Bell",
    "Gamepad2, Ticket, LayoutDashboard, Wallet, Settings,\n  LogOut, User, ChevronDown, X, Menu, Coins, Sun, Moon, Bell, RefreshCw",
    "import RefreshCw"
)

REFRESH_BTN = """{/* Refresh button */}
                  <button onClick={()=>window.location.reload()} style={{
                    width:36,height:36,borderRadius:'50%',border:'1px solid var(--Border)',
                    background:'var(--Bg-2)',cursor:'pointer',display:'flex',
                    alignItems:'center',justifyContent:'center',color:'var(--White)',
                    flexShrink:0,
                  }} title="Refresh page">
                    <RefreshCw size={16}/>
                  </button>

                  {/* Theme toggle */}"""

patch(
    "src/components/layout/Header.tsx",
    "{/* Theme toggle */}",
    REFRESH_BTN,
    "refresh button before theme toggle"
)

# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 4. matka/page.tsx — drum picker overflow-x ===")
patch(
    "src/app/games/matka/page.tsx",
    'style={{ display: \'flex\', gap: 6, justifyContent: \'space-around\' }}',
    'style={{ display: \'flex\', gap: 6, justifyContent: \'space-around\', overflowX: \'auto\', paddingBottom: 4 }}',
    "drum columns overflow-x: auto"
)

# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 5. admin/daily-stats/route.ts — IST timezone ===")
DAILY_STATS = '''\
import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '@/lib/api-helper';
import { prisma, isAdminToken } from '@/lib/api-helper';

// IST = UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const cached = getCache('admin:daily-stats');
  if (cached) return NextResponse.json(cached);
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    // "today" in IST: get IST midnight as UTC timestamp
    const now = new Date();
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const y = istNow.getUTCFullYear();
    const m = istNow.getUTCMonth();
    const d = istNow.getUTCDate();
    const today = new Date(Date.UTC(y, m, d) - IST_OFFSET_MS); // IST midnight in UTC

    const [lotteryTicketsSold, matkaBetsToday, totalUsers, activeUsers] = await Promise.all([
      prisma.lotteryTicket.count({ where: { isSold: true, createdAt: { gte: today } } }),
      prisma.matkaBet.count({ where: { placedAt: { gte: today } } }),
      prisma.user.count(),
      prisma.user.count({ where: { transactions: { some: { createdAt: { gte: today } } } } }),
    ]);
    const depositToday = await prisma.transaction.aggregate({
      where: { type: 'DEPOSIT', status: 'SUCCESS', createdAt: { gte: today } },
      _sum: { coins: true },
    });
    const withdrawToday = await prisma.transaction.aggregate({
      where: { type: 'WITHDRAWAL', createdAt: { gte: today } },
      _sum: { coins: true },
    });
    // Matka collection vs payout today
    const matkaBetAmt = await prisma.matkaBet.aggregate({
      where: { placedAt: { gte: today } },
      _sum: { amount: true },
    });
    let matkaWinAmt: any = { _sum: { wonAmount: 0 } };
    try {
      matkaWinAmt = await prisma.matkaBet.aggregate({
        where: { placedAt: { gte: today }, status: 'WON' },
        _sum: { wonAmount: true },
      });
    } catch(e) { /* wonAmount field may not exist */ }

    // Date label in IST
    const istDate = new Date(today.getTime() + IST_OFFSET_MS);
    const statsData = {
      date: istDate.toLocaleDateString('en-IN'),
      lotteryTicketsSoldToday: lotteryTicketsSold,
      matkaBetsToday,
      totalUsers,
      activeUsersToday: activeUsers,
      depositToday: depositToday._sum.coins ?? 0,
      withdrawToday: withdrawToday._sum.coins ?? 0,
      matkaCollectedToday: matkaBetAmt._sum.amount ?? 0,
      matkaPaidToday: matkaWinAmt._sum.wonAmount ?? 0,
    };
    setCache('admin:daily-stats', statsData, 300000); // 5 min
    return NextResponse.json(statsData);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
'''
write_full("src/app/api/admin/daily-stats/route.ts", DAILY_STATS, "IST timezone")

# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 6. admin/history-stats/route.ts — aggregate amounts + IST ===")
HISTORY_STATS = '''\
import { getCache, setCache } from '@/lib/api-helper';
import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

// IST = UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Return the start of "today" in IST, expressed as a UTC Date */
function istDayStart(daysAgo = 0): Date {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();
  // IST midnight = UTC midnight minus 5h30m
  const base = new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
  base.setUTCDate(base.getUTCDate() - daysAgo);
  return base;
}

async function buildRow(dayStart: Date, dayEnd: Date, label: string) {
  const [
    depositAgg, withdrawAgg,
    lotteryTicketsAgg, lotteryWinnersAgg,
    matkaBetsAgg, matkaWinnersAgg,
  ] = await Promise.all([
    // Deposits and withdrawals (in coins)
    prisma.transaction.aggregate({ where: { type: 'DEPOSIT',    status: 'SUCCESS', createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { coins: true } }),
    prisma.transaction.aggregate({ where: { type: 'WITHDRAWAL', status: 'SUCCESS', createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { coins: true } }),
    // Lottery: sum of amountPaid (coins spent buying tickets)
    prisma.lotteryBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd } }, _sum: { amountPaid: true } }),
    // Lottery winners: sum of wonAmount
    prisma.lotteryBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' }, _sum: { wonAmount: true } }),
    // Matka: sum of amount (coins bet)
    prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd } }, _sum: { amount: true } }),
    // Matka winners: sum of wonAmount
    prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' }, _sum: { wonAmount: true } }),
  ]);

  const deposit        = depositAgg._sum.coins           ?? 0;
  const withdraw       = withdrawAgg._sum.coins          ?? 0;
  const lotteryTickets = lotteryTicketsAgg._sum.amountPaid ?? 0;
  const lotteryWinners = lotteryWinnersAgg._sum.wonAmount  ?? 0;
  const matkaBets      = matkaBetsAgg._sum.amount          ?? 0;
  const matkaWinners   = matkaWinnersAgg._sum.wonAmount    ?? 0;
  const profit         = deposit - withdraw - lotteryWinners - matkaWinners;

  return { date: label, deposit, lotteryTickets, matkaBets, lotteryWinners, matkaWinners, withdraw, profit };
}

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const period = new URL(req.url).searchParams.get('period') ?? '7days';

  const cacheKey = `admin:history-stats:${period}`;
  const cached = getCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const result = [];
    const days = period === '30days' ? 30 : period === '15days' ? 15 : 7;

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = istDayStart(i);
      const dayEnd   = istDayStart(i - 1); // next IST day
      // Label: show the IST date
      const istLabel = new Date(dayStart.getTime() + IST_OFFSET_MS);
      const label = istLabel.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      result.push(await buildRow(dayStart, dayEnd, label));
    }

    const resp = { days: result };
    setCache(cacheKey, resp, 300000); // 5 min cache
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
'''
write_full("src/app/api/admin/history-stats/route.ts", HISTORY_STATS, "aggregate amounts + IST")

print("\n✅  Done. Now run: npm run build && git add -A && git commit -m 'fix: IST dates, refresh btn, mobile drum picker, history-stats amounts'\n")
