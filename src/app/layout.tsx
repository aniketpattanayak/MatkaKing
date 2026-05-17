import type { Metadata } from 'next';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Supreme Gaming Engine',
  description: 'High-Density Multi-Game Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/images/logo/logo.png" />
        {/* Preconnect to DB + external APIs */}
        <link rel="preconnect" href="https://ep-summer-snow-aqi8pfq8-pooler.c-8.us-east-1.aws.neon.tech" />
        <link rel="dns-prefetch" href="https://api.qrserver.com" />

        {/* All CSS — load normally (React doesn't support onLoad string in JSX) */}
        <link rel="stylesheet" href="/css/b75d11021ca9fab7.css" />
        <link rel="stylesheet" href="/css/29f8e8d639aa40ea.css" />
        <link rel="stylesheet" href="/css/dc1072aeb342c984.css" />
        <link rel="stylesheet" href="/css/4b0b69904f7263ad.css" />
        <link rel="stylesheet" href="/css/icomoon-fix.css" />
      </head>
      <body className="body popup-loader counter-scroll">
        <div id="wrapper">{children}</div>
        <Toaster position="top-right" closeButton duration={2500} />
      </body>
    </html>
  );
}