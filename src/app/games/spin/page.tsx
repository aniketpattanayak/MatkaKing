'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Header from '@/components/layout/Header';
import { authFetch, getCachedUser, fetchCurrentUser } from '@/lib/auth-client';

// ─── Wheel segments ───────────────────────────────────────────────────────────

const SEGMENTS = [
  { label: '₹5,000', coins: 5000, probability: 0.02, color: '#FFD700', text: '#000' },
  { label: '₹2,000', coins: 2000, probability: 0.05, color: '#FF6B35', text: '#fff' },
  { label: '₹1,000', coins: 1000, probability: 0.08, color: '#9B59B6', text: '#fff' },
  { label: '₹500',   coins: 500,  probability: 0.10, color: '#3498DB', text: '#fff' },
  { label: '₹200',   coins: 200,  probability: 0.15, color: '#2ECC71', text: '#fff' },
  { label: '₹100',   coins: 100,  probability: 0.20, color: '#E74C3C', text: '#fff' },
  { label: '₹50',    coins: 50,   probability: 0.20, color: '#F39C12', text: '#fff' },
  { label: 'Try Again', coins: 0, probability: 0.20, color: '#4A5568', text: '#fff' },
];

const SPIN_COST   = 10;
const FREE_EVERY  = 6;

function weightedRandom(): number {
  let r = Math.random(), cum = 0;
  for (let i = 0; i < SEGMENTS.length; i++) {
    cum += SEGMENTS[i].probability;
    if (r <= cum) return i;
  }
  return SEGMENTS.length - 1;
}

// ─── Canvas wheel draw ────────────────────────────────────────────────────────

