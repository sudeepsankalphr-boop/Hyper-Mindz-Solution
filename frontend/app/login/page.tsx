'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGoogleLogin } from '@react-oauth/google';
import { API } from '@/lib/api';

// useGoogleLogin must be called inside GoogleOAuthProvider context.
// This component is only rendered after the provider mounts.
function GoogleLoginButton({
  disabled,
  setLoading,
  setError,
}: {
  disabled: boolean;
  setLoading: (v: boolean) => void;
  setError: (v: string) => void;
}) {
  const router = useRouter();
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API}/auth/google-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: tokenResponse.access_token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Google login failed');
        localStorage.setItem('token', data.access_token);
        router.push('/dashboard');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Google login failed');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Google sign-in was cancelled or failed'),
  });

  return (
    <button onClick={() => login()} disabled={disabled}
      style={{
        width: '100%', padding: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        background: '#fff', border: 'none', borderRadius: '8px', color: '#1a1a1a',
        fontFamily: "'Courier New', monospace", fontSize: '13px', fontWeight: 700,
        letterSpacing: '1px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
      }}>
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
        <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      CONTINUE WITH GOOGLE
    </button>
  );
}

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const router = useRouter();

  useEffect(() => { setGoogleReady(true); }, []);

  const handleSubmit = async () => {
    if (!email || !password) { setError('Email and password required'); return; }
    setLoading(true);
    setError('');
    try {
      const endpoint = isSignup ? '/auth/signup' : '/auth/login';
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Something went wrong');
      localStorage.setItem('token', data.access_token);
      await new Promise(resolve => setTimeout(resolve, 100));
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(0,212,170,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px', padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-block', background: 'linear-gradient(135deg, #00d4aa, #0066ff)', borderRadius: '12px', padding: '10px 16px', marginBottom: '16px' }}>
            <span style={{ color: '#fff', fontSize: '20px', fontWeight: 700, letterSpacing: '2px' }}>NL→SQL</span>
          </div>
          <div style={{ color: '#666', fontSize: '13px', letterSpacing: '1px' }}>ASK YOUR DATA IN PLAIN ENGLISH</div>
        </div>
        <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: '16px', padding: '32px' }}>
          <div style={{ display: 'flex', marginBottom: '28px', background: '#0a0a0f', borderRadius: '8px', padding: '4px' }}>
            {['Login', 'Sign Up'].map((tab, i) => (
              <button key={tab} onClick={() => { setIsSignup(i === 1); setError(''); }}
                style={{
                  flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  background: isSignup === (i === 1) ? '#00d4aa' : 'transparent',
                  color: isSignup === (i === 1) ? '#0a0a0f' : '#666',
                  fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                  letterSpacing: '1px', transition: 'all 0.2s',
                }}>
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
          {[
            { label: 'EMAIL', value: email, setter: setEmail, type: 'email', placeholder: 'you@company.com' },
            { label: 'PASSWORD', value: password, setter: setPassword, type: 'password', placeholder: '••••••••' },
          ].map(({ label, value, setter, type, placeholder }) => (
            <div key={label} style={{ marginBottom: '16px' }}>
              <div style={{ color: '#00d4aa', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px' }}>{label}</div>
              <input
                type={type}
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={placeholder}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{
                  width: '100%', padding: '12px 14px', boxSizing: 'border-box',
                  background: '#0a0a0f', border: '1px solid #1e1e2e',
                  borderRadius: '8px', color: '#fff', fontFamily: 'inherit',
                  fontSize: '14px', outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = '#00d4aa'}
                onBlur={e => e.target.style.borderColor = '#1e1e2e'}
              />
            </div>
          ))}
          {error && (
            <div style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#ff6060', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}
          <button onClick={handleSubmit} disabled={loading}
            style={{
              width: '100%', padding: '13px',
              background: loading ? '#1e1e2e' : 'linear-gradient(135deg, #00d4aa, #0066ff)',
              border: 'none', borderRadius: '8px', color: '#fff',
              fontFamily: 'inherit', fontSize: '13px', fontWeight: 700,
              letterSpacing: '2px', cursor: loading ? 'not-allowed' : 'pointer',
            }}>
            {loading ? 'CONNECTING...' : isSignup ? 'CREATE ACCOUNT' : 'LOGIN'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#1e1e2e' }} />
            <span style={{ color: '#444', fontSize: '11px', letterSpacing: '1px' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: '#1e1e2e' }} />
          </div>
          {googleReady
            ? <GoogleLoginButton disabled={loading} setLoading={setLoading} setError={setError} />
            : <button disabled style={{ width: '100%', padding: '13px', background: '#1a1a1a', border: 'none', borderRadius: '8px', color: '#444', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, letterSpacing: '1px', cursor: 'not-allowed' }}>CONTINUE WITH GOOGLE</button>
          }
        </div>
        <div style={{ textAlign: 'center', marginTop: '20px', color: '#333', fontSize: '12px' }}>
          HyperMindZ Assignment — NL-to-SQL System
        </div>
      </div>
    </div>
  );
}
