import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 20px', background: 'var(--Bg)' }}>
      <div>
        <div style={{ fontSize: 80, marginBottom: 16 }}>🎰</div>
        <h1 style={{ fontWeight: 900, fontSize: 48, marginBottom: 8, background: 'linear-gradient(270deg,#fe8c45,#ca2826)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          404
        </h1>
        <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>Page not found</h2>
        <p style={{ color: 'var(--Secondary)', fontSize: 15, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" className="tf-btn" style={{ height: 48, fontSize: 14, padding: '0 28px' }}>
            🏠 Go Home
          </Link>
          <Link href="/games/lottery" style={{ height: 48, fontSize: 14, padding: '0 28px', display: 'flex', alignItems: 'center', borderRadius: 999, border: '1px solid var(--Border)', color: 'var(--Secondary)' }}>
            🎟️ Play Lottery
          </Link>
        </div>
      </div>
    </div>
  );
}
