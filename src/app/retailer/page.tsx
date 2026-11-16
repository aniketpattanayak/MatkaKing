'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { authFetch, getCachedUser, fetchCurrentUser } from '@/lib/auth-client';

interface RetailerStats {
  id: string;
  name: string;
  code: string;
  phone: string;
  commissionPct: number;
  isActive: boolean;
  totalSales: number;
  totalCommission: number;
  walletBalance: number;
}

interface Sale {
  id: string;
  placedAt: string;
  amountPaid: number;
  status: string;
  wonAmount: number;
  ticket: { ticketCode: string };
  series: { name: string; drawAt: string; status: string };
  user: { name: string; phone: string };
}

interface Series {
  id: string;
  name: string;
  prefix: string;
  ticketPrice: number;
  status: string;
  drawAt: string;
}

export default function RetailerDashboard() {
  const [user, setUser]       = useState<any>(null);
  const [stats, setStats]     = useState<RetailerStats | null>(null);
  const [sales, setSales]     = useState<Sale[]>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [loading, setLoading]  = useState(true);
  const [buying, setBuying]    = useState(false);

  // Buy form state
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  const [buyQty, setBuyQty] = useState(1);

  useEffect(() => {
    const cached = getCachedUser();
    if (cached) setUser(cached);
    fetchCurrentUser().then(u => { if (u) setUser(u); });
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, seriesRes] = await Promise.all([
        authFetch('/api/retailer/buy'),
        authFetch('/api/lottery/series'),
      ]);
      const statsData  = await statsRes.json();
      const seriesData = await seriesRes.json();

      if (statsData.retailer) {
        setStats(statsData.retailer);
        setSales(statsData.recentSales ?? []);
      }
      if (seriesData.series) {
        const open = seriesData.series.filter((s: Series) => s.status === 'OPEN');
        setAllSeries(open);
        if (open.length > 0 && !selectedSeriesId) setSelectedSeriesId(open[0].id);
      }
    } catch (e: any) {
      toast.error('Failed to load retailer data');
    }
    setLoading(false);
  };

  const buyForCustomer = async () => {
    if (!customerPhone || customerPhone.length < 10)
      return toast.error('Enter a valid 10-digit customer phone number');
    if (!selectedSeriesId)
      return toast.error('Select a lottery series');
    if (buyQty < 1 || buyQty > 100)
      return toast.error('Quantity must be between 1 and 100');

    setBuying(true);
    try {
      const res = await authFetch('/api/retailer/buy', {
        method: 'POST',
        body: JSON.stringify({
          seriesId: selectedSeriesId,
          quantity: buyQty,
          customerPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`✅ ${data.count} ticket(s) bought for ${data.customer?.name ?? customerPhone}!\nTickets: ${data.tickets?.join(', ')}\nCommission earned: ₹${data.commission}`);
      setCustomerPhone('');
      setBuyQty(1);
      loadData(); // Refresh stats
    } catch (e: any) {
      toast.error(e.message ?? 'Purchase failed');
    }
    setBuying(false);
  };

  const selectedSeries = allSeries.find(s => s.id === selectedSeriesId);
  const totalCost = buyQty * (selectedSeries?.ticketPrice ?? 0);
  const commission = stats ? Math.floor(totalCost * stats.commissionPct / 100) : 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--Bg-1)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid var(--Border)', borderTopColor: 'var(--Main-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--Secondary)' }}>Loading retailer portal...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--Bg-1)' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>🏪</p>
          <h2 style={{ fontWeight: 800, marginBottom: 12 }}>Retailer Portal</h2>
          <p style={{ color: 'var(--Secondary)', marginBottom: 24 }}>
            You are not registered as a retailer. Please contact admin to get your retailer account activated.
          </p>
          <Link href="/dashboard" className="tf-btn" style={{ display: 'inline-block', padding: '12px 28px' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--Bg-1)', paddingBottom: 60 }}>
      {/* Top bar */}
      <div style={{ background: 'var(--Bg-2)', borderBottom: '1px solid var(--Border)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/images/logo/logo.png" alt="Logo" height={40} style={{ objectFit: 'contain' }} />
          </Link>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>🏪 Retailer Portal</h1>
            <p style={{ color: 'var(--Secondary)', fontSize: 12, margin: 0 }}>{stats.name} · Code: {stats.code}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!stats.isActive && (
            <span style={{ background: '#ef4444', color: '#fff', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>INACTIVE</span>
          )}
          <div style={{ background: 'var(--Bg-3)', padding: '8px 20px', borderRadius: 999, fontWeight: 700, color: '#ffcb52' }}>
            💰 ₹{(stats.walletBalance ?? 0).toLocaleString()} Balance
          </div>
          <Link href="/dashboard" style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid var(--Border)', color: 'var(--Secondary)', fontSize: 13, textDecoration: 'none' }}>
            My Account
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Wallet Balance',     value: `₹${(stats.walletBalance ?? 0).toLocaleString()}`, color: '#ffcb52', icon: '💰' },
            { label: 'Total Tickets Sold', value: stats.totalSales.toLocaleString(),                  color: '#2ECC71', icon: '🎟️' },
            { label: 'Total Commission',   value: `₹${stats.totalCommission.toLocaleString()}`,       color: '#9B59B6', icon: '💎' },
            { label: 'Commission Rate',    value: `${stats.commissionPct}%`,                          color: '#3498DB', icon: '📊' },
          ].map(({ label, value, color, icon }) => (
            <div key={label} style={{ background: 'var(--Bg-2)', borderRadius: 16, padding: '20px 24px', border: '1px solid var(--Border)' }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>{icon}</p>
              <p style={{ color: 'var(--Secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</p>
              <p style={{ fontWeight: 900, fontSize: 24, color }}>{value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* Buy Tickets for Customer */}
          <div style={{ background: 'var(--Bg-2)', borderRadius: 16, padding: 28, border: '1px solid var(--Border)' }}>
            <h2 style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>🎟️ Buy Tickets for Customer</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: 'var(--Secondary)', fontSize: 13, marginBottom: 6 }}>Customer Phone Number</label>
              <input
                type="tel"
                placeholder="Enter 10-digit phone"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: 'var(--Bg-3)', border: '1px solid var(--Border-2)', color: 'var(--White)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ color: 'var(--Secondary)', fontSize: 11, marginTop: 4 }}>Customer must be registered on MatkaKing</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: 'var(--Secondary)', fontSize: 13, marginBottom: 6 }}>Select Lottery Series</label>
              <select
                value={selectedSeriesId}
                onChange={e => setSelectedSeriesId(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: 'var(--Bg-3)', border: '1px solid var(--Border-2)', color: 'var(--White)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              >
                {allSeries.length === 0 && <option value="">No open series</option>}
                {allSeries.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — ₹{s.ticketPrice}/ticket
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: 'var(--Secondary)', fontSize: 13, marginBottom: 6 }}>Quantity</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setBuyQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: 999, border: '1px solid var(--Border)', background: 'var(--Bg-3)', color: 'var(--White)', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>−</button>
                <input
                  type="number" min="1" max="100"
                  value={buyQty}
                  onChange={e => setBuyQty(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  style={{ width: 70, textAlign: 'center', padding: '8px', borderRadius: 8, background: 'var(--Bg-3)', border: '1px solid var(--Border-2)', color: 'var(--White)', fontSize: 16, outline: 'none' }}
                />
                <button onClick={() => setBuyQty(q => Math.min(100, q + 1))} style={{ width: 36, height: 36, borderRadius: 999, border: '1px solid var(--Border)', background: 'var(--Bg-3)', color: 'var(--White)', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</button>
              </div>
            </div>

            {/* Cost preview */}
            {selectedSeries && (
              <div style={{ background: 'var(--Bg-3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--Secondary)', fontSize: 13 }}>Total Cost</span>
                  <strong style={{ color: '#ffcb52' }}>₹{totalCost.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--Secondary)', fontSize: 13 }}>Your Commission ({stats.commissionPct}%)</span>
                  <strong style={{ color: '#2ECC71' }}>+₹{commission}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--Secondary)', fontSize: 13 }}>Net Debit from Wallet</span>
                  <strong style={{ color: 'var(--White)' }}>₹{totalCost - commission}</strong>
                </div>
              </div>
            )}

            <button
              onClick={buyForCustomer}
              disabled={buying || !stats.isActive || allSeries.length === 0}
              style={{
                width: '100%', padding: '14px', borderRadius: 12,
                background: buying ? 'var(--Bg-3)' : 'linear-gradient(135deg, var(--Main-color), #f59e0b)',
                color: '#fff', fontWeight: 800, fontSize: 16, border: 'none',
                cursor: buying || !stats.isActive ? 'not-allowed' : 'pointer',
                opacity: !stats.isActive ? 0.5 : 1,
              }}
            >
              {!stats.isActive ? '⛔ Account Inactive' : buying ? 'Processing...' : `🎟️ Buy ${buyQty} Ticket(s) for Customer`}
            </button>
          </div>

          {/* Recent Sales */}
          <div style={{ background: 'var(--Bg-2)', borderRadius: 16, padding: 28, border: '1px solid var(--Border)' }}>
            <h2 style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>📋 Recent Sales</h2>

            {sales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--Secondary)' }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>🎟️</p>
                <p>No sales yet. Buy tickets for your first customer!</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--Border)' }}>
                      {['Ticket', 'Customer', 'Series', 'Paid', 'Result'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--Secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale, i) => {
                      const isWon  = sale.status === 'WON';
                      const isLost = sale.status === 'LOST';
                      return (
                        <tr key={sale.id} style={{ borderBottom: '1px solid var(--Border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '10px', fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>{sale.ticket?.ticketCode ?? '—'}</td>
                          <td style={{ padding: '10px', fontSize: 13 }}>
                            <span style={{ fontWeight: 600 }}>{sale.user?.name ?? '—'}</span>
                            <br/><span style={{ color: 'var(--Secondary)', fontSize: 11 }}>{sale.user?.phone}</span>
                          </td>
                          <td style={{ padding: '10px', fontSize: 12, color: 'var(--Secondary)' }}>{sale.series?.name ?? '—'}</td>
                          <td style={{ padding: '10px', fontWeight: 700, color: '#ffcb52', fontSize: 13 }}>₹{sale.amountPaid}</td>
                          <td style={{ padding: '10px' }}>
                            {isWon  && <span style={{ background: '#166534', color: '#86efac', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>🏆 Won ₹{sale.wonAmount}</span>}
                            {isLost && <span style={{ background: '#7f1d1d', color: '#fca5a5', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>✕ Lost</span>}
                            {!isWon && !isLost && <span style={{ background: 'rgba(255,203,82,0.1)', color: '#ffcb52', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>⏳ Active</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
