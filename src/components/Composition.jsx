import React, { useMemo } from 'react';
import { ACCOUNT_TYPES } from '../lib/accountTypes.js';
import { fmtINR } from '../lib/format.js';

export default function Composition({ byType, total }) {
  const entries = useMemo(
    () => Object.entries(byType)
      .filter(([t]) => ACCOUNT_TYPES[t]?.kind === 'asset')
      .sort((a, b) => b[1] - a[1]),
    [byType]
  );

  if (entries.length === 0) {
    return (
      <div style={{
        padding: 32, border: '1px solid var(--line)', borderRadius: 16,
        color: 'var(--text-faint)', fontSize: 14,
      }}>
        No assets yet.
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 24 }}>
      <div className="bar">
        {entries.map(([t, v]) => (
          <div
            key={t}
            title={ACCOUNT_TYPES[t].label}
            style={{
              width: `${(v / total) * 100}%`,
              background: ACCOUNT_TYPES[t].accent,
            }}
          />
        ))}
      </div>
      <div className="legend">
        {entries.map(([t, v]) => {
          const pct = ((v / total) * 100).toFixed(1);
          return (
            <div key={t} className="legend-row">
              <div className="legend-left">
                <span
                  className="legend-swatch"
                  style={{ background: ACCOUNT_TYPES[t].accent }}
                />
                <span>{ACCOUNT_TYPES[t].label}</span>
                <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{pct}%</span>
              </div>
              <span className="tabular muted">{fmtINR(v, { compact: true })}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
