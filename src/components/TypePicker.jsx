import React from 'react';
import ModalShell from './ModalShell.jsx';
import { ACCOUNT_TYPES, ASSET_KEYS, LIAB_KEYS } from '../lib/accountTypes.js';
import { Icon } from '../icons/Icon.jsx';

function TypeButton({ type, onPick }) {
  const v = ACCOUNT_TYPES[type];
  return (
    <button className="type-btn" onClick={() => onPick(type)}>
      <div className="type-btn-icon" style={{ color: v.accent }}>
        <Icon name={v.icon} size={15} stroke={1.5} />
      </div>
      <div style={{ flex: 1, fontSize: 13 }}>{v.label}</div>
      <Icon name="arrowRight" size={13} stroke={1.6} />
    </button>
  );
}

export default function TypePicker({ onClose, onPick, onImport, onManageFamily, onGoals }) {
  return (
    <ModalShell onClose={onClose} maxWidth={640}>
      <div style={{ padding: '28px 28px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Add account</div>
        <h2 style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 28,
          letterSpacing: '-0.02em',
          margin: 0,
        }}>What are we tracking?</h2>
      </div>

      <div style={{ padding: '0 20px 12px' }}>
        <div className="eyebrow" style={{ padding: '12px 8px 8px' }}>Assets</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
          {ASSET_KEYS.map((k) => (
            <TypeButton key={k} type={k} onPick={onPick} />
          ))}
          {onImport && (
            <button className="type-btn" onClick={onImport}>
              <div className="type-btn-icon" style={{ color: '#38bdf8' }}>
                <Icon name="upload" size={15} stroke={1.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>CAS</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>Import or Upload</div>
              </div>
              <Icon name="arrowRight" size={13} stroke={1.6} />
            </button>
          )}
        </div>

        <div className="eyebrow" style={{ padding: '20px 8px 8px' }}>Liabilities</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
          {LIAB_KEYS.map((k) => (
            <TypeButton key={k} type={k} onPick={onPick} />
          ))}
        </div>
      </div>


      {onGoals && (
        <div style={{ padding: '0 20px 16px' }}>
          <div className="eyebrow" style={{ padding: '4px 8px 8px' }}>Plan</div>
          <button className="type-btn" onClick={onGoals}>
            <div className="type-btn-icon" style={{ color: '#f59e0b' }}>
              <Icon name="target" size={15} stroke={1.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>Goals</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>Track savings targets</div>
            </div>
            <Icon name="arrowRight" size={13} stroke={1.6} />
          </button>
        </div>
      )}

      <div style={{
        padding: '16px 28px',
        borderTop: '1px solid var(--line)',
        fontSize: 11,
        color: 'var(--text-faint)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="lock" size={11} stroke={1.6} /> Saved on this device only.
        </span>
        {onManageFamily && (
          <button
            type="button"
            onClick={onManageFamily}
            style={{
              fontSize: 11, color: 'var(--text-faint)',
              textDecoration: 'underline', textDecorationColor: 'var(--line)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              flexShrink: 0,
            }}
          >
            Manage family
          </button>
        )}
      </div>
    </ModalShell>
  );
}
