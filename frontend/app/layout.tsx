import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'HyperMindZ — NL to SQL',
  description: 'Ask your CSV data questions in plain English',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HyperMindZ',
  },
};

export const viewport: Viewport = {
  themeColor: '#00d4aa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <Providers googleClientId={process.env.GOOGLE_CLIENT_ID ?? ''}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
