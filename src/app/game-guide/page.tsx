'use client';
import Link from 'next/link';
import Header from '@/components/layout/Header';

export default function GameGuidePage() {
  return (
    <>
      <Header />
      <div style={{ paddingTop:80, minHeight:'100vh' }}>
        <div className="tf-container" style={{ paddingTop:32, paddingBottom:60 }}>
          <h1 style={{ fontWeight:900, fontSize:32, marginBottom:8 }}>📖 Game Guide</h1>
          <p style={{ color:'var(--Secondary)', marginBottom:32 }}>Learn how to play Lucky Winner and Money Bank</p>

          {/* Lucky Winner */}
          <div style={{ background:'var(--Bg-2)', borderRadius:20, border:'1px solid var(--Border)', padding:28, marginBottom:24 }}>
            <h2 style={{ fontWeight:900, fontSize:24, marginBottom:16 }}>🎟️ Lucky Winner</h2>
            {[
              { q:'How to play?', a:'Buy tickets with alphanumeric codes. Each ticket costs ₹25. A winner is drawn at the scheduled time.' },
              { q:'How to win?', a:'Your ticket code must match the drawn winning ticket. 3 winners are selected — 1st, 2nd and 3rd prize.' },
              { q:'When can I buy?', a:'Tickets go on sale from the Sale Start Time set by admin. Sales close 30 minutes before draw time.' },
              { q:'How are winners paid?', a:'Winnings are credited directly to your wallet as coins instantly after the draw.' },
              { q:'Prize structure', a:'1st Prize: ₹1,00,000 · 2nd Prize: ₹50,000 · 3rd Prize: ₹25,000 (may vary per series)' },
            ].map((item,i) => (
              <div key={i} style={{ marginBottom:16, padding:16, background:'var(--Bg-3)', borderRadius:12 }}>
                <p style={{ fontWeight:700, marginBottom:6, color:'#ffcb52' }}>Q: {item.q}</p>
                <p style={{ color:'var(--Secondary)', fontSize:14 }}>A: {item.a}</p>
              </div>
            ))}
          </div>

          {/* Money Bank */}
          <div style={{ background:'var(--Bg-2)', borderRadius:20, border:'1px solid var(--Border)', padding:28, marginBottom:24 }}>
            <h2 style={{ fontWeight:900, fontSize:24, marginBottom:16 }}>🎰 Money Bank (Matka)</h2>
            {[
              { q:'What is Money Bank?', a:'Money Bank is a number-based game where you predict digits, combinations or patties to win big multipliers.' },
              { q:'What is ANK?', a:'Pick a single digit (0-9). If the declared Open or Close Ank matches, you win 9x your bet amount.' },
              { q:'What is JODI?', a:'Pick a 2-digit number (00-99). If it matches the declared Jodi (OpenAnk+CloseAnk), you win 90x.' },
              { q:'What is Single Patti (SP)?', a:'Pick a 3-digit number with all different digits (e.g. 123). Wins 140x if declared patti matches.' },
              { q:'What is Double Patti (DP)?', a:'Pick a 3-digit number with exactly 2 same digits (e.g. 112). Wins 280x.' },
              { q:'What is Triple Patti (TP)?', a:'Pick a 3-digit number with all same digits (e.g. 111). Wins 450x.' },
              { q:'What is Half Sangam?', a:'Combination of open patti + close ank or open ank + close patti. Wins 1500x.' },
              { q:'What is Full Sangam?', a:'Pick both open patti and close patti correctly. Wins 11000x.' },
              { q:'OPEN vs CLOSE session?', a:'OPEN session bets are settled when Open Patti is declared. CLOSE session bets settled when Close Patti is declared.' },
              { q:'Can I use free/bonus coins?', a:'No. You must have real deposited balance to play Money Bank.' },
            ].map((item,i) => (
              <div key={i} style={{ marginBottom:16, padding:16, background:'var(--Bg-3)', borderRadius:12 }}>
                <p style={{ fontWeight:700, marginBottom:6, color:'#fe8c45' }}>Q: {item.q}</p>
                <p style={{ color:'var(--Secondary)', fontSize:14 }}>A: {item.a}</p>
              </div>
            ))}
          </div>

          {/* Wallet & Coins */}
          <div style={{ background:'var(--Bg-2)', borderRadius:20, border:'1px solid var(--Border)', padding:28, marginBottom:24 }}>
            <h2 style={{ fontWeight:900, fontSize:24, marginBottom:16 }}>💰 Wallet & Coins</h2>
            {[
              { q:'What are coins?', a:'1 Coin = 1 Indian Rupee (₹1). You deposit real money and it converts to coins at 1:1 ratio.' },
              { q:'How to deposit?', a:'Go to My Wallet → Add Money. Scan the QR code or use the UPI ID shown. Coins are credited automatically.' },
              { q:'How to withdraw?', a:'Go to My Wallet → Withdraw. Minimum ₹1000, Maximum ₹5000 per withdrawal. Minimum balance of ₹50 must remain.' },
              { q:'How long does withdrawal take?', a:'Withdrawals are processed within 24 hours by admin.' },
            ].map((item,i) => (
              <div key={i} style={{ marginBottom:16, padding:16, background:'var(--Bg-3)', borderRadius:12 }}>
                <p style={{ fontWeight:700, marginBottom:6, color:'#2ECC71' }}>Q: {item.q}</p>
                <p style={{ color:'var(--Secondary)', fontSize:14 }}>A: {item.a}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign:'center', marginTop:32 }}>
            <Link href="/games/lottery" className="tf-btn" style={{ marginRight:16 }}>Play Lucky Winner</Link>
            <Link href="/games/matka" className="tf-btn" style={{ background:'linear-gradient(270deg,#9B59B6,#6C3483)' }}>Play Money Bank</Link>
          </div>
        </div>
      </div>
      <footer id="footer">
        <div className="footer-bottom" style={{ paddingTop:24, paddingBottom:24 }}>
          <div className="tf-container">
            <div className="wrapper">
              <div className="center"><ul style={{ display:'flex', gap:24 }}>
                <li><Link href="/">Home</Link></li>
                <li><Link href="/games/lottery">Lucky Winner</Link></li>
                <li><Link href="/games/matka">Money Bank</Link></li>
                <li><Link href="/game-guide">Game Guide</Link></li>
              </ul></div>
              <div className="right"><span>© 2025 Supreme Gaming Engine</span></div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
