import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers googleClientId={process.env.GOOGLE_CLIENT_ID ?? ''}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
