'use client';
import { createContext, useContext } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GoogleClientIdContext = createContext('');
export const useGoogleClientId = () => useContext(GoogleClientIdContext);

export function Providers({ children, googleClientId }: { children: React.ReactNode; googleClientId: string }) {
  return (
    <GoogleClientIdContext.Provider value={googleClientId}>
      {googleClientId
        ? <GoogleOAuthProvider clientId={googleClientId}>{children}</GoogleOAuthProvider>
        : <>{children}</>
      }
    </GoogleClientIdContext.Provider>
  );
}
