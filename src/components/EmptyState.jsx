import React from 'react';
import { ACCOUNT_TYPES } from '../lib/accountTypes.js';
import { Icon } from '../icons/Icon.jsx';

export default function EmptyState({ onAdd, onImport, onManageFamily, onTour }) {
  return (
    <div className="pt-24 pb-24 fade">
      <div className="grid-12">
        <div className="col-7">
          <div className="eyebrow mb-5">Welcome</div>
          <h1 className="hero-title">
            Every account.<br />
            <em>One quiet</em> place.
          </h1>
          <p style={{
            fontSize: 16, color: 'var(--text-dim)', maxWidth: 520,
            lineHeight: 1.6, marginBottom: 36,
          }}>
            Track every bank balance, card outstanding, fund folio and loan — all in one place.
            Stored on this device. Not a single byte leaves.
          </p>
          <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={onAdd}>
              Add your first account <Icon name="arrowRight" size={14} stroke={1.8} />
            </button>
            {onImport && (
              <button className="btn-ghost" onClick={onImport} style={{ fontSize: 13 }}>
                <Icon name="download" size={14} stroke={1.5} style={{ color: '#60a5fa' }} />
                Import backup
              </button>
            )}
            {onManageFamily && (
              <button
                onClick={onManageFamily}
                style={{
                  fontSize: 13, color: 'var(--text-dim)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  border: '1px solid var(--line)', borderRadius: 8,
                  padding: '8px 14px', background: 'transparent',
                }}
              >
                <Icon name="users" size={13} stroke={1.5} /> Manage family
              </button>
            )}
            <div style={{
              fontSize: 12, color: 'var(--text-faint)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="lock" size={12} stroke={1.6} /> No sign-up · no cloud
            </div>
            {onTour && (
              <button
                onClick={onTour}
                style={{
                  fontSize: 12, color: 'var(--text-faint)',
                  textDecoration: 'underline', textDecorationColor: 'var(--line)',
                  padding: 0, marginLeft: 4,
                }}
              >
                Take the tour →
              </button>
            )}
          </div>
        </div>

        <div className="col-5">
          <div style={{
            border: '1px solid var(--line)', borderRadius: 16, padding: 24,
          }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>What you can add</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--line-soft)', fontSize: 12.5,
                  }}
                >
                  <span style={{ color: v.accent }}>
                    <Icon name={v.icon} size={14} stroke={1.5} />
                  </span>
                  <span style={{
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
