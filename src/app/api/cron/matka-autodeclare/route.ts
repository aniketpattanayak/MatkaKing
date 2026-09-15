// /api/cron/matka-autodeclare
// Runs every minute via external cron (cron-job.org).
// 1. Opens markets when saleDatetime passes
// 2. Auto-declares open patti when openDatetime passes  (safest patti = min payout)
// 3. Auto-declares close patti when closeDatetime passes (settles all bets)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/api-helper';

export const dynamic = 'force-dynamic';

// Datetimes stored as TEXT "2026-09-15T13:00" — admin sets them in IST.
// Vercel runs in UTC, so we must treat bare strings as IST (UTC+5:30).
function parseIST(v: any): Date {
  if (!v) return new Date(0);
  const s = String(v);
  if (s.includes('Z') || s.includes('+') || s.match(/-\d{2}:\d{2}$/)) return new Date(s);
  // Bare "YYYY-MM-DDTHH:MM" → treat as IST
  return new Date(s + ':00+05:30');
}

function pattiAnk(p: string) {
  return p.split('').reduce((s, d) => s + parseInt(d), 0) % 10;
}

// Generate all valid patties of a given type
function allPatties(type: 'SP' | 'DP' | 'TP'): string[] {
  const out: string[] = [];
  for (let a = 0; a <= 9; a++)
    for (let b = 0; b <= 9; b++)
      for (let c = 0; c <= 9; c++) {
        const unique = new Set([a, b, c]).size;
        if (type === 'SP' && unique === 3) out.push(`${a}${b}${c}`);
        if (type === 'DP' && unique === 2) out.push(`${a}${b}${c}`);
        if (type === 'TP' && unique === 1) out.push(`${a}${b}${c}`);
      }
  return out;
}

// Pick the patti (for the given session) that results in minimum payout
async function safestPatti(marketId: string, session: 'OPEN' | 'CLOSE', m: any): Promise<string> {
  const bets = await prisma.matkaBet.findMany({
    where: { marketId, status: 'ACTIVE' },
    select: { betType: true, betValue: true, session: true, amount: true },
  });
  const RATES: Record<string, number> = {
    ANK: m.payoutSingle, SINGLE_ANK: m.payoutSingle,
    SP: m.payoutSP, SINGLE_PATTI: m.payoutSP,
    DP: m.payoutDP, DOUBLE_PATTI: m.payoutDP,
    TP: m.payoutTP, TRIPLE_PATTI: m.payoutTP,
  };
  const candidates = [...allPatties('SP'), ...allPatties('DP'), ...allPatties('TP')];
  let bestPatti = '100';
  let bestPayout = Infinity;
  for (const patti of candidates) {
    const ank = pattiAnk(patti);
    let payout = 0;
    for (const bet of bets) {
      const bt = (bet.betType ?? '').toUpperCase();
      const bv = bet.betValue ?? '';
      if (bet.session !== session) continue;
      let won = false;
      if ((bt === 'ANK' || bt === 'SINGLE_ANK') && bv === String(ank)) won = true;
      if ((bt === 'SP' || bt === 'SINGLE_PATTI') && bv === patti) won = true;
      if ((bt === 'DP' || bt === 'DOUBLE_PATTI') && bv === patti) won = true;
      if ((bt === 'TP' || bt === 'TRIPLE_PATTI') && bv === patti) won = true;
      if (won) payout += bet.amount * (RATES[bt] ?? 0);
    }
    if (payout < bestPayout) { bestPayout = payout; bestPatti = patti; }
  }
  return bestPatti;
}

