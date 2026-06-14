'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

// Floating theme toggle — appears on every page via root layout.
// The shared Header also has its own inline toggle; this one is the
// universal fallback so games pages (with custom headers) still get it.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('kh-theme')) as 'dark' | 'light' | null;
    const initial = saved ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    setMounted(true);

    // Keep in sync if another toggle (e.g. the header) changes it
    const observer = new MutationObserver(() => {
      const t = (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
      setTheme(t);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('kh-theme', next); } catch {}
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        zIndex: 9998,
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: '1px solid var(--Border)',
        background: 'var(--Bg-2)',
        color: 'var(--Main-color)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        transition: 'transform 0.2s, background 0.2s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
    </button>
  );
}
