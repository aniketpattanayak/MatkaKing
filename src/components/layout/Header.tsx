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

export default function Header() {
  const router      = useRouter();
  const path        = usePathname();
  const [user,    setUser]    = useState<SessionUser | null>(null);
  const [modal,   setModal]   = useState<'login'|'register'|null>(null);
  const [loading, setLoading] = useState(false);
  const [form,    setForm]    = useState({ name:'', email:'', password:'', confirm:'' });
  const [dropdown,setDropdown]= useState(false);
  const [mobileNav,setMobileNav]=useState(false);
  const [topBar,setTopBar]=useState(true);
  const [theme, setTheme] = useState<'dark'|'light'>('dark');

  // Load saved theme on mount
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('kh-theme')) as 'dark'|'light'|null;
    const initial = saved ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('kh-theme', next); } catch {}
  };
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modal === 'register' && form.password !== form.confirm) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${modal}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setToken(d.token); setCachedUser(d.user); setUser(d.user); setModal(null);
      setForm({ name:'', email:'', password:'', confirm:'' });
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
            <p>Supreme Gaming Engine — Lottery · Matka King · Spin Wheel</p>
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
                            <Ticket size={15}/> Lottery
                          </Link>
                        </li>
                        <li className={act('/games/matka') ? 'current-item' : ''}>
                          <Link href="/games/matka" style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <Gamepad2 size={15}/> Matka King
                          </Link>
                        </li>
                        <li className={act('/games/spin') ? 'current-item' : ''}>
                          <Link href="/games/spin" style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                            Spin Wheel
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

                  </ul>
                </nav>

                {/* Right section */}
                <div className="header-right" style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {/* Light/Dark theme toggle */}
                  <button
                    onClick={toggleTheme}
                    className="kh-theme-toggle"
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    aria-label="Toggle theme"
                  >
                    {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
                  </button>
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

                  <Link className="tf-btn" href="/games/lottery" style={{
                    height:38, fontSize:13, padding:'0 16px',
                    display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
                  }}>
                    <Ticket size={15}/> Buy Tickets
                  </Link>
                </div>

              </div>
            </div></div>
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={()=>setModal(null)}>
          <div style={{ background:'var(--Bg-2)', borderRadius:24, width:'100%', maxWidth:420, border:'1px solid var(--Border)', overflow:'hidden' }}
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
                {modal==='login'?'Welcome Back':'Create Account'}
              </h3>
              <p style={{ color:'var(--Secondary)', fontSize:13, marginBottom:24 }}>
                {modal==='login'?'Access your wallet & games':'Sign up and get 50 FREE coins instantly!'}
              </p>

              <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {modal==='register' && (
                  <input placeholder="Full Name" value={form.name}
                    onChange={e=>setForm({...form,name:e.target.value})} style={inp}/>
                )}
                <input type="email" placeholder="Email address" required value={form.email}
                  onChange={e=>setForm({...form,email:e.target.value})} style={inp}/>
                <input type="password" placeholder="Password" required value={form.password}
                  onChange={e=>setForm({...form,password:e.target.value})} style={inp}/>
                {modal==='register' && (
                  <input type="password" placeholder="Confirm password" required value={form.confirm}
                    onChange={e=>setForm({...form,confirm:e.target.value})} style={inp}/>
                )}
                <button type="submit" disabled={loading} className="tf-btn" style={{
                  width:'100%', justifyContent:'center', height:50, fontSize:15, marginTop:4, opacity:loading?0.6:1
                }}>
                  {loading?'Please wait...':modal==='login'?'Login':'Create Free Account'}
                </button>
              </form>

              <p style={{ textAlign:'center', fontSize:13, color:'var(--Secondary)', marginTop:18 }}>
                {modal==='login'?"Don't have an account? ":'Already registered? '}
                <a href="#" onClick={e=>{e.preventDefault();setModal(modal==='login'?'register':'login');}}
                  style={{ color:'var(--Main-color)', fontWeight:700 }}>
                  {modal==='login'?'Sign up free':'Login here'}
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
