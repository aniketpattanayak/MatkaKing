'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}
function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

interface Series { id: string; name: string; ticketPrice: number; drawAt: string; status: string; prizePool: number; }
interface RetailerInfo { id: string; name: string; code: string; phone: string; commissionPct: number; isActive: boolean; totalSales: number; totalCommission: number; walletBalance: number; }
interface TicketResult { ticketCode: string; shareToken: string; shareUrl: string; }
interface Sale { id: string; placedAt: string; amountPaid: number; status: string; shareToken?: string; ticket?: { ticketCode: string }; series?: { name: string; drawAt: string; status: string }; }

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: "'Segoe UI', system-ui, sans-serif" },
  header: { background: 'rgba(0,0,0,0.8)', borderBottom: '1px solid rgba(254,140,69,0.2)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(12px)' },
  content: { maxWidth: 900, margin: '0 auto', padding: '32px 16px' },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 24 },
  label: { color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 6 },
  input: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const },
  btn: { background: 'linear-gradient(135deg,#fe8c45,#ca2826)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  btnGhost: { background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  statRow: { display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginBottom: 24 },
  stat: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px', flex: '1 1 140px', minWidth: 120 },
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return <button onClick={copy} style={{ ...S.btnGhost, padding: '5px 12px', fontSize: 12, color: copied ? '#22c55e' : undefined }}>{copied ? '✓ Copied' : '📋 Copy'}</button>;
}

