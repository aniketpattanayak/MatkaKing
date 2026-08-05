'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/auth-client';

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
  balance, minWithdraw = 100, onSuccess
}: {
  balance: number;
  minWithdraw?: number;
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
  const [showHist,  setShowHist]  = useState(false);

  const loadHistory = async () => {
    const r = await authFetch('/api/user/withdraw');
    const d = await r.json();
    if (d.withdrawals) setHistory(d.withdrawals);
  };

  useEffect(() => { loadHistory(); }, []);

  const presets = [minWithdraw, 200, 500, 1000, 2000, 5000].filter(a => a <= balance && a >= minWithdraw);

  const submit = async () => {
    const amt = parseInt(amount);
    if (!amt || amt < minWithdraw) return toast.error(`Minimum withdrawal is ₹${minWithdraw}`);
    if (amt > balance) return toast.error(`Insufficient balance. Available: ₹${balance}`);
    if (method === 'UPI'     && !upiId.trim())    return toast.error('Enter your UPI ID');
    if (method === 'PHONEPE' && phone.length < 10) return toast.error('Enter valid 10-digit number');
    if (method === 'BANK'    && (!bankAcc || !ifsc)) return toast.error('Enter bank account and IFSC');

    setLoading(true);
    try {
      const body: any = { amount: amt, method };
      if (method === 'UPI')     body.upiId       = upiId.trim();
      if (method === 'PHONEPE') body.phoneNumber  = phone.trim();
      if (method === 'BANK')  { body.bankAccount  = bankAcc; body.bankIfsc = ifsc.toUpperCase(); body.bankName = bankNm; }

      const r = await authFetch('/api/user/withdraw', { method: 'POST', body: JSON.stringify(body) });
      const d = await r.json();
      if (d.ok) {
        toast.success(d.message ?? 'Withdrawal request submitted!');
        setAmount(''); setUpiId(''); setPhone(''); setBankAcc(''); setIfsc(''); setBankNm('');
        onSuccess?.();
        loadHistory();
      } else {
        toast.error(d.error ?? 'Withdrawal failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Info banner */}
      <div style={{ background:'rgba(255,203,82,0.08)', border:'1px solid rgba(255,203,82,0.25)', borderRadius:14, padding:'14px 20px', marginBottom:20, display:'flex', gap:14, alignItems:'center' }}>
        <span style={{ fontSize:28 }}>💰</span>
        <div>
          <p style={{ fontWeight:800, fontSize:15, color:'#ffcb52', marginBottom:3 }}>Coin Withdrawal</p>
          <p style={{ fontSize:12, color:'var(--Secondary)' }}>Min: <strong style={{ color:'#ffcb52' }}>₹{minWithdraw}</strong> · Processed within 24 hours · Balance: <strong style={{ color:'#ffcb52' }}>₹{balance.toLocaleString()}</strong></p>
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
            <input type="number" placeholder={`Min ₹${minWithdraw}`} value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inp, fontSize:20, fontWeight:700 }}/>
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

          <button onClick={submit} disabled={loading || !amount} style={{ height:54, borderRadius:14, border:'none', cursor:(loading||!amount)?'not-allowed':'pointer', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:900, fontSize:16, opacity:(loading||!amount)?0.6:1 }}>
            {loading ? 'Submitting...' : `Withdraw ₹${amount||'0'} Coins`}
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
