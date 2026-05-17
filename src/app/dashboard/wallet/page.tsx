'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, CheckCircle, RefreshCw, Wallet, ArrowDownLeft, Clock } from 'lucide-react';
import Header from '@/components/layout/Header';
import { authFetch, getCachedUser, fetchCurrentUser, getToken } from '@/lib/auth-client';

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export default function WalletPage() {
  const router  = useRouter();
  const [balance,      setBalance]      = useState(0);
  const [user,         setUser]         = useState<any>(null);
  const [amount,       setAmount]       = useState(500);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tab,          setTab]          = useState<'deposit'|'history'>('deposit');
  const [loading,      setLoading]      = useState(false);
  const [payment,      setPayment]      = useState<any>(null);
  const [utr,          setUtr]          = useState('');
  const [utrSubmitted, setUtrSubmitted] = useState(false);
  const [confirmed,    setConfirmed]    = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [timeLeft,     setTimeLeft]     = useState(0);
  const pollRef  = useRef<ReturnType<typeof setInterval>>();
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!getToken()) { router.push('/'); return; }
    const u = getCachedUser();
    if (u) { setUser(u); setBalance(u.balance); }
    fetchCurrentUser().then(u => { if (u) { setUser(u); setBalance(u.balance); } });
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const r = await authFetch('/api/user/wallet');
      const d = await r.json();
      if (d.transactions) setTransactions(d.transactions);
      if (d.wallet)       setBalance(d.wallet.balance);
    } catch { /* ignore */ }
  };

  // ── Countdown timer ───────────────────────────────────────────────────────
  const startTimer = (seconds: number) => {
    setTimeLeft(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const formatTime = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  // ── Poll for auto-confirmation ────────────────────────────────────────────
  const startPolling = (orderId: string) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await authFetch(`/api/payment/create-order?orderId=${orderId}`);
        const d = await r.json();
        if (d.status === 'SUCCESS') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setConfirmed(true);
          setBalance(b => b + d.coins);
          toast.success(`${d.coins} Coins credited automatically!`);
          loadHistory();
        }
      } catch { /* ignore */ }
    }, 5000);
    setTimeout(() => clearInterval(pollRef.current), 30 * 60 * 1000);
  };

  // ── Create order ──────────────────────────────────────────────────────────
  const initiatePayment = async () => {
    if (amount < 10) return toast.error('Minimum deposit is ₹10');
    setLoading(true);
    try {
      const r = await authFetch('/api/payment/create-order', {
        method: 'POST', body: JSON.stringify({ amountInr: amount }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPayment(d);
      setUtr(''); setUtrSubmitted(false); setConfirmed(false);
      startPolling(d.orderId);
      startTimer(30 * 60); // 30 min countdown
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const submitUtr = async () => {
    if (utr.length < 11) return toast.error('Enter valid UTR (11-12 digits)');
    if (!payment) return;
    try {
      await authFetch('/api/payment/create-order', {
        method: 'PUT', body: JSON.stringify({ orderId: payment.orderId, utr }),
      });
      setUtrSubmitted(true);
      toast.success('UTR submitted — coins will be credited automatically');
    } catch { toast.error('Failed to submit UTR'); }
  };

  const copyUpi = () => {
    if (!payment?.upiId) return;
    navigator.clipboard.writeText(payment.upiId);
    setCopied(true);
    toast.success('UPI ID copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const cancelPayment = () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    setPayment(null); setUtr(''); setUtrSubmitted(false); setConfirmed(false);
  };

  // ── QR Code URL (Google Charts API — free, no library needed) ────────────
  const qrUrl = (data: string, size = 200) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=1a1d27&color=ffffff&margin=2`;

  const txnColor = (t: string) => ['DEPOSIT','WIN_CREDIT','BONUS','SPIN_WIN'].includes(t) ? '#2ECC71' : '#ef4444';
  const txnSign  = (t: string) => ['DEPOSIT','WIN_CREDIT','BONUS','SPIN_WIN'].includes(t) ? '+' : '-';

  const inp: React.CSSProperties = {
    width:'100%', padding:'11px 14px', borderRadius:10,
    background:'var(--Bg-3)', border:'1px solid var(--Border-2)',
    color:'var(--White)', fontSize:14, outline:'none',
  };

  return (
    <>
      <Header />
      <div style={{ paddingTop:100, minHeight:'100vh' }}>
        <div className="tf-container" style={{ paddingTop:28, paddingBottom:60 }}>

          {/* Balance card */}
          <div style={{ background:'linear-gradient(135deg,#1a0f00,#0d0b2a)', borderRadius:20, padding:'28px 36px', marginBottom:24, border:'1px solid rgba(254,140,69,0.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
              <div>
                <p style={{ color:'var(--Secondary)', fontSize:12, marginBottom:6, textTransform:'uppercase', fontWeight:700, letterSpacing:1 }}>Wallet Balance</p>
                <div style={{ fontWeight:900, fontSize:52, color:'#ffcb52', lineHeight:1, marginBottom:4 }}>
                  {balance.toLocaleString()}<span style={{ fontSize:20, color:'var(--Secondary)', marginLeft:8 }}>Coins</span>
                </div>
                <p style={{ color:'var(--Secondary)', fontSize:13 }}>1 Coin = ₹1 INR</p>
              </div>
              <div style={{ display:'flex', gap:12 }}>
                <Link href="/games/lottery" className="tf-btn" style={{ height:42, fontSize:13, padding:'0 20px' }}>
                  Play Games
                </Link>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:4, background:'var(--Bg-2)', borderRadius:14, padding:4, marginBottom:24, border:'1px solid var(--Border)' }}>
            {([['deposit','Add Money'],['history','History']] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:'12px 0', borderRadius:11, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, background:tab===k?'linear-gradient(270deg,#fe8c45,#ca2826)':'transparent', color:tab===k?'#fff':'var(--Secondary)' }}>
                {l}
              </button>
            ))}
          </div>

          {tab==='deposit' && !payment && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>

              {/* Left - amount picker */}
              <div style={{ background:'var(--Bg-2)', borderRadius:20, padding:28, border:'1px solid var(--Border)' }}>
                <h3 style={{ fontWeight:900, fontSize:22, marginBottom:6, display:'flex', alignItems:'center', gap:10 }}>
                  <Wallet size={22}/> Add Coins via UPI
                </h3>
                <p style={{ color:'var(--Secondary)', fontSize:13, marginBottom:22 }}>
                  Pay to our UPI — coins credited automatically when detected
                </p>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:18 }}>
                  {QUICK_AMOUNTS.map(a=>(
                    <button key={a} onClick={()=>setAmount(a)} style={{ padding:'13px 0', borderRadius:10, border:'2px solid', borderColor:amount===a?'#fe8c45':'var(--Border)', background:amount===a?'rgba(254,140,69,0.12)':'var(--Bg-3)', color:amount===a?'#fe8c45':'var(--White)', fontWeight:700, fontSize:15, cursor:'pointer' }}>
                      ₹{a.toLocaleString()}
                    </button>
                  ))}
                </div>

                <div style={{ position:'relative', marginBottom:18 }}>
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontWeight:700, fontSize:18, color:'var(--Secondary)' }}>₹</span>
                  <input type="number" min={10} value={amount} onChange={e=>setAmount(parseInt(e.target.value)||0)}
                    style={{ ...inp, paddingLeft:34, fontSize:22, fontWeight:700 }}/>
                </div>

                <div style={{ background:'rgba(254,140,69,0.06)', borderRadius:12, padding:'14px 16px', marginBottom:20, border:'1px solid rgba(254,140,69,0.12)' }}>
                  {[['You Pay',`₹${amount.toLocaleString()}`,'var(--White)'],['You Get',`${amount.toLocaleString()} Coins`,'#ffcb52'],['Auto-verified','Yes ✓','#2ECC71'],['Fees','Free','#2ECC71']].map(([k,v,col])=>(
                    <div key={String(k)} style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:13 }}>
                      <span style={{ color:'var(--Secondary)' }}>{k}</span>
                      <span style={{ fontWeight:700, color:String(col) }}>{v}</span>
                    </div>
                  ))}
                </div>

                <button onClick={initiatePayment} disabled={loading||amount<10} style={{ width:'100%', height:52, borderRadius:14, border:'none', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:900, fontSize:16, cursor:(loading||amount<10)?'not-allowed':'pointer', opacity:(loading||amount<10)?0.6:1 }}>
                  {loading ? 'Creating order...' : `Pay ₹${amount.toLocaleString()} via UPI`}
                </button>
              </div>

              {/* Right - how it works */}
              <div style={{ background:'var(--Bg-2)', borderRadius:20, padding:28, border:'1px solid var(--Border)' }}>
                <h4 style={{ fontWeight:700, fontSize:18, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
                  <ArrowDownLeft size={18}/> How It Works
                </h4>
                {[
                  { n:'1', t:'Choose amount',   d:'Select ₹100 to ₹5,000 or enter a custom amount' },
                  { n:'2', t:'Scan QR or copy UPI ID', d:'Open PhonePe, GPay or Paytm — scan the QR code or enter UPI ID manually' },
                  { n:'3', t:'Enter UTR (optional)', d:'Enter the 12-digit reference from your payment app for instant matching' },
                  { n:'4', t:'Coins credited automatically', d:'Our system detects your payment via SMS and credits coins within seconds' },
                ].map(item=>(
                  <div key={item.n} style={{ display:'flex', gap:14, marginBottom:18 }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(270deg,#fe8c45,#ca2826)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:13, color:'#fff', flexShrink:0 }}>{item.n}</div>
                    <div>
                      <p style={{ fontWeight:700, fontSize:14, marginBottom:3 }}>{item.t}</p>
                      <p style={{ color:'var(--Secondary)', fontSize:13 }}>{item.d}</p>
                    </div>
                  </div>
                ))}
                <div style={{ background:'rgba(46,204,113,0.08)', borderRadius:12, padding:'12px 16px', border:'1px solid rgba(46,204,113,0.2)', marginTop:4 }}>
                  <p style={{ fontWeight:700, fontSize:13, color:'#2ECC71', marginBottom:6 }}>Accepted apps:</p>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {['PhonePe','Google Pay','Paytm','BHIM','Any UPI App'].map(m=>(
                      <span key={m} style={{ background:'var(--Bg-3)', borderRadius:8, padding:'4px 10px', fontSize:12, fontWeight:600 }}>{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment in progress */}
          {tab==='deposit' && payment && !confirmed && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>

              {/* Left — QR Code */}
              <div style={{ background:'var(--Bg-2)', borderRadius:20, padding:28, border:'1px solid rgba(254,140,69,0.3)', textAlign:'center' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                  <h3 style={{ fontWeight:900, fontSize:20 }}>Scan to Pay</h3>
                  {timeLeft > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,203,82,0.1)', border:'1px solid rgba(255,203,82,0.3)', borderRadius:999, padding:'4px 12px' }}>
                      <Clock size={12} color="#ffcb52"/>
                      <span style={{ color:'#ffcb52', fontWeight:700, fontSize:13, fontFamily:'monospace' }}>{formatTime(timeLeft)}</span>
                    </div>
                  )}
                </div>

                {/* QR Code — real scannable UPI QR */}
                <div style={{ background:'#fff', borderRadius:16, padding:12, display:'inline-block', marginBottom:20, boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
                  <img
                    src={qrUrl(payment.qrString)}
                    alt="UPI QR Code"
                    width={200} height={200}
                    style={{ display:'block', borderRadius:8 }}
                  />
                </div>

                {/* Amount badge */}
                <div style={{ background:'rgba(254,140,69,0.1)', border:'1px solid rgba(254,140,69,0.3)', borderRadius:12, padding:'14px 20px', marginBottom:16 }}>
                  <p style={{ color:'var(--Secondary)', fontSize:12, marginBottom:4 }}>Pay exactly this amount</p>
                  <p style={{ fontWeight:900, fontSize:36, color:'#ffcb52' }}>₹{payment.amount?.toLocaleString()}</p>
                </div>

                {/* UPI ID with copy */}
                <div style={{ background:'var(--Bg-3)', borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, border:'1px solid var(--Border)' }}>
                  <div style={{ textAlign:'left' }}>
                    <p style={{ fontSize:10, color:'var(--Secondary)', marginBottom:2, textTransform:'uppercase', fontWeight:700 }}>UPI ID</p>
                    <p style={{ fontFamily:'monospace', fontWeight:700, fontSize:15, color:'#fff' }}>{payment.upiId}</p>
                  </div>
                  <button onClick={copyUpi} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'1px solid var(--Border)', background:copied?'rgba(46,204,113,0.1)':'transparent', color:copied?'#2ECC71':'var(--Secondary)', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                    {copied ? <CheckCircle size={14}/> : <Copy size={14}/>}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Open in UPI app */}
                <a href={payment.qrString} style={{ display:'block', padding:'12px 0', borderRadius:12, background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:700, fontSize:14, textDecoration:'none', marginBottom:12 }}>
                  Open in UPI App
                </a>

                {/* Status */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, color:'var(--Secondary)', fontSize:12 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#2ECC71', animation:'sge-pulse 1.5s ease-in-out infinite' }}/>
                  {utrSubmitted ? 'UTR submitted — waiting for payment...' : 'Waiting for payment detection...'}
                  <style>{`@keyframes sge-pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
                </div>

                <button onClick={cancelPayment} style={{ marginTop:14, background:'none', border:'none', color:'var(--Secondary)', fontSize:12, cursor:'pointer' }}>
                  Cancel
                </button>
              </div>

              {/* Right — UTR entry */}
              <div style={{ background:'var(--Bg-2)', borderRadius:20, padding:28, border:'1px solid var(--Border)' }}>
                <h4 style={{ fontWeight:700, fontSize:18, marginBottom:6 }}>Speed Up Detection</h4>
                <p style={{ color:'var(--Secondary)', fontSize:13, marginBottom:20 }}>
                  After paying, enter the 12-digit UTR/Reference number from your UPI app.
                  This helps match your payment instantly.
                </p>

                <div style={{ background:'rgba(255,203,82,0.07)', border:'1px solid rgba(255,203,82,0.2)', borderRadius:12, padding:'14px 16px', marginBottom:20 }}>
                  <p style={{ fontSize:13, fontWeight:700, color:'#ffcb52', marginBottom:8 }}>Where to find UTR number?</p>
                  {[
                    'PhonePe → History → tap transaction → "UPI Ref No."',
                    'Google Pay → transaction → "UPI transaction ID"',
                    'Paytm → Passbook → transaction → "Txn ID"',
                    'Any bank SMS → 12-digit number after "Ref" or "UTR"',
                  ].map(s=>(
                    <p key={s} style={{ fontSize:12, color:'var(--Secondary)', marginBottom:4 }}>• {s}</p>
                  ))}
                </div>

                {!utrSubmitted ? (
                  <>
                    <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:8, textTransform:'uppercase' }}>UTR / Reference Number</label>
                    <input
                      type="text" placeholder="e.g. 423156789012"
                      maxLength={12} value={utr}
                      onChange={e=>setUtr(e.target.value.replace(/\D/g,''))}
                      style={{ ...inp, fontSize:22, fontFamily:'monospace', fontWeight:700, letterSpacing:3, textAlign:'center', marginBottom:14, padding:'14px' }}
                    />
                    <p style={{ fontSize:12, color:'var(--Secondary)', textAlign:'center', marginBottom:14 }}>
                      {utr.length}/12 digits
                    </p>
                    <button onClick={submitUtr} disabled={utr.length<11} style={{ width:'100%', height:48, borderRadius:12, border:'none', cursor:utr.length<11?'not-allowed':'pointer', background:utr.length>=11?'linear-gradient(270deg,#fe8c45,#ca2826)':'var(--Bg-3)', color:'#fff', fontWeight:700, fontSize:14, opacity:utr.length<11?0.5:1 }}>
                      Submit UTR
                    </button>
                    <p style={{ textAlign:'center', fontSize:12, color:'var(--Secondary)', marginTop:12 }}>
                      UTR is optional — coins auto-detect within 2-5 minutes even without it
                    </p>
                  </>
                ) : (
                  <div style={{ textAlign:'center', padding:'40px 0' }}>
                    <RefreshCw size={40} color="#fe8c45" style={{ animation:'spin 1s linear infinite', marginBottom:16 }}/>
                    <p style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>Processing...</p>
                    <p style={{ color:'var(--Secondary)', fontSize:13 }}>
                      Payment will be detected and credited automatically.
                    </p>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment confirmed */}
          {tab==='deposit' && confirmed && (
            <div style={{ textAlign:'center', padding:'80px 20px' }}>
              <div style={{ width:80, height:80, borderRadius:'50%', background:'rgba(46,204,113,0.15)', border:'2px solid #2ECC71', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
                <CheckCircle size={40} color="#2ECC71"/>
              </div>
              <h2 style={{ fontWeight:900, fontSize:28, marginBottom:8, color:'#2ECC71' }}>Payment Confirmed!</h2>
              <p style={{ color:'var(--Secondary)', fontSize:15, marginBottom:24 }}>
                {payment?.amount} Coins added to your wallet automatically.
              </p>
              <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
                <button onClick={()=>{setPayment(null);setConfirmed(false);}} className="tf-btn" style={{ height:46, fontSize:14, padding:'0 28px' }}>
                  Add More
                </button>
                <Link href="/games/lottery" style={{ height:46, fontSize:14, padding:'0 28px', display:'flex', alignItems:'center', borderRadius:999, border:'1px solid var(--Border)', color:'var(--Secondary)' }}>
                  Play Now
                </Link>
              </div>
            </div>
          )}

          {/* Transaction History */}
          {tab==='history' && (
            <div style={{ background:'var(--Bg-2)', borderRadius:20, border:'1px solid var(--Border)', overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--Border)', background:'rgba(0,0,0,0.15)' }}>
                <h4 style={{ fontWeight:700, fontSize:16 }}>Transaction History</h4>
              </div>
              {transactions.length===0 ? (
                <div style={{ padding:'80px 24px', textAlign:'center', color:'var(--Secondary)' }}>
                  No transactions yet
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'rgba(0,0,0,0.2)' }}>
                    {['Type','Amount','Status','Date'].map(h=>(
                      <th key={h} style={{ padding:'12px 20px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--Secondary)', textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {transactions.map(t=>(
                      <tr key={t.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding:'14px 20px', fontWeight:600, fontSize:14 }}>{t.type.replace(/_/g,' ')}</td>
                        <td style={{ padding:'14px 20px', fontWeight:700, color:txnColor(t.type), fontSize:16 }}>
                          {txnSign(t.type)}{(t.coins||t.amount||0).toLocaleString()} Coins
                        </td>
                        <td style={{ padding:'14px 20px' }}>
                          <span style={{ padding:'3px 12px', borderRadius:999, fontSize:11, fontWeight:700,
                            background:t.status==='SUCCESS'?'rgba(46,204,113,0.15)':t.status==='PENDING'?'rgba(255,203,82,0.15)':'rgba(239,68,68,0.15)',
                            color:t.status==='SUCCESS'?'#2ECC71':t.status==='PENDING'?'#ffcb52':'#ef4444' }}>
                            {t.status}
                          </span>
                        </td>
                        <td style={{ padding:'14px 20px', fontSize:12, color:'var(--Secondary)' }}>
                          {new Date(t.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      </div>

      <footer id="footer">
        <div className="footer-bottom" style={{ paddingTop:24, paddingBottom:24 }}>
          <div className="tf-container">
            <div className="wrapper">
              <div className="center"><ul style={{ display:'flex', gap:24 }}>
                <li><Link href="/dashboard">Dashboard</Link></li>
                <li><Link href="/games/lottery">Lottery</Link></li>
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