export default function RetailerPage() {
  const router = useRouter();
  const [retailer, setRetailer] = useState<RetailerInfo | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [purchaseResult, setPurchaseResult] = useState<{ tickets: TicketResult[]; totalCost: number; commission: number; newBalance: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRetailer, rSeries] = await Promise.all([
        fetch('/api/retailer/buy', { headers: authHeaders() }),
        fetch('/api/lottery/series', { headers: authHeaders() }),
      ]);
      if (rRetailer.status === 401 || rRetailer.status === 403) { router.push('/auth/login'); return; }
      const dRetailer = await rRetailer.json();
      const dSeries = await rSeries.json();
      setRetailer(dRetailer.retailer);
      setSales(dRetailer.recentSales ?? []);
      const openSeries = (dSeries.series ?? []).filter((s: Series) => s.status === 'OPEN');
      setSeries(openSeries);
      if (openSeries.length > 0) setSelectedSeries(openSeries[0].id);
    } catch { setError('Failed to load retailer data'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleBuy = async () => {
    if (!selectedSeries) return setBuyError('Please select a series');
    setBuying(true); setBuyError(''); setPurchaseResult(null);
    try {
      const r = await fetch('/api/retailer/buy', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ seriesId: selectedSeries, quantity }) });
      const d = await r.json();
      if (!d.ok) return setBuyError(d.error ?? 'Purchase failed');
      setPurchaseResult({ tickets: d.tickets, totalCost: d.totalCost, commission: d.commission, newBalance: d.newBalance });
      setRetailer(prev => prev ? { ...prev, walletBalance: d.newBalance } : prev);
      const r2 = await fetch('/api/retailer/buy', { headers: authHeaders() });
      const d2 = await r2.json();
      setSales(d2.recentSales ?? []);
    } catch { setBuyError('Network error. Try again.'); }
    finally { setBuying(false); }
  };

  const seriesInfo = series.find(s => s.id === selectedSeries);
  const totalCost = (seriesInfo?.ticketPrice ?? 0) * quantity;
  const commission = retailer ? Math.floor(totalCost * retailer.commissionPct / 100) : 0;
  const netCost = totalCost - commission;

  if (loading) return <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ textAlign: 'center' }}><div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#fe8c45', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><p style={{ color: 'rgba(255,255,255,0.4)' }}>Loading...</p></div></div>;
  if (error) return <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ textAlign: 'center' }}><p style={{ color: '#ef4444', marginBottom: 12 }}>{error}</p><button onClick={load} style={S.btn}>Retry</button></div></div>;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontSize: 20 }}>🎰</span>
          <span style={{ color: '#fe8c45', fontWeight: 900, fontSize: 18 }}>KismatHub</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>🏪 {retailer?.name}</span>
          <span style={{ background: 'rgba(254,140,69,0.15)', color: '#fe8c45', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>₹{(retailer?.walletBalance ?? 0).toLocaleString('en-IN')}</span>
        </div>
      </header>
      <main style={S.content}>
        <h1 style={{ fontWeight: 900, fontSize: 24, margin: '0 0 24px' }}>Retailer Portal</h1>
        <div style={S.statRow}>
          {[
            { label: 'Wallet Balance', value: `₹${(retailer?.walletBalance ?? 0).toLocaleString('en-IN')}`, color: '#fe8c45' },
            { label: 'Total Sales', value: (retailer?.totalSales ?? 0).toString(), color: '#fff' },
            { label: 'Total Commission', value: `₹${(retailer?.totalCommission ?? 0).toLocaleString('en-IN')}`, color: '#22c55e' },
            { label: 'Commission Rate', value: `${retailer?.commissionPct ?? 0}%`, color: '#ffcb52' },
          ].map(({ label, value, color }) => (
            <div key={label} style={S.stat}>
              <p style={{ ...S.label, marginBottom: 6 }}>{label}</p>
              <p style={{ color, fontWeight: 800, fontSize: 22, margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <h2 style={{ fontWeight: 800, fontSize: 18, margin: '0 0 20px' }}>🎟️ Buy Tickets</h2>
          {series.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '20px 0' }}>No open lottery series available right now.</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <p style={S.label}>Select Series</p>
                  <select value={selectedSeries} onChange={e => setSelectedSeries(e.target.value)} style={{ ...S.input, cursor: 'pointer' }}>
                    {series.map(s => <option key={s.id} value={s.id} style={{ background: '#1a1a2e' }}>{s.name} — ₹{s.ticketPrice}/ticket</option>)}
                  </select>
                </div>
                <div>
                  <p style={S.label}>Quantity</p>
                  <input type="number" min={1} max={500} value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))} style={S.input} />
                </div>
              </div>
              {seriesInfo && (
                <div style={{ background: 'rgba(254,140,69,0.06)', border: '1px solid rgba(254,140,69,0.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                  <div><p style={{ ...S.label, marginBottom: 2 }}>Draw Date</p><p style={{ color: '#fff', fontSize: 13, margin: 0 }}>{new Date(seriesInfo.drawAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST</p></div>
                  <div><p style={{ ...S.label, marginBottom: 2 }}>Prize Pool</p><p style={{ color: '#ffcb52', fontSize: 13, margin: 0, fontWeight: 700 }}>₹{seriesInfo.prizePool.toLocaleString('en-IN')}</p></div>
                  <div><p style={{ ...S.label, marginBottom: 2 }}>Ticket Cost</p><p style={{ color: '#fff', fontSize: 13, margin: 0 }}>₹{totalCost.toLocaleString('en-IN')}</p></div>
                  <div><p style={{ ...S.label, marginBottom: 2 }}>Your Commission</p><p style={{ color: '#22c55e', fontSize: 13, margin: 0, fontWeight: 700 }}>+₹{commission.toLocaleString('en-IN')}</p></div>
                  <div><p style={{ ...S.label, marginBottom: 2 }}>Net Cost</p><p style={{ color: '#fe8c45', fontSize: 13, margin: 0, fontWeight: 700 }}>₹{netCost.toLocaleString('en-IN')}</p></div>
                </div>
              )}
              {buyError && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{buyError}</p>}
              <button onClick={handleBuy} disabled={buying} style={{ ...S.btn, opacity: buying ? 0.6 : 1 }}>{buying ? '⏳ Processing...' : `Buy ${quantity} Ticket${quantity !== 1 ? 's' : ''}`}</button>
            </>
          )}
        </div>
        {purchaseResult && (
          <div style={{ ...S.card, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: 18, margin: '0 0 4px', color: '#22c55e' }}>✅ Purchase Successful!</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
                  {purchaseResult.tickets.length} ticket{purchaseResult.tickets.length !== 1 ? 's' : ''} bought · Commission: <span style={{ color: '#22c55e', fontWeight: 700 }}>+₹{purchaseResult.commission}</span> · Balance: <span style={{ color: '#fe8c45', fontWeight: 700 }}>₹{purchaseResult.newBalance.toLocaleString('en-IN')}</span>
                </p>
              </div>
              <button onClick={() => setPurchaseResult(null)} style={{ ...S.btnGhost, padding: '4px 10px', fontSize: 12 }}>✕</button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 12 }}>Share these links with customers — <strong style={{ color: '#fff' }}>no login required</strong>.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {purchaseResult.tickets.map((t) => {
                const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${t.shareUrl}` : t.shareUrl;
                return (
                  <div key={t.shareToken} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ color: '#fe8c45', fontWeight: 700, fontSize: 15, margin: '0 0 2px', fontFamily: 'monospace', letterSpacing: 2 }}>{t.ticketCode}</p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: 0, wordBreak: 'break-all' }}>{fullUrl}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <CopyBtn text={fullUrl} />
                      <a href={t.shareUrl} target="_blank" rel="noreferrer" style={{ ...S.btnGhost, padding: '5px 12px', fontSize: 12, textDecoration: 'none' }}>🔗 Open</a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div style={S.card}>
          <h2 style={{ fontWeight: 800, fontSize: 18, margin: '0 0 16px' }}>📋 Recent Sales</h2>
          {sales.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0' }}>No sales yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Ticket', 'Series', 'Draw Date', 'Price', 'Status', 'Share Link'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => {
                    const shareUrl = sale.shareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/ticket/${sale.shareToken}` : null;
                    const statusColor = sale.status === 'WON' ? '#22c55e' : sale.status === 'LOST' ? '#ef4444' : 'rgba(255,255,255,0.4)';
                    return (
                      <tr key={sale.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#fe8c45', fontWeight: 700, letterSpacing: 1 }}>{sale.ticket?.ticketCode ?? '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#fff' }}>{sale.series?.name ?? '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{sale.series?.drawAt ? new Date(sale.series.drawAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#fff' }}>₹{sale.amountPaid}</td>
                        <td style={{ padding: '10px 12px', color: statusColor, fontWeight: 600 }}>{sale.status}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {shareUrl ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <CopyBtn text={shareUrl} />
                              <a href={`/ticket/${sale.shareToken}`} target="_blank" rel="noreferrer" style={{ ...S.btnGhost, padding: '4px 10px', fontSize: 11, textDecoration: 'none' }}>Open</a>
                            </div>
                          ) : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
