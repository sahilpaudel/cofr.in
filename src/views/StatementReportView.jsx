import React, { useMemo, useState } from 'react';
import { fmtINR } from '../lib/format.js';
import { ALL_CATEGORIES, CATEGORY_COLORS } from '../lib/categorize.js';
import { deleteStatement } from '../lib/statementStore.js';
import { detectMethod, METHOD_COLORS } from '../lib/paymentMethod.js';
import { Icon } from '../icons/Icon.jsx';

export default function StatementReportView({ report, accounts = [], onBack, onDelete }) {
  const [filterCat,  setFilterCat]  = useState('All');
  const [filterSelf, setFilterSelf] = useState(false);
  const [search, setSearch] = useState('');

  const { transactions = [], summary = {}, source = {}, accountNickname, accountType, accountId } = report;

  // Annotate each transaction with its detected payment method
  const annotated = useMemo(() =>
    transactions.map(t => ({
      ...t,
      paymentMethod: detectMethod(t, accounts, accountId || report.accountId),
    })),
  [transactions, accounts, accountId, report.accountId]);

  const selfTransferCount = useMemo(
    () => annotated.filter(t => t.type === 'debit' && t.paymentMethod === 'Self Transfer').length,
    [annotated]
  );

  // Category totals (debits only, excluding self-transfers from spend breakdown)
  const catTotals = useMemo(() => {
    const map = {};
    for (const t of annotated) {
      if (t.type === 'debit' && t.paymentMethod !== 'Self Transfer') {
        map[t.category] = (map[t.category] || 0) + t.amount;
      }
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([category, total]) => ({ category, total }));
  }, [annotated]);

  const maxCatTotal = catTotals[0]?.total || 1;

  const totalSpend = catTotals.reduce((s, c) => s + c.total, 0);
  const totalIncome = transactions
    .filter(t => t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);

  // Filtered transaction list
  const visible = useMemo(() => {
    return annotated.filter(t => {
      if (filterSelf && t.paymentMethod !== 'Self Transfer') return false;
      if (filterCat !== 'All' && t.category !== filterCat) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [annotated, filterCat, filterSelf, search]);

  const handleDelete = () => {
    deleteStatement(report.id);
    onDelete();
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 8 }}>

      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: 'var(--text-faint)',
            border: '1px solid var(--line)', borderRadius: 8,
            padding: '5px 10px', background: 'transparent', cursor: 'pointer',
          }}
        >
  ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Statement Report · {accountType}
          </div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, letterSpacing: '-0.02em', margin: 0 }}>
            {accountNickname}
          </h2>
        </div>
        <button
          onClick={handleDelete}
          style={{ fontSize: 12, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px' }}
        >
          <Icon name="trash" size={13} stroke={1.5} /> Delete
        </button>
      </div>

      {/* Source email info */}
      {source.subject && (
        <div style={{
          fontSize: 11, color: 'var(--text-faint)', marginBottom: 20,
          padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 8,
          background: 'var(--surface)',
        }}>
          {source.subject}
          {source.from && <span style={{ opacity: 0.7 }}> · {source.from}</span>}
          {source.date && <span style={{ opacity: 0.7 }}> · {source.date}</span>}
        </div>
      )}

      {/* Summary cards */}
      <SummarySection summary={summary} accountType={accountType} totalSpend={totalSpend} totalIncome={totalIncome} transactions={transactions} />

      {/* Spending breakdown */}
      {catTotals.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 14 }}>
            Spending by category
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {catTotals.map(({ category, total }) => (
              <div key={category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <button
                    onClick={() => setFilterCat(filterCat === category ? 'All' : category)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      color: filterCat === category ? 'var(--text)' : 'var(--text-dim)',
                      background: 'transparent', padding: 0, cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: CATEGORY_COLORS[category] || CATEGORY_COLORS.Other,
                      flexShrink: 0,
                    }} />
                    {category}
                  </button>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-dim)' }}>
                    {fmtINR(total)}
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--line)' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${(total / maxCatTotal) * 100}%`,
                    background: CATEGORY_COLORS[category] || CATEGORY_COLORS.Other,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transaction list */}
      {transactions.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                Transactions ({visible.length}{filterCat !== 'All' || filterSelf || search ? ` of ${annotated.length}` : ''})
              </div>
              {selfTransferCount > 0 && (
                <button
                  onClick={() => { setFilterSelf(f => !f); setFilterCat('All'); }}
                  style={{
                    fontSize: 10.5, padding: '2px 8px', borderRadius: 5, cursor: 'pointer',
                    border: `1px solid ${filterSelf ? METHOD_COLORS['Self Transfer'] : 'var(--line)'}`,
                    background: filterSelf ? METHOD_COLORS['Self Transfer'] + '22' : 'transparent',
                    color: filterSelf ? METHOD_COLORS['Self Transfer'] : 'var(--text-faint)',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: METHOD_COLORS['Self Transfer'], display: 'inline-block' }} />
                  Self transfers ({selfTransferCount})
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {filterCat !== 'All' && (
                <button
                  onClick={() => setFilterCat('All')}
                  style={{
                    fontSize: 11, color: 'var(--text-faint)',
                    border: '1px solid var(--line)', borderRadius: 6,
                    padding: '3px 8px', background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: CATEGORY_COLORS[filterCat] || CATEGORY_COLORS.Other }} />
                  {filterCat} ✕
                </button>
              )}
              <input
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  fontSize: 12, padding: '4px 10px',
                  border: '1px solid var(--line)', borderRadius: 8,
                  background: 'var(--surface)', color: 'var(--text)', outline: 'none',
                  width: 120, minWidth: 80,
                }}
              />
            </div>
          </div>

          <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            {visible.length === 0 ? (
              <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>
                No transactions match.
              </div>
            ) : (
              visible.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px',
                    borderBottom: i < visible.length - 1 ? '1px solid var(--line-soft, var(--line))' : 'none',
                  }}
                >
                  {/* Category dot */}
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: CATEGORY_COLORS[t.category] || CATEGORY_COLORS.Other,
                  }} />

                  {/* Date */}
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>
                    {t.date}
                  </span>

                  {/* Description */}
                  <span style={{
                    flex: 1, fontSize: 12.5, fontWeight: 500,
                    wordBreak: 'break-word',
                  }}>
                    {t.description}
                  </span>

                  {/* Category badge */}
                  <span style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 5,
                    background: (CATEGORY_COLORS[t.category] || CATEGORY_COLORS.Other) + '22',
                    color: CATEGORY_COLORS[t.category] || CATEGORY_COLORS.Other,
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                    onClick={() => setFilterCat(t.category)}
                  >
                    {t.category}
                  </span>

                  {/* Self transfer badge */}
                  {t.paymentMethod === 'Self Transfer' && (
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 5,
                      background: METHOD_COLORS['Self Transfer'] + '22',
                      color: METHOD_COLORS['Self Transfer'],
                      border: `1px solid ${METHOD_COLORS['Self Transfer']}44`,
                      flexShrink: 0,
                    }}>
                      Self transfer
                    </span>
                  )}

                  {/* Amount */}
                  <span style={{
                    fontSize: 13, fontWeight: 500, flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                    color: t.type === 'credit' ? 'var(--positive)' : 'var(--text)',
                  }}>
                    {t.type === 'credit' ? '+' : '−'}{fmtINR(t.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {transactions.length === 0 && (
        <div style={{ marginTop: 28, fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', padding: '24px 0' }}>
          No individual transactions were extracted from this statement.
        </div>
      )}

      <div style={{ height: 48 }} />
    </div>
  );
}

function SummarySection({ summary, accountType, totalSpend, totalIncome, transactions = [] }) {
  const items = [];

  if (accountType === 'bank') {
    const withBalance = transactions.filter(t => t.balance != null);
    const openingBal  = withBalance.length > 0 ? withBalance[0].balance : null;
    const closingBal  = withBalance.length > 0 ? withBalance[withBalance.length - 1].balance : null;
    if (openingBal != null) items.push({ label: 'Opening balance', value: fmtINR(openingBal) });
    if (closingBal != null) items.push({ label: 'Closing balance', value: fmtINR(closingBal), accent: 'var(--positive)' });
    if (summary.totalCredits  != null) items.push({ label: 'Total credits',   value: fmtINR(summary.totalCredits),  accent: 'var(--positive)' });
    if (summary.totalDebits   != null) items.push({ label: 'Total debits',    value: fmtINR(summary.totalDebits),   accent: 'var(--negative)' });
  } else if (accountType === 'creditCard') {
    if (summary.totalDue   != null) items.push({ label: 'Total due',   value: fmtINR(summary.totalDue),   accent: 'var(--negative)' });
    if (summary.minimumDue != null) items.push({ label: 'Minimum due', value: fmtINR(summary.minimumDue) });
    if (summary.dueDate)            items.push({ label: 'Due date',    value: summary.dueDate });
    if (summary.creditLimit != null) items.push({ label: 'Credit limit', value: fmtINR(summary.creditLimit) });
  } else if (accountType === 'nps') {
    if (summary.currentValuation  != null) items.push({ label: 'Current valuation', value: fmtINR(summary.currentValuation),  accent: 'var(--positive)' });
    if (summary.notionalGainLoss  != null) items.push({ label: 'Notional gain/loss',value: fmtINR(summary.notionalGainLoss),  accent: summary.notionalGainLoss >= 0 ? 'var(--positive)' : 'var(--negative)' });
    if (summary.totalContributions!= null) items.push({ label: 'Contributed',       value: fmtINR(summary.totalContributions) });
    if (summary.totalWithdrawal   != null && summary.totalWithdrawal > 0)
                                           items.push({ label: 'Withdrawn',          value: fmtINR(summary.totalWithdrawal) });
    if (summary.statementDate)             items.push({ label: 'As of',             value: summary.statementDate });
  } else if (accountType === 'loan') {
    if (summary.outstandingPrincipal != null) items.push({ label: 'Outstanding', value: fmtINR(summary.outstandingPrincipal), accent: 'var(--negative)' });
    if (summary.emiAmount            != null) items.push({ label: 'EMI amount',  value: fmtINR(summary.emiAmount) });
    if (summary.nextEmiDate)                   items.push({ label: 'Next EMI',   value: summary.nextEmiDate });
    if (summary.remainingEmis)                 items.push({ label: 'Remaining',  value: summary.remainingEmis });
  }

  if (totalSpend  > 0) items.push({ label: 'Parsed spend',  value: fmtINR(totalSpend),  accent: 'var(--negative)' });
  if (totalIncome > 0) items.push({ label: 'Parsed income', value: fmtINR(totalIncome), accent: 'var(--positive)' });

  if (!items.length) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
      gap: 10,
    }}>
      {items.map(({ label, value, accent }) => (
        <div key={label} style={{
          padding: '10px 12px', border: '1px solid var(--line)',
          borderRadius: 10, background: 'var(--surface)',
        }}>
          <div style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 6 }}>
            {label}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: accent || 'var(--text)' }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
