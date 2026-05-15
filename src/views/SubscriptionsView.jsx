import React, { useMemo, useState } from 'react';
import { Icon } from '../icons/Icon.jsx';
import { fmtINR } from '../lib/format.js';
import { loadSubscriptions, saveSubscriptions } from '../lib/subscriptionStore.js';
import { detectSubscriptionsFromStatements } from '../lib/detectSubscriptions.js';
import SubscriptionModal from '../components/SubscriptionModal.jsx';
import { getToken, clearToken, fetchSubscriptionEmails } from '../lib/gmail.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const STATUS_COLOR = {
  active:    'var(--positive)',
  paused:    'var(--amber)',
  cancelled: 'var(--text-faint)',
};

const CYCLE_LABEL = {
  monthly:   'monthly',
  quarterly: 'quarterly',
  yearly:    'yearly',
};

function toMonthly(amount, cycle) {
  if (cycle === 'yearly')    return amount / 12;
  if (cycle === 'quarterly') return amount / 3;
  return amount;
}

function formatDue(nextDue) {
  if (!nextDue) return null;
  const d = new Date(nextDue + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0)   return { label: 'Overdue',         color: 'var(--negative)' };
  if (diff === 0)  return { label: 'Due today',       color: 'var(--negative)' };
  if (diff === 1)  return { label: 'Due tomorrow',    color: 'var(--amber)' };
  if (diff <= 7)   return { label: `Due in ${diff}d`, color: 'var(--amber)' };
  return { label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), color: 'var(--text-faint)' };
}

function SubscriptionRow({ sub, onClick, onDelete }) {
  const due = formatDue(sub.nextDue);
  const isInactive = sub.status !== 'active';

  return (
    <div
      className="card-hover"
      style={{
        display: 'flex', alignItems: 'center',
        padding: '13px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 10, gap: 12,
        opacity: isInactive ? 0.6 : 1,
      }}
    >
      {/* Clickable area — opens edit modal */}
      <div
        onClick={onClick}
        style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: STATUS_COLOR[sub.status] || 'var(--text-faint)',
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 500, color: 'var(--text)',
            textDecoration: sub.status === 'cancelled' ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {sub.name}
          </div>
          {due && (
            <div style={{ fontSize: 11, color: due.color, marginTop: 2 }}>{due.label}</div>
          )}
        </div>

        <span style={{
          fontSize: 10, color: 'var(--text-faint)',
          border: '1px solid var(--line)', borderRadius: 4, padding: '2px 6px', flexShrink: 0,
        }}>
          {CYCLE_LABEL[sub.cycle] || sub.cycle}
        </span>

        <div style={{
          fontVariantNumeric: 'tabular-nums', fontSize: 14, letterSpacing: '-0.02em',
          color: isInactive ? 'var(--text-faint)' : 'var(--text)',
          flexShrink: 0, minWidth: 56, textAlign: 'right',
        }}>
          {fmtINR(sub.amount)}
        </div>
      </div>

      {/* Inline delete */}
      <button
        onClick={onDelete}
        title="Delete"
        style={{
          flexShrink: 0, padding: '4px 6px',
          color: 'var(--text-faint)', borderRadius: 6,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--negative)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
      >
        <Icon name="trash" size={14} stroke={1.5} />
      </button>
    </div>
  );
}

function SectionLabel({ label, count, total }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 10, padding: '0 4px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 500 }}>
          {label}
        </span>
        <span style={{
          fontSize: 10, color: 'var(--text-faint)',
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 4, padding: '1px 5px',
        }}>{count}</span>
      </div>
      {total != null && (
        <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-dim)', letterSpacing: '-0.01em' }}>
          {fmtINR(total)}<span style={{ color: 'var(--text-faint)', fontSize: 10 }}>/mo</span>
        </span>
      )}
    </div>
  );
}