function drawWheel(canvas: HTMLCanvasElement, angle: number) {
  const ctx   = canvas.getContext('2d')!;
  const size  = canvas.width;
  const cx    = size / 2;
  const r     = cx - 6;
  const slice = (2 * Math.PI) / SEGMENTS.length;

  ctx.clearRect(0, 0, size, size);

  SEGMENTS.forEach((seg, i) => {
    const start = angle + i * slice;
    const end   = start + slice;

    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.arc(cx, cx, r, start, end);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate(start + slice / 2);
    ctx.textAlign    = 'right';
    ctx.fillStyle    = seg.text;
    ctx.font         = `bold ${seg.label.length > 5 ? 11 : 13}px monospace`;
    ctx.shadowColor  = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur   = 3;
    ctx.fillText(seg.label, r - 10, 5);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(245,166,35,0.6)';
  ctx.lineWidth   = 5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cx, 30, 0, 2 * Math.PI);
  ctx.fillStyle = '#1a1d27';
  ctx.fill();
  ctx.strokeStyle = '#f5a623';
  ctx.lineWidth   = 3;
  ctx.stroke();

  ctx.fillStyle    = '#f5a623';
  ctx.font         = 'bold 11px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPIN', cx, cx);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SpinPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>();
  const angleRef  = useRef(0);

  const [spinning,  setSpinning]  = useState(false);
  const [result,    setResult]    = useState<typeof SEGMENTS[0] | null>(null);
  const [balance,   setBalance]   = useState(0);
  const [loggedIn,  setLoggedIn]  = useState(false);
  const [spinCount, setSpinCount] = useState(0);
  const [history,   setHistory]   = useState<{ label: string; coins: number; time: string }[]>([]);

  const redraw = useCallback((a: number) => {
    if (canvasRef.current) drawWheel(canvasRef.current, a);
  }, []);

  useEffect(() => { redraw(0); }, [redraw]);

  useEffect(() => {
    const u = getCachedUser();
    if (u) { setBalance(u.balance); setLoggedIn(true); }
    fetchCurrentUser().then(u => {
      if (u) { setBalance(u.balance); setLoggedIn(true); }
    });
    authFetch('/api/spin/rewards').then(r => r.json()).then(d => {
      if (d.spinCount) setSpinCount(d.spinCount);
      if (d.history)   setHistory(d.history.map((h: any) => ({
        label: h.rewardId,
        coins: h.coinsWon,
        time:  new Date(h.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      })));
    }).catch(() => {});
  }, []);

  const spinsUntilFree = FREE_EVERY - (spinCount % FREE_EVERY);
  const nextIsFree     = spinsUntilFree === FREE_EVERY;

  const spin = async () => {
    if (spinning) return;
    if (!loggedIn) return toast.error('Please login to spin');

    const cost = nextIsFree ? 0 : SPIN_COST;
    if (balance < cost) return toast.error(`Need ${cost} coins. Add funds to wallet.`);

    setSpinning(true);
    setResult(null);

    if (cost > 0) setBalance(b => b - cost);

    let winnerIdx = weightedRandom();
    try {
      const res  = await authFetch('/api/spin/rewards', { method: 'POST', body: JSON.stringify({ useFreeSpins: nextIsFree }) });
      const data = await res.json();
      if (res.ok) {
        const found = SEGMENTS.findIndex(s => s.label === data.reward?.label);
        if (found >= 0) winnerIdx = found;
        if (data.newBalance !== undefined) setBalance(data.newBalance);
      }
    } catch { /* demo */ }

    const slice      = (2 * Math.PI) / SEGMENTS.length;
    const targetAngle = -(winnerIdx * slice + slice / 2);
    const fullSpins  = Math.PI * 2 * (5 + Math.random() * 3);
    const endAngle   = angleRef.current + fullSpins + (targetAngle - ((angleRef.current + fullSpins) % (2 * Math.PI)));
    const startAngle = angleRef.current;
    const startTime  = performance.now();
    const duration   = 4500;

    const animate = (now: number) => {
      const t       = Math.min((now - startTime) / duration, 1);
      const eased   = 1 - Math.pow(1 - t, 4);
      const current = startAngle + (endAngle - startAngle) * eased;
      angleRef.current = current;
      redraw(current);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setSpinCount(c => c + 1);

        const winner = SEGMENTS[winnerIdx];
        setResult(winner);

        if (winner.coins > 0) {
          setBalance(b => b + winner.coins);
          setHistory(h => [{
            label: winner.label, coins: winner.coins,
            time:  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          }, ...h.slice(0, 9)]);
          toast.success(`${winner.label} — ${winner.coins} Coins added!`);
        } else {
          setHistory(h => [{
            label: 'Try Again', coins: 0,
            time:  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          }, ...h.slice(0, 9)]);
          toast.info('Better luck next time!');
        }

        if (nextIsFree) toast.info('That was your FREE spin!');
      }
    };

    animRef.current = requestAnimationFrame(animate);
  };

  return (
    <>
      <Header />

      {/* Page Title */}
      <div style={{ background: 'linear-gradient(180deg,#0d0b2a,var(--Bg))', paddingTop: 130, paddingBottom: 40, textAlign: 'center' }}>
        <div className="tf-container">
          <h1 style={{ fontWeight: 900, fontSize: 44, marginBottom: 8 }}>Spin Wheel</h1>
          <p style={{ color: 'var(--Secondary)', fontSize: 15 }}>
            Buy {FREE_EVERY - 1} spins, get 1 FREE · Instant coin rewards
          </p>
          {loggedIn && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 16, marginTop: 14,
              background: 'rgba(255,203,82,0.1)', border: '1px solid rgba(255,203,82,0.3)',
              borderRadius: 999, padding: '8px 24px',
            }}>
              <span style={{ color: '#ffcb52', fontWeight: 700 }}>{balance.toLocaleString()} Coins</span>
              <span style={{ color: 'var(--Secondary)', fontSize: 13 }}>
                {nextIsFree ? 'Next spin is FREE!' : `${spinsUntilFree} spins until free`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="main-content" style={{ paddingTop: 0 }}>
        <div className="tf-container">

          {/* Promo banner */}
          <div style={{
            background: 'linear-gradient(135deg,#1a0f00,#2a1500)',
            border: '1px solid rgba(254,140,69,0.35)',
            borderRadius: 16, padding: '18px 28px', marginBottom: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 14,
          }}>
            <div>
              <h3 style={{ fontWeight: 900, fontSize: 20, marginBottom: 4 }}>
                Buy {FREE_EVERY - 1} Spins — Get 1 <span style={{ color: '#ffcb52' }}>FREE!</span>
              </h3>
              <p style={{ color: 'var(--Secondary)', fontSize: 13 }}>
                ₹{SPIN_COST}/spin · Coins credited instantly · Top prize: ₹5,000
              </p>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#ffcb52' }}>{spinCount}</div>
                <div style={{ fontSize: 11, color: 'var(--Secondary)' }}>Spins today</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#2ECC71' }}>
                  {history.filter(h => h.coins > 0).reduce((s, h) => s + h.coins, 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--Secondary)' }}>Coins won</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>

            {/* ── Wheel ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Triangle pointer */}
                <div style={{
                  position: 'absolute', top: -14, zIndex: 10,
                  width: 0, height: 0,
                  borderLeft: '12px solid transparent',
                  borderRight: '12px solid transparent',
                  borderTop: '24px solid #f5a623',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                }} />

                {/* Glow ring */}
                <div style={{
                  position: 'absolute', inset: -6, borderRadius: '50%',
                  boxShadow: spinning
                    ? '0 0 50px rgba(245,166,35,0.8), 0 0 100px rgba(245,166,35,0.4)'
                    : '0 0 24px rgba(245,166,35,0.3)',
                  transition: 'box-shadow 0.3s',
                }} />

                <canvas
                  ref={canvasRef}
                  width={320} height={320}
                  style={{ borderRadius: '50%', cursor: spinning ? 'not-allowed' : 'pointer', display: 'block' }}
                  onClick={spin}
                />
              </div>

              {/* Spin button */}
              <button onClick={spin} disabled={spinning || !loggedIn} style={{
                minWidth: 220, height: 52, borderRadius: 999, border: 'none',
                cursor: (spinning || !loggedIn) ? 'not-allowed' : 'pointer',
                background: (!loggedIn || spinning) ? 'var(--Bg-3)' : 'linear-gradient(270deg,#fe8c45,#ca2826)',
                color: '#fff', fontWeight: 900, fontSize: 17, transition: 'all 0.2s',
                opacity: (spinning || !loggedIn) ? 0.55 : 1,
              }}>
                {!loggedIn    ? 'Login to Spin'
                  : spinning  ? 'Spinning...'
                  : nextIsFree ? 'FREE Spin!'
                  : `Spin — ₹${SPIN_COST}`}
              </button>

              {/* Result card */}
              {result && !spinning && (
                <div style={{
                  width: '100%',
                  background: result.coins > 0 ? 'rgba(46,204,113,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${result.coins > 0 ? 'rgba(46,204,113,0.4)' : 'var(--Border)'}`,
                  borderRadius: 16, padding: '20px 24px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 40, marginBottom: 6 }}>{result.coins > 0 ? '🎉' : '😔'}</div>
                  <div style={{ fontWeight: 900, fontSize: 26, marginBottom: 4 }}>{result.label}</div>
                  {result.coins > 0 && (
                    <div style={{ color: '#2ECC71', fontWeight: 700 }}>
                      +{result.coins.toLocaleString()} Coins credited to your wallet!
                    </div>
                  )}
                </div>
              )}

              {!loggedIn && (
                <p style={{ textAlign: 'center', color: 'var(--Secondary)', fontSize: 13 }}>
                  Please <a href="#" style={{ color: 'var(--Main-color)', fontWeight: 700 }}>login</a> to spin
                </p>
              )}
              {loggedIn && balance < SPIN_COST && !nextIsFree && (
                <Link href="/dashboard/wallet" style={{ color: '#fe8c45', fontSize: 13, fontWeight: 600 }}>
                  Add coins to spin →
                </Link>
              )}
            </div>

            {/* ── Right panel ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Rewards table — probability % hidden */}
              <div style={{ background: 'var(--Bg-2)', borderRadius: 16, padding: 20, border: '1px solid var(--Border)' }}>
                <h4 style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Possible Rewards</h4>
                {SEGMENTS.map(s => (
                  <div key={s.label} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{s.label}</span>
                    {s.coins > 0 && (
                      <span style={{ fontSize: 12, color: '#2ECC71', fontWeight: 700 }}>
                        +{s.coins.toLocaleString()} Coins
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Spin history */}
              {history.length > 0 && (
                <div style={{ background: 'var(--Bg-2)', borderRadius: 16, padding: 20, border: '1px solid var(--Border)' }}>
                  <h4 style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Today's Spins</h4>
                  {history.map((h, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '7px 0',
                      borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      fontSize: 13,
                    }}>
                      <span style={{ fontWeight: 600 }}>{h.label}</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {h.coins > 0 && (
                          <span style={{ color: '#2ECC71', fontWeight: 700 }}>+{h.coins.toLocaleString()}</span>
                        )}
                        <span style={{ color: 'var(--Secondary)', fontSize: 11 }}>{h.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* How it works */}
              <div style={{ background: 'var(--Bg-2)', borderRadius: 16, padding: 20, border: '1px solid var(--Border)' }}>
                <h4 style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>How It Works</h4>
                {[
                  { title: 'Add Coins',     desc: 'Deposit via UPI. 1 INR = 1 Coin.' },
                  { title: 'Spin',          desc: `₹${SPIN_COST}/spin. Every ${FREE_EVERY}th spin is FREE!` },
                  { title: 'Win Instantly', desc: 'Coins credited immediately. Withdraw anytime.' },
                ].map(item => (
                  <div key={item.title} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</div>
                      <div style={{ color: 'var(--Secondary)', fontSize: 12 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
                <Link href="/dashboard/wallet" className="tf-btn" style={{
                  width: '100%', justifyContent: 'center', height: 42, fontSize: 13, marginTop: 8,
                }}>
                  Add Coins to Wallet
                </Link>
              </div>

            </div>
          </div>

        </div>
      </div>

      <footer id="footer">
        <div className="footer-bottom" style={{ paddingTop: 28, paddingBottom: 28 }}>
          <div className="tf-container">
            <div className="wrapper">
              <div className="center"><ul style={{ display: 'flex', gap: 24 }}>
                <li><Link href="/">Home</Link></li>
                <li><Link href="/games/lottery">Lottery</Link></li>
                <li><Link href="/games/matka">Matka King</Link></li>
              </ul></div>
              <div className="right"><span>© 2025 Supreme Gaming Engine</span></div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}