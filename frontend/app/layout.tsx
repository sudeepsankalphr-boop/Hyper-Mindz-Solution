import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers googleClientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