export async function GET() {
  try {
    const now = new Date();
    const log: string[] = [];
    const markets = await prisma.matkaMarket.findMany({ where: { isActive: true } });

    for (const m of markets) {
      const mkt = m as any;

      // ── 1. Open market for betting at saleDatetime ───────────────────────
      if (mkt.saleDatetime && !m.isOpen && !m.isResultDeclared) {
        if (now >= parseIST(mkt.saleDatetime)) {
          await prisma.matkaMarket.update({ where: { id: m.id }, data: { isOpen: true } });
          log.push(`OPENED: ${m.name}`);
        }
      }

      // ── 2. Auto-declare OPEN patti at openDatetime ───────────────────────
      if (mkt.openDatetime && m.isOpen) {
        if (now >= parseIST(mkt.openDatetime)) {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const existingResult = await prisma.matkaResult.findFirst({
            where: { marketId: m.id, createdAt: { gte: today } },
            orderBy: { createdAt: 'desc' },
          });
          if (!existingResult?.openPatti) {
            const patti = await safestPatti(m.id, 'OPEN', m);
            const ank   = pattiAnk(patti);
            let result: any;
            if (!existingResult) {
              result = await prisma.matkaResult.create({
                data: { marketId: m.id, openPatti: patti, openAnk: ank, declaredAt: now },
              });
            } else {
              result = await prisma.matkaResult.update({
                where: { id: existingResult.id },
                data: { openPatti: patti, openAnk: ank, declaredAt: now },
              });
            }
            // Settle open-side bets
            const RATES: Record<string, number> = { ANK: m.payoutSingle, SINGLE_ANK: m.payoutSingle, SP: m.payoutSP, SINGLE_PATTI: m.payoutSP, DP: m.payoutDP, DOUBLE_PATTI: m.payoutDP, TP: m.payoutTP, TRIPLE_PATTI: m.payoutTP };
            const openBets = await prisma.matkaBet.findMany({ where: { marketId: m.id, status: 'ACTIVE', session: 'OPEN' } });
            for (const bet of openBets) {
              const bt = (bet.betType ?? '').toUpperCase();
              const bv = bet.betValue ?? '';
              let won = false;
              if ((bt === 'ANK' || bt === 'SINGLE_ANK') && bv === String(ank)) won = true;
              if ((bt === 'SP' || bt === 'SINGLE_PATTI') && bv === patti) won = true;
              if ((bt === 'DP' || bt === 'DOUBLE_PATTI') && bv === patti) won = true;
              if ((bt === 'TP' || bt === 'TRIPLE_PATTI') && bv === patti) won = true;
              const wonAmount = won ? bet.amount * (RATES[bt] ?? 0) : 0;
              await prisma.matkaBet.update({ where: { id: bet.id }, data: { status: won ? 'WON' : 'LOST', wonAmount, resultId: result.id } });
              if (won && wonAmount > 0) {
                await prisma.wallet.update({ where: { userId: bet.userId }, data: { balance: { increment: wonAmount }, totalWon: { increment: wonAmount } } });
                await prisma.transaction.create({ data: { userId: bet.userId, type: 'WIN_CREDIT', status: 'SUCCESS', coins: wonAmount, amount: 0, orderId: `AUTO-OPEN-${bet.id}` } });
              }
            }
            log.push(`OPEN_DECLARED: ${m.name} patti=${patti} ank=${ank} settled=${openBets.length}`);
          }
        }
      }

      // ── 3. Auto-declare CLOSE patti at closeDatetime ─────────────────────
      if (mkt.closeDatetime && m.isOpen && !m.isResultDeclared) {
        if (now >= parseIST(mkt.closeDatetime)) {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const result = await prisma.matkaResult.findFirst({
            where: { marketId: m.id, createdAt: { gte: today } },
            orderBy: { createdAt: 'desc' },
          });
          if (result?.openPatti && !result.closePatti) {
            const closePatti = await safestPatti(m.id, 'CLOSE', m);
            const closeAnk   = pattiAnk(closePatti);
            const openAnk    = result.openAnk ?? pattiAnk(result.openPatti);
            const jodi       = `${openAnk}${closeAnk}`;
            await prisma.matkaResult.update({
              where: { id: result.id },
              data: { closePatti, closeAnk, jodi, declaredAt: now },
            });
            // Settle all remaining ACTIVE bets
            const RATES: Record<string, number> = {
              ANK: m.payoutSingle, SINGLE_ANK: m.payoutSingle,
              JODI: m.payoutJodi,
              SP: m.payoutSP, SINGLE_PATTI: m.payoutSP,
              DP: m.payoutDP, DOUBLE_PATTI: m.payoutDP,
              TP: m.payoutTP, TRIPLE_PATTI: m.payoutTP,
              HALF_SANGAM: m.payoutHalfSangam, FULL_SANGAM: m.payoutFullSangam,
            };
            const remaining = await prisma.matkaBet.findMany({ where: { marketId: m.id, status: 'ACTIVE' } });
            for (const bet of remaining) {
              const bt = (bet.betType ?? '').toUpperCase();
              const bv = bet.betValue ?? '';
              let won = false;
              if ((bt === 'ANK' || bt === 'SINGLE_ANK') && bet.session === 'CLOSE' && bv === String(closeAnk)) won = true;
              if (bt === 'JODI' && bv === jodi) won = true;
              if ((bt === 'SP' || bt === 'SINGLE_PATTI') && bet.session === 'CLOSE' && bv === closePatti) won = true;
              if ((bt === 'DP' || bt === 'DOUBLE_PATTI') && bet.session === 'CLOSE' && bv === closePatti) won = true;
              if ((bt === 'TP' || bt === 'TRIPLE_PATTI') && bet.session === 'CLOSE' && bv === closePatti) won = true;
              if (bt === 'HALF_SANGAM' && bet.session === 'OPEN'  && bv === `${result.openPatti}-${closeAnk}`) won = true;
              if (bt === 'HALF_SANGAM' && bet.session === 'CLOSE' && bv === `${openAnk}-${closePatti}`) won = true;
              if (bt === 'FULL_SANGAM' && bv === `${result.openPatti}-${closePatti}`) won = true;
              const wonAmount = won ? bet.amount * (RATES[bt] ?? 0) : 0;
              await prisma.matkaBet.update({ where: { id: bet.id }, data: { status: won ? 'WON' : 'LOST', wonAmount, resultId: result.id } });
              if (won && wonAmount > 0) {
                await prisma.wallet.update({ where: { userId: bet.userId }, data: { balance: { increment: wonAmount }, totalWon: { increment: wonAmount } } });
                await prisma.transaction.create({ data: { userId: bet.userId, type: 'WIN_CREDIT', status: 'SUCCESS', coins: wonAmount, amount: 0, orderId: `AUTO-CLOSE-${bet.id}` } });
              }
            }
            await prisma.matkaMarket.update({
              where: { id: m.id },
              data: { isOpen: false, isResultDeclared: true },
            });
            log.push(`CLOSE_DECLARED: ${m.name} jodi=${jodi} settled=${remaining.length}`);
          }
        }
      }
    }

    return NextResponse.json({ ok: true, time: now.toISOString(), processed: log.length, log });
  } catch (e: any) {
    console.error('matka-autodeclare error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
// debug trigger
