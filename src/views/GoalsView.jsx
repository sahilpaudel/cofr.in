import React, { useMemo, useState } from 'react';
import ModalShell from '../components/ModalShell.jsx';
import { loadGoals, saveGoal, deleteGoal } from '../lib/goalsStore.js';
import { fmtINR } from '../lib/format.js';
import { Icon } from '../icons/Icon.jsx';

export const GOAL_COLORS = [
  '#06b6d4', '#84cc16', '#f59e0b', '#f43f5e',
  '#8b5cf6', '#38bdf8', '#f97316', '#10b981',
];

// Account types that can contribute positively toward a goal.
const ASSET_TYPES = new Set(['bank', 'mutualFund', 'stock', 'nps', 'crypto', 'realestate', 'gold', 'cash']);

export default function GoalsView({ accounts = [] }) {
  const [goals, setGoals] = useState(() => loadGoals());
  const [editing, setEditing] = useState(null); // null | {} (new) | goal object (edit)

  const assetAccounts = useMemo(
    () => accounts.filter(a => ASSET_TYPES.has(a.type)),
    [accounts]
  );

  const refresh = () => setGoals(loadGoals());

  const handleSave = (goal) => {
    saveGoal(goal);
    refresh();
    setEditing(null);
  };

  const handleDelete = (id) => {
    deleteGoal(id);
    refresh();
    setEditing(null);
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingTop: 8, paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Targets &amp; progress
          </div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, letterSpacing: '-0.02em', margin: 0 }}>
            Goals
          </h2>
        </div>
        <button
          onClick={() => setEditing({})}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, padding: '6px 12px',
            border: '1px solid var(--line)', borderRadius: 8,
            background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer',
          }}
        >
          <Icon name="plus" size={14} stroke={2} /> Add goal
        </button>
      </div>

      {/* Summary bar */}
      {goals.length > 0 && (
        <GoalsSummary goals={goals} accounts={accounts} />
      )}

      {/* Goal cards */}
      {goals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-faint)' }}>
          <Icon name="target" size={36} stroke={1.2} style={{ opacity: 0.35, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No goals yet</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Set a target and track it against your assets.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              accounts={accounts}
              onEdit={() => setEditing(goal)}
            />
          ))}
        </div>
      )}

      {editing !== null && (
        <GoalModal
          goal={editing.id ? editing : null}
          accounts={assetAccounts}
          onSave={handleSave}
          onDelete={editing.id ? () => handleDelete(editing.id) : null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function GoalsSummary({ goals, accounts }) {
  const totals = useMemo(() => {
    let totalTarget = 0;
    let totalCurrent = 0;
    let done = 0;
    for (const g of goals) {
      const linked = accounts.filter(a => (g.linkedAccountIds || []).includes(a.id));
      const current = linked.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
      totalTarget += g.targetAmount;
      totalCurrent += current;
      if (current >= g.targetAmount) done++;
    }
    return { totalTarget, totalCurrent, done, total: goals.length };
  }, [goals, accounts]);

  const pct = totals.totalTarget > 0
    ? Math.min(100, (totals.totalCurrent / totals.totalTarget) * 100)
    : 0;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20,
    }}>
      {[
        { label: 'Total target', value: fmtINR(totals.totalTarget, { compact: true }) },
        { label: 'Saved so far', value: fmtINR(totals.totalCurrent, { compact: true }), accent: 'var(--positive)' },
        { label: 'Goals achieved', value: `${totals.done} / ${totals.total}` },
      ].map(({ label, value, accent }) => (
        <div key={label} style={{
          padding: '10px 12px', border: '1px solid var(--line)',
          borderRadius: 10, background: 'var(--surface)',
        }}>
          <div style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 5 }}>
            {label}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: accent || 'var(--text)' }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Goal card ─────────────────────────────────────────────────────────────────
function GoalCard({ goal, accounts, onEdit }) {
  const linked = accounts.filter(a => (goal.linkedAccountIds || []).includes(a.id));
  const current = linked.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
  const pct = Math.min(100, goal.targetAmount > 0 ? (current / goal.targetAmount) * 100 : 0);
  const remaining = Math.max(0, goal.targetAmount - current);
  const done = pct >= 100;
  const color = goal.color || GOAL_COLORS[0];

  const deadline = goal.deadline ? new Date(goal.deadline + 'T00:00:00') : null;
  const daysLeft = deadline
    ? Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const deadlineLabel = daysLeft !== null
    ? (daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`)
    : null;

  return (
    <div
      onClick={onEdit}
      style={{
        border: '1px solid var(--line)', borderRadius: 12,
        padding: '16px 18px', background: 'var(--surface)',
        cursor: 'pointer', transition: 'border-color 0.15s',
        borderLeft: `3px solid ${color}`,
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.borderLeftColor = color; }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{goal.name}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: done ? 'var(--positive)' : color, flexShrink: 0 }}>
          {done ? '✓ Done' : `${pct.toFixed(0)}%`}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: 'var(--line)', borderRadius: 3, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${pct}%`,
          background: done ? 'var(--positive)' : color,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Amounts + deadline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
        <span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{fmtINR(current)}</span>
          <span style={{ color: 'var(--text-faint)' }}> of {fmtINR(goal.targetAmount)}</span>
          {!done && remaining > 0 && (
            <span style={{ color: 'var(--text-faint)', marginLeft: 8 }}>· {fmtINR(remaining)} to go</span>
          )}
        </span>
        {deadlineLabel && (
          <span style={{
            fontSize: 10.5, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
            background: daysLeft < 0 ? 'rgba(255,107,107,0.12)' : 'var(--line)',
            color: daysLeft < 0 ? 'var(--negative)' : 'var(--text-faint)',
          }}>
            {deadlineLabel}
          </span>
        )}
      </div>

      {/* Linked account tags */}
      {linked.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
          {linked.map(a => (
            <span key={a.id} style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 4,
              background: color + '18', color: color,
              border: `1px solid ${color}33`,
            }}>
              {a.nickname || a.institution || a.type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add / edit modal ──────────────────────────────────────────────────────────
function GoalModal({ goal, accounts, onSave, onDelete, onClose }) {
  const [name, setName] = useState(goal?.name || '');
  const [target, setTarget] = useState(goal?.targetAmount ? String(goal.targetAmount) : '');
  const [deadline, setDeadline] = useState(goal?.deadline || '');
  const [color, setColor] = useState(goal?.color || GOAL_COLORS[0]);
  const [linkedIds, setLinkedIds] = useState(new Set(goal?.linkedAccountIds || []));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleAccount = (id) =>
    setLinkedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const linkedTotal = accounts
    .filter(a => linkedIds.has(a.id))
    .reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);

  const canSave = name.trim().length > 0 && parseFloat(target) > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: goal?.id || crypto.randomUUID(),
      name: name.trim(),
      targetAmount: parseFloat(target),
      deadline: deadline || null,
      color,
      linkedAccountIds: [...linkedIds],
      createdAt: goal?.createdAt || Date.now(),
    });
  };

  return (
    <ModalShell onClose={onClose} maxWidth={480}>
      {/* Header — never scrolls away */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {goal ? 'Edit goal' : 'New goal'}
        </div>
        <button onClick={onClose} style={closeBtnStyle}>
          <Icon name="close" size={16} stroke={1.8} />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Name */}
        <div>
          <label style={labelStyle}>Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Emergency Fund, House Down Payment"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            style={inputStyle}
          />
        </div>

        {/* Target + Deadline */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Target amount (₹)</label>
            <input
              type="number"
              min="0"
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="500000"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Deadline (optional)</label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Color */}
        <div>
          <label style={labelStyle}>Color</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {GOAL_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 22, height: 22, borderRadius: '50%', background: c,
                  border: `2px solid ${color === c ? 'var(--text)' : 'transparent'}`,
                  outline: `1px solid ${color === c ? 'var(--surface)' : 'transparent'}`,
                  outlineOffset: '-3px',
                  cursor: 'pointer', padding: 0, transition: 'transform 0.1s',
                  transform: color === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Account linker */}
        {accounts.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Link accounts</label>
              {linkedIds.size > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtINR(linkedTotal)} saved
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {accounts.map(a => {
                const checked = linkedIds.has(a.id);
                return (
                  <label
                    key={a.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${checked ? color : 'var(--line)'}`,
                      background: checked ? color + '14' : 'transparent',
                      transition: 'all 0.12s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAccount(a.id)}
                        style={{ accentColor: color, width: 14, height: 14 }}
                      />
                      <span style={{ fontSize: 13 }}>{a.nickname || a.institution || a.type}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtINR(parseFloat(a.balance) || 0)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer — always visible above keyboard */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
        {onDelete ? (
          confirmDelete ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Delete?</span>
              <button onClick={onDelete} style={{ fontSize: 12, color: 'var(--negative)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Yes, delete
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 12, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{ fontSize: 12, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="trash" size={13} stroke={1.5} /> Delete
            </button>
          )
        ) : <span />}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              fontSize: 13, padding: '6px 16px', borderRadius: 8,
              background: canSave ? color : 'var(--line)',
              color: canSave ? '#000' : 'var(--text-faint)',
              border: 'none', cursor: canSave ? 'pointer' : 'default',
              fontWeight: 600, transition: 'background 0.15s',
            }}
          >
            {goal ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  fontSize: 13, padding: '8px 10px',
  border: '1px solid var(--line)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)', outline: 'none',
};

const labelStyle = {
  fontSize: 10.5, color: 'var(--text-faint)',
  display: 'block', marginBottom: 5,
  letterSpacing: '0.1em', textTransform: 'uppercase',
};

const closeBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-faint)', padding: 4, display: 'flex', alignItems: 'center',
};

const cancelBtnStyle = {
  fontSize: 13, color: 'var(--text-dim)', padding: '6px 12px',
  border: '1px solid var(--line)', borderRadius: 8,
  background: 'transparent', cursor: 'pointer',
};
