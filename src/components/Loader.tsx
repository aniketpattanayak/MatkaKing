'use client';

interface LoaderProps {
  text?: string;
  fullScreen?: boolean;
}

export default function Loader({ text = 'Loading...', fullScreen = true }: LoaderProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      ...(fullScreen ? { minHeight: '70vh', width: '100%' } : { padding: '60px 0' }),
    }}>

      {/* Pure CSS spinner — no emoji */}
      <div style={{ position: 'relative', width: 64, height: 64, marginBottom: 20 }}>
        {/* Outer ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3px solid rgba(254,140,69,0.15)',
          borderTop: '3px solid #fe8c45',
          animation: 'sge-spin 0.9s linear infinite',
        }} />
        {/* Inner ring */}
        <div style={{
          position: 'absolute', inset: 10, borderRadius: '50%',
          border: '2px solid rgba(202,40,38,0.15)',
          borderBottom: '2px solid #ca2826',
          animation: 'sge-spin-rev 0.7s linear infinite',
        }} />
        {/* Centre dot */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: 'linear-gradient(135deg,#fe8c45,#ca2826)',
            animation: 'sge-pulse 1s ease-in-out infinite',
          }} />
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'linear-gradient(270deg,#fe8c45,#ca2826)',
            animation: `sge-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>

      <p style={{ color: 'var(--Secondary)', fontSize: 14, fontWeight: 600 }}>{text}</p>

      <style>{`
        @keyframes sge-spin     { to { transform: rotate(360deg); } }
        @keyframes sge-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes sge-pulse    { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.7} }
        @keyframes sge-bounce   { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1.1);opacity:1} }
      `}</style>
    </div>
  );
}
