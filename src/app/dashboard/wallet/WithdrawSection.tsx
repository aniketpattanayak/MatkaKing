'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/auth-client';

const inp: any = {
  width:'100%', padding:'11px 14px', borderRadius:10, border:'1px solid var(--Border-2)',
  background:'var(--Bg-3)', color:'var(--White)', fontSize:14, outline:'none',
};

export default function WithdrawSection({ balance }: { balance: number }) {
  const [method,  setMethod]  = useState<'UPI'|'PHONEPE'|'BANK'>('UPI');
  const [amount,  setAmount]  = useState('');
  const [upiId,   setUpiId]   = useState('');
  const [phone,   setPhone]   = useState('');
  const [bankAcc, setBankAcc] = useState('');
  const [ifsc,    setIfsc]    = useState('');
  const [bankNm,  setBankNm]  = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const amt = parseInt(amount);
    if (!amt || amt < 100) return toast.error('Minimum withdrawal: 100 coins');
    if (amt > balance)     return toast.error(`Insufficient balance (${balance} coins available)`);

    setLoading(true);
    try {
      const body: any = { amount: amt, method };
      if (method === 'UPI')     body.upiId       = upiId;
      if (method === 'PHONEPE') body.phoneNumber  = phone;
      if (method === 'BANK')  { body.bankAccount  = bankAcc; body.bankIfsc = ifsc; body.bankName = bankNm; }

      const r = await authFetch('/api/user/withdraw', { method:'POST', body: JSON.stringify(body) });
      const d = await r.json();
      if (d.ok) {
        toast.success(d.message);
        setAmount(''); setUpiId(''); setPhone(''); setBankAcc(''); setIfsc(''); setBankNm('');
      } else {
        toast.error(d.error ?? 'Withdrawal failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background:'var(--Bg-2)', borderRadius:16, border:'1px solid var(--Border)', padding:24, marginBottom:20 }}>
      <h3 style={{ fontWeight:900, fontSize:19, marginBottom:6 }}>Withdraw Coins</h3>
      <p style={{ color:'var(--Secondary)', fontSize:12, marginBottom:20 }}>Min ₹100 · Processed within 24 hours · Available: <strong style={{color:'#ffcb52'}}>₹{balance.toLocaleString()}</strong></p>

      {/* Method tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:18, background:'var(--Bg-3)', borderRadius:10, padding:4 }}>
        {(['UPI','PHONEPE','BANK'] as const).map(m => (
          <button key={m} onClick={()=>setMethod(m)} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:12,
            background: method===m ? 'linear-gradient(270deg,#fe8c45,#ca2826)' : 'transparent',
            color: method===m ? '#fff' : 'var(--Secondary)' }}>
            {m === 'UPI' ? '💳 UPI' : m === 'PHONEPE' ? '📱 PhonePe' : '🏦 Bank'}
          </button>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {/* Amount */}
        <div>
          <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:6, textTransform:'uppercase' }}>Amount (Coins = ₹)</label>
          <input type="number" placeholder="Min 100" value={amount} onChange={e=>setAmount(e.target.value)} style={inp}/>
          <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
            {[100,200,500,1000,2000,5000].map(a => (
              <button key={a} onClick={()=>setAmount(String(a))} style={{ padding:'4px 12px', borderRadius:6, border:'1px solid var(--Border)', background:'var(--Bg-3)', color:'var(--Secondary)', fontSize:12, cursor:'pointer' }}>
                ₹{a}
              </button>
            ))}
          </div>
        </div>

        {/* UPI */}
        {method === 'UPI' && (
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:6, textTransform:'uppercase' }}>UPI ID</label>
            <input placeholder="yourname@upi" value={upiId} onChange={e=>setUpiId(e.target.value)} style={inp}/>
          </div>
        )}

        {/* PhonePe */}
        {method === 'PHONEPE' && (
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:6, textTransform:'uppercase' }}>PhonePe Number</label>
            <input placeholder="10-digit mobile number" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} style={inp}/>
          </div>
        )}

        {/* Bank */}
        {method === 'BANK' && (
          <>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:6, textTransform:'uppercase' }}>Bank Name</label>
              <input placeholder="e.g. State Bank of India" value={bankNm} onChange={e=>setBankNm(e.target.value)} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:6, textTransform:'uppercase' }}>Account Number</label>
              <input placeholder="Enter account number" value={bankAcc} onChange={e=>setBankAcc(e.target.value.replace(/\D/g,''))} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--Secondary)', display:'block', marginBottom:6, textTransform:'uppercase' }}>IFSC Code</label>
              <input placeholder="e.g. SBIN0001234" value={ifsc} onChange={e=>setIfsc(e.target.value.toUpperCase())} style={inp}/>
            </div>
          </>
        )}

        <button onClick={submit} disabled={loading} style={{ height:50, borderRadius:12, border:'none', cursor:loading?'not-allowed':'pointer', background:'linear-gradient(270deg,#fe8c45,#ca2826)', color:'#fff', fontWeight:900, fontSize:15, opacity:loading?0.6:1 }}>
          {loading ? 'Submitting...' : `Withdraw ₹${amount || '0'}`}
        </button>

        <p style={{ fontSize:11, color:'var(--Secondary)', textAlign:'center' }}>
          ⚠️ Withdrawals are manually processed by admin within 24 hours
        </p>
      </div>
    </div>
  );
}
