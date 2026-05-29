'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
export const dynamic = 'force-dynamic'; // prevents static prerender where market=null
import Link from 'next/link';
import { toast } from 'sonner';
import Header from '@/components/layout/Header';
import { authFetch, getCachedUser, fetchCurrentUser } from '@/lib/auth-client';

// ─── Config ───────────────────────────────────────────────────────────────────

// Markets loaded from DB — seeded by admin
const FALLBACK_MARKETS = [
  { id: 'milan-day',   name: 'Milan Day',   openTime: '09:30', closeTime: '11:30', resultTime: '12:00', isOpen: true,  results: [] },
  { id: 'kalyan',      name: 'Kalyan',       openTime: '15:45', closeTime: '17:45', resultTime: '18:00', isOpen: true,  results: [] },
  { id: 'milan-night', name: 'Milan Night',  openTime: '21:00', closeTime: '23:00', resultTime: '23:30', isOpen: false, results: [] },
];

// maxSelect = max columns user can select at once
// `phase` controls when the bet is allowed:
//   'pre-open' = only before open result is declared (jodi/sangam)
//   'open'     = only before open is declared (open ank + open pana)
//   'close'    = bettable until close declared (close ank + close pana)
const GAME_TYPES = [
  { key: 'ANK',           label: 'Ank',          payout: 90,    maxSelect: 1, desc: 'Pick 1 digit (Open or Close session)',           phases: ['open','close'] },
  { key: 'JODI',          label: 'Jodi',         payout: 900,   maxSelect: 2, desc: 'Open Ank + Close Ank — only before open result', phases: ['pre-open'] },
  { key: 'SINGLE_PATTI',  label: 'SP',           payout: 140,   maxSelect: 3, desc: '3-digit patti (Open or Close session)',          phases: ['open','close'] },
  { key: 'DOUBLE_PATTI',  label: 'DP',           payout: 280,   maxSelect: 3, desc: '3 columns — 2 same + 1 different digit',         phases: ['open','close'] },
  { key: 'TRIPLE_PATTI',  label: 'TP',           payout: 450,   maxSelect: 3, desc: '3 columns — all same digit',                     phases: ['open','close'] },
  { key: 'HALF_SANGAM_A', label: 'Half Sangam A',payout: 1500,  maxSelect: 4, desc: 'Open Ank × Close Patti — only before open',     phases: ['pre-open'] },
  { key: 'HALF_SANGAM_B', label: 'Half Sangam B',payout: 1500,  maxSelect: 4, desc: 'Open Patti × Close Ank — only before open',     phases: ['pre-open'] },
  { key: 'FULL_SANGAM',   label: 'Full Sangam',  payout: 11000, maxSelect: 6, desc: 'Open Patti × Close Patti — only before open',   phases: ['pre-open'] },
];

const NUM_COLS = 8;
const ITEM_H   = 50;   // px height of each digit row
const VISIBLE  = 5;    // visible rows; centre = selected
const DIGITS   = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

interface CartItem {
  market: string; label: string; session: 'OPEN'|'CLOSE';
  value: string; amount: number; potential: number;
}

// ─── Single drum column ───────────────────────────────────────────────────────

