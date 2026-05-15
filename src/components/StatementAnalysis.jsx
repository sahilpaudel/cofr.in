import React, { useRef, useState } from 'react';
import { getToken, clearToken, getCachedEmail, fetchLatestStatementEmail } from '../lib/gmail.js';
import { storePassword, loadPassword, clearPassword } from '../lib/cryptoStore.js';
import {
  parseBankStatement,
  parseCreditCardStatement,
  parseLoanStatement,
  parseNpsStatement,
  hasData,
} from '../lib/statementParser.js';
import { parseTransactions } from '../lib/transactionParser.js';
import { categorize } from '../lib/categorize.js';
import { saveStatement } from '../lib/statementStore.js';
import { extractTextFromBytes } from '../lib/parseCas.js';
import { fmtINR } from '../lib/format.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const PARSERS = {
  bank: parseBankStatement,
  creditCard: parseCreditCardStatement,
  loan: parseLoanStatement,
  nps: parseNpsStatement,
};

export default function StatementAnalysis({ account, onViewReport, onStatementData }) {
  const [phase, setPhase] = useState('idle'); // idle | loading | locked | done | empty | error
  const [report, setReport] = useState(null);
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');
  const [pdfPassword, setPdfPassword] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [pendingBytes, setPendingBytes] = useState(null);
  const [gmailEmail, setGmailEmail] = useState(() => getCachedEmail());
  const fileRef = useRef(null);

  // ── Shared: parse text → save report ────────────────────────────────────────
  const processText = (text, src) => {
    const parse = PARSERS[account.type];
    const result = parse ? parse(text) : {};
    setSource(src);
    setReport(result);

    const transactions = parseTransactions(text, account.type).map(t => ({
      ...t, category: categorize(t.description),
    }));

    const saved = saveStatement({
      id: crypto.randomUUID(),
      accountId: account.id || null,
      accountNickname: account.nickname || account.institution || account.issuer || account.lender || account.type,
      accountType: account.type,
      source: src,
      summary: result,
      transactions,
      savedAt: Date.now(),
    });
    setSavedId(saved.id);
    setPhase(hasData(result) || transactions.length > 0 ? 'done' : 'empty');

    if (account.type === 'creditCard' && (result.totalDue != null || result.dueDate)) {
      onStatementData?.({ balance: result.totalDue ?? null, dueDate: result.dueDate || '' });
    }
    if (account.type === 'nps' && result.currentValuation != null) {
      onStatementData?.({
        balance:       result.currentValuation,
        contributions: result.totalContributions ?? null,
      });
    }
  };

  // ── File upload path ─────────────────────────────────────────────────────────
  const analyzeBytes = async (bytes, password = '', fromStore = false) => {
    setPhase('loading');
    setError('');
    try {
      const text = await extractTextFromBytes(bytes, password);
      if (password) storePassword(account.id, password);
      processText(text, {
        subject: source?.subject || 'Uploaded PDF',
        from: 'Manual upload',
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      });
    } catch (err) {
      if (err?.name === 'PasswordException' || err?.code === 1 || err?.code === 2) {
        setPendingBytes(bytes);
        if (fromStore) {
          clearPassword(account.id);
        } else if (password) {
          setError('Incorrect password — please try again.');
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
    setSource({ subject: file.name, from: 'Manual upload', date: '' });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await loadPassword(account.id);
    analyzeBytes(bytes, stored || '', Boolean(stored));
  };

  // ── Gmail path ───────────────────────────────────────────────────────────────
  const analyzeGmail = async (password = '', fromStore = false, selectAccount = false) => {
    setPendingBytes(null);
    setPhase('loading');
    setError('');
    try {
      const { token, email: authEmail } = await getToken(CLIENT_ID, { selectAccount });
      if (authEmail) setGmailEmail(authEmail);
      const email = await fetchLatestStatementEmail(token, account, password);
      if (!email) { setPhase('empty'); return; }

      if (email.isPasswordProtected) {
        setSource({ subject: email.subject, from: email.from, date: email.date });
        if (email.wrongPassword && fromStore) {
          clearPassword(account.id);
        } else if (email.wrongPassword) {
          setError('Incorrect password — please try again.');
        }
        setPhase('locked');
        return;
      }

      if (password) storePassword(account.id, password);
      processText(email.text, { subject: email.subject, from: email.from, date: email.date });
    } catch (err) {
      clearToken();
      setError(err.message || 'Could not fetch statement.');
      setPhase('error');
    }
  };

  const handleAnalyzeGmail = async (selectAccount = false) => {
    const stored = await loadPassword(account.id);
    analyzeGmail(stored || '', Boolean(stored), selectAccount);
  };

  // ── Unlock (password retry for whichever path is pending) ───────────────────
  const unlock = () => {
    if (!pdfPassword) return;
    if (pendingBytes) {
      analyzeBytes(pendingBytes, pdfPassword, false);
    } else {
      analyzeGmail(pdfPassword, false);
    }
  };

  const reset = () => {
    setPhase('idle'); setPdfPassword(''); setError('');
    setSavedId(null); setPendingBytes(null);
  };

  // ── Idle button style ────────────────────────────────────────────────────────
  const btnStyle = {
    fontSize: 12, color: 'var(--text-dim)',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: '1px solid var(--line)', borderRadius: 8,
    padding: '4px 10px', background: 'transparent',
    cursor: 'pointer', transition: 'all 0.15s ease',
  };
  const btnHover = (e, enter) => {
    e.currentTarget.style.color = enter ? 'var(--text)' : 'var(--text-dim)';
    e.currentTarget.style.borderColor = enter ? '#333' : 'var(--line)';
  };

  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20, marginTop: 8 }}>

      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: phase === 'idle' ? 0 : 12,
      }}>
        <span style={{
          fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}>
          Statement Analysis
        </span>

        {phase === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            {CLIENT_ID && gmailEmail && (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {gmailEmail}
                <button type="button" onClick={() => handleAnalyzeGmail(true)}
                  style={{ fontSize: 11, color: 'var(--accent-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Switch account
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
            {CLIENT_ID && (
              <button type="button" onClick={() => handleAnalyzeGmail(false)}
                style={btnStyle}
                onMouseEnter={e => btnHover(e, true)}
                onMouseLeave={e => btnHover(e, false)}
              >
                Fetch from Gmail
              </button>
            )}
            <button type="button" onClick={() => fileRef.current?.click()}
              style={btnStyle}
              onMouseEnter={e => btnHover(e, true)}
              onMouseLeave={e => btnHover(e, false)}
            >
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

        {phase === 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {savedId && onViewReport && (
              <button
                type="button"
                onClick={() => onViewReport(savedId)}
                style={{
                  fontSize: 12, color: 'var(--accent-text)',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  border: '1px solid var(--accent-text)', borderRadius: 7,
                  padding: '3px 9px', background: 'transparent', cursor: 'pointer',
                }}
              >
                View full report →
              </button>
            )}
            <button type="button" onClick={reset}
              style={{ fontSize: 13, color: 'var(--text-faint)', padding: 0 }}>✕</button>
          </div>
        )}
      </div>

      {phase === 'loading' && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
          {pendingBytes ? 'Reading PDF…' : 'Fetching statement from Gmail…'}
        </div>
      )}

      {phase === 'error' && (
        <div style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--negative)' }}>{error}</span>
          <button type="button" onClick={reset}
            style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-dim)' }}>Dismiss</button>
        </div>
      )}

      {phase === 'locked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {source?.subject && (
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>
              {source.subject}{source.date && <span style={{ opacity: 0.7 }}> · {source.date}</span>}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            PDF is password-protected. Enter the password to unlock.
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--negative)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="password"
              placeholder="e.g. SAHI0512"
              value={pdfPassword}
              onChange={e => setPdfPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && unlock()}
              autoFocus
              style={{
                flex: 1, fontSize: 13, padding: '5px 10px',
                border: '1px solid var(--line)', borderRadius: 8,
                background: 'var(--surface)', color: 'var(--text)',
                outline: 'none', fontFamily: 'monospace',
              }}
            />
            <button type="button" onClick={unlock} disabled={!pdfPassword}
              style={{
                fontSize: 12, padding: '5px 12px',
                border: '1px solid var(--line)', borderRadius: 8,
                background: 'transparent', color: 'var(--text-dim)',
                cursor: pdfPassword ? 'pointer' : 'default', opacity: pdfPassword ? 1 : 0.5,
              }}
            >
              Unlock
            </button>
            <button type="button" onClick={reset}
              style={{ fontSize: 12, color: 'var(--text-faint)', padding: '5px 4px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === 'empty' && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          No parseable statement found.
          <button type="button" onClick={reset}
            style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-dim)' }}>Dismiss</button>
        </div>
      )}

      {phase === 'done' && report && (
        <div>
          {source && (
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginBottom: 14, lineHeight: 1.5 }}>
              {source.subject}
              {(source.from || source.date) && (
                <>
                  <br />
                  <span style={{ opacity: 0.7 }}>{[source.from, source.date].filter(Boolean).join(' · ')}</span>
                </>
              )}
            </div>
          )}
          {account.type === 'bank'       && <BankReport r={report} />}
          {account.type === 'creditCard' && <CardReport r={report} />}
          {account.type === 'loan'       && <LoanReport r={report} />}
          {account.type === 'nps'        && <NpsReport  r={report} />}
        </div>
      )}
    </div>
  );
}

