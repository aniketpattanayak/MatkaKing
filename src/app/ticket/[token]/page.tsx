'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PublicTicketPage({ params }: { params: { token: string } }) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetch(`/api/ticket/${params.token}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d.ticket); else setError(d.error ?? 'Ticket not found'); })
      .catch(() => setError('Failed to load ticket'))
      .finally(() => setLoading(false));
  }, [params.token]);

  const bgStyle: React.CSSProperties = { minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0f0a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: "'Segoe UI', system-ui, sans-serif" };

  if (loading) return <div style={bgStyle}><div style={{ textAlign: 'center', color: '#fff' }}><div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#fe8c45', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} /><p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading your ticket...</p><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div></div>;
  if (error) return <div style={bgStyle}><div style={{ textAlign: 'center', color: '#fff', maxWidth: 380 }}><p style={{ fontSize: 56, marginBottom: 16 }}>🎟️</p><h2 style={{ fontWeight: 800, marginBottom: 12 }}>Ticket Not Found</h2><p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>{error}</p><Link href="/" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#fe8c45,#ca2826)', color: '#fff', padding: '12px 28px', borderRadius: 999, fontWeight: 700, textDecoration: 'none' }}>Go to Homepage</Link></div></div>;

  const { ticketCode, status, wonAmount, amountPaid, placedAt, isWinner, prizeRank, series, retailer } = data;
  const drawn = series?.status === 'DRAWN';
  const drawDate = series?.drawAt ? new Date(series.drawAt) : null;

  let statusBg = 'rgba(255,203,82,0.12)', statusColor = '#ffcb52', statusText = '⏳ Draw Pending';
  let statusSubtext = drawDate ? `Draw: ${drawDate.toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Kolkata' })} IST` : '';
  if (drawn && isWinner) {
    statusBg = 'rgba(34,197,94,0.12)'; statusColor = '#22c55e';
    statusText = prizeRank === 1 ? '🏆 1st Prize Winner!' : prizeRank === 2 ? '🥈 2nd Prize Winner!' : prizeRank === 3 ? '🥉 3rd Prize Winner!' : '🏆 You Won!';
    statusSubtext = `Won ₹${wonAmount.toLocaleString('en-IN')}`;
  } else if (drawn && !isWinner) {
    statusBg = 'rgba(239,68,68,0.10)'; statusColor = '#ef4444';
    statusText = '✕ Not a Winner This Time'; statusSubtext = 'Better luck next draw!';
  }

  const prizeRows = [{ rank: '🥇 1st Prize', amount: series?.firstPrize }, { rank: '🥈 2nd Prize', amount: series?.secondPrize }, { rank: '🥉 3rd Prize', amount: series?.thirdPrize }].filter(r => r.amount > 0);

  return (
    <div style={bgStyle}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 20 }}>
            <span style={{ fontSize: 24 }}>🎰</span>
            <span style={{ color: '#fe8c45', fontWeight: 900, fontSize: 20, letterSpacing: 1 }}>KismatHub</span>
          </Link>
          <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 26, margin: 0 }}>Your Lottery Ticket</h1>
        </div>
        <div style={{ background: 'linear-gradient(135deg, rgba(254,140,69,0.08), rgba(202,40,38,0.06))', border: '1px solid rgba(254,140,69,0.25)', borderRadius: 24, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(254,140,69,0.2), rgba(202,40,38,0.15))', padding: '28px 24px', textAlign: 'center', borderBottom: '1px dashed rgba(254,140,69,0.2)' }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 8px' }}>Ticket Number</p>
            <p style={{ color: '#fe8c45', fontWeight: 900, fontSize: 42, fontFamily: 'monospace', letterSpacing: 4, margin: 0 }}>{ticketCode}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>{series?.name}</p>
          </div>
          <div style={{ padding: '20px 24px', background: statusBg, borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <p style={{ color: statusColor, fontWeight: 800, fontSize: 18, margin: '0 0 4px' }}>{statusText}</p>
            {statusSubtext && <p style={{ color: statusColor, opacity: 0.8, fontSize: 14, margin: 0 }}>{statusSubtext}</p>}
          </div>
          <div style={{ padding: '20px 24px' }}>
            {[
              { label: 'Series', value: series?.name },
              { label: 'Draw Date', value: drawDate?.toLocaleString('en-IN', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Kolkata' }) + ' IST' },
              { label: 'Prize Pool', value: `₹${(series?.prizePool ?? 0).toLocaleString('en-IN')}` },
              { label: 'Ticket Price', value: `₹${amountPaid}` },
              { label: 'Purchased', value: new Date(placedAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Kolkata' }) },
              ...(retailer ? [{ label: 'Sold by', value: `${retailer.name} (${retailer.code})` }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{label}</span>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'right', maxWidth: '55%' }}>{value}</span>
              </div>
            ))}
          </div>
          {prizeRows.length > 0 && (
            <div style={{ padding: '0 24px 24px' }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 12px' }}>Prize Structure</p>
              {prizeRows.map(({ rank, amount }) => (
                <div key={rank} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{rank}</span>
                  <span style={{ color: '#ffcb52', fontWeight: 700, fontSize: 13 }}>₹{(amount ?? 0).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 12 }}>Want to buy your own tickets?</p>
          <Link href="/games/lottery" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#fe8c45,#ca2826)', color: '#fff', padding: '12px 32px', borderRadius: 999, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>🎟️ Buy Lottery Tickets</Link>
        </div>
      </div>
    </div>
  );
}
