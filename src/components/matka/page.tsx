import Link from 'next/link';

const MARKETS = [
  { name: 'Milan Day',   open: '09:30 AM', close: '11:30 AM', result: '12:00 PM', status: 'OPEN',   jodi: '67', patti: '123-6' },
  { name: 'Kalyan',      open: '03:45 PM', close: '05:45 PM', result: '06:00 PM', status: 'OPEN',   jodi: '34', patti: '456-5' },
  { name: 'Milan Night', open: '09:00 PM', close: '11:00 PM', result: '11:30 PM', status: 'CLOSED', jodi: '89', patti: '789-4' },
];

const BET_TYPES = [
  { type: 'Single Ank',    payout: '90x',    desc: 'Pick one digit 0-9' },
  { type: 'Jodi',          payout: '900x',   desc: 'Pick two digits 00-99' },
  { type: 'Single Patti',  payout: '140x',   desc: '3 different digits' },
  { type: 'Double Patti',  payout: '280x',   desc: '2 same + 1 different digit' },
  { type: 'Triple Patti',  payout: '450x',   desc: 'All 3 digits same' },
  { type: 'Half Sangam',   payout: '1,500x', desc: 'Ank + Patti combo' },
  { type: 'Full Sangam',   payout: '11,000x',desc: 'Open Patti + Close Patti' },
];

export default function MatkaPage() {
  return (
    <>
      <div className="tf-top-bar">
        <div className="content">
          <p>🎰 Matka King — Patti · Jodi · Sangam · Win up to 11,000x your bet!</p>
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
                        <li className="current-item"><Link href="/games/matka">🎰 Matka King</Link></li>
                        <li><Link href="/games/spin">🌀 Spin Wheel</Link></li>
                      </ul>
                    </li>
                    <li><Link href="/dashboard">MY ACCOUNT</Link></li>
                    <li><Link href="/">HOME</Link></li>
                  </ul>
                </nav>
                <div className="header-right">
                  <div className="btn-buy-tickets">
                    <Link className="tf-btn" href="/games/lottery">
                      Buy Tickets
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
          <h1 className="title fw-9" style={{ fontSize: 50 }}>🎰 Matka King</h1>
          <p style={{ color: 'var(--Secondary)', marginTop: 10 }}>
            Place bets on Patti · Jodi · Sangam · Single Ank — Results declared twice daily
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
            <Link href="/" style={{ color: 'var(--Secondary)', fontSize: 14 }}>Home</Link>
            <span style={{ color: 'var(--Secondary)' }}>›</span>
            <span style={{ color: 'var(--Main-color)', fontSize: 14 }}>Matka King</span>
          </div>
        </div>
      </div>

      <div className="main-content" style={{ paddingTop: 0 }}>
        <div className="tf-container">

          {/* Live Markets */}
          <div className="heading-section mb-32" style={{ textAlign: 'left' }}>
            <h2 className="title fw-9" style={{ fontSize: 36 }}>Live Markets</h2>
            <p className="sub-title fs-14">Select a market and place your bet before it closes</p>
          </div>

          <div className="grid-column-3" style={{ gap: 24, marginBottom: 60 }}>
            {MARKETS.map((market) => (
              <div key={market.name} style={{
                background: 'var(--Bg-2)', borderRadius: 16, overflow: 'hidden',
                border: market.status === 'OPEN' ? '1px solid rgba(254,140,69,0.3)' : '1px solid var(--Border)'
              }}>
                {/* Header */}
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--Border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <h3 style={{ fontWeight: 900, fontSize: 22 }}>{market.name}</h3>
                    <span style={{
                      padding: '3px 14px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: market.status === 'OPEN' ? 'linear-gradient(270deg,#fe8c45,#ca2826)' : 'var(--Bg-3)',
                      color: market.status === 'OPEN' ? '#fff' : 'var(--Secondary)'
                    }}>{market.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--Secondary)' }}>
                    <span>🟢 Open: {market.open}</span>
                    <span>🔴 Close: {market.close}</span>
                  </div>
                </div>

                {/* Today's Result */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--Border)' }}>
                  <p style={{ fontSize: 11, color: 'var(--Secondary)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>
                    Today's Result
                  </p>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 10, color: 'var(--Secondary)', marginBottom: 4 }}>Patti-Ank</p>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 900, fontSize: 20,
                        background: 'linear-gradient(180deg,#ffcb52,#ff7b02)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                      }}>{market.patti}</span>
                    </div>
                    <div style={{ width: 1, height: 36, background: 'var(--Border)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 10, color: 'var(--Secondary)', marginBottom: 4 }}>Jodi</p>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 900, fontSize: 28,
                        background: 'linear-gradient(180deg,#ffcb52,#ff7b02)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                      }}>{market.jodi}</span>
                    </div>
                  </div>
                </div>

                {/* Place Bet */}
                <div style={{ padding: '16px 24px' }}>
                  {market.status === 'OPEN' ? (
                    <a href="#" className="tf-btn" style={{ width: '100%', justifyContent: 'center', height: 46 }}>
                      Place Bet on {market.name}
                    </a>
                  ) : (
                    <div style={{
                      textAlign: 'center', padding: '12px', borderRadius: 12,
                      background: 'var(--Bg-3)', color: 'var(--Secondary)', fontSize: 13
                    }}>
                      Next open: {market.open} tomorrow
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Payout Table */}
          <div className="heading-section mb-32" style={{ textAlign: 'left' }}>
            <h2 className="title fw-9" style={{ fontSize: 36 }}>Bet Types & Payouts</h2>
            <p className="sub-title fs-14">Higher risk = higher reward. Patti 3-digit → Ank = sum % 10</p>
          </div>

          <div className="grid-column-3" style={{ gap: 16, marginBottom: 60 }}>
            {BET_TYPES.map((b) => (
              <div key={b.type} style={{
                background: 'var(--Bg-2)', borderRadius: 12, padding: '20px 24px',
                border: '1px solid var(--Border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <p style={{ fontWeight: 700, marginBottom: 4 }}>{b.type}</p>
                  <p style={{ color: 'var(--Secondary)', fontSize: 12 }}>{b.desc}</p>
                </div>
                <span style={{
                  fontWeight: 900, fontSize: 18,
                  background: 'linear-gradient(180deg,#ffcb52,#ff7b02)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                }}>{b.payout}</span>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div style={{
            background: 'var(--Bg-2)', borderRadius: 16, padding: '32px 40px', marginBottom: 60,
            border: '1px solid rgba(254,140,69,0.2)'
          }}>
            <h3 style={{ fontWeight: 900, fontSize: 24, marginBottom: 20 }}>📐 How Matka Math Works</h3>
            <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: 'var(--Secondary)', fontSize: 14, marginBottom: 8 }}>Patti → Ank formula:</p>
                <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#ffcb52' }}>
                  1 + 2 + 3 = 6 → "123-6"
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--Secondary)', fontSize: 14, marginBottom: 8 }}>Jodi formula:</p>
                <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#ffcb52' }}>
                  Open Ank (6) + Close Ank (7) = "67"
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--Secondary)', fontSize: 14, marginBottom: 8 }}>Full result format:</p>
                <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#ffcb52' }}>
                  123-6 | 67 | 7-456
                </p>
              </div>
            </div>
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
                  <li><Link href="/games/spin">Spin Wheel</Link></li>
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
