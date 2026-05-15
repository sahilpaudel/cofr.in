import React from 'react';
import { fmtINR } from '../lib/format.js';

export default function StatCard({ label, value, accent, sign = '' }) {
  return (
    <div className="stat">
      <div className="stat-label">
        <span style={{
          width: 4, height: 4, borderRadius: '50%', background: accent, display: 'inline-block',
        }} />
        {label}
      </div>
      <div className="stat-value">
        {sign}{fmtINR(value, { compact: true }).replace('−', '')}
      </div>
    </div>
  );
}
