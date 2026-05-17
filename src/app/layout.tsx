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
        <link rel="stylesheet" href="/css/b75d11021ca9fab7.css" />
        <link rel="stylesheet" href="/css/29f8e8d639aa40ea.css" />
        <link rel="stylesheet" href="/css/dc1072aeb342c984.css" />
        <link rel="stylesheet" href="/css/4b0b69904f7263ad.css" />
        <link rel="stylesheet" href="/css/responsive.css" />
      </head>
      <body className="body popup-loader counter-scroll">
        <div id="wrapper">{children}</div>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}