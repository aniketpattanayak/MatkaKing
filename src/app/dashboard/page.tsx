'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ticket, Dices, RotateCcw, Trophy, Wallet, TrendingUp } from 'lucide-react';
import Header from '@/components/layout/Header';
import { authFetch, getCachedUser, fetchCurrentUser, getToken } from '@/lib/auth-client';

type Tab = 'overview' | 'tickets' | 'matka' | 'results';

export default function DashboardPage() {
  const router = useRouter();
  const [tab,          setTab]          = useState<Tab>('overview');
  const [user,         setUser]         = useState<any>(null);
  const [wallet,       setWallet]       = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [lotteryBets,  setLotteryBets]  = useState<any[]>([]);
  const [matkaBets,    setMatkaBets]    = useState<any[]>([]);
  const [wins,         setWins]         = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push('/'); return; }
    const u = getCachedUser();
    if (u) setUser(u);
    fetchCurrentUser().then(u => { if (u) setUser(u); });
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [walletRes, ticketsRes, resultsRes] = await Promise.all([
        authFetch('/api/user/wallet').then(r => r.json()).catch(() => ({})),
        authFetch('/api/lottery/my-tickets').then(r => r.json()).catch(() => ({ bets: [] })),
        authFetch('/api/user/results').then(r => r.json()).catch(() => ({ matkaBets: [], lotteryBets: [], transactions: [] })),
      ]);
      if (walletRes.wallet)       setWallet(walletRes.wallet);
      if (walletRes.transactions) setTransactions(walletRes.transactions);
      if (ticketsRes.bets)        setLotteryBets(ticketsRes.bets);
      if (resultsRes.matkaBets)   setMatkaBets(resultsRes.matkaBets);
      if (resultsRes.transactions) setWins(resultsRes.transactions);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const totalWon     = wins.reduce((s, t) => s + (t.coins ?? 0), 0);
  const activeTickets= lotteryBets.filter(b => b.series?.status === 'OPEN').length;
  const wonTickets   = lotteryBets.filter(b => b.ticket?.isWinner).length;

  const statusColor = (s: string) => ({
    ACTIVE:'#ffcb52', WON:'#2ECC71', LOST:'#ef4444', REFUNDED:'#3498DB',
    OPEN:'#2ECC71', CLOSED:'#ef4444', DRAWN:'#9B59B6',
  }[s] ?? 'var(--Secondary)');

  const card: React.CSSProperties = {
    background:'var(--Bg-2)', borderRadius:16, border:'1px solid var(--Border)', overflow:'hidden'
  };

  if (loading) return (
    <>
      <Header />
      <div style={{ paddingTop:160, textAlign:'center', color:'var(--Secondary)' }}>
        <div style={{ width:48, height:48, border:'3px solid rgba(254,140,69,0.2)', borderTop:'3px solid #fe8c45', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }}/>
        <p>Loading your dashboard...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  );

  return (
    <>
      <Header />
      <div style={{ paddingTop:100, minHeight:'100vh' }}>
        <div className="tf-container" style={{ paddingTop:28, paddingBottom:60 }}>

          {/* Header row */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14, marginBottom:24 }}>
            <div>
              <h1 style={{ fontWeight:900, fontSize:28, marginBottom:4 }}>My Dashboard</h1>
              <p style={{ color:'var(--Secondary)', fontSize:14 }}>Welcome back, {user?.name ?? 'Player'}</p>
            </div>
            <Link href="/dashboard/wallet" className="tf-btn" style={{ height:44, fontSize:14, padding:'0 24px', display:'flex', alignItems:'center', gap:8 }}>
              <Wallet size={16}/> Add Coins
            </Link>
          </div>

          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Wallet Balance', value:`${(wallet?.balance ?? 0).toLocaleString()} Coins`, Icon:Wallet, color:'#ffcb52' },
              { label:'Active Tickets', value:activeTickets,       Icon:Ticket,    color:'#3498DB' },
              { label:'Total Won',      value:`${totalWon.toLocaleString()} Coins`, Icon:Trophy,    color:'#2ECC71' },
              { label:'Matka Bets',     value:matkaBets.length,    Icon:Dices,     color:'#9B59B6' },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding:'18px 20px' }}>
                <div style={{ width:38, height:38, borderRadius:10, background:`${s.color}18`, border:`1px solid ${s.color}40`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                  <s.Icon size={18} color={s.color}/>
                </div>
                <div style={{ fontWeight:900, fontSize:20, color:s.color, marginBottom:2 }}>{s.value}</div>
                <div style={{ fontSize:11, color:'var(--Secondary)', textTransform:'uppercase', fontWeight:700 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className='dash-tabs' style={{ background:'var(--Bg-2)', borderRadius:14, padding:4, marginBottom:20, border:'1px solid var(--Border)' }}>
            {([
              ['overview','Overview',TrendingUp],
              ['tickets','My Lottery Tickets',Ticket],
              ['matka','My Matka Bets',Dices],
              ['results','Win History',Trophy],
            ] as const).map(([k,l,Icon]) => (
              <button key={k} onClick={()=>setTab(k as Tab)} style={{
                display:'flex', alignItems:'center', gap:6, flex:1,
                padding:'10px 0', borderRadius:11, border:'none', cursor:'pointer',
                fontWeight:700, fontSize:13, justifyContent:'center',
                background:tab===k?'linear-gradient(270deg,#fe8c45,#ca2826)':'transparent',
                color:tab===k?'#fff':'var(--Secondary)',
              }}>
                <Icon size={14}/> {l}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {tab==='overview' && (
            <div className='two-col' style={{ gap:16 }}>

              {/* Recent transactions */}
              <div style={card}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--Border)', background:'rgba(0,0,0,0.15)' }}>
                  <h4 style={{ fontWeight:700, fontSize:15 }}>Recent Transactions</h4>
                </div>
                {transactions.length === 0 ? (
                  <div style={{ padding:'40px', textAlign:'center', color:'var(--Secondary)', fontSize:13 }}>No transactions yet</div>
                ) : transactions.slice(0,8).map((t,i) => (
                  <div key={i} style={{ padding:'12px 18px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ fontWeight:600, fontSize:13 }}>{t.type.replace(/_/g,' ')}</p>
                      <p style={{ fontSize:11, color:'var(--Secondary)' }}>
                        {new Date(t.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </p>
                    </div>
                    <span style={{ fontWeight:700, fontSize:14, color:['WIN_CREDIT','DEPOSIT','BONUS'].includes(t.type)?'#2ECC71':'#ef4444' }}>
                      {['WIN_CREDIT','DEPOSIT','BONUS'].includes(t.type)?'+':'-'}{(t.coins||t.amount||0).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div style={{ padding:'12px 18px' }}>
                  <Link href="/dashboard/wallet" style={{ fontSize:13, color:'var(--Main-color)', fontWeight:600 }}>View all transactions →</Link>
                </div>
              </div>

              {/* Quick links */}
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[
                  { href:'/games/lottery', Icon:Ticket,    label:'Buy Lottery Tickets',  sub:'Search & pick your lucky numbers', color:'#3498DB' },
                  { href:'/games/matka',   Icon:Dices,     label:'Play Matka King',       sub:'Place bets on today\'s markets',    color:'#9B59B6' },
                  { href:'/games/spin',    Icon:RotateCcw, label:'Spin the Wheel',        sub:`Daily free spin available`,         color:'#2ECC71' },
                  { href:'/dashboard/wallet', Icon:Wallet, label:'Add Coins',             sub:'Deposit via UPI — instant credit',  color:'#ffcb52' },
                ].map(item => (
                  <Link key={item.href} href={item.href} style={{ ...card, padding:'16px 20px', display:'flex', alignItems:'center', gap:14, textDecoration:'none', transition:'border-color 0.2s', borderColor:'var(--Border)' }}>
                    <div style={{ width:42, height:42, borderRadius:12, background:`${item.color}18`, border:`1px solid ${item.color}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <item.Icon size={20} color={item.color}/>
                    </div>
                    <div>
                      <p style={{ fontWeight:700, fontSize:14, marginBottom:2, color:'var(--White)' }}>{item.label}</p>
                      <p style={{ fontSize:12, color:'var(--Secondary)' }}>{item.sub}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── MY LOTTERY TICKETS ── */}
          {tab==='tickets' && (
            <div style={card}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--Border)', background:'rgba(0,0,0,0.15)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <h4 style={{ fontWeight:700, fontSize:15 }}>My Lottery Tickets ({lotteryBets.length})</h4>
                <Link href="/games/lottery" className="tf-btn" style={{ height:36, fontSize:12, padding:'0 16px' }}>Buy More</Link>
              </div>
              {lotteryBets.length === 0 ? (
                <div style={{ padding:'60px', textAlign:'center', color:'var(--Secondary)' }}>
                  <Ticket size={48} style={{ marginBottom:16, opacity:0.3 }}/>
                  <p style={{ marginBottom:16 }}>No tickets purchased yet</p>
                  <Link href="/games/lottery" className="tf-btn" style={{ height:44, fontSize:14, padding:'0 28px' }}>Buy Tickets</Link>
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'rgba(0,0,0,0.2)' }}>
                    {['Ticket Code','Series','Draw Date','Price Paid','Status'].map(h=>(
                      <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--Secondary)', textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {lotteryBets.map((b,i) => (
                      <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding:'13px 16px' }}>
                          <span style={{ fontFamily:'monospace', fontWeight:900, fontSize:16, color: b.ticket?.isWinner ? '#ffcb52' : 'var(--White)' }}>
                            {b.ticket?.ticketCode ?? '—'}
                          </span>
                          {b.ticket?.isWinner && <span style={{ marginLeft:8, fontSize:11, background:'rgba(255,203,82,0.2)', color:'#ffcb52', borderRadius:999, padding:'1px 8px', fontWeight:700 }}>WINNER!</span>}
                        </td>
                        <td style={{ padding:'13px 16px', fontSize:13 }}>{b.series?.name ?? '—'}</td>
                        <td style={{ padding:'13px 16px', fontSize:12, color:'var(--Secondary)' }}>
                          {b.series?.drawAt ? new Date(b.series.drawAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}
                        </td>
                        <td style={{ padding:'13px 16px', fontWeight:700, fontSize:13 }}>₹{b.amountPaid}</td>
                        <td style={{ padding:'13px 16px' }}>
                          <span style={{ padding:'2px 10px', borderRadius:999, fontSize:11, fontWeight:700,
                            background: b.ticket?.isWinner ? 'rgba(255,203,82,0.2)' : b.series?.status==='OPEN' ? 'rgba(52,152,219,0.15)' : 'rgba(100,100,100,0.2)',
                            color: b.ticket?.isWinner ? '#ffcb52' : statusColor(b.series?.status ?? '') }}>
                            {b.ticket?.isWinner ? 'Won!' : b.series?.status ?? 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── MATKA BETS ── */}
          {tab==='matka' && (
            <div style={card}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--Border)', background:'rgba(0,0,0,0.15)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <h4 style={{ fontWeight:700, fontSize:15 }}>My Matka Bets ({matkaBets.length})</h4>
                <Link href="/games/matka" className="tf-btn" style={{ height:36, fontSize:12, padding:'0 16px' }}>Place Bet</Link>
              </div>
              {matkaBets.length === 0 ? (
                <div style={{ padding:'60px', textAlign:'center', color:'var(--Secondary)' }}>
                  <Dices size={48} style={{ marginBottom:16, opacity:0.3 }}/>
                  <p style={{ marginBottom:16 }}>No matka bets placed yet</p>
                  <Link href="/games/matka" className="tf-btn" style={{ height:44, fontSize:14, padding:'0 28px' }}>Play Matka</Link>
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'rgba(0,0,0,0.2)' }}>
                    {['Market','Bet Type','Number','Session','Amount','Win Amount','Status','Date'].map(h=>(
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--Secondary)', textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {matkaBets.map((b,i) => (
                      <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding:'12px 14px', fontWeight:600, fontSize:13 }}>{b.market?.name ?? '—'}</td>
                        <td style={{ padding:'12px 14px', fontSize:12, color:'var(--Secondary)' }}>{b.betType}</td>
                        <td style={{ padding:'12px 14px', fontFamily:'monospace', fontWeight:700, fontSize:15, color:'#ffcb52' }}>{b.betValue}</td>
                        <td style={{ padding:'12px 14px', fontSize:12 }}>
                          <span style={{ padding:'1px 8px', borderRadius:999, fontSize:10, fontWeight:700,
                            background:b.session==='OPEN'?'rgba(46,204,113,0.15)':'rgba(52,152,219,0.15)',
                            color:b.session==='OPEN'?'#2ECC71':'#3498DB' }}>{b.session}</span>
                        </td>
                        <td style={{ padding:'12px 14px', fontWeight:700 }}>₹{b.amount}</td>
                        <td style={{ padding:'12px 14px', fontWeight:700, color:'#2ECC71' }}>
                          {b.winAmount > 0 ? `₹${b.winAmount.toLocaleString()}` : '—'}
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          <span style={{ padding:'2px 10px', borderRadius:999, fontSize:10, fontWeight:700,
                            background: b.status==='WON'?'rgba(46,204,113,0.15)':b.status==='LOST'?'rgba(239,68,68,0.1)':'rgba(255,203,82,0.15)',
                            color: statusColor(b.status) }}>
                            {b.status}
                          </span>
                        </td>
                        <td style={{ padding:'12px 14px', fontSize:11, color:'var(--Secondary)' }}>
                          {new Date(b.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── WIN HISTORY ── */}
          {tab==='results' && (
            <div>
              {/* Summary */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
                {[
                  { label:'Total Winnings', value:`₹${totalWon.toLocaleString()} Coins`, color:'#2ECC71' },
                  { label:'Lottery Wins',   value:wonTickets + ' tickets',               color:'#ffcb52' },
                  { label:'Matka Wins',     value:matkaBets.filter(b=>b.status==='WON').length + ' bets', color:'#9B59B6' },
                ].map(s=>(
                  <div key={s.label} style={{ ...card, padding:'20px 22px', textAlign:'center' }}>
                    <div style={{ fontWeight:900, fontSize:28, color:s.color, marginBottom:4 }}>{s.value}</div>
                    <div style={{ fontSize:12, color:'var(--Secondary)', textTransform:'uppercase', fontWeight:700 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Win transactions */}
              <div style={card}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--Border)', background:'rgba(0,0,0,0.15)' }}>
                  <h4 style={{ fontWeight:700, fontSize:15 }}>Win Credits</h4>
                </div>
                {wins.length === 0 ? (
                  <div style={{ padding:'60px', textAlign:'center', color:'var(--Secondary)' }}>
                    <Trophy size={48} style={{ marginBottom:16, opacity:0.3 }}/>
                    <p>No winnings yet — keep playing!</p>
                  </div>
                ) : wins.map((t,i)=>(
                  <div key={i} style={{ padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:'rgba(46,204,113,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Trophy size={18} color="#2ECC71"/>
                      </div>
                      <div>
                        <p style={{ fontWeight:700, fontSize:14 }}>Win Credit</p>
                        <p style={{ fontSize:11, color:'var(--Secondary)' }}>
                          {new Date(t.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                    <span style={{ fontWeight:900, fontSize:20, color:'#2ECC71' }}>+{(t.coins||0).toLocaleString()} Coins</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      <footer id="footer">
        <div className="footer-bottom" style={{ paddingTop:24, paddingBottom:24 }}>
          <div className="tf-container">
            <div className="wrapper">
              <div className="center"><ul style={{ display:'flex', gap:24 }}>
                <li><Link href="/">Home</Link></li>
                <li><Link href="/games/lottery">Lottery</Link></li>
                <li><Link href="/games/matka">Matka</Link></li>
                <li><Link href="/dashboard/wallet">Wallet</Link></li>
              </ul></div>
              <div className="right"><span>© 2025 Supreme Gaming Engine</span></div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
