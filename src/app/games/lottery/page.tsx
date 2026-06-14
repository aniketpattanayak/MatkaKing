'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Header from '@/components/layout/Header';
import { authFetch, getCachedUser, fetchCurrentUser } from '@/lib/auth-client';

interface Series {
  id: string; name: string; prefix: string; ticketPrice: number;
  prizePool: number; drawAt: string; status: string; totalTickets: number;
  _count?: { tickets: number };
}
interface Ticket { ticketCode: string; ticketId: string; isSold: boolean; price: number; }

// Fallback mock tickets when DB not available
function mockTickets(prefix: string, query: string, limit = 80): Ticket[] {
  const q = query.toUpperCase().trim();
  const out: Ticket[] = [];
  for (let i = 1; i <= 9999 && out.length < limit; i++) {
    const code = `${prefix}${String(i).padStart(4, '0')}`;
    if (!q || code.includes(q)) {
      let h = 0;
      for (let j = 0; j < code.length; j++) h = (h * 31 + code.charCodeAt(j)) & 0xffffffff;
      out.push({ ticketCode: code, ticketId: code, isSold: Math.abs(h) % 10 < 3, price: 25 });
    }
  }
  return out;
}

export default function LotteryPage() {
  const [allSeries,  setAllSeries]  = useState<Series[]>([]);
  const [series,     setSeries]     = useState<Series | null>(null);
  const [tickets,    setTickets]    = useState<Ticket[]>([]);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [query,      setQuery]      = useState('');
  const [lucky,      setLucky]      = useState('');
  const [buying,     setBuying]     = useState(false);
  const [balance,    setBalance]    = useState(0);
  const [loggedIn,   setLoggedIn]   = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const debounce = useRef<any>();

  // Load user
  useEffect(() => {
    const u = getCachedUser();
    if (u) { setBalance(u.balance); setLoggedIn(true); }
    fetchCurrentUser().then(u => { if (u) { setBalance(u.balance); setLoggedIn(true); } });
  }, []);

  // Load series from DB (what admin created)
  useEffect(() => {
    fetch('/api/lottery/series')
      .then(r => r.json())
      .then(d => {
        if (d.series?.length > 0) {
          setAllSeries(d.series);
          setSeries(d.series[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSeries(false));
  }, []);

  // Search tickets
  const searchTickets = useCallback((q: string) => {
    if (!series) return;
    authFetch(`/api/lottery/search?seriesId=${series.id}&q=${q}&limit=80`)
      .then(r => r.json())
      .then(d => {
        if (d.tickets?.length > 0) setTickets(d.tickets);
        else setTickets(mockTickets(series.prefix, q));
      })
      .catch(() => setTickets(mockTickets(series.prefix, q)));
  }, [series]);

  useEffect(() => {
    if (!series) return;
    setTickets(mockTickets(series.prefix, ''));
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => searchTickets(query), 300);
  }, [query, series, searchTickets]);

  useEffect(() => {
    if (!series) return;
    setSelected(new Set());
    setQuery('');
    setTickets(mockTickets(series.prefix, ''));
  }, [series]);

  const applyFilter = () => {
    if (!series) return;
    const filtered = mockTickets(series.prefix, query).filter(t => !lucky || t.ticketCode.includes(lucky));
    setTickets(filtered);
    toast.info(`${filtered.filter(t => !t.isSold).length} tickets found`);
  };

  const quickBuy = async (qty: number) => {
    if (!loggedIn) return toast.error('Please login first');
    if (!series) return;
    const cost = qty * series.ticketPrice;
    if (balance < cost) return toast.error(`Need ${cost} coins. Add funds to wallet.`);
    setBuying(true);
    try {
      const res = await authFetch('/api/lottery/buy', {
        method: 'POST',
        body: JSON.stringify({ seriesId: series.id, quantity: qty }),  // server picks random available tickets
      });
      const data = await res.json();
      if (res.ok) { setBalance(data.newBalance ?? balance - cost); toast.success(`${data.count} tickets bought! ${cost} coins deducted.`); }
      else throw new Error(data.error);
    } catch(e: any) {
      toast.error(e.message ?? 'Purchase failed');
    }
    setBuying(false);
    searchTickets(query);
  };

  const buySelected = async () => {
    if (!loggedIn) return toast.error('Please login to buy');
    if (!series) return;
    const cost = selected.size * series.ticketPrice;
    if (balance < cost) return toast.error(`Need ${cost} coins`);
    setBuying(true);
    try {
      const selectedTickets = tickets.filter(t => selected.has(t.ticketId));
      const res = await authFetch('/api/lottery/buy', {
        method: 'POST',
        body: JSON.stringify({ seriesId: series.id, ticketCodes: selectedTickets.map(t => t.ticketCode) }),
      });
      const data = await res.json();
      if (res.ok) { setBalance(data.newBalance ?? balance - cost); toast.success(`${data.count} tickets bought! Check Dashboard to view them.`); setSelected(new Set()); searchTickets(query); }
      else toast.error(data.error ?? 'Failed');
    } catch(e:any) { toast.error(e.message); }
    setBuying(false);
  };

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const available = tickets.filter(t => !t.isSold);
  const cost = series ? selected.size * series.ticketPrice : 0;

  // ── No series in DB ────────────────────────────────────────────────────────
  if (!loadingSeries && allSeries.length === 0) return (
    <>
      <Header />
      <div style={{ paddingTop: 140, textAlign: 'center', color: 'var(--Secondary)', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎟️</div>
          <h2 style={{ fontWeight: 900, fontSize: 24, marginBottom: 12, color: 'var(--White)' }}>No Lottery Series Available</h2>
          <p style={{ fontSize: 14, marginBottom: 24 }}>The admin hasn't created any lottery series yet.</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Admin → Lottery tab → Create New Series</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Header />

      <div style={{ background: 'linear-gradient(180deg,#0d0b2a,var(--Bg))', paddingTop: 130, paddingBottom: 40, textAlign: 'center' }}>
        <div className="tf-container">
          <h1 style={{ fontWeight: 900, fontSize: 44, marginBottom: 8 }}>🎟️ Lottery</h1>
          <p style={{ color: 'var(--Secondary)', fontSize: 15 }}>Search · Bulk Buy · Alphanumeric series tickets</p>
          {loggedIn && (
            <div style={{ display: 'inline-flex', marginTop: 14, background: 'rgba(255,203,82,0.1)', border: '1px solid rgba(255,203,82,0.3)', borderRadius: 999, padding: '7px 22px' }}>
              <span style={{ color: '#ffcb52', fontWeight: 700 }}>💰 {balance.toLocaleString()} Coins available</span>
            </div>
          )}
        </div>
      </div>

      <div className="main-content" style={{ paddingTop: 0 }}>
        <div className="tf-container">

          {/* Series tabs — from DB */}
          {loadingSeries ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--Secondary)' }}>Loading series...</div>
          ) : (
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {allSeries.map(s => (
                <button key={s.id} onClick={() => setSeries(s)} style={{
                  padding: '10px 20px', borderRadius: 12, border: '2px solid',
                  borderColor: series?.id === s.id ? 'var(--Main-color)' : 'var(--Border)',
                  background: series?.id === s.id ? 'rgba(254,140,69,0.12)' : 'var(--Bg-2)',
                  color: series?.id === s.id ? 'var(--Main-color)' : 'var(--Secondary)',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s'
                }}>
                  {s.name}
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 400, marginTop: 2 }}>
                    ₹{s.ticketPrice}/ticket · Draw {new Date(s.drawAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                </button>
              ))}
            </div>
          )}

          {series && (
            <>
              {/* Series info */}
              <div style={{ background: 'linear-gradient(135deg,#1a0f00,var(--Bg-10))', borderRadius: 16, padding: '20px 28px', marginBottom: 24, border: '1px solid rgba(254,140,69,0.2)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h3 style={{ fontWeight: 900, fontSize: 22, marginBottom: 4 }}>{series.name}</h3>
                  <p style={{ color: 'var(--Secondary)', fontSize: 13 }}>Series: {series.prefix}0001 – {series.prefix}{String(series.totalTickets || 9999).padStart(4, '0')}</p>
                </div>
                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Prize Pool', value: `₹${(series.prizePool).toLocaleString('en-IN')}`, color: '#ffcb52' },
                    { label: 'Per Ticket',  value: `₹${series.ticketPrice}`,                           color: '#fff' },
                    { label: 'Draw Date',   value: new Date(series.drawAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), color: '#fff' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: 'right' }}>
                      <p style={{ color: 'var(--Secondary)', fontSize: 11, marginBottom: 2, textTransform: 'uppercase' }}>{label}</p>
                      <p style={{ fontWeight: 900, fontSize: 18, color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
                  <input type="text" placeholder={`Search tickets... type 98 → ${series.prefix}0098`}
                    value={query} onChange={e => setQuery(e.target.value)}
                    style={{ width: '100%', padding: '13px 16px 13px 44px', borderRadius: 999, background: 'var(--Bg-3)', border: '1px solid var(--Border-2)', color: 'var(--White)', fontSize: 14, outline: 'none' }} />
                </div>
                <input placeholder="Lucky # (e.g. 7)" value={lucky} onChange={e => setLucky(e.target.value)}
                  style={{ width: 130, padding: '13px 16px', borderRadius: 999, background: 'var(--Bg-3)', border: '1px solid var(--Border-2)', color: 'var(--White)', fontSize: 13, outline: 'none' }} />
                <button onClick={applyFilter} className="tf-btn" style={{ height: 48, padding: '0 22px', fontSize: 14 }}>Filter</button>
              </div>

              {/* Quick buy */}
              <div style={{ background: 'var(--Bg-2)', borderRadius: 14, padding: '18px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: '1px solid var(--Border)' }}>
                <span style={{ fontWeight: 700, color: 'var(--Secondary)', fontSize: 13 }}>⚡ QUICK BUY:</span>
                {[10, 20, 50].map(qty => (
                  <button key={qty} onClick={() => quickBuy(qty)} disabled={buying} className="tf-btn" style={{ height: 40, fontSize: 13, padding: '0 18px' }}>
                    {qty} Tickets — ₹{qty * series.ticketPrice}
                  </button>
                ))}
                <span style={{ color: 'var(--Secondary)', fontSize: 12, marginLeft: 'auto' }}>₹{series.ticketPrice}/ticket · 1 Coin = 1 INR</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{available.length} available tickets</span>
                {selected.size > 0 && <span style={{ color: 'var(--Main-color)', fontWeight: 700 }}>{selected.size} selected · ₹{cost.toLocaleString()}</span>}
              </div>

              {/* Ticket grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 7, marginBottom: selected.size > 0 ? 110 : 48 }}>
                {tickets.map(t => {
                  const sel = selected.has(t.ticketId);
                  return (
                    <div key={t.ticketId} onClick={() => !t.isSold && toggle(t.ticketId)} style={{
                      padding: '10px 4px', borderRadius: 10, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                      cursor: t.isSold ? 'not-allowed' : 'pointer', border: '1px solid',
                      borderColor: t.isSold ? 'transparent' : sel ? 'var(--Main-color)' : 'var(--Border-2)',
                      background: t.isSold ? 'rgba(255,255,255,0.02)' : sel ? 'rgba(254,140,69,0.15)' : 'var(--Bg-2)',
                      color: t.isSold ? 'rgba(255,255,255,0.15)' : sel ? 'var(--Main-color)' : 'var(--White)',
                      transform: sel ? 'translateY(-2px)' : 'none',
                      boxShadow: sel ? '0 4px 14px rgba(254,140,69,0.25)' : 'none',
                      transition: 'all 0.12s',
                    }}>
                      {t.ticketCode}
                      {t.isSold && <div style={{ fontSize: 8, marginTop: 2, letterSpacing: 1 }}>SOLD</div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cart bar */}
      {selected.size > 0 && series && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'var(--Bg-2)',
          borderTop: '2px solid rgba(254,140,69,0.5)',
          padding: '14px 24px',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        }}>
          <div className="tf-container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--Secondary)' }}>{selected.size} tickets selected</span>
                  <span style={{ marginLeft: 12, color: '#ffcb52', fontWeight: 900, fontSize: 24 }}>₹{cost.toLocaleString()}</span>
                </div>
                {loggedIn && balance < cost && (
                  <Link href="/dashboard/wallet" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 999,
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.4)',
                    color: '#ef4444', fontWeight: 700, fontSize: 13,
                    textDecoration: 'none',
                  }}>
                    ⚠️ Insufficient coins — Add funds →
                  </Link>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setSelected(new Set())} style={{ padding: '10px 20px', borderRadius: 999, border: '1px solid var(--Border)', background: 'transparent', color: 'var(--Secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Clear</button>
                <button onClick={buySelected} disabled={buying || !loggedIn || balance < cost} className="tf-btn" style={{ height: 46, fontSize: 15, padding: '0 32px', opacity: (buying || balance < cost) ? 0.5 : 1, cursor: balance < cost ? 'not-allowed' : 'pointer' }}>
                  {!loggedIn ? '🔒 Login to Buy' : buying ? 'Processing...' : `🎟 Buy Now — ₹${cost.toLocaleString()}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer id="footer">
        <div className="footer-bottom" style={{ paddingTop: 28, paddingBottom: 28 }}>
          <div className="tf-container">
            <div className="wrapper">
              <div className="center"><ul style={{ display: 'flex', gap: 24 }}>
                <li><Link href="/">Home</Link></li>
                <li><Link href="/games/matka">Matka King</Link></li>
                <li><Link href="/games/spin">Spin Wheel</Link></li>
              </ul></div>
              <div className="right"><span>© 2025 Supreme Gaming Engine</span></div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