// Candidates table shared by "Detect from statements" and "Scan Gmail" results
function CandidateTable({ candidates, existingNames, onAdd }) {
  if (!candidates.length) return (
    <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '12px 0' }}>
      Nothing found.
    </div>
  );

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{
        padding: '7px 14px', background: 'var(--surface-2)',
        borderBottom: '1px solid var(--line)',
        fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        {candidates.length} detected · click Add to track
      </div>
      {candidates.map((c, i) => {
        const alreadyTracked = existingNames.has((c.name || c.from || '').toLowerCase());
        return (
          <div key={c.name || c.from || i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 14px',
            borderBottom: i < candidates.length - 1 ? '1px solid var(--line)' : 'none',
            opacity: alreadyTracked ? 0.45 : 1,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.name || c.from}
              </div>
              {c.accounts?.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>
                  {c.accounts.join(' · ')}
                  {c.occurrences > 1 && <span> · {c.occurrences}× found</span>}
                </div>
              )}
              {c.subject && (
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.subject}
                </div>
              )}
            </div>
            {c.amount > 0 && (
              <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--text-dim)', flexShrink: 0 }}>
                {fmtINR(c.amount)}
              </div>
            )}
            {c.date && (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0, minWidth: 60, textAlign: 'right' }}>
                {c.date}
              </div>
            )}
            {alreadyTracked ? (
              <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0, padding: '4px 10px' }}>Tracked</span>
            ) : (
              <button
                className="btn-ghost"
                onClick={() => onAdd(c.name || c.from, c.amount, c.category)}
                style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
              >
                Add
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SubscriptionsView() {
  const [subs, setSubs]           = useState(loadSubscriptions);
  const [modal, setModal]         = useState(null);
  const [filter, setFilter]       = useState('all');
  const [q, setQ]                 = useState('');
  const [stmtResults, setStmtResults] = useState(null); // null | []
  const [scanState, setScanState] = useState(null);     // null | 'scanning' | { results } | { error }

  const persist = (next) => { setSubs(next); saveSubscriptions(next); };

  const handleSave = (data) => {
    if (data.id) {
      persist(subs.map((s) => s.id === data.id ? { ...data, updatedAt: Date.now() } : s));
    } else {
      persist([...subs, { ...data, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() }]);
    }
    setModal(null);
  };

  const handleDelete = (id) => {
    persist(subs.filter((s) => s.id !== id));
    setModal(null);
  };

  const openAddPrefilled = (name, amount, category) => {
    setModal({ name: name || '', amount: amount || '', cycle: 'monthly', category: category || 'other', nextDue: '', status: 'active' });
  };

  const detectFromStatements = () => {
    const results = detectSubscriptionsFromStatements();
    setStmtResults(results);
  };

  const scanGmail = async () => {
    setScanState('scanning');
    try {
      const { token } = await getToken(CLIENT_ID);
      const results = await fetchSubscriptionEmails(token);
      setScanState({ results });
    } catch (err) {
      clearToken();
      setScanState({ error: err.message || 'Could not scan Gmail.' });
    }
  };

  const totals = useMemo(() => {
    const active = subs.filter((s) => s.status === 'active');
    const monthly = active.reduce((sum, s) => sum + toMonthly(s.amount, s.cycle), 0);
    return { monthly, yearly: monthly * 12, activeCount: active.length };
  }, [subs]);

  const filtered = useMemo(() => {
    return subs.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (q && !s.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      const order = { active: 0, paused: 1, cancelled: 2 };
      const diff = (order[a.status] ?? 3) - (order[b.status] ?? 3);
      if (diff !== 0) return diff;
      if (!a.nextDue) return 1;
      if (!b.nextDue) return -1;
      return a.nextDue.localeCompare(b.nextDue);
    });
  }, [subs, filter, q]);

  const active    = filtered.filter((s) => s.status === 'active');
  const paused    = filtered.filter((s) => s.status === 'paused');
  const cancelled = filtered.filter((s) => s.status === 'cancelled');
  const activeMonthly = active.reduce((sum, s) => sum + toMonthly(s.amount, s.cycle), 0);

  const existingNames = useMemo(
    () => new Set(subs.map((s) => s.name.toLowerCase())),
    [subs]
  );

  return (
    <div className="pt-14 pb-24 fade" style={{ maxWidth: 720 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div className="eyebrow mb-3">Subscriptions</div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 40, letterSpacing: '-0.03em', lineHeight: 1, margin: 0 }}>
            {subs.length}
            <span style={{ fontSize: 22, letterSpacing: '-0.01em', color: 'var(--text-dim)', marginLeft: 10 }}>
              {subs.length === 1 ? 'subscription' : 'subscriptions'}
            </span>
          </h1>
          {totals.activeCount > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-faint)' }}>
              <span style={{ color: 'var(--positive)' }}>{totals.activeCount} active</span>
              {subs.length > totals.activeCount && <span> · {subs.length - totals.activeCount} inactive</span>}
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={() => setModal('add')}>
          <Icon name="plus" size={14} stroke={2} /> Add new
        </button>
      </div>

      {/* Summary strip */}
      {totals.monthly > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 28, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          {[
            { label: 'Monthly spend',   value: fmtINR(Math.round(totals.monthly)), note: '/mo' },
            { label: 'Yearly spend',    value: fmtINR(Math.round(totals.yearly)),  note: '/yr' },
            { label: 'Active services', value: String(totals.activeCount),          note: null },
          ].map((item, i, arr) => (
            <div key={item.label} style={{
              flex: '1 1 90px', padding: '12px 18px',
              borderRight: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
            }}>
              <div style={{ fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 3 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: 'var(--text)' }}>
                {item.value}
                {item.note && <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 2 }}>{item.note}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <div className="search" style={{ flex: 1, minWidth: 180 }}>
          <Icon name="search" size={14} stroke={1.5} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subscriptions…" />
          {q && (
            <button onClick={() => setQ('')} style={{ color: 'var(--text-faint)', fontSize: 18, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
          )}
        </div>
        <div className="chips">
          {[['all', 'All'], ['active', 'Active'], ['paused', 'Paused'], ['cancelled', 'Cancelled']].map(([k, label]) => (
            <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {subs.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, border: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', color: 'var(--text-faint)',
          }}>
            <Icon name="repeat" size={22} stroke={1.4} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>No subscriptions yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 20 }}>
            Track Netflix, Spotify, and any recurring charges.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => setModal('add')}>
              <Icon name="plus" size={13} stroke={2} /> Add manually
            </button>
            <button className="btn-ghost" onClick={detectFromStatements}>
              Detect from statements
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '52px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 10 }}>
            No subscriptions match{q ? ` "${q}"` : ' this filter'}.
          </div>
          {q && <button onClick={() => setQ('')} style={{ fontSize: 12, color: 'var(--accent-text)' }}>Clear search</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {active.length > 0 && (
            <div>
              <SectionLabel label="Active" count={active.length} total={activeMonthly} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {active.map((s) => (
                  <SubscriptionRow key={s.id} sub={s} onClick={() => setModal(s)} onDelete={() => handleDelete(s.id)} />
                ))}
              </div>
            </div>
          )}
          {paused.length > 0 && (
            <div>
              <SectionLabel label="Paused" count={paused.length} total={null} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {paused.map((s) => (
                  <SubscriptionRow key={s.id} sub={s} onClick={() => setModal(s)} onDelete={() => handleDelete(s.id)} />
                ))}
              </div>
            </div>
          )}
          {cancelled.length > 0 && (
            <div>
              <SectionLabel label="Cancelled" count={cancelled.length} total={null} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cancelled.map((s) => (
                  <SubscriptionRow key={s.id} sub={s} onClick={() => setModal(s)} onDelete={() => handleDelete(s.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Detect from Statements ── */}
      <div style={{ marginTop: 48, paddingTop: 28, borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Detect from statements</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
              Scan your saved bank &amp; credit card statements for recurring charges.
            </div>
          </div>
          <button
            className="btn-ghost"
            onClick={detectFromStatements}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Icon name="search" size={13} stroke={1.5} /> Scan statements
          </button>
        </div>
        {stmtResults !== null && (
          <CandidateTable
            candidates={stmtResults}
            existingNames={existingNames}
            onAdd={(name, amount, category) => openAddPrefilled(name, amount, category)}
          />
        )}
      </div>

      {/* ── Scan Gmail ── */}
      {CLIENT_ID && (
        <div style={{ marginTop: 32, paddingTop: 28, borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Scan Gmail</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                Detect subscription emails from the last 90 days.
              </div>
            </div>
            {!scanState || scanState === 'scanning' ? (
              <button
                className="btn-ghost"
                onClick={scanGmail}
                disabled={scanState === 'scanning'}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                {scanState === 'scanning' ? (
                  <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Scanning…</>
                ) : (
                  <><Icon name="search" size={13} stroke={1.5} /> Scan Gmail</>
                )}
              </button>
            ) : (
              <button className="btn-ghost" onClick={() => setScanState(null)} style={{ fontSize: 12 }}>Clear</button>
            )}
          </div>
          {scanState?.error && (
            <div style={{ fontSize: 13, color: 'var(--negative)', padding: '10px 14px', border: '1px solid #ff6b6b44', borderRadius: 8 }}>
              {scanState.error}
            </div>
          )}
          {scanState?.results && (
            <CandidateTable
              candidates={scanState.results}
              existingNames={existingNames}
              onAdd={(name, amount) => openAddPrefilled(name, amount)}
            />
          )}
        </div>
      )}

      {modal && (
        <SubscriptionModal
          subscription={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
