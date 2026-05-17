/**
 * Matka King Engine
 * Implements all Matka math, betting rules, and result validation.
 *
 * Core Rules:
 *   Patti  : 3-digit number e.g. "1-2-3"
 *   Ank    : sum of patti digits mod 10 → 1+2+3 = 6
 *   Jodi   : open ank + close ank → "67"
 *   Result : "123-6-X-7-456" (Open Patti - Open Ank - Jodi - Close Ank - Close Patti)
 */

import type { PattiResult, MatkaBetType } from '@/types';

// ─── Patti Classification ─────────────────────────────────────────────────────

// All valid 3-digit patties grouped by type
export const SINGLE_PATTI_LIST = generatePattiList('SP');
export const DOUBLE_PATTI_LIST = generatePattiList('DP');
export const TRIPLE_PATTI_LIST = generatePattiList('TP');

// All patties ever possible: digits 0-9, combinations of 3 (with repetition)
export const ALL_PATTIES: string[] = [];
for (let i = 0; i <= 9; i++) {
  for (let j = 0; j <= 9; j++) {
    for (let k = 0; k <= 9; k++) {
      ALL_PATTIES.push(`${i}${j}${k}`);
    }
  }
}

function generatePattiList(type: 'SP' | 'DP' | 'TP'): string[] {
  return ALL_PATTIES.filter((p) => {
    const digits = p.split('').map(Number);
    const unique = new Set(digits).size;
    if (type === 'SP') return unique === 3;  // 1,2,3 all different
    if (type === 'DP') return unique === 2;  // 1,1,2 — two same
    if (type === 'TP') return unique === 1;  // 1,1,1 — all same
    return false;
  });
}

// ─── Core Math ───────────────────────────────────────────────────────────────

/**
 * Compute Ank from a Patti string.
 * "1-2-3" → digits [1,2,3] → sum=6 → Ank=6
 * "5-6-8" → sum=19 → Ank=9
 */
export function pattiToAnk(patti: string): number {
  const digits = patti.replace(/-/g, '').split('').map(Number);
  if (digits.length !== 3) throw new Error(`Invalid patti: ${patti}`);
  const sum = digits.reduce((a, b) => a + b, 0);
  return sum % 10;
}

/**
 * Returns all patties that produce a given Ank.
 * ank=6 → ["1-2-3", "2-4-0", "6-0-0", ...]
 */
export function getPattisByAnk(ank: number): string[] {
  return ALL_PATTIES.filter((p) => {
    const digits = p.split('').map(Number);
    return digits.reduce((a, b) => a + b, 0) % 10 === ank;
  }).map((p) => `${p[0]}-${p[1]}-${p[2]}`);
}

/**
 * Parse a full result string to structured result.
 * "123-6" → { patti: "1-2-3", ank: 6, display: "123-6" }
 */
export function parseResult(resultStr: string): PattiResult {
  const parts = resultStr.split('-');
  if (parts.length < 2) throw new Error(`Invalid result string: ${resultStr}`);

  const patti = `${parts[0][0]}-${parts[0][1]}-${parts[0][2]}`;
  const ank = parseInt(parts[1], 10);
  const computedAnk = pattiToAnk(patti);

  if (computedAnk !== ank) {
    throw new Error(`Ank mismatch: patti ${patti} gives ${computedAnk}, not ${ank}`);
  }

  return { patti, ank, display: `${parts[0]}-${ank}` };
}

/**
 * Compute Jodi from open ank and close ank.
 * openAnk=6, closeAnk=7 → "67"
 */
export function computeJodi(openAnk: number, closeAnk: number): string {
  return `${openAnk}${closeAnk}`;
}

// ─── Bet Validation ───────────────────────────────────────────────────────────

export function validateBet(betType: MatkaBetType, betValue: string): boolean {
  switch (betType) {
    case 'SINGLE_ANK':
      return /^[0-9]$/.test(betValue);
    case 'JODI':
      return /^[0-9]{2}$/.test(betValue);
    case 'SINGLE_PATTI':
      return isSinglePatti(betValue);
    case 'DOUBLE_PATTI':
      return isDoublePatti(betValue);
    case 'TRIPLE_PATTI':
      return isTriplePatti(betValue);
    case 'HALF_SANGAM':
      // format: "6-456" (ank-patti) or "123-7" (patti-ank)
      return /^[0-9]-[0-9]{3}$/.test(betValue) || /^[0-9]{3}-[0-9]$/.test(betValue);
    case 'FULL_SANGAM':
      // format: "123-456" (open patti - close patti)
      return /^[0-9]{3}-[0-9]{3}$/.test(betValue);
    default:
      return false;
  }
}

function isSinglePatti(patti: string): boolean {
  const clean = patti.replace(/-/g, '');
  if (clean.length !== 3) return false;
  return new Set(clean.split('')).size === 3;
}

function isDoublePatti(patti: string): boolean {
  const clean = patti.replace(/-/g, '');
  if (clean.length !== 3) return false;
  return new Set(clean.split('')).size === 2;
}

function isTriplePatti(patti: string): boolean {
  const clean = patti.replace(/-/g, '');
  if (clean.length !== 3) return false;
  return new Set(clean.split('')).size === 1;
}

// ─── Win Check ────────────────────────────────────────────────────────────────

interface ResultContext {
  openAnk: number;
  closeAnk: number;
  openPatti: string; // "1-2-3"
  closePatti: string;
  jodi: string;
}

export function checkWin(
  betType: MatkaBetType,
  betValue: string,
  result: ResultContext
): boolean {
  switch (betType) {
    case 'SINGLE_ANK':
      return (
        betValue === String(result.openAnk) ||
        betValue === String(result.closeAnk)
      );
    case 'JODI':
      return betValue === result.jodi;
    case 'SINGLE_PATTI':
    case 'DOUBLE_PATTI':
    case 'TRIPLE_PATTI': {
      const normalised = betValue.replace(/-/g, '');
      return (
        normalised === result.openPatti.replace(/-/g, '') ||
        normalised === result.closePatti.replace(/-/g, '')
      );
    }
    case 'HALF_SANGAM': {
      // "6-456" → open ank matches AND close patti matches
      const [first, second] = betValue.split('-');
      if (first.length === 1) {
        return (
          parseInt(first, 10) === result.openAnk &&
          second === result.closePatti.replace(/-/g, '')
        );
      } else {
        return (
          first === result.openPatti.replace(/-/g, '') &&
          parseInt(second, 10) === result.closeAnk
        );
      }
    }
    case 'FULL_SANGAM': {
      const [op, cp] = betValue.split('-');
      return (
        op === result.openPatti.replace(/-/g, '') &&
        cp === result.closePatti.replace(/-/g, '')
      );
    }
    default:
      return false;
  }
}

// ─── Payout Multiplier ────────────────────────────────────────────────────────

export function getPayoutMultiplier(
  betType: MatkaBetType,
  payouts: {
    singleAnk: number; jodi: number; singlePatti: number;
    doublePatti: number; triplePatti: number;
    halfSangam: number; fullSangam: number;
  }
): number {
  const map: Record<MatkaBetType, number> = {
    SINGLE_ANK: payouts.singleAnk,
    JODI: payouts.jodi,
    SINGLE_PATTI: payouts.singlePatti,
    DOUBLE_PATTI: payouts.doublePatti,
    TRIPLE_PATTI: payouts.triplePatti,
    HALF_SANGAM: payouts.halfSangam,
    FULL_SANGAM: payouts.fullSangam,
  };
  return map[betType];
}
