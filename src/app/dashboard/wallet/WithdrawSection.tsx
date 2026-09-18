'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/auth-client';

const qrUrl = (upiId: string, amount: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=${upiId}&am=${amount}&cu=INR`)}&bgcolor=ffffff&color=000000&margin=2`;

const inp: any = {
  width:'100%', padding:'11px 14px', borderRadius:10,
  border:'1px solid var(--Border-2)', background:'var(--Bg-3)',
  color:'var(--White)', fontSize:14, outline:'none',
};

function parseWithdrawDetails(orderId: string) {
  const upi = orderId.match(/UPI:([^-]+@[^-]+)/)?.[1];
  const ph  = orderId.match(/PHONEPE:(\d+)/)?.[1];
  const bk  = orderId.match(/BANK:([^:]+):([^-]+)/);
  if (upi) return { method: 'UPI',     detail: upi };
  if (ph)  return { method: 'PhonePe', detail: ph };
  if (bk)  return { method: 'Bank',    detail: `${bk[1]} / ${bk[2]}` };
  return { method: '—', detail: '—' };
}

export default function WithdrawSection({
  balance, minWithdraw = 1000, maxWithdraw = 5000, withdrawPerDay = 1, onSuccess
}: {
  balance: number;
  minWithdraw?: number;
  maxWithdraw?: number;
  withdrawPerDay?: number;
  onSuccess?: () => void;
}) {
  const [method,    setMethod]    = useState<'UPI'|'PHONEPE'|'BANK'>('UPI');
  const [amount,    setAmount]    = useState('');
  const [upiId,     setUpiId]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [bankAcc,   setBankAcc]   = useState('');
  const [ifsc,      setIfsc]      = useState('');
  const [bankNm,    setBankNm]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [history,   setHistory]   = useState<any[]>([]);
  const [usedToday, setUsedToday] = useState(0);
  const [limitPerDay, setLimitPerDay] = useState(withdrawPerDay);
  const [qrImage,   setQrImage]   = useState<string|null>(null);

  const loadHistory = async () => {
    const r = await authFetch('/api/user/withdraw');
    const d = await r.json();
    if (d.withdrawals) setHistory(d.withdrawals);
    if (typeof d.usedToday   === 'number') setUsedToday(d.usedToday);
    if (typeof d.limitPerDay === 'number') setLimitPerDay(d.limitPerDay);
  };

  useEffect(() => { loadHistory(); }, []);

  // Keep limitPerDay in sync if parent prop changes
  useEffect(() => { setLimitPerDay(withdrawPerDay); }, [withdrawPerDay]);

  const remainingToday = Math.max(0, limitPerDay - usedToday);
  const dailyLimitReached = remainingToday <= 0;

  const presets = [minWithdraw, Math.round(minWithdraw*1.5), Math.round(minWithdraw*2), Math.round(minWithdraw*3), maxWithdraw]
    .filter((a,i,arr) => arr.indexOf(a)===i)
    .filter(a => a <= balance && a >= minWithdraw && a <= maxWithdraw);

  const submit = async () => {
    if (dailyLimitReached) return toast.error(`Daily withdrawal limit reached (${limitPerDay}/day). Resets at midnight.`);
    const amt = parseInt(amount);
    if (!amt || amt < minWithdraw) return toast.error(`Minimum withdrawal is ₹${minWithdraw}`);
    if (amt > maxWithdraw) return toast.error(`Maximum withdrawal is ₹${maxWithdraw}`);
    if (amt > balance) return toast.error('Insufficient balance');
    if (method === 'UPI'     && !upiId.trim())    return toast.error('Enter your UPI ID');
    if (method === 'PHONEPE' && phone.length < 10) return toast.error('Enter valid 10-digit number');
    if (method === 'BANK'    && (!bankAcc || !ifsc)) return toast.error('Enter bank account and IFSC');

    setLoading(true);
    try {
      const body: any = { amount: amt, method, qrImage: qrImage ?? undefined };
      if (method === 'UPI')     body.upiId       = upiId.trim();
      if (method === 'PHONEPE') body.phoneNumber  = phone.trim();
      if (method === 'BANK')  { body.bankAccount  = bankAcc; body.bankIfsc = ifsc.toUpperCase(); body.bankName = bankNm; }

      const r = await authFetch('/api/user/withdraw', { method: 'POST', body: JSON.stringify(body) });
      const d = await r.json();
      if (d.ok) {
        const msg = d.remainingToday === 0
          ? `Withdrawal submitted! You've used all ${limitPerDay} withdrawal${limitPerDay !== 1 ? 's' : ''} for today.`
          : `Withdrawal submitted! ${d.remainingToday} more allowed today.`;
        toast.success(msg);
        setAmount(''); setUpiId(''); setPhone(''); setBankAcc(''); setIfsc(''); setBankNm(''); setQrImage(null);
        onSuccess?.();
        loadHistory(); // reloads usedToday count too
      } else {
        toast.error(d.error ?? 'Withdrawal failed');
        if (d.limitReached) loadHistory(); // refresh count in case it was stale
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Info banner */}
      <div style={{ background:'rgba(255,203,82,0.08)', border:'1px solid rgba(255,203,82,0.25)', borderRadius:14, padding:'14px 20px', marginBottom:16, display:'flex', gap:14, alignItems:'center' }}>
        <span style={{ fontSize:28 }}>💰</span>
        <div>
          <p style={{ fontWeight:800, fontSize:15, color:'#ffcb52', marginBottom:3 }}>Coin Withdrawal</p>
          <p style={{ fontSize:12, color:'var(--Secondary)' }}>
            Min: <strong style={{ color:'#ffcb52' }}>₹{minWithdraw}</strong> · Max: <strong style={{ color:'#ffcb52' }}>₹{maxWithdraw}</strong> · Balance: <strong style={{ color:'#ffcb52' }}>₹{balance.toLocaleString()}</strong>
          </p>
        </div>
      </div>

      {/* Daily limit status bar */}
      <div style={{ background: dailyLimitReached ? 'rgba(239,68,68,0.08)' : 'rgba(46,204,113,0.08)', border: `1px solid ${dailyLimitReached ? 'rgba(239,68,68,0.3)' : 'rgba(46,204,113,0.25)'}`, borderRadius:14, padding:'12px 20px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>{dailyLimitReached ? '🚫' : '📅'}</span>
          <div>
            <p style={{ fontWeight:700, fontSize:13, color: dailyLimitReached ? '#ef4444' : '#2ECC71', marginBottom:2 }}>
              {dailyLimitReached ? 'Daily limit reached' : `${remainingToday} withdrawal${remainingToday !== 1 ? 's' : ''} remaining today`}
            </p>
            <p style={{ fontSize:11, color:'var(--Secondary)' }}>
              Used {usedToday} of {limitPerDay} allowed today · Resets at midnight IST
            </p>
          </div>
        </div>
        {/* Dot indicators */}
        <div style={{ display:'flex', gap:4 }}>
          {Array.from({ length: limitPerDay }).map((_, i) => (
            <div key={i} style={{ width:10, height:10, borderRadius:'50%', background: i < usedToday ? '#ef4444' : '#2ECC71', opacity: i < usedToday ? 1 : 0.3 }} />
          ))}
        </div>
      </div>

      <div style={{ background:'var(--Bg-2)', borderRadius:20, padding:28, border:'1px solid var(--Border)', marginBottom:20 }}>
        <h3 style={{ fontWeight:900, fontSize:20, marginBottom:20 }}>Withdraw Coins</h3>

        {/* Method selector */}
        <div style={{ display:'flex', gap:6, marginBottom:22, background:'var(--Bg-3)', borderRadius:12, padding:4 }}>
          {(['UPI','PHONEPE','BANK'] as const).map(m => (
            <button key={m} onClick={() => setMethod(m)} style={{
              flex:1, padding:'10px 0', borderRadius:9, border:'none', cursor:'pointer',
              fontWeight:700, fontSize:13,
              background: method===m ? 'linear-gradient(270deg,#fe8c45,#ca2826)' : 'transparent',
              color: method===m ? '#fff' : 'var(--Secondary)',
            }}>
              {m === 'UPI' ? '💳 UPI' : m === 'PHONEPE' ? '📱 PhonePe' : '🏦 Bank'}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Amount */}
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:8, textTransform:'uppercase' }}>Amount (1 Coin = ₹1)</label>
            <input type="number" placeholder={`Min ₹${minWithdraw} — Max ₹${maxWithdraw}`} value={amount} 
    min={minWithdraw} max={maxWithdraw}
    onChange={e => setAmount(e.target.value)} style={{ ...inp, fontSize:20, fontWeight:700 }}/>
            {presets.length > 0 && (
              <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                {presets.map(a => (
                  <button key={a} onClick={() => setAmount(String(a))} style={{ padding:'5px 14px', borderRadius:8, border:'1px solid var(--Border)', background: amount==String(a)?'rgba(254,140,69,0.15)':'var(--Bg-3)', color: amount==String(a)?'#fe8c45':'var(--Secondary)', fontSize:13, cursor:'pointer', fontWeight:600 }}>
                    ₹{a.toLocaleString()}
                  </button>
                ))}
                <button onClick={() => setAmount(String(balance))} style={{ padding:'5px 14px', borderRadius:8, border:'1px solid rgba(255,203,82,0.3)', background:'rgba(255,203,82,0.08)', color:'#ffcb52', fontSize:13, cursor:'pointer', fontWeight:600 }}>
                  Max ₹{balance.toLocaleString()}
                </button>
              </div>
            )}
          </div>

          {/* UPI */}
          {method === 'UPI' && (
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:8, textTransform:'uppercase' }}>Your UPI ID</label>
              <input placeholder="yourname@paytm / name@upi" value={upiId} onChange={e => setUpiId(e.target.value)} style={inp}/>
              <p style={{ fontSize:11, color:'var(--Secondary)', marginTop:6 }}>e.g. 9876543210@paytm, name@okaxis</p>
            </div>
          )}

          {/* PhonePe */}
          {method === 'PHONEPE' && (
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:8, textTransform:'uppercase' }}>PhonePe Number</label>
              <input placeholder="10-digit mobile number" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} style={inp}/>
            </div>
          )}

          {/* Bank */}
          {method === 'BANK' && (<>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:8, textTransform:'uppercase' }}>Bank Name</label>
              <input placeholder="e.g. State Bank of India" value={bankNm} onChange={e => setBankNm(e.target.value)} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:8, textTransform:'uppercase' }}>Account Number</label>
              <input placeholder="Enter your account number" value={bankAcc} onChange={e => setBankAcc(e.target.value.replace(/\D/g,''))} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:8, textTransform:'uppercase' }}>IFSC Code</label>
              <input placeholder="e.g. SBIN0001234" value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} style={inp}/>
            </div>
          </>)}

          {/* QR Upload */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', textTransform:'uppercase', letterSpacing:0.5 }}>
              📷 Upload Your QR Code <span style={{ color:'var(--Secondary)', fontWeight:400, textTransform:'none' }}>(optional — helps admin pay faster)</span>
            </label>
            {qrImage ? (
              <div style={{ position:'relative', display:'inline-block' }}>
                <img src={qrImage} alt="QR" style={{ width:140, height:140, borderRadius:12, objectFit:'contain', border:'2px solid rgba(46,204,113,0.4)', background:'rgba(255,255,255,0.05)' }} />
                <button onClick={()=>setQrImage(null)} style={{ position:'absolute', top:-8, right:-8, width:22, height:22, borderRadius:'50%', border:'none', background:'#ef4444', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                <p style={{ fontSize:11, color:'#2ECC71', marginTop:6 }}>✓ QR uploaded</p>
              </div>
            ) : (
              <label style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:12, border:'2px dashed rgba(255,255,255,0.15)', cursor:'pointer', background:'rgba(255,255,255,0.02)', transition:'border-color 0.2s' }}
                onDragOver={e=>{e.preventDefault();(e.currentTarget as HTMLElement).style.borderColor='#2ECC71'}}
                onDragLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.15)'}}
                onDrop={e=>{
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.15)';
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = ev => setQrImage(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }
                }}>
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = ev => setQrImage(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }
                }} />
                <span style={{ fontSize:28 }}>📱</span>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:'var(--White)' }}>Tap to upload QR code</p>
                  <p style={{ fontSize:11, color:'var(--Secondary)', marginTop:2 }}>Admin will scan it to pay you directly</p>
                </div>
              </label>
            )}
          </div>

          <button onClick={submit} disabled={loading || !amount || dailyLimitReached} style={{ height:54, borderRadius:14, border:'none', cursor:(loading||!amount||dailyLimitReached)?'not-allowed':'pointer', background: dailyLimitReached ? 'rgba(100,100,100,0.2)' : 'linear-gradient(270deg,#fe8c45,#ca2826)', color: dailyLimitReached ? 'var(--Secondary)' : '#fff', fontWeight:900, fontSize:16, opacity:(loading||!amount||dailyLimitReached)?0.7:1 }}>
            {dailyLimitReached ? `🚫 Daily limit reached (${limitPerDay}/day)` : loading ? 'Submitting...' : `Withdraw ₹${amount||'0'} Coins`}
          </button>

          <div style={{ background:'var(--Bg-3)', borderRadius:12, padding:'14px 16px' }}>
            <p style={{ fontSize:12, color:'var(--Secondary)', lineHeight:1.7 }}>
              ⚠️ <strong style={{ color:'var(--White)' }}>Note:</strong> Coins are deducted immediately. Admin will transfer within 24 hours.
            </p>
          </div>
        </div>
      </div>

      {/* Withdrawal History */}
      <div style={{ background:'var(--Bg-2)', borderRadius:20, border:'1px solid var(--Border)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--Border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h4 style={{ fontWeight:800, fontSize:16 }}>Withdrawal History</h4>
          <button onClick={loadHistory} style={{ fontSize:12, color:'var(--Secondary)', background:'none', border:'none', cursor:'pointer' }}>↻ Refresh</button>
        </div>
        {history.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--Secondary)', fontSize:13 }}>No withdrawal requests yet</div>
        ) : history.map((t: any) => {
          const parsed = parseWithdrawDetails(t.orderId ?? '');
          return (
            <div key={t.id} style={{ padding:'16px 20px', borderBottom:'1px solid var(--Border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontWeight:900, fontSize:16, color:'#ef4444' }}>-₹{t.coins?.toLocaleString()}</span>
                  <span style={{ padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700, background: t.status==='SUCCESS'?'rgba(46,204,113,0.15)':'rgba(255,203,82,0.15)', color: t.status==='SUCCESS'?'#2ECC71':'#ffcb52' }}>
                    {t.status==='SUCCESS' ? '✓ Sent' : '⏳ Pending'}
                  </span>
                </div>
                <p style={{ fontSize:12, color:'var(--Secondary)' }}>
                  {parsed.method}: <strong style={{ color:'var(--White)', fontFamily:'monospace' }}>{parsed.detail}</strong>
                </p>
                <p style={{ fontSize:11, color:'var(--Secondary)', marginTop:2 }}>
                  {new Date(t.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                </p>
              </div>
              {t.status === 'SUCCESS' && (
                <div style={{ padding:'6px 14px', borderRadius:8, background:'rgba(46,204,113,0.1)', border:'1px solid rgba(46,204,113,0.3)', color:'#2ECC71', fontSize:12, fontWeight:700 }}>
                  ✓ Money Sent
                </div>
              )}
              {t.status === 'PENDING' && (
                <div style={{ padding:'6px 14px', borderRadius:8, background:'rgba(255,203,82,0.08)', border:'1px solid rgba(255,203,82,0.25)', color:'#ffcb52', fontSize:12, fontWeight:600 }}>
                  Processing...
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