/* ── shared metric grid ── */

function Grid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
      {children}
    </div>
  );
}

function Metric({ label, value, accent, small }) {
  if (value === null || value === undefined) return null;
  return (
    <div style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)' }}>
      <div style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: small ? 13 : 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: accent || 'var(--text)', lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  if (value === null || value === undefined) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <span style={{ color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

/* ── per-type reports ── */

function BankReport({ r }) {
  const hasBalances = r.openingBalance !== null || r.closingBalance !== null;
  const hasFlow     = r.totalCredits !== null || r.totalDebits !== null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {r.period && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Period: {r.period}</div>}
      {hasBalances && (
        <Grid>
          <Metric label="Opening balance" value={r.openingBalance !== null ? fmtINR(r.openingBalance) : null} />
          <Metric label="Closing balance" value={r.closingBalance !== null ? fmtINR(r.closingBalance) : null} accent="var(--positive)" />
        </Grid>
      )}
      {hasFlow && (
        <Grid>
          <Metric label={r.creditCount ? `Credits (${r.creditCount})` : 'Total credits'} value={r.totalCredits !== null ? fmtINR(r.totalCredits) : null} accent="var(--positive)" />
          <Metric label={r.debitCount  ? `Debits (${r.debitCount})`  : 'Total debits'}  value={r.totalDebits  !== null ? fmtINR(r.totalDebits)  : null} accent="var(--negative)" />
        </Grid>
      )}
    </div>
  );
}

function CardReport({ r }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Grid>
        <Metric label="Total due"   value={r.totalDue   !== null ? fmtINR(r.totalDue)   : null} accent="var(--negative)" />
        <Metric label="Minimum due" value={r.minimumDue !== null ? fmtINR(r.minimumDue) : null} />
        <Metric label="Due date"    value={r.dueDate} small />
      </Grid>
      {(r.creditLimit !== null || r.availableCredit !== null || r.totalSpend !== null) && (
        <div style={{ marginTop: 2 }}>
          <Row label="Credit limit"     value={r.creditLimit     !== null ? fmtINR(r.creditLimit)     : null} />
          <Row label="Available credit" value={r.availableCredit !== null ? fmtINR(r.availableCredit) : null} />
          <Row label="Total spend"      value={r.totalSpend      !== null ? fmtINR(r.totalSpend)      : null} />
          <Row label="Statement date"   value={r.statementDate} />
        </div>
      )}
    </div>
  );
}

function LoanReport({ r }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Grid>
        <Metric label="Outstanding"  value={r.outstandingPrincipal !== null ? fmtINR(r.outstandingPrincipal) : null} accent="var(--negative)" />
        <Metric label="EMI amount"   value={r.emiAmount           !== null ? fmtINR(r.emiAmount)            : null} />
        <Metric label="Next EMI due" value={r.nextEmiDate} small />
      </Grid>
      {(r.principalComponent !== null || r.interestComponent !== null || r.remainingEmis !== null) && (
        <div style={{ marginTop: 2 }}>
          <Row label="Principal component" value={r.principalComponent !== null ? fmtINR(r.principalComponent) : null} />
          <Row label="Interest component"  value={r.interestComponent  !== null ? fmtINR(r.interestComponent)  : null} />
          <Row label="Remaining EMIs"      value={r.remainingEmis} />
        </div>
      )}
    </div>
  );
}

function NpsReport({ r }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Grid>
        {r.currentValuation != null && <Metric label="Current valuation" value={fmtINR(r.currentValuation)} accent="var(--positive)" />}
        {r.notionalGainLoss != null && <Metric label="Notional gain/loss" value={fmtINR(r.notionalGainLoss)} accent={r.notionalGainLoss >= 0 ? 'var(--positive)' : 'var(--negative)'} />}
      </Grid>
      {(r.totalContributions != null || r.totalWithdrawal != null || r.statementDate) && (
        <div style={{ marginTop: 2 }}>
          <Row label="Total contributed" value={r.totalContributions != null ? fmtINR(r.totalContributions) : null} />
          <Row label="Total withdrawal"  value={r.totalWithdrawal    != null ? fmtINR(r.totalWithdrawal)    : null} />
          <Row label="As of"             value={r.statementDate} />
        </div>
      )}
    </div>
  );
}
