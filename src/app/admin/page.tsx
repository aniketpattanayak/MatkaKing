'use client';
import React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Header from '@/components/layout/Header';
import Loader from '@/components/Loader';
import { authFetch, getToken } from '@/lib/auth-client';
import {
  LayoutDashboard, Ticket, Dices, RotateCcw, Wallet, Users, CreditCard,
  RefreshCw, Plus, Trash2, CheckCircle, XCircle, ChevronRight, AlertTriangle,
  TrendingUp, Activity, Settings, Eye, Bell, Calendar, Star, Gift, Send, Pin, Trophy
} from 'lucide-react';

type Tab = 'overview'|'lottery'|'matka'|'spin'|'upi'|'users'|'payments'|'notifications'|'results';

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'overview', icon: '', label: 'Overview'   },
  { key: 'lottery',  icon: '', label: 'Lottery'    },
  { key: 'matka',    icon: '', label: 'Matka King' },
  { key: 'spin',     icon: '', label: 'Spin Wheel' },
  { key: 'upi',      icon: '', label: 'UPI Pool'   },
  { key: 'users',    icon: '', label: 'Users'      },
  { key: 'payments',      icon: '', label: 'Payments'      },
  { key: 'notifications', icon: '', label: 'Notifications' },
  { key: 'results',       icon: '', label: 'Results'       },
];

// ─── Styles ──────────────────────────────────────────────────────────────────
const card  = { background:'var(--Bg-2)', borderRadius:16, border:'1px solid var(--Border)', overflow:'hidden' as const };
const inp   = { width:'100%', padding:'11px 14px', borderRadius:10, background:'var(--Bg-3)', border:'1px solid var(--Border-2)', color:'var(--White)', fontSize:14, outline:'none' };
const label = { fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:6, textTransform:'uppercase' as const, letterSpacing:0.5 };