function DrumColumn({
  colKey, digit, onChange, active, scrollTrigger,
}: {
  colKey: string;
  digit: number | null;   // null = not selected yet (shows 0 by default)
  onChange: (d: number | null) => void;
  active: boolean;        // false = greyed out, cannot interact
  scrollTrigger?: number; // increment this to force a re-scroll (e.g. on session flip)
}) {
  const ref    = useRef<HTMLDivElement>(null);
  const lock   = useRef(false);
  const shown  = digit ?? 0;

  // Scroll to the current digit — also re-fires when scrollTrigger changes (session flip)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = shown * ITEM_H;
    lock.current = true;
    el.scrollTo({ top: target, behavior: 'smooth' });
    setTimeout(() => { lock.current = false; }, 450);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, colKey, scrollTrigger]);

  const snap = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(9, Math.round(el.scrollTop / ITEM_H)));
    lock.current = true;
    el.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
    onChange(idx);
    setTimeout(() => { lock.current = false; }, 350);
  }, [onChange]);

  const onScroll = useCallback(() => {
    if (lock.current) return;
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(9, Math.round(el.scrollTop / ITEM_H)));
    onChange(idx);
  }, [onChange]);

  return (
    <div style={{
      position: 'relative',
      width: 44,
      height: ITEM_H * VISIBLE,
      borderRadius: 12,
      overflow: 'hidden',
      opacity: active ? 1 : 0.22,
      pointerEvents: active ? 'auto' : 'none',
      background: digit !== null ? 'rgba(254,140,69,0.06)' : 'transparent',
      border: `1px solid ${digit !== null ? 'rgba(254,140,69,0.35)' : 'rgba(255,255,255,0.07)'}`,
      transition: 'all 0.2s',
    }}>

      {/* Top fade */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height: ITEM_H * 2, zIndex:2, pointerEvents:'none',
        background:'linear-gradient(to bottom, var(--Bg-2) 0%, rgba(0,0,0,0) 100%)' }} />

      {/* Bottom fade */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height: ITEM_H * 2, zIndex:2, pointerEvents:'none',
        background:'linear-gradient(to top, var(--Bg-2) 0%, rgba(0,0,0,0) 100%)' }} />

      {/* Centre selection line */}
      <div style={{
        position:'absolute', top: ITEM_H * 2, left:0, right:0, height: ITEM_H,
        zIndex:3, pointerEvents:'none',
        borderTop:`2px solid ${digit !== null ? 'rgba(254,140,69,0.9)' : 'rgba(255,255,255,0.15)'}`,
        borderBottom:`2px solid ${digit !== null ? 'rgba(254,140,69,0.9)' : 'rgba(255,255,255,0.15)'}`,
        background: digit !== null ? 'rgba(254,140,69,0.08)' : 'transparent',
        transition:'all 0.2s',
      }} />

      {/* Scroll container — use spacer divs NOT padding so maxScrollTop is correct */}
      <div
        ref={ref}
        onScroll={onScroll}
        onMouseUp={snap}
        onTouchEnd={snap}
        style={{
          height: ITEM_H * VISIBLE,
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        } as React.CSSProperties}
      >
        {/* Top spacer so digit 0 can sit at centre line */}
        <div style={{ height: ITEM_H * 2, flexShrink: 0 }} />

        {DIGITS.map(d => (
          <div
            key={d}
            onClick={() => onChange(d)}
            style={{
              height: ITEM_H,
              scrollSnapAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: d === shown ? 30 : 20,
              fontWeight: d === shown ? 900 : 400,
              color: d === shown && digit !== null
                ? '#ffcb52'
                : d === shown
                ? 'rgba(255,255,255,0.55)'
                : 'rgba(255,255,255,0.25)',
              cursor: 'pointer',
              fontFamily: 'monospace',
              transition: 'font-size 0.1s, color 0.1s',
              userSelect: 'none',
            }}
          >
            {d}
          </div>
        ))}

        {/* Bottom spacer so digit 9 can sit at centre line */}
        <div style={{ height: ITEM_H * 2, flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MatkaPage() {
  const [allMarkets,   setAllMarkets]   = useState<any[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [market,   setMarket]   = useState<any>(null);
  const [marketSelected, setMarketSelected] = useState(false); // user clicked a market
  const [gameType, setGameType] = useState(GAME_TYPES[0]);
  const [session,  setSession]  = useState<'OPEN'|'CLOSE'>('OPEN');

  // digits[i] = selected digit at STATE index i (null = not selected / inactive)
  // State indices are always LEFT→RIGHT (Open order)
  // When Close: we flip visually, so state index 0 appears on far right
  const [digits, setDigits] = useState<(number|null)[]>(Array(NUM_COLS).fill(null));

  const [amount,        setAmount]       = useState(20);
  const [cart,          setCart]         = useState<CartItem[]>([]);
  const [balance,       setBalance]      = useState(0);
  const [loggedIn,      setLoggedIn]     = useState(false);
  const [buying,        setBuying]       = useState(false);
  // Increments every time session flips → forces drums to re-scroll to correct digit
  const [scrollTrigger, setScrollTrigger]= useState(0);

  const switchSession = (s: 'OPEN'|'CLOSE') => {
    setSession(s);
    // Small delay so columns re-render in new mirrored positions first, then scroll
    setTimeout(() => setScrollTrigger(t => t + 1), 80);
  };

  useEffect(() => {
    const u = getCachedUser();
    if (u) { setBalance(u.balance); setLoggedIn(true); }
    fetchCurrentUser().then(u => { if (u) { setBalance(u.balance); setLoggedIn(true); } });

    // Load markets from DB
    fetch('/api/matka/markets')
      .then(r => r.json())
      .then(d => {
        const markets = d.markets?.length > 0 ? d.markets : FALLBACK_MARKETS;
        // Normalize DB fields to component fields
        const normalized = markets.map((m: any) => {
          const today = m.results?.[0];
          const openDeclared  = !!today?.openPatti;
          const closeDeclared = !!today?.closePatti;
          return {
            ...m,
            open:   m.openTime   ?? m.open,
            close:  m.closeTime  ?? m.close,
            result: m.resultTime ?? m.result,
            status: m.isOpen ? 'OPEN' : 'CLOSED',
            openDeclared,
            closeDeclared,
            openPatti:  today?.openPatti  ?? null,
            closePatti: today?.closePatti ?? null,
            patti:  today?.openPatti ? `${today.openPatti}-${today.openAnk}` : '???-?',
            jodi:   today?.jodi ?? '??',
          };
        });
        setAllMarkets(normalized);
        setMarket(normalized[0]); // preselect but don't show game yet
      })
      .catch(() => {
        setAllMarkets(FALLBACK_allMarkets.map(m => ({...m, open:m.openTime,close:m.closeTime,result:m.resultTime,status:m.isOpen?'OPEN':'CLOSED',patti:'???-?',jodi:'??'})));
        setMarket({...FALLBACK_MARKETS[0], open:'09:30',close:'11:30',result:'12:00',status:'OPEN',patti:'???-?',jodi:'??'});
      })
      .finally(() => setMarketsLoading(false));
  }, []);

  // Clear on game type change
  useEffect(() => { setDigits(Array(NUM_COLS).fill(null)); }, [gameType.key]);

  // ── Column mapping ─────────────────────────────────────────────────────────
  //
  // Open  → state index = visual index  (left to right)
  // Close → state index = (7 - visual index)  (right to left mirror)
  //
  // So if digit is at state index 1:
  //   Open:  appears at visual position 1  (2nd from LEFT)
  //   Close: appears at visual position 6  (2nd from RIGHT = 7-1)

  const stateIdx = (visualIdx: number) =>
    session === 'OPEN' ? visualIdx : (NUM_COLS - 1 - visualIdx);

  // Set a digit by VISUAL column index
  const setByVisual = useCallback((visualIdx: number, d: number) => {
    const si = session === 'OPEN' ? visualIdx : (NUM_COLS - 1 - visualIdx);
    setDigits(prev => {
      const next = [...prev];
      // Count how many are already selected (excluding current column)
      const selectedCount = next.filter((v, i) => v !== null && i !== si).length;
      if (next[si] === null && selectedCount >= gameType.maxSelect) {
        toast.error(`${gameType.label} allows max ${gameType.maxSelect} column${gameType.maxSelect > 1 ? 's' : ''}`);
        return prev;
      }
      next[si] = d;
      return next;
    });
  }, [session, gameType]);

  // Clear a column by VISUAL index
  const clearByVisual = useCallback((visualIdx: number) => {
    const si = session === 'OPEN' ? visualIdx : (NUM_COLS - 1 - visualIdx);
    setDigits(prev => { const n = [...prev]; n[si] = null; return n; });
  }, [session]);

  // ── Build bet value ────────────────────────────────────────────────────────

  const selectedStateIndices = digits
    .map((d, i) => ({ d, i }))
    .filter(x => x.d !== null);

  const betValue = (() => {
    const vals = selectedStateIndices.map(x => x.d!);
    if (vals.length === 0) return '—';
    // Half Sangam A: open ank (1) + close patti (3)  →  D-DDD
    if (gameType.key === 'HALF_SANGAM_A' && vals.length === 4)
      return `${vals[0]}-${vals[1]}${vals[2]}${vals[3]}`;
    // Half Sangam B: open patti (3) + close ank (1)  →  DDD-D
    if (gameType.key === 'HALF_SANGAM_B' && vals.length === 4)
      return `${vals[0]}${vals[1]}${vals[2]}-${vals[3]}`;
    if (gameType.key === 'FULL_SANGAM' && vals.length === 6)
      return `${vals[0]}${vals[1]}${vals[2]}-${vals[3]}${vals[4]}${vals[5]}`;
    return vals.join('');
  })();

  const readyToAdd = selectedStateIndices.length === gameType.maxSelect;

  // ── Cart ───────────────────────────────────────────────────────────────────

  const addToCart = () => {
    if (!readyToAdd) return toast.warning(`Select ${gameType.maxSelect} digit${gameType.maxSelect > 1 ? 's' : ''} first`);
    if (market.status === 'CLOSED') return toast.error('Market is closed');
    if (phase === 'done')     return toast.error('Result declared — betting closed');
    if (!availableTypes.find(g => g.key === gameType.key))
      return toast.error(`${gameType.label} cannot be placed — open result already declared`);
    // Open-session ank/pana not allowed after open declared
    if (phase === 'close' && session === 'OPEN')
      return toast.error('Open session is closed — open result already declared');
    setCart(p => [...p, {
      market: market.name, label: gameType.label, session,
      value: betValue, amount, potential: amount * gameType.payout,
    }]);
    setDigits(Array(NUM_COLS).fill(null));
    toast.success(`✅ Added: ${gameType.label} ${betValue} — ₹${amount}`);
  };

  const removeFromCart = (i: number) => setCart(p => p.filter((_, idx) => idx !== i));

  const totalBet = cart.reduce((s, b) => s + b.amount, 0);
  const totalPot = cart.reduce((s, b) => s + b.potential, 0);

  const buy = async () => {
    if (!loggedIn) return toast.error('Please login');
    if (cart.length === 0) return toast.warning('Cart is empty');
    if (balance < totalBet) return toast.error(`Need ₹${totalBet}, have ₹${balance}`);
    setBuying(true);
    try {
      for (const b of cart) {
        await authFetch('/api/matka/result', {
          method: 'POST',
          body: JSON.stringify({ action: 'place_bet', marketId: market.id, betType: b.label, betValue: b.value, session: b.session, amount: b.amount }),
        });
      }
    } catch { /* demo ok */ }
    setBalance(p => p - totalBet);
    toast.success(`🎰 ${cart.length} bets placed! Potential ₹${totalPot.toLocaleString()}`);
    setCart([]);
    setBuying(false);
  };

  // ── Visual column order for rendering ─────────────────────────────────────
  // Open:  visual positions 0..7 map to state 0..7
  // Close: visual positions 0..7 map to state 7..0

  const visualOrder = session === 'OPEN'
    ? Array.from({ length: NUM_COLS }, (_, i) => i)         // [0,1,2,3,4,5,6,7]
    : Array.from({ length: NUM_COLS }, (_, i) => NUM_COLS - 1 - i); // [7,6,5,4,3,2,1,0]

  // ── Phase logic (computed up-top so hooks below stay in fixed order) ───────
  // pre-open  → open result NOT yet declared  → everything bettable
  // close     → open result declared, close not yet  → only close-side bets
  // done      → both declared                 → no betting
  const openDeclared  = !!market?.openDeclared;
  const closeDeclared = !!market?.closeDeclared;
  const phase: 'pre-open'|'close'|'done' =
    closeDeclared ? 'done' : openDeclared ? 'close' : 'pre-open';

  // If admin declared open while user was on a now-disabled bet type, snap back.
  // Hooks must run on every render → placed BEFORE early returns.
  useEffect(() => {
    if (!market) return;
    const allowed = GAME_TYPES.filter(g => {
      if (phase === 'done')     return false;
      if (phase === 'pre-open') return true;
      return ['ANK','SINGLE_PATTI','DOUBLE_PATTI','TRIPLE_PATTI'].includes(g.key);
    });
    if (allowed.length && !allowed.find(g => g.key === gameType.key)) {
      setGameType(allowed[0]);
      setDigits(Array(NUM_COLS).fill(null));
    }
  }, [phase, market]); // eslint-disable-line react-hooks/exhaustive-deps

  // Force session = CLOSE once open is declared
  useEffect(() => {
    if (phase === 'close' && session !== 'CLOSE') {
      setSession('CLOSE');
      setTimeout(() => setScrollTrigger(t => t + 1), 80);
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (marketsLoading || !market) return (
    <>
      <Header />
      <div style={{ paddingTop:140, textAlign:'center', color:'var(--Secondary)', minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
        <div style={{ width:52, height:52, border:'4px solid rgba(254,140,69,0.15)', borderTop:'4px solid #fe8c45', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
        <p style={{ fontSize:15, fontWeight:600 }}>Loading Matka King...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  );

  // Dynamic game rates — use market-specific values if set by admin
  const gameRates = {
    ANK:         market?.payoutSingle    ?? 90,
    JODI:        market?.payoutJodi      ?? 900,
    SINGLE_PATTI: market?.payoutSP       ?? 140,
    DOUBLE_PATTI: market?.payoutDP       ?? 280,
    TRIPLE_PATTI: market?.payoutTP       ?? 450,
    HALF_SANGAM:  market?.payoutHalfSangam ?? 1500,
    FULL_SANGAM:  market?.payoutFullSangam ?? 11000,
  };
  const dynamicTypes = GAME_TYPES.map(g => ({
    ...g,
    payout: gameRates[g.key as keyof typeof gameRates] ?? g.payout,
  }));

  // Phase + availableTypes are also computed up top (before early returns)
  // so they're available here for JSX. See the block above the early-return guard.
  const availableTypes = dynamicTypes.filter(g => {
    if (phase === 'done')     return false;
    if (phase === 'pre-open') return true;
    return ['ANK','SINGLE_PATTI','DOUBLE_PATTI','TRIPLE_PATTI'].includes(g.key);
  });

  // Market selection screen - shown before entering the game
  if (!marketSelected) return (
    <>
      <Header />
      <div style={{ paddingTop:120, minHeight:'100vh' }}>
        <div className="tf-container" style={{ paddingTop:40, paddingBottom:60 }}>
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <h1 style={{ fontWeight:900, fontSize:36, marginBottom:10 }}>Matka King</h1>
            <p style={{ color:'var(--Secondary)', fontSize:16 }}>Select a market to start playing</p>
          </div>

          <div className='market-grid' style={{ maxWidth:1000, margin:'0 auto' }}>
            {allMarkets.map((m:any) => {
              const isOpen = m.status === 'OPEN' || m.isOpen;
              return (
                <div key={m.id} onClick={()=>{ if(!loggedIn){ toast.error('Please login to play'); return; } setMarket(m); setMarketSelected(true); }}
                  style={{ background:'linear-gradient(135deg,var(--Bg-2),var(--Bg-10))', borderRadius:24, padding:32, border:`2px solid ${isOpen?'rgba(46,204,113,0.4)':'rgba(100,100,100,0.2)'}`, cursor:'pointer', transition:'all 0.2s', position:'relative', overflow:'hidden' }}
                  onMouseEnter={e=>(e.currentTarget.style.transform='translateY(-4px)')}
                  onMouseLeave={e=>(e.currentTarget.style.transform='translateY(0)')}>

                  {/* Status badge */}
                  <div style={{ position:'absolute', top:20, right:20, padding:'4px 14px', borderRadius:999, fontSize:12, fontWeight:800, background:isOpen?'rgba(46,204,113,0.15)':'rgba(239,68,68,0.12)', color:isOpen?'#2ECC71':'#ef4444', border:`1px solid ${isOpen?'rgba(46,204,113,0.4)':'rgba(239,68,68,0.3)'}` }}>
                    {isOpen ? '● OPEN' : '● CLOSED'}
                  </div>

                  {/* Market name */}
                  <h2 style={{ fontWeight:900, fontSize:28, marginBottom:8 }}>{m.name}</h2>

                  {/* Times */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, color:'var(--Secondary)', fontSize:14 }}>
                    <span style={{ color:'#2ECC71', fontWeight:700 }}>● {m.open ?? m.openTime}</span>
                    <span>→</span>
                    <span style={{ color:'#ef4444', fontWeight:700 }}>● {m.close ?? m.closeTime}</span>
                  </div>

                  {/* Last result */}
                  <div style={{ display:'flex', gap:20, marginBottom:24 }}>
                    <div>
                      <p style={{ fontSize:10, color:'var(--Secondary)', textTransform:'uppercase', fontWeight:700, marginBottom:4 }}>Patti · Ank</p>
                      <p style={{ fontWeight:900, fontSize:22, color:'#ffcb52' }}>{m.patti ?? '???-?'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize:10, color:'var(--Secondary)', textTransform:'uppercase', fontWeight:700, marginBottom:4 }}>Jodi</p>
                      <p style={{ fontWeight:900, fontSize:22, color:'#ffcb52' }}>{m.jodi ?? '??'}</p>
                    </div>
                  </div>

                  {/* Game rates quick view */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {[
                      ['Ank', m.payoutSingle ?? 90],
                      ['Jodi', m.payoutJodi ?? 900],
                      ['SP', m.payoutSP ?? 140],
                      ['DP', m.payoutDP ?? 280],
                    ].map(([label, val]) => (
                      <span key={String(label)} style={{ background:'rgba(254,140,69,0.1)', border:'1px solid rgba(254,140,69,0.2)', borderRadius:8, padding:'4px 10px', fontSize:12, fontWeight:700, color:'var(--Main-color)' }}>
                        {label} {val}x
                      </span>
                    ))}
                  </div>

                  {/* Play button */}
                  <div style={{ marginTop:24 }}>
                    <button style={{ width:'100%', height:48, borderRadius:14, border:'none', cursor:'pointer', fontWeight:800, fontSize:15, background: isOpen ? 'linear-gradient(270deg,#fe8c45,#ca2826)' : 'rgba(100,100,100,0.2)', color: isOpen ? '#fff' : 'var(--Secondary)' }}>
                      {isOpen ? 'Play Now →' : 'View Results'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <footer id="footer"><div className="footer-bottom" style={{paddingTop:24,paddingBottom:24}}><div className="tf-container"><div className="wrapper"><div className="right"><span>© 2025 Supreme Gaming Engine</span></div></div></div></div></footer>
    </>
  );

  return (
    <>
      <Header />

      {/* bg */}
      <div style={{ background: 'linear-gradient(180deg,#0d0b2a,var(--Bg))', paddingTop: 100 }}>
        <div className="tf-container" style={{ paddingTop: 18 }}>

          {/* Markets */}
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {allMarkets.map(m => (
              <div key={m.id} onClick={() => m.status !== 'CLOSED' && setMarket(m)} style={{
                minWidth: 240, flexShrink: 0, borderRadius: 14, overflow: 'hidden',
                cursor: m.status !== 'CLOSED' ? 'pointer' : 'default',
                border: `2px solid ${market.id === m.id ? '#fe8c45' : 'var(--Border)'}`,
                background: 'var(--Bg-2)', transition: 'border-color 0.2s',
              }}>
                <div style={{ padding: '12px 16px 8px', background: market.id === m.id ? 'rgba(254,140,69,0.07)' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 900, fontSize: 15 }}>{m.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999,
                      background: m.status === 'OPEN' ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)',
                      color: m.status === 'OPEN' ? '#2ECC71' : '#E74C3C' }}>{m.status}</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--Secondary)' }}>🟢 {m.open} → 🔴 {m.close}</p>
                </div>
                <div style={{ padding: '7px 16px 12px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 9, color: 'var(--Secondary)', marginBottom: 2, fontWeight: 700, textTransform: 'uppercase' }}>Patti · Ank</p>
                    <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 16, color: '#ffcb52' }}>{m.patti}</span>
                  </div>
                  <div style={{ width: 1, height: 24, background: 'var(--Border)' }} />
                  <div>
                    <p style={{ fontSize: 9, color: 'var(--Secondary)', marginBottom: 2, fontWeight: 700, textTransform: 'uppercase' }}>Jodi</p>
                    <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 22, color: '#ffcb52' }}>{m.jodi}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="main-content" style={{ paddingTop: 18 }}>
        <div className="tf-container">

          {/* Phase banner */}
          {phase !== 'pre-open' && (
            <div style={{
              background: phase === 'done' ? 'rgba(231,76,60,0.10)' : 'rgba(52,152,219,0.10)',
              border: `1px solid ${phase === 'done' ? 'rgba(231,76,60,0.4)' : 'rgba(52,152,219,0.4)'}`,
              borderRadius: 12, padding: '10px 16px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ fontWeight: 800, color: phase === 'done' ? '#E74C3C' : '#3498DB' }}>
                {phase === 'done' ? '● Result Declared' : '● Open Result Out'}
              </span>
              {phase === 'close' && (
                <span style={{ fontSize: 13, color: 'var(--Secondary)' }}>
                  Open Patti: <strong style={{ color: '#fff' }}>{market.openPatti}</strong> &nbsp;·&nbsp;
                  Only <strong style={{ color: '#fff' }}>Close Ank, Close SP/DP/TP</strong> are still bettable. Jodi &amp; Sangam are closed.
                </span>
              )}
              {phase === 'done' && (
                <span style={{ fontSize: 13, color: 'var(--Secondary)' }}>
                  Today's result is out. No more bets accepted. Come back tomorrow.
                </span>
              )}
            </div>
          )}

          {/* Game Type + Open/Close */}
          <div style={{ background: 'var(--Bg-2)', borderRadius: 14, padding: '13px 18px', marginBottom: 18, border: '1px solid var(--Border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {availableTypes.map(g => (
                  <button key={g.key} onClick={() => setGameType(g)} style={{
                    padding: '7px 13px', borderRadius: 999, border: '1px solid',
                    borderColor: gameType.key === g.key ? '#fe8c45' : 'var(--Border)',
                    background: gameType.key === g.key ? 'linear-gradient(270deg,#fe8c45,#ca2826)' : 'var(--Bg-3)',
                    color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>
                    {g.label}
                    <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 3 }}>{g.payout}x</span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {loggedIn && <span style={{ color: '#ffcb52', fontWeight: 700, fontSize: 13 }}>💰 {balance.toLocaleString()}</span>}
                {/* OPEN / CLOSE toggle */}
                <div style={{ display: 'flex', background: 'var(--Bg-3)', borderRadius: 999, padding: 3, border: '1px solid var(--Border)' }}>
                  {(['OPEN', 'CLOSE'] as const).map(s => {
                    const disabled = phase === 'close' && s === 'OPEN';
                    return (
                      <button key={s}
                        onClick={() => !disabled && switchSession(s)}
                        disabled={disabled}
                        title={disabled ? 'Open result already declared' : ''}
                        style={{
                          padding: '8px 22px', borderRadius: 999, border: 'none',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
                          background: session === s ? 'linear-gradient(270deg,#fe8c45,#ca2826)' : 'transparent',
                          color: session === s ? '#fff' : 'var(--Secondary)',
                          opacity: disabled ? 0.35 : 1,
                        }}>{s}{disabled ? ' 🔒' : ''}</button>
                    );
                  })}
                </div>
              </div>
            </div>

            <p style={{ marginTop: 8, fontSize: 11, color: 'var(--Secondary)' }}>
              <strong style={{ color: 'var(--Main-color)' }}>{gameType.label}</strong> — {gameType.desc} &nbsp;·&nbsp;
              Select <strong style={{ color: '#fff' }}>{gameType.maxSelect}</strong> column{gameType.maxSelect > 1 ? 's' : ''} &nbsp;·&nbsp;
              {session === 'OPEN'
                ? <span style={{ color: '#2ECC71' }}>← Open: columns read left to right</span>
                : <span style={{ color: '#3498DB' }}>Close: columns read right to left →</span>}
            </p>
          </div>

          <div className="matka-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, alignItems: 'start' }}>

            {/* ── Drum picker ── */}
            <div style={{ background: 'var(--Bg-2)', borderRadius: 18, border: '1px solid var(--Border)', overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--Border)', background: 'rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 900, fontSize: 17 }}>{market.name}</span>
                  <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--Secondary)' }}>{gameType.label} · pick {gameType.maxSelect}</span>
                </div>
                {/* Direction indicator */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: session === 'OPEN' ? 'rgba(46,204,113,0.1)' : 'rgba(52,152,219,0.1)',
                  border: `1px solid ${session === 'OPEN' ? 'rgba(46,204,113,0.3)' : 'rgba(52,152,219,0.3)'}`,
                  borderRadius: 999, padding: '5px 14px',
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: session === 'OPEN' ? '#2ECC71' : '#3498DB' }} />
                  <span style={{ fontWeight: 700, fontSize: 12, color: session === 'OPEN' ? '#2ECC71' : '#3498DB' }}>
                    {session === 'OPEN' ? '← OPEN (Left)' : 'CLOSE (Right) →'}
                  </span>
                </div>
              </div>

              {/* Column number labels */}
              <div style={{ display: 'flex', padding: '8px 16px 0', gap: 6, justifyContent: 'space-around' }}>
                {visualOrder.map((si, vi) => (
                  <div key={vi} style={{ width: 44, textAlign: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700,
                      color: digits[si] !== null ? '#fe8c45' : 'rgba(255,255,255,0.2)',
                    }}>
                      {session === 'OPEN' ? vi + 1 : NUM_COLS - vi}
                    </span>
                  </div>
                ))}
              </div>

              {/* 8 drum columns — always 8, order flips on Close */}
              <div style={{ padding: '10px 16px 10px', position: 'relative' }}>

                {/* Full-width selection band behind all columns */}
                <div style={{
                  position: 'absolute',
                  top: 10 + ITEM_H * 2,
                  left: 16, right: 16,
                  height: ITEM_H,
                  pointerEvents: 'none',
                  zIndex: 0,
                  borderTop: '1.5px solid rgba(254,140,69,0.5)',
                  borderBottom: '1.5px solid rgba(254,140,69,0.5)',
                  background: 'rgba(254,140,69,0.04)',
                }} />

                <div style={{ display: 'flex', gap: 6, justifyContent: 'space-around' }}>
                  {visualOrder.map((si, vi) => (
                    <DrumColumn
                      key={`${gameType.key}-${si}`}
                      colKey={`${gameType.key}-${si}`}
                      scrollTrigger={scrollTrigger}
                      digit={digits[si]}
                      active={true}
                      onChange={d => {
                        // Check max selections before setting
                        setDigits(prev => {
                          const next = [...prev];
                          const alreadySelected = next.filter((v, i) => v !== null && i !== si).length;
                          if (prev[si] === null && alreadySelected >= gameType.maxSelect) {
                            toast.error(`${gameType.label} = pick only ${gameType.maxSelect} digit${gameType.maxSelect > 1 ? 's' : ''}`);
                            return prev;
                          }
                          next[si] = d;
                          return next;
                        });
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* CLR buttons row */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'space-around', padding: '0 16px 10px' }}>
                {visualOrder.map((si, vi) => (
                  <div key={vi} style={{ width: 44, display: 'flex', justifyContent: 'center' }}>
                    <button onClick={() => setDigits(prev => { const n = [...prev]; n[si] = null; return n; })} style={{
                      width: 36, height: 18, borderRadius: 5, border: 'none',
                      background: digits[si] !== null ? 'rgba(239,68,68,0.18)' : 'transparent',
                      color: digits[si] !== null ? '#ef4444' : 'rgba(255,255,255,0.12)',
                      fontSize: 9, fontWeight: 700, cursor: digits[si] !== null ? 'pointer' : 'default',
                    }}>CLR</button>
                  </div>
                ))}
              </div>

              {/* Selected value + progress */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--Border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 10, color: 'var(--Secondary)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>
                    Selected ({selectedStateIndices.length}/{gameType.maxSelect})
                  </p>
                  <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 36, color: '#ffcb52', letterSpacing: 4 }}>
                    {betValue}
                  </span>
                </div>
                {/* Progress dots */}
                <div style={{ display: 'flex', gap: 5 }}>
                  {Array.from({ length: gameType.maxSelect }).map((_, i) => (
                    <div key={i} style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: i < selectedStateIndices.length ? '#ffcb52' : 'var(--Border)',
                      transition: 'background 0.2s',
                    }} />
                  ))}
                </div>
              </div>

              {/* Amount + Add to Cart */}
              <div style={{ padding: '14px 18px 18px', borderTop: '1px solid var(--Border)', background: 'rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--Secondary)' }}>INR</span>
                  <input type="number" min={1} value={amount}
                    onChange={e => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: 10, background: 'var(--Bg-3)', border: '1px solid var(--Border-2)', color: '#fff', fontSize: 18, fontWeight: 900, outline: 'none', textAlign: 'center' }} />
                  <button onClick={() => setAmount(a => Math.max(1, Math.floor(a / 2)))} style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid var(--Border)', background: 'var(--Bg-3)', color: 'var(--Secondary)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>½</button>
                  <button onClick={() => setAmount(a => a * 2)} style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid var(--Border)', background: 'var(--Bg-3)', color: 'var(--Secondary)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>×2</button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {[10, 20, 50, 100, 200, 500].map(a => (
                    <button key={a} onClick={() => setAmount(a)} style={{
                      flex: 1, padding: '6px 0', borderRadius: 7,
                      border: `1px solid ${amount === a ? '#fe8c45' : 'var(--Border)'}`,
                      background: amount === a ? 'rgba(254,140,69,0.14)' : 'var(--Bg-3)',
                      color: amount === a ? '#fe8c45' : 'var(--Secondary)',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>₹{a}</button>
                  ))}
                </div>

                {market.status === 'OPEN' ? (
                  <button onClick={addToCart} disabled={!readyToAdd} style={{
                    width: '100%', height: 50, borderRadius: 13, border: 'none',
                    background: readyToAdd ? 'linear-gradient(270deg,#fe8c45,#ca2826)' : 'var(--Bg-3)',
                    color: '#fff', fontWeight: 900, fontSize: 16, cursor: readyToAdd ? 'pointer' : 'not-allowed',
                    opacity: readyToAdd ? 1 : 0.45, transition: 'all 0.2s',
                  }}>
                    {readyToAdd
                      ? `🛒 Add to Cart — ${gameType.label} ${betValue} · Win ₹${(amount * gameType.payout).toLocaleString()}`
                      : `Select ${gameType.maxSelect - selectedStateIndices.length} more digit${gameType.maxSelect - selectedStateIndices.length > 1 ? 's' : ''}`}
                  </button>
                ) : (
                  <div style={{ textAlign: 'center', padding: 13, borderRadius: 12, background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', color: '#E74C3C', fontWeight: 700 }}>
                    ⛔ {market.name} CLOSED · Opens {market.open}
                  </div>
                )}
              </div>
            </div>

            {/* ── Cart + Rates ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Cart */}
              <div style={{ background: 'var(--Bg-2)', borderRadius: 14, border: '1px solid var(--Border)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--Border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)' }}>
                  <h4 style={{ fontWeight: 900, fontSize: 15 }}>🛒 {cart.length} BIDS <span style={{ color: 'var(--Secondary)', fontWeight: 400, fontSize: 12 }}>₹{totalBet}</span></h4>
                  {cart.length > 0 && <button onClick={() => setCart([])} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Clear</button>}
                </div>

                {cart.length === 0 ? (
                  <div style={{ padding: '36px 14px', textAlign: 'center', color: 'var(--Secondary)', fontSize: 12 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🛒</div>
                    0 Bids · ₹0
                    <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>Select digits → Add to Cart</div>
                  </div>
                ) : (
                  <>
                    <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                      {cart.map((b, i) => (
                        <div key={i} style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 17, color: '#ffcb52' }}>{b.value}</span>
                              <span style={{ fontSize: 9, borderRadius: 999, padding: '1px 6px', fontWeight: 700,
                                background: b.session === 'OPEN' ? 'rgba(46,204,113,0.15)' : 'rgba(52,152,219,0.15)',
                                color: b.session === 'OPEN' ? '#2ECC71' : '#3498DB' }}>{b.session}</span>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--Secondary)', marginTop: 1 }}>{b.label} · {b.market}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>₹{b.amount}</div>
                              <div style={{ fontSize: 9, color: '#2ECC71' }}>→₹{b.potential.toLocaleString()}</div>
                            </div>
                            <button onClick={() => removeFromCart(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 17 }}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '12px 14px', borderTop: '1px solid var(--Border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: 'var(--Secondary)' }}>Total</span><span style={{ fontWeight: 700 }}>₹{totalBet}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 12 }}>
                        <span style={{ color: 'var(--Secondary)' }}>If Win</span><span style={{ fontWeight: 700, color: '#2ECC71' }}>₹{totalPot.toLocaleString()}</span>
                      </div>
                      <button onClick={buy} disabled={buying || !loggedIn} style={{
                        width: '100%', height: 46, borderRadius: 11, border: 'none',
                        background: (!loggedIn || buying) ? 'var(--Bg-3)' : 'linear-gradient(270deg,#fe8c45,#ca2826)',
                        color: '#fff', fontWeight: 900, fontSize: 14, cursor: (!loggedIn || buying) ? 'not-allowed' : 'pointer',
                      }}>
                        {!loggedIn ? '🔒 Login' : buying ? '⏳ Placing...' : `Buy — ₹${totalBet}`}
                      </button>
                      <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--Secondary)', marginTop: 7 }}>
                        Balance: {loggedIn ? `₹${balance.toLocaleString()}` : '—'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Game Rates */}
              <div style={{ background: 'var(--Bg-2)', borderRadius: 14, padding: '13px 15px', border: '1px solid var(--Border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h4 style={{ fontWeight: 700, fontSize: 13 }}>💰 Game Rates</h4>
                  <span style={{ fontSize: 10, color: 'var(--Secondary)' }}>{market.name}</span>
                </div>
                {dynamicTypes.map(g => (
                  <div key={g.key} onClick={() => setGameType(g)} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 9px', borderRadius: 7, marginBottom: 3, cursor: 'pointer',
                    background: gameType.key === g.key ? 'rgba(254,140,69,0.1)' : 'transparent',
                    border: `1px solid ${gameType.key === g.key ? 'rgba(254,140,69,0.3)' : 'transparent'}`,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: gameType.key === g.key ? 700 : 400 }}>{g.label}</span>
                    <span style={{ fontWeight: 900, color: '#ffcb52', fontSize: 12 }}>{g.payout}x</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      <footer id="footer">
        <div className="footer-bottom" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <div className="tf-container">
            <div className="wrapper">
              <div className="center"><ul style={{ display: 'flex', gap: 24 }}>
                <li><Link href="/">Home</Link></li>
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
