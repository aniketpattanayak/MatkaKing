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
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: 'linear-gradient(135deg, #1a0d2e 0%, #2d1b4e 100%)',
              border: '1px solid rgba(254,140,69,0.3)',
              color: '#fff',
              fontWeight: 600,
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            },
            classNames: {
              error:   'kh-toast-error',
              success: 'kh-toast-success',
              warning: 'kh-toast-warning',
              info:    'kh-toast-info',
            },
          }}
        />
      </body>
    </html>
  );
}