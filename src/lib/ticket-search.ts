/**
 * Smart Ticket Search Engine
 * High-performance real-time filtering for alphanumeric lottery tickets.
 * Supports: prefix, suffix, contains, lucky-number, and bulk series queries.
 */

import { PrismaClient } from '@prisma/client';
import type { TicketSearchResult, TicketFilter, BulkBuyRequest } from '@/types';

const prisma = new PrismaClient();

// ─── Real-Time Contact-Style Search ──────────────────────────────────────────
// As the user types "98", returns AH0098, LI9821, etc. instantly.

export async function searchTickets(
  seriesId: string,
  query: string,
  limit = 50
): Promise<TicketSearchResult[]> {
  if (!query || query.length === 0) {
    return getAvailableTickets(seriesId, limit);
  }

  const normalizedQuery = query.toUpperCase().trim();

  const tickets = await prisma.lotteryTicket.findMany({
    where: {
      seriesId,
      isSold: false,
      ticketCode: {
        contains: normalizedQuery,  // PostgreSQL LIKE with index
        mode: 'insensitive',
      },
    },
    take: limit,
    include: { series: true },
    orderBy: { ticketCode: 'asc' },
  });

  return tickets.map((t) => ({
    ticketCode: t.ticketCode,
    ticketId: t.id,
    isSold: t.isSold,
    seriesId: t.seriesId,
    seriesName: t.series.name,
    price: t.series.ticketPrice,
  }));
}

// ─── Advanced Filter Search ───────────────────────────────────────────────────
// prefix / suffix / lucky-number match

export async function filterTickets(
  seriesId: string,
  filter: TicketFilter,
  limit = 100
): Promise<TicketSearchResult[]> {
  const conditions: object[] = [{ isSold: false }, { seriesId }];

  if (filter.prefix) {
    conditions.push({
      ticketCode: { startsWith: filter.prefix.toUpperCase() },
    });
  }

  if (filter.suffix) {
    conditions.push({
      ticketCode: { endsWith: filter.suffix.toUpperCase() },
    });
  }

  if (filter.contains) {
    conditions.push({
      ticketCode: { contains: filter.contains.toUpperCase(), mode: 'insensitive' },
    });
  }

  if (filter.luckyNumber) {
    // lucky number appears anywhere in the numeric portion
    conditions.push({
      ticketCode: { contains: filter.luckyNumber },
    });
  }

  const tickets = await prisma.lotteryTicket.findMany({
    where: { AND: conditions },
    take: limit,
    include: { series: true },
    orderBy: { ticketCode: 'asc' },
  });

  return tickets.map((t) => ({
    ticketCode: t.ticketCode,
    ticketId: t.id,
    isSold: t.isSold,
    seriesId: t.seriesId,
    seriesName: t.series.name,
    price: t.series.ticketPrice,
  }));
}

// ─── Bulk Buy ────────────────────────────────────────────────────────────────
// Quick-buy bundles: 10 / 20 / 50 consecutive available tickets

export async function bulkBuyTickets(req: BulkBuyRequest): Promise<{
  tickets: TicketSearchResult[];
  totalCost: number;
}> {
  const availableTickets = await filterTickets(req.seriesId, req.filter ?? {}, req.quantity);

  if (availableTickets.length < req.quantity) {
    throw new Error(`Only ${availableTickets.length} tickets available, requested ${req.quantity}`);
  }

  const selected = availableTickets.slice(0, req.quantity);
  const series = await prisma.lotterySeries.findUnique({ where: { id: req.seriesId } });

  if (!series) throw new Error('Series not found');

  const totalCost = series.ticketPrice * req.quantity;

  return { tickets: selected, totalCost };
}

// ─── Generate Series Tickets ──────────────────────────────────────────────────
// Admin seeds tickets: AH0001 → LI9999

export async function generateSeriesTickets(
  seriesId: string,
  prefix: string,
  startNum: number,
  endNum: number
): Promise<number> {
  const BATCH_SIZE = 500;
  const tickets = [];
  let count = 0;

  for (let i = startNum; i <= endNum; i++) {
    const paddedNum = String(i).padStart(4, '0');
    tickets.push({ seriesId, ticketCode: `${prefix}${paddedNum}` });
    count++;

    if (tickets.length === BATCH_SIZE) {
      await prisma.lotteryTicket.createMany({ data: tickets, skipDuplicates: true });
      tickets.length = 0;
    }
  }

  if (tickets.length > 0) {
    await prisma.lotteryTicket.createMany({ data: tickets, skipDuplicates: true });
  }

  return count;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAvailableTickets(
  seriesId: string,
  limit: number
): Promise<TicketSearchResult[]> {
  const tickets = await prisma.lotteryTicket.findMany({
    where: { seriesId, isSold: false },
    take: limit,
    include: { series: true },
    orderBy: { ticketCode: 'asc' },
  });

  return tickets.map((t) => ({
    ticketCode: t.ticketCode,
    ticketId: t.id,
    isSold: t.isSold,
    seriesId: t.seriesId,
    seriesName: t.series.name,
    price: t.series.ticketPrice,
  }));
}
