import React, { useRef, useState } from 'react';
import { getToken, clearToken, getCachedEmail, fetchCasEmailBytes } from '../lib/gmail.js';
import { parseCasFromBytes } from '../lib/parseCas.js';
import { fmtINR } from '../lib/format.js';
import { ACCOUNT_TYPES } from '../lib/accountTypes.js';
import { storePassword, loadPassword, clearPassword } from '../lib/cryptoStore.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function normalizeKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findCandidates(holding, accounts) {
  if (holding.type === 'mutualFund') {
    return accounts.filter((a) => a.type === 'mutualFund');
  }
  if (holding.type === 'stock') {
    const hKey = normalizeKey(holding.broker || holding.nickname || '');
    return accounts.filter((a) => {
      if (a.type !== 'stock') return false;
      const aKey = normalizeKey(a.broker || a.nickname || '');
      return hKey && aKey && (aKey.includes(hKey) || hKey.includes(aKey));
    });
  }
  return [];
}

export default function CasSync({ accounts, onApply }) {
  const [phase, setPhase]         = useState('idle');
  const [error, setError]         = useState('');
  const [source, setSource]       = useState(null);
  const [casSource, setCasSource] = useState('');
  const [holdings, setHoldings]   = useState([]);
  const [password, setPassword]   = useState('');
  const [pendingBytes, setPendingBytes] = useState(null);
  const [selections, setSelections]    = useState({});
  const [gmailEmail, setGmailEmail]    = useState(() => getCachedEmail());
  const fileRef = useRef(null);

  const buildAutoSelections = (hs) => {
    const auto = {};
    hs.forEach((h, i) => {
      const candidates = findCandidates(h, accounts);
      if (candidates.length > 0) auto[i] = candidates[0].id;
    });
    return auto;
  };

  const processBytes = async (bytes, pwd = '', fromStore = false) => {
    setPhase('reading');
    setError('');
    try {
      const { source: src, holdings: raw } = await parseCasFromBytes(bytes, pwd);
      if (pwd) storePassword('cas', pwd);
      const hs = raw.filter((h) => Number(h.balance) > 0);
      setCasSource(src);
      setHoldings(hs);
      setSelections(buildAutoSelections(hs));
      setPhase(hs.length > 0 ? 'done' : 'empty');
    } catch (err) {
      if (err?.name === 'PasswordException' || err?.code === 1 || err?.code === 2) {
        setPendingBytes(bytes);
        if (fromStore) {
          clearPassword('cas');
        } else if (pwd) {
          setError('Incorrect password — try again.');
        }
        setPhase('locked');
      } else {
        setError(err.message || 'Could not read PDF.');
        setPhase('error');
      }
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setSource({ subject: file.name, from: 'Uploaded PDF', date: '' });
    setPendingBytes(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await loadPassword('cas');
    processBytes(bytes, stored || '', Boolean(stored));
  };

  const fetchFromGmail = async (pwd = '', fromStore = false, selectAccount = false) => {
    setPhase('fetching');
    setError('');
    setPendingBytes(null);
    try {
      const { token, email: authEmail } = await getToken(CLIENT_ID, { selectAccount });
      if (authEmail) setGmailEmail(authEmail);
      const email = await fetchCasEmailBytes(token);
      if (!email) {
        setError('No CAS email found in Gmail (last 365 days).');
        setPhase('error');
        return;
      }
      setSource({ subject: email.subject, from: email.from, date: email.date });
      processBytes(email.bytes, pwd, fromStore);
    } catch (err) {
      clearToken();
      setError(err.message || 'Could not fetch from Gmail.');
      setPhase('error');
    }
  };

  const handleFetchGmail = async (selectAccount = false) => {
    const stored = await loadPassword('cas');
    fetchFromGmail(stored || '', Boolean(stored), selectAccount);
  };

  const unlock = () => {
    if (!password) return;
    if (pendingBytes) processBytes(pendingBytes, password, false);
    else fetchFromGmail(password, false);
  };

  const apply = () => {
    const updates = [];
    holdings.forEach((h, i) => {
      const accountId = selections[i];
      if (accountId) updates.push({ accountId, balance: Number(h.balance) });
    });
    if (updates.length) onApply(updates);
    setPhase('applied');
  };

  const reset = () => {
    setPhase('idle'); setError(''); setPassword('');
    setPendingBytes(null); setHoldings([]); setSelections({});
  };

  const hasAnySelection = Object.values(selections).some(Boolean);

  const btnStyle = {
    fontSize: 12, color: 'var(--text-dim)',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: '1px solid var(--line)', borderRadius: 8,
    padding: '4px 10px', background: 'transparent', cursor: 'pointer',
  };

  return (
    <div style={{
      marginBottom: 28, padding: '16px 18px',
      border: '1px solid var(--line)', borderRadius: 12,
      background: 'var(--surface)',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: phase === 'idle' ? 0 : 14,
      }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            CAS Sync
          </div>
          {phase === 'idle' && (
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3, maxWidth: 340, lineHeight: 1.4 }}>
              Consolidated Account Statement — update all portfolio balances at once
            </div>
          )}
        </div>

        {phase === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, marginLeft: 16 }}>
            {CLIENT_ID && gmailEmail && (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {gmailEmail}
                <button type="button" onClick={() => handleFetchGmail(true)}
                  style={{ fontSize: 11, color: 'var(--accent-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Switch
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
            {CLIENT_ID && (
              <button type="button" onClick={() => handleFetchGmail(false)} style={btnStyle}>
                Fetch from Gmail
              </button>
            )}
            <button type="button" onClick={() => fileRef.current?.click()} style={btnStyle}>
              Upload PDF
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            </div>
          </div>
        )}

        {(phase === 'done' || phase === 'applied' || phase === 'empty') && (
          <button type="button" onClick={reset}
            style={{ fontSize: 13, color: 'var(--text-faint)', padding: 0, flexShrink: 0 }}>
            ✕
          </button>
        )}
      </div>

      {/* Loading */}
      {(phase === 'fetching' || phase === 'reading') && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
          {phase === 'fetching' ? 'Searching Gmail for CAS email…' : 'Reading PDF…'}
        </div>
      )}

      {/* Password prompt */}
      {phase === 'locked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {source?.subject && (
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>
              {source.subject}
              {source.date && <span style={{ opacity: 0.7 }}> · {source.date}</span>}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            PDF is password-protected. CAS password is usually your PAN (e.g.{' '}
            <span style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>ABCDE1234F</span>).
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--negative)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Enter PAN or password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && unlock()}
              autoFocus
              style={{
                flex: 1, fontSize: 13, padding: '5px 10px',
                border: '1px solid var(--line)', borderRadius: 8,
                background: 'var(--surface-2)', color: 'var(--text)',
                outline: 'none', fontFamily: 'monospace', letterSpacing: '0.05em',
              }}
            />
            <button type="button" onClick={unlock} disabled={!password}
              style={{ ...btnStyle, opacity: password ? 1 : 0.5, cursor: password ? 'pointer' : 'default' }}>
              Unlock
            </button>
            <button type="button" onClick={reset}
              style={{ fontSize: 12, color: 'var(--text-faint)', padding: '5px 4px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--negative)' }}>{error}</span>
          <button type="button" onClick={reset}
            style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-dim)' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Empty */}
      {phase === 'empty' && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          No holdings extracted from this CAS.
          <button type="button" onClick={reset}
            style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-dim)' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Success confirmation */}
      {phase === 'applied' && (
        <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--positive)' }}>Account balances updated from CAS.</span>
          <button type="button" onClick={reset}
            style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Done
          </button>
        </div>
      )}

      {/* Holdings + account matching */}
      {phase === 'done' && holdings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Source info */}
          {source && (
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>
              {source.subject}
              {source.from && source.from !== 'Uploaded PDF' && (
                <span style={{ opacity: 0.7 }}> · {source.from}</span>
              )}
              {source.date && <span style={{ opacity: 0.7 }}> · {source.date}</span>}
              {casSource && casSource !== 'unknown' && (
                <span style={{ opacity: 0.7 }}> · {casSource.toUpperCase()}</span>
              )}
            </div>
          )}

          {/* Per-holding rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {holdings.map((holding, i) => {
              const candidates = findCandidates(holding, accounts);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    background: 'var(--surface-2)',
                  }}
                >
                  {/* Holding info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {holding.nickname}
                    </div>
                    {holding._source && (
                      <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 1 }}>
                        {holding._source}
                      </div>
                    )}
                  </div>

                  {/* Value */}
                  <div style={{
                    fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                    color: 'var(--positive)', flexShrink: 0,
                  }}>
                    {fmtINR(Number(holding.balance))}
                  </div>

                  {/* Account match picker */}
                  {candidates.length > 0 ? (
                    <select
                      value={selections[i] || ''}
                      onChange={(e) => setSelections((s) => ({ ...s, [i]: e.target.value }))}
                      style={{
                        fontSize: 11.5, padding: '4px 8px',
                        border: '1px solid var(--line)', borderRadius: 7,
                        background: 'var(--surface)', color: 'var(--text)',
                        cursor: 'pointer', maxWidth: 170, flexShrink: 0,
                      }}
                    >
                      <option value=''>Skip</option>
                      {candidates.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nickname || ACCOUNT_TYPES[a.type]?.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>
                      No account match
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Apply button */}
          {hasAnySelection && (
            <button
              type="button"
              onClick={apply}
              style={{
                fontSize: 13, padding: '8px 0', width: '100%',
                border: '1px solid var(--accent-text)', borderRadius: 8,
                background: 'transparent', color: 'var(--accent-text)',
                cursor: 'pointer', fontWeight: 500, marginTop: 2,
              }}
            >
              Update selected accounts
            </button>
          )}
        </div>
      )}
    </div>
  );
}