export default function AdminPage() {
  const [tab,         setTab]         = useState<Tab>('overview');
  const [status,      setStatus]      = useState<'loading'|'denied'|'setup'|'ok'>('loading');
  const [setupLoading,setSetupLoading]= useState(false);
  const [data,        setData]        = useState<any>({ upis:[], markets:[], series:[], users:[], spinConfig:null });

  // ── Lottery form ────────────────────────────────────────────────────────────
  const [lForm, setLForm] = useState({ name:'', prefix:'', ticketPrice:'25', prizePool:'2000000', totalTickets:'9999', drawAt:'' });
  const [lLoading,   setLLoading]   = useState(false);
  const [drawSeries, setDrawSeries] = useState<any>(null);  // series being drawn
  const [drawInfo,   setDrawInfo]   = useState<any>(null);  // eligibility info from API
  const [drawLoading,setDrawLoading]= useState(false);
  const [drawResult, setDrawResult] = useState<any>(null);  // result after draw
  const [manualTicket,setManualTicket]=useState('');       // admin manually enters ticket

  // ── Matka form ──────────────────────────────────────────────────────────────
  const [mResult,  setMResult]  = useState({ marketId:'', openPatti:'', closePatti:'' });
  const [mForm,    setMForm]    = useState({ name:'', openTime:'09:30', closeTime:'11:30', resultTime:'12:00' });
  const [mCreate,  setMCreate]  = useState(false); // show create form
  const [mLoading, setMLoading] = useState(false);

  // ── Spin form ───────────────────────────────────────────────────────────────
  const [sForm,    setSForm]    = useState({ costPerSpin:'10', freeSpinInterval:'6' });
  const [sLoading, setSLoading] = useState(false);
  const [segments, setSegments] = useState<any[]>([]);
  const [segTotal, setSegTotal] = useState(0);
  const [newSeg,   setNewSeg]   = useState({ label:'', coins:'100', probability:'5', color:'#3498DB' });
  const [editSeg,  setEditSeg]  = useState<any>(null); // segment being inline-edited
  const [pendingTxns, setPendingTxns] = useState<any[]>([]);

  // ── UPI form ────────────────────────────────────────────────────────────────
  const [uForm, setUForm] = useState({ upiId:'', label:'', limit:'100', priority:'0' });
  const [uLoading, setULoading] = useState(false);
  const [editUpi,  setEditUpi]  = useState<any>(null);
  const [editRates, setEditRates] = useState<any>(null);  // market being rate-edited
  const [liveCheck, setLiveCheck] = useState<any>(null);  // real-time profit check result
  const [checkLoading, setCheckLoading] = useState(false);
  // Notifications state
  const [notifs,       setNotifs]       = useState<any[]>([]);
  const [festivals,    setFestivals]    = useState<any[]>([]);
  const [nForm,        setNForm]        = useState({ title:'', message:'', type:'GENERAL', icon:'🔔', color:'#fe8c45', isPinned:false, expiresAt:'' });
  const [fForm,        setFForm]        = useState({ name:'', emoji:'🎉', date:'', gameType:'ALL', description:'', bonusMultiplier:'1.0' });
  const [flForm,       setFlForm]       = useState({ name:'', prefix:'', ticketPrice:'10', prizePool:'100000', totalTickets:'1000', drawAt:'' });
  const [showFLottery, setShowFLottery] = useState<string|null>(null); // festivalId for lottery creation
  const [nLoading,     setNLoading]     = useState(false);

  // Results
  const [results, setResults] = useState<any>({ lottery:[], matka:[], spin:[], spinStats:{} });
  const [resultsTab, setResultsTab] = useState<'lottery'|'matka'|'spin'>('lottery');
  const [resultsLoading, setResultsLoading] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => { load(); }, []);

  async function load() {
    setStatus('loading');
    if (!getToken()) { setStatus('denied'); return; }

    try {
      const r = await authFetch('/api/admin/upi');

      if (r.status === 401) { setStatus('denied'); return; }

      // 403 = logged in but not admin — check if zero admins exist (first-time setup)
      if (r.status === 403) {
        const setupCheck = await authFetch('/api/admin/setup', { method: 'POST' }).catch(() => null);
        // If setup endpoint says "no admins exist" we allow self-setup
        if (setupCheck?.status === 401) {
          // User is logged in but server returned 401 on setup — means there ARE admins, just not this user
          setStatus('denied');
        } else {
          // Offer first-time setup
          setStatus('setup');
        }
        return;
      }

      const [upiD, mkD, lD, sD] = await Promise.all([
        r.json(),
        authFetch('/api/admin/markets').then(x => x.json()).catch(() => ({})),
        authFetch('/api/admin/lottery').then(x => x.json()).catch(() => ({})),
        authFetch('/api/admin/spin-config').then(x => x.json()).catch(() => ({})),
      ]);

      setData({ upis: upiD.upis ?? [], markets: mkD.markets ?? [], series: lD.series ?? [], spinConfig: sD.config, users: [] });
      if (sD.config) setSForm({ costPerSpin: String(sD.config.costPerSpin ?? 10), freeSpinInterval: String(sD.config.freeSpinInterval ?? 6) });

      // Auto-seed markets if none exist
      try {
        if ((mkD?.markets ?? []).length === 0) {
          authFetch('/api/admin/seed-markets', { method:'POST' }).then(() => {
            authFetch('/api/admin/markets').then(r=>r.json()).then(d2=>{
              setData(s=>({...s, markets: d2.markets??[]}));
            }).catch(()=>{});
          }).catch(()=>{});
        }
      } catch(e) { console.warn('auto-seed failed:', e); }

      // Load notifications + festivals
      authFetch('/api/admin/notifications').then(r=>r.json()).then(d=>{
        if (d.notifications) setNotifs(d.notifications);
        if (d.festivals)     setFestivals(d.festivals);
      }).catch(()=>{});

      // Load spin segments
      authFetch('/api/admin/spin-segments').then(r=>r.json()).then(d=>{
        if(d.rewards){ setSegments(d.rewards); setSegTotal(d.totalProbability??0); }
      }).catch(()=>{});

      // Load pending payments
      authFetch('/api/payment/verify').then(r=>r.json()).then(d=>{
        if(d.pending) setPendingTxns(d.pending);
      }).catch(()=>{});

      setStatus('ok');
    } catch (e) {
      console.error(e);
      setStatus('denied');
    }
  }

  // First-time setup — promotes current logged-in user to ADMIN
  async function runSetup() {
    setSetupLoading(true);
    const r = await authFetch('/api/admin/setup', { method: 'POST' });
    const d = await r.json();
    if (r.ok) {
      toast.success(' You are now ADMIN! Logging out...');
      setTimeout(() => { localStorage.removeItem('sge_token'); localStorage.removeItem('sge_user'); window.location.href = '/'; }, 1500);
    } else {
      toast.error(d.error);
    }
    setSetupLoading(false);
  }

  // ── Lottery actions ──────────────────────────────────────────────────────────
  async function createSeries() {
    if (!lForm.name || !lForm.prefix || !lForm.drawAt) return toast.error('Fill all fields');
    setLLoading(true);
    const r = await authFetch('/api/admin/lottery', { method:'POST', body: JSON.stringify({ action:'create_series', ...lForm }) });
    const d = await r.json();
    if (r.ok) { toast.success(`✓ ${d.series.name} created with ${d.ticketsGenerated} tickets!`); load(); setLForm({ name:'', prefix:'', ticketPrice:'25', prizePool:'2000000', totalTickets:'9999', drawAt:'' }); }
    else toast.error(d.error);
    setLLoading(false);
  }

  async function updateSeriesStatus(id: string, status: string) {
    await authFetch('/api/admin/lottery', { method:'POST', body: JSON.stringify({ action:'update_status', seriesId:id, status }) });
    toast.success('Series updated'); load();
  }

  async function deleteSeries(id: string, name: string) {
    if (!confirm(`Delete "${name}" and ALL its tickets? This cannot be undone.`)) return;
    const r = await authFetch('/api/admin/lottery', { method:'POST', body: JSON.stringify({ action:'delete_series', seriesId:id }) });
    if (r.ok) { toast.success('Series deleted'); load(); } else toast.error('Failed');
  }

  // ── Lottery Draw (Profit Guard) ──────────────────────────────────────────────

  async function openDrawPanel(series: any) {
    setDrawSeries(series);
    setDrawResult(null);
    setManualTicket('');
    setDrawLoading(true);
    try {
      const r = await authFetch(`/api/admin/lottery-draw?seriesId=${series.id}`);
      const d = await r.json();
      if (r.ok) setDrawInfo(d);
      else toast.error(d.error);
    } catch { toast.error('Failed to load draw info'); }
    setDrawLoading(false);
  }

  async function executeDraw(action: 'real_draw'|'force_dummy') {
    if (!drawSeries) return;
    setDrawLoading(true);
    try {
      const r = await authFetch('/api/admin/lottery-draw', {
        method: 'POST',
        body: JSON.stringify({ seriesId: drawSeries.id, action, forcedTicketCode: manualTicket || undefined }),
      });
      const d = await r.json();
      if (r.ok) {
        setDrawResult(d);
        toast.success(d.type === 'REAL' ? ` Winner: ${d.winner?.name} with ticket ${d.winnerTicket}!` : ` Dummy draw completed. Ticket: ${d.winnerTicket}`);
        load(); // refresh series list
      } else { toast.error(d.error); }
    } catch { toast.error('Draw failed'); }
    setDrawLoading(false);
  }

  // ── Matka actions ────────────────────────────────────────────────────────────
  async function declareResult() {
    if (!mResult.marketId || mResult.openPatti.length !== 3 || mResult.closePatti.length !== 3)
      return toast.error('Select market and enter 3-digit patties');
    setMLoading(true);
    const r = await authFetch('/api/admin/markets', { method:'POST', body: JSON.stringify({ action:'declare_result', ...mResult }) });
    const d = await r.json();
    if (r.ok) { toast.success(`✓ Result declared! Jodi: ${d.jodi} · Settled: ${d.settled} bets · Paid: ₹${d.totalPayout?.toLocaleString()}`); load(); setMResult({ marketId:'', openPatti:'', closePatti:'' }); }
    else toast.error(d.error);
    setMLoading(false);
  }

  async function toggleMarket(id: string) {
    await authFetch('/api/admin/markets', { method:'POST', body: JSON.stringify({ action:'toggle_market', marketId:id }) });
    toast.success('Market updated'); load();
  }

  async function createMarket() {
    if (!mForm.name) return toast.error('Market name required');
    setMLoading(true);
    const r = await authFetch('/api/admin/markets', { method:'POST', body: JSON.stringify({ action:'create_market', ...mForm }) });
    const d = await r.json();
    if (r.ok) { toast.success(`✓ Market "${mForm.name}" created!`); load(); setMForm({ name:'', openTime:'09:30', closeTime:'11:30', resultTime:'12:00' }); setMCreate(false); }
    else toast.error(d.error ?? 'Failed');
    setMLoading(false);
  }

  async function deleteMarket(id: string, name: string) {
    if (!confirm(`Delete "${name}"? All its bets and results will also be deleted.`)) return;
    const r = await authFetch('/api/admin/markets', { method:'POST', body: JSON.stringify({ action:'delete_market', marketId:id }) });
    if (r.ok) { toast.success('Market deleted'); load(); } else toast.error('Failed');
  }

  // ── Seed default markets ─────────────────────────────────────────────────────
  async function seedMarkets() {
    const r = await authFetch('/api/admin/seed-markets', { method:'POST' });
    const d = await r.json();
    if (r.ok) {
      const created = d.results.filter((x:any)=>x.status==='created').length;
      toast.success(created > 0 ? `✓ ${created} markets created!` : 'Markets already exist — refreshing...');
      load();
    } else toast.error(d.error);
  }

  // ── Spin segment CRUD ─────────────────────────────────────────────────────────
  async function addSegment() {
    if (!newSeg.label) return toast.error('Label required');
    const r = await authFetch('/api/admin/spin-segments', { method:'POST', body: JSON.stringify({ action:'add', ...newSeg }) });
    const d = await r.json();
    if (r.ok) {
      toast.success(`✓ "${newSeg.label}" added`);
      setNewSeg({ label:'', coins:'100', probability:'5', color:'#3498DB' });
      authFetch('/api/admin/spin-segments').then(r=>r.json()).then(d=>{ setSegments(d.rewards??[]); setSegTotal(d.totalProbability??0); });
    } else toast.error(d.error);
  }

  async function saveSegment() {
    if (!editSeg) return;
    const r = await authFetch('/api/admin/spin-segments', {
      method: 'POST',
      body: JSON.stringify({ action:'update', id:editSeg.id, label:editSeg.label, coins:editSeg.coins, probability:editSeg.probability, color:editSeg.color }),
    });
    const d = await r.json();
    if (r.ok) {
      toast.success('Segment updated');
      setEditSeg(null);
      authFetch('/api/admin/spin-segments').then(r=>r.json()).then(d=>{ setSegments(d.rewards??[]); setSegTotal(d.totalProbability??0); });
    } else toast.error(d.error ?? 'Failed');
  }

  async function deleteSegment(id:string, label:string) {
    if (!confirm(`Delete "${label}"?`)) return;
    const r = await authFetch('/api/admin/spin-segments', { method:'POST', body: JSON.stringify({ action:'delete', id }) });
    if (r.ok) {
      toast.success('Deleted'); setSegments(p=>p.filter(s=>s.id!==id));
      setSegTotal(p=>p - (segments.find(s=>s.id===id)?.probability??0));
    }
  }

  async function resetSegments() {
    if (!confirm('Reset to default 8 segments?')) return;
    const r = await authFetch('/api/admin/spin-segments', { method:'POST', body: JSON.stringify({ action:'reset_defaults' }) });
    if (r.ok) {
      toast.success('Reset to defaults');
      authFetch('/api/admin/spin-segments').then(r=>r.json()).then(d=>{ setSegments(d.rewards??[]); setSegTotal(d.totalProbability??0); });
    }
  }

  async function saveRates() {
    if (!editRates) return;
    setULoading(true);
    const r = await authFetch('/api/admin/markets', {
      method: 'POST',
      body: JSON.stringify({
        action: 'update_rates',
        marketId: editRates.id,
        payoutSingle:      Number(editRates.payoutSingle),
        payoutJodi:        Number(editRates.payoutJodi),
        payoutSP:          Number(editRates.payoutSP),
        payoutDP:          Number(editRates.payoutDP),
        payoutTP:          Number(editRates.payoutTP),
        payoutHalfSangam:  Number(editRates.payoutHalfSangam),
        payoutFullSangam:  Number(editRates.payoutFullSangam),
      }),
    });
    const d = await r.json();
    if (r.ok) { toast.success('Game rates updated!'); setEditRates(null); load(); }
    else toast.error(d.error ?? 'Failed');
    setULoading(false);
  }

  async function checkLiveResult(marketId: string, openPatti: string, closePatti: string) {
    if (!openPatti || openPatti.length < 3 || !closePatti || closePatti.length < 3) {
      setLiveCheck(null); return;
    }
    setCheckLoading(true);
    try {
      const r = await authFetch(`/api/admin/markets?check=1&marketId=${marketId}&openPatti=${openPatti}&closePatti=${closePatti}`);
      const d = await r.json();
      setLiveCheck(d);
    } catch { setLiveCheck(null); }
    setCheckLoading(false);
  }

  async function saveEditUpi() {
    if (!editUpi) return;
    setULoading(true);
    const r = await authFetch('/api/admin/upi', {
      method: 'PUT',
      body: JSON.stringify({ id:editUpi.id, upiId:editUpi.upiId, label:editUpi.label, transactionLimit:Number(editUpi.transactionLimit), priority:Number(editUpi.priority) }),
    });
    const d = await r.json();
    if (r.ok) { toast.success('UPI updated'); setEditUpi(null); load(); }
    else toast.error(d.error ?? 'Failed');
    setULoading(false);
  }

  // ── Payment verification ───────────────────────────────────────────────────────
  async function verifyPayment(txnId:string, action:'approve'|'reject') {
    const r = await authFetch('/api/payment/verify', { method:'PATCH', body: JSON.stringify({ txnId, action }) });
    const d = await r.json();
    if (r.ok) {
      toast.success(d.message);
      setPendingTxns(p=>p.filter(t=>t.id!==txnId));
    } else toast.error(d.error);
  }

  // ── Spin actions ─────────────────────────────────────────────────────────────
  async function saveSpinConfig() {
    setSLoading(true);
    const r = await authFetch('/api/admin/spin-config', { method:'POST', body: JSON.stringify(sForm) });
    const d = await r.json();
    if (r.ok) toast.success('✓ Spin config saved!'); else toast.error(d.error);
    setSLoading(false);
  }

  // ── UPI actions ──────────────────────────────────────────────────────────────
  async function addUpi() {
    if (!uForm.upiId || !uForm.label) return toast.error('UPI ID and label required');
    setULoading(true);
    const r = await authFetch('/api/admin/upi', { method:'POST', body: JSON.stringify({ upiId:uForm.upiId, label:uForm.label, transactionLimit:Number(uForm.limit), priority:Number(uForm.priority) }) });
    const d = await r.json();
    if (r.ok) { toast.success('✓ UPI added'); load(); setUForm({ upiId:'', label:'', limit:'100', priority:'0' }); }
    else toast.error(d.error);
    setULoading(false);
  }

  async function toggleUpi(id: string, isActive: boolean) {
    await authFetch('/api/admin/upi', { method:'PATCH', body: JSON.stringify({ id, isActive: !isActive }) });
    toast.success(isActive ? 'UPI paused' : 'UPI activated'); load();
  }

  async function deleteUpi(id: string) {
    if (!confirm('Remove this UPI?')) return;
    await authFetch(`/api/admin/upi?id=${id}`, { method:'DELETE' });
    toast.success('UPI removed'); load();
  }

  // ── Patti Ank preview ────────────────────────────────────────────────────────
  async function loadResults() {
    setResultsLoading(true);
    try {
      const r = await authFetch('/api/admin/results');
      const d = await r.json();
      if (r.ok) setResults(d);
      else toast.error(d.error ?? 'Failed to load results');
    } catch { toast.error('Failed to load results'); }
    setResultsLoading(false);
  }

    const ank = (patti: string) => patti.length === 3 ? patti.split('').reduce((s,d) => s+parseInt(d), 0) % 10 : '?';

  // ── Render ───────────────────────────────────────────────────────────────────

  if (status === 'loading') return (
    <>
      <Header />
      <Loader text="Loading Admin Panel..." />
    </>
  );

  // First-time setup screen
  if (status === 'setup') return (
    <>
      <Header />
      <div style={{ paddingTop:120, display:'flex', alignItems:'center', justifyContent:'center', minHeight:'80vh' }}>
        <div style={{ ...card, maxWidth:480, width:'100%', padding:40, textAlign:'center' }}>
          <div style={{ fontSize:56, marginBottom:16 }}></div>
          <h2 style={{ fontWeight:900, fontSize:26, marginBottom:12 }}>First-Time Admin Setup</h2>
          <p style={{ color:'var(--Secondary)', fontSize:14, marginBottom:24, lineHeight:1.7 }}>
            No admin exists yet. Click below to make your current account the <strong style={{ color:'#ffcb52' }}>Super Admin</strong>. This button disappears forever once an admin exists.
          </p>
          <button onClick={runSetup} disabled={setupLoading} style={{
            width:'100%', height:52, borderRadius:14, border:'none', cursor:'pointer',
            background:'linear-gradient(270deg,#fe8c45,#ca2826)',
            color:'#fff', fontWeight:900, fontSize:17, opacity:setupLoading?0.6:1
          }}>
            {setupLoading ? 'Setting up...' : 'Make Me Admin'}
          </button>
          <p style={{ fontSize:12, color:'var(--Secondary)', marginTop:16 }}>
            You will be logged out automatically and redirected to login.
          </p>
        </div>
      </div>
    </>
  );

  // Access denied
  if (status === 'denied') return (
    <>
      <Header />
      <div style={{ paddingTop:120, display:'flex', alignItems:'center', justifyContent:'center', minHeight:'80vh' }}>
        <div style={{ ...card, maxWidth:440, width:'100%', padding:40, textAlign:'center' }}>
          <div style={{ fontSize:56, marginBottom:16 }}></div>
          <h2 style={{ fontWeight:900, fontSize:24, marginBottom:8, color:'#ef4444' }}>Access Denied</h2>
          <p style={{ color:'var(--Secondary)', fontSize:14, marginBottom:24 }}>
            {!getToken() ? 'You are not logged in.' : 'Your account does not have admin permissions.'}
          </p>
          {!getToken()
            ? <Link href="/" className="tf-btn" style={{ height:46, fontSize:14, padding:'0 32px' }}>Go to Login</Link>
            : <button onClick={load} style={{ padding:'12px 32px', borderRadius:999, border:'none', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>Retry</button>
          }
        </div>
      </div>
    </>
  );

  // ── Full Admin Panel ──────────────────────────────────────────────────────────
  // ── Notification helpers ──────────────────────────────────────────────────
  async function createNotification() {
    if (!nForm.title || !nForm.message) return toast.error('Title and message required');
    setNLoading(true);
    const r = await authFetch('/api/admin/notifications', { method:'POST', body: JSON.stringify({ action:'create_notification', ...nForm }) });
    const d = await r.json();
    if (r.ok) { toast.success('Notification created'); setNForm({ title:'', message:'', type:'GENERAL', icon:'🔔', color:'#fe8c45', isPinned:false, expiresAt:'' }); load(); }
    else toast.error(d.error);
    setNLoading(false);
  }

  async function createFestival() {
    if (!fForm.name || !fForm.date) return toast.error('Name and date required');
    setNLoading(true);
    const r = await authFetch('/api/admin/notifications', { method:'POST', body: JSON.stringify({ action:'create_festival', ...fForm }) });
    const d = await r.json();
    if (r.ok) { toast.success(`Festival "${fForm.name}" created with notification!`); setFForm({ name:'', emoji:'🎉', date:'', gameType:'ALL', description:'', bonusMultiplier:'1.0' }); load(); }
    else toast.error(d.error);
    setNLoading(false);
  }

  async function createFestivalLottery(festivalId: string) {
    if (!flForm.name || !flForm.prefix || !flForm.drawAt) return toast.error('All fields required');
    setNLoading(true);
    const r = await authFetch('/api/admin/notifications', { method:'POST', body: JSON.stringify({ action:'create_festival_lottery', festivalId, ...flForm }) });
    const d = await r.json();
    if (r.ok) { toast.success(`Festival lottery created with ${d.ticketsGenerated} tickets!`); setShowFLottery(null); setFlForm({ name:'', prefix:'', ticketPrice:'10', prizePool:'100000', totalTickets:'1000', drawAt:'' }); load(); }
    else toast.error(d.error);
    setNLoading(false);
  }

  async function toggleNotif(id: string, action: string) {
    await authFetch('/api/admin/notifications', { method:'POST', body: JSON.stringify({ action, id }) });
    load();
  }

  // ── Upcoming Indian festivals (static calendar) ────────────────────────────
  const INDIAN_FESTIVALS = [
    { name:'Eid ul-Adha',      emoji:'🌙', date:'2025-06-07', gameType:'ALL' },
    { name:'Independence Day', emoji:'🇮🇳', date:'2025-08-15', gameType:'LOTTERY' },
    { name:'Raksha Bandhan',   emoji:'🪢', date:'2025-08-09', gameType:'SPIN' },
    { name:'Janmashtami',      emoji:'🦚', date:'2025-08-16', gameType:'ALL' },
    { name:'Onam',             emoji:'🌸', date:'2025-09-05', gameType:'ALL' },
    { name:'Navratri',         emoji:'💃', date:'2025-09-22', gameType:'SPIN' },
    { name:'Dussehra',         emoji:'🏹', date:'2025-10-02', gameType:'ALL' },
    { name:'Karva Chauth',     emoji:'🌕', date:'2025-10-10', gameType:'LOTTERY' },
    { name:'Dhanteras',        emoji:'💰', date:'2025-10-20', gameType:'ALL' },
    { name:'Diwali',           emoji:'🪔', date:'2025-10-21', gameType:'ALL' },
    { name:'Bhai Dooj',        emoji:'🤝', date:'2025-10-23', gameType:'SPIN' },
    { name:'Guru Nanak Jayanti', emoji:'🙏', date:'2025-11-05', gameType:'LOTTERY' },
    { name:'Christmas',        emoji:'🎄', date:'2025-12-25', gameType:'ALL' },
    { name:'New Year',         emoji:'🎆', date:'2026-01-01', gameType:'ALL' },
    { name:'Makar Sankranti',  emoji:'🪁', date:'2026-01-14', gameType:'SPIN' },
    { name:'Republic Day',     emoji:'🇮🇳', date:'2026-01-26', gameType:'LOTTERY' },
    { name:'Maha Shivratri',   emoji:'🔱', date:'2026-02-26', gameType:'ALL' },
    { name:'Holi',             emoji:'🎨', date:'2026-03-20', gameType:'ALL' },
    { name:'Eid ul-Fitr',      emoji:'🌙', date:'2026-03-21', gameType:'ALL' },
  ].filter(f => new Date(f.date) >= new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
   .slice(0, 12);

  return (
    <>
      <Header />
      <div style={{ paddingTop:80, minHeight:'100vh' }}>
        <div className="tf-container" style={{ paddingTop:16, paddingBottom:60 }}>

          {/* Title */}
          <div style={{ marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div>
              <h1 style={{ fontWeight:900, fontSize:30, marginBottom:2 }}>Admin Panel</h1>
              <p style={{ color:'var(--Secondary)', fontSize:13 }}>Supreme Gaming Engine </p>
            </div>
            <button onClick={load} style={{ padding:'8px 18px', borderRadius:999, border:'1px solid var(--Border)', background:'var(--Bg-2)', color:'var(--Secondary)', fontSize:13, cursor:'pointer', fontWeight:600 }}>
              Refresh
            </button>
          </div>

          {/* Tab Nav */}
          <div style={{ display:'flex', gap:5, background:'var(--Bg-2)', borderRadius:14, padding:4, marginBottom:24, flexWrap:'wrap', border:'1px solid var(--Border)' }}>
            {TABS.map(t => {
              const TAB_ICONS: Record<string,any> = {
                overview:LayoutDashboard, lottery:Ticket, matka:Dices,
                spin:RotateCcw, upi:Wallet, users:Users, payments:CreditCard, notifications:Bell
              };
              const TIcon = TAB_ICONS[t.key];
              return (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'10px 18px', borderRadius:11, border:'none', cursor:'pointer', fontWeight:700, fontSize:13,
                  background: tab===t.key ? 'linear-gradient(270deg,#fe8c45,#ca2826)' : 'transparent',
                  color: tab===t.key ? '#fff' : 'var(--Secondary)', transition:'all 0.15s'
                }}>
                  {TIcon && <TIcon size={14}/>} {t.label}
                </button>
              );
            })}
          </div>

          {/* ── OVERVIEW ── */}
          {tab==='overview' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:20 }} className='stat-grid'>
                {[
                  { label:'Lottery Series', value: data.series.length,                            Icon:Ticket,         color:'#3498DB', sub: data.series.filter((s:any)=>s.status==='OPEN').length+' open' },
                  { label:'Matka Markets',  value: data.markets.length,                           Icon:Dices,          color:'#9B59B6', sub: data.markets.filter((m:any)=>m.isOpen).length+' open' },
                  { label:'Active UPIs',    value: data.upis.filter((u:any)=>u.isActive).length,  Icon:Wallet,         color:'#2ECC71', sub: data.upis.length+' total' },
                  { label:'Spin Config',    value: data.spinConfig ? 'Active' : 'Not set',        Icon:RotateCcw,      color: data.spinConfig?'#2ECC71':'#E74C3C', sub: data.spinConfig ? `₹${data.spinConfig.pricePerSpin ?? 10}/spin` : 'Go to Spin tab' },
                ].map(s=>(
                  <div key={s.label} style={{ ...card, padding:'18px 20px' }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:`${s.color}18`, border:`1px solid ${s.color}40`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                      <s.Icon size={20} color={s.color}/>
                    </div>
                    <div style={{ fontWeight:900, fontSize:22, color:s.color, marginBottom:2 }}>{s.value}</div>
                    <div style={{ fontSize:11, color:'var(--Secondary)', textTransform:'uppercase', fontWeight:700, marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Quick status */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div style={{ ...card, padding:20 }}>
                  <h4 style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>Lottery Series</h4>
                  {data.series.length===0 ? <p style={{ color:'var(--Secondary)', fontSize:13 }}>No series yet — go to Lottery tab</p> :
                    data.series.slice(0,5).map((s:any) => (
                      <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:13 }}>
                        <div><span style={{ fontWeight:700 }}>{s.name}</span> <span style={{ color:'var(--Secondary)', fontSize:11 }}>({s.prefix})</span></div>
                        <span style={{ padding:'1px 10px', borderRadius:999, fontSize:10, fontWeight:700,
                          background:s.status==='OPEN'?'rgba(46,204,113,0.15)':'rgba(100,100,100,0.2)',
                          color:s.status==='OPEN'?'#2ECC71':'var(--Secondary)'}}>{s.status}</span>
                      </div>
                    ))
                  }
                </div>
                <div style={{ ...card, padding:20 }}>
                  <h4 style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>Matka Markets</h4>
                  {data.markets.length===0 ? <p style={{ color:'var(--Secondary)', fontSize:13 }}>No markets — go to Matka tab</p> :
                    data.markets.map((m:any) => (
                      <div key={m.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:13 }}>
                        <div><span style={{ fontWeight:700 }}>{m.name}</span> <span style={{ color:'var(--Secondary)', fontSize:11 }}>{m._count?.bets??0} bets</span></div>
                        <span style={{ padding:'1px 10px', borderRadius:999, fontSize:10, fontWeight:700,
                          background:m.isOpen?'rgba(254,140,69,0.15)':'rgba(100,100,100,0.2)',
                          color:m.isOpen?'#fe8c45':'var(--Secondary)'}}>{m.isOpen?'OPEN':'CLOSED'}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── LOTTERY ── */}
          {tab==='lottery' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:20, alignItems:'start' }}>
              {/* Existing series */}
              <div style={card}>
                <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--Border)', background:'rgba(0,0,0,0.15)' }}>
                  <h3 style={{ fontWeight:900, fontSize:19 }}>Lottery Series</h3>
                  <p style={{ color:'var(--Secondary)', fontSize:12, marginTop:4 }}>All lottery series and ticket pools</p>
                </div>
                {data.series.length===0 ? (
                  <div style={{ padding:'60px 20px', textAlign:'center', color:'var(--Secondary)' }}>
                    <div style={{ fontSize:40, marginBottom:12 }}></div>
                    No series yet. Create one →
                  </div>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr style={{ background:'rgba(0,0,0,0.2)' }}>
                      {['Name','Prefix','Price','Prize Pool','Tickets','Draw Date','Status','Actions'].map(h=>(
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--Secondary)', textTransform:'uppercase' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {data.series.map((s:any)=>(
                        <tr key={s.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding:'12px 14px', fontWeight:700, fontSize:13 }}>{s.name}</td>
                          <td style={{ padding:'12px 14px', fontFamily:'monospace', fontWeight:700, color:'#ffcb52' }}>{s.prefix}</td>
                          <td style={{ padding:'12px 14px', fontSize:13 }}>₹{s.ticketPrice}</td>
                          <td style={{ padding:'12px 14px', fontSize:13 }}>₹{(s.prizePool/100000).toFixed(1)}L</td>
                          <td style={{ padding:'12px 14px', fontSize:13 }}>{s._count?.tickets??0}</td>
                          <td style={{ padding:'12px 14px', fontSize:12, color:'var(--Secondary)' }}>{new Date(s.drawAt).toLocaleDateString('en-IN')}</td>
                          <td style={{ padding:'12px 14px' }}>
                            <span style={{ padding:'2px 10px', borderRadius:999, fontSize:10, fontWeight:700,
                              background:s.status==='OPEN'?'rgba(46,204,113,0.15)':'rgba(100,100,100,0.2)',
                              color:s.status==='OPEN'?'#2ECC71':'var(--Secondary)'}}>{s.status}</span>
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                              {s.status !== 'DRAWN' && (
                                <button onClick={()=>openDrawPanel(s)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,203,82,0.4)', background:'rgba(255,203,82,0.1)', color:'#ffcb52', fontSize:11, cursor:'pointer', fontWeight:700 }}>
                                   Draw
                                </button>
                              )}
                              {s.status === 'DRAWN' && (
                                <span style={{ padding:'2px 10px', borderRadius:999, fontSize:10, fontWeight:700, background:'rgba(46,204,113,0.15)', color:'#2ECC71' }}>
                                  ✓ {s.winnerTicket ?? 'Drawn'}
                                </span>
                              )}
                              <button onClick={()=>updateSeriesStatus(s.id, s.status==='OPEN'?'CLOSED':'OPEN')} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--Border)', background:'transparent', color:'var(--Secondary)', fontSize:11, cursor:'pointer' }}>
                                {s.status==='OPEN'?'Close':'Open'}
                              </button>
                              <button onClick={()=>deleteSeries(s.id, s.name)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)', color:'#ef4444', fontSize:11, cursor:'pointer' }}>Del</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Create series form */}
              <div style={{ ...card, padding:22 }}>
                <h4 style={{ fontWeight:900, fontSize:17, marginBottom:18 }}>Create New Series</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div><label style={label}>Series Name</label><input placeholder="e.g. Mega Jackpot III" value={lForm.name} onChange={e=>setLForm({...lForm,name:e.target.value})} style={inp}/></div>
                  <div><label style={label}>Prefix (2–3 letters)</label><input placeholder="e.g. MJ" maxLength={3} value={lForm.prefix} onChange={e=>setLForm({...lForm,prefix:e.target.value.toUpperCase()})} style={{...inp,fontFamily:'monospace',fontWeight:700,fontSize:18,textAlign:'center',letterSpacing:4}}/></div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div><label style={label}>Ticket Price (₹)</label><input type="number" value={lForm.ticketPrice} onChange={e=>setLForm({...lForm,ticketPrice:e.target.value})} style={inp}/></div>
                    <div><label style={label}>Total Tickets</label><input type="number" value={lForm.totalTickets} onChange={e=>setLForm({...lForm,totalTickets:e.target.value})} style={inp}/></div>
                  </div>
                  <div><label style={label}>Prize Pool (₹)</label><input type="number" value={lForm.prizePool} onChange={e=>setLForm({...lForm,prizePool:e.target.value})} style={inp}/></div>
                  <div><label style={label}>Draw Date</label><input type="date" value={lForm.drawAt} onChange={e=>setLForm({...lForm,drawAt:e.target.value})} style={inp}/></div>

                  <div style={{ background:'rgba(255,203,82,0.08)', border:'1px solid rgba(255,203,82,0.2)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'var(--Secondary)' }}>
                     Creating <strong style={{ color:'#fff' }}>{lForm.totalTickets||'?'}</strong> tickets ({lForm.prefix||'XX'}0001 → {lForm.prefix||'XX'}{String(parseInt(lForm.totalTickets)||9999).padStart(4,'0')}) at <strong style={{ color:'#fff' }}>₹{lForm.ticketPrice||'?'}</strong> each
                  </div>

                  <button onClick={createSeries} disabled={lLoading} style={{ width:'100%', height:48, borderRadius:12, border:'none', cursor:lLoading?'not-allowed':'pointer', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:900, fontSize:15, opacity:lLoading?0.6:1 }}>
                    {lLoading ? ' Creating tickets...' : 'Create Series & Generate Tickets'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── DRAW WINNER MODAL ── */}
          {drawSeries && (
            <div style={{position:'fixed',inset:0,zIndex:99999,background:'rgba(0,0,0,0.9)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
              onClick={()=>{if(!drawLoading){setDrawSeries(null);setDrawInfo(null);setDrawResult(null);}}}>
              <div style={{background:'var(--Bg-2)',borderRadius:20,width:'100%',maxWidth:560,border:'1px solid var(--Border)',overflow:'hidden'}}
                onClick={e=>e.stopPropagation()}>

                {/* Modal Header */}
                <div style={{padding:'20px 24px',borderBottom:'1px solid var(--Border)',background:'rgba(0,0,0,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <h3 style={{fontWeight:900,fontSize:20}}>Draw Winner — {drawSeries.name}</h3>
                    <p style={{color:'var(--Secondary)',fontSize:13,marginTop:4}}>Prefix: {drawSeries.prefix} · Prize Pool: ₹{drawSeries.prizePool?.toLocaleString()}</p>
                  </div>
                  <button onClick={()=>{setDrawSeries(null);setDrawInfo(null);setDrawResult(null);}} style={{background:'none',border:'none',color:'var(--Secondary)',fontSize:22,cursor:'pointer',lineHeight:1}}>×</button>
                </div>

                <div style={{padding:24}}>
                  {drawLoading && !drawInfo ? (
                    <div style={{textAlign:'center',padding:'40px 0',color:'var(--Secondary)'}}> Loading draw info...</div>
                  ) : drawResult ? (
                    /* ── Result Screen ── */
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:60,marginBottom:16}}>{drawResult.type==='REAL'?'':''}</div>
                      <h3 style={{fontWeight:900,fontSize:24,marginBottom:8,color:drawResult.type==='REAL'?'#ffcb52':'var(--Secondary)'}}>
                        {drawResult.type==='REAL'?'Real Winner Declared!':'Dummy Draw Complete'}
                      </h3>
                      <div style={{background:'var(--Bg-3)',borderRadius:14,padding:'16px 20px',marginBottom:16,textAlign:'left'}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:14}}>
                          <span style={{color:'var(--Secondary)'}}>Winning Ticket</span>
                          <span style={{fontFamily:'monospace',fontWeight:900,fontSize:18,color:'#ffcb52'}}>{drawResult.winnerTicket}</span>
                        </div>
                        {drawResult.type==='REAL' && <>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:14}}>
                            <span style={{color:'var(--Secondary)'}}>Winner Name</span>
                            <span style={{fontWeight:700}}>{drawResult.winner?.name}</span>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:14}}>
                            <span style={{color:'var(--Secondary)'}}>Winner Email</span>
                            <span style={{fontWeight:600,fontSize:13}}>{drawResult.winner?.email}</span>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:14}}>
                            <span style={{color:'var(--Secondary)'}}>Prize Awarded</span>
                            <span style={{fontWeight:900,color:'#2ECC71'}}>₹{drawResult.prizeAwarded?.toLocaleString()} Coins</span>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:14}}>
                            <span style={{color:'var(--Secondary)'}}>Your Profit</span>
                            <span style={{fontWeight:900,color:'#ffcb52'}}>₹{drawResult.adminProfit?.toLocaleString()} Coins </span>
                          </div>
                        </>}
                        {drawResult.type==='DUMMY' && <>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:14}}>
                            <span style={{color:'var(--Secondary)'}}>Reason</span>
                            <span style={{fontWeight:600,fontSize:12,maxWidth:200,textAlign:'right'}}>{drawResult.reason}</span>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:14}}>
                            <span style={{color:'var(--Secondary)'}}>Revenue collected</span>
                            <span style={{fontWeight:700}}>₹{drawResult.totalRevenue?.toLocaleString()}</span>
                          </div>
                        </>}
                      </div>
                      <button onClick={()=>{setDrawSeries(null);setDrawInfo(null);setDrawResult(null);}} className="tf-btn" style={{width:'100%',justifyContent:'center',height:46,fontSize:14}}>
                        Close
                      </button>
                    </div>
                  ) : drawInfo ? (
                    /* ── Eligibility Panel ── */
                    <div>
                      {/* Revenue vs Required */}
                      <div style={{background:drawInfo.isSafe?'rgba(46,204,113,0.08)':'rgba(239,68,68,0.08)',border:`1px solid ${drawInfo.isSafe?'rgba(46,204,113,0.3)':'rgba(239,68,68,0.3)'}`,borderRadius:14,padding:'16px 20px',marginBottom:20}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                          <span style={{fontWeight:900,fontSize:16}}>{drawInfo.isSafe?'✓ Safe to Draw':'! Revenue Insufficient'}</span>
                          <span style={{fontSize:12,fontWeight:700,padding:'3px 12px',borderRadius:999,background:drawInfo.isSafe?'rgba(46,204,113,0.2)':'rgba(239,68,68,0.2)',color:drawInfo.isSafe?'#2ECC71':'#ef4444'}}>
                            {drawInfo.isSafe?'PROFIT':'LOSS RISK'}
                          </span>
                        </div>
                        {[
                          ['Tickets Sold', `${drawInfo.soldCount} / ${drawInfo.totalTickets}`,'#fff'],
                          ['Revenue Collected', `₹${drawInfo.totalRevenue?.toLocaleString()}`,'#ffcb52'],
                          ['Prize Pool', `₹${drawInfo.prizePool?.toLocaleString()}`,'#ef4444'],
                          [`Required (Prize + ${drawInfo.commissionPercent}% commission)`, `₹${drawInfo.commissionNeeded?.toLocaleString()}`,'var(--Secondary)'],
                          drawInfo.isSafe
                            ? ['Your Profit', `₹${drawInfo.adminProfit?.toLocaleString()} `,'#2ECC71']
                            : ['Shortfall', `₹${drawInfo.shortfall?.toLocaleString()} short`,'#ef4444'],
                        ].map(([label,value,color])=>(
                          <div key={String(label)} style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:13}}>
                            <span style={{color:'var(--Secondary)'}}>{label}</span>
                            <span style={{fontWeight:700,color:String(color)}}>{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Manual ticket override (only for real draw) */}
                      {drawInfo.isSafe && (
                        <div style={{marginBottom:16}}>
                          <label style={{fontSize:12,fontWeight:700,color:'var(--Secondary)',display:'block',marginBottom:6,textTransform:'uppercase'}}>
                            Manual Winner Ticket (optional)
                          </label>
                          <input placeholder={`Leave blank for random · or enter e.g. ${drawInfo.series?.prefix}4521`}
                            value={manualTicket} onChange={e=>setManualTicket(e.target.value.toUpperCase())}
                            style={{width:'100%',padding:'11px 14px',borderRadius:10,background:'var(--Bg-3)',border:'1px solid var(--Border-2)',color:'var(--White)',fontFamily:'monospace',fontWeight:700,fontSize:15,outline:'none'}}/>
                          <p style={{fontSize:11,color:'var(--Secondary)',marginTop:4}}>Leave blank = system picks random sold ticket</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{display:'flex',flexDirection:'column',gap:10}}>

                        {/* Real Draw — only when safe */}
                        {drawInfo.isSafe && (
                          <button onClick={()=>executeDraw('real_draw')} disabled={drawLoading} style={{width:'100%',height:52,borderRadius:13,border:'none',cursor:'pointer',fontWeight:900,fontSize:16,background:'linear-gradient(270deg,#2ECC71,#16a34a)',color:'#fff',opacity:drawLoading?0.6:1}}>
                            {drawLoading?' Drawing...':'Real Draw — Pick Random Winner'}
                          </button>
                        )}

                        {/* Force Dummy — always available */}
                        <button onClick={()=>executeDraw('force_dummy')} disabled={drawLoading} style={{width:'100%',height:52,borderRadius:13,border:`2px solid rgba(148,163,184,0.3)`,cursor:'pointer',fontWeight:900,fontSize:15,background:'rgba(148,163,184,0.08)',color:'var(--Secondary)',opacity:drawLoading?0.6:1}}>
                          {drawLoading?' Processing...':'Force Dummy — Assign Prize to House Account'}
                        </button>

                        {/* Auto info when not safe */}
                        {!drawInfo.isSafe && (
                          <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10,padding:'12px 16px',fontSize:12,color:'#ef4444',textAlign:'center'}}>
                            ! Real Draw is disabled. Revenue is ₹{drawInfo.shortfall?.toLocaleString()} short of the required amount.<br/>
                            <span style={{color:'var(--Secondary)',marginTop:4,display:'block'}}>Only Dummy Draw is available to protect from loss.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* ── MATKA ── */}
          {tab==='matka' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:20, alignItems:'start' }}>

              {/* Markets list */}
              <div style={card}>
                <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--Border)', background:'rgba(0,0,0,0.15)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <h3 style={{ fontWeight:900, fontSize:19 }}>Matka Markets</h3>
                    <p style={{ color:'var(--Secondary)', fontSize:12, marginTop:4 }}>Manage markets · Toggle open/closed · View bets</p>
                  </div>
                  <button onClick={()=>setMCreate(v=>!v)} style={{ padding:'8px 16px', borderRadius:999, border:'none', cursor:'pointer', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:700, fontSize:13 }}>
                    {mCreate ? '× Cancel' : '+ Add Market'}
                  </button>
                </div>

                {/* Create market inline form */}
                {mCreate && (
                  <div style={{ padding:'20px', borderBottom:'1px solid var(--Border)', background:'rgba(254,140,69,0.04)' }}>
                    <h4 style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>+ Create New Market</h4>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                      <div style={{ gridColumn:'1/-1' }}>
                        <label style={label}>Market Name</label>
                        <input placeholder="e.g. Milan Day" value={mForm.name} onChange={e=>setMForm({...mForm,name:e.target.value})} style={inp}/>
                      </div>
                      <div><label style={label}>Open Time</label><input type="time" value={mForm.openTime} onChange={e=>setMForm({...mForm,openTime:e.target.value})} style={inp}/></div>
                      <div><label style={label}>Close Time</label><input type="time" value={mForm.closeTime} onChange={e=>setMForm({...mForm,closeTime:e.target.value})} style={inp}/></div>
                      <div><label style={label}>Result Time</label><input type="time" value={mForm.resultTime} onChange={e=>setMForm({...mForm,resultTime:e.target.value})} style={inp}/></div>
                    </div>
                    <button onClick={createMarket} disabled={mLoading} style={{ width:'100%', height:44, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:700, fontSize:14, opacity:mLoading?0.6:1 }}>
                      {mLoading?'Creating...':'✓ Create Market'}
                    </button>
                  </div>
                )}

                {data.markets.length===0 ? (
                  <div style={{ padding:'60px 20px', textAlign:'center', color:'var(--Secondary)' }}>
                    <div style={{ fontSize:40, marginBottom:12 }}></div>
                    <p style={{ marginBottom:12 }}>No markets yet.</p>
                    <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                    <button onClick={seedMarkets} style={{ padding:'10px 24px', borderRadius:999, border:'none', cursor:'pointer', background:'linear-gradient(270deg,#2ECC71,#16a34a)', color:'#fff', fontWeight:700, fontSize:14 }}>
                      Seed Default Markets
                    </button>
                    <button onClick={()=>setMCreate(true)} style={{ padding:'10px 24px', borderRadius:999, border:'none', cursor:'pointer', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:700, fontSize:14 }}>
                      + Custom Market
                    </button>
                  </div>
                  </div>
                ) : data.markets.map((m:any) => (
                  <div key={m.id} style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <div>
                        <h4 style={{ fontWeight:700, fontSize:16 }}>{m.name}</h4>
                        <p style={{ fontSize:11, color:'var(--Secondary)', marginTop:2 }}>● {m.openTime} → ● {m.closeTime} →  {m.resultTime}</p>
                      </div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:999,
                          background:m.isOpen?'rgba(254,140,69,0.15)':'rgba(100,100,100,0.2)',
                          color:m.isOpen?'#fe8c45':'var(--Secondary)'}}>{m.isOpen?'OPEN':'CLOSED'}</span>
                        <button onClick={()=>toggleMarket(m.id)} style={{ padding:'5px 12px', borderRadius:8, border:'1px solid var(--Border)', background:'var(--Bg-3)', color:'var(--Secondary)', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                          {m.isOpen?'Close':'Open'}
                        </button>
                        <button onClick={()=>deleteMarket(m.id,m.name)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)', color:'#ef4444', fontSize:12, cursor:'pointer' }}>Del</button>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:20, fontSize:12, color:'var(--Secondary)' }}>
                      <span> {m._count?.bets??0} bets</span>
                      {m.results?.[0] && <span>Last result: <strong style={{ color:'#ffcb52', fontFamily:'monospace' }}>{m.results[0].jodi}</strong></span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Declare Result */}
              <div style={{ ...card, padding:22 }}>
                <h4 style={{ fontWeight:900, fontSize:17, marginBottom:6 }}>Declare Result</h4>
                <p style={{ color:'var(--Secondary)', fontSize:12, marginBottom:18 }}>All pending bets are settled instantly</p>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div>
                    <label style={label}>Select Market</label>
                    <select value={mResult.marketId} onChange={e=>setMResult({...mResult,marketId:e.target.value})} style={{...inp,appearance:'none'}}>
                      <option value="">— Select market —</option>
                      {data.markets.map((m:any)=><option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={label}>Open Patti</label>
                      <input placeholder="e.g. 123" maxLength={3} value={mResult.openPatti} onChange={e=>setMResult({...mResult,openPatti:e.target.value.replace(/\D/g,'')})} style={{...inp,fontFamily:'monospace',fontSize:22,textAlign:'center',fontWeight:900}}/>
                    </div>
                    <div>
                      <label style={label}>Close Patti</label>
                      <input placeholder="e.g. 456" maxLength={3} value={mResult.closePatti} onChange={e=>setMResult({...mResult,closePatti:e.target.value.replace(/\D/g,'')})} style={{...inp,fontFamily:'monospace',fontSize:22,textAlign:'center',fontWeight:900}}/>
                    </div>
                  </div>

                  {/* Live preview */}
                  {mResult.openPatti.length===3 && mResult.closePatti.length===3 && (
                    <div style={{ background:'rgba(255,203,82,0.08)', border:'1px solid rgba(255,203,82,0.25)', borderRadius:10, padding:'12px 16px' }}>
                      {[['Open',mResult.openPatti],['Close',mResult.closePatti]].map(([s,p])=>(
                        <div key={s} style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:13 }}>
                          <span style={{ color:'var(--Secondary)' }}>{s} Ank</span>
                          <span style={{ fontFamily:'monospace', fontWeight:700, color:'#ffcb52' }}>{p} → {ank(p as string)}</span>
                        </div>
                      ))}
                      <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.08)', marginTop:4 }}>
                        <span style={{ color:'var(--Secondary)', fontSize:13 }}>Jodi</span>
                        <span style={{ fontFamily:'monospace', fontWeight:900, fontSize:24, color:'#ffcb52' }}>{ank(mResult.openPatti)}{ank(mResult.closePatti)}</span>
                      </div>
                    </div>
                  )}

                  <button onClick={declareResult} disabled={mLoading} style={{ width:'100%', height:50, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:900, fontSize:15, opacity:mLoading?0.6:1 }}>
                    {mLoading ? ' Settling bets...' : 'Declare Result & Settle All Bets'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── SPIN WHEEL ── */}
          {tab==='spin' && (
            <div style={{ display:'grid', gridTemplateColumns:'380px 1fr', gap:20, alignItems:'start' }}>

              {/* Config */}
              <div style={{ ...card, padding:22 }}>
                <h3 style={{ fontWeight:900, fontSize:18, marginBottom:6 }}>Spin Config</h3>
                <p style={{ color:'var(--Secondary)', fontSize:12, marginBottom:18 }}>Cost per spin and free spin interval</p>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div>
                    <label style={label}>Cost Per Spin (Coins)</label>
                    <input type="number" min={1} value={sForm.costPerSpin} onChange={e=>setSForm({...sForm,costPerSpin:e.target.value})} style={inp}/>
                    <p style={{ fontSize:11, color:'var(--Secondary)', marginTop:4 }}>1 Coin = ₹1 INR</p>
                  </div>
                  <div>
                    <label style={label}>Free Spin Every N Spins</label>
                    <input type="number" min={2} value={sForm.freeSpinInterval} onChange={e=>setSForm({...sForm,freeSpinInterval:e.target.value})} style={inp}/>
                  </div>
                  <div style={{ background:'rgba(255,203,82,0.08)', border:'1px solid rgba(255,203,82,0.2)', borderRadius:10, padding:'12px 14px', fontSize:13 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:'var(--Secondary)' }}>Cost per spin</span><span style={{ fontWeight:700 }}>₹{sForm.costPerSpin}</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--Secondary)' }}>Free spin</span><span style={{ fontWeight:700, color:'#2ECC71' }}>Every {sForm.freeSpinInterval}th</span></div>
                  </div>
                  <button onClick={saveSpinConfig} disabled={sLoading} style={{ width:'100%', height:46, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:900, fontSize:14, opacity:sLoading?0.6:1 }}>
                    {sLoading?' Saving...':'Save Config'}
                  </button>
                </div>

                {/* Add new segment */}
                <div style={{ marginTop:20, paddingTop:20, borderTop:'1px solid var(--Border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <h4 style={{ fontWeight:700, fontSize:15 }}>+ Add Segment</h4>
                    <div style={{ fontSize:12, fontWeight:700, padding:'2px 10px', borderRadius:999,
                      background: segTotal===100?'rgba(46,204,113,0.15)': segTotal>100?'rgba(239,68,68,0.15)':'rgba(255,203,82,0.15)',
                      color: segTotal===100?'#2ECC71': segTotal>100?'#ef4444':'#ffcb52'
                    }}>Total: {segTotal}%</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <div><label style={label}>Label</label><input placeholder="₹500" value={newSeg.label} onChange={e=>setNewSeg({...newSeg,label:e.target.value})} style={inp}/></div>
                      <div><label style={label}>Coins Won</label><input type="number" placeholder="500" value={newSeg.coins} onChange={e=>setNewSeg({...newSeg,coins:e.target.value})} style={inp}/></div>
                      <div><label style={label}>Probability %</label><input type="number" placeholder="10" value={newSeg.probability} onChange={e=>setNewSeg({...newSeg,probability:e.target.value})} style={inp}/></div>
                      <div><label style={label}>Color</label>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <input type="color" value={newSeg.color} onChange={e=>setNewSeg({...newSeg,color:e.target.value})} style={{ width:46, height:36, borderRadius:8, border:'1px solid var(--Border)', cursor:'pointer', padding:2, background:'var(--Bg-3)' }}/>
                          <input value={newSeg.color} onChange={e=>setNewSeg({...newSeg,color:e.target.value})} style={{...inp, fontFamily:'monospace', fontSize:12}}/>
                        </div>
                      </div>
                    </div>
                    <button onClick={addSegment} disabled={segTotal>=100} style={{ width:'100%', height:40, borderRadius:10, border:'none', cursor:segTotal>=100?'not-allowed':'pointer', background:segTotal>=100?'var(--Bg-3)':'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:700, fontSize:13, opacity:segTotal>=100?0.5:1 }}>
                      {segTotal>=100?'Total is 100% — delete a segment first':'+ Add Segment'}
                    </button>
                    <button onClick={resetSegments} style={{ width:'100%', height:36, borderRadius:10, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.06)', color:'#ef4444', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                      Reset to Defaults
                    </button>
                  </div>
                </div>
              </div>

              {/* Editable segments list */}
              <div style={card}>
                <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--Border)', background:'rgba(0,0,0,0.15)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <h4 style={{ fontWeight:700, fontSize:16 }}>Wheel Segments</h4>
                    <p style={{ color:'var(--Secondary)', fontSize:12, marginTop:4 }}>Edit label, coins won, probability % and color</p>
                  </div>
                  <div style={{ fontSize:13, color:'var(--Secondary)' }}>{segments.length} segments · <span style={{ color: segTotal===100?'#2ECC71':'#ffcb52' }}>{segTotal}% total</span></div>
                </div>

                {segments.length===0 ? (
                  <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--Secondary)' }}>
                    <div style={{ fontSize:36, marginBottom:8 }}></div>
                    No segments yet. Add one or reset to defaults.
                  </div>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr style={{ background:'rgba(0,0,0,0.2)' }}>
                      {['Color','Label','Coins Won','Probability','Actions'].map(h=>(
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--Secondary)', textTransform:'uppercase' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {segments.map((s:any)=>(
                        <React.Fragment key={s.id}>
                        <tr style={{ borderBottom: editSeg?.id===s.id?'none':'1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ width:20, height:20, borderRadius:'50%', background:s.color, border:'2px solid rgba(255,255,255,0.2)', cursor:'pointer' }}
                              onClick={()=>setEditSeg(editSeg?.id===s.id?null:{...s})}/>
                          </td>
                          <td style={{ padding:'12px 14px', fontWeight:700, fontSize:14 }}>{s.label}</td>
                          <td style={{ padding:'12px 14px' }}>
                            <span style={{ color:'#2ECC71', fontWeight:700 }}>{s.coins > 0 ? `+${s.coins.toLocaleString()}` : '—'}</span>
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ height:6, width:80, background:'var(--Bg-3)', borderRadius:999, overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${Math.min(s.probability,100)}%`, background:s.color, borderRadius:999 }}/>
                              </div>
                              <span style={{ fontWeight:700, fontSize:13 }}>{s.probability}%</span>
                            </div>
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ display:'flex', gap:6 }}>
                              <button onClick={()=>setEditSeg(editSeg?.id===s.id?null:{...s})} style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${editSeg?.id===s.id?'#fe8c45':'var(--Border)'}`, background:editSeg?.id===s.id?'rgba(254,140,69,0.1)':'transparent', color:editSeg?.id===s.id?'#fe8c45':'var(--Secondary)', fontSize:11, cursor:'pointer' }}>
                                {editSeg?.id===s.id?'Cancel':'Edit'}
                              </button>
                              <button onClick={()=>deleteSegment(s.id,s.label)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)', color:'#ef4444', fontSize:11, cursor:'pointer' }}>Del</button>
                            </div>
                          </td>
                        </tr>
                        {editSeg?.id===s.id && (
                          <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                            <td colSpan={5} style={{ padding:'12px 16px', background:'rgba(254,140,69,0.04)', borderTop:'1px dashed rgba(254,140,69,0.2)' }}>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr auto', gap:10, alignItems:'end' }}>
                                <div>
                                  <label style={{ fontSize:10, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:4 }}>Label</label>
                                  <input value={editSeg.label} onChange={e=>setEditSeg({...editSeg,label:e.target.value})} style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'var(--Bg-3)', border:'1px solid var(--Border-2)', color:'#fff', fontSize:13, outline:'none' }}/>
                                </div>
                                <div>
                                  <label style={{ fontSize:10, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:4 }}>Coins Won</label>
                                  <input type="number" value={editSeg.coins} onChange={e=>setEditSeg({...editSeg,coins:e.target.value})} style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'var(--Bg-3)', border:'1px solid var(--Border-2)', color:'#fff', fontSize:13, outline:'none' }}/>
                                </div>
                                <div>
                                  <label style={{ fontSize:10, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:4 }}>Probability %</label>
                                  <input type="number" min={1} max={100} value={editSeg.probability} onChange={e=>setEditSeg({...editSeg,probability:Number(e.target.value)})} style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'var(--Bg-3)', border:'1px solid var(--Border-2)', color:'#fff', fontSize:13, outline:'none' }}/>
                                </div>
                                <div>
                                  <label style={{ fontSize:10, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:4 }}>Color</label>
                                  <div style={{ display:'flex', gap:6 }}>
                                    <input type="color" value={editSeg.color} onChange={e=>setEditSeg({...editSeg,color:e.target.value})} style={{ width:36, height:34, borderRadius:6, border:'1px solid var(--Border)', cursor:'pointer', padding:2, background:'var(--Bg-3)' }}/>
                                    <input value={editSeg.color} onChange={e=>setEditSeg({...editSeg,color:e.target.value})} style={{ flex:1, padding:'8px 8px', borderRadius:8, background:'var(--Bg-3)', border:'1px solid var(--Border-2)', color:'#fff', fontSize:11, fontFamily:'monospace', outline:'none' }}/>
                                  </div>
                                </div>
                                <button onClick={saveSegment} style={{ height:36, padding:'0 18px', borderRadius:8, border:'none', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                                  Save
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                )}

                {segTotal!==100 && segments.length>0 && (
                  <div style={{ padding:'12px 20px', background:'rgba(255,203,82,0.06)', borderTop:'1px solid rgba(255,203,82,0.2)', fontSize:12, color:'#ffcb52' }}>
                    ! Probabilities total {segTotal}% — must equal exactly 100% for fair wheel
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── UPI POOL ── */}
          {tab==='upi' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:20, alignItems:'start' }}>
              <div style={card}>
                <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--Border)', background:'rgba(0,0,0,0.15)' }}>
                  <h3 style={{ fontWeight:900, fontSize:19 }}>UPI Pool</h3>
                  <p style={{ color:'var(--Secondary)', fontSize:12, marginTop:4 }}>Auto-rotates when transaction limit is reached</p>
                </div>
                {data.upis.length===0 ? (
                  <div style={{ padding:'60px 20px', textAlign:'center', color:'var(--Secondary)' }}>
                    <div style={{ fontSize:40, marginBottom:12 }}></div>No UPIs yet — add one →
                  </div>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr style={{ background:'rgba(0,0,0,0.2)' }}>
                      {['UPI ID','Label','Txns','Priority','Status','Actions'].map(h=>(
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--Secondary)', textTransform:'uppercase' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {data.upis.map((u:any)=>(
                        <React.Fragment key={u.id}>
                        <tr style={{ borderBottom: editUpi?.id===u.id?'none':'1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding:'12px 14px', fontFamily:'monospace', fontWeight:700, fontSize:13 }}>{u.upiId}</td>
                          <td style={{ padding:'12px 14px', color:'var(--Secondary)', fontSize:13 }}>{u.label}</td>
                          <td style={{ padding:'12px 14px', fontSize:13 }}>
                            <span style={{ color:(u.currentTxnCount??0)>=u.transactionLimit?'#ef4444':'#fff' }}>{u.currentTxnCount??0}/{u.transactionLimit}</span>
                          </td>
                          <td style={{ padding:'12px 14px', fontSize:13 }}>{u.priority}</td>
                          <td style={{ padding:'12px 14px' }}>
                            <span style={{ padding:'2px 10px', borderRadius:999, fontSize:10, fontWeight:700,
                              background:u.isActive?'rgba(46,204,113,0.15)':'rgba(239,68,68,0.15)',
                              color:u.isActive?'#2ECC71':'#ef4444'}}>{u.isActive?'ACTIVE':'PAUSED'}</span>
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ display:'flex', gap:6 }}>
                              <button onClick={()=>setEditUpi(editUpi?.id===u.id?null:{...u})} style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${editUpi?.id===u.id?'#fe8c45':'var(--Border)'}`, background:editUpi?.id===u.id?'rgba(254,140,69,0.1)':'transparent', color:editUpi?.id===u.id?'#fe8c45':'var(--Secondary)', fontSize:11, cursor:'pointer' }}>
                                {editUpi?.id===u.id?'Cancel':'Edit'}
                              </button>
                              <button onClick={()=>toggleUpi(u.id,u.isActive)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--Border)', background:'transparent', color:'var(--Secondary)', fontSize:11, cursor:'pointer' }}>
                                {u.isActive?'Pause':'Resume'}
                              </button>
                              <button onClick={()=>deleteUpi(u.id)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)', color:'#ef4444', fontSize:11, cursor:'pointer' }}>Del</button>
                            </div>
                          </td>
                        </tr>
                        {editUpi?.id===u.id && (
                          <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                            <td colSpan={6} style={{ padding:'12px 16px', background:'rgba(254,140,69,0.04)', borderTop:'1px dashed rgba(254,140,69,0.2)' }}>
                              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr auto', gap:10, alignItems:'end' }}>
                                <div>
                                  <label style={{ fontSize:10, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:4 }}>UPI ID</label>
                                  <input value={editUpi.upiId} onChange={e=>setEditUpi({...editUpi,upiId:e.target.value})} style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'var(--Bg-3)', border:'1px solid var(--Border-2)', color:'#fff', fontSize:13, fontFamily:'monospace', outline:'none' }}/>
                                </div>
                                <div>
                                  <label style={{ fontSize:10, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:4 }}>Label</label>
                                  <input value={editUpi.label} onChange={e=>setEditUpi({...editUpi,label:e.target.value})} style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'var(--Bg-3)', border:'1px solid var(--Border-2)', color:'#fff', fontSize:13, outline:'none' }}/>
                                </div>
                                <div>
                                  <label style={{ fontSize:10, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:4 }}>Txn Limit</label>
                                  <input type="number" value={editUpi.transactionLimit} onChange={e=>setEditUpi({...editUpi,transactionLimit:e.target.value})} style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'var(--Bg-3)', border:'1px solid var(--Border-2)', color:'#fff', fontSize:13, outline:'none' }}/>
                                </div>
                                <div>
                                  <label style={{ fontSize:10, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:4 }}>Priority</label>
                                  <input type="number" value={editUpi.priority} onChange={e=>setEditUpi({...editUpi,priority:e.target.value})} style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'var(--Bg-3)', border:'1px solid var(--Border-2)', color:'#fff', fontSize:13, outline:'none' }}/>
                                </div>
                                <button onClick={saveEditUpi} disabled={uLoading} style={{ height:36, padding:'0 20px', borderRadius:8, border:'none', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                                  {uLoading?'...':'Save'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={{ ...card, padding:22 }}>
                <h4 style={{ fontWeight:900, fontSize:17, marginBottom:18 }}>+ Add UPI</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div><label style={label}>UPI ID</label><input placeholder="name@paytm" value={uForm.upiId} onChange={e=>setUForm({...uForm,upiId:e.target.value})} style={inp}/></div>
                  <div><label style={label}>Label</label><input placeholder="Primary / Backup 1" value={uForm.label} onChange={e=>setUForm({...uForm,label:e.target.value})} style={inp}/></div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div><label style={label}>Txn Limit</label><input type="number" value={uForm.limit} onChange={e=>setUForm({...uForm,limit:e.target.value})} style={inp}/></div>
                    <div><label style={label}>Priority</label><input type="number" value={uForm.priority} onChange={e=>setUForm({...uForm,priority:e.target.value})} style={inp}/></div>
                  </div>
                  <button onClick={addUpi} disabled={uLoading} style={{ width:'100%', height:46, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:900, fontSize:14, opacity:uLoading?0.6:1 }}>
                    {uLoading ? ' Adding...' : '+ Add UPI to Pool'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {tab==='users' && (
            <div style={{ ...card }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--Border)', background:'rgba(0,0,0,0.15)' }}>
                <h3 style={{ fontWeight:900, fontSize:19 }}>Users</h3>
                <p style={{ color:'var(--Secondary)', fontSize:12, marginTop:4 }}>Open Prisma Studio to manage users → <code style={{ color:'#ffcb52' }}>npx prisma studio</code></p>
              </div>
              <div style={{ padding:'60px 20px', textAlign:'center', color:'var(--Secondary)' }}>
                <div style={{ fontSize:40, marginBottom:12 }}></div>
                <p style={{ marginBottom:16 }}>User management via Prisma Studio (localhost:5555)</p>
                <a href="http://localhost:5555" target="_blank" rel="noreferrer" className="tf-btn" style={{ height:44, fontSize:14, padding:'0 28px' }}>
                  Open Prisma Studio →
                </a>
              </div>
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {tab==='payments' && (
            <div>
              <div style={{ ...card, marginBottom:20 }}>
                <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--Border)', background:'rgba(0,0,0,0.15)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <h3 style={{ fontWeight:900, fontSize:19 }}>Pending Deposits</h3>
                    <p style={{ color:'var(--Secondary)', fontSize:12, marginTop:4 }}>Review UTR numbers and approve/reject manually</p>
                  </div>
                  <button onClick={()=>authFetch('/api/payment/verify').then(r=>r.json()).then(d=>setPendingTxns(d.pending??[]))} style={{ padding:'8px 16px', borderRadius:999, border:'1px solid var(--Border)', background:'var(--Bg-3)', color:'var(--Secondary)', fontSize:13, cursor:'pointer' }}>
                    Refresh
                  </button>
                </div>

                {pendingTxns.length===0 ? (
                  <div style={{ padding:'60px 20px', textAlign:'center', color:'var(--Secondary)' }}>
                    <div style={{ fontSize:40, marginBottom:12 }}>✓</div>
                    No pending payments — all clear!
                  </div>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr style={{ background:'rgba(0,0,0,0.2)' }}>
                      {['User','Amount','Order ID / UTR','Time','Actions'].map(h=>(
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--Secondary)', textTransform:'uppercase' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {pendingTxns.map((t:any)=>(
                        <tr key={t.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ fontWeight:700, fontSize:13 }}>{t.user?.name}</div>
                            <div style={{ color:'var(--Secondary)', fontSize:11 }}>{t.user?.email}</div>
                          </td>
                          <td style={{ padding:'12px 14px', fontWeight:900, fontSize:16, color:'#ffcb52' }}>₹{t.amount?.toLocaleString()}</td>
                          <td style={{ padding:'12px 14px', fontFamily:'monospace', fontSize:11, color:'var(--Secondary)', maxWidth:200 }}>
                            <div style={{ wordBreak:'break-all' }}>{t.orderId}</div>
                          </td>
                          <td style={{ padding:'12px 14px', fontSize:12, color:'var(--Secondary)' }}>
                            {new Date(t.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ display:'flex', gap:8 }}>
                              <button onClick={()=>verifyPayment(t.id,'approve')} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid rgba(46,204,113,0.4)', background:'rgba(46,204,113,0.1)', color:'#2ECC71', fontSize:12, cursor:'pointer', fontWeight:700 }}>
                                Approve
                              </button>
                              <button onClick={()=>verifyPayment(t.id,'reject')} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)', color:'#ef4444', fontSize:12, cursor:'pointer', fontWeight:700 }}>
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* UPI Flow explanation */}
              <div style={{ ...card, padding:24 }}>
                <h4 style={{ fontWeight:700, fontSize:16, marginBottom:16 }}> How UPI Payment Works</h4>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                  {[
                    { step:'1', Icon:Wallet,      title:'User deposits', desc:'User enters amount → system picks active UPI from pool → shows QR + UPI ID' },
                    { step:'2', Icon:CreditCard,  title:'User pays',     desc:'User scans QR or enters UPI ID in their PhonePe/GPay/Paytm app and pays' },
                    { step:'3', Icon:Activity,    title:'UTR submitted', desc:'User enters the 12-digit UTR/Reference number shown in their UPI app after payment' },
                    { step:'4', Icon:CheckCircle, title:'Auto-credited', desc:'SMS Gateway detects payment → coins credited automatically within seconds' },
                  ].map(item=>(
                    <div key={item.step} style={{ background:'var(--Bg-3)', borderRadius:12, padding:'16px 14px', textAlign:'center' }}>
                      <div style={{ width:44, height:44, borderRadius:10, background:'rgba(254,140,69,0.1)', border:'1px solid rgba(254,140,69,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                        <item.Icon size={20} color="#fe8c45"/>
                      </div>
                      <div style={{ fontWeight:900, fontSize:13, marginBottom:6 }}>{item.title}</div>
                      <div style={{ color:'var(--Secondary)', fontSize:11, lineHeight:1.5 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:14, background:'rgba(255,203,82,0.06)', border:'1px solid rgba(255,203,82,0.2)', borderRadius:10, padding:'12px 16px', fontSize:12, color:'var(--Secondary)' }}>
                   <strong style={{ color:'#ffcb52' }}>Auto-verification tip:</strong> To fully automate payment verification (no manual approval), integrate a payment gateway like <strong style={{ color:'#fff' }}>Razorpay</strong> or <strong style={{ color:'#fff' }}>Cashfree</strong> — they send automatic webhooks when payment succeeds.
                </div>
              </div>
            </div>
          )}


          {/* ── RESULTS TAB ── */}
          {tab==='results' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
                <div>
                  <h3 style={{ fontWeight:900, fontSize:22 }}>Game Results</h3>
                  <p style={{ color:'var(--Secondary)', fontSize:13, marginTop:4 }}>Winners across Lottery, Matka King and Spin Wheel</p>
                </div>
                <button onClick={loadResults} disabled={resultsLoading} style={{ padding:'8px 18px', borderRadius:999, border:'1px solid var(--Border)', background:'var(--Bg-2)', color:'var(--Secondary)', fontSize:13, cursor:'pointer', fontWeight:600 }}>
                  {resultsLoading ? 'Loading...' : '↻ Load / Refresh Results'}
                </button>
              </div>

              <div style={{ display:'flex', gap:5, background:'var(--Bg-2)', borderRadius:12, padding:4, marginBottom:20, border:'1px solid var(--Border)', width:'fit-content' }}>
                {(['lottery','matka','spin'] as const).map(g => (
                  <button key={g} onClick={()=>{ setResultsTab(g); if(results.lottery.length===0 && results.matka.length===0) loadResults(); }} style={{ padding:'8px 20px', borderRadius:9, border:'none', cursor:'pointer', fontWeight:700, fontSize:13, background:resultsTab===g?'linear-gradient(270deg,#fe8c45,#ca2826)':'transparent', color:resultsTab===g?'#fff':'var(--Secondary)' }}>
                    {g==='lottery'?'🎟 Lottery':g==='matka'?'🎲 Matka King':'🎡 Spin Wheel'}
                  </button>
                ))}
              </div>

              {/* LOTTERY RESULTS */}
              {resultsTab==='lottery' && (results.lottery.length===0 ? (
                <div style={{ ...card, padding:40, textAlign:'center', color:'var(--Secondary)' }}>
                  <p style={{ fontSize:15, marginBottom:8 }}>No drawn lotteries yet.</p>
                  <p style={{ fontSize:12 }}>Click "Load / Refresh Results" above.</p>
                </div>
              ) : results.lottery.map((s:any) => (
                <div key={s.id} style={{ ...card, marginBottom:16 }}>
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--Border)', background:s.isDummy?'rgba(239,68,68,0.06)':'rgba(46,204,113,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <h4 style={{ fontWeight:900, fontSize:17 }}>{s.name}</h4>
                        <span style={{ padding:'2px 10px', borderRadius:999, fontSize:10, fontWeight:700, background:s.isDummy?'rgba(239,68,68,0.2)':'rgba(46,204,113,0.2)', color:s.isDummy?'#ef4444':'#2ECC71' }}>
                          {s.isDummy?'🏠 DUMMY':'🏆 REAL DRAW'}
                        </span>
                      </div>
                      <p style={{ fontSize:12, color:'var(--Secondary)', marginTop:3 }}>Prefix: {s.prefix} · Drawn: {s.drawnAt?new Date(s.drawnAt).toLocaleString('en-IN'):'—'}</p>
                    </div>
                    <div style={{ display:'flex', gap:20, fontSize:13 }}>
                      <div style={{ textAlign:'right' }}><p style={{ color:'var(--Secondary)', fontSize:11 }}>Prize Pool</p><p style={{ fontWeight:900, color:'#ffcb52' }}>₹{s.prizePool?.toLocaleString()}</p></div>
                    </div>
                  </div>
                  <div style={{ padding:'16px 20px' }}>
                    {s.winners && s.winners.length > 0 ? (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
                        {s.winners.map((w:any, i:number) => (
                          <div key={i} style={{ padding:'14px 16px', borderRadius:12, background:i===0?'rgba(255,203,82,0.07)':i===1?'rgba(52,152,219,0.07)':'rgba(155,89,182,0.07)', border:`1px solid ${i===0?'rgba(255,203,82,0.25)':i===1?'rgba(52,152,219,0.25)':'rgba(155,89,182,0.25)'}` }}>
                            <p style={{ fontSize:10, fontWeight:700, color:i===0?'#ffcb52':i===1?'#3498DB':'#9B59B6', textTransform:'uppercase', marginBottom:6 }}>{w.tier} Prize</p>
                            <p style={{ fontFamily:'monospace', fontWeight:900, fontSize:18, color:'var(--White)', marginBottom:4 }}>{w.ticket??'N/A'}</p>
                            <p style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{w.user?.name??'House Account'}</p>
                            <p style={{ fontSize:11, color:'var(--Secondary)', marginBottom:6 }}>{w.user?.email}</p>
                            <p style={{ fontWeight:900, color:'#2ECC71', fontSize:14 }}>₹{w.prize?.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color:'var(--Secondary)', fontSize:13 }}>No winner data available.</p>
                    )}
                  </div>
                </div>
              )))}

              {/* MATKA RESULTS */}
              {resultsTab==='matka' && (results.matka.length===0 ? (
                <div style={{ ...card, padding:40, textAlign:'center', color:'var(--Secondary)' }}>
                  <p style={{ fontSize:15, marginBottom:8 }}>No declared matka results yet.</p>
                  <p style={{ fontSize:12 }}>Click "Load / Refresh Results" above.</p>
                </div>
              ) : results.matka.map((r:any) => (
                <div key={r.id} style={{ ...card, marginBottom:12 }}>
                  <div style={{ padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10, borderBottom:'1px solid var(--Border)', background:'rgba(0,0,0,0.1)' }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <h4 style={{ fontWeight:800, fontSize:16 }}>{r.market?.name}</h4>
                        {r.isDummyResult && <span style={{ padding:'2px 8px', borderRadius:999, fontSize:10, fontWeight:700, background:'rgba(239,68,68,0.2)', color:'#ef4444' }}>DUMMY</span>}
                      </div>
                      <p style={{ fontSize:12, color:'var(--Secondary)', marginTop:3 }}>Declared: {r.declaredAt?new Date(r.declaredAt).toLocaleString('en-IN'):'Pending'}</p>
                    </div>
                    <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
                      <div style={{ textAlign:'center' }}>
                        <p style={{ fontSize:10, color:'var(--Secondary)', fontWeight:700, textTransform:'uppercase' }}>Open</p>
                        <p style={{ fontFamily:'monospace', fontWeight:900, fontSize:18, color:'#fe8c45' }}>{r.openPatti??'???'}</p>
                        <p style={{ fontSize:11, color:'var(--Secondary)' }}>Ank: {r.openAnk??'?'}</p>
                      </div>
                      <span style={{ color:'var(--Secondary)', fontSize:20 }}>—</span>
                      <div style={{ textAlign:'center' }}>
                        <p style={{ fontSize:10, color:'var(--Secondary)', fontWeight:700, textTransform:'uppercase' }}>Close</p>
                        <p style={{ fontFamily:'monospace', fontWeight:900, fontSize:18, color:'#3498DB' }}>{r.closePatti??'???'}</p>
                        <p style={{ fontSize:11, color:'var(--Secondary)' }}>Ank: {r.closeAnk??'?'}</p>
                      </div>
                      <div style={{ textAlign:'center', padding:'8px 16px', borderRadius:12, background:'rgba(255,203,82,0.1)', border:'1px solid rgba(255,203,82,0.3)' }}>
                        <p style={{ fontSize:10, color:'var(--Secondary)', fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>Jodi</p>
                        <p style={{ fontFamily:'monospace', fontWeight:900, fontSize:26, color:'#ffcb52' }}>{r.jodi??'??'}</p>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <p style={{ fontSize:10, color:'var(--Secondary)', fontWeight:700 }}>Payout</p>
                        <p style={{ fontWeight:900, color:'#2ECC71', fontSize:15 }}>₹{r.totalPayout?.toLocaleString()??0}</p>
                        <p style={{ fontSize:10, color:'var(--Secondary)' }}>{r.bets?.length??0} winners</p>
                      </div>
                    </div>
                  </div>
                  {r.bets && r.bets.length > 0 && (
                    <div style={{ padding:'12px 20px' }}>
                      <p style={{ fontSize:11, fontWeight:700, color:'var(--Secondary)', marginBottom:8, textTransform:'uppercase' }}>Winners ({r.bets.length})</p>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                        {r.bets.slice(0,8).map((b:any) => (
                          <div key={b.id} style={{ padding:'6px 12px', borderRadius:8, background:'rgba(46,204,113,0.08)', border:'1px solid rgba(46,204,113,0.2)', fontSize:12 }}>
                            <span style={{ fontWeight:700 }}>{b.user?.name??'User'}</span>
                            <span style={{ color:'#2ECC71', marginLeft:8, fontWeight:700 }}>+₹{b.wonAmount?.toLocaleString()}</span>
                          </div>
                        ))}
                        {r.bets.length > 8 && <span style={{ fontSize:12, color:'var(--Secondary)', padding:'6px 0' }}>+{r.bets.length-8} more</span>}
                      </div>
                    </div>
                  )}
                </div>
              )))}

              {/* SPIN RESULTS */}
              {resultsTab==='spin' && (
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:20 }}>
                    {[
                      { label:'Total Wins Shown', value: results.spin?.length??0, color:'#3498DB' },
                      { label:'Total Coins Paid Out', value:`₹${(results.spinStats?.totalWon??0).toLocaleString()}`, color:'#2ECC71' },
                      { label:'Paid vs Free', value:`${results.spin?.filter((r:any)=>!r.isFree).length??0} paid / ${results.spin?.filter((r:any)=>r.isFree).length??0} free`, color:'#ffcb52' },
                    ].map(s => (
                      <div key={s.label} style={{ ...card, padding:'16px 20px' }}>
                        <p style={{ fontSize:11, color:'var(--Secondary)', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{s.label}</p>
                        <p style={{ fontWeight:900, fontSize:20, color:s.color }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {results.spin.length===0 ? (
                    <div style={{ ...card, padding:40, textAlign:'center', color:'var(--Secondary)' }}>
                      <p style={{ fontSize:15, marginBottom:8 }}>No spin wins yet.</p>
                      <p style={{ fontSize:12 }}>Click "Load / Refresh Results" above.</p>
                    </div>
                  ) : (
                    <div style={card}>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead><tr style={{ background:'rgba(0,0,0,0.2)' }}>
                          {['Player','Coins Won','Type','Date & Time'].map(h=><th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--Secondary)', textTransform:'uppercase' }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {results.spin.map((r:any) => (
                            <tr key={r.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:'12px 14px' }}>
                                <p style={{ fontWeight:700, fontSize:13 }}>{r.userName}</p>
                                <p style={{ fontSize:11, color:'var(--Secondary)' }}>{r.userEmail}</p>
                              </td>
                              <td style={{ padding:'12px 14px', fontWeight:900, color:'#2ECC71', fontSize:15 }}>+₹{r.coinsWon?.toLocaleString()}</td>
                              <td style={{ padding:'12px 14px' }}>
                                <span style={{ padding:'2px 10px', borderRadius:999, fontSize:10, fontWeight:700, background:r.isFree?'rgba(46,204,113,0.15)':'rgba(100,100,100,0.15)', color:r.isFree?'#2ECC71':'var(--Secondary)' }}>
                                  {r.isFree?'FREE SPIN':'Paid'}
                                </span>
                              </td>
                              <td style={{ padding:'12px 14px', fontSize:12, color:'var(--Secondary)' }}>
                                {new Date(r.spunAt).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
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
