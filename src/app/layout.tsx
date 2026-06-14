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
