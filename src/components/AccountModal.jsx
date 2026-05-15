import React, { useEffect, useMemo, useRef, useState } from 'react';
import ModalShell from './ModalShell.jsx';
import Field from './Field.jsx';
import StatementAnalysis from './StatementAnalysis.jsx';
import { ACCOUNT_TYPES, FIELD_SCHEMAS } from '../lib/accountTypes.js';
import { fmtINR } from '../lib/format.js';
import { Icon } from '../icons/Icon.jsx';

function fmtDueDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}


export default function AccountModal({ type, account, members = [], onClose, onSave, onDelete, onUpdate, onViewReport }) {
  const meta = ACCOUNT_TYPES[type];
  const schema = FIELD_SCHEMAS[type] || [];
  const isEdit = !!account;

  const [data, setData] = useState(() => {
    const init = { type };
    schema.forEach((f) => (init[f.k] = ''));
    if (account) Object.assign(init, account);
    return init;
  });

  // Track fields that were auto-filled from a statement so we can re-sync them
  // if the account prop is updated externally (e.g. CC statement analyzed in Statements page).
  const initBalanceRef = useRef(account?.balance ?? null);
  const initDueDateRef = useRef(account?.dueDate ?? null);

  useEffect(() => {
    if (!account) return;
    setData(d => {
      const next = { ...d };
      let dirty = false;
      // Only sync if the value changed externally (not yet reflected in local state)
      if (account.balance != null && account.balance !== initBalanceRef.current) {
        initBalanceRef.current = account.balance;
        next.balance = String(account.balance);
        next._autoBalance = false;
        dirty = true;
      }
      if (account.dueDate && account.dueDate !== initDueDateRef.current) {
        initDueDateRef.current = account.dueDate;
        next.dueDate = account.dueDate;
        dirty = true;
      }
      return dirty ? next : d;
    });
  }, [account?.balance, account?.dueDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-compute current value for MF (units × NAV) and stock (qty × LTP).
  useEffect(() => {
    if (type === 'mutualFund') {
      const u = parseFloat(data.units);
      const n = parseFloat(data.nav);
      if (!isNaN(u) && !isNaN(n) && (!data.balance || data._autoBalance)) {
        setData((d) => ({ ...d, balance: (u * n).toFixed(2), _autoBalance: true }));
      }
    } else if (type === 'stock') {
      const q = parseFloat(data.quantity);
      const p = parseFloat(data.ltp);
      if (!isNaN(q) && !isNaN(p) && (!data.balance || data._autoBalance)) {
        setData((d) => ({ ...d, balance: (q * p).toFixed(2), _autoBalance: true }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.units, data.nav, data.quantity, data.ltp]);

  const setField = (k, v) =>
    setData((d) => ({
      ...d,
      [k]: v,
      ...(k === 'balance' ? { _autoBalance: false } : {}),
    }));

  const canSave = useMemo(
    () => schema.filter((f) => f.required).every((f) => String(data[f.k] ?? '').trim() !== ''),
    [schema, data]
  );

  const buildClean = (d) => {
    const cleaned = { ...d };
    schema.forEach((f) => {
      if (f.type === 'number') {
        cleaned[f.k] = cleaned[f.k] === '' ? null : Number(cleaned[f.k]);
      }
    });
    delete cleaned._autoBalance;
    return cleaned;
  };

  const submit = () => onSave(buildClean(data));

  const markPaid = () => onSave(buildClean({ ...data, balance: '', dueDate: '' }));

  // NPS: populate balance + contributions from parsed statement, then silent-save.
  const handleNpsStatementData = ({ balance, contributions }) => {
    const next = { ...data };
    if (balance != null) { next.balance = String(balance); next._autoBalance = false; }
    if (contributions != null) next.contributions = String(contributions);
    setData(next);
    onUpdate?.(buildClean(next));
  };

  return (
    <ModalShell onClose={onClose} maxWidth={560}>
      <div className="modal-header">
        <div
          style={{
            width: 40, height: 40, borderRadius: 10,
            border: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: meta.accent,
          }}
        >
          <Icon name={meta.icon} size={18} stroke={1.5} />
        </div>
        <div>
          <div className="eyebrow">
            {isEdit ? 'Edit' : 'New'} · {meta.kind}
          </div>
          <h2 style={{
            fontFamily: 'Fraunces, serif', fontSize: 22,
            letterSpacing: '-0.02em', margin: 0,
          }}>
            {meta.label}
          </h2>
        </div>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Owner picker — only shown when family members are configured */}
        {members.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Owner
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {members.map((m, i) => {
                const selected = data.ownerId === m.id || (i === 0 && !data.ownerId);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setField('ownerId', i === 0 ? null : m.id)}
                    style={{
                      fontSize: 12, padding: '5px 11px 5px 8px',
                      borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      border: `1px solid ${selected ? m.color : 'var(--line)'}`,
                      background: selected ? `${m.color}22` : 'transparent',
                      color: selected ? m.color : 'var(--text-dim)',
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, display: 'inline-block', flexShrink: 0 }} />
                    {m.name}{i === 0 ? ' (you)' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {schema.map((f) => (
          <div key={f.k}>
            <Field field={f} value={data[f.k]} onChange={(v) => setField(f.k, v)} />
          </div>
        ))}

        {/* Bank: optional balance — separate from identity fields */}
        {type === 'bank' && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <Field
              field={{ k: 'balance', label: 'Current balance', type: 'number', prefix: '₹', hint: 'Optional' }}
              value={data.balance || ''}
              onChange={v => setField('balance', v)}
            />
          </div>
        )}

        {/* CC: outstanding amount + due date info */}
        {type === 'creditCard' && (Number(data.balance) > 0 || data.dueDate) && (
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            border: '1px solid var(--line)', background: 'var(--surface)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              {Number(data.balance) > 0 && (
                <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--negative)' }}>
                  {fmtINR(Number(data.balance))} due
                </span>
              )}
              {data.dueDate && (
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  by {fmtDueDate(data.dueDate)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={markPaid}
              style={{
                fontSize: 12.5, padding: '7px 0',
                border: '1px solid var(--line)', borderRadius: 8,
                background: 'transparent', color: 'var(--text-dim)',
                cursor: 'pointer', width: '100%',
              }}
            >
              Mark as Paid
            </button>
          </div>
        )}

        {/* NPS: statement analysis lives here (PDF → populate balance + contributions) */}
        {type === 'nps' && (
          <StatementAnalysis
            account={{ ...data, type }}
            onViewReport={onViewReport}
            onStatementData={handleNpsStatementData}
          />
        )}
      </div>

      <div className="modal-footer">
        {isEdit ? (
          <button
            onClick={() => onDelete(account.id)}
            style={{
              fontSize: 12.5, color: 'var(--text-faint)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Icon name="trash" size={13} stroke={1.5} /> Delete
          </button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!canSave}>
            {isEdit ? 'Save changes' : 'Add account'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
