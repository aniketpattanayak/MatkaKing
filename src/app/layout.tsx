import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'KismatHub',
  description: 'KismatHub Gaming Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/css/b75d11021ca9fab7.css" />
        <link rel="stylesheet" href="/css/29f8e8d639aa40ea.css" />
        <link rel="stylesheet" href="/css/dc1072aeb342c984.css" />
        <link rel="stylesheet" href="/css/4b0b69904f7263ad.css" />
        <link rel="stylesheet" href="/css/responsive.css" />
        <link rel="stylesheet" href="/css/icomoon-fix.css" />
        {/* Inline style — overrides ::-webkit-input-placeholder{color:#171412} from 4b0b69904f7263ad.css
            External CSS files cannot reliably override vendor-prefixed placeholder pseudo-elements
            across all browsers. An inline <style> in <head> is the only guaranteed solution. */}
        <style dangerouslySetInnerHTML={{ __html: `
          /* Dark mode placeholder — white/translucent */
          ::-webkit-input-placeholder { color: rgba(255,255,255,0.5) !important; opacity: 1 !important; }
          ::-moz-placeholder          { color: rgba(255,255,255,0.5) !important; opacity: 1 !important; }
          :-ms-input-placeholder      { color: rgba(255,255,255,0.5) !important; opacity: 1 !important; }
          ::placeholder               { color: rgba(255,255,255,0.5) !important; opacity: 1 !important; }
          /* Light mode placeholder — dark grey */
          html[data-theme="light"] ::-webkit-input-placeholder { color: rgba(0,0,0,0.38) !important; opacity: 1 !important; }
          html[data-theme="light"] ::-moz-placeholder          { color: rgba(0,0,0,0.38) !important; opacity: 1 !important; }
          html[data-theme="light"] :-ms-input-placeholder      { color: rgba(0,0,0,0.38) !important; opacity: 1 !important; }
          html[data-theme="light"] ::placeholder               { color: rgba(0,0,0,0.38) !important; opacity: 1 !important; }
        ` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('kh-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();` }} />
      </head>
      <body className="body popup-loader counter-scroll">
        <div id="wrapper">{children}</div>
        <ThemeToggle />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
