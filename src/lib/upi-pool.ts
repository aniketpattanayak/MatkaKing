/**
 * UPI Pool Manager
 * Handles multi-UPI auto-rotation, transaction counting, and pool management.
 */

import { PrismaClient } from '@prisma/client';
import type { ActiveUpiResult, UpiPoolEntry } from '@/types';

const prisma = new PrismaClient();

// ─── Get Active UPI for Next Transaction ─────────────────────────────────────

export async function getActiveUpi(): Promise<ActiveUpiResult | null> {
  // Fetch the lowest-priority active UPI that hasn't hit its limit
  const pool = await prisma.upiPool.findFirst({
    where: {
      isActive: true,
      // Only use if under limit
    },
    orderBy: [
      { priority: 'asc' },
      { currentTxnCount: 'asc' },
    ],
  });

  if (!pool) return null;

  // Check if this UPI has hit the transaction limit
  if (pool.currentTxnCount >= pool.transactionLimit) {
    // Deactivate and try next
    await prisma.upiPool.update({
      where: { id: pool.id },
      data: { isActive: false },
    });
    return getActiveUpi(); // recurse to next available
  }

  // Build UPI deep-link QR string (standard UPI URI)
  const qrString = buildUpiQrString(pool.upiId);

  return {
    upiId: pool.upiId,
    poolId: pool.id,
    qrDataUrl: qrString,
  };
}

// ─── Record Transaction Outcome ──────────────────────────────────────────────

export async function recordUpiTransaction(
  poolId: string,
  success: boolean
): Promise<void> {
  const pool = await prisma.upiPool.findUnique({ where: { id: poolId } });
  if (!pool) return;

  const newCount = pool.currentTxnCount + 1;
  const shouldRotate = newCount >= pool.transactionLimit;

  await prisma.upiPool.update({
    where: { id: poolId },
    data: {
      currentTxnCount: { increment: 1 },
      successCount: success ? { increment: 1 } : undefined,
      failedCount: !success ? { increment: 1 } : undefined,
      lastUsedAt: new Date(),
      // Auto-deactivate on limit hit - admin can re-enable after bank cooldown
      isActive: shouldRotate ? false : undefined,
    },
  });

  if (shouldRotate) {
    console.log(`[UPI Pool] Rotated away from ${pool.upiId} — limit ${pool.transactionLimit} reached`);
  }
}

// ─── Admin: Add UPI ───────────────────────────────────────────────────────────

export async function addUpiToPool(entry: {
  upiId: string;
  label: string;
  transactionLimit: number;
  priority?: number;
}): Promise<UpiPoolEntry> {
  return prisma.upiPool.create({
    data: {
      upiId: entry.upiId,
      label: entry.label,
      transactionLimit: entry.transactionLimit,
      priority: entry.priority ?? 0,
    },
  });
}

// ─── Admin: Reset UPI Count (after cooldown) ──────────────────────────────────

export async function resetUpiPool(poolId: string): Promise<void> {
  await prisma.upiPool.update({
    where: { id: poolId },
    data: {
      currentTxnCount: 0,
      isActive: true,
    },
  });
}

// ─── Admin: Get All Pool Entries ──────────────────────────────────────────────

export async function getAllUpiEntries(): Promise<UpiPoolEntry[]> {
  return prisma.upiPool.findMany({
    orderBy: [{ priority: 'asc' }, { isActive: 'desc' }],
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUpiQrString(upiId: string): string {
  // Standard UPI deep-link format
  return `upi://pay?pa=${upiId}&cu=INR`;
}

export function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `SGE-${ts}-${rand}`;
}
