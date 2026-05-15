import React, { useMemo, useRef, useState } from 'react';
import { ACCOUNT_TYPES } from '../lib/accountTypes.js';
import { fmtINR, fmtDate } from '../lib/format.js';
import { loadStatements } from '../lib/statementStore.js';
import { importDump, isForeignBackup } from '../lib/storage.js';
import EmptyState from '../components/EmptyState.jsx';
import ForeignBackupDialog from '../components/ForeignBackupDialog.jsx';
import StatCard from '../components/StatCard.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import Composition from '../components/Composition.jsx';
import AccountRow from '../components/AccountRow.jsx';
import FamilyBar from '../components/FamilyBar.jsx';
import SiteStats from '../components/SiteStats.jsx';
import ExportDialog from '../components/ExportDialog.jsx';
import { Icon } from '../icons/Icon.jsx';

export default function Dashboard({ totals, accounts, members = [], memberTotals = [], onAdd, onEdit, onImport, onManageFamily, onTour }) {
  const importRef = useRef();
  const [importing, setImporting] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [foreignBackup, setForeignBackup] = useState(null);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importRef.current.value = '';

    let dump;
    try {
      const text = await file.text();
      dump = JSON.parse(text);
      if (typeof dump !== 'object' || Array.isArray(dump)) throw new Error();
    } catch {
      alert('Invalid backup file.');
      return;
    }

    if (isForeignBackup(dump)) {
      setForeignBackup(dump);
      return;
    }

    if (!window.confirm('This will overwrite all current data. Continue?')) return;
    setImporting(true);
    try { importDump(dump); } catch { setImporting(false); }
  };

  if (accounts.length === 0) return (
    <>
      <EmptyState
        onAdd={onAdd}
        onImport={() => importRef.current?.click()}
        onManageFamily={onManageFamily}
        onTour={onTour}
      />
      <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />
      {foreignBackup && (
        <ForeignBackupDialog
          dump={foreignBackup}
          onCancel={() => setForeignBackup(null)}
        />
      )}
    </>
  );

  const stmtByAccount = useMemo(() => {
    const map = {};
    for (const s of loadStatements()) {
      if (s.accountId && !map[s.accountId]) map[s.accountId] = s;
    }
    return map;
  }, []);

  const byType = useMemo(() => {
    const m = {};
    accounts.forEach((a) => {
      const bal = a.type === 'creditCard'
        ? (a.balance != null && a.balance !== '' ? Number(a.balance) : (stmtByAccount[a.id]?.summary?.totalDue ?? 0))
        : (Number(a.balance) || 0);
      m[a.type] = (m[a.type] || 0) + bal;
    });
    return m;
  }, [accounts, stmtByAccount]);

  const recent = useMemo(
    () =>
      [...accounts]
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 6),
    [accounts]
  );

  const casData = useMemo(() => {
    const mfAggregate = accounts.find(
      (a) => a.aggregateKind === 'mutualFund' || a.importKey === 'aggregate:mutualFund'
    );
    const dematAccounts = accounts.filter(
      (a) => a.type === 'stock' && String(a.importKey || '').startsWith('stock:broker:')
    );
    return { mfAggregate, dematAccounts };
  }, [accounts]);

  const assetCount = accounts.filter((a) => ACCOUNT_TYPES[a.type]?.kind === 'asset').length;
  const liabCount = accounts.filter((a) => ACCOUNT_TYPES[a.type]?.kind === 'liability').length;

  return (
    <div className="pt-14 fade">
      {/* Top action bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 24 }}>
        {onManageFamily && (
          <button
            onClick={onManageFamily}
            className="btn-ghost"
            style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6 }}
          >
            <Icon name="users" size={14} stroke={1.5} style={{ color: 'var(--text-dim)' }} />
            <span className="btn-icon-label">{members.length > 0 ? 'Manage family' : 'Add family'}</span>
          </button>
        )}
        <button
          onClick={() => setShowExport(true)}
          className="btn-ghost"
          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6 }}
        >
          <Icon name="upload" size={14} stroke={1.5} style={{ color: 'var(--positive)' }} />
          <span className="btn-icon-label">Export</span>
        </button>
        <button
          onClick={() => importRef.current?.click()}
          disabled={importing}
          className="btn-ghost"
          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6 }}
        >
          <Icon name="download" size={14} stroke={1.5} style={{ color: '#60a5fa' }} />
          <span className="btn-icon-label">{importing ? 'Importing…' : 'Import'}</span>
        </button>
        <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />
      </div>

      {/* Hero */}
      <div className="grid-12 items-end pb-14" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="col-8">
          <div className="eyebrow mb-5 flex items-center gap-3">
            <span>Net worth</span>
            <span className="dot" />
            <span>{fmtDate(new Date().toISOString())}</span>
          </div>
          <div
            className="rise font-display tabular"
            style={{
              fontSize: 'clamp(56px, 9vw, 128px)',
              fontWeight: 400,
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            {fmtINR(totals.net)}
          </div>
          <div className="mt-6 flex items-center" style={{ gap: 24, fontSize: 13, color: 'var(--text-dim)' }}>
            <span className="flex items-center gap-2">
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--positive)', display: 'inline-block',
              }} />
              {assetCount} {assetCount === 1 ? 'asset' : 'assets'}
            </span>
            <span className="flex items-center gap-2">
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--negative)', display: 'inline-block',
              }} />
              {liabCount} {liabCount === 1 ? 'liability' : 'liabilities'}
            </span>
          </div>
        </div>

        <div className="col-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <StatCard label="Assets"      value={totals.assets} accent="var(--positive)" />
          <StatCard label="Liabilities" value={totals.liabs}  accent="var(--negative)" sign="−" />
        </div>
      </div>

      {/* Family breakdown — only when members are configured */}
      {memberTotals.length > 0 && (
        <FamilyBar memberTotals={memberTotals} onManage={onManageFamily} />
      )}

      <SiteStats style={{ marginTop: 20 }} />

      {/* Composition + recent */}
      <div className="grid-12 mt-12">
        <section className="col-7">
          <SectionHeader title="Composition" caption="Where your wealth lives" />
          <Composition byType={byType} total={totals.assets} />
        </section>

        <section className="col-5">
          <SectionHeader title="Recent activity" caption="Last touched" />
          <div className="list">
            {recent.map((a) => {
              const owner = members.length > 1
                ? (members.find(m => m.id === a.ownerId) || (a.ownerId ? null : members[0]))
                : null;
              return (
                <AccountRow key={a.id} account={a} onClick={() => onEdit(a)} compact statement={stmtByAccount[a.id]} member={owner} />
              );
            })}
          </div>
        </section>
      </div>

      {/* CAS Holdings */}
      {(casData.mfAggregate || casData.dematAccounts.length > 0) && (
        <div className="mt-12" style={{ borderTop: '1px solid var(--line)', paddingTop: 48 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, letterSpacing: '-0.02em', margin: 0 }}>
                CAS Holdings
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                Imported from your consolidated account statement
              </div>
            </div>
            {onImport && (
              <button className="btn-ghost" onClick={onImport} style={{ fontSize: 12 }}>
                Update from CAS
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {casData.mfAggregate && (
              <button
                className="stat card-hover"
                onClick={() => onEdit(casData.mfAggregate)}
                style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
              >
                <div className="stat-label">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-text)', display: 'inline-block' }} />
                  Mutual Fund Folios
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, letterSpacing: '0.12em',
                    border: '1px solid var(--accent-text)', color: 'var(--accent-text)',
                    borderRadius: 4, padding: '1px 5px', opacity: 0.7,
                  }}>CAS</span>
                </div>
                <div className="stat-value">{fmtINR(casData.mfAggregate.balance)}</div>
                {casData.mfAggregate.updatedAt && (
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 6 }}>
                    {fmtDate(new Date(casData.mfAggregate.updatedAt).toISOString())}
                  </div>
                )}
              </button>
            )}

            {casData.dematAccounts.map((a) => (
              <button
                key={a.id}
                className="stat card-hover"
                onClick={() => onEdit(a)}
                style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
              >
                <div className="stat-label">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
                  {a.nickname || a.broker || 'Demat'}
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, letterSpacing: '0.12em',
                    border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24',
                    borderRadius: 4, padding: '1px 5px',
                  }}>CAS</span>
                </div>
                <div className="stat-value">{fmtINR(a.balance)}</div>
                {a.updatedAt && (
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 6 }}>
                    {fmtDate(new Date(a.updatedAt).toISOString())}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {showExport && (
        <ExportDialog
          accounts={accounts}
          members={members}
          onClose={() => setShowExport(false)}
        />
      )}

      {foreignBackup && (
        <ForeignBackupDialog
          dump={foreignBackup}
          onCancel={() => setForeignBackup(null)}
        />
      )}
    </div>
  );
}
