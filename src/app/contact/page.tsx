import Link from 'next/link';
import Header from '@/components/layout/Header';

export default function ContactPage() {
  return (
    <>
      <Header />

      <div style={{ paddingTop: 160, paddingBottom: 80, textAlign: 'center' }}>
        <div className="tf-container">
          <h1 className="title fw-9" style={{ fontSize: 46, marginBottom: 12 }}>📬 Contact Us</h1>
          <p style={{ color: 'var(--Secondary)', fontSize: 16, marginBottom: 48 }}>
            Have a question? We are here to help.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, maxWidth: 900, margin: '0 auto 48px' }}>
            {[
              { icon: '📧', title: 'Email Support', value: 'support@supremegaming.in', sub: 'Reply within 24 hours' },
              { icon: '💬', title: 'Telegram', value: '@SupremeGamingSupport', sub: 'Fastest response' },
              { icon: '📞', title: 'WhatsApp', value: '+91 98765 43210', sub: 'Mon–Sat, 9AM–9PM IST' },
            ].map((item) => (
              <div key={item.title} style={{
                background: 'var(--Bg-2)', borderRadius: 16, padding: '28px 20px',
                border: '1px solid var(--Border)', textAlign: 'center'
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{item.icon}</div>
                <h4 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{item.title}</h4>
                <p style={{ color: 'var(--Main-color)', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{item.value}</p>
                <p style={{ color: 'var(--Secondary)', fontSize: 12 }}>{item.sub}</p>
              </div>
            ))}
          </div>

          {/* Contact Form */}
          <div style={{ background: 'var(--Bg-2)', borderRadius: 20, padding: 40, maxWidth: 560, margin: '0 auto', border: '1px solid var(--Border)', textAlign: 'left' }}>
            <h3 style={{ fontWeight: 900, fontSize: 22, marginBottom: 24, textAlign: 'center' }}>Send us a message</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--Secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Your Name</label>
                <input type="text" placeholder="Aniket Pattanayak" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'var(--Bg-3)', border: '1px solid var(--Border-2)', color: 'var(--White)', fontSize: 14, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--Secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Email</label>
                <input type="email" placeholder="you@example.com" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'var(--Bg-3)', border: '1px solid var(--Border-2)', color: 'var(--White)', fontSize: 14, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--Secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Subject</label>
                <input type="text" placeholder="Payment issue / Game query / Other" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'var(--Bg-3)', border: '1px solid var(--Border-2)', color: 'var(--White)', fontSize: 14, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--Secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Message</label>
                <textarea placeholder="Describe your issue or query..." rows={5} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'var(--Bg-3)', border: '1px solid var(--Border-2)', color: 'var(--White)', fontSize: 14, outline: 'none', resize: 'vertical' }} />
              </div>
              <button className="tf-btn" style={{ width: '100%', justifyContent: 'center', height: 50, fontSize: 15 }}>
                📨 Send Message
              </button>
            </div>
          </div>

          <div style={{ marginTop: 40 }}>
            <Link href="/" style={{ color: 'var(--Secondary)', fontSize: 14 }}>← Back to Home</Link>
          </div>
        </div>
      </div>

      <footer id="footer">
        <div className="footer-bottom" style={{ paddingTop: 28, paddingBottom: 28 }}>
          <div className="tf-container">
            <div className="wrapper">
              <div className="center"><ul style={{ display: 'flex', gap: 24 }}>
                <li><Link href="/">Home</Link></li>
                <li><Link href="/games/lottery">Lottery</Link></li>
                <li><Link href="/games/matka">Matka King</Link></li>
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
