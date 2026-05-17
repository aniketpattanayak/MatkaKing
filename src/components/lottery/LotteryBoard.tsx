'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Zap, ShoppingCart, Filter, Grid, List } from 'lucide-react';
import { toast } from 'sonner';
import type { TicketSearchResult } from '@/types';

interface LotteryBoardProps {
  seriesId: string;
  seriesName: string;
  ticketPrice: number;
  userId: string;
}

const BULK_OPTIONS = [10, 20, 50] as const;

export default function LotteryBoard({
  seriesId,
  seriesName,
  ticketPrice,
  userId,
}: LotteryBoardProps) {
  const [tickets, setTickets] = useState<TicketSearchResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [lucky, setLucky] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ─── Real-time search ────────────────────────────────────────────────────
  const fetchTickets = useCallback(
    async (q: string, extras: Record<string, string> = {}) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ seriesId, ...(q ? { q } : extras) });
        const res = await fetch(`/api/lottery/search?${params}`);
        const data = await res.json();
        setTickets(data.tickets ?? []);
      } catch {
        toast.error('Failed to load tickets');
      } finally {
        setLoading(false);
      }
    },
    [seriesId]
  );

  // Debounced main search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchTickets(query);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, fetchTickets]);

  const applyFilters = () => {
    fetchTickets('', { prefix, suffix, lucky });
  };

  // ─── Ticket Selection ────────────────────────────────────────────────────
  const toggleSelect = (ticketId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId);
      else next.add(ticketId);
      return next;
    });
  };

  // ─── Quick Buy (Bulk) ────────────────────────────────────────────────────
  const quickBuy = async (quantity: (typeof BULK_OPTIONS)[number]) => {
    try {
      const res = await fetch('/api/lottery/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          seriesId,
          quantity,
          filter: prefix || suffix || lucky ? { prefix, suffix, luckyNumber: lucky } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`🎟️ Purchased ${quantity} tickets! Cost: ${data.totalCost} Coins`);
      fetchTickets(query);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Purchase failed');
    }
  };

  // ─── Buy Selected ────────────────────────────────────────────────────────
  const buySelected = async () => {
    if (selected.size === 0) return toast.warning('Select at least one ticket');
    const selectedTickets = tickets.filter((t) => selected.has(t.ticketId));

    try {
      const res = await fetch('/api/lottery/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          seriesId,
          quantity: selected.size,
          ticketIds: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`🎉 Purchased ${selectedTickets.length} tickets!`);
      setSelected(new Set());
      fetchTickets(query);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Purchase failed');
    }
  };

  const totalCost = selected.size * ticketPrice;

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="panel p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-lg">{seriesName}</h2>
            <p className="text-sm text-gray-500">
              {tickets.filter((t) => !t.isSold).length} tickets available ·{' '}
              <span className="text-gold">₹{ticketPrice} / ticket</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* ─── Search Bar ────────────────────────────────────────────────── */}
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              className="input-field pl-9"
              placeholder="Search tickets... (e.g. 98 → AH0098, LI9821)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary gap-1.5 ${showFilters ? 'border-amber-400' : ''}`}
          >
            <Filter size={14} /> Filters
          </button>
        </div>

        {/* ─── Advanced Filters ──────────────────────────────────────────── */}
        {showFilters && (
          <div className="mt-3 grid grid-cols-3 gap-2 fade-in-up">
            <input
              className="input-field text-xs"
              placeholder="Prefix (e.g. AH)"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            />
            <input
              className="input-field text-xs"
              placeholder="Suffix (e.g. 99)"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value.toUpperCase())}
            />
            <input
              className="input-field text-xs"
              placeholder="Lucky # (e.g. 7)"
              value={lucky}
              onChange={(e) => setLucky(e.target.value)}
            />
            <button className="btn-primary col-span-3 justify-center text-xs py-2" onClick={applyFilters}>
              Apply Filters
            </button>
          </div>
        )}
      </div>

      {/* ─── Quick Buy Bundles ─────────────────────────────────────────────── */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Buy:</span>
          {BULK_OPTIONS.map((qty) => (
            <button
              key={qty}
              onClick={() => quickBuy(qty)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              <Zap size={12} /> {qty} Tickets
              <span className="ml-1 opacity-60">(₹{qty * ticketPrice})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Ticket Grid ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12 text-gray-500 text-sm">Loading tickets…</div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {tickets.map((ticket) => (
            <div
              key={ticket.ticketId}
              onClick={() => !ticket.isSold && toggleSelect(ticket.ticketId)}
              className={`ticket-card ${ticket.isSold ? 'sold' : ''} ${selected.has(ticket.ticketId) ? 'selected' : ''}`}
            >
              {ticket.ticketCode}
            </div>
          ))}
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Ticket Code</th>
                <th>Status</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.ticketId}>
                  <td>
                    <input
                      type="checkbox"
                      disabled={ticket.isSold}
                      checked={selected.has(ticket.ticketId)}
                      onChange={() => toggleSelect(ticket.ticketId)}
                      className="accent-amber-500"
                    />
                  </td>
                  <td className="font-mono font-bold">{ticket.ticketCode}</td>
                  <td>
                    <span className={ticket.isSold ? 'badge-danger badge' : 'badge-success badge'}>
                      {ticket.isSold ? 'Sold' : 'Available'}
                    </span>
                  </td>
                  <td className="text-gold">₹{ticket.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Cart Bar ─────────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 p-4 z-40 fade-in-up"
          style={{ background: 'rgba(10,11,15,0.95)', borderTop: '1px solid rgba(245,166,35,0.3)' }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <span className="font-bold text-lg">{selected.size} tickets selected</span>
              <span className="ml-3 text-gold font-bold">₹{totalCost} total</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSelected(new Set())} className="btn-secondary py-2 text-xs">
                Clear
              </button>
              <button onClick={buySelected} className="btn-primary py-2">
                <ShoppingCart size={16} /> Buy Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
