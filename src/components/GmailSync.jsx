import React, { useState } from 'react';
import { getToken, clearToken, getCachedEmail, fetchGmailBalances } from '../lib/gmail.js';
import { fmtINR } from '../lib/format.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function GmailSync({ account, onBalance }) {
  const [phase, setPhase] = useState('idle'); // idle | connecting | searching | found | empty | error
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState('');
  const [gmailEmail, setGmailEmail] = useState(() => getCachedEmail());

  if (!CLIENT_ID) return null;

  const sync = async (selectAccount = false) => {
    setPhase('connecting');
    setError('');
    try {
      const { token, email: authEmail } = await getToken(CLIENT_ID, { selectAccount });
      if (authEmail) setGmailEmail(authEmail);
      setPhase('searching');
      const found = await fetchGmailBalances(token, account);
      setEmails(found);
      setPhase(found.length ? 'found' : 'empty');
    } catch (err) {
      clearToken();
      setError(err.message || 'Could not connect to Gmail.');
      setPhase('error');
    }
  };

  const apply = (balance) => {
    onBalance(String(balance));
    setPhase('idle');
  };

  return (
    <div style={{ marginTop: 6 }}>
      {phase === 'idle' && gmailEmail && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          {gmailEmail}
          <button type="button" onClick={() => sync(true)}
            style={{ fontSize: 11, color: 'var(--accent-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Switch account
          </button>
        </div>
      )}
      {phase === 'idle' && (
        <button
          type="button"
          onClick={() => sync(false)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            fontSize: 12, color: 'var(--text-dim)',
            border: '1px solid var(--line)', borderRadius: 8,
            padding: '5px 11px', background: 'transparent',
            cursor: 'pointer', transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text)';
            e.currentTarget.style.borderColor = '#333';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-dim)';
            e.currentTarget.style.borderColor = 'var(--line)';
          }}
        >
          <GoogleLogo size={13} />
          Sync from Gmail
        </button>
      )}

      {(phase === 'connecting' || phase === 'searching') && (
        <div style={{
          fontSize: 12, color: 'var(--text-faint)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
          {phase === 'connecting' ? 'Connecting to Gmail…' : 'Searching emails…'}
        </div>
      )}

      {phase === 'error' && (
        <div style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--negative)' }}>{error}</span>
          <button
            type="button"
            onClick={() => setPhase('idle')}
            style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-dim)' }}
          >
            Retry
          </button>
        </div>
      )}

      {phase === 'empty' && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          No matching emails found.
          <button
            type="button"
            onClick={() => setPhase('idle')}
            style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-dim)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {phase === 'found' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{
            padding: '6px 12px',
            fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--text-faint)', borderBottom: '1px solid var(--line)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>Found in Gmail — click to apply</span>
            <button
              type="button"
              onClick={() => setPhase('idle')}
              style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1, padding: 0 }}
            >
              ✕
            </button>
          </div>

          {emails.map((email, i) => (
            <button
              key={email.id}
              type="button"
              onClick={() => apply(email.balance)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 12px',
                borderBottom: i < emails.length - 1 ? '1px solid var(--line)' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'transparent', color: 'var(--text)',
                cursor: 'pointer', transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ minWidth: 0, paddingRight: 12 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {email.subject}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>
                  {email.from} · {email.date}
                </div>
              </div>
              <div style={{
                fontSize: 13.5, fontWeight: 500, color: 'var(--accent-text)',
                flexShrink: 0, fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtINR(email.balance)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GoogleLogo({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
