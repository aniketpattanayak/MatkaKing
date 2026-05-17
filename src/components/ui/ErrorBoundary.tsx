'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in dev, send to monitoring in prod
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '40vh', padding: '40px 20px', textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <AlertTriangle size={28} color="#ef4444" />
          </div>
          <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--Secondary)', fontSize: 14, marginBottom: 24, maxWidth: 400 }}>
            {this.state.error?.message ?? 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 24px', borderRadius: 999, border: 'none',
              background: 'linear-gradient(270deg,#fe8c45,#ca2826)',
              color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Lightweight inline error component ───────────────────────────────────────
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center',
      gap: 12, margin: '12px 0',
    }}>
      <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
      <p style={{ fontSize: 13, color: '#ef4444', flex: 1 }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} style={{
          padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)',
          background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer',
        }}>
          Retry
        </button>
      )}
    </div>
  );
}
