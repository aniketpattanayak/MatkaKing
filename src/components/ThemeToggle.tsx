'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark'|'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = (document.documentElement.getAttribute('data-theme') as 'dark'|'light') || 'dark';
    setTheme(t);
    setMounted(true);
    const obs = new MutationObserver(() => {
      setTheme((document.documentElement.getAttribute('data-theme') as 'dark'|'light') || 'dark');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('kh-theme', next); } catch {}
  };

  if (!mounted) return null;

  return (
    <button onClick={toggle} className="kh-theme-toggle"
      title={theme==='dark'?'Light mode':'Dark mode'}>
      {theme==='dark' ? <Sun size={22}/> : <Moon size={22}/>}
    </button>
  );
}
