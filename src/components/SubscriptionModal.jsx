import React, { useState } from 'react';
import ModalShell from './ModalShell.jsx';
import { Icon } from '../icons/Icon.jsx';

const CATEGORIES = [
  { k: 'streaming',    label: 'Streaming' },
  { k: 'music',        label: 'Music' },
  { k: 'news',         label: 'News & Media' },
  { k: 'productivity', label: 'Productivity' },
  { k: 'gaming',       label: 'Gaming' },
  { k: 'cloud',        label: 'Cloud Storage' },
  { k: 'health',       label: 'Health & Fitness' },
  { k: 'other',        label: 'Other' },
];

const CYCLES = [
  { k: 'monthly',   label: 'Monthly' },
  { k: 'quarterly', label: 'Quarterly' },
  { k: 'yearly',    label: 'Yearly' },
];

const STATUSES = [
  { k: 'active',    label: 'Active' },
  { k: 'paused',    label: 'Paused' },
  { k: 'cancelled', label: 'Cancelled' },
];

const FIELD  = { display: 'flex', flexDirection: 'column', gap: 6 };
const LABEL  = { fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 500 };
const INPUT  = {
  padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8,
  background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14, width: '100%',
};

export default function SubscriptionModal({ subscription = null, onClose, onSave, onDelete }) {
  const isEdit = Boolean(subscription?.id);

  const [name,     setName]     = useState(subscription?.name     || '');
  const [amount,   setAmount]   = useState(subscription?.amount != null ? String(subscription.amount) : '');
  const [cycle,    setCycle]    = useState(subscription?.cycle    || 'monthly');
  const [category, setCategory] = useState(subscription?.category || 'other');
  const [nextDue,  setNextDue]  = useState(subscription?.nextDue  || '');
  const [status,   setStatus]   = useState(subscription?.status   || 'active');

  const canSave = name.trim() && amount !== '' && !isNaN(Number(amount)) && Number(amount) >= 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      ...(subscription || {}),
      name: name.trim(),
      amount: Number(amount),
      cycle,
      category,
      nextDue,
      status,
    });
  };

  return (
    <ModalShell onClose={onClose}>
      <div style={{ padding: '24px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            {isEdit ? 'Edit subscription' : 'Add subscription'}
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-faint)', padding: 4 }}>
            <Icon name="close" size={16} stroke={1.5} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={FIELD}>
            <label style={LABEL}>Service name</label>
            <input
              style={INPUT}
              placeholder="e.g. Netflix, Spotify, Notion"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={FIELD}>
              <label style={LABEL}>Amount (₹)</label>
              <input
                style={INPUT}
                type="number"
                placeholder="649"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
              />
            </div>
            <div style={FIELD}>
              <label style={LABEL}>Billing cycle</label>
              <select style={{ ...INPUT, cursor: 'pointer' }} value={cycle} onChange={(e) => setCycle(e.target.value)}>
                {CYCLES.map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={FIELD}>
              <label style={LABEL}>Category</label>
              <select style={{ ...INPUT, cursor: 'pointer' }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}
              </select>
            </div>
            <div style={FIELD}>
              <label style={LABEL}>Next due date</label>
              <input
                style={{ ...INPUT, colorScheme: 'dark' }}
                type="date"
                value={nextDue}
                onChange={(e) => setNextDue(e.target.value)}
              />
            </div>
          </div>

          <div style={FIELD}>
            <label style={LABEL}>Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {STATUSES.map((s) => (
                <button
                  key={s.k}
                  onClick={() => setStatus(s.k)}
                  style={{
                    flex: 1, padding: '8px 0',
                    borderRadius: 8, fontSize: 13,
                    border: status === s.k ? '1px solid var(--accent-text)' : '1px solid var(--line)',
                    background: status === s.k ? 'var(--surface)' : 'var(--surface-2)',
                    color: status === s.k ? 'var(--accent-text)' : 'var(--text-dim)',
                    transition: 'all 0.15s',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', marginTop: 24,
        borderTop: '1px solid var(--line)',
      }}>
        {isEdit ? (
          <button
            onClick={() => onDelete(subscription.id)}
            style={{ fontSize: 13, color: 'var(--negative)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="trash" size={13} stroke={1.5} /> Delete
          </button>
        ) : <div />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!canSave}>
            {isEdit ? 'Save changes' : 'Add subscription'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
