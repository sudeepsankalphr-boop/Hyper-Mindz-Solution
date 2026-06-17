'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://hyper-mindz-solution-production.up.railway.app';

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
    } catch (err: any) {
      setError(err.message);
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
        </div>
        <div style={{ textAlign: 'center', marginTop: '20px', color: '#333', fontSize: '12px' }}>
          HyperMindZ Assignment — NL-to-SQL System
        </div>
      </div>
    </div>
  );
}