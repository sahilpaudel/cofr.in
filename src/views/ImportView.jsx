import React, { useRef, useState, useMemo } from 'react';
import { Icon } from '../icons/Icon.jsx';
import ComingSoonCard from '../components/ComingSoonCard.jsx';
import { findMatchingAccount } from '../lib/importMerge.js';
import { fmtINR } from '../lib/format.js';
import { parseCasFromBytes } from '../lib/parseCas.js';
import { getToken, clearToken, getCachedEmail, fetchCasEmailBytes } from '../lib/gmail.js';
import { storePassword, loadPassword, clearPassword } from '../lib/cryptoStore.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const SOURCE_LABEL = {
  cdsl: 'CDSL',
  nsdl: 'NSDL',
  kfintech: 'KFintech',
  cams: 'CAMS',
  unknown: 'CAS',
};

export default function ImportView({ onAdd, onImport, existingAccounts = [], members = [] }) {
  const [file, setFile]             = useState(null);
  const [emailMeta, setEmailMeta]   = useState(null); // { subject, from, date }
  const [status, setStatus]         = useState(null); // null | 'fetching' | 'parsing' | 'locked' | { source, holdings } | { error }
  const [pendingBytes, setPendingBytes] = useState(null);
  const [password, setPassword]     = useState('');
  const [pwError, setPwError]       = useState('');
  const [imported, setImported]     = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(null); // null = first member
  const [updateConfirm, setUpdateConfirm] = useState(null);
  const [gmailEmail, setGmailEmail] = useState(() => getCachedEmail()); // null | [{nickname, oldBalance, newBalance}]
  const inputRef = useRef();

  // Filter existing accounts to only the selected owner so the preview
  // correctly shows "add" vs "update" per member.
  const ownerAccounts = useMemo(
    () => existingAccounts.filter(a => (a.ownerId ?? null) === (selectedOwner ?? null)),
    [existingAccounts, selectedOwner]
  );

  const previewRows = useMemo(() => {
    if (!status?.holdings) return [];
    return status.holdings.map(holding => ({
      holding,
      match: findMatchingAccount(holding, ownerAccounts),
    }));
  }, [status, ownerAccounts]);

  // Both file and Gmail paths converge here.
  // fromStore=true means the password was auto-tried from storage (not user-typed).
  const parseBytes = async (bytes, pwd = '', fromStore = false) => {
    setStatus('parsing');
    setPwError('');
    try {
      const result = await parseCasFromBytes(bytes, pwd);
      if (pwd) storePassword('cas', pwd); // fire-and-forget
      setStatus(result);
    } catch (err) {
      if (err?.name === 'PasswordException' || err?.code === 1 || err?.code === 2) {
        setPendingBytes(bytes);
        if (fromStore) {
          clearPassword('cas'); // stored password no longer valid
        } else if (pwd) {
          setPwError('Incorrect password — try again.');
        }
        setStatus('locked');
      } else {
        setStatus({ error: err.message || 'Could not parse this PDF.' });
      }
    }
  };

  // File upload path.
  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setEmailMeta(null);
    setImported(false);
    setPendingBytes(null);
    setPassword('');
    setPwError('');
    setStatus('parsing');
    const bytes = new Uint8Array(await f.arrayBuffer());
    const stored = await loadPassword('cas');
    parseBytes(bytes, stored || '', Boolean(stored));
  };

  // Gmail path.
  const fetchFromGmail = async (selectAccount = false) => {
    setFile(null);
    setEmailMeta(null);
    setImported(false);
    setPendingBytes(null);
    setPassword('');
    setPwError('');
    setStatus('fetching');
    try {
      const { token, email: authEmail } = await getToken(CLIENT_ID, { selectAccount });
      if (authEmail) setGmailEmail(authEmail);
      const email = await fetchCasEmailBytes(token);
      if (!email) {
        setStatus({ error: 'No CAS email found in Gmail (last 365 days).' });
        return;
      }
      setEmailMeta({ subject: email.subject, from: email.from, date: email.date });
      const stored = await loadPassword('cas');
      parseBytes(email.bytes, stored || '', Boolean(stored));
    } catch (err) {
      clearToken();
      setStatus({ error: err.message || 'Could not fetch from Gmail.' });
    }
  };

  const unlock = () => {
    if (!password || !pendingBytes) return;
    parseBytes(pendingBytes, password, false);
  };

  const handleImport = () => {
    if (!status?.holdings) return;
    onImport(status.holdings, selectedOwner);
    setImported(true);
    setUpdateConfirm(null);
  };

  const requestImport = () => {
    const updates = previewRows
      .filter(r => r.match)
      .map(r => ({
        nickname: r.match.nickname || r.holding.nickname,
        oldBalance: r.match.balance ?? r.match.units ?? null,
        newBalance: r.holding.balance ?? r.holding.units ?? null,
        oldLabel:   r.match.balance != null ? 'balance' : 'units',
      }));
    if (updates.length > 0) {
      setUpdateConfirm(updates);
    } else {
      handleImport();
    }
  };

  const reset = () => {
    setFile(null);
    setEmailMeta(null);
    setStatus(null);
    setPendingBytes(null);
    setPassword('');
    setPwError('');
    setImported(false);
  };

  const sourceName = file?.name || emailMeta?.subject || '';
  const isIdle = !file && !emailMeta && status === null;

  return (
    <div className="pt-14 fade" style={{ maxWidth: 720 }}>
      <div className="eyebrow mb-3">Import</div>
      <h1 style={{
        fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 8vw, 44px)',
        letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 0, marginBottom: 16,
      }}>
        Bring it all in,<br />without the spreadsheet.
      </h1>
      <p style={{
        fontSize: 15, color: 'var(--text-dim)',
        maxWidth: 580, lineHeight: 1.6, margin: 0,
      }}>
        Upload a consolidated account statement or fetch it from Gmail — Coffer reads
        the broker-wise demat totals and mutual-fund folios total locally, never leaving
        your device.
      </p>

      <div className="import-card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          <div className="import-icon">
            <Icon name="pdf" size={20} stroke={1.5} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 15, margin: 0 }}>
                Consolidated Account Statement (CAS)
              </h3>
              <span className="pill pill-accent">mutual funds</span>
              <span className="pill pill-accent">equities</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
              Request a CAS from <span style={{ color: 'var(--text)' }}>CAMS</span> or{' '}
              <span style={{ color: 'var(--text)' }}>KFintech</span>, or use the{' '}
              <span style={{ color: 'var(--text)' }}>CDSL</span> consolidated statement.
              Coffer reads the consolidated summary and creates broker-wise accounts plus
              one mutual-fund folios total.
            </p>

            <div style={{ marginTop: 20 }}>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => { handleFile(e.target.files?.[0] || null); inputRef.current.value = ''; }}
              />

              {/* Idle — choose source */}
              {isIdle && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {CLIENT_ID && gmailEmail && (
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Gmail: {gmailEmail}
                      <button type="button" onClick={() => fetchFromGmail(true)}
                        style={{ fontSize: 11, color: 'var(--accent-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        Switch account
                      </button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn-primary" onClick={() => inputRef.current?.click()}>
                      <Icon name="upload" size={14} stroke={1.6} /> Upload PDF
                    </button>
                    {CLIENT_ID && (
                      <button className="btn-ghost" onClick={() => fetchFromGmail(false)}>
                        Fetch from Gmail
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Fetching from Gmail */}
              {status === 'fetching' && (
                <div style={{
                  padding: 12, border: '1px solid var(--line)', borderRadius: 10,
                  fontSize: 13, color: 'var(--text-dim)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                  Searching Gmail for CAS email…
                </div>
              )}

              {/* Parsing PDF */}
              {status === 'parsing' && (
                <div style={{
                  padding: 12, border: '1px solid var(--line)', borderRadius: 10,
                  fontSize: 13, color: 'var(--text-dim)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                  Parsing {sourceName || 'PDF'}…
                </div>
              )}

              {/* Password locked */}
              {status === 'locked' && (
                <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sourceName && (
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {sourceName}
                      {emailMeta?.date && <span style={{ opacity: 0.7 }}> · {emailMeta.date}</span>}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                    PDF is password-protected. CAS password is usually your PAN (e.g.{' '}
                    <span style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>ABCDE1234F</span>).
                  </div>
                  {pwError && <div style={{ fontSize: 12, color: 'var(--negative)' }}>{pwError}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Enter PAN or password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && unlock()}
                      autoFocus
                      style={{
                        flex: 1, fontSize: 13, padding: '7px 10px',
                        border: '1px solid var(--line)', borderRadius: 8,
                        background: 'var(--surface-2)', color: 'var(--text)',
                        outline: 'none', fontFamily: 'monospace', letterSpacing: '0.05em',
                      }}
                    />
                    <button className="btn-primary" onClick={unlock} disabled={!password}>
                      Unlock
                    </button>
                    <button className="btn-ghost" onClick={reset}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Parse error */}
              {status?.error && (
                <div style={{
                  padding: 12, border: '1px solid #ff6b6b44', borderRadius: 10,
                  background: '#ff6b6b11',
                }}>
                  <div style={{ fontSize: 13, color: '#ff6b6b', marginBottom: 6 }}>Could not parse this PDF</div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>{status.error}</div>
                  <button className="btn-ghost" onClick={reset}>Try again</button>
                </div>
              )}

              {/* Parse success */}
              {status?.holdings && (() => {
                const rows = previewRows;
                const updateCount = rows.filter((r) => r.match).length;
                const newCount    = rows.length - updateCount;

                return (
                  <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 10 }}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {SOURCE_LABEL[status.source] || 'CAS'} · {status.holdings.length} account{status.holdings.length !== 1 ? 's' : ''} found
                        {updateCount > 0 && (
                          <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>
                            {' '}· {updateCount} will update
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                        {emailMeta ? (
                          <>
                            {emailMeta.subject}
                            {emailMeta.date && <span style={{ opacity: 0.7 }}> · {emailMeta.date}</span>}
                          </>
                        ) : file?.name}
                      </div>
                    </div>

                    {/* Owner picker — only shown when family members exist */}
                    {members.length > 1 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>
                          Import for
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {members.map((m, i) => {
                            const val = i === 0 ? null : m.id;
                            const active = (selectedOwner ?? null) === val;
                            return (
                              <button
                                key={m.id}
                                onClick={() => setSelectedOwner(val)}
                                style={{
                                  fontSize: 12, padding: '4px 12px', borderRadius: 20,
                                  border: `1px solid ${active ? m.color || 'var(--text)' : 'var(--line)'}`,
                                  background: active ? (m.color || 'var(--text)') + '22' : 'transparent',
                                  color: active ? (m.color || 'var(--text)') : 'var(--text-dim)',
                                  cursor: 'pointer', fontWeight: active ? 600 : 400,
                                }}
                              >
                                {i === 0 ? `${m.name} (you)` : m.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
                      <button className="btn-ghost" onClick={reset}>
                        {imported ? 'Import another' : 'Cancel'}
                      </button>
                      {imported ? (
                        <button className="btn-primary" disabled style={{ opacity: 0.5 }}>Imported</button>
                      ) : rows.length > 0 ? (
                        <button className="btn-primary" onClick={requestImport}>
                          {newCount > 0 && updateCount > 0
                            ? `${newCount} new · ${updateCount} update${updateCount !== 1 ? 's' : ''}`
                            : newCount > 0
                              ? `Add ${newCount} account${newCount !== 1 ? 's' : ''}`
                              : `Update ${updateCount} account${updateCount !== 1 ? 's' : ''}`}
                        </button>
                      ) : (
                        <button className="btn-ghost" style={{ color: 'var(--text-faint)' }} disabled>Nothing to import</button>
                      )}
                    </div>

                    {status.holdings.length > 0 && (
                      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', fontSize: 12 }}>
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 90px',
                          background: 'var(--surface-2)',
                          borderBottom: '1px solid var(--line)',
                          padding: '6px 12px',
                          color: 'var(--text-faint)', fontWeight: 500,
                        }}>
                          <span>Account</span>
                          <span style={{ textAlign: 'right' }}>Value</span>
                        </div>
                        {status.holdings.slice(0, 8).map((h, i) => {
                          const isUpdate = Boolean(rows[i]?.match);
                          const identifier = h.isin || h.folio || '';
                          return (
                            <div key={i} style={{
                              display: 'grid', gridTemplateColumns: '1fr 90px',
                              padding: '7px 12px',
                              borderBottom: i < Math.min(status.holdings.length, 8) - 1 ? '1px solid var(--line)' : 'none',
                              alignItems: 'center',
                              opacity: isUpdate ? 0.75 : 1,
                            }}>
                              <span style={{
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                paddingRight: 8, display: 'flex', alignItems: 'center', gap: 6,
                              }}>
                                {h.nickname}
                                {identifier && (
                                  <span style={{
                                    fontSize: 10, color: 'var(--text-faint)',
                                    border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                                  }}>{identifier}</span>
                                )}
                                {isUpdate && (
                                  <span style={{
                                    fontSize: 10, color: 'var(--text-faint)',
                                    border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                                  }}>updates</span>
                                )}
                              </span>
                              <span style={{ textAlign: 'right' }}>
                                ₹{Number(h.balance).toLocaleString('en-IN')}
                              </span>
                            </div>
                          );
                        })}
                        {status.holdings.length > 8 && (
                          <div style={{ padding: '6px 12px', color: 'var(--text-faint)', borderTop: '1px solid var(--line)' }}>
                            +{status.holdings.length - 8} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6 }}>
                Parsing happens entirely in your browser. The PDF and your data never leave this device.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="import-grid">
        <ComingSoonCard
          title="Broker contract notes"
          desc="Drop Zerodha · Groww · Upstox contract note PDFs to reconcile holdings."
          tag="soon"
        />
        <ComingSoonCard
          title="Bank & CC statements"
          desc="Import multiple statements at once and get a unified spending view across all accounts."
          tag="soon"
        />
      </div>

      <div style={{
        marginTop: 48, paddingTop: 24,
        borderTop: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Prefer manual? You can always add accounts by hand.</div>
        <button className="btn-ghost" onClick={onAdd}>
          <Icon name="plus" size={13} stroke={1.8} /> Add manually
        </button>
      </div>

      {/* Update confirmation modal */}
      {updateConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            width: '100%', maxWidth: 420,
            background: 'var(--surface)', borderRadius: 14,
            border: '1px solid var(--line)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '20px 20px 16px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                Update {updateConfirm.length} account{updateConfirm.length !== 1 ? 's' : ''}?
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                These existing accounts will be overwritten with new values.
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
              {updateConfirm.map((u, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 20px',
                  borderBottom: i < updateConfirm.length - 1 ? '1px solid var(--line)' : 'none',
                  fontSize: 13,
                }}>
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, paddingRight: 12, color: 'var(--text)',
                  }}>
                    {u.nickname}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                      {u.oldBalance != null ? fmtINR(u.oldBalance) : '—'}
                    </span>
                    <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>→</span>
                    <span style={{ color: 'var(--positive)', fontWeight: 500 }}>
                      {u.newBalance != null ? fmtINR(u.newBalance) : '—'}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, padding: '14px 20px', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setUpdateConfirm(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleImport}>
                Yes, update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
