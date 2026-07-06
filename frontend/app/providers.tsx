'use client';
import { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

export function Providers({ children, googleClientId }: { children: React.ReactNode; googleClientId: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !googleClientId) return <>{children}</>;

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {children}
    </GoogleOAuthProvider>
  );
}
