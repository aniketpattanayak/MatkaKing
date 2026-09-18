'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import {
  Gamepad2, Ticket, LayoutDashboard, Wallet, Settings,
  LogOut, User, ChevronDown, X, Menu, Coins, Sun, Moon
} from 'lucide-react';
import { getToken, setToken, clearToken, getCachedUser, setCachedUser, fetchCurrentUser, type SessionUser } from '@/lib/auth-client';

// Mobile styles injected via className
export default function Header() {
  const router      = useRouter();
  const path        = usePathname();
  const [user,    setUser]    = useState<SessionUser | null>(null);
  const [modal,   setModal]   = useState<'login'|'register'|'forgot'|null>(null);
  const [forgotStep, setForgotStep] = useState<'email'|'answers'|'reset'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNew,   setForgotNew]   = useState('');
  const [forgotName,  setForgotName]  = useState('');
  const [forgotQuestions, setForgotQuestions] = useState<string[]>([]);
  const [forgotAnswers,   setForgotAnswers]   = useState<string[]>(['','','']);
  const [loading, setLoading] = useState(false);
  const [form,    setForm]    = useState({ name:'', email:'', password:'', confirm:'', referralCode:'' });
  const [securityQs, setSecurityQs] = useState([
    { question:'', answer:'' },
    { question:'', answer:'' },
    { question:'', answer:'' },
  ]);
  const [dropdown,setDropdown]= useState(false);
  const [mobileNav,setMobileNav]=useState(false);
  const [topBar,setTopBar]=useState(true);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = getCachedUser(); if (c) setUser(c);
    if (getToken()) fetchCurrentUser().then(u => { if (u) setUser(u); });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const SECURITY_QUESTIONS = [
    { key:'pet_name',      label:"What was your first pet's name?" },
    { key:'mother_maiden', label:"What is your mother's maiden name?" },
    { key:'birth_city',    label:"In what city were you born?" },
    { key:'school_name',   label:"What was the name of your first school?" },
    { key:'fav_food',      label:"What is your favourite food?" },
  ];

  const resetForgot = () => { setForgotStep('email'); setForgotEmail(''); setForgotNew(''); setForgotName(''); setForgotQuestions([]); setForgotAnswers(['','','']); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // ── Forgot password flow ──────────────────────────────────────────────
    if (modal === 'forgot') {
      setLoading(true);
      try {
        if (forgotStep === 'email') {
          const r = await fetch('/api/auth/forgot-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'check_email', email: forgotEmail }) });
          const d = await r.json();
          if (d.ok) {
            setForgotName(d.name);
            setForgotQuestions(d.questions ?? []);
            // If no security questions set (legacy account), skip straight to reset
            setForgotStep(d.noSecurityQuestions || (d.questions ?? []).length === 0 ? 'reset' : 'answers');
          }
          else toast.error(d.error ?? 'Email not found');
        } else if (forgotStep === 'answers') {
          const r = await fetch('/api/auth/forgot-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'verify_answers', email: forgotEmail, answers: forgotAnswers.slice(0, forgotQuestions.length) }) });
          const d = await r.json();
          if (d.ok) { setForgotStep('reset'); }
          else toast.error(d.error ?? 'Incorrect answers');
        } else {
          const r = await fetch('/api/auth/forgot-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'reset_password', email: forgotEmail, newPassword: forgotNew, answers: forgotAnswers.slice(0, forgotQuestions.length) }) });
          const d = await r.json();
          if (d.ok) { toast.success('Password reset! Please login.'); setModal('login'); resetForgot(); }
          else toast.error(d.error ?? 'Reset failed');
        }
      } finally { setLoading(false); }
      return;
    }
    // ── Register / Login ───────────────────────────────────────────────────
    if (modal === 'register' && form.password !== form.confirm) return toast.error('Passwords do not match');
    if (modal === 'register') {
      const filled = securityQs.filter(q => q.question && q.answer);
      if (filled.length < 3) return toast.error('Please set all 3 security questions for account recovery');
    }
    setLoading(true);
    try {
      const body: any = { name: form.name, email: form.email, password: form.password, referralCode: form.referralCode || undefined };
      if (modal === 'register') body.securityQuestions = securityQs.map(q => ({ question: q.question, answer: q.answer }));
      const res = await fetch(`/api/auth/${modal}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setToken(d.token); setCachedUser(d.user); setUser(d.user); setModal(null);
      setForm({ name:'', email:'', password:'', confirm:'', referralCode:'' });
      setSecurityQs([{ question:'', answer:'' },{ question:'', answer:'' },{ question:'', answer:'' }]);
      toast.success(modal === 'login' ? `Welcome back, ${d.user.name}!` : `Welcome ${d.user.name}! +50 free coins!`);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const logout = () => {
    clearToken(); setUser(null); setDropdown(false);
    toast.info('Logged out'); router.push('/');
  };

  const act = (p: string) => path === p || path.startsWith(p + '/');

  const inp: React.CSSProperties = {
    padding: '12px 16px', borderRadius: 12, background: 'var(--Bg-3)',
    border: '1px solid var(--Border-2)', color: 'var(--White)',
    outline: 'none', fontSize: 14, width: '100%',
  };

  const navLink: React.CSSProperties = {
    fontSize: 15, fontWeight: 600, lineHeight: '104px',
    color: 'var(--White)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
  };

  return (
    <>
      {/* Top bar */}
      {topBar && (
        <div className="tf-top-bar">
          <div className="content">
            <p>Supreme Gaming Engine — Lucky Winner · Money Bank</p>
            {user
              ? <span style={{ color:'#ffcb52', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                  <Coins size={14}/> {user.balance.toLocaleString()} Coins
                </span>
              : <a href="#" onClick={e=>{e.preventDefault();setModal('register');}}>
                  Get 50 FREE coins on signup!
                </a>
            }
          </div>
          <div className="button-close" onClick={()=>setTopBar(false)} style={{ cursor:'pointer' }}>
            <X size={16}/>
          </div>
        </div>
      )}

      {/* Main header */}
      <header id="header-main" className="header header-home-3 header-fixed style-absolute">
        <div className="header-inner">
          <div className="tf-container">
            <div className="row"><div className="col-12">
              <div className="header-inner-wrap">

                {/* Logo */}
                <div className="header-logo">
                  <Link href="/"><img alt="SGE" src="/images/logo/logo.png" width={170} height={60} /></Link>
                </div>

                {/* Desktop Nav */}
                <nav className="main-menu">
                  <ul className="navigation">

                    {/* Games dropdown */}
                    <li className={`has-child ${act('/games') ? 'current-menu-item' : ''}`}>
                      <a href="#" style={navLink}>
                        Games 
                      </a>
                      <ul className="sub-menu">
                        <li className={act('/games/lottery') ? 'current-item' : ''}>
                          <Link href="/games/lottery" style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <Ticket size={15}/> Lucky Winner
                          </Link>
                        </li>
                        <li className={act('/games/matka') ? 'current-item' : ''}>
                          <Link href="/games/matka" style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <Gamepad2 size={15}/> Money Bank
                          </Link>
                        </li>
                      </ul>
                    </li>

                    {/* My Account dropdown — only when logged in */}
                    {user && (
                      <li className={`has-child ${act('/dashboard') ? 'current-menu-item' : ''}`}>
                        <a href="#" style={navLink}>
                          My Account 
                        </a>
                        <ul className="sub-menu">
                          <li>
                            <Link href="/dashboard" style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <LayoutDashboard size={15}/> Dashboard
                            </Link>
                          </li>
                          <li>
                            <Link href="/dashboard/wallet" style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <Wallet size={15}/> My Wallet
                            </Link>
                          </li>
                        </ul>
                      </li>
                    )}

                    {/* Admin link — only for admins */}
                    {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
                      <li className={act('/admin') ? 'current-menu-item' : ''}>
                        <Link href="/admin" style={{ ...navLink, color: act('/admin') ? 'var(--Main-color)' : 'var(--White)' }}>
                          <Settings size={15}/> Admin
                        </Link>
                      </li>
                    )}

                    <li className={path === '/' ? 'current-menu-item' : ''}>
                      <Link href="/" style={navLink}>Home</Link>
                    </li>
                    <li className={act('/game-guide') ? 'current-menu-item' : ''}>
                      <Link href="/game-guide" style={navLink}>Game Guide</Link>
                    </li>

                  </ul>
                </nav>

                {/* Right section */}
                <div className="header-right" style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {user ? (
                    <>
                      {/* Balance pill */}
                      <Link href="/dashboard/wallet" style={{
                        display:'flex', alignItems:'center', gap:6,
                        background:'rgba(255,203,82,0.12)', border:'1px solid rgba(255,203,82,0.35)',
                        borderRadius:999, padding:'7px 14px', fontSize:14, fontWeight:800, color:'#ffcb52',
                        textDecoration:'none', whiteSpace:'nowrap',
                      }}>
                        <Coins size={14}/> {user.balance.toLocaleString()}
                      </Link>

                      {/* Avatar + Dropdown */}
                      <div ref={dropRef} style={{ position:'relative' }}>
                        <button onClick={()=>setDropdown(d=>!d)} style={{
                          width:40, height:40, borderRadius:'50%',
                          background:'linear-gradient(135deg,#fe8c45,#ca2826)',
                          border: dropdown ? '2px solid rgba(254,140,69,0.8)' : '2px solid transparent',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontWeight:900, fontSize:16, cursor:'pointer', color:'#fff',
                          boxShadow: dropdown ? '0 0 0 3px rgba(254,140,69,0.2)' : 'none',
                        }}>
                          {(user.name?.[0] ?? 'U').toUpperCase()}
                        </button>

                        {dropdown && (
                          <div style={{
                            position:'absolute', top:'calc(100% + 10px)', right:0,
                            background:'var(--Bg-2)', border:'1px solid var(--Border)',
                            borderRadius:16, minWidth:220,
                            boxShadow:'0 20px 60px rgba(0,0,0,0.5)', zIndex:9999, overflow:'hidden',
                          }}>
                            {/* User info */}
                            <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--Border)', background:'rgba(254,140,69,0.05)' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#fe8c45,#ca2826)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:15, color:'#fff' }}>
                                  {(user.name?.[0] ?? 'U').toUpperCase()}
                                </div>
                                <div>
                                  <p style={{ fontWeight:700, fontSize:14, marginBottom:1 }}>{user.name}</p>
                                  <p style={{ color:'var(--Secondary)', fontSize:11 }}>{user.email}</p>
                                </div>
                              </div>
                              <div style={{ marginTop:10, background:'rgba(255,203,82,0.1)', borderRadius:8, padding:'6px 10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ color:'var(--Secondary)', fontSize:11 }}>Balance</span>
                                <span style={{ color:'#ffcb52', fontWeight:800, fontSize:14, display:'flex', alignItems:'center', gap:4 }}>
                                  <Coins size={12}/> {user.balance.toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {/* Menu items */}
                            <div style={{ padding:'8px 0' }}>
                              {[
                                { href:'/dashboard',        Icon:LayoutDashboard, label:'Dashboard' },
                                { href:'/dashboard/wallet', Icon:Wallet,          label:'My Wallet' },
                              ].map(({ href, Icon, label }) => (
                                <Link key={href} href={href} onClick={()=>setDropdown(false)} style={{
                                  display:'flex', alignItems:'center', gap:10,
                                  padding:'10px 18px', fontSize:14, fontWeight:600,
                                  color:'var(--White)', textDecoration:'none',
                                }}>
                                  <Icon size={16} style={{ color:'var(--Secondary)' }}/> {label}
                                </Link>
                              ))}

                              {(user.role === 'ADMIN' || user.role === 'SUPERADMIN') && (
                                <Link href="/admin" onClick={()=>setDropdown(false)} style={{
                                  display:'flex', alignItems:'center', gap:10,
                                  padding:'10px 18px', fontSize:14, fontWeight:600,
                                  color:'#fe8c45', textDecoration:'none',
                                }}>
                                  <Settings size={16}/> Admin Panel
                                </Link>
                              )}

                              <div style={{ borderTop:'1px solid var(--Border)', margin:'6px 0' }} />

                              <button onClick={logout} style={{
                                display:'flex', alignItems:'center', gap:10,
                                padding:'10px 18px', width:'100%',
                                fontSize:14, fontWeight:600, color:'#ef4444',
                                background:'transparent', border:'none', cursor:'pointer', textAlign:'left',
                              }}>
                                <LogOut size={16}/> Logout
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <button onClick={()=>setModal('login')} style={{
                        background:'transparent', border:'1px solid rgba(255,255,255,0.2)',
                        borderRadius:999, padding:'8px 20px', color:'var(--White)',
                        fontWeight:600, fontSize:13, cursor:'pointer',
                      }}>Login</button>
                      <button onClick={()=>setModal('register')} className="tf-btn" style={{ height:38, fontSize:13, padding:'0 18px' }}>
                        Sign Up Free
                      </button>
                    </>
                  )}

                  {/* Theme toggle */}
                  <button onClick={()=>{
                    const cur = document.documentElement.getAttribute('data-theme')||'dark';
                    const next = cur==='dark'?'light':'dark';
                    document.documentElement.setAttribute('data-theme',next);
                    localStorage.setItem('kh-theme',next);
                  }} style={{
                    width:36,height:36,borderRadius:'50%',border:'1px solid var(--Border)',
                    background:'var(--Bg-2)',cursor:'pointer',display:'flex',
                    alignItems:'center',justifyContent:'center',color:'var(--White)',
                    flexShrink:0,
                  }} title="Toggle Dark/Light mode">
                    <Sun size={16}/>
                  </button>

                  <Link className="tf-btn" href="/games/lottery" style={{
                    height:38, fontSize:13, padding:'0 16px',
                    display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
                  }}>
                    <Ticket size={15}/> Buy Tickets
                  </Link>

                  {/* Mobile menu button - only visible on mobile via CSS */}
                  <button onClick={()=>setMobileNav(v=>!v)} className="mobile-button" style={{background:'none',border:'none',cursor:'pointer',padding:8}}>
                    <Menu size={24} color="var(--White)"/>
                  </button>
                </div>

              </div>
            </div></div>
          </div>
        </div>
      </header>





      {/* Mobile Nav - only shows on mobile */}
      {mobileNav && (
        <>
          <div onClick={()=>setMobileNav(false)} style={{position:'fixed',inset:0,zIndex:9998,background:'rgba(0,0,0,0.7)'}}/>
          <div style={{position:'fixed',top:0,left:0,bottom:0,width:'80%',maxWidth:300,zIndex:9999,background:'var(--Bg-2)',overflowY:'auto',padding:'60px 16px 24px',borderRight:'1px solid var(--Border)'}}>
            <button onClick={()=>setMobileNav(false)} style={{position:'absolute',top:16,right:16,background:'none',border:'none',color:'var(--White)',cursor:'pointer',fontSize:22}}>✕</button>
            <p style={{fontSize:11,fontWeight:700,color:'var(--Secondary)',textTransform:'uppercase',marginBottom:8}}>Games</p>
            <Link href="/games/lottery" onClick={()=>setMobileNav(false)} style={{display:'block',padding:'12px',borderRadius:10,color:'var(--White)',textDecoration:'none',marginBottom:6,background:'var(--Bg-3)',fontWeight:600}}>🎟 Lucky Winner</Link>
            <Link href="/games/matka" onClick={()=>setMobileNav(false)} style={{display:'block',padding:'12px',borderRadius:10,color:'var(--White)',textDecoration:'none',marginBottom:16,background:'var(--Bg-3)',fontWeight:600}}>🎲 Money Bank</Link>
            <div style={{height:1,background:'var(--Border)',marginBottom:16}}/>
            {user ? (
              <>
                <p style={{fontSize:11,fontWeight:700,color:'var(--Secondary)',textTransform:'uppercase',marginBottom:8}}>Account</p>
                <Link href="/dashboard" onClick={()=>setMobileNav(false)} style={{display:'block',padding:'12px',borderRadius:10,color:'var(--White)',textDecoration:'none',marginBottom:6,background:'var(--Bg-3)',fontWeight:600}}>📊 Dashboard</Link>
                <Link href="/dashboard/wallet" onClick={()=>setMobileNav(false)} style={{display:'block',padding:'12px',borderRadius:10,color:'var(--White)',textDecoration:'none',marginBottom:6,background:'var(--Bg-3)',fontWeight:600}}>💰 My Wallet</Link>
                {(user.role==='ADMIN'||user.role==='SUPERADMIN') && <Link href="/admin" onClick={()=>setMobileNav(false)} style={{display:'block',padding:'12px',borderRadius:10,color:'#fe8c45',textDecoration:'none',marginBottom:6,background:'var(--Bg-3)',fontWeight:600}}>⚙️ Admin Panel</Link>}
                <div style={{height:1,background:'var(--Border)',margin:'12px 0'}}/>
                <button onClick={()=>{logout();setMobileNav(false);}} style={{display:'block',width:'100%',padding:'12px',borderRadius:10,color:'#ef4444',background:'var(--Bg-3)',border:'none',cursor:'pointer',textAlign:'left',fontWeight:600,fontSize:15}}>🚪 Logout</button>
              </>
            ) : (
              <>
                <button onClick={()=>{setModal('login');setMobileNav(false);}} style={{width:'100%',padding:'12px',borderRadius:10,color:'var(--White)',background:'var(--Bg-3)',border:'1px solid var(--Border)',cursor:'pointer',marginBottom:8,fontWeight:700,fontSize:15}}>Login</button>
                <button onClick={()=>{setModal('register');setMobileNav(false);}} style={{width:'100%',padding:'12px',borderRadius:10,color:'#fff',background:'linear-gradient(270deg,#fe8c45,#ca2826)',border:'none',cursor:'pointer',fontWeight:700,fontSize:15}}>Sign Up Free</button>
              </>
            )}
          </div>
        </>
      )}

      {/* Auth Modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 20px 40px', overflowY:'auto' }}
          onClick={()=>setModal(null)}>
          <div style={{ background:'var(--Bg-2)', borderRadius:24, width:'100%', maxWidth:420, border:'1px solid var(--Border)', overflow:'visible', marginTop:'auto', marginBottom:'auto', flexShrink:0 }}
            onClick={e=>e.stopPropagation()}>

            <div style={{ display:'flex', background:'var(--Bg)', padding:4 }}>
              {(['login','register'] as const).map(t=>(
                <button key={t} onClick={()=>setModal(t)} style={{
                  flex:1, padding:'12px 0', border:'none', cursor:'pointer', fontWeight:700, fontSize:14, borderRadius:18,
                  background:modal===t?'linear-gradient(270deg,#fe8c45,#ca2826)':'transparent',
                  color:modal===t?'#fff':'var(--Secondary)',
                }}>
                  {t==='login'?'Login':'Register'}
                </button>
              ))}
            </div>

            <div style={{ padding:'28px 32px 32px' }}>
              <h3 style={{ fontWeight:900, fontSize:22, marginBottom:4 }}>
                {modal==='login'?'Welcome Back':modal==='forgot'?'🔐 Reset Password':'Create Account'}
              </h3>
              <p style={{ color:'var(--Secondary)', fontSize:13, marginBottom:24 }}>
                {modal==='login'?'Access your wallet & games':modal==='forgot'?'Enter your email to reset password':'Sign up and get 50 FREE coins instantly!'}
              </p>

              <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {/* Forgot password fields */}
                {modal==='forgot' && forgotStep==='email' && (
                  <input placeholder="Enter your registered email" type="email" value={forgotEmail}
                    onChange={e=>setForgotEmail(e.target.value)}
                    style={{width:'100%',padding:'13px 16px',borderRadius:12,border:'1px solid var(--Border-2)',background:'var(--Bg-3)',color:'var(--White)',fontSize:15,outline:'none',marginBottom:4}}/>
                )}
                {modal==='forgot' && forgotStep==='answers' && (
                  <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    <p style={{color:'#2ECC71',fontSize:13,fontWeight:600}}>✓ Account found: {forgotName}</p>
                    <p style={{color:'var(--Secondary)',fontSize:12}}>Answer your security questions to continue:</p>
                    {forgotQuestions.map((q, i) => (
                      <div key={i}>
                        <p style={{fontSize:12,fontWeight:700,color:'var(--Secondary)',marginBottom:6}}>{i+1}. {q}</p>
                        <input placeholder={`Answer ${i+1}`} value={forgotAnswers[i]}
                          onChange={e=>{ const a=[...forgotAnswers]; a[i]=e.target.value; setForgotAnswers(a); }}
                          style={{width:'100%',padding:'11px 14px',borderRadius:10,border:'1px solid var(--Border-2)',background:'var(--Bg-3)',color:'var(--White)',fontSize:14,outline:'none'}}/>
                      </div>
                    ))}
                  </div>
                )}
                {modal==='forgot' && forgotStep==='reset' && (
                  <div>
                    <p style={{color:'#2ECC71',fontSize:13,marginBottom:12,fontWeight:600}}>✓ Identity verified! Set your new password:</p>
                    <input placeholder="Enter new password (min 6 chars)" type="password" value={forgotNew}
                      onChange={e=>setForgotNew(e.target.value)}
                      style={{width:'100%',padding:'13px 16px',borderRadius:12,border:'1px solid var(--Border-2)',background:'var(--Bg-3)',color:'var(--White)',fontSize:15,outline:'none',marginBottom:4}}/>
                  </div>
                )}
                {modal==='register' && (
                  <input placeholder="Full Name" value={form.name}
                    onChange={e=>setForm({...form,name:e.target.value})} style={inp}/>
                )}
                {modal !== 'forgot' && (
                  <input type="email" placeholder="Email address" required value={form.email}
                    onChange={e=>setForm({...form,email:e.target.value})} style={inp}/>
                )}
                {modal !== 'forgot' && (
                  <input type="password" placeholder="Password" required value={form.password}
                    onChange={e=>setForm({...form,password:e.target.value})} style={inp}/>
                )}
                {modal==='register' && (
                  <>
                    <input type="password" placeholder="Confirm password" required value={form.confirm}
                      onChange={e=>setForm({...form,confirm:e.target.value})} style={inp}/>
                    <input placeholder="Referral Code (optional)" value={form.referralCode}
                      onChange={e=>setForm({...form,referralCode:e.target.value.trim()})}
                      style={{...inp, fontFamily:'monospace', letterSpacing:1, textTransform:'uppercase'}}/>
                    <p style={{fontSize:11,color:'var(--Secondary)',marginTop:-8}}>Enter a friend's referral code to get +10 bonus coins</p>

                    {/* Security Questions */}
                    <div style={{background:'rgba(254,140,69,0.06)',border:'1px solid rgba(254,140,69,0.2)',borderRadius:12,padding:'14px 16px'}}>
                      <p style={{fontWeight:700,fontSize:13,color:'var(--Main-color)',marginBottom:4}}>🔐 Security Questions</p>
                      <p style={{fontSize:11,color:'var(--Secondary)',marginBottom:14}}>Used to verify your identity if you forget your password</p>
                      {securityQs.map((sq, i) => (
                        <div key={i} style={{marginBottom: i < 2 ? 12 : 0}}>
                          <p style={{fontSize:11,fontWeight:700,color:'var(--Secondary)',marginBottom:6}}>Question {i+1}</p>
                          <select value={sq.question} onChange={e=>{const s=[...securityQs];s[i]={...s[i],question:e.target.value};setSecurityQs(s);}}
                            style={{width:'100%',padding:'9px 12px',borderRadius:9,border:'1px solid var(--Border-2)',background:'var(--Bg-3)',color: sq.question ? 'var(--White)' : 'var(--Secondary)',fontSize:13,outline:'none',marginBottom:6,cursor:'pointer'}}>
                            <option value="">— Select a question —</option>
                            {SECURITY_QUESTIONS.filter(q => !securityQs.some((s,j) => j!==i && s.question===q.label)).map(q=>(
                              <option key={q.key} value={q.label}>{q.label}</option>
                            ))}
                          </select>
                          <input placeholder={`Your answer to question ${i+1}`} value={sq.answer}
                            onChange={e=>{const s=[...securityQs];s[i]={...s[i],answer:e.target.value};setSecurityQs(s);}}
                            style={{width:'100%',padding:'9px 12px',borderRadius:9,border:'1px solid var(--Border-2)',background:'var(--Bg-3)',color:'var(--White)',fontSize:13,outline:'none'}}/>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <button type="submit" disabled={loading} className="tf-btn" style={{
                  width:'100%', justifyContent:'center', height:50, fontSize:15, marginTop:4, opacity:loading?0.6:1
                }}>
                  {loading?'Please wait...':modal==='login'?'Login':modal==='forgot'?
                    (forgotStep==='email'?'Find My Account':forgotStep==='answers'?'Verify Answers':'Reset Password')
                    :'Create Free Account'}
                </button>
              </form>

              <p style={{ textAlign:'center', fontSize:13, color:'var(--Secondary)', marginTop:18 }}>
                {modal==='login'?"Don't have an account? ":'Already registered? '}
                <a href="#" onClick={e=>{e.preventDefault();setModal(modal==='login'?'register':'login');}}
                  style={{ color:'var(--Main-color)', fontWeight:700 }}>
                  {modal==='login'?'Sign up free':'Login here'}
                </a>
              </p>
              {modal==='login' && (
                <p style={{ textAlign:'center', fontSize:13, marginTop:8 }}>
                  <a href="#" onClick={e=>{e.preventDefault();setModal('forgot');setForgotStep('email');setForgotEmail('');}}
                    style={{ color:'var(--Secondary)', fontWeight:600, textDecoration:'none' }}>
                    🔐 Forgot password?
                  </a>
                </p>
              )}
              {modal==='forgot' && (
                <p style={{ textAlign:'center', fontSize:13, marginTop:8 }}>
                  <a href="#" onClick={e=>{e.preventDefault();setModal('login');resetForgot();}}
                    style={{ color:'var(--Secondary)', textDecoration:'none' }}>
                    ← Back to login
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
