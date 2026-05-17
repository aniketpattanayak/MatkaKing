'use client';

interface LoaderProps {
  text?: string;
  fullScreen?: boolean;
}

export default function Loader({ text = 'Loading...', fullScreen = true }: LoaderProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      ...(fullScreen ? { minHeight: '80vh', width: '100%' } : { padding: '60px 0' }),
    }}>
      {/* Animated logo spinner */}
      <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 24 }}>
        {/* Outer ring */}
        <svg width="80" height="80" viewBox="0 0 80 80" style={{ position: 'absolute', top: 0, left: 0 }}>
          <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(254,140,69,0.15)" strokeWidth="4"/>
          <circle cx="40" cy="40" r="36" fill="none" stroke="url(#grad)" strokeWidth="4"
            strokeLinecap="round" strokeDasharray="180 226"
            style={{ animation: 'spin 1.2s linear infinite', transformOrigin: '40px 40px' }}/>
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fe8c45"/>
              <stop offset="100%" stopColor="#ca2826"/>
            </linearGradient>
          </defs>
        </svg>
        {/* Inner ring (opposite direction) */}
        <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: 'absolute', top: 12, left: 12 }}>
          <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,203,82,0.15)" strokeWidth="3"/>
          <circle cx="28" cy="28" r="24" fill="none" stroke="#ffcb52" strokeWidth="3"
            strokeLinecap="round" strokeDasharray="60 150"
            style={{ animation: 'spinReverse 0.9s linear infinite', transformOrigin: '28px 28px' }}/>
        </svg>
        {/* Center coin */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 20, animation: 'pulse 1.2s ease-in-out infinite'
        }}>💰</div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'linear-gradient(270deg,#fe8c45,#ca2826)',
            animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}/>
        ))}
      </div>

      <p style={{ color: 'var(--Secondary)', fontSize: 14, fontWeight: 600, letterSpacing: 0.5 }}>{text}</p>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spinReverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes pulse { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.2); } }
        @keyframes dotBounce { 0%,80%,100% { transform: scale(0.6); opacity:0.4; } 40% { transform: scale(1.1); opacity:1; } }
      `}</style>
    </div>
  );
}
