import React, { useState } from 'react';
import { Icon } from '../icons/Icon.jsx';
import ClearDataDialog from './ClearDataDialog.jsx';

const TABS = [
  { k: 'dashboard',     label: 'Overview' },
  { k: 'accounts',      label: 'Accounts' },
  { k: 'subscriptions', label: 'Subscriptions' },
  { k: 'statements',    label: 'Statements' },
  { k: 'about',         label: 'About' },
];

export default function TopBar({ view, setView, onAdd, theme, onToggleTheme, onAbout }) {
  const [showClear, setShowClear] = useState(false);

  return (
    <>
      <header className="topbar backdrop">
        <div className="topbar-inner">
          <div className="flex items-center gap-10">
            <div className="brand">
              <div className="brand-mark"><span>C</span></div>
              <span className="brand-name">Coffer</span>
              <span className="pill" style={{ marginLeft: 4 }}>on device</span>
            </div>
            <nav className="nav mobile-hidden">
              {TABS.map((t) => (
                <button
                  key={t.k}
                  id={`tour-tab-${t.k}`}
                  className={`tab ${view === t.k || (t.k === 'statements' && view === 'statement') ? 'active' : ''}`}
                  onClick={() => setView(t.k)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowClear(true)}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                border: '1px solid rgba(185,28,28,0.35)',
                background: 'transparent',
                color: 'var(--negative)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(185,28,28,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon name="trash" size={11} stroke={1.6} />
              <span className="btn-icon-label">Clear data</span>
            </button>
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'transparent',
                color: 'var(--text-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text-faint)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} stroke={1.6} />
            </button>
            {onAbout && (
              <button
                className="mobile-only"
                onClick={onAbout}
                title="About Coffer"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease', cursor: 'pointer',
                }}
              >
                <Icon name="info" size={14} stroke={1.6} />
              </button>
            )}
            <button id="tour-add" className="btn-primary mobile-hidden" onClick={onAdd}>
              <Icon name="plus" size={14} stroke={2} /> Add account
            </button>
          </div>
        </div>
      </header>

      {showClear && <ClearDataDialog onCancel={() => setShowClear(false)} />}
    </>
  );
}
