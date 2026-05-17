import Link from 'next/link';

const REWARDS = [
  { label: '₹5,000',    coins: 5000, probability: '2%',  color: '#FFD700' },
  { label: '₹2,000',    coins: 2000, probability: '5%',  color: '#FF6B35' },
  { label: '₹1,000',    coins: 1000, probability: '8%',  color: '#9B59B6' },
  { label: '₹500',      coins: 500,  probability: '10%', color: '#3498DB' },
  { label: '₹200',      coins: 200,  probability: '15%', color: '#2ECC71' },
  { label: '₹100',      coins: 100,  probability: '20%', color: '#E74C3C' },
  { label: '₹50',       coins: 50,   probability: '20%', color: '#F39C12' },
  { label: 'Try Again', coins: 0,    probability: '20%', color: '#95A5A6' },
];

export default function SpinPage() {
  return (
    <>
      <div className="tf-top-bar">
        <div className="content">
          <p>🌀 Spin Wheel — Buy 5 spins, get 1 FREE! Daily rewards up to ₹5,000</p>
        </div>
      </div>

      <header id="header-main" className="header header-home-3 header-fixed style-absolute">
        <div className="header-inner">
          <div className="tf-container">
            <div className="row"><div className="col-12">
              <div className="header-inner-wrap">
                <div className="header-logo">
                  <Link href="/"><img alt="Supreme Gaming" src="/images/logo/logo.png" width={170} height={60} /></Link>
                </div>
                <nav className="main-menu">
                  <ul className="navigation">
                    <li className="has-child current-menu-item">
                      <a href="#">GAMES</a>
                      <ul className="sub-menu">
                        <li><Link href="/games/lottery">🎟️ Lottery</Link></li>
                        <li><Link href="/games/matka">🎰 Matka King</Link></li>
                        <li className="current-item"><Link href="/games/spin">🌀 Spin Wheel</Link></li>
                      </ul>
                    </li>
                    <li><Link href="/dashboard">MY ACCOUNT</Link></li>
                    <li><Link href="/">HOME</Link></li>
                  </ul>
                </nav>
                <div className="header-right">
                  <div className="btn-buy-tickets">
                    <Link className="tf-btn" href="/games/lottery">
                      <i className="icon-tickets"></i>Buy Tickets
                    </Link>
                  </div>
                </div>
              </div>
            </div></div>
          </div>
        </div>
      </header>

      {/* Page Title */}
      <div className="page-title" style={{ paddingTop: 175, paddingBottom: 60, textAlign: 'center' }}>
        <div className="tf-container">
          <h1 className="title fw-9" style={{ fontSize: 50 }}>🌀 Spin Wheel</h1>
          <p style={{ color: 'var(--Secondary)', marginTop: 10 }}>
            Spin for instant coin rewards — Buy 5 spins, get 1 FREE!
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
            <Link href="/" style={{ color: 'var(--Secondary)', fontSize: 14 }}>Home</Link>
            <span style={{ color: 'var(--Secondary)' }}>›</span>
            <span style={{ color: 'var(--Main-color)', fontSize: 14 }}>Spin Wheel</span>
          </div>
        </div>
      </div>

      <div className="main-content" style={{ paddingTop: 0 }}>
        <div className="tf-container">

          {/* Promo Banner */}
          <div style={{
            background: 'linear-gradient(135deg,#1a0f00,#2a1500)',
            border: '1px solid rgba(254,140,69,0.4)', borderRadius: 16,
            padding: '28px 40px', marginBottom: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20
          }}>
            <div>
              <h2 style={{ fontWeight: 900, fontSize: 28, marginBottom: 8 }}>
                🎁 Buy 5 Spins — Get 1 <span style={{ color: '#ffcb52' }}>FREE!</span>
              </h2>
              <p style={{ color: 'var(--Secondary)', fontSize: 14 }}>
                Price: <strong style={{ color: '#fff' }}>₹10 per spin</strong> · Coins credited instantly on win · Free spin resets every day
              </p>
            </div>
            <a href="#" className="tf-btn" style={{ fontSize: 18, padding: '0 48px', height: 56 }}>
              🌀 Spin Now — ₹10
            </a>
          </div>

          <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 60 }}>

            {/* Wheel Visual */}
            <div style={{ flex: '0 0 360px' }}>
              <div style={{
                width: 320, height: 320, borderRadius: '50%', margin: '0 auto',
                background: `conic-gradient(${REWARDS.map((r, i) => {
                  const start = REWARDS.slice(0, i).reduce((s, x) => s + parseFloat(x.probability), 0);
                  const end = start + parseFloat(r.probability);
                  return `${r.color} ${start}% ${end}%`;
                }).join(', ')})`,
                boxShadow: '0 0 40px rgba(245,166,35,0.3), 0 0 80px rgba(245,166,35,0.1)',
                border: '6px solid rgba(245,166,35,0.4)',
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'var(--Bg-2)', border: '3px solid #f5a623',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 13, textAlign: 'center', color: '#f5a623'
                }}>SPIN</div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <a href="#" className="tf-btn" style={{ margin: '0 auto', fontSize: 16, padding: '0 48px', height: 52 }}>
                  🌀 Spin for ₹10
                </a>
                <p style={{ color: 'var(--Secondary)', fontSize: 12, marginTop: 10 }}>
                  Or use your <strong style={{ color: '#ffcb52' }}>FREE spin</strong> (resets daily at midnight)
                </p>
              </div>
            </div>

            {/* Reward Table */}
            <div style={{ flex: 1, minWidth: 280 }}>
              <h3 style={{ fontWeight: 900, fontSize: 24, marginBottom: 20 }}>Possible Rewards</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {REWARDS.map((r) => (
                  <div key={r.label} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: 'var(--Bg-2)', borderRadius: 12, padding: '12px 20px',
                    border: r.coins > 0 ? `1px solid ${r.color}30` : '1px solid var(--Border)'
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      background: r.color, flexShrink: 0
                    }} />
                    <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{r.label}</span>
                    {r.coins > 0 && (
                      <span style={{ fontSize: 12, color: '#2ECC71', fontWeight: 700 }}>
                        +{r.coins.toLocaleString()} Coins
                      </span>
                    )}
                    <span style={{
                      fontSize: 12, color: 'var(--Secondary)',
                      background: 'var(--Bg-3)', borderRadius: 999, padding: '2px 10px'
                    }}>{r.probability}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* How Spin Works */}
          <div className="heading-section mb-32" style={{ textAlign: 'left' }}>
            <h2 className="title fw-9" style={{ fontSize: 36 }}>How It Works</h2>
          </div>
          <div className="grid-column-3" style={{ gap: 24, marginBottom: 60 }}>
            {[
              { icon: '💳', step: '01', title: 'Add Coins', desc: 'Deposit via UPI. 1 INR = 1 Coin. Minimum deposit ₹10.' },
              { icon: '🌀', step: '02', title: 'Spin the Wheel', desc: 'Pay 10 Coins per spin. Every 5th spin is FREE automatically.' },
              { icon: '🏆', step: '03', title: 'Win Instantly', desc: 'Coins credited to your wallet immediately. Withdraw anytime.' },
            ].map((item) => (
              <div key={item.step} style={{
                background: 'var(--Bg-2)', borderRadius: 16, padding: '28px 24px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{item.icon}</div>
                <p style={{
                  fontWeight: 900, fontSize: 64, lineHeight: 1,
                  background: 'linear-gradient(45deg,rgba(119,145,186,0),#7791ba 79%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  marginBottom: 12
                }}>{item.step}</p>
                <h4 style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>{item.title}</h4>
                <p style={{ color: 'var(--Secondary)', fontSize: 14 }}>{item.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </div>

      <footer id="footer">
        <div className="footer-bottom" style={{ paddingTop: 30, paddingBottom: 30 }}>
          <div className="tf-container">
            <div className="wrapper">
              <div className="center">
                <ul style={{ display: 'flex', gap: 24 }}>
                  <li><Link href="/">Home</Link></li>
                  <li><Link href="/games/lottery">Lottery</Link></li>
                  <li><Link href="/games/matka">Matka King</Link></li>
                </ul>
              </div>
              <div className="right"><span>2025 Supreme Gaming Engine</span></div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
