import Link from 'next/link';

export default function LotteryPage() {
  return (
    <>
      <div className="tf-top-bar">
        <div className="content">
          <p>🎟️ Lottery — Smart search · Bulk buy · Alphanumeric tickets</p>
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
                        <li className="current-item"><Link href="/games/lottery">🎟️ Lottery</Link></li>
                        <li><Link href="/games/matka">🎰 Matka King</Link></li>
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
          <h1 className="title fw-9" style={{ fontSize: 50 }}>🎟️ Lottery</h1>
          <p style={{ color: 'var(--Secondary)', marginTop: 10 }}>
            Search tickets · Bulk buy bundles · Win big jackpots
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
            <Link href="/" style={{ color: 'var(--Secondary)', fontSize: 14 }}>Home</Link>
            <span style={{ color: 'var(--Secondary)' }}>›</span>
            <span style={{ color: 'var(--Main-color)', fontSize: 14 }}>Lottery</span>
          </div>
        </div>
      </div>

      <div className="main-content" style={{ paddingTop: 0 }}>
        <section className="tf-spacing-1">
          <div className="tf-container">

            {/* Search Bar */}
            <div className="heading-section mb-32">
              <h2 className="title fw-9" style={{ fontSize: 36 }}>Find Your Lucky Ticket</h2>
              <p className="sub-title fs-14">Type any number (e.g. 98) to instantly find AH0098, LI9821...</p>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
                <input
                  type="text"
                  placeholder="🔍 Search tickets... (e.g. 98, AH, 007)"
                  style={{
                    width: '100%', padding: '14px 20px', borderRadius: 999,
                    background: 'var(--Bg-3)', border: '1px solid var(--Border-2)',
                    color: 'var(--White)', fontSize: 16, outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Prefix', 'Suffix', 'Lucky #'].map((f) => (
                  <input key={f} type="text" placeholder={f}
                    style={{
                      width: 100, padding: '14px 16px', borderRadius: 999,
                      background: 'var(--Bg-3)', border: '1px solid var(--Border-2)',
                      color: 'var(--White)', fontSize: 13, outline: 'none'
                    }} />
                ))}
              </div>
            </div>

            {/* Quick Buy */}
            <div style={{
              background: 'var(--Bg-2)', borderRadius: 16, padding: '24px 30px',
              marginBottom: 40, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'
            }}>
              <span style={{ fontWeight: 700, color: 'var(--Secondary)', fontSize: 14 }}>⚡ QUICK BUY:</span>
              {[
                { qty: 10, price: 250 },
                { qty: 20, price: 500 },
                { qty: 50, price: 1250 },
              ].map(({ qty, price }) => (
                <a key={qty} href="#" className="tf-btn" style={{ height: 44, fontSize: 14, padding: '0 24px' }}>
                  {qty} Tickets — ₹{price}
                </a>
              ))}
              <span style={{ color: 'var(--Secondary)', fontSize: 13 }}>₹25 per ticket · 1 Coin = 1 INR</span>
            </div>

            {/* Available Series */}
            <div className="heading-section mb-32" style={{ textAlign: 'left' }}>
              <h3 className="title fw-9" style={{ fontSize: 28 }}>Available Series</h3>
            </div>

            <div className="grid-column-3" style={{ gap: 24 }}>
              {[
                { name: 'Dream Car Lottery I',  prefix: 'AH', range: 'AH0001 – AH9999', price: 25,  prize: '₹20,00,000', end: '15 Jun 2026', sold: 3820, total: 9999 },
                { name: 'Mega Jackpot II',       prefix: 'LI', range: 'LI0001 – LI9999', price: 50,  prize: '₹50,00,000', end: '30 Jun 2026', sold: 1200, total: 9999 },
                { name: 'Gold Rush Special',     prefix: 'GR', range: 'GR0001 – GR4999', price: 100, prize: '₹1,00,00,000',end: '10 Jul 2026', sold: 540,  total: 4999 },
              ].map((series) => (
                <div key={series.name} className="wg-game style-5" style={{ background: 'var(--Bg-4)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--Bg-2)', padding: '20px 20px 16px', borderBottom: '1px solid var(--Border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <h4 style={{ fontWeight: 900, fontSize: 18 }}>{series.name}</h4>
                      <span style={{
                        background: 'linear-gradient(270deg,#fe8c45,#ca2826)',
                        borderRadius: 999, padding: '2px 12px', fontSize: 12, fontWeight: 700
                      }}>OPEN</span>
                    </div>
                    <p style={{ color: 'var(--Secondary)', fontSize: 13 }}>Series: {series.range}</p>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <p style={{ color: 'var(--Secondary)', fontSize: 12, marginBottom: 2 }}>Prize Pool</p>
                        <p style={{ fontWeight: 900, fontSize: 20, color: '#ffcb52' }}>{series.prize}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: 'var(--Secondary)', fontSize: 12, marginBottom: 2 }}>Per Ticket</p>
                        <p style={{ fontWeight: 900, fontSize: 20 }}>₹{series.price}</p>
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--Secondary)', marginBottom: 4 }}>
                        <span>Sold: {series.sold.toLocaleString()}</span>
                        <span>Remaining: {(series.total - series.sold).toLocaleString()}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--Bg-2)', borderRadius: 999 }}>
                        <div style={{
                          height: '100%', borderRadius: 999,
                          background: 'linear-gradient(270deg,#fe8c45,#ca2826)',
                          width: `${(series.sold / series.total) * 100}%`
                        }} />
                      </div>
                    </div>
                    <p style={{ color: 'var(--Secondary)', fontSize: 12, marginBottom: 16 }}>
                      🗓️ Draw: {series.end}
                    </p>
                    <a href="#" className="tf-btn" style={{ width: '100%', justifyContent: 'center', height: 46 }}>
                      Buy Tickets — ₹{series.price} each
                    </a>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>
      </div>

      <footer id="footer">
        <div className="footer-bottom" style={{ paddingTop: 30, paddingBottom: 30 }}>
          <div className="tf-container">
            <div className="wrapper">
              <div className="center">
                <ul style={{ display: 'flex', gap: 24 }}>
                  <li><Link href="/">Home</Link></li>
                  <li><Link href="/games/matka">Matka King</Link></li>
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
