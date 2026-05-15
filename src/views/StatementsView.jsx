import React, { useState } from 'react';
import { loadStatements } from '../lib/statementStore.js';
import { fmtINR } from '../lib/format.js';
import { CATEGORY_COLORS } from '../lib/categorize.js';
import { ACCOUNT_TYPES } from '../lib/accountTypes.js';
import { detectMethod, groupByMethod, METHOD_ORDER, METHOD_COLORS } from '../lib/paymentMethod.js';
import StatementAnalysis from '../components/StatementAnalysis.jsx';
import ModalShell from '../components/ModalShell.jsx';

const STATEMENT_TYPES = new Set(['bank', 'creditCard', 'loan', 'nps']);

const MONTH_MAP = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
function toDueDateISO(raw) {
  if (!raw) return '';
  const m1 = raw.match(/(\d{1,2})\s+([A-Za-z]{3,}),?\s+(\d{4})/);
  if (m1) {
    const mo = MONTH_MAP[m1[2].toLowerCase().slice(0, 3)];
    if (mo) return `${m1[3]}-${String(mo).padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
  }
  const m2 = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m2) {
    const yyyy = m2[3].length === 2 ? '20' + m2[3] : m2[3];
    return `${yyyy}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
  }
  return '';
}

function fmtCompact(n) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${Math.round(n)}`;
}

export default function StatementsView({ onOpen, accounts = [], onAccountUpdate }) {
  const [selectedId, setSelectedId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const eligible = accounts.filter(a => STATEMENT_TYPES.has(a.type));
  const selected = eligible.find(a => a.id === selectedId) || null;
  const statements = loadStatements();

  const bankStatements  = statements.filter(s => s.accountType === 'bank');
  const ccStatements    = statements.filter(s => s.accountType === 'creditCard');
  const otherStatements = statements.filter(s => s.accountType !== 'bank' && s.accountType !== 'creditCard');

  // Show insights button only when there's something to show
  const hasInsights = statements.some(s =>
    (s.accountType === 'bank' || s.accountType === 'creditCard') &&
    (s.transactions || []).some(t => t.type === 'debit')
  );

  const handleStatementData = ({ balance, dueDate }) => {
    if (!selected) return;
    const changes = {};
    if (balance != null) changes.balance = balance;
    if (dueDate) {
      const iso = toDueDateISO(dueDate);
      if (iso) changes.dueDate = iso;
    }
    if (Object.keys(changes).length) onAccountUpdate?.(selected.id, changes);
  };

  const handleViewReport = (id) => {
    setRefreshKey(k => k + 1);
    onOpen(id);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 8 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>
            Saved reports
          </div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 26, letterSpacing: '-0.02em', margin: 0 }}>
            Statements
          </h2>
        </div>
        {hasInsights && (
          <button
            className="btn-ghost"
            onClick={() => setInsightsOpen(true)}
            style={{ fontSize: 12 }}
          >
            Spending insights ↗
          </button>
        )}
      </div>

      {/* Spending insights dialog */}
      {insightsOpen && (
        <ModalShell onClose={() => setInsightsOpen(false)} maxWidth={660}>
          <div className="modal-header">
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>
                Analysis
              </div>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, letterSpacing: '-0.02em', margin: 0 }}>
                Spending insights
              </h2>
            </div>
          </div>
          <div className="modal-body">
            <SpendingInsights statements={statements} accounts={accounts} />
          </div>
        </ModalShell>
      )}

      {/* Fetch section */}
      <div style={{
        marginBottom: 28, padding: '16px 18px',
        border: '1px solid var(--line)', borderRadius: 12,
        background: 'var(--surface)',
      }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>
          Fetch statement
        </div>
        {eligible.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            Add a bank, credit card, or loan account first.
          </div>
        ) : (
          <>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              style={{
                width: '100%', fontSize: 13, padding: '7px 10px',
                border: '1px solid var(--line)', borderRadius: 8,
                background: 'var(--surface)', color: 'var(--text)',
                outline: 'none', cursor: 'pointer',
              }}
            >
              <option value=''>Select account…</option>
              {eligible.map(a => (
                <option key={a.id} value={a.id}>
                  {a.nickname || ACCOUNT_TYPES[a.type]?.label} · {ACCOUNT_TYPES[a.type]?.label}
                </option>
              ))}
            </select>
            {selected && (
              <StatementAnalysis
                key={selected.id}
                account={selected}
                onViewReport={handleViewReport}
                onStatementData={handleStatementData}
              />
            )}
          </>
        )}
      </div>

      {/* Saved statements — split by type */}
      <div key={refreshKey}>
        <StatementSection label="Bank" list={bankStatements} onOpen={onOpen} accounts={accounts} onAccountUpdate={onAccountUpdate} />
        <StatementSection label="Credit card" list={ccStatements} onOpen={onOpen} accounts={accounts} onAccountUpdate={onAccountUpdate} />
        <StatementSection label="Other" list={otherStatements} onOpen={onOpen} accounts={accounts} onAccountUpdate={onAccountUpdate} />
      </div>

      {statements.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 40, color: 'var(--text-faint)' }}>
          <div style={{ fontSize: 12 }}>No statements saved yet.</div>
        </div>
      )}

      <div style={{ height: 48 }} />
    </div>
  );
}

function StatementSection({ label, list, onOpen, accounts, onAccountUpdate }) {
  if (list.length === 0) return null;
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--text-faint)', marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map(s => (
          <StatementCard key={s.id} s={s} onOpen={onOpen} accounts={accounts} onAccountUpdate={onAccountUpdate} />
        ))}
      </div>
    </div>
  );
}

/* ── Spending Insights ──────────────────────────────────────────── */

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function SpendingInsights({ statements, accounts = [] }) {
  const [tab, setTab] = React.useState('overview');

  const eligible = statements.filter(
    s => s.accountType === 'bank' || s.accountType === 'creditCard'
  );
  const allTxns = eligible.flatMap(s => s.transactions || []);
  const debits  = allTxns.filter(t => t.type === 'debit');
  const credits = allTxns.filter(t => t.type === 'credit');

  if (debits.length === 0) return null;

  const totalSpend  = debits.reduce((s, t) => s + t.amount, 0);
  const totalIncome = credits.reduce((s, t) => s + t.amount, 0);
  const netFlow     = totalIncome - totalSpend;
  const avgTx       = totalSpend / debits.length;
  const maxTx       = debits.reduce((m, t) => t.amount > m.amount ? t : m, debits[0]);

  const catMap = {};
  for (const t of debits) catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  const cats = Object.entries(catMap)
    .map(([category, total]) => ({ category, total, pct: (total / totalSpend) * 100 }))
    .sort((a, b) => b.total - a.total);

  const dayMap = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  let hasDates = false;
  for (const t of debits) {
    if (t.date) {
      const d = new Date(t.date);
      if (!isNaN(d)) { hasDates = true; dayMap[DAY_KEYS[d.getDay()]] += t.amount; }
    }
  }
  const maxDay = Math.max(...Object.values(dayMap));

  // Build a per-transaction lookup of which account the statement belongs to,
  // so self-transfer detection can exclude the source account when matching.
  const txnAccountId = new Map();
  for (const s of eligible) {
    for (const t of s.transactions || []) {
      txnAccountId.set(t, s.accountId);
    }
  }
  const methodMap = (() => {
    const map = {};
    for (const t of debits) {
      const m = detectMethod(t, accounts, txnAccountId.get(t) || null);
      if (!map[m]) map[m] = { count: 0, total: 0 };
      map[m].count++;
      map[m].total += t.amount;
    }
    return map;
  })();
  const methodRows = METHOD_ORDER
    .filter(m => methodMap[m])
    .map(m => ({ method: m, ...methodMap[m], pct: (methodMap[m].total / totalSpend) * 100 }));

  const tabs = [
    { k: 'overview',  label: 'Overview' },
    { k: 'categories',label: 'Categories' },
    { k: 'modes',     label: 'Payment modes' },
    ...(hasDates && maxDay > 0 ? [{ k: 'trend', label: 'Trend' }] : []),
  ];

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
        {tabs.map(t => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            style={{
              fontSize: 11.5, padding: '5px 14px', borderRadius: 20,
              border: tab === t.k ? '1px solid var(--accent-text)' : '1px solid var(--line)',
              background: tab === t.k ? 'var(--surface)' : 'transparent',
              color: tab === t.k ? 'var(--accent-text)' : 'var(--text-faint)',
              cursor: 'pointer', fontWeight: tab === t.k ? 500 : 400,
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-faint)', alignSelf: 'center', letterSpacing: '0.1em' }}>
          {debits.length} txns · {eligible.length} stmt{eligible.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Hero grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <InsightHero label="Total outflow" value={fmtINR(totalSpend)} accent="#f59e0b" glow span2={false} />
            <InsightHero label="Avg. transaction" value={fmtCompact(avgTx)} accent="var(--text-dim)" />
            {totalIncome > 0
              ? <InsightHero label="Total inflow" value={fmtINR(totalIncome)} accent="var(--positive)" />
              : <InsightHero label="Transactions" value={String(debits.length)} accent="var(--text-dim)" />
            }
            <InsightHero label="Top mode" value={methodRows[0]?.method || '—'} accent={METHOD_COLORS[methodRows[0]?.method] || 'var(--text-dim)'} />
          </div>

          {/* Net flow bar */}
          {totalIncome > 0 && (
            <div style={{
              padding: '14px 16px',
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Net flow</span>
                <span style={{
                  fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                  color: netFlow >= 0 ? 'var(--positive)' : 'var(--negative)',
                }}>
                  {netFlow >= 0 ? '+' : '−'}{fmtINR(Math.abs(netFlow))}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: 'var(--line)', overflow: 'hidden', display: 'flex' }}>
                {(() => {
                  const tot = totalIncome + totalSpend;
                  return (
                    <>
                      <div style={{ width: `${(totalSpend / tot) * 100}%`, background: '#f59e0b', boxShadow: '0 0 8px #f59e0b66' }} />
                      <div style={{ width: `${(totalIncome / tot) * 100}%`, background: 'var(--positive)', boxShadow: '0 0 8px var(--positive)66' }} />
                    </>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 10.5, color: 'var(--text-faint)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> Spend
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--positive)', display: 'inline-block' }} /> Inflow
                </span>
              </div>
            </div>
          )}

          {/* Largest transaction */}
          <div style={{
            padding: '14px 16px', background: 'var(--surface)',
            border: '1px solid var(--line)', borderRadius: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 6 }}>
                Largest transaction
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                {(maxTx.description || maxTx.narration || '—').slice(0, 36)}
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--negative)', letterSpacing: '-0.02em', flexShrink: 0 }}>
              {fmtINR(maxTx.amount)}
            </div>
          </div>
        </div>
      )}

      {/* ── Categories tab ── */}
      {tab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cats.map(cat => {
            const color = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.Other;
            return (
              <div key={cat.category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)' }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: color, boxShadow: `0 0 7px ${color}`,
                    }} />
                    {cat.category}
                  </span>
                  <span style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                      {cat.pct.toFixed(1)}%
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--text)', minWidth: 80, textAlign: 'right' }}>
                      {fmtINR(cat.total)}
                    </span>
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 5, background: 'var(--line)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${cat.pct}%`, borderRadius: 5,
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    boxShadow: `0 0 10px ${color}55`,
                    transition: 'width 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Payment modes tab ── */}
      {tab === 'modes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Stacked bar */}
          <div style={{ height: 8, borderRadius: 6, overflow: 'hidden', display: 'flex', gap: 1 }}>
            {methodRows.map(r => (
              <div
                key={r.method}
                style={{ flex: r.total / totalSpend, background: METHOD_COLORS[r.method] }}
                title={`${r.method}: ${r.pct.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Rows */}
          {methodRows.map(r => (
            <div key={r.method}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)' }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                    background: METHOD_COLORS[r.method],
                    boxShadow: `0 0 7px ${METHOD_COLORS[r.method]}88`,
                  }} />
                  {r.method}
                </span>
                <span style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                    {r.count} txn{r.count !== 1 ? 's' : ''} · {r.pct.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--text)', minWidth: 80, textAlign: 'right' }}>
                    {fmtINR(r.total)}
                  </span>
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 5, background: 'var(--line)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${r.pct}%`, borderRadius: 5,
                  background: `linear-gradient(90deg, ${METHOD_COLORS[r.method]}88, ${METHOD_COLORS[r.method]})`,
                  boxShadow: `0 0 10px ${METHOD_COLORS[r.method]}55`,
                  transition: 'width 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
                }} />
              </div>
            </div>
          ))}

          {methodRows.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', padding: '16px 0' }}>
              Could not classify transactions
            </div>
          )}
        </div>
      )}

      {/* ── Trend tab ── */}
      {tab === 'trend' && hasDates && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            padding: '16px 18px',
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
          }}>
            <div style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 16 }}>
              Spend by day of week
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
              {DAY_KEYS.map(day => {
                const val = dayMap[day];
                const pct = maxDay > 0 ? (val / maxDay) * 100 : 0;
                const isWeekend = day === 'Sun' || day === 'Sat';
                const barColor = isWeekend ? '#fb923c' : 'var(--accent-text)';
                return (
                  <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: '100%', height: 62, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%', height: `${Math.max(pct, 5)}%`,
                        background: `${barColor}20`,
                        borderRadius: '3px 3px 0 0',
                        borderTop: `2px solid ${barColor}`,
                        boxShadow: pct > 40 ? `0 -4px 14px ${barColor}44` : 'none',
                        transition: 'height 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                      }} />
                    </div>
                    <span style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>{day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Busiest day callout */}
          {(() => {
            const busiest = DAY_KEYS.reduce((a, b) => dayMap[a] >= dayMap[b] ? a : b);
            return (
              <div style={{
                padding: '14px 16px', background: 'var(--surface)',
                border: '1px solid var(--line)', borderRadius: 12,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 6 }}>
                    Busiest day
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{busiest}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 6 }}>
                    Spent
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#f59e0b' }}>
                    {fmtINR(dayMap[busiest])}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </section>
  );
}

function InsightHero({ label, value, accent, glow }) {
  return (
    <div style={{
      padding: '14px 16px', background: 'var(--surface)',
      border: `1px solid ${glow ? accent + '44' : 'var(--line)'}`,
      borderRadius: 12, position: 'relative', overflow: 'hidden',
    }}>
      {glow && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }} />
      )}
      <div style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: accent, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  );
}

/* ── Statement card ─────────────────────────────────────────────── */

function StatementCard({ s, onOpen, accounts = [], onAccountUpdate }) {
  const [locallyPaid, setLocallyPaid] = useState(false);

  const txns      = s.transactions || [];
  const debitTxns = txns.filter(t => t.type === 'debit');
  const summary   = s.summary || {};

  const catMap = {};
  for (const t of debitTxns) catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const savedAt = s.savedAt
    ? new Date(s.savedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  // Bank: opening / closing / net
  const isBank = s.accountType === 'bank';
  const opening = summary.openingBalance ?? null;
  const closing = summary.closingBalance ?? null;
  const net     = (opening != null && closing != null) ? closing - opening : null;

  // CC: amount due + due date
  const isCC    = s.accountType === 'creditCard';
  const due     = summary.totalDue ?? null;
  // Prefer parsed dueDate; fall back to the linked account's stored ISO dueDate
  const linkedAccount = accounts.find(a => a.id === s.accountId);
  const dueDate       = summary.dueDate || (linkedAccount?.dueDate
    ? new Date(linkedAccount.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '');
  const accountBalance = linkedAccount?.balance;
  const accountExplicitlyPaid = isCC && accountBalance != null && accountBalance !== '' && Number(accountBalance) === 0;
  const paid = (isCC && due === 0) || locallyPaid || accountExplicitlyPaid;

  const handleMarkPaid = (e) => {
    e.stopPropagation();
    setLocallyPaid(true);
    if (s.accountId) onAccountUpdate?.(s.accountId, { balance: 0 });
  };

  const handleMarkUnpaid = (e) => {
    e.stopPropagation();
    setLocallyPaid(false);
    if (s.accountId && due != null) onAccountUpdate?.(s.accountId, { balance: due });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(s.id)}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onOpen(s.id)}
      style={{
        width: '100%', textAlign: 'left',
        padding: '16px 18px',
        border: '1px solid var(--line)', borderRadius: 12,
        background: 'var(--surface)', cursor: 'pointer',
        transition: 'border-color 0.15s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-faint)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{s.accountNickname}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {s.source?.date || savedAt}
            {s.source?.subject && <span style={{ opacity: 0.7 }}> · {s.source.subject}</span>}
          </div>
        </div>

        {/* Bank: opening → closing + net */}
        {isBank && (opening != null || closing != null) && (
          <div style={{ textAlign: 'right', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {opening != null && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 1 }}>Opening</div>
                <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--text-dim)' }}>
                  {fmtINR(opening)}
                </div>
              </div>
            )}
            {closing != null && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 1 }}>Closing</div>
                <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--text-dim)' }}>
                  {fmtINR(closing)}
                </div>
              </div>
            )}
            {net != null && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 1 }}>Net</div>
                <div style={{
                  fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                  color: net >= 0 ? 'var(--positive)' : 'var(--negative)',
                }}>
                  {net >= 0 ? '+' : ''}{fmtINR(net)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CC: amount due + mark paid */}
        {isCC && !paid && due != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--negative)' }}>
              {fmtINR(due)} due
            </div>
            {dueDate && (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                by {dueDate}
              </div>
            )}
            <button
              onClick={handleMarkPaid}
              style={{
                marginTop: 6, fontSize: 10.5, padding: '3px 10px',
                border: '1px solid var(--line)', borderRadius: 6,
                background: 'transparent', color: 'var(--text-faint)',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--positive)'; e.currentTarget.style.color = 'var(--positive)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--text-faint)'; }}
            >
              Mark as paid
            </button>
          </div>
        )}
        {isCC && paid && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--positive)' }}>Paid ✓</div>
            {(locallyPaid || accountExplicitlyPaid) && (
              <button
                onClick={handleMarkUnpaid}
                style={{
                  marginTop: 4, fontSize: 10, padding: '2px 8px',
                  border: '1px solid var(--line)', borderRadius: 6,
                  background: 'transparent', color: 'var(--text-faint)',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--negative)'; e.currentTarget.style.color = 'var(--negative)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--text-faint)'; }}
              >
                Mark as unpaid
              </button>
            )}
          </div>
        )}
      </div>

      {/* Payment method breakdown */}
      {debitTxns.length > 0 && (() => {
        const methods = groupByMethod(debitTxns, accounts, s.accountId);
        const total   = debitTxns.reduce((s, t) => s + t.amount, 0);
        const ordered = METHOD_ORDER.filter(m => methods[m]);
        if (!ordered.length) return null;
        return (
          <div style={{ marginBottom: 10 }}>
            {/* Stacked bar */}
            <div style={{ display: 'flex', height: 4, borderRadius: 4, overflow: 'hidden', gap: 1, marginBottom: 8 }}>
              {ordered.map(m => (
                <div
                  key={m}
                  style={{
                    flex: methods[m].total / total,
                    background: METHOD_COLORS[m],
                    opacity: 0.85,
                  }}
                />
              ))}
            </div>
            {/* Labels */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {ordered.map(m => (
                <span key={m} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: METHOD_COLORS[m], display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>{m}</span>
                  <span style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtINR(methods[m].total, { compact: true })}
                  </span>
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {topCats.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {topCats.map(([cat]) => (
            <span key={cat} style={{
              fontSize: 10.5, padding: '2px 8px', borderRadius: 5,
              background: (CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other) + '22',
              color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
              {cat}
            </span>
          ))}
          {txns.length > 0 && (
            <span style={{ fontSize: 10.5, color: 'var(--text-faint)', alignSelf: 'center' }}>
              {txns.length} transactions
            </span>
          )}
        </div>
      )}

      {txns.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Summary only · no transactions extracted</div>
      )}
    </div>
  );
}
